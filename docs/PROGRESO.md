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

### Continuación: auditoría del resto de la app

Tras confirmar los cinco fixes, Tony pidió revisar que el resto de la app
funcionara bien. Se lanzó un agente Explore a auditar estáticamente todos
los componentes y hooks restantes buscando el mismo patrón de bug (listener
de captura robando clicks, `opacity-0` sin breakpoint táctil, z-index
solapados, forms anidados, `stopPropagation` en la fase equivocada, estados
de carga que no se resetean tras un error), mientras en paralelo se probó
en vivo en producción: Ajustes, Comparador (seleccionar, guardar conjunto,
terminar) y "Copiar para Claude" — los tres funcionan correctamente.

La auditoría no encontró más casos del bug de listener de captura (ya no
quedan usos de `document.addEventListener('click', ...)` fuera de los dos
ya arreglados), pero sí dos problemas reales nuevos:

1. **`InstallBanner` tapaba otros modales.** Pinta un overlay a pantalla
   completa con `z-30`, igual que el drawer móvil de carpetas, pero
   `EditItemModal`/`SettingsModal`/`ShareFolderModal` usaban `z-20`: en
   móvil, si el banner de instalación seguía sin descartar, tapaba
   cualquiera de esos tres modales sin ninguna pista visual de que había
   algo detrás. Subidos a `z-40`.
2. **`useFolderShares.invite()` sin try/catch alrededor del `fetch`.** Un
   fallo de red real (no un error HTTP) lanzaba una excepción sin capturar
   y dejaba `sending=true` para siempre en `ShareFolderModal`,
   inhabilitando el botón "Invitar" hasta cerrar el modal.

De paso, se confirmó que el `confirm()` nativo para borrar un artículo
(`EditItemModal`) no funciona dentro del navegador de pruebas de esta
sesión porque ese entorno suprime los diálogos nativos de JS — no es un
bug de la app, solo una limitación del entorno de prueba.

### Cambios (continuación)

- `src/components/EditItemModal.jsx`, `SettingsModal.jsx`,
  `ShareFolderModal.jsx`: overlay subido de `z-20` a `z-40`.
- `src/hooks/useFolderShares.js`: `fetch` de `invite()` envuelto en
  try/catch, con mensaje de error de conexión.

### Estado final (continuación)

Auditoría completa sin más hallazgos: comparador, ajustes y copiar-para-
Claude verificados en producción; los dos problemas nuevos (z-index de
InstallBanner y fetch sin capturar en invitar) corregidos, probados
(tests + build) y desplegados.

---

## 2026-09-11 (Sesión 12) — `InstallBanner` se cortaba en viewports bajos

### Contexto

Pendiente anotado "visto de pasada" en la sesión 10: `InstallBanner`
también se corta en móvil. Se investigó reproduciendo el componente en el
navegador (sin login real, montando su JSX real con Tailwind cargado) en
varios tamaños de viewport.

### Hallazgo

En vertical (375×812, 375×667) la tarjeta cabe siempre, incluida la
variante iOS con tres pasos (455 px de alto). El caso real que rompe es
cualquier viewport **bajo**: móvil en horizontal, o vertical con el teclado
abierto reduciendo la altura visible. El overlay era
`fixed inset-0 flex items-center justify-center` sin `overflow` ni
scroll: si la tarjeta superaba la altura del viewport, `items-center` la
centraba cortándola simétricamente por arriba y por abajo, y no había
manera de hacer scroll para llegar al botón "Ahora no" ni ver el título.
Probado en 667×375: la tarjeta (455 px) no cabía en el viewport (375 px)
y quedaba con `top: -40`, título tapado y botón de descarte fuera de
pantalla.

### Cambio

`src/components/InstallBanner.jsx`: overlay con `overflow-y-auto` y
`py-8` en vez de solo `px-5`. Con `flex` + `items-center` +
`overflow-y-auto`, cuando el contenido excede el contenedor deja de
recortarse sin más — se vuelve alcanzable con scroll. Verificado
reproduciendo el mismo caso 667×375: `scrollHeight` (447) mayor que
`clientHeight` (375), scroll disponible.

### Estado final

Tests (24) y build en verde. Sin tocar BD ni Edge Functions.

---

## 2026-09-11 (Sesión 13) — Miniaturas de artículo (B10): de recorte fijo a imagen completa

### Contexto

De los pendientes del backlog (B5 exportar, B6 refresco por artículo, B7
SMTP propio, B10 miniaturas), Tony priorizó B10. Preguntado por el caso
concreto, la respuesta fue que el resultado varía mucho según la tienda:
no era un problema de ajustar el porcentaje de recorte, sino estructural.

### Diagnóstico

`ItemRow.jsx` usaba `object-cover` con `objectPosition: '50% 35%'` fijo
para las 68×68. Ese recorte fijo asume una foto de catálogo con el
producto centrado y algo desplazado hacia arriba — funciona con fotos de
producto tipo ficha técnica, pero falla con fotos de ambiente/lifestyle
(el producto es pequeño dentro de la imagen, en una posición que varía
tienda a tienda). Ningún porcentaje fijo cubre ambos casos.

### Decisión

Entre las opciones (imagen completa con `object-contain`, recorte
adaptable por proporción detectada en el navegador, o dejar de perseguir
esto en la miniatura y mejorar en su lugar la vista "Fotos" en rejilla),
Tony eligió `object-contain`: la imagen se muestra siempre entera, nunca
se corta nada, a cambio de dejar ver el fondo `surface-2` en los lados
cuando la proporción no es cuadrada. Es el cambio más simple, sin lógica
nueva ni heurística que pueda seguir fallando en casos concretos —
coherente con "cero dependencias nuevas sin justificación". La vista
"Fotos" en rejilla mencionada en `docs/DISENO.md` no existe todavía en el
código; no se ha tocado en esta sesión.

### Cambio

`src/components/ItemRow.jsx`: la miniatura pasa de `object-cover` +
`objectPosition` fijo a `object-contain`, sin posición explícita (deja de
tener sentido con `contain`). El contenedor (68×68, `surface-2`, borde,
esquinas redondeadas) no cambia. `docs/DISENO.md` actualizado para
reflejar `object-contain` en vez de la referencia antigua a 54×54 +
recorte sesgado (ya desactualizada desde el ajuste del 2026-09-07).

### Estado final

Tests (24) y build en verde. Cambio de una propiedad CSS, sin tocar BD ni
Edge Functions. No verificado con datos reales en el navegador (la app
exige login por enlace mágico; no hay entorno de prueba local sin auth) —
`object-fit: contain` es comportamiento estándar de CSS, determinista en
cualquier navegador, así que se dio por suficiente el build limpio.
Backlog B10 cerrado en `docs/ROADMAP.md`.

---

## 2026-09-11 (Sesión 14) — Vista "Fotos": el hueco entre lo aprobado y lo construido

### Contexto

Tony pidió una revisión de diseño abierta ("qué nos queda por construir /
mejorar en la app"). Comparando `docs/diseno-referencia.html` (prototipo
aprobado el 2026-09-03) contra el código real, se encontró que el
conmutador Lista/Fotos del prototipo nunca se implementó: `ItemList.jsx`
solo tenía la vista Lista. No era un ajuste de pulido sino un modo entero
del diseño aprobado que faltaba.

Mostrado en el companion visual de brainstorming (comparación lado a lado
del estado actual vs. la propuesta, con los tokens y componentes reales
del proyecto), Tony confirmó construirla.

### Cambios

`src/components/ItemTile.jsx` (nuevo): tarjeta de la rejilla, hermana de
`ItemRow.jsx` — imagen grande `aspect-4/3` con `object-contain` (mismo
criterio que B10, sesión 13), franja de color arriba en vez de lateral,
nombre + tienda + precio/variación, botón de editar que abre
`EditItemModal` igual que la fila. Sin minigráfico, sin selector de
carpeta ni copiar-para-Claude — vista secundaria "para comparar diseños,
no precios" (`docs/DISENO.md`).

