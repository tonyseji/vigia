# Log de progreso — Vigía

> Solo el log de sesiones. Para qué hay pendiente y qué viene: `docs/ROADMAP.md`.
> Cuando este archivo pase de ~100 KB, mover lo antiguo a `PROGRESO-ARCHIVO.md`.

---

## 2026-09-03 (Sesión 1) — Revisión de Bilans y esqueleto del repositorio

### Contexto

El proyecto existía como una app funcionando entera dentro de una Edge Function
de Supabase: sin repositorio, sin historial, con el HTML de la interfaz guardado
en una fila de la tabla `settings` y la clave de acceso escrita en el código. La
sesión anterior cerró el plan de reestructuración y el nombre (Vigía). Esta
sesión ejecuta la fase 0 (revisar la organización de Bilans para reaprovechar lo
aprendido) y la fase 1 (repositorio y esqueleto).

### Revisión de Bilans — qué se adopta y qué no

Se leyeron `CLAUDE.md`, `docs/workflow.md`, `decisions.md`, `progress.md`,
`roadmap.md`, `db-schema.md`, `.gitignore`, `vercel.json` y `app/package.json`.

**Adoptado:** el formato de `decisions.md` (decisión · por qué · descartado ·
revisitar), que es lo más valioso del proyecto y lo que evita rehacer
discusiones; la regla anti-deriva del `CLAUDE.md` (historial solo en el log,
aquí solo el estado), que en Bilans nació después de que el archivo creciera de
180 a 890 líneas; la convención de nombres de BD con prefijo por tabla; las
reglas de seguridad de RLS y `SECURITY DEFINER` de la sección «Reglas que NO
romper», todas aprendidas rompiéndolas; las cabeceras de seguridad de
`vercel.json`; Vitest solo para funciones puras; la restricción de no añadir
dependencias.

**No adoptado, y por qué:** la subcarpeta `app/` (Bilans arrastra
`cd app && npm install` en el `buildCommand` sin que un segundo paquete lo
justifique); el flujo de dos ramas `preproduccion` → `main` (Bilans lo necesita
porque tiene usuarios reales; aquí la preview del PR da lo mismo sin ramas que
mantener); los veinte documentos de `docs/` (buena parte son de lanzamiento y
negocio, específicos de Bilans); el `img-src` cerrado de su CSP, que aquí se
rompería en cuanto se añadiera una tienda nueva.

**Dos avisos que se llevan escritos:** el `progress.md` de Bilans va por 426 KB
en un solo archivo, así que aquí la regla de rotación existe desde el día uno; y
Bilans tiene tablas en producción que no están en ninguna migración, así que
aquí nada se aplica en Supabase sin archivo previo.

### Decisiones cerradas

React (alineación con Bilans), Tailwind v4 desde el primer componente (para no
repetir su migración big-bang), JavaScript en el frontend y TypeScript solo en
la Edge Function, enlace mágico por email como acceso, una sola rama `main`.
Las seis quedan razonadas en `docs/DECISIONES.md`.

### Cambios

Primer commit con el estado heredado tal cual (la Edge Function `muebles`,
`extract.ts`, `ui.html` y su README), para que quede constancia del punto de
partida. Encima, el esqueleto: `package.json`, `vite.config.js`, `index.html`,
`src/` (`main.jsx`, `App.jsx`, `lib/supabase.js`, `lib/format.js`,
`styles/tailwind.css` con los tokens del diseño aprobado en `@theme`),
`vercel.json` con cabeceras de seguridad y CSP, `.github/workflows/ci.yml`
(test + build en cada push y PR), `.gitignore` endurecido por ser repositorio
público, `.env.example`, y los cinco documentos de `docs/` más `CLAUDE.md`.

### Ajustes tras revisar el resultado (misma sesión)

Cuatro correcciones pedidas por Tony al leer lo montado:

1. **`.gitignore` para un repositorio público.** Se amplió a credenciales y
   certificados, volcados de base de datos, carpetas de plataforma (`.vercel/`,
   `.supabase/`), configuración de editores y herramientas de IA, y dos sitios
   explícitos para lo que no debe publicarse: `privado/` y cualquier
   `*.private.md`. Además se añadió `.githooks/pre-commit`, que corta el commit
   si detecta un JWT, una clave privada, un token de GitHub o un `.env` forzado
   con `-f`. Probado con los tres casos: los bloquea y deja pasar el resto.
2. **El cron cada 15 minutos se retira.** El botón «Actualizar precios» pasa a
   ser el camino principal y el automático baja a un pase al día, con la
   frecuencia como preferencia del usuario (`off`/`daily`/`12h`/`6h`) para poder
   subirla en la semana del Black Friday y bajarla después. Nueva tabla
   `user_settings`. Razonado en `DECISIONES.md`.
3. **Las tiendas bloqueadas dejan de fallar en silencio.** Al pegar la URL se
   mira el dominio contra `store_rules` antes de intentar nada; si bloquea, se
   avisa con palabras llanas y se ofrece guardar el artículo en modo manual,
   conservando lista e histórico. Flujo completo en `ARQUITECTURA.md`.
4. **El reparto de trabajo queda escrito** en `docs/WORKFLOW.md`: Cowork
   planifica, decide y documenta; Claude Code implementa. Copiado del
   `workflow.md` de Bilans, que es el documento suyo que mejor ha aguantado.

El diseño aprobado se mantiene como base; los retoques llegarán al usarlo.

### El nombre, reabierto y confirmado

Tony reabrió la duda justo antes de crear el repositorio, al escribir «Vigía» en
GitHub: el nombre habla del vigilante y no de la lista, y lo que él quiere es un
sitio ordenado donde recordar lo que le interesa, con el precio como criterio
para decidir cuándo —o si— compra. Se buscaron alternativas de verdad y se
comprobaron contra lo existente: `mirador`, `atalaya`, `kairos`, `otero`,
`miru`, `begira`, `utsikt`, `terna`, `antesala`, `tanteo`. Se mantiene Vigía; el
razonamiento y el motivo de descarte de cada candidato quedan en `DECISIONES.md`
para no repetir la conversación. Hallazgo útil de la búsqueda: el espacio en
español está vacío — todo lo que existe se llama *Price Tracker*, *Rastreador de
precios*, *Reprice*, *Keepa* o *Listonic*.

### Estado final

Esqueleto verificado: `npm install`, `npm test` (8 tests) y `npm run build` en
verde. Seis documentos en `docs/`, guardia anti-secretos activa. Sin
funcionalidad todavía — la app vieja sigue siendo la que se usa y no se toca
hasta la fase 6. Pendiente de que el repositorio se suba a GitHub
(`tonyseji/vigia`, público) para arrancar la fase 2.

---

## 2026-09-05 (Sesión 2) — Fase 2: base de datos y acceso

### Contexto

Tocaba la fase 2 del `ROADMAP.md`: migraciones versionadas, RLS y enlace
mágico. Antes de tocar nada se auditó el proyecto de Supabase directamente
(`list_tables`, `list_extensions`, `list_migrations`, consultas SQL) en vez de
asumir lo que decía la documentación.

**Hallazgo que corrigió una asunción de `CLAUDE.md`/`ARQUITECTURA.md`:** la
"app vieja que sigue viva y en uso" no contenía ningún dato — `items`,
`price_history` y `auth.users` estaban en 0 filas, y `public` no tenía ni una
política RLS (la app entra con `service_role`, que salta RLS). Lo único vivo
de verdad era un job de `pg_cron` cada 15 minutos golpeando tiendas reales sin
guardar nada, exactamente el ruido que `DECISIONES.md` argumenta que hay que
evitar. Esto no cambió la decisión del schema `vigia` (sigue aislando y
haciendo la retirada un `DROP` acotado), pero sí bajó el riesgo de la
transición y adelantó una limpieza: parar ese cron ya, no esperar a la fase 6.

Antes de escribir una sola migración se cargaron las skills `supabase`,
`secure-code-guardian` y `react-expert`, y se verificó contra la
documentación oficial de Supabase en vivo (no de memoria, porque cambia entre
versiones) el patrón correcto de RLS, el `GRANT` que exige exponer un schema
custom en la Data API, y el uso actual de `signInWithOtp`.

### Decisiones tomadas con Tony en la sesión

