# Diseño: Carpetas compartidas en dos niveles

> Estado: propuesto, pendiente de tu revisión. No implementado.
> Continuación de la sesión que cerró la fase 5 (ver `docs/PROGRESO.md`,
> sesión 2026-09-06).

## Resumen del alcance acordado

Se añade a Vigía la posibilidad de organizar carpetas en dos niveles (carpeta
→ subcarpetas) y de compartir una carpeta de primer nivel completa con otra
cuenta de Vigía, mediante invitación explícita por email. Quien acepta obtiene
los mismos permisos que el dueño sobre esa carpeta, sus subcarpetas y los
items dentro: ver, añadir, editar, borrar. Los items sin carpeta y las
carpetas no compartidas siguen siendo estrictamente privados. Cada persona
conserva su propia cuenta y sesión — no hay cuentas compartidas ni un tercer
rol de "solo lectura" en esta versión.

Ejemplo del caso real que lo motiva: "Electrónica" (con subcarpetas
Micrófonos, Teclados, Cascos) se queda privada de un usuario; "Muebles" (con
subcarpetas Baño, Salón, Sofás) se comparte con su pareja, y ambos ven y
editan lo mismo dentro de ella.

---

## A) Esquema de carpetas con jerarquía: autoreferencia en `folders`

**Decisión:** añadir `fld_parent_id uuid references vigia.folders(fld_id) on
delete cascade`, nullable. Una carpeta con `fld_parent_id = null` es de primer
nivel; una con `fld_parent_id` no nulo es una subcarpeta. Se impide un tercer
nivel con un trigger `BEFORE INSERT OR UPDATE` (un `CHECK` de columna no puede
consultar otras filas de la misma tabla).

**Por qué:** reutiliza toda la infraestructura ya construida — RLS, índices,
`itm_fld_id`, `useFolders.js`, `ItemList.jsx` — sin tocar el resto del modelo
de items. Una tabla `subfolders` separada duplicaría la política RLS, el CRUD
y el componente `FolderManager.jsx` casi 1:1, y complicaría "todas las
carpetas que veo" (UNION de dos tablas en cada consulta).

**Descartado:** tabla `subfolders` separada (duplica RLS/CRUD sin necesidad);
ltree o materialized path para jerarquías arbitrarias (el alcance son
exactamente dos niveles, no N).

---

## B) Modelo de compartir: tabla `folder_shares`

```sql
create table vigia.folder_shares (
  shr_id uuid primary key default gen_random_uuid(),
  shr_fld_id uuid not null references vigia.folders(fld_id) on delete cascade,
  shr_owner_usr_id uuid not null references auth.users(id) on delete cascade,
  shr_invited_email text not null,
  shr_invited_usr_id uuid references auth.users(id) on delete cascade,
  shr_status text not null default 'pending'
    check (shr_status in ('pending', 'accepted', 'revoked')),
  shr_created_at timestamptz not null default now(),
  shr_responded_at timestamptz,
  unique (shr_fld_id, shr_invited_email)
);

comment on column vigia.folder_shares.shr_fld_id is
  'Debe ser una carpeta de primer nivel (fld_parent_id is null). Se valida '
  'con trigger, no con CHECK, porque hace falta leer la fila referenciada.';
comment on column vigia.folder_shares.shr_invited_email is
  'Email normalizado en minusculas. Es la clave de invitacion hasta que se '
  'resuelve a shr_invited_usr_id (puede no tener cuenta aun en Vigia).';
comment on column vigia.folder_shares.shr_invited_usr_id is
  'Se rellena al aceptar (o antes, si el email ya resuelve a una cuenta '
  'existente en el momento de invitar). Null mientras la persona invitada '
  'no tiene cuenta en Vigia todavia.';
```

Notas:
- `shr_fld_id` referencia siempre una carpeta de primer nivel; se valida en un
  trigger que lee `fld_parent_id` de la fila referenciada.
- `unique (shr_fld_id, shr_invited_email)` impide invitaciones duplicadas; una
  fila `revoked` se reutiliza (se pone a `pending` de nuevo) en vez de crear
  otra — ver flujo F.7.