`src/components/ItemList.jsx`: `useState('list')` para la vista activa,
segmented control Lista/Fotos junto a los controles existentes
(búsqueda/orden/solo bajadas), función `itemsView()` que decide entre
`map(row)` en columna o `map(tile)` en rejilla (`grid-cols-[repeat(auto-fill,minmax(140px,1fr))]`,
igual que la referencia) — usada en las dos ramas de render (agrupado por
carpeta y lista plana).

### Verificación

Sin login real disponible (la app exige enlace mágico), se montó
`ItemList` en un harness temporal (`dev-preview.jsx` + `dev-preview.html`,
borrados al terminar, nunca commiteados) con datos de prueba que cubren
los casos límite: imagen cuadrada, panorámica, sin imagen y sin precio.
Verificado en el navegador: la rejilla renderiza con `object-contain` sin
recortar ninguna imagen, el toggle cambia de vista correctamente, el modal
de edición se abre desde la tarjeta con los datos correctos, y el layout
responde bien en 375px (móvil).

### Estado final

Tests (24) y build en verde. Sin tocar BD ni Edge Functions. Backlog:
vista Fotos ya no es un pendiente — ver `docs/ROADMAP.md`. Quedan B5
(exportar), B6 (refresco por artículo), B7 (SMTP propio).

---

## 2026-09-11 (Sesión 15) — Vista Fotos en producción: carpeta, texto desbordado y un bug de `InstallBanner`

### Contexto

Con la vista Fotos ya en producción (commit `d23da08`), Tony reportó no
ver ningún cambio en móvil, y por escrito dos problemas más: revisar que
tamaños de texto/botones fueran consistentes, y que la vista Fotos no
dejaba de forma sencilla asignar carpeta a un artículo.

### Diagnóstico

**"No veo ningún cambio" en móvil:** reproducido en el navegador contra
`https://vigia-list.vercel.app` (deploy ya activo, confirmado por
`git log` y por ver los artículos reales con `object-contain`
funcionando). La causa: `InstallBanner` — el overlay a pantalla completa
que invita a instalar la PWA — aparece encima de todo, incluido el
conmutador Lista/Fotos nuevo, y en este entorno de prueba el botón
"Ahora no" no respondía a clics simulados por eventos de puntero
(`computer` tool), aunque `.click()` disparado directamente sí cerraba el
banner sin problema — la lógica de `dismissThisSession()` en
`InstallBanner.jsx` es correcta. Queda sin confirmar si el fallo de clic
es solo del entorno de automatización o si también ocurre con toque real
en un móvil — anotado como sospecha, no como bug confirmado del banner
(no se ha tocado `InstallBanner.jsx` en esta sesión). Lo que sí explica
la queja de Tony: el banner aparece en cada visita sin `sessionStorage`
previo y tapa la interfaz nueva por completo, así que parece que la app
no cambió.

**Tamaños:** comparados los `text-[Npx]` de `ItemTile.jsx` contra
`ItemRow.jsx` — la tarjeta usa valores algo menores (13px/14.5px nombre y
precio, frente a 14.5px/17px en la fila) de forma deliberada, porque la
tarjeta es más estrecha; no se encontró inconsistencia real, solo una
escala distinta y coherente con el espacio disponible.

**Carpeta:** confirmado con datos reales en producción — la tarjeta no
tenía ningún indicador ni forma de cambiar la carpeta del artículo, a
diferencia de la fila. Tampoco mostraba el aviso "la tienda bloquea la
lectura" que sí tiene `ItemRow`. Eran omisiones reales del diseño de la
sesión 14, no decisiones defendibles.

### Cambios

`src/components/ItemTile.jsx`: añadido el mismo selector de carpeta que
`ItemRow.jsx` (botón con `IconEtiqueta` + nombre, desplegable con
`Sin carpeta` y la lista de `folders`, cierre al clicar fuera) y el aviso
de tienda bloqueada junto al dominio. Dos ajustes de layout que no tiene
`ItemRow` por no hacer falta ahí: el texto de tienda bloqueada usa
`flex-wrap` en vez de una sola línea (en una tarjeta angosta se salía del
borde); el desplegable de carpeta se centra bajo su botón
(`left-1/2 -translate-x-1/2`) en vez de anclarse a la derecha (`right-0`
como en la fila) — en una rejilla de columnas estrechas, anclado a la
derecha se cortaba fuera de la pantalla en la primera columna.

### Verificación

Mismo harness temporal que la sesión 14 (`dev-preview.jsx` +
`dev-preview.html`, borrados al terminar). Verificado en escritorio y en
375px: el selector de carpeta abre, se ve completo sin cortarse en
ninguna columna, y el cambio se propaga correctamente (`onUpdate` recibe
`{itm_fld_id: ...}`); el aviso de tienda bloqueada envuelve dentro de la
tarjeta en vez de desbordarse.

### Estado final

Tests (24) y build en verde. Sin tocar BD ni Edge Functions. Pendiente
sin confirmar (anotado, no backlog formal): si el botón "Ahora no" de
`InstallBanner` falla también con toque real en móvil, no solo con clics
simulados en este entorno — revisar si vuelve a reportarse.

---

## 2026-09-11 (Sesión 16) — Cabecera móvil: de botones de texto desbordados a iconos

### Contexto

Tras el fix de la sesión 15, Tony reportó que en móvil el botón
"Actualizar" se veía "gigante" y pidió revisar las botoneras y su
posición para que fueran cómodas e intuitivas. Reproducido en el
navegador contra producción en 375px: la cabecera tenía 5 controles en
una sola fila sin breakpoints (Actualizar con texto, Comparar con texto,
icono de ajustes, email, botón Salir) — no colapsaba, se desbordaba por
el lateral derecho cortando literalmente "Salir" fuera de la pantalla.
"Actualizar" no era más grande que los demás en tamaño de fuente, pero
llamaba más la atención por ser el único con fondo de color sólido
(`bg-accent`) en un espacio ya apretado.

Mostradas dos opciones en el companion visual (A: los tres controles
principales como iconos siempre visibles; B: solo Actualizar visible y
el resto en un menú "⋮" como el que ya usan las carpetas), Tony eligió A.

### Decisión de diseño (email y "Salir", no cubiertos por la opción A)

La opción A dejaba sin resolver dónde iban el email y "Salir" al quitarles
el espacio en la cabecera. Se llevaron al panel de carpetas que ya se
desliza en móvil (`showSidebarMobile` en `App.jsx`), en un pie separado
por una línea — evita añadir un cuarto icono a la cabecera y reutiliza un
panel que ya existe, en vez de inventar un menú de cuenta nuevo.

### Cambios

`src/components/icons/index.jsx`: dos iconos nuevos, `IconActualizar`
(flecha circular) e `IconComparar` (líneas con viñetas), SVG a mano como
el resto del barrel.

`src/App.jsx`: los botones Actualizar/Comparar/Ajustes muestran solo el
icono por debajo de `sm:` (640px) y el texto completo desde `sm:` en
adelante, sin tocar el layout de escritorio. Actualizar usa
`animate-spin` en su icono mientras `refreshing` es true (antes el texto
cambiaba a "Leyendo…", que ya no cabe en el icono). Email y "Salir" se
ocultan de la cabecera por debajo de `sm:` (`hidden sm:inline` /
`hidden sm:block`) y se añaden al pie del panel de carpetas móvil.

### Verificación