1. El cron de la app vieja se desactiva ya (`cron.alter_job(active := false)`,
   sin borrar el job) en vez de esperar a la fase 6.
2. Alcance de la fase acotado a migraciones + login; extractor y lista quedan
   para las fases 3 y 4.
3. `folders` entra en la migración 001 en vez de esperar a la fase 4 (cierra
   el backlog B1 de `ROADMAP.md`): la tabla es pequeña y `items.itm_fld_id`
   ya la referencia en el esquema propuesto.
4. Exponer `vigia` en la Data API se resolvió por SQL
   (`alter role authenticator set pgrst.db_schemas = '...'`) en vez del
   toggle del dashboard, porque no había acceso a mano al dashboard en el
   momento. Aviso asumido de la documentación de Supabase: a partir de ahora
   ese ajuste ya no lo gestiona el dashboard — cualquier cambio futuro a los
   schemas expuestos va también por SQL con el mismo patrón.

### Cambios

**Base de datos** (proyecto `ovmnzlbcmuppqctkyngi`, aplicado con el MCP de
Supabase y versionado en `supabase/migrations/`):

- `001_schema_inicial.sql` — schema `vigia` con las cinco tablas de
  `ARQUITECTURA.md` (`folders`, `items`, `price_history`, `user_settings`,
  `store_rules`), índices, RLS activado y una política `_own` por tabla con
  dueño (`TO authenticated`, `USING`/`WITH CHECK` sobre
  `(select auth.uid())`); `price_history` hereda el dueño de su `items` vía
  `EXISTS` porque no tiene columna propia de usuario; `store_rules` lleva
  política de solo lectura para `authenticated` y escritura reservada a
  `service_role`. Incluye también el índice que faltaba en
  `folders_fld_usr_id_fkey`, añadido tras revisar `get_advisors` una vez
  aplicada la migración.
- `002_store_rules_semilla.sql` — las siete filas de `docs/TIENDAS.md`
  (IKEA, Sklum, Leroy Merlin, Amazon.es vía `pg_net`, Kave Home y Maisons du
  Monde bloqueadas).
- `003_exponer_schema_vigia.sql` — los `GRANT`/`ALTER DEFAULT PRIVILEGES`
  que exige la Data API para alcanzar un schema custom, sin dar de más a
  `anon` (aquí no hay usuarios anónimos).
- Migraciones aplicadas directamente por sesión y no guardadas como archivo
  (son operativas, no de esquema): `cron.alter_job` para desactivar el cron
  de la app vieja, y el `alter role authenticator set pgrst.db_schemas`
  para exponer `vigia` en la Data API.
- Se intentó mover `pg_net` de `public` a `extensions` (lo marca
  `get_advisors` como WARN) con `ALTER EXTENSION ... SET SCHEMA`; Postgres lo
  rechazó porque `pg_net` no es relocatable. Moverlo de verdad exige
  `DROP EXTENSION CASCADE` + recrear, lo que borraría su historial de
  peticiones y podría romper lo que la Edge Function `muebles` ya usa de él
  para Amazon. Se descartó por ser una acción destructiva fuera del alcance
  mínimo de esta fase; queda anotado como pendiente, no como olvido.

**Frontend:**

- `src/lib/supabase.js` — el cliente ahora fija `db: { schema: 'vigia' }`.
- `.env.example` — la clave de ejemplo pasa a la publishable key moderna
  (`sb_publishable_...`), no el `anon` JWT legado.
- `src/hooks/useAuth.js` (nuevo) — `getSession` + `onAuthStateChange` con
  `unsubscribe` en el cleanup, `signInWithEmail` (`signInWithOtp`) y
  `signOut`.
- `src/components/Login.jsx` (nuevo) — formulario de email con los tres
  estados de `DISENO.md` (enviando, enviado, error en palabras llanas), solo
  tokens de `@theme`.
- `src/App.jsx` — sin sesión muestra `Login`; con sesión, cabecera con el
  email y botón de salir. La lista de artículos sigue sin construir: es la
  fase 4.
- `.claude/launch.json` (nuevo) — configuración para previsualizar
  `npm run dev` desde el navegador integrado.

### Verificación

`npm install`, `npm test` (8 tests, sin cambios) y `npm run build` en verde.
`get_advisors` (security y performance) sobre el proyecto: cero avisos nuevos
en `vigia` — los únicos avisos restantes son los preexistentes de `public`
(app vieja) y el de `pg_net`, ya explicado arriba. Verificado con el navegador
contra el servidor de desarrollo real: sin sesión, `anon` recibe `42501`
(permiso denegado) al intentar leer `vigia.store_rules` — correcto, porque
solo se concedió a `authenticated`. Se pidió el enlace mágico al email de Tony
desde el formulario real y la interfaz mostró el estado "revisa tu correo"
correctamente. **Queda pendiente que Tony abra el enlace recibido** y
confirme que la sesión vuelve con su email en la cabecera — es el único paso
que no se puede hacer desde aquí.

### Estado final

Fase 2 cerrada en código y en base de datos. `vigia` existe con RLS real,
grants correctos y semilla de `store_rules`; el cron viejo está desactivado;
el login por enlace mágico funciona de punta a punta salvo la confirmación
final de Tony al abrir su correo. Nada se ha subido a GitHub (sigue pospuesto
al final de la fase 4, según `ROADMAP.md`). Siguiente: fase 3, traer
`extract.ts` al repositorio con sus tests.

---

## 2026-09-05 (Sesión 3) — Fases 3 y 4 completas, fase 5 parcial: primera prueba real de punta a punta

### Contexto

Con el login confirmado en la sesión 2, Tony pidió cerrar en la misma sesión
todo lo necesario para probar la app funcionando de verdad hoy: extractor,
interfaz real sobre el diseño aprobado, y el botón de refresco manual. Se
acordaron tres decisiones de alcance antes de tocar código (ver
`docs/DECISIONES.md`): la función `scrape` valida el JWT a mano
(`--no-verify-jwt` + `getUser` en el handler, como fija `CLAUDE.md`), todo se
prueba en local contra el Supabase real (nada de Vercel todavía), y el
`pg_cron` de refresco automático diario queda fuera — solo el botón manual.

### Cambios

**Fase 3 — extractor** (`supabase/functions/scrape/`):
`extract.ts` es copia literal del extractor heredado (primer commit,
`supabase/functions/muebles/extract.ts`), sin cambios de lógica. `index.ts` es
nuevo: un único `POST` que valida el JWT a mano, consulta `store_rules` por
dominio antes de intentar nada, y llama a `extractFromUrl`. No escribe en
`items`/`price_history` — eso lo hace el frontend con su propio cliente de
sesión, para que RLS decida. `extract.test.ts` (nuevo, 16 tests) cubre
`parsePrice`, `extractFromHtml` e `isBotPage` con **Vitest, no `Deno.test`**:
este entorno no tiene el CLI de Deno instalado y el módulo no usa ninguna API
específica de Deno, así que se testea con el runner ya existente sin añadir
un requisito de sistema nuevo. No se portó el camino `pg_net`/Amazon (las RPCs
`fetch_enqueue`/`fetch_result` viven solo en la BD heredada, no en el repo) —
queda anotado en `DECISIONES.md` para retomar si hace falta.

**Fase 4 — frontend real:**
`src/hooks/useItems.js` (nuevo) — carga de items con histórico, `addItem`
(consulta `store_rules`, invoca `scrape`, inserta en `items`/`price_history`),
`addManualItem` (para tiendas bloqueadas), `refreshAll` (de tres en tres).
`src/hooks/useFolders.js` (nuevo) — lectura de carpetas para agrupar.
`src/components/icons/index.jsx`, `Sparkline.jsx` (port directo de la función
`spark()` del prototipo, adaptada a los tokens reales `--color-ok`/
`--color-bad`, no `--down`/`--up` como en la referencia), `ItemRow.jsx`,
`AddItemForm.jsx`, `ItemList.jsx` (nuevos). `src/App.jsx` sustituye el
placeholder por el panel real: formulario, lista agrupada por carpeta, y el
botón «Actualizar».

**Fase 5 (parcial):** `refreshAll` en `useItems.js` cubre el botón manual.
`pg_cron` queda fuera, como se acordó.

### Bug encontrado y corregido en la propia sesión