- Sin columna de "rol": no hay más rol que "igual que el dueño" en esta
  versión (ya decidido). Un rol futuro sería una columna `shr_role` aditiva.
- Índices: `folder_shares_fld_idx (shr_fld_id)` y
  `folder_shares_invited_usr_idx (shr_invited_usr_id) where shr_status =
  'accepted'` — este último es el que golpean las políticas RLS de
  items/price_history en cada lectura.

```sql
alter table vigia.folder_shares enable row level security;

create policy folder_shares_owner on vigia.folder_shares
  for all
  to authenticated
  using ((select auth.uid()) = shr_owner_usr_id)
  with check ((select auth.uid()) = shr_owner_usr_id);

create policy folder_shares_invited_read on vigia.folder_shares
  for select
  to authenticated
  using ((select auth.uid()) = shr_invited_usr_id);

create policy folder_shares_invited_respond on vigia.folder_shares
  for update
  to authenticated
  using ((select auth.uid()) = shr_invited_usr_id)
  with check ((select auth.uid()) = shr_invited_usr_id);

grant select, insert, update, delete on vigia.folder_shares to authenticated;
grant all on vigia.folder_shares to service_role;
```

`folder_shares_invited_respond` permite al invitado actualizar la fila (para
aceptar/rechazar). Postgres RLS no distingue columnas dentro de un `UPDATE`,
así que restringir "solo puede tocar `shr_status`/`shr_responded_at`" queda
como responsabilidad del RPC de aceptación (F.4), no de la política.

---

## C) Resolver email → user_id: Edge Function con `service_role`

**Decisión:** una Edge Function `invite-to-folder` (mismo patrón que
`scrape`/`refresh`: JWT validado a mano, `service_role` interno,
`--no-verify-jwt`) recibe `{ fld_id, email }`, valida que quien llama es dueño
de una carpeta de primer nivel, resuelve el email a `user_id` con
`service_role`, y escribe/reactiva la fila en `folder_shares`. Responde
siempre `{ ok: true }`, sin indicar si el email tenía cuenta o no.

**Por qué, y no una tabla `user_directory`:** cualquier tabla en `vigia`
consultable por el cliente por email —aunque tenga RLS— es un oráculo de
enumeración: quien controla la sesión puede probar miles de emails y, por la
diferencia entre "fila encontrada" y "vacía" (o por timing), aprender qué
direcciones tienen cuenta en Vigía. RLS filtra filas por *dueño*, no puede
expresar "solo puedes preguntar por el email de alguien que ya te ha
invitado" sin ya tener la respuesta. Una Edge Function es un punto de control
imperativo: puede devolver siempre la misma respuesta de éxito, aplicar
rate-limiting, y nunca expone si había cuenta o no.

**Caso "el email invitado no tiene cuenta todavía":** la fila queda con
`shr_invited_usr_id = null`, `shr_status = 'pending'`. Un trigger `AFTER
INSERT on auth.users` (mismo patrón que ya usa la migración 005 para
`user_settings`) resuelve invitaciones pendientes por email cuando esa
persona se registra por primera vez.

**Descartado:** tabla `vigia.user_directory` (abre enumeración de cuentas);
resolver el email en el cliente contra `auth.admin` (expondría la
`service_role key` en el navegador).

---

## D) RLS de `folders`, `items`, `price_history` con compartición

Regla general: acceso si eres el dueño **O** existe una fila `folder_shares`
aceptada para la carpeta de primer nivel de la que cuelga la fila
(directamente, o vía su carpeta padre si es subcarpeta).

Función auxiliar, para no repetir el `JOIN` en cada política y para que el
planificador la trate como subconsulta cacheable (mismo motivo que exige
`(select auth.uid())` en vez de `auth.uid()` directo):