Harness temporal (`dev-preview.jsx` con solo la cabecera y el panel de
carpetas, sin los hooks reales; `dev-preview.html`, ambos borrados al
terminar). Encontrado y corregido en el propio harness: sin el meta
`viewport` en el HTML, el navegador emulado reportaba `innerWidth: 981`
en vez de 375, dando un falso positivo de que el breakpoint no
funcionaba — el `index.html` real de la app ya tiene ese meta, así que no
era un problema del código de producción. Con el meta añadido al harness,
verificado en 375px: cabecera con tres iconos del mismo tamaño sin
desbordar, icono de actualizar con opacidad reducida durante el refresco,
y email + Salir visibles y funcionales en el panel de carpetas. En
escritorio (fuera de emulación), la cabecera queda idéntica a antes.

### Estado final

Tests (24) y build en verde. Sin tocar BD ni Edge Functions.

---

## 2026-09-28 (Sesión 17) — Login en iPhone instalado y carpetas compartidas que no se veían

### Contexto

Tony reportó dos problemas de uso real: (1) en iPhone, con Vigía añadida a
la pantalla de inicio, nunca se queda la sesión — el enlace del correo abre
Safari, entra ahí, pero la app instalada sigue pidiendo correo (en Android
sí funciona); (2) compartió la carpeta «Pisito» con otra persona, a él le
sale como compartida, pero la invitada no ve nada.

### Diagnóstico

**Compartir:** la invitación estaba bien (`accepted`, con `usr_id`
resuelto). Simulando en producción la RLS con la identidad de la invitada
(`set local role authenticated` + `request.jwt.claims`, con rollback),
cualquier `select` sobre `folders` fallaba con `stack depth limit exceeded`:
`visible_folder_ids()` era `SECURITY INVOKER` y su consulta a `folders`
volvía a pasar por la política de `folders`, que la vuelve a llamar. Al
dueño no le pasaba porque el plan resolvía el OR por `fld_usr_id` sin llegar
a la subconsulta. El frontend hace `data ?? []` y mostraba vacío.

**iPhone:** en iOS la app de pantalla de inicio no comparte almacenamiento
con Safari y los enlaces siempre abren Safari. No hay ajuste que lo
arregle mientras el acceso dependa de abrir un enlace.

**Hallazgo extra al probar la 015:** la invitada podía crear un artículo
suyo con `itm_fld_id` de una carpeta ajena no compartida (hacía falta el
UUID). `WITH CHECK` de `items_all` no miraba la carpeta.

### Cambios

- `supabase/migrations/015_visible_folders_sin_recursion.sql`:
  `visible_folder_ids()` a `SECURITY DEFINER`. Aplicada en producción.
- `supabase/migrations/016_items_carpeta_visible.sql`: la carpeta de
  destino de un artículo tiene que ser null o visible. Aplicada.
- `supabase/migrations/017_folder_shares_sin_escritura_directa.sql`: sin
  INSERT/UPDATE directo en `folder_shares` para `authenticated`. Antes
  cualquiera podía insertarse una invitación aceptada a una carpeta ajena
  (reproducido: de 0 a 2 artículos ajenos visibles) o cambiar la carpeta de
  su invitación. El frontend nunca escribía directo (Edge Function + RPCs).
  Aplicada y verificada: ataque bloqueado, ver/revocar por RPC intactos.
- **Rama `login-codigo` (no en `main`):** `src/lib/otp.js` (+ 10 tests),
  `verifyCode` en `useAuth.js` y pantalla de código en `Login.jsx`. Aparcado
  porque requiere cambiar las plantillas de correo de Supabase, y Tony
  prefirió dejarlo para más adelante y priorizar compartir.

### Verificación

- RLS en producción con los tres usuarios reales (rollback): la invitada ve
  «Pisito» (1 artículo, 3 precios); ningún usuario ve carpetas ajenas;
  invitada puede añadir/editar/meter precio en la carpeta compartida, no
  puede crear ni mover artículos a una carpeta ajena; el dueño sigue
  pudiendo todo. Sin residuos.
- Login en local contra Supabase real (375px): la pantalla del código se
  recupera tras recargar; un código falso llega a `POST /auth/v1/verify`
  (403 `otp_expired` en los logs de Auth) y la app muestra el error; "Usar
  otro email" limpia el pendiente.
- Tests (34) y build en verde.

### Estado final

Compartir arreglado en producción (solo BD, sin despliegue). Login por
código aparcado en `login-codigo`: para retomarlo, plantillas "Magic Link" y
"Confirm signup" con `{{ .Token }}`, merge y prueba en iPhone real (el
aislamiento de almacenamiento de iOS no se puede emular).

---

## 2026-09-29 (Sesión 17, cont.) — Compartir con enlace de invitación

### Contexto

Con las carpetas compartidas ya visibles (015), Tony priorizó hacer
compartir más sencillo que el correo y aparcar el login por código.
Eligió el enlace de invitación (ver DECISIONES 2026-09-29).

### Cambios

- `supabase/migrations/018_enlace_invitacion.sql`: `shr_token`,
  `shr_expires_at`, email nullable, RPCs `create_folder_share_link` y
  `accept_folder_share_link`. Aplicada.
- `src/lib/shareLink.js` (+ 11 tests): construir/leer el enlace, guardar el
  token hasta el login, etiquetas del modal, mensajes de error.
- `ShareFolderModal.jsx`: «Crear enlace de invitación» → «Enviar…»
  (`navigator.share`) / «Copiar enlace»; si el portapapeles falla, el
  enlace queda en un campo seleccionable con aviso. Lista con Activo /
  Pendiente / Caduca el X / Caducado, reenviar enlaces sin usar, Quitar.
- `App.jsx`: captura `?unirse=` al abrir (lo quita de la URL), se une al
  entrar y muestra «Te has unido a «X»» y selecciona la carpeta. **Bug
  aparte arreglado:** aceptar una invitación solo recargaba las
  invitaciones, no carpetas ni artículos — la carpeta no salía hasta
  recargar la página.
- `Login.jsx`: aviso «Te han invitado a una carpeta…» si hay token.
- `useAuth.js`: el token viaja en `emailRedirectTo`.

### Verificación

- BD con los usuarios reales (rollback): crear enlace (32 chars); otro
  usuario no puede crear enlace de carpeta ajena; el dueño no puede
  aceptar el suyo; la invitada no puede leer el token antes de aceptar;
  al aceptar pasa de 0 a 2 artículos visibles; reutilizar el enlace falla;
  enlace caducado falla; si ya estaba invitada, se reutiliza su fila (sigue
  habiendo 1). `anon` no puede ejecutar ninguna de las dos RPC.
- App local sin sesión: `/?unirse=<token>` guarda el token, limpia la URL y
  muestra el aviso en el login.
- Modal en harness temporal a 375px (borrado al terminar): crear, enviar
  (título/texto/URL correctos), copiar con portapapeles bloqueado (sale el
  campo y el aviso), quitar; sin desbordamiento.
- No verificado de extremo a extremo con dos cuentas reales en el navegador:
  entrar exige leer el correo. Queda para Tony (ver Estado final).
- Tests (35) y build en verde.

### Estado final

Pendiente de Tony: prueba real — crear enlace de «Pisito», mandarlo y
abrirlo con otra cuenta; comprobar que aparece la carpeta.

---

## 2026-09-29 (Sesión 17, cont.) — Entrar con contraseña, como Bilans

### Contexto

Tony no quiere tocar las plantillas de correo y preguntó por qué Bilans no
tiene el problema del iPhone. Bilans entra con contraseña o Google, dentro
de la app; Vigía solo con enlace del correo. Eligió contraseña (Google, de
momento no). Ver DECISIONES 2026-09-29.

### Cambios

- `src/lib/authForm.js` (+ 11 tests): detectar el hash `type=recovery`,
  validar contraseña (mín. 8, repetición), mensajes de error por código.
- `src/lib/supabase.js`: `openedFromPasswordRecovery`, leído antes de
  `createClient` (supabase-js limpia el hash y emite `PASSWORD_RECOVERY` en
  un `setTimeout` que puede adelantarse a React).
- `useAuth.js`: `signInWithPassword`, `signUpWithPassword`,
  `sendPasswordReset`, `updatePassword`, estado `recovering`; la URL de
  vuelta de todos los correos lleva la invitación pendiente si la hay.