La primera prueba real de "añadir artículo" falló con un aviso genérico. Los
`function_edge_logs` de Supabase mostraron la causa exacta:
`OPTIONS | 405 | .../functions/v1/scrape`. El navegador manda un preflight
CORS antes del `POST` real porque la llamada lleva `Authorization` y
`Content-Type`, y el `index.ts` original no respondía `OPTIONS` — lo trataba
como método no soportado y devolvía 405, así que el `POST` real nunca llegaba
a salir. Corregido añadiendo cabeceras CORS y un `return` explícito para
`OPTIONS` antes de cualquier otra comprobación; redesplegado como versión 2 de
la función. Confirmado con una segunda prueba real que ya funcionó.

### Hallazgo operativo: el SMTP de pruebas de Supabase no aguanta un ciclo de desarrollo

Pedir el enlace mágico varias veces seguidas (para probar login y luego para
probar "añadir artículo" en una sesión nueva) chocó repetidamente con
`429 over_email_send_rate_limit`. La causa, confirmada contra la documentación
oficial de Supabase: el SMTP integrado gratuito está pensado solo para probar
plantillas de correo, no para desarrollo con envíos repetidos, y su límite de
mensajes/hora es bajo y puede cambiar sin aviso. **Queda pendiente decidir con
Tony si configurar SMTP propio** (Resend u otro proveedor con plan gratuito)
antes de la próxima sesión de pruebas intensivas, para no volver a bloquearse
por esto. Anotado como próximo paso, no resuelto en esta sesión.

Un intento de una función auxiliar para generar enlaces sin pasar por el
correo (usando `service_role` + `auth.admin.generateLink`) fue bloqueado por
el sistema de permisos por tocar autenticación de forma sensible — decisión
correcta, no se buscó ningún rodeo. La verificación final se completó con
Tony abriendo él mismo, en su propio navegador, el enlace que sí llegó por
correo (el aviso de "no me llegó el enlace" resultó ser que el correo llegó
sin verse como botón clicable, pero la URL completa sí estaba en el texto).

### Verificación

`npm test`: 24 tests en verde (8 de `format.js` + 16 nuevos de `extract.ts`).
`npm run build` en verde. Prueba real de punta a punta, confirmada por Tony en
su navegador con sesión propia:

- **Sklum** (mesa de comedor, 144,95 €) — automático, JSON-LD.
- **IKEA** (mesa SKANSNÄS, 599 €) — automático, JSON-LD.
- **Kave Home** (mesa Erisia) — detectada como bloqueada, aviso mostrado,
  guardada en modo manual (`itm_is_manual = true`) con precio 999 € tecleado
  por Tony.
- Botón «Actualizar»: releyó Sklum e IKEA, precios sin cambios (0%), pero al
  quedar 2 registros en el histórico de cada uno el minigráfico apareció
  correctamente — confirma la regla de `DISENO.md` de mostrarlo solo con ≥2
  registros.

### Editar y borrar artículos (añadido al final de la sesión)

Tony probó la lista ya con datos reales y notó que estaba "super
restringida": solo se podía ver y añadir, no editar ni borrar. No estaba en
el plan original del día (centrado en "añadir y ver funcionando"), pero es
imprescindible para usar la app de verdad, así que se cerró en la misma
sesión:

- `src/hooks/useItems.js` — dos funciones nuevas. `updateItem(itemId,
  changes)` actualiza título/notas/carpeta y, si se pasa un precio nuevo,
  añade también una fila a `price_history` con `ph_source = 'manual'` (mismo
  criterio que al guardar un artículo bloqueado). `deleteItem(itemId)` borra
  el item; `price_history` se va detrás por el `ON DELETE CASCADE` de la
  migración 001, así que no hace falta borrarlo aparte.
- `src/components/EditItemModal.jsx` (nuevo) — modal simple (`<dialog>`
  nativo, sin librería) con título, precio manual y notas, más un botón
  «Eliminar» con confirmación (`confirm()` nativo, coherente con lo mínimo
  que pedía el momento).
- `src/components/ItemRow.jsx` — añadido un botón de editar (icono de lápiz
  SVG a mano, mismo criterio que el resto de iconos) que abre el modal; la
  píldora "Sin precio · edítalo" ahora también es clicable y abre el mismo
  modal, en vez de ser solo texto.
- `ItemList.jsx` y `App.jsx` — pasan `onUpdate`/`onDelete` hacia abajo desde
  el hook hasta la fila.

Verificado por Tony en su propio navegador tras el cambio: funciona.

### Verificación

`npm test`: 24 tests en verde (8 de `format.js` + 16 de `extract.ts`, sin
cambios por esta última parte — no se tocó lógica pura testeable, solo
componentes y el hook de items). `npm run build` en verde después de añadir
editar/borrar.

### Estado final

Fases 3 y 4 cerradas (incluida edición y borrado, añadidos sobre la marcha);
fase 5 parcial (botón manual) cerrada, `pg_cron` pendiente. La app tiene
artículos reales guardados hoy, con el ciclo completo verificado en el
navegador de Tony contra el proyecto real de Supabase: login → añadir
(automático y manual) → ver en lista con minigráfico → editar → borrar →
refrescar. Nada subido a GitHub. Pendientes explícitos para la próxima
sesión: SMTP propio (evitar el límite de email visto hoy), `pg_cron` de
refresco diario, y el camino `pg_net` para Amazon si se retoma.

---

## 2026-09-06 (Sesión 4) — Fase 5 completa: refresco automático, push, carpetas, copiar

### Contexto

Tony trajo seis ideas para valorar: refresco diario automático, aviso de
cambio de precio, carpetas gestionables, investigar tiendas bloqueadas, un
buscador de similares por imagen/URL, e integrar un mueble guardado en la foto
de un salón. Tras brainstorming se acotó el alcance: las cuatro primeras se
construyen (cierran la fase 5 y los backlogs B3/B4/B8/B9); las dos últimas no
se construyen en la app (rompen el alcance de `DECISIONES.md` o no tienen vía
a coste 0 €) y se resuelven a mano con un botón «Copiar para Claude», más un
estudio de viabilidad documentado.

Dos decisiones de diseño no obvias se resolvieron con Tony antes de
implementar: el disparador del refresco automático (`pg_cron`+`pg_net` dentro
de Supabase, no un cron de Vercel, para no perder las frecuencias 12h/6h de
`user_settings`) y dónde vive el mínimo histórico (materializado en `items`
con trigger, no en consulta).

### Hallazgo de seguridad

Al revisar `cron.job` antes de escribir el disparador nuevo, el job heredado
`muebles-refresh-precios` (inactivo desde la sesión 2) resultó llevar su clave
compartida en texto plano dentro de `cron.job.command`
(`"x-key":"okeaq2s5"`). Es la prueba concreta, no teórica, de por qué el
secreto nuevo (`vigia_cron_secret`) va en Supabase Vault y nunca en el
comando de un job.

### Cambios

**Base de datos** (migraciones 004-008, todas con RLS/GRANT/`SECURITY
DEFINER` según `CLAUDE.md`, aplicadas al proyecto real vía MCP):
- `004_min_max_materializado.sql` — `itm_min_price`/`itm_max_price` +
  trigger `AFTER INSERT` sobre `price_history` + backfill.
- `005_ajustes_aviso.sql` — umbral configurable en `user_settings`
  (`us_notify_*`) e idempotencia del aviso en `items` (`itm_notified_price`).
- `006_push_subscriptions.sql` — tabla `push_subscriptions`, portada de
  Bilans con las correcciones que `CLAUDE.md` exige (`(select auth.uid())`,
  GRANTs explícitos).
- `007_cron_refresco.sql` — `vigia.run_scheduled_refresh()` + job
  `vigia-refresco-horario` (`pg_cron`, cada hora) + secreto en Vault.
- `008_fetch_via_pg_net.sql` — `fetch_enqueue`/`fetch_result` recreadas en
  `vigia` (las de la app vieja no se portaron, vivían solo en la BD
  heredada), concedidas solo a `service_role` para evitar SSRF.

**Edge Functions:**
- `refresh` (nueva) — refresco del lado servidor, un solo código para el
  botón manual y el pase de `pg_cron` (la autenticación decide sobre qué
  artículos se opera). Resuelve el límite de 5 min con tope de artículos +
  presupuesto de tiempo, y por fin escribe `itm_last_error` en el fallo (antes
  nunca se escribía). Detecta bajadas y manda un push resumen por usuario.
  `push.ts` con la criptografía VAPID/RFC 8291 portada de
  `Bilans/push-daily-reminder`.