```sql
create or replace function vigia.visible_folder_ids()
returns setof uuid
language sql
security invoker
stable
set search_path = public
as $$
  select f.fld_id
  from vigia.folders f
  where f.fld_usr_id = (select auth.uid())
  union
  select f.fld_id
  from vigia.folders f
  join vigia.folder_shares s
    on s.shr_fld_id = coalesce(f.fld_parent_id, f.fld_id)
  where s.shr_invited_usr_id = (select auth.uid())
    and s.shr_status = 'accepted'
$$;

revoke execute on function vigia.visible_folder_ids() from anon, public;
grant execute on function vigia.visible_folder_ids() to authenticated;
```

`security invoker` (no `definer`): la función debe correr con los permisos y
el `auth.uid()` de quien llama; no necesita saltar RLS porque solo lee tablas
que ya tienen políticas coherentes con esto.

### `folders`

```sql
drop policy folders_own on vigia.folders;

create policy folders_own on vigia.folders
  for all
  to authenticated
  using ((select auth.uid()) = fld_usr_id)
  with check ((select auth.uid()) = fld_usr_id);

create policy folders_shared_read on vigia.folders
  for select
  to authenticated
  using (fld_id in (select vigia.visible_folder_ids()));
```

`folders_own` se deja intacta para todo lo que no sea `SELECT`: crear,
renombrar o borrar la carpeta sigue siendo solo del dueño — el invitado puede
operar sobre *items*, no gestionar la carpeta en sí. Postgres aplica las
políticas del mismo comando con `OR`, así que ambas conviven sin conflicto.

### `items`

```sql
drop policy items_own on vigia.items;

create policy items_own on vigia.items
  for all
  to authenticated
  using ((select auth.uid()) = itm_usr_id)
  with check ((select auth.uid()) = itm_usr_id);

create policy items_shared on vigia.items
  for all
  to authenticated
  using (itm_fld_id in (select vigia.visible_folder_ids()))
  with check (itm_fld_id in (select vigia.visible_folder_ids()));
```

`items_shared` es `for all` porque el invitado puede ver, añadir, editar y
borrar igual que el dueño (ya decidido). El `with check` cubre el `INSERT` de
un item nuevo por parte del invitado: basta con que `itm_fld_id` esté entre
las carpetas visibles. Un item con `itm_fld_id = null` ("Sin carpeta") nunca
aparece en `visible_folder_ids()`, así que sigue siendo estrictamente privado.

### `price_history`

```sql
drop policy price_history_own on vigia.price_history;

create policy price_history_own on vigia.price_history
  for all
  to authenticated
  using (
    exists (
      select 1 from vigia.items
      where itm_id = ph_itm_id
        and (
          itm_usr_id = (select auth.uid())
          or itm_fld_id in (select vigia.visible_folder_ids())
        )
    )
  )
  with check (
    exists (
      select 1 from vigia.items
      where itm_id = ph_itm_id
        and (
          itm_usr_id = (select auth.uid())
          or itm_fld_id in (select vigia.visible_folder_ids())
        )
    )
  );
```

### Índices necesarios

```sql
-- Ya existe (migración 001): folders_usr_idx on folders (fld_usr_id)
create index folders_parent_idx on vigia.folders (fld_parent_id);
create index folder_shares_invited_usr_idx on vigia.folder_shares (shr_invited_usr_id)
  where shr_status = 'accepted';
create index folder_shares_fld_idx on vigia.folder_shares (shr_fld_id);
-- Ya existe (migración 001): items_usr_fld_idx on items (itm_usr_id, itm_fld_id)
create index items_fld_idx on vigia.items (itm_fld_id);
```

---

## E) `itm_usr_id` cuando alguien más añade un item a una carpeta compartida

**Decisión:** `itm_usr_id` se queda con el `id` de quien crea el item, sea el
dueño de la carpeta o el invitado. No se sustituye por el dueño de la carpeta.

**Por qué:** conserva trazabilidad ("añadido por Ana"), útil en un contexto de
pareja. Y simplifica la revocación (F.6): al revocar, el invitado pierde
acceso a los items *ajenos* de esa carpeta vía `items_shared`, pero conserva
para siempre acceso a los que *él mismo* creó, vía `items_own`.