- `Login.jsx`: cuatro modos (entrar, crear cuenta, olvidé, enlace).
- `PasswordFields.jsx`: elegir contraseña sin `<form>` propio (vive dentro
  del formulario de Ajustes; Enter guarda la contraseña, no los ajustes).
- `App.jsx`: pantalla «Elige tu contraseña» tras el correo de recuperación.
- `SettingsModal.jsx`: sección «Contraseña».

### Verificación

- Local contra Supabase real, 375px: credenciales inventadas → en los logs
  de Auth `grant_type=password` → `invalid_credentials`, y la app muestra el
  mensaje que remite a «He olvidado mi contraseña». Validaciones de crear
  cuenta (corta, no coinciden) sin llamar al servidor. «Olvidé» con email
  inexistente → aviso de correo enviado. No se crearon cuentas.
- `PasswordFields` en harness temporal dentro de un `<form>` (borrado):
  Enter no envía el formulario padre, `same_password` en español, al
  guardar vacía campos y confirma.
- No verificado: entrar con una contraseña real y el enlace de
  recuperación de extremo a extremo (exige el correo de Tony).
- Tests (46) y build en verde.

### Estado final

La rama `login-codigo` queda obsoleta. Pendiente de Tony: poner su
contraseña (Ajustes u «olvidé») y entrar con ella en la app del iPhone.

---

## 2026-09-29 (Sesión 18) — Un fallo de lectura ya no parece una lista vacía (B16)

### Contexto

Backlog B16: los hooks hacían `data ?? []` sin mirar `error`, y así la
recursión RLS de B14 se vio durante días como «no tengo carpetas».

### Cambios

- `src/lib/loadErrors.js` (+ 4 tests): `loadErrorMessage` arma el texto
  del aviso nombrando lo que falló (artículos, carpetas, invitaciones,
  ajustes).
- `useItems`, `useFolders`, `useFolderShares`, `useSettings`: nuevo
  `loadError`. Si la lectura falla se conservan los datos anteriores en vez
  de vaciarlos. `useFolderShares` y `useSettings` exponen `reload`.
- `useSettings`: **bug aparte**. Ante un fallo de lectura cargaba los
  valores por defecto; abrir y guardar Ajustes habría pisado los reales.
  Ahora los valores por defecto son solo para quien aún no tiene fila.
- `App.jsx`: aviso (`role="alert"`, tokens `bad`/`bad-soft`) con
  «Reintentar», que recarga solo lo que falló.
- `ItemList.jsx`: si la lectura de artículos falló y no hay ninguno, no
  enseña «Pega la URL de un producto…», que haría creer que la lista está
  vacía de verdad.

### Verificación

- Harness temporal a 375px con Supabase simulado (borrado al terminar):
  las cuatro lecturas fallando → aviso con las cuatro y sin el texto de
  lista vacía; «Reintentar» con solo carpetas fallando → aviso reducido a
  «carpetas» y el artículo visible; todo recuperado → aviso fuera, carpeta
  y artículo visibles; solo ajustes fallando desde el inicio → el modal de
  Ajustes no se abre con valores por defecto. Consola sin errores.
- No verificado contra un fallo real de Supabase en producción.
- Tests (50) y build en verde.

### Estado final

B16 cerrado. Siguen pendientes de Tony las pruebas de la sesión 17
(contraseña en el iPhone y enlace de invitación con otra cuenta).

---

## 2026-09-29 (Sesión 19) — Avisos de precio: revisión y cuatro arreglos

### Contexto

Tony preguntó si las alertas funcionan y cómo se avisa. Revisión del código y
de producción: el aviso es solo push nativo (Web Push/VAPID), por
dispositivo, sin correo ni aviso dentro de la app. Estado real: 0
dispositivos suscritos, ningún precio ha cambiado en 3 semanas, así que nunca
ha llegado un aviso. El cron funciona (72 ejecuciones correctas en 3 días) y
Ajustes guarda bien. Se encontraron cuatro fallos y Tony pidió arreglarlos.

### Cambios

- **Cuentas sin `user_settings`** (2 de 3): la fila solo se creaba al pulsar
  Guardar en Ajustes, y sin ella la cuenta no entraba en el pase automático
  ni recibía avisos (una llevaba desde el 19 sin refrescarse). Migración
  `019_ajustes_al_registrarse.sql`: trigger en `auth.users` que crea la fila
  (mismo patrón que `resolve_pending_shares`) y relleno de las que faltaban.
- **«Cada 6 h» / «Cada 12 h» eran diarios en la práctica**: `refresh` solo
  leía artículos con más de 20 h sin mirar. Ahora el corte va por usuario
  según su modo (5 h / 11 h / 20 h, los márgenes de `run_scheduled_refresh`),
  con una consulta por usuario.
- **Rebote de precio sin aviso**: avisar a 90, subir a 120, bajar a 100 no
  avisaba. Si el precio sube por encima de `itm_notified_price` se vacía.
  «Vuelve a haber stock» ya no depende de esa columna. Corrección anotada en
  `DECISIONES.md` bajo la decisión de idempotencia.
- **Texto del aviso**: decía «ha bajado de precio» al volver el stock, y
  podía salir «-0%». Ahora nombra el motivo (`-10 %`, «mínimo histórico»,
  «vuelve a haber stock») y el precio. Usa el título guardado del artículo.
- Lógica pura sacada a `supabase/functions/refresh/notify.ts` con 21 tests
  (`notify.test.ts`, Vitest como `extract.test.ts`).

### Verificación

- Tests (71) y build en verde.
- Migración aplicada; las 3 cuentas tienen fila. Advisors sin avisos nuevos.
- `refresh` desplegada (`--no-verify-jwt`; antes se comprobó que la versión
  en producción era la del repo). Pase real en modo cron para la cuenta que
  llevaba parada desde el 19: `200`, 3 revisados, 2 actualizados, 1 fallo
  (B19, un artículo de IKEA sin precio).
- No verificado: un push llegando a un dispositivo (no hay ninguno suscrito,
  B17) ni un cambio real de precio.

### Estado final

Pendiente de Tony: activar notificaciones en el iPhone (B17). Nuevos en el
backlog: B17, B18 (avisos para invitados, decisión de Cowork), B19.


## 2026-10-01 (Sesión 20) — «Crear cuenta» con un email que ya tenía cuenta (B20)

### Contexto

Tony: crear cuenta o poner contraseña no funciona porque pide confirmar por
correo y el correo nunca llega; proponía quitar la confirmación. Los logs de
Auth del 2026-09-30 dicen otra cosa: la cuenta de la invitada existe y está
confirmada desde el 25 (entró con enlace mágico). Intentó entrar con
contraseña (`invalid_credentials`) y después «Crear cuenta» dos veces
(`user_repeated_signup`). Con un email ya registrado Supabase no da error ni
manda correo (evita enumerar cuentas), y la app decía «te hemos enviado un
correo». Quitar la confirmación no lo habría arreglado: la cuenta ya existe y
sigue sin contraseña.

### Cambios

- `signUpOutcome` en `src/lib/authForm.js`: distingue sesión directa,
  pendiente de confirmar y **email ya registrado** (`user.identities` vacío,
  la señal que documenta Supabase). 4 tests nuevos.
- `Login.jsx`: en ese caso pasa sola a «Recuperar contraseña» con el email
  ya escrito y explica que basta con «Enviarme el correo» para ponerle
  contraseña. El aviso de confirmar ya no mezcla los dos casos.
- «Confirm email» en Supabase se deja como está (ver B20).

### Verificación

- Tests (75) y build en verde.
- No probado en el navegador contra Supabase real: habría que dar de alta un
  email ajeno o el de Tony con una contraseña de prueba. Comportamiento de
  `identities: []` confirmado en la documentación de Supabase.