- `push-subscribe` (nueva) — persiste suscripciones, portada de Bilans
  recortada (sin preferencias, que viven en `user_settings`).
- `scrape` — se conecta `setAltFetcher` a las RPCs de `pg_net` (backlog B9).

**Frontend:**
- `useItems.js`: `refreshAll` pasa de ~30 líneas a invocar `refresh` y
  recargar — la lógica de refresco ya no vive en el navegador.
- `useFolders.js`: deja de ser solo lectura (`createFolder`/`renameFolder`/
  `deleteFolder`).
- Nuevos: `useSettings.js`, `usePushNotifications.js`, `SettingsModal.jsx`,
  `FolderManager.jsx`, `InstallBanner.jsx` (PWA, portado de Bilans con los 4
  modos iOS/Android), `src/lib/push.js`, `src/lib/clipboard.js`.
- `EditItemModal.jsx` gana el selector de carpeta. `ItemRow.jsx`/
  `ItemList.jsx` ganan el botón «Copiar para Claude» (artículo y carpeta).
- PWA: `public/sw.js`, `public/manifest.json`, iconos generados a mano sin
  ninguna dependencia nueva (script Node con solo `zlib`, coherente con la
  regla de "SVG a mano" del proyecto). `vercel.json` con las cabeceras del
  Service Worker y `worker-src` en la CSP existente (sin tocar `img-src
  https:`).

**Documentación:** 7 decisiones nuevas en `DECISIONES.md` (disparador
pg_cron+Vault, min/max materializado, idempotencia del aviso, umbral
configurable, push VAPID, alcance de las ideas 5/6, y dos detalles técnicos
menores). `docs/ESTUDIO-IMAGEN.md` nuevo con el estudio de viabilidad de
búsqueda visual e integración de imagen (APIs concretas, precio real,
por qué la idea 5 rompe el alcance y la 6 no).

### Verificación

`npm test`: 24 tests en verde (sin cambios de lógica pura). `npm run build`
en verde; `dist/sw.js`, `dist/manifest.json` y los iconos se copian
correctamente. `get_advisors` sin avisos nuevos en `vigia` tras las cinco
migraciones. Cadena de extremo a extremo confirmada contra el proyecto real:
`select vigia.run_scheduled_refresh()` disparó la petición HTTP
(`net._http_response` registra un 401 real de la función `refresh`, prueba de
que `pg_cron` → `pg_net` → Edge Function funciona) — el 401 es el esperado
porque el secret `CRON_SECRET` todavía no está configurado en Supabase
Secrets, que es un paso manual desde el Dashboard que esta sesión no puede
hacer por sí misma.

### Estado final

Fase 5 completa (backlogs B3, B4, B8 y B9 cerrados). **Pendiente manual antes
de que el refresco automático y el push funcionen de verdad:** configurar en
Supabase Dashboard → Edge Functions → Secrets las variables `VAPID_PRIVATE_KEY`,
`VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` y `CRON_SECRET` (los valores generados
esta sesión están en la conversación, no en el repositorio). El
`vigia_cron_secret` ya está guardado en Vault. Nada subido a GitHub. Siguiente
sesión natural: fase 6 (Vercel + retirada de la app vieja), o SMTP propio
(B7) si hace falta seguir probando login antes.

---

## 2026-09-06 (Sesión 5) — Carpetas compartidas: jerarquía de dos niveles + invitaciones

### Contexto

Tras cerrar la fase 5, Tony planteó un caso de uso real: quiere que su pareja
tenga su propia cuenta de Vigía, que cada uno tenga carpetas privadas
(electrónica con subcarpetas de micrófonos/teclados/cascos para él) y que
otras se compartan entre los dos con los mismos permisos (muebles con
subcarpetas de baño/salón, viéndolo y editándolo ambos). Se hizo primero un
brainstorming completo (preguntas sobre estructura, permisos y alta del
segundo usuario) y un documento de diseño detallado
(`docs/superpowers/specs/2026-09-06-carpetas-compartidas-design.md`) antes de
tocar código, dado que es un cambio de modelo de datos con implicaciones de
seguridad reales (sobre todo, cómo resolver un email a una cuenta sin
convertirlo en un oráculo de enumeración de usuarios).

### Cambios

**Base de datos** (migraciones 009-013, aplicadas al proyecto real vía MCP):
- `009_jerarquia_carpetas.sql` — `fld_parent_id` autoreferenciado en
  `folders`, con trigger que impide un tercer nivel.
- `010_folder_shares.sql` — tabla `folder_shares` (invitación con
  `pending`/`accepted`/`revoked`), trigger que exige que solo se compartan
  carpetas de primer nivel.
- `011_rls_compartidas.sql` — función `vigia.visible_folder_ids()` y RLS
  combinada (dueño o carpeta compartida aceptada) en `folders`/`items`/
  `price_history`; trigger sobre `auth.users` que resuelve invitaciones
  pendientes cuando el email invitado se registra; RPCs
  `accept_folder_share`/`reject_folder_share`/`revoke_folder_share` (esta
  última desengancha a "Sin carpeta" los items que el invitado había
  añadido, sin tocar los del dueño).
- `012_consolidar_policies.sql` — el advisor de rendimiento marcó
  `multiple_permissive_policies` tras la 011; se consolidaron en una sola
  política por acción sin cambiar el comportamiento.
- `013_share_folder_name.sql` — ajuste encontrado al construir la UI:
  `shr_fld_name` denormalizado, porque el invitado no puede leer `folders`
  de una invitación todavía pendiente y sin esto no había forma de
  mostrarle qué carpeta le compartían antes de aceptar.

**Edge Function nueva:** `invite-to-folder` — valida dueño + primer nivel,
resuelve el email a `user_id` con `service_role` sin exponer al cliente si la
cuenta existe o no (evita fuerza bruta de enumeración de cuentas), escribe/
reactiva la fila en `folder_shares`.

**Frontend:**
- `useFolders.js` gana `foldersTree` (árbol de dos niveles con `isOwner` por
  carpeta) y `createFolder` acepta `parentId`.
- `useFolderShares.js` (nuevo) — invitar, aceptar, rechazar, revocar.
- `FolderManager.jsx` — árbol carpeta→subcarpeta, botón «Compartir» y «+
  Subcarpeta» solo en las de primer nivel de las que se es dueño.
- `ShareFolderModal.jsx` y `PendingInvitesBanner.jsx` (nuevos).
- `EditItemModal.jsx` — el selector de carpeta indenta visualmente las
  subcarpetas. `ItemList.jsx` — el nombre de grupo muestra la jerarquía
  ("Muebles / Salón").

**Documentación:** una decisión nueva en `DECISIONES.md` (con el ajuste de
`shr_fld_name` y la consolidación de políticas documentados); sección nueva
en `ARQUITECTURA.md` para `folders`/`folder_shares`; `ROADMAP.md` actualizado
(ya no está en "no se construye ahora").

### Verificación

`npm test`: 24 tests en verde (sin cambios de lógica pura). `npm run build`
en verde. `get_advisors` sin avisos nuevos tras las cinco migraciones (los
`multiple_permissive_policies` que apareció a mitad de camino se resolvió en
la propia sesión, no quedó pendiente). Verificado contra el proyecto real:
el trigger de máximo dos niveles rechaza un tercer nivel con el mensaje
esperado; la foreign key de `folder_shares` a `auth.users` rechaza
correctamente un `user_id` inventado (protección real, no solo de diseño);
se crearon y borraron carpetas/invitaciones de prueba con el usuario real de
Tony sin dejar datos residuales.

**Limitación de esta verificación, explícita:** no se pudo probar la RLS
combinada de extremo a extremo con dos cuentas reales aceptando una
invitación, porque solo existe un usuario real en el proyecto hoy y crear una
segunda cuenta de prueba directamente en `auth.users` es una acción de
autenticación sensible que requiere permiso explícito y no se hizo sin
pedirlo. La lógica se verificó por partes (sintaxis de la función aplicada
sin error, trigger de resolución de email probado con una consulta
equivalente, constraints de integridad confirmadas), pero el flujo humano
completo (Tony invita a su pareja, ella se registra con enlace mágico, acepta
y ve la carpeta) queda por confirmar en cuanto haya un segundo usuario real.