**Descartado:** `itm_usr_id` = siempre el dueño de la carpeta — pierde
trazabilidad y complica la revocación en vez de simplificarla.

---

## F) Flujo completo de invitar, aceptar y revocar

1. **Invitar.** El dueño, desde "Compartir" en una carpeta de primer nivel,
   escribe un email → Edge Function `invite-to-folder` con `{ fld_id, email
   }` y su JWT. La función valida dueño+primer nivel, normaliza el email,
   resuelve si existe cuenta con `service_role`, e inserta/reactiva la fila
   en `folder_shares` con `shr_status = 'pending'`. Responde siempre `{ ok:
   true }`.
2. **Qué ve el invitado antes de aceptar.** Si ya tenía cuenta, al iniciar
   sesión el frontend consulta sus invitaciones pendientes (cubierto por
   `folder_shares_invited_read`) y muestra un badge ("Ana quiere compartir
   contigo «Muebles»") con Aceptar/Rechazar. No ve nada más de esa carpeta
   hasta aceptar.
3. **Si el email invitado no tiene cuenta todavía**, no pasa nada visible de
   inmediato. Al registrarse por primera vez con ese email, el trigger
   `AFTER INSERT on auth.users` resuelve `shr_invited_usr_id`.
4. **Aceptar.** RPC `vigia.accept_folder_share(p_shr_id uuid)` (`security
   definer`, valida `shr_invited_usr_id = auth.uid()` y `shr_status =
   'pending'`) actualiza `shr_status = 'accepted'`, `shr_responded_at =
   now()`. La RLS ya da acceso desde ese instante — no hay que copiar filas.
5. **Rechazar**: RPC simétrico o `UPDATE` a `shr_status = 'revoked'` hecho por
   el propio invitado (cubierto por `folder_shares_invited_respond`).
6. **Revocar (el dueño).** `UPDATE shr_status = 'revoked'` desde el modal de
   compartir. En el mismo paso, mover a `itm_fld_id = null` los items cuyo
   `itm_usr_id` sea el del invitado y cuelguen de esa carpeta o subcarpetas
   (pasan a "Sin carpeta" del propio invitado, igual que al borrar una
   carpeta hoy). Los items del dueño no se tocan.
7. **Re-invitar tras revocar** reutiliza la misma fila (`UPDATE ... set
   shr_status = 'pending', shr_responded_at = null`), no crea una nueva.

---

## G) Impacto en frontend

**Hooks:**
- `useFolders.js` — se amplía: `createFolder` acepta `parentId` opcional;
  helper `foldersTree` (agrupación padre→hijos en memoria); `sharedWith(folderId)`.
- `useFolderShares.js` (nuevo) — `invite(fldId, email)`, `pendingInvitesForMe()`,
  `acceptShare(shrId)`, `rejectShare(shrId)`, `revokeShare(shrId)`.
- `useItems.js` — sin cambios estructurales: la RLS ya resuelve qué filas son
  visibles, `select * from items` sigue funcionando igual.

**Componentes nuevos:**
- `SubfolderManager.jsx` (o ampliar `FolderManager.jsx` con árbol de dos
  niveles) — crear/renombrar/borrar subcarpetas.
- `ShareFolderModal.jsx` — botón "Compartir" por carpeta de primer nivel:
  campo de email + lista de invitaciones con su estado + revocar.
- `PendingInvitesBanner.jsx` — invitaciones que me han hecho a mí, con
  Aceptar/Rechazar, consultado al cargar sesión.

**Cambios en componentes existentes:**
- `ItemList.jsx` — agrupación en dos niveles (carpeta → subcarpeta) en vez de
  un nivel plano; indicador si una carpeta de primer nivel está compartida
  (con quién); opcionalmente "añadido por…" si `itm_usr_id` no es el usuario
  actual.
- `FolderManager.jsx` — árbol carpeta→subcarpetas, botón "Compartir" por
  carpeta de primer nivel.
- `App.jsx` — carga `useFolderShares` y el punto de entrada de
  `PendingInvitesBanner`.

**Limitación a anotar:** mostrar el email de quien comparte, sin tabla nueva
ni acceso a `auth.users`: `folder_shares.shr_invited_email` (tal cual lo
escribió el dueño) es suficiente para pintar "compartido con ana@…", porque
ese email ya es conocido por ambas partes por el propio acto de compartir.
Para "quién añadió este item" basta distinguir `itm_usr_id = auth.uid()`
("tú") de cualquier otro valor (el email guardado en `shr_invited_email` de
la carpeta), sin necesitar el email real de cada `itm_usr_id` en general.

---

## H) Migración de datos existente (no destructiva)

Las carpetas de hoy no tienen padre ni comparten nada, así que encajan sin
cambios como carpetas de primer nivel: `fld_parent_id` nace `NULL` por
defecto, así que todas las filas existentes quedan automáticamente como
primer nivel — no hace falta backfill. `folder_shares` nace vacía: nadie
comparte nada hasta que alguien invite explícitamente, así que la migración
no cambia el comportamiento visible de ningún usuario existente.

Orden de la migración:
1. `alter table folders add column fld_parent_id ...` + índice + trigger de
   "máximo dos niveles".
2. Crear `folder_shares` + su RLS + índices.
3. Crear `vigia.visible_folder_ids()`.
4. Sustituir las políticas `_own` de `folders`/`items`/`price_history` por las
   combinadas (`drop`+`create` en la misma migración, para no dejar una
   ventana sin política — Postgres deniega todo si no hay ninguna aplicable).
5. Trigger `AFTER INSERT on auth.users` para resolver invitaciones pendientes.
6. RPCs `accept_folder_share` / revocación.
7. Edge Function `invite-to-folder` (se despliega aparte, como `scrape`/`refresh`).

---

## Qué NO incluye esta primera versión

- Rol de "solo lectura" u otro permiso granular distinto de "igual que el
  dueño".
- Compartir una subcarpeta individual o un item suelto sin carpeta.
- Más de una persona compartiendo la misma carpeta simultáneamente — el
  esquema lo permite, pero la UI y las pruebas de esta versión se piensan
  para el caso dueño + un invitado (pareja). Ampliarlo es aditivo.
- Notificación por email al invitar — de entrada solo un badge en la app al
  iniciar sesión, coherente con que Vigía no tiene SMTP propio resuelto
  (backlog B7).
- Un tercer nivel de carpetas o jerarquías arbitrarias.
- Transferir la propiedad de una carpeta compartida.
- Auditoría/histórico de quién borró qué en una carpeta compartida.
- Que el refresco automático (`pg_cron`) de un usuario también refresque
  items ajenos de una carpeta compartida — de entrada sigue operando por
  `user_settings` del dueño real de cada item; como la RLS ya cubre la
  visibilidad, ambos ven los precios actualizados en cuanto cualquiera de
  los dos refresca (manual o automático), así que no es estrictamente
  necesario tocar nada aquí para que funcione razonablemente bien.

---

## Alternativas descartadas (una línea cada una)

- Jerarquía en tabla separada `subfolders` — duplica RLS/CRUD/UI sin necesidad.
- Materialized path / ltree — sobra para exactamente dos niveles fijos.
- Tabla `vigia.user_directory` para resolver email→user_id — oráculo de
  enumeración de cuentas, incluso con RLS.
- Resolver el email en el cliente contra `auth.admin` — expondría la
  `service_role key` en el navegador.
- Rol "solo lectura" para el invitado — no pedido en esta versión; columna
  `shr_role` aditiva si se pide después.
- `itm_usr_id` reescrito al dueño de la carpeta al compartir — pierde
  trazabilidad y complica la revocación.
- Compartir a nivel de subcarpeta o item suelto — fuera del alcance acordado.
- Notificación por email al invitar — Vigía no tiene SMTP propio (B7); se
  sustituye por un badge en la app.
- Borrar los items del invitado al revocar — se prefiere moverlos a "Sin
  carpeta" del propio invitado, nunca borrar datos sin pedirlo explícitamente.