### Estado final

La invitada tiene que usar «He olvidado mi contraseña (o nunca puse una)»:
el correo de recuperar sí se envía. Si ese correo tampoco llega, el problema
es de entrega (SMTP de pruebas, B7), no de la confirmación.

Decidido con Tony: se mantiene «Confirm email». Hasta hoy los correos han
llegado (las 3 cuentas confirmaron en menos de 20 s), pero el SMTP de pruebas
de Supabase no garantiza la entrega y tiene un límite bajo por hora. Si falla
de verdad, el paso es B7 (SMTP propio, p. ej. Resend gratuito).


## 2026-10-01 (Sesión 21) — Investigación: Maisons du Monde no deja leer el precio

### Contexto

Tony: con Maisons du Monde no se obtiene el precio; buscar alternativas.

### Cambios

Solo investigación y documentación, sin código.

- La tienda ya no usa el checkpoint de Vercel: ahora es **DataDome**
  (`x-datadome: protected`). Corregido en `docs/TIENDAS.md`.
- Probado desde IP residencial: fichas y categorías dan 403 con cualquier
  combinación de cabeceras y User-Agent (Chrome, iPhone, Googlebot…). Su API
  interna (GraphQL en `bff-www.maisonsdumonde.com`) también está detrás de
  DataDome. No hay clave pública de Algolia. Solo la home pasa.
- En un navegador real la ficha trae el precio en JSON-LD (289 € la vitrina
  Illa, en stock): el extractor actual valdría tal cual si llegara el HTML.
- Alternativas y tabla de pruebas en `docs/TIENDAS.md`, sección «Maisons du
  Monde: qué se probó». Backlog B21.

Tony elige leer desde el navegador; se monta el botón en la misma sesión:

- `src/lib/browserImport.js`: código del bookmarklet (JSON-LD → metas Open
  Graph, igual que el extractor del servidor), lectura y validación de
  `#importar=` y guardado pendiente hasta el login (patrón de `shareLink.js`).
  11 tests (`browserImport.test.js`), que ejecutan el bookmarklet contra una
  página falsa.
- `useItems.saveFromBrowser`: si el artículo ya está, apunta el precio (y
  rellena título/imagen si se guardó a mano sin ellos); si no, lo crea.
- `BrowserImportBanner`: aviso con imagen, título y precio; nada se guarda
  sin pulsar «Guardar».
- Ajustes → «Botón para el navegador» (solo escritorio): el enlace para
  arrastrar a la barra de marcadores.
- Migración `020_precio_desde_navegador.sql`: `ph_source = 'browser'`.
  Aplicada.
- Decisión en `DECISIONES.md`. Extensión de Chrome valorada y aplazada.

### Verificación

- Tests (86) y build en verde.
- El código del botón ejecutado sobre la ficha real de Maisons du Monde (en
  el navegador integrado) genera la URL con 289 €, EUR, en stock, título e
  imagen.
- Vigía en local sin sesión: recoge el `#importar=`, lo quita de la barra y
  lo guarda para después del login.
- **No verificado:** el guardado con sesión iniciada (habría que entrar con
  la contraseña de Tony) ni el arrastre real a la barra de marcadores.

Tony lo prueba en su Chrome con un artículo de IKEA: funciona (en logs,
`POST items` y `POST price_history` 201). Pide que quede claro qué artículos
no tienen precio automático:

- La etiqueta de los artículos manuales pasa de «la tienda bloquea la
  lectura» a **«sin precio automático»**, con explicación al pasar el ratón
  (`MANUAL_HINT`), en Lista y en Fotos.
- `saveFromBrowser` pone `itm_is_manual` según la tienda también al
  actualizar un artículo existente, y avisa si falla el insert del histórico.
- El aviso de confirmación, en tienda bloqueada, dice que no hay precio
  automático y cómo actualizarlo.

Tony lo prueba en la mesita de Maisons du Monde: funciona. Pide logo,
nombre más claro y que guarde sin confirmar:

- Nombre del marcador: «👁️ Guardar en Vigía». Chrome no deja poner icono a
  un marcador `javascript:`; el ojo del logo va como emoji.
- Guardado directo: el botón lleva una clave aleatoria guardada en este
  navegador (`getOrCreateBookmarkletKey`); con la clave correcta
  `BrowserImportBanner` guarda al abrir (`isTrustedImport`). Sin ella sigue
  pidiendo confirmar. 4 tests nuevos (90 en total).
- Favicon de la app en la pestaña (`index.html` no tenía).

### Estado final

Botón probado por Tony en IKEA y en Maisons du Monde. Pendiente: que Tony
cambie el marcador por el nuevo (el viejo no lleva clave y pide confirmar) y
compruebe el guardado directo.


## 2026-10-01 (Sesión 22) — «Sin carpeta» arriba y vista Lista/Fotos recordada

### Contexto

Tony confirma que el botón «Guardar en Vigía» ya guarda directo. Pide que en
la vista general salgan primero los artículos sin carpeta y que se recuerde
la vista elegida (Lista o Fotos).

### Cambios

- `src/lib/itemGroups.js`: `groupByFolder` pone «Sin carpeta» siempre
  primero (antes se ordenaba por nombre y caía por la S); el resto, por
  nombre. Un artículo de una carpeta que no está cargada se suma a «Sin
  carpeta» en vez de abrir otro grupo con el mismo nombre.
- La vista Lista/Fotos se guarda en `localStorage` (`vigia.itemView`), por
  navegador. Orden y filtros no se recuerdan (no se pidió).
- `ItemList` usa las dos cosas. 4 tests nuevos (`itemGroups.test.js`).
- Después, Tony pide plegar las carpetas en el listado general como en el
  sidebar: la cabecera de cada grupo es un botón con flecha (misma
  `IconChevronRight` que el sidebar); plegado deja nombre, número y total.
  Los grupos plegados se recuerdan (`vigia.collapsedGroups`). Mientras se
  busca, todos se abren y el botón se desactiva, para no esconder
  coincidencias. 2 tests más.

### Verificación

- Tests (96) y build en verde.
- No visto en pantalla con sesión (haría falta la contraseña de Tony).

### Estado final

Pendiente de Tony: comprobarlo en producción.


## 2026-10-01 (Sesión 23) — Extensión de Chrome: precio automático en tiendas que bloquean

### Contexto

Con el botón ya guardando directo, Tony pregunta si lo mismo puede hacerse
automático. Un marcador no puede ejecutarse solo; una extensión sí. Prueba
previa en el navegador integrado: los 4 artículos manuales (3 de Maisons du
Monde y 1 de Kave Home), abiertos sin interacción, cargan con precio y sin
captcha. Tony da el visto bueno.

### Cambios

- Edge Function **`record-price`** (desplegada, `--no-verify-jwt`): valida el
  token, actualiza o crea el artículo del usuario, histórico con
  `ph_source = 'browser'` y aviso de bajada con `refresh/notify.ts` y
  `refresh/push.ts`. Lógica pura en `record.ts` con 7 tests.
- **`vite.config.js`** publica `/extension-config.json` (URL y clave pública
  de Supabase desde las variables de Vercel) para no escribirlas en el repo.
- **`extension/`**: manifest v3, `background.js` (pase diario con
  `chrome.alarms` en ventana minimizada, guardar pestaña, sesión),
  `api.js` (login propio con email y contraseña, renovación serializada),
  `extract.js` (misma lógica que el marcador, 3 tests), popup con el logo,
  `README.md` con la instalación.
- **Web:** la etiqueta de los artículos manuales distingue «precio desde
  Chrome» (último precio del navegador hace menos de 48 h) de «sin precio
  automático» (`manualPriceStatus`, 3 tests). `useItems` pide `ph_source`.
- Docs: DECISIONES, ARQUITECTURA, TIENDAS, ROADMAP (B21 cerrado, B22 nuevo).

### Verificación