### Estado final

Carpetas compartidas con jerarquía de dos niveles implementadas y
desplegadas al proyecto real. Pendiente de verificación humana: que Tony
invite a su pareja de verdad y confirme que ella ve y puede editar la
carpeta compartida tras aceptar. Nada subido a GitHub.

---

## 2026-09-07 (Sesión 7) — Sidebar de carpetas, comparador de conjuntos y arreglos de UI

### Contexto

Tras cerrar carpetas compartidas la sesión anterior, Tony probó la interfaz
real y encontró que el `FolderManagerModal.jsx` (modal con lista de carpetas
y acciones diminutas) no funcionaba bien: botones pequeños e incómodos para
subcarpeta/borrar, y mezclaba gestión de carpetas con navegación. Pidió
mirar aplicaciones similares (Notion, Linear, Gmail) y rehacer la navegación
como un sidebar visual. A partir de ahí, con la app ya usable de verdad,
fueron saliendo varios ajustes de uso real: falta el total al filtrar por
carpeta, el desplegable de carpeta en cada fila era ilegible (`<select>`
nativo en blanco sobre blanco), y una petición nueva — comparar varios
artículos de distintas carpetas por precio total (p.ej. sofá + mesa opción A
contra opción B). Cerrando la sesión, dos bugs visuales encontrados con
captura de pantalla: el desplegable de carpeta se recortaba contra la fila
siguiente, y las miniaturas de artículo se veían como fragmentos
irreconocibles de foto en tiendas que usan fotos de ambiente (Sklum, Kave
Home) — este último resuelto invocando la skill `frontend-design` a
petición explícita de Tony.

### Cambios

**Navegación de carpetas — reemplaza el modal:**
- `FolderSidebar.jsx` (nuevo, sustituye a `FolderManagerModal.jsx`): árbol
  de carpetas con chevron para expandir/colapsar, clic para filtrar,
  contador por carpeta (padre = suma de la suya + subcarpetas), menú «⋮» en
  hover con Renombrar/Nueva subcarpeta/Compartir/Borrar, cierre al hacer clic
  fuera. En escritorio fijo a la izquierda; en móvil, panel deslizante desde
  un botón de menú en la cabecera.
- `App.jsx` — `visibleItems` filtra por `selectedFolderId` incluyendo
  subcarpetas; `ItemList.jsx` gana la prop `groupByFolder` (agrupado cuando
  no hay filtro, lista plana con su propio total cuando sí lo hay — el bug
  del total ausente al filtrar que Tony reportó).

**Selector de carpeta en cada fila — ya no es un `<select>` nativo:**
- `ItemRow.jsx` — desplegable propio con `<button>`s y los tokens del
  proyecto (`bg-surface`, `border-line`, `bg-accent-soft`), cierre al clicar
  fuera. Resuelve el bug de texto en blanco sobre blanco del `<select>`
  nativo (sus `<option>` no se pueden restylear de forma fiable entre
  navegadores).
- Icono del selector cambiado de `IconCarpeta` a un nuevo `IconEtiqueta`
  (etiqueta, no carpeta): aquí es una categoría del artículo, no un
  contenedor — el sidebar conserva `IconCarpeta` porque ahí sí lo es.