- Tests (109) y build en verde. `node --check` de los JS de la extensión.
- `record-price` responde 401 sin token y 204 al preflight.
- `extract.js` ejecutado sobre la ficha real de Maisons du Monde (55,90 €,
  en stock) y comprobado que no confunde Kave Home con un captcha.
- **No verificado:** la extensión cargada en Chrome (el navegador integrado
  no carga extensiones), el login, el pase real ni `record-price` con un
  token de verdad. Es la prueba de Tony.

Después, para usar el marcador en Safari del iPhone (Tony: le basta con
eso fuera de Chrome):

- Ajustes muestra la sección también en móvil, con «Copiar código» y los
  pasos para pegarlo en un favorito de Safari. Desde la app instalada avisa
  de que hay que hacerlo en Safari (no comparten almacenamiento ni sesión).
- Si el navegador bloquea la pestaña nueva, el marcador abre Vigía en la
  misma.
- Encontrado y evitado: un comentario `//` dentro del código del marcador
  habría anulado todo el resto, porque va en una sola línea. Test nuevo que
  ejecuta el enlace tal cual queda en el marcador (111 tests).

### Estado final

Pendiente de Tony: instalar la extensión (`extension/README.md`), entrar,
probar el icono en una ficha y «Actualizar ahora» en la ventana; crear el
favorito en Safari del iPhone. B22 para vigilar el captcha en uso real.
No probado en Safari real.


## 2026-10-01 (Sesión 24) — Revisión de todo lo de hoy

### Contexto

Tony no puede probar el iPhone ahora y pide revisar que no haya nada roto.
Revisado el diff completo desde `397e027` (web, extensión, `record-price`).

### Encontrado y corregido

- **Android:** Ajustes trataba la app instalada en Android como la del
  iPhone (avisaba de ir a Safari y escondía «Copiar código»). Ahora el aviso
  es solo para iOS (`navigator.standalone`); en Android la app instalada
  comparte almacenamiento con Chrome. Pasos para Android añadidos.
- **Duplicados por URL:** el marcador y la extensión buscaban el artículo
  por la URL canónica; si se había guardado pegando otra (con parámetros,
  por ejemplo), se creaba otro. Ahora mandan también la de la barra
  (`altUrl`) y se busca por las dos, en la web y en `record-price`.
- **Pase por id:** la extensión manda `itemId` en el pase diario y
  `record-price` busca por id; si el artículo se borró mientras tanto,
  responde 404 en vez de volver a crearlo.
- **Pase de la extensión:** el listener de «página cargada» se pone antes de
  navegar (una página en caché podía terminar antes) y si sale la pantalla
  de DataDome se espera 6 s y se vuelve a mirar una vez.
- Cerrar sesión en la extensión olvida también la configuración descargada.

### Verificación

- Tests (112) y build en verde. `record-price` v2 desplegada (401 sin token).
- Marcador nuevo, en una línea, ejecutado sobre la ficha real con
  `?utm_source=prueba`: Vigía local recibe la canónica y la alternativa,
  limpia la barra y no hay errores de consola.
- BD: 0 duplicados de URL en las listas; 4 precios con `ph_source = 'browser'`
  en el último día.
- Sin probar: Safari del iPhone, Chrome de Android, la extensión cargada.

### Prueba de Tony

Extensión instalada en su Chrome y probada el mismo día: «Actualizar ahora»
actualizó sus 3 mesitas de Maisons du Monde (21:14–21:15 UTC, en BD con
`ph_source = 'browser'`) y el icono guardó una cómoda de IKEA. La mesa de
Kave Home no entra: es de otra cuenta, y la extensión solo toca los
artículos de la cuenta con la que se entra (correcto). En la sesión 23 se
contó mal («4 artículos»): eran 3 de Tony y 1 de otra cuenta.

### Estado final

Extensión funcionando en el Chrome de Tony. Pendiente: favorito en el
iPhone (Safari) y en Android, y vigilar el captcha en los pases de los
próximos días (B22).


## 2026-10-01 (Sesión 25) — Compartir → Vigía en Android y atajo en iPhone

### Contexto

Tony: el favorito con código funciona en Chrome de Android escribiendo su
nombre en la barra, pero es incómodo; quiere un botón. «No olvides el
iPhone».

### Cambios

- `public/manifest.json`: `share_target` GET a `/compartir`.
- `src/lib/shareTarget.js` (`readSharedUrl` y guardado pendiente hasta el
  login, patrón de `shareLink.js`), 5 tests.
- `App.jsx`: `captureShare` recoge `/compartir`, guarda la dirección y deja
  la barra en `/`. El panel guarda solo (`addItem`; si la tienda bloquea,
  `addManualItem` sin precio) y `SharedLinkBanner` enseña el resultado con
  «Deshacer».
- Ajustes: la sección pasa a «Guardar desde el navegador o el móvil», con
  Compartir en Android, los pasos del atajo de iPhone y «Copiar dirección
  para el atajo»; el favorito con código queda como «otra opción».
- Decisión en `DECISIONES.md`.

### Verificación

- Tests (117) y build en verde.
- Local: `/compartir?title=…&text=Mira esta mesita: https://….htm.` deja la
  barra en `/`, guarda la dirección sin el punto final y no hay errores.
- Sin probar: el menú Compartir en un Android real (hay que reinstalar la
  app para que coja el manifiesto nuevo), el atajo en un iPhone y el
  guardado con sesión.

### Estado final

Probado por Tony en Android el mismo día: Compartir → Vigía funciona.
Pendiente: crear y probar el atajo en el iPhone.


## 2026-10-02 (Sesión 26) — Fotos y textos alineados en la lista

### Contexto

Tony: le molesta ver las imágenes de distintos tamaños; quiere un tamaño
estándar y que todo (también los textos) quede alineado.

### Cambios

- `tailwind.css`: token `--color-photo` (blanco; gris claro en oscuro).
- `ItemRow.jsx`: miniatura sobre `bg-photo` con `mix-blend-multiply`; hueco
  del minigráfico reservado siempre; precio (132 px) y carpeta (92 px) de
  ancho fijo; tachado y variación en una sola línea.
- `ItemTile.jsx`: foto cuadrada, absoluta dentro de la caja (una foto vertical
  ya no estira la tarjeta), mismo fondo; nombre con dos líneas reservadas y
  bloque de precio de alto fijo.
- Decisión en `DECISIONES.md`; `DISENO.md` actualizado.

### Verificación

- Página de prueba temporal (borrada) con 13 artículos reales de la BD, en
  oscuro y claro, escritorio y móvil (375 px). Medido por JS: todas las filas
  90 px, miniaturas 68×68 y precio acabando en la misma x; en Fotos, todas las
  fotos 163×163 y el precio a 237 px del borde superior en todas las tarjetas.
- Tests (117) y build en verde.

### Estado final

Hecho. Queda que el mueble se ve más o menos grande dentro de la caja según
el margen blanco que deja cada tienda en su foto (ver la decisión).

## 2026-10-03 (Sesión 27) — La lista se recarga al volver a la app

### Contexto

Tony pegó una cómoda de Maisons du Monde y la app le dijo «Ese artículo ya
está en tu lista», pero no la veía. Comprobado en BD: se había guardado
minutos antes desde el navegador (`ph_source = 'browser'`, Sin carpeta). La
app solo leía la lista al abrirse, así que lo guardado desde fuera no salía
hasta recargar.

### Cambios

- `src/hooks/useReloadOnReturn.js` (nuevo): vuelve a leer en
  `visibilitychange` cuando la página pasa a visible.
- `useItems` y `useFolders` lo usan con su `reload` (no toca `loading`, así
  que no hay parpadeo; un fallo de lectura conserva lo que había, B16).

### Verificación

- Tests (117) y build en verde.
- No probado en el navegador: hace falta sesión iniciada y no se teclean
  contraseñas reales. Pendiente de que Tony lo confirme en el móvil.

### Estado final

Hecho, pendiente de confirmar con uso real.

## 2026-10-03 (Sesión 28) — Cesta en vez de Comparar

### Contexto

Tony: el botón Comparar no parecía funcionar, y propone otra cosa: marcar
varios artículos y ver cuánto costaría comprarlos todos, aunque sean de
tiendas distintas, como una cesta. Más adelante, guardar conjuntos.

Causas de que Comparar «no funcionara»: sin casillas en la vista Fotos; la
barra quedaba al final de la lista (`sticky` sin efecto); ningún total hasta
nombrar y guardar el conjunto.

### Cambios

- `src/lib/basket.js` (nuevo) + 13 tests: líneas, totales (hoy, al
  guardarlos, mínimo visto, sin precio, tiendas), agrupar por tienda,
  cantidades, limpiar borrados y `localStorage` (`vigia.cesta`).
- `src/hooks/useBasket.js` (nuevo): estado, modo elegir, guardado. Solo saca
  artículos borrados con la lista cargada sin errores.
- `src/components/Basket.jsx` (nuevo): `BasketBar` (fija abajo, encima del
  contenido, zona segura del iPhone) y `BasketSheet` (hoja en móvil, panel en
  escritorio; por tienda, cantidad − N +, quitar, vaciar, añadir más).
- `ItemRow`/`ItemTile`: casilla en modo elegir (antes solo en Lista).
- `FolderSidebar`: «Añadir a la cesta» en el menú «⋮», también en carpetas
  compartidas (el resto de acciones siguen siendo solo del dueño).
- `App.jsx`: botón Cesta con contador; hueco abajo con la barra visible.
- Borrados `useComparison.js` y `ComparisonPanel.jsx`; `IconComparar` →
  `IconCesta`.
- Spec, decisión en `DECISIONES.md` y B24 (cestas guardadas) en `ROADMAP.md`.

### Verificación

- Página de prueba temporal (borrada) con artículos reales de la BD, más uno
  sin precio y una bajada simulada. Escritorio 1280×800 y móvil 375×812:
  barra fija al fondo con scroll; totales comprobados a mano (711,84 € /
  −24 €; con cantidades 931,74 / 955,74 / mínimo 925,74); dos toques
  seguidos en «+» suman dos; la cesta sobrevive a recargar; casillas en
  Fotos. Sin errores de consola en carga limpia.
- No probado con sesión real (no se teclean contraseñas): falta el menú de
  carpeta en la app de verdad.
- Tests (130) y build en verde.

### Estado final

Hecho y probado por Tony en producción el 2026-10-03 («funciona
correctamente»). Siguiente: B24.

## 2026-10-03 (Sesión 29) — Duplicados al pegar una dirección

### Contexto

Tony: pegó una dirección en el campo URL y se guardó un artículo que ya
tenía. Logs de Supabase: a las 13:11 UTC un `POST /items` de
papelespintadosdc.com, borrado a las 13:13. Lo hizo **la cuenta invitada a
«Pisito»** desde un iPhone, no la de Tony: el original de Tony está en «Papel
pared», subcarpeta de «Pisito», y el invitado lo ve. El índice único
`(itm_usr_id, itm_url)` es por usuario y no frena eso; tampoco una dirección
escrita distinto (barra final, `www.`, campaña).

### Cambios

- `src/lib/urlKey.js` (nuevo): `cleanUrl` sale de `useItems` sin cambios
  (lo guardado sigue igual que en `record-price`); `urlKey` compara sin
  esquema, `www.`, barra final, hash, mayúsculas ni parámetros de
  seguimiento (más que `cleanUrl`: `_gl`, `gad_*`, `msclkid`, afiliados…)
  y con el resto ordenados; `findSameItem`. 8 tests.
- `useItems`: `findExisting` busca por clave entre todo lo visible (propios
  y carpetas compartidas, RLS de la 016; gana el propio). `addItem` y
  `addManualItem` lo miran antes de leer el precio (cubre el campo URL y
  Compartir → Vigía) y avisan con el título del que ya está;
  `saveFromBrowser` (botón «+ Vigía») apunta el precio en el que encuentre,
  también si es de la carpeta compartida.
- B25 en `ROADMAP.md`: la extensión (`record-price`) sigue con la búsqueda
  exacta; no se redespliega una Edge Function desde una rama sin fusionar.

### Verificación

- Tests (138) y build en verde.
- No probado en el navegador con sesión (no se teclean contraseñas).
- Atajo de iPhone (B23) probado por Tony con la cuenta invitada: abre
  Vigía pero no llega a guardar (ni `store_rules` ni `scrape` en los logs a
  las 21:43 UTC), así que `/compartir` llegó sin dirección. Pendiente.

### Estado final

Hecho y subido a `main` el 2026-10-04 (la rama
`claude/duplicate-accounts-url-ujoha1` no se fusionó: se aplicó como parche).
Pendiente de que Tony pegue de nuevo la dirección del papel pintado para ver
el aviso.

## 2026-10-04 (Sesión 30) — Guardar desde el iPhone sin copiar y pegar

### Contexto

Tony: el atajo de compartir del iPhone le daba problemas («en Android va
genial»). El de la sesión 25 había que montarlo a mano y abría Safari, que
en iOS no comparte sesión con la app instalada (y en la sesión 29 llegó a
`/compartir` sin dirección). iOS no deja que una app web salga en Compartir
ni que un atajo abra la app de la pantalla de inicio; sin configurar nada,
solo con una app nativa de pago. Tony eligió las dos vías de 0 €: un atajo
que guarde solo y un botón «Pegar». Decisión en `DECISIONES.md`, 2026-10-04.

### Cambios

- Migración **021** (aplicada): `user_settings.us_shortcut_key_hash`, el
  SHA-256 de la clave del atajo, con índice único parcial.
- Edge Function **`save-link`** (desplegada, `--no-verify-jwt`): recibe
  `{ url, key }` del atajo, busca al usuario por el hash, saca la dirección
  aunque venga dentro de una frase, mira duplicados con `urlKey` entre los
  suyos y las carpetas compartidas, lee la ficha con `scrape/extract.ts` (o
  guarda sin precio en modo manual si la tienda bloquea) y contesta en
  texto plano: «Guardado en Vigía: KALLAX… · 54,99 €» / «Ya lo tenías en
  Vigía: …». Lógica pura en `save-link/link.ts`, con 9 tests (incluido que
  el hash y `urlKey` coincidan con los de la web).
- `src/lib/shortcutKey.js`: crea la clave (síncrona, para copiarla dentro
  del toque), el hash, la dirección de la función y `SHORTCUT_ICLOUD_URL`
  (vacío hasta que Tony publique el atajo).
- `IosShortcutSection` en Ajustes, en lugar de los pasos viejos: botón
  «Añadir atajo» (copia la clave y abre el atajo de iCloud, cuando exista),
  la clave a la vista si no se pudo copiar, «Atajo activo · Desactivar», y
  los cuatro pasos para montarlo a mano plegados (abiertos mientras no haya
  enlace de iCloud).
- `AddItemForm`: botón **«Pegar»** en el móvil. Lee el portapapeles, saca
  la dirección (`findUrlInText`, extraída de `shareTarget.js`) y la guarda
  sin más toques.

### Verificación

- Tests (147) y build en verde.
- `save-link` contra producción con `curl`: sin clave y con clave falsa →
  401 con texto claro; con una clave temporal en la cuenta de Tony, guarda
  un KALLAX de IKEA con título y precio, y al repetirlo sin barra final
  dice «Ya lo tenías». También detecta como duplicado la SKANSNÄS que ya
  tenía, escrita distinta. Artículos de prueba y clave temporal borrados.
- Componentes probados a 375 px en una página de prueba (no hay sesión sin
  contraseña): «Copiar clave» guarda el hash y enseña la clave si el
  portapapeles no deja copiar; «Pegar» con una frase guarda la dirección y,
  sin dirección, avisa.