**Comparador de conjuntos (nuevo, explícitamente sin persistir):**
- `useComparison.js` (nuevo) — estado en memoria: modo activo, selección
  (`Set` de ids), lista de conjuntos guardados con nombre. Se pierde al
  salir del modo o recargar, por decisión explícita de Tony ("puntual, solo
  mientras lo miro").
- `ComparisonPanel.jsx` (nuevo) — `CompareBar` (barra flotante: contador,
  nombre, guardar/terminar) y `ComparisonSets` (conjuntos guardados lado a
  lado, el más barato resaltado en verde).
- Botón «Comparar» en la cabecera de `App.jsx`; checkbox por fila en
  `ItemRow.jsx` cuando el modo está activo, cruzando carpetas.

**Dos bugs visuales corregidos, cada uno con captura de Tony:**
- Desplegable de carpeta recortado contra la fila siguiente: causado por
  `overflow-hidden` en el `<article>` de `ItemRow.jsx` (puesto ahí para
  recortar la franja de color lateral), que también recortaba el
  desplegable posicionado en absoluto. Se quita del `<article>` y la franja
  lleva su propio `rounded-l-lg`.
- Miniaturas irreconocibles: varias tiendas publican como imagen principal
  una foto de ambiente completa, no un producto recortado — con miniatura
  pequeña y recorte centrado, cae en techo o suelo vacío la mayoría de las
  veces. Se invocó la skill `frontend-design` a petición de Tony; entre tres
  opciones presentadas, eligió «miniatura más grande + mejor encuadre»:
  54→68 px, borde propio (`border-line`), `object-position: 50% 35%` para
  sesgar el recorte al tercio superior-medio, donde suele estar el mueble.
  Documentado explícitamente como mejora estadística, no garantía — con la
  vista "Fotos" en rejilla de `docs/DISENO.md` como alternativa de reserva.

**Documentación:** cinco decisiones nuevas en `DECISIONES.md` (sidebar,
selector de fila + icono, comparador, fix de recorte, fix de miniaturas).

### Verificación

`npm test` (24 tests) y `npm run build` en verde en cada ronda. Todas las
verificaciones visuales se hicieron con un harness de desarrollo temporal en
una pestaña de navegador separada — nunca se tocó ni se recargó el servidor
real de Tony (`vigia-dev`), instrucción explícita suya tras un incidente
anterior en la sesión ("pero no me quites el server que tengo que probar").
Las imágenes de Unsplash usadas al principio para probar el fix de
miniaturas no cargaron por el bloqueo de red externa del sandbox; se generó
en su lugar una imagen PNG sintética localmente (script Node puro con
`zlib`, sin dependencias) simulando una foto de ambiente, y se verificó el
encuadre contra ella.

**Sin confirmar por Tony dentro de esta sesión:** el fix de miniaturas se
implementó y se verificó con la imagen sintética, pero Tony no llegó a
probarlo contra sus datos reales antes de que la sesión se compactara.

### Estado final

Sidebar de carpetas, selector de fila legible, comparador de conjuntos y los
dos fixes visuales, todo implementado y en el árbol de trabajo. **Nada
commiteado ni subido a GitHub** — sigue pendiente de que Tony lo pida
explícitamente (regla de `ROADMAP.md`).

Al arrancar la sesión siguiente, Tony confirmó el resultado de las
miniaturas: **mejor que antes, pero no del todo resuelto** — sigue habiendo
casos donde se ve mal. Queda abierto como se documentó en `DECISIONES.md`
("Revisitar: si Tony sigue viendo miniaturas irreconocibles, considerar la
vista 'Fotos' en rejilla"). No se ha decidido todavía si abordarlo ahora o
seguir con la fase 6.

---

## 2026-09-08 (Sesión 8) — Fase 6: GitHub y Vercel

### Contexto

Tony eligió seguir con "el orden establecido" del `ROADMAP.md`: entre fase 6
(Vercel + retirada de la app vieja) y B7 (SMTP propio), confirmó fase 6.
Arrancarla exigía primero subir el repositorio a GitHub — pospuesto en cada
sesión anterior a la espera de que Tony lo pidiera explícitamente (condición
técnica ya cumplida desde el 2026-09-05) — porque Vercel despliega desde ahí.
Se confirmó con Tony antes de tocar nada, al ser una acción visible en
servicios externos.

### Cambios

**GitHub:** verificado el guardia anti-secretos (`.githooks/pre-commit`
activo, `.gitignore` correcto, sin claves reales filtradas en el árbol) y
`npm test` (24 tests) + `npm run build` en verde antes de commitear. Se
consolidó en un commit todo el trabajo sin commitear de las sesiones 2 a 7
(migraciones, Edge Functions, frontend completo, PWA). Se creó
`tonyseji/vigia` (público) con `gh repo create --source=. --remote=origin` y
se subió el historial completo con `git push -u origin main`.

**Vercel:** CLI instalada y autenticada (login por device code, cuenta
`tonyseji`, un solo equipo `tonysejis-projects`). `vercel link --repo`
encontró un proyecto `vigia` ya existente vinculado a ese repo y lo enlazó
(crea `.vercel/repo.json`, gitignorado). Encontrado y corregido un problema
real: las tres variables de entorno (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`) ya estaban configuradas en
el dashboard pero como tipo **Secret** (legado), que el build no puede leer
— la app en producción cargaba en blanco con "Faltan VITE_SUPABASE_URL o
VITE_SUPABASE_ANON_KEY" en consola pese a que las variables "existían". Se
borraron y recrearon como tipo **Config** (el default moderno) para
Production y Preview, con los mismos valores del `.env` local — las tres son
públicas por diseño (documentado en `.env.example`: la publishable key solo
sirve acompañada de sesión válida por RLS; la VAPID pública es pública por
naturaleza del protocolo Web Push). Confirmado con Tony antes de leer el
`.env` y antes de tocar las variables en el dashboard.

### Verificación

Deployment de producción verificado en el navegador contra el dominio
estable (en ese momento `https://vigia-lyart.vercel.app`): la pantalla de
login ("Vigía", campo de email, botón "Enviarme el enlace") renderiza
correctamente y el bundle servido es el del build con las variables
corregidas. `npm test` y `npm run build` en verde antes de cada commit.

**Sin probar en esta sesión:** el flujo de login de verdad contra el dominio
de Vercel (enlace mágico, `redirectTo` de Supabase Auth apuntando a este
dominio nuevo) — solo se confirmó que la página carga y el cliente de
Supabase se inicializa sin el error de variables ausentes.

### Dominio final: `vigia-list.vercel.app`

Continuación de la misma sesión: Tony pidió que el dominio fuera solo
`vigia.vercel.app`. Comprobado que no es posible — los subdominios
`*.vercel.app` son un namespace global (no por cuenta), y tanto `vigia`
como varias variantes cortas (`vigia-precios`, `vigia-app`, etc.) ya
pertenecen a otros usuarios de Vercel; `vercel domains add` devuelve
`403 forbidden` en esos casos. Se probaron variantes más distintivas para
confirmar el patrón (quedaron temporalmente como alias del proyecto y se
retiraron con `vercel alias rm` en la misma sesión, sin dejar restos). Tony
eligió y añadió él mismo `vigia-list.vercel.app` desde el dashboard; una vez
confirmado que servía el deployment de producción, se retiró también el
alias autogenerado `vigia-lyart.vercel.app` a petición suya, dejando un solo
dominio público más los dos alias técnicos que Vercel gestiona en exclusiva
(el de proyecto y el de rama `git-main`).

**Nota de comando:** `vercel domains ls`/`rm` no gestiona los subdominios
gratuitos `*.vercel.app` (solo dominios comprados/externos) — el comando
correcto para verlos y quitarlos es `vercel alias ls` / `vercel alias rm`.

### Estado final

Repositorio público en `https://github.com/tonyseji/vigia`, historial
completo subido. Proyecto Vercel `vigia` conectado a esa rama `main` con
deploy automático en cada push; producción sirviendo en
`https://vigia-list.vercel.app`. Pendiente dentro de la fase 6, solo hacible
por Tony desde el Dashboard: añadir ese dominio a Authentication → URL
Configuration → Redirect URLs de Supabase Auth (si no, el enlace mágico
fallará al volver desde ahí) y confirmar los Secrets (`VAPID_*`,
`CRON_SECRET`) arrastrados de la fase 5. También queda decidir cuándo se
apaga la Edge Function `muebles` de la app vieja. `ROADMAP.md` y la línea de
estado de `CLAUDE.md` actualizados.

---

## 2026-09-09 (Sesión 9) — Fase 6 cerrada: Secrets, Redirect URL y login/refresco verificados en producción

### Contexto

Sesión de continuación para probar lo construido hasta ahora y cerrar los
dos pendientes manuales que bloqueaban la fase 6 desde la sesión 8: los
Secrets de Supabase (`VAPID_*`, `CRON_SECRET`) y la Redirect URL de Auth.

### Verificación inicial

`npm run build` y `npm test` (24 tests) en verde. Producción
(`https://vigia-list.vercel.app`) cargaba correctamente la pantalla de
login. Al probar el envío del enlace mágico con el email real de Tony, el
enlace recibido traía `redirect_to=http://localhost:3000` — confirma en
vivo el bloqueante ya anotado: sin la Redirect URL en el Dashboard, Supabase
ignora el `emailRedirectTo` que manda el cliente (`window.location.origin`,
correcto en `useAuth.js`) y cae al Site URL por defecto.

### Secrets: par VAPID nuevo, no el original

El valor VAPID original (generado en la sesión 4) nunca quedó guardado en
ningún sitio persistente — el propio `PROGRESO.md` de esa sesión ya avisaba
"los valores generados esta sesión están en la conversación, no en el
repositorio". Intentar recuperar el valor público ya cargado en Vercel vía
`vercel env pull` fue bloqueado por el clasificador de seguridad de Claude
Code (razonable: volcaría configuración a un archivo). Como ninguna
suscripción push había funcionado nunca de extremo a extremo, se decidió
con Tony generar un par VAPID nuevo con `web-push generate-vapid-keys` y
sustituir el par completo en vez de perseguir el original.

Pasos ejecutados:
- `vercel env rm/add VITE_VAPID_PUBLIC_KEY` en Production y Preview con la
  clave pública nueva.
- Redeploy de producción (`vercel deploy --prod`, bloqueado primero por el
  clasificador y confirmado explícitamente por Tony) para que el build
  recogiera la variable nueva.
- `CRON_SECRET` nuevo generado con `encode(gen_random_bytes(32), 'hex')` vía
  SQL (tal como indica el comentario de la migración 007) y actualizado en
  Vault con `vault.update_secret` (bloqueado primero por el clasificador,
  confirmado por Tony) — Vault no expone el valor en claro para lectura, así
  que no había forma de reutilizar el secreto viejo aunque se hubiera
  querido.
- Tony pegó los 4 valores (`CRON_SECRET`, `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` con su email) en Supabase Dashboard →
  Edge Functions → Secrets, y añadió `https://vigia-list.vercel.app/**` a
  Authentication → URL Configuration → Redirect URLs — las dos pantallas que
  ni el MCP de Supabase ni Claude Code pueden alcanzar directamente.

### Verificación final

Con los Secrets puestos: `us_refresh_hour` de Tony ajustado temporalmente a
la hora actual (confirmado con Tony antes del `UPDATE`, revertido a 21
después) y `select vigia.run_scheduled_refresh()` disparado a mano. La
petición a la Edge Function `refresh` respondió `200` (antes daba `401 No
autorizado`) — confirma que el `CRON_SECRET` de Vault y el de Edge Functions
Secrets ya coinciden.

Con la Redirect URL puesta: nuevo enlace mágico enviado y abierto de
verdad. Esta vez trajo `redirect_to=https://vigia-list.vercel.app/` y el
login completó la sesión contra el dominio de producción real — se ve la
lista de Tony con datos reales (varios artículos con precio, histórico y
miniatura, uno en modo manual por tienda bloqueada, agrupados "Sin
carpeta").

**Hallazgo suelto, no investigado esta sesión:** dos artículos con títulos
que no parecen el nombre real del producto — uno truncado tipo "S₃ Q." de
pccomponentes.com, y otro que muestra la URL cruda como título
(`kavehome…`, es el manual por bloqueo, ahí puede ser esperado). Pendiente
de revisar si es un fallo puntual de esos productos o algo sistemático del
extractor.

### Estado final

**Fase 6 funcionalmente cerrada:** GitHub, Vercel, Secrets, Redirect URL,
login por enlace mágico y refresco automático, los cinco verificados en
producción con datos reales. Sigue pendiente, sin urgencia: decidir cuándo
se retira la Edge Function `muebles` de la app vieja, y los dos hallazgos
sueltos (títulos raros en la lista, backlog B10 de miniaturas). `ROADMAP.md`
y la línea de estado de `CLAUDE.md` actualizados.

---

## 2026-09-09 (Sesión 10) — Investigación de B11 (títulos mal extraídos): sin causa raíz encontrada

### Contexto

Tony pidió seguir con B11, el hallazgo suelto de la sesión 9: un artículo de
pccomponentes.com mostraba en la lista un título truncado/raro ("S₃ Q.") en
vez de su nombre real. Se abordó con la skill `systematic-debugging`: antes
de tocar nada, buscar la causa raíz.

### Investigación

**Base de datos primero, sin asumir que el extractor era el culpable.** El
artículo real (`itm_id 3af59106…`, añadido 2026-09-08) tiene en
`vigia.items.itm_title` el valor correcto y completo: `Samsung QLED AI 43"
TQ43Q8FAAUXXC UltraHD 4K Quantum HDR+ Tizen`. No es "S₃ Q." — el dato
guardado nunca estuvo roto.

Se preguntó a Tony cómo vio exactamente el título raro: confirmó que fue
"cortado/raro en la lista de la app", no al mirar la base de datos. Esto
descarta de entrada que `extract.ts` sea la causa (produce el título
correcto, ya guardado) y apunta a un problema de renderizado, si es que
existe.

Se revisó `extract.ts` completo: el orden de prioridad de título es JSON-LD
`name` → `og:title`/`twitter:title` → fallback específico de Amazon → 
`<title>` de la página. Ninguna rama produce un resultado tipo "S₃ Q." para
este HTML. Se revisó `ItemRow.jsx` (dónde se pinta `item.itm_title`): texto
plano en JSX dentro de un `<a>` con `line-clamp-2`, sin ningún atributo
`title="..."` que pudiera romperse con la comilla doble literal del título
(las 43 pulgadas). Se revisó `useItems.js` y `refresh/index.ts`: ninguno
reescribe `itm_title` después de crear el artículo — se escribe una sola vez
al añadirlo.

**Reproducción del layout real:** se montó una página aislada con el mismo
CSS (`line-clamp-2`, `text-[14.5px]`, mismo ancho de fila en escritorio y en
360px móvil) y el título real de BD, servida desde el propio `vigia-dev`
(instancia de servidor propia de esta sesión, no la de Tony — no se tocó su
servidor). Resultado: trunca de forma normal con "…" en ambos anchos
("Samsung QLED AI 43" TQ43Q8FAAUXXC UltraHD 4K…"), no reproduce "S₃ Q." en
ningún caso.

### Continuación: causa raíz real encontrada con la sesión de Tony en producción

Tony abrió su propio enlace mágico y quedó autenticado en
`vigia-list.vercel.app` dentro del navegador de esta sesión. Con su lista
real visible, el título del Samsung se veía correcto en escritorio
(confirmando lo ya investigado), pero Tony señaló el problema de fondo: la
app no tiene responsive probado, así que en pantallas estrechas el texto
"se pierde entero". Redimensionar esa misma sesión real a 375px (móvil) lo
confirmó de inmediato: **el título desaparecía por completo en las 5 filas
de su lista**, no solo en el artículo original.

Diagnóstico con DevTools sobre el DOM real: `ItemRow.jsx` mete 7 elementos
de ancho fijo en una fila `flex` sin salto de línea (miniatura 68px,
minigráfico 74px, precio 104px, selector de carpeta 74px, dos botones de
30px, más los `gap-3` entre todos) — en un `article` de 335px de ancho útil
en móvil, esos fijos ya suman más de 450px. El título es el único elemento
`flex-1 min-w-0` de la fila, así que se lleva todo el déficit negativo y
queda en `width: 0`: no se trunca, desaparece.

### Diseño del fix, con brainstorming y companion visual

Al ser una decisión de diseño no obvia (cómo reorganizar la fila), se
abordó con la skill `brainstorming`. Se ofreció el companion visual
(navegador local en `.superpowers/brainstorm/`, añadido a `.gitignore`) y
Tony aceptó probarlo; la primera pantalla comparaba escritorio vs. el bug
real en móvil y planteaba tres direcciones (mínimo, reflow completo, o ver
ambas). En paralelo, Tony pidió usar directamente su sesión real ya abierta
en el navegador integrado para probar las opciones con sus propios datos en
vez de maquetas — se hizo así: CSS inyectado en vivo sobre
`vigia-list.vercel.app` (sin tocar el deploy) mostrando la opción de reflow
(título en su propia línea, precio/carpeta/acciones debajo, minigráfico
oculto) sobre las 5 filas reales de Tony. Aprobado por Tony antes de tocar
código.

### Cambios

`src/components/ItemRow.jsx`: el `<article>` pasa de `flex` a
`flex flex-wrap ... sm:flex-nowrap`. El contenedor del título gana
`basis-full sm:basis-0 sm:flex-1` (ocupa toda la línea por debajo de 640px,
vuelve a ser el elemento flexible de siempre a partir de ahí). Precio,
selector de carpeta y los dos botones de acción llevan `order-3` para
apilarse juntos en la segunda línea en móvil. El minigráfico gana
`hidden sm:flex` (oculto por debajo de 640px). Ninguna otra prop ni
comportamiento cambia.

**Detalle encontrado durante la verificación:** una primera versión solo
reordenaba con `order-*` sin darle `basis-full` al título, y el resultado
seguía siendo un título aplastado (aunque menos) porque compartía la primera
"sub-línea" con la miniatura en vez de tener el ancho completo para él solo.
Corregido antes de darlo por bueno.

### Verificación

Verificación visual con el componente real (no una maqueta aparte): harness
temporal (`src/dev-preview-harness.jsx` + `dev-preview-harness.html`,
borrados al terminar) que monta `ItemRow` con datos falsos pero fieles
(incluido el título largo del Samsung), servido por el propio `vigia-dev`.
Probado en 375px (móvil), 600px, 768px (tablet) y escritorio: título
completo y legible en los anchos estrechos, layout de una sola línea sin
cambios a partir de 640px. `npm test` (24 tests) y `npm run build` en verde
tras el cambio.

### Estado final

**B11 cerrado** (`ROADMAP.md`): no era un bug del extractor ni de los datos,
sino la falta de un breakpoint responsive en `ItemRow.jsx`. Arreglado y
verificado con datos reales en varios anchos. Decisión de diseño documentada
en `DECISIONES.md` (por qué apilar y no solo dar un ancho mínimo, por qué el
minigráfico es lo que se sacrifica). Pendiente: el mismo problema de falta
de responsive puede afectar a otras partes de la interfaz (se vio de pasada
que `InstallBanner` también se corta en 375px) — no investigado ni resuelto
en esta sesión, queda para revisar si aparece como molestia real.

---

## 2026-09-09 (Sesión 11) — Retirada de la Edge Function `muebles`

### Contexto

Último pendiente conocido de la fase 6: decidir cuándo se retira la Edge
Function `muebles` de la app vieja, que compartía proyecto Supabase
(`ovmnzlbcmuppqctkyngi`) con Vigía pero vivía en el schema `public`, sin
tocarse por regla de `CLAUDE.md` hasta esta fase.

### Investigación antes de tocar nada

Antes de asumir que ya no se usaba, se comprobó con datos:

- `list_edge_functions` mostró `muebles` como `ACTIVE` en Supabase junto a
  las 4 funciones de Vigía (`scrape`, `refresh`, `push-subscribe`,
  `invite-to-folder`).
- `list_tables` sobre el schema `public` mostró `items` y `price_history`
  con **0 filas** cada una, y `settings` con 1 sola fila.
- Una consulta a `function_edge_logs` (últimas 24h) no mostró ninguna
  invocación a `muebles` — solo peticiones a `refresh` y `scrape`, la app
  nueva.

Con la función sin tráfico real y las tablas de la app vieja vacías, la
conclusión fue que Tony ya había migrado del todo y no había nada que
perder al apagarla. Se confirmó con Tony antes de borrar (acción
irreversible en producción): primero la decisión de retirar ya, luego la
confirmación explícita del borrado.

### Cambios

- Edge Function `muebles` borrada de Supabase con
  `supabase functions delete muebles --project-ref ovmnzlbcmuppqctkyngi`
  (CLI vía `npx`, no había tool MCP de borrado). Verificado con
  `list_edge_functions` que ya no aparece.
- Las tablas `public.items`, `public.price_history` y `public.settings`
  **no se tocaron** — se decidió dejarlas por ahora: borrar tablas es más
  delicado que borrar una función (irreversible, y sin la urgencia de dejar
  de servir tráfico), así que queda como paso aparte.
- `ROADMAP.md`: fase 6 actualizada (retirada hecha, queda solo limpiar
  `public.*`); nueva entrada en la sección de fase 6 documentando la
  investigación y el comando exacto usado.
- `CLAUDE.md`: línea de «Estado actual» actualizada.

### Estado final (primera parte)

`muebles` retirada de producción. Fase 6 queda con un único pendiente:
decidir cuándo (o si) se limpian las tablas `public.*` de la app vieja —
sin prisa, porque ya no reciben escritura y no cuestan nada mientras
existan en el plan gratuito.

### Continuación: limpieza completa de `public.*`

En la misma sesión Tony pidió limpiar ya el pendiente que quedaba. Antes de
tocar nada se revisó si `public.settings` guardaba algo más que el HTML de
la interfaz vieja (no: una sola fila, `key = 'ui_html'`, ya conservada en
el primer commit del repo) y si había funciones o triggers propios en
`public` que un `DROP TABLE` pudiera dejar rotos (no había ninguno).

Al revisar `cron.job` para confirmar que no quedaba nada programado sobre
la app vieja, apareció `muebles-refresh-precios`: inactivo desde la
migración `desactivar_cron_app_vieja`, pero **seguía registrado en la base
de datos con la clave de acceso vieja en texto plano** en el header `x-key`
de su comando (`net.http_post` contra `/functions/v1/muebles/api/refresh`).
Sin la Edge Function que llamaba, no tenía sentido dejarlo ni inactivo, así
que se sumó a la limpieza.

### Cambios (continuación)

- `supabase/migrations/014_limpiar_app_vieja.sql`: nueva migración con
  `select cron.unschedule('muebles-refresh-precios')` y `drop table if
  exists` para `public.price_history`, `public.items` y `public.settings`,
  en ese orden (por la FK de `price_history` hacia `items`). Escrita antes
  de aplicar nada, siguiendo la regla de `CLAUDE.md` de que nada se aplica
  en Supabase que no exista antes como archivo.
- Aplicada con `apply_migration` tras confirmación explícita de Tony (acción
  irreversible en producción).
- Verificado después: `list_tables` sobre `public` devuelve 0 tablas;
  `cron.job` solo conserva `vigia-refresco-horario` (activo); `get_advisors`
  (security) no muestra ningún lint nuevo achacable a este cambio — los dos
  que aparecen (`pg_net` en `public`, leaked password protection) son
  preexistentes y ajenos a esta limpieza.
- `ROADMAP.md`: fase 6 marcada ✅ cerrada del todo; entrada ampliada con el
  hallazgo del cron y el detalle de la migración.
- `CLAUDE.md`: «Estado actual» actualizado — fase 6 cerrada, app vieja sin
  ningún rastro en Supabase salvo el código del primer commit.

### Estado final

Fase 6 cerrada por completo. La app vieja ya no existe en Supabase: sin
Edge Function, sin cron, sin tablas. Solo queda su código en el primer
commit del repo, como registro histórico.

---

## 2026-09-10 (Sesión 10) — Cuatro bugs post-fase 6: compartir, botones móviles, carpeta al añadir y caché

### Contexto

Primera sesión de uso real tras cerrar la fase 6, y salieron cuatro fallos
en cadena reportados por Tony según los iba encontrando en el móvil y en
producción. Ninguno tocó el schema de Supabase; todos eran de frontend,
CORS o cabeceras de caché.

### Hallazgo 1 — Compartir carpeta fallaba por CORS

`invite-to-folder` y `push-subscribe` tenían `https://vigia.vercel.app` en
`ALLOWED_ORIGINS`, pero el dominio real de producción es
`https://vigia-list.vercel.app` (ver `CLAUDE.md`). El navegador bloqueaba
la respuesta por CORS al invitar a compartir. Corregido en ambas Edge
Functions y redesplegadas.

### Hallazgo 2 — Ningún botón de carpeta respondía en móvil

Al investigar "no funciona el compartir carpeta", Tony precisó que en
realidad **ningún** botón del menú de carpeta (renombrar, subcarpeta,
compartir, borrar) respondía en móvil. Dos bugs superpuestos en
`FolderSidebar.jsx`:

1. El botón "⋮" que abre ese menú estaba en `opacity-0`, visible solo con
   `hover` — inexistente en pantallas táctiles, así que quedaba invisible.
2. El listener que cierra el menú al hacer click fuera estaba en fase de
   `capture` sobre `document` y cerraba ante **cualquier** click, incluidos
   los de sus propios botones internos: el menú se desmontaba antes de que
   React llegara a disparar el `onClick` de "Renombrar"/"Compartir"/etc.

Arreglado: el botón "⋮" es siempre visible por debajo de `md`; el listener
ahora usa una `ref` al contenedor del menú abierto y solo cierra si el
click fue realmente fuera.

### Hallazgo 3 — Artículo nuevo se guardaba siempre "Sin carpeta"

`addItem`/`addManualItem` en `useItems.js` nunca insertaban `itm_fld_id`:
el artículo nuevo caía siempre en "Sin carpeta" sin importar qué carpeta
estuviera seleccionada, porque `AddItemForm` ni siquiera recibía esa
información. Ahora `App.jsx` pasa `selectedFolderId` hasta el insert.
Verificado que la política RLS `items_all` cubre tanto carpetas propias
como compartidas visibles (`with check` por `itm_usr_id` o
`visible_folder_ids()`).

### Hallazgo 4 — Móvil seguía sirviendo la versión vieja tras cada deploy

Tras el fix del hallazgo 2, Tony seguía viendo el bug en el móvil aunque en
escritorio ya funcionaba. `vercel.json` daba `Cache-Control: immutable` a
`/assets/*` (correcto, llevan hash) pero **`index.html` no tenía ninguna
regla propia**: el navegador móvil, sobre todo la PWA instalada en modo
standalone, podía seguir sirviendo el HTML viejo — apuntando al bundle JS
anterior — bastante después de cada deploy. Añadida una regla
`Cache-Control: no-cache` para todo lo que no sea `/assets/`.

### Hallazgo 5 — El picker de "asignar a carpeta" en cada artículo tampoco aplicaba

Cerrada la PWA y reabierta tras el hallazgo 4, compartir/editar/menú de
carpeta ya funcionaban, pero mover un artículo de carpeta desde su propia
fila (`ItemRow.jsx`, el botón con la etiqueta de carpeta) seguía sin
efecto. Mismo bug que el hallazgo 2: el listener de cierre en captura
sobre `document` cerraba el picker antes de que el click en una opción
(`moveTo(folderId)`) llegara a ejecutarse. Mismo arreglo: `ref` al
contenedor del picker, cerrar solo si el click fue fuera.

Verificado en producción de punta a punta: se movió un artículo real de
"Muebles" a "Salon" y viceversa, confirmando el fix antes de darlo por
bueno — los intentos previos de reproducirlo habían fallado por errores
de la propia prueba (URLs de producto inventadas que no existen, y un
campo de texto que no se limpiaba entre intentos), no por el código.

### Cambios

- `supabase/functions/invite-to-folder/index.ts`,
  `supabase/functions/push-subscribe/index.ts`: dominio corregido en
  `ALLOWED_ORIGINS`, redesplegadas.
- `src/components/FolderSidebar.jsx`: botón "⋮" visible por debajo de
  `md`; listener de cierre con `ref` en vez de cerrar ante cualquier click.
- `src/hooks/useItems.js`, `src/components/AddItemForm.jsx`, `src/App.jsx`:
  `folderId`/`selectedFolderId` propagado hasta el insert de `items`.
- `vercel.json`: `Cache-Control: no-cache` para todo excepto `/assets/`.
- `src/components/ItemRow.jsx`: mismo arreglo de `ref` que en
  `FolderSidebar.jsx`, aplicado al picker de mover carpeta.
- Cuatro commits, cada uno probado (tests + build) y verificado en vivo en
  `https://vigia-list.vercel.app` antes de darlo por cerrado; el último
  (picker de `ItemRow`) con reproducción real del bug en producción antes
  y después del fix.

### Estado final

Los cinco fallos confirmados arreglados y verificados en producción:
compartir carpeta, menú de carpeta en móvil, carpeta al añadir artículo,
caché de `index.html`, y el picker de mover artículo de carpeta. Ningún
cambio de schema; nada pendiente de migración. Tony confirmó al final de
la sesión que ya todo funciona.