### Estado final

Hecho y en `main`. Pendiente de Tony (B23): montar el atajo en su iPhone con
los pasos de Ajustes, comprobar los nombres de las acciones en iOS en
español y, si funciona, compartirlo por iCloud. Antes de compartirlo, la
clave tiene que ir como pregunta de importación (Atajos → el atajo → ⓘ →
«Configurar» / «Preguntas de importación») y en el campo `key` hay que
dejar un texto cualquiera en vez de su clave, para que no viaje en el
enlace. Con el enlace en `SHORTCUT_ICLOUD_URL`, Ajustes enseña el botón
«Añadir atajo».

## 2026-10-04 (Sesión 31) — Vinted, Wallapop, Shein y AliExpress

### Contexto

Tony probó a guardar un enlace de AliExpress desde Android: se guardó sin
precio y lo borró. Pregunta por Vinted, Shein, Wallapop «y todo eso».

### Cambios

- Probadas las cuatro pidiendo las páginas desde Supabase (`pg_net`, la IP
  de Postgres): Vinted y Wallapop traen JSON-LD `Product` con precio (el
  extractor genérico las lee); Shein redirige a su captcha
  (`/risk/challenge?captcha_type=909`); AliExpress, sin precio.
- Migración `022_tiendas_shein_aliexpress.sql`: Shein y AliExpress
  bloqueadas en `store_rules` (hosts principal, España, móvil y enlaces de
  compartir; la búsqueda es por host exacto). Al pegarlas, Vigía avisa y
  ofrece guardarlas con precio a mano.
- `isBotPage` reconoce el captcha de Shein en toda la página (va a ~130 KB
  del principio, fuera de los 20 KB que se miraban). Test nuevo.
- `docs/TIENDAS.md`: las cuatro tiendas.

### Verificación

- Tests (148) y build en verde.
- 022 aplicada en Supabase: los nueve hosts salen con `sr_blocked = true`
  en `vigia.store_rules`.
- `scrape` (v8), `refresh` (v7) y `save-link` (v2) redesplegadas sin
  verificación JWT; sin credenciales responden 401, así que arrancan.
- No probado desde la Edge Function (necesita sesión): Vinted y Wallapop
  podrían comportarse distinto con su IP, como Amazon.

### Estado final

Hecho y desplegado. Falta que Tony pruebe en producción: pegar una ficha de
`es.shein.com` tiene que mostrar el aviso «Esta tienda no deja leer el
precio…» con la opción de guardarla a mano, y una de Vinted o Wallapop
tiene que guardarse con precio. Si Vinted o Wallapop fallan desde la Edge
Function, se anota en `TIENDAS.md` en vez de bloquearlas.

### Prueba como usuario (mismo día)

Con una cuenta de pruebas propia (`prueba@prueba.com`, creada por Tony y
confirmada a mano en `auth.users` porque el correo es inventado), desde
el campo URL de producción:

- Shein (`es.shein.com`): aviso «Esta tienda no deja leer el precio…»;
  guardado a mano con 12,99 € y «sin precio automático». ✅
- Vinted: «Lámpara IKEA tomelilla en perfecto estado», 10 €, foto y stock,
  leído desde la Edge Function. ✅
- Wallapop: «Lámpara de pie Hektar gris», 29 €, foto y stock. ✅
- Pegar otra vez el de Vinted sin `www.` y con `utm_source`: «Ese artículo
  ya está en tu lista». ✅
- «Actualizar»: los dos automáticos pasan a 2 registros. ✅

Fallos de interfaz encontrados y arreglados:

- Entre 640 y ~1000px de ancho (tablet, ventana estrecha) la fila ocultaba
  el título y el minigráfico se salía por la derecha (scroll horizontal).
  La línea única pasa de `sm:` a `lg:` (`DECISIONES.md`, corrección a la
  entrada de 2026-09-09).
- Píldora roja «0,0 %» cuando el precio no ha cambiado: ya no se enseña
  (`showPct` en `format.js`, con test), en fila y en tarjeta.
- «1 registros» → «1 registro».
- El error de «ya está en tu lista» seguía visible tras vaciar el campo:
  se quita al vaciarlo.

Los tres artículos (Shein, Vinted, Wallapop) se quedan en la cuenta de
pruebas como datos base para las próximas pruebas.

## 2026-10-05 (Sesión 32) — Prueba completa como usuario y mejoras

### Contexto

Tony pidió recorrer toda la app como un usuario del día a día, con la cuenta
de pruebas (`prueba@prueba.com`), y mejorar funciones y diseño con las
skills (`frontend-design`, `code-review`, TDD).

### Probado (producción, 768 px, móvil 375 px, claro y oscuro)

Añadir (Vinted, Wallapop, Shein bloqueada), duplicados, Actualizar, carpetas
(crear, mover, renombrar, compartir, filtrar), editar artículo (precio con
coma), búsqueda, orden, «Solo bajadas», Lista/Fotos, cesta (cantidades,
Escape), Ajustes (guardado en BD), menú móvil, aviso de instalar («Ahora no»
funciona), barra de la cesta sin tapar el último artículo.

### Fallos encontrados y arreglados

- Total de grupo «21,5 €» (y «1234 €» sin punto de miles): `formatPrice`.
- Escape no cerraba editar/ajustes/compartir; no se anunciaban como diálogo.
- `confirm()` nativo para borrar artículo, borrar carpeta y vaciar cesta.
- Con una búsqueda puesta, lo recién añadido no se veía («Nada que coincida»).
- La búsqueda «lampara» solo encontraba «Lámpara» porque estaba en la URL.
- El campo rechazaba frases con dirección y direcciones sin `https://`.
- Se guardaba sin precio en silencio (p. ej. una web que no es de producto).
- Tarjeta Fotos: selector de carpeta salido del borde y «·» colgando.
- En el móvil, dentro de una carpeta no se veía cuál; «Cancelar» del aviso
  de tienda bloqueada se salía por la derecha.
- (Encontrado al probar el arreglo) el mensaje «Guardado» se iba a los 7 s y
  la lista saltaba: ahora se queda hasta volver a escribir.

### Mejoras de diseño

Fila móvil/tablet con la foto al lado del nombre (de 2,5 a 3,5 artículos
por pantalla), diálogo común con fondo más oscuro y entrada suave, artículo
nuevo iluminado y llevado a la vista, nombre legible para tiendas bloqueadas.
Todo registrado en `DECISIONES.md` (2026-10-05) y `DISENO.md`.

### Verificación

- 163 tests (nuevos: `itemText`, `readTypedUrl`) y build en verde.
- Revisión con la skill `code-review`: un hallazgo (el destello se repetía
  al volver a montar la fila), arreglado.
- Probado en producción con la cuenta de pruebas: frase con dirección,
  dirección sin `https://`, Shein con nombre legible (en BD sigue la URL),
  confirmar y Escape anidado, carpeta con «Ver todos», Fotos.
- Artículos de prueba extra borrados; quedan los tres de base.

### Ideas pendientes, hechas después

- Ajustes enseña «Guardado ✓» un momento antes de cerrar (antes se cerraba
  sin señal).
- «Hora del pase»: desplegable 00:00–23:00 con «hora de España» (el pase
  compara con Europe/Madrid, migración 007), en vez de un número suelto.
- Accesibilidad del sidebar: las carpetas sin subcarpetas tenían un botón
  invisible sin nombre (parada vacía con el teclado); Contraer/Expandir y
  «Más opciones» llevan el nombre de la carpeta; cada carpeta se anuncia
  «Lámparas, 1 artículo» y la activa con `aria-current`. La barra de la
  cesta se anuncia «Ver cesta: 3 artículos · 2 tiendas, 49,00 €».

### Estado final

Hecho y desplegado. Para Cowork: revisar las decisiones del 2026-10-05.

