# Log de progreso — Vigía

> Solo el log de sesiones. Para qué hay pendiente y qué viene: `docs/ROADMAP.md`.
> Cuando este archivo pase de ~100 KB, mover lo antiguo a `PROGRESO-ARCHIVO.md`
> (sesiones 1 a 16 ya están allí).

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



## 2026-10-05 (Sesión 33) — Duplicados desde la extensión (B25) y el IKEA sin precio (B19)

### Contexto

Tony pidió las dos mejoras pendientes más directas del backlog: B25 y B19.

### Cambios

- **B25:** `record-price` buscaba el artículo por `itm_url` exacta, así que
  la extensión duplicaba lo que la web ya reconoce como lo mismo (barra
  final, `www.`, mayúsculas, `gad_source` y demás). Nueva `findOwnItem` en
  `record-price/record.ts`: compara por `urlKey`, importada de
  `save-link/link.ts` (ya tiene un test que la iguala a la de la web; así no
  hay una tercera copia). Si había duplicados de antes, gana el de la
  dirección exacta. Solo busca entre los artículos del propio usuario, como
  antes. El pase diario va por id y no cambia.
- **B19:** no había nada que arreglar. El ÄNGSJÖN / BACKSJÖN (cuenta
  `b0b504b9`) falló una vez en el pase del 2026-09-29; volvió a leerse ese
  mismo día y lleva 7 lecturas seguidas a 437 €. La ficha real da 437 € en
  el JSON-LD y en la página, y no aparece ningún 555 € (la cifra de la nota
  estaba mal).
- `PROGRESO.md` pasaba de 100 KB: sesiones 1 a 16 movidas a
  `PROGRESO-ARCHIVO.md` (regla anti-deriva).
- Nuevo en el backlog, visto de pasada: **B26**, el Vinted de la cuenta de
  pruebas da «No se encontró el precio» en el pase del servidor.

### Verificación

- TDD: 4 tests de `findOwnItem` en rojo y luego en verde; 167 tests y build
  en verde.
- `record-price` v3 desplegada sin verificación JWT (401 sin token).
- En producción, con la cuenta de pruebas: la Shein guardada, mandada como
  `http://ES.shein.com/…html/?gad_source=1&utm_campaign=prueba#galeria`,
  devuelve `created: false` con el id del artículo que ya había. Siguen 3
  artículos; el punto de histórico de la prueba se borró.

### Estado final

Hecho y desplegado. Queda abierto que la extensión cree un artículo propio
cuando ese artículo ya está en una carpeta compartida por otro (decisión
para Cowork si llega a molestar).


## 2026-10-06 (Sesión 34) — Vinted «sin precio»: el artículo estaba vendido (B26)

### Contexto

Tony pidió mirar B26: el Vinted de la cuenta de pruebas daba «No se encontró
el precio en la página» en el pase del servidor.

### Investigación

- Se reproducía siempre (4 de 4 llamadas a `scrape`): la ficha llegaba
  entera (título, foto), sin bloqueo, pero sin JSON-LD ni metadatos de precio.
  Lo mismo desde `pg_net`, así que no era la IP.
- Primera hipótesis, que Vinted había quitado el JSON-LD de todas sus fichas:
  descartada. Otras 6 fichas sacadas del catálogo lo siguen trayendo.
- La diferencia: en la nuestra `can_buy` e `instant_buy` son `false`, faltan
  los bloques `buy`/`make_offer`/`ask_seller` y aparece `buyer_item_status`
  con `"title":"Vendido"`. En la ficha, a la vista: «Vendido». La sesión 31
  supuso que al venderse la ficha desaparece; no es así.
- El precio sigue en los datos de React (`self.__next_f.push`), con las
  comillas escapadas: `"id":"10247399138",…,"price":{"amount":"10",…}`. Por
  eso el último recurso genérico (`"price": 10`) no lo cogía.

### Cambios

- `scrape/extract.ts`, caso Vinted en `domainSpecific`: si no hay precio,
  lo saca del objeto con el id de la URL (sin cruzar el comienzo de otro
  objeto, para no coger el de otro artículo de la página), y si el lateral
  lleva `buyer_item_status` de ese id, `inStock: false`.
- Desplegadas `scrape` v9, `refresh` v8 y `save-link` v3 (las tres usan el
  extractor; lo único que cambia respecto a lo desplegado es esto y lo de
  la sesión 33).
- `TIENDAS.md` (Vinted) y backlog: B26 cerrado, **B27** nuevo (la lista no
  enseña «Vendido»/«sin stock»; decisión de diseño para Cowork).

### Verificación

- TDD: 5 tests nuevos (precio del artículo de la URL, decimales, nunca el
  de otro artículo, vendido sin stock, aviso de otro artículo no cuenta),
  en rojo y luego en verde; 172 tests y build en verde.
- Con el HTML real (2 MB): la vendida da 10 € sin stock en ~50 ms; una
  normal sigue saliendo por JSON-LD (15 €, en stock).
- En producción con la cuenta de pruebas: `scrape` da 10 €/sin stock para la
  vendida, 15 €/en stock para otra y Wallapop 29 € igual; «Actualizar»
  (`refresh`) da `updated: 2, failed: 0` y el Vinted queda sin error y con
  `itm_in_stock = false`. `save-link` responde 401 sin clave.

### Estado final

Hecho y desplegado. Pendiente para Cowork: B27.


## 2026-10-06 (Sesión 35) — Vendido / sin stock en la lista (B27)

### Contexto

Tras B26 un Vinted vendido quedaba con `itm_in_stock = false`, pero la
interfaz no lo enseñaba. Tony pidió hacerlo en Claude Code en vez de esperar
a Cowork: decisiones en `DECISIONES.md` (2026-10-06) para revisarlas.

### Cambios

- `stockLabel` (`src/lib/itemText.js`): «Vendido» en Vinted/Wallapop, «Sin
  stock» en el resto; null si hay stock o no se sabe.
- `ItemRow` y `ItemTile`: foto en gris y apagada, precio en gris, píldora en
  el sitio de la variación, franja gris.
- Cesta (`basket.js`, `Basket.jsx`): lo vendido no suma (`unavailable` en
  `basketSummary`, fuera del subtotal de su tienda), precio tachado con la
  píldora, «+N sin stock» en la barra y nota abajo. Sin subtotal en un
  grupo donde nada suma (salía «0,00 €»).
- Totales de grupo y de la lista (`itemsTotal` en `itemGroups.js`): tampoco
  suman lo vendido. Antes «Sin carpeta» decía 21,50 € con la lámpara vendida
  dentro; ahora 11,50 €.
- «Copiar para Claude»: «10,00 € · Vendido».
- `DISENO.md`: franja gris y fila «Vendido / sin stock».

### Verificación

- TDD: tests de `stockLabel` (3), cesta (2), `itemsTotal` (2) y
  `itemToText` (2, archivo nuevo); 181 tests y build en verde.
- En producción con la cuenta de pruebas: Lista y Fotos en oscuro, cesta en
  móvil (375 px) en claro. El Vinted sale apagado con «Vendido», la barra
  dice «3 artículos · 2 tiendas · +1 sin stock» con 29,00 € (solo Wallapop),
  el detalle lo tacha y explica que no suma, y «Sin carpeta» suma 11,50 €.

### Documentación al día (mismo día, a petición de Tony)

Repaso de todos los `.md`: `ARQUITECTURA.md` (duplicados en `record-price`,
qué se hace con `itm_in_stock`), `extension/README.md` (duplicados),
`supabase/functions/scrape/README.md` (reescrito: decía «copia sin cambios» y
«`pg_net` no portado»; ahora el orden de búsqueda, Vinted vendido y que
cambiarlo obliga a redesplegar tres funciones), `README.md` (ya no «en
reconstrucción»; tabla de documentos completa), `supabase/migrations/README.md`,
spec de la cesta (lo vendido no suma) y `WORKFLOW.md` (excepciones acordadas:
Claude Code decide cuando Tony se lo pide y cierra él los `.md`).

### Estado final

Hecho y desplegado. Para Cowork: revisar la decisión del 2026-10-06.

## 2026-10-06 (Sesión 36) — Sklum salía «Sin stock» sin estarlo (B28)

### Contexto

Tony veía artículos en gris como sin stock que en la tienda se podían
comprar. Revisado con sus datos reales: los 5 marcados eran de Sklum (4 en
`tonyysj@`, 1 en `antonio.secojimenez@`).

### Causa

Sklum publica en su JSON-LD `availability: BackOrder` para lo que tarda en
llegar («Entrega estimada entre el 03/11 y el 05/11»). En schema.org eso es
«se puede pedir, se entrega más tarde». El extractor del servidor
(`offerPrice` en `scrape/extract.ts`) solo daba por disponible
`InStock|LimitedAvailability|PreOrder|OnlineOnly` y **todo lo demás lo
guardaba como `false`**, así que BackOrder acababa en «Sin stock» (B27 lo
pinta en gris y no lo suma).

### Cambios

- `availabilityInStock` en `scrape/extract.ts`: sin stock solo con
  `OutOfStock|SoldOut|Discontinued`; en stock también `BackOrder`,
  `PreSale` y `MadeToOrder`; lo que no se reconoce (p. ej. `InStoreOnly`)
  queda sin dato en vez de «sin stock».
- Mismo criterio en la extensión (`extension/extract.js`) y el botón de
  marcadores (`src/lib/browserImport.js`), que ya eran de tres estados pero
  dejaban BackOrder sin dato.
- Redesplegadas las tres funciones que usan el extractor: `scrape` v10,
  `refresh` v9 y `save-link` v4 (por el conector de Supabase; lo subido de
  `scrape` comparado con el fichero local).

### Verificación

- TDD: 11 casos de disponibilidad en `extract.test.ts` (4 fallaban antes) y
  uno de BackOrder en la extensión y en el marcador; 194 tests en verde.
- Con el HTML real de la mesita Abrams de Sklum: 94,95 €, `inStock: true`.
- En producción con las cuentas de Tony: los 5 artículos se marcaron como
  pendientes y se lanzó `refresh` igual que el cron (`net.http_post` con el
  secreto del vault): 5 leídos, 0 fallos, los 5 con `itm_in_stock = true` y
  el mismo precio. Ninguna cuenta suya queda con artículos sin stock. Sin
  avisos de «vuelve a haber stock» (0 dispositivos suscritos).

### Estado final

Hecho, desplegado y verificado con datos reales.

## 2026-10-09 (Sesión 37) — Amazon sin precio con el enlace corto de la app (B29)

### Contexto

Tony añadió una mesa de centro de Amazon y se quedó sin precio ni foto, con
el título acabado en «: Amazon.es: Hogar». La pegó desde la app de Amazon,
que comparte enlaces cortos: `https://amzn.eu/d/0dkUtoav`.

### Causa

Todo lo específico de Amazon en `scrape/extract.ts` (salir por `pg_net`, el
control del interstitial sin `productTitle`, leer precio, foto y stock del
HTML) se activa con `/amazon\./` sobre el host de la URL **pegada**. Con
`amzn.eu` no se activaba nada: el `fetch` seguía la redirección hasta la
ficha, pero se leía como una página cualquiera (Amazon no tiene JSON-LD),
así que solo salía el `<title>`. Además se guardaba `amzn.eu` como
dirección: la tienda se veía como «amzn.eu» y ni la comparación de
duplicados ni la extensión la reconocían como la ficha de Amazon.

### Cambios

- `expandShortLink` en `scrape/extract.ts`: para `amzn.eu`, `amzn.to`,
  `amzn.com`, `amzn.asia` y `a.co` sigue la redirección (GET con
  `redirect: "manual"`; a HEAD amzn.eu responde 404) y deja la ficha de
  Amazon como `/dp/ASIN`, sin los parámetros de compartir. Si falla, la
  dirección queda como estaba. `extractFromUrl` la usa siempre, así que
  `refresh` también lee bien los enlaces cortos ya guardados.
- `scrape` expande antes de mirar `store_rules` y devuelve `url`; la web
  (`useItems.addItem`) guarda esa dirección y vuelve a comprobar duplicados
  con ella. `save-link` (atajo de iOS) expande antes de comparar y guardar.
- Desplegadas con la CLI (`--no-verify-jwt --use-api`): `scrape`, `refresh`
  y `save-link`.

### Verificación

- TDD: 4 tests de `expandShortLink` con `fetch` simulado (fallaban antes);
  198 tests y build en verde; CI en verde.
- El enlace real redirige a `https://www.amazon.es/dp/B0GWHLD5NG`. Con el
  HTML completo de esa ficha el extractor da 185 €, en stock, título del
  producto y foto. Una petición desde la máquina local recibió una versión
  recortada sin precio (Amazon varía la respuesta); en producción Amazon va
  por `pg_net`.
- **No verificado en producción**: la sesión de la cuenta de pruebas había
  caducado en el navegador integrado y no se permitió tocar el artículo de
  Tony por SQL. El artículo existente sigue con `amzn.eu`, sin foto ni
  precio: Tony tiene que borrarlo y volver a pegar el enlace (o pulsar
  Actualizar, que lee el precio pero no cambia dirección, título ni foto).

### Segunda parte: sigue sin precio (Amazon lo ve desde Irlanda)

Tony la volvió a añadir: dirección, título, foto bien; precio no. En la
respuesta guardada por `pg_net` (`net._http_response`) se ve «Enviar a
**Irlanda**» y «No disponible.»: la BD está en `eu-west-1` y esa mesa no se
envía a Irlanda, así que Amazon no enseña precio. Desde España, 185 €.

- Probado: fijar «Enviar a 28001» (modal de ubicación → `address-change`)
  deja la ubicación en dos cookies, `session-id` + `ubid-acbes`, que duran
  un año. Mandadas como `Cookie` en un `net.http_get` desde la BD, Amazon
  responde «Madrid 28001» con la zona de precio completa.
- `pg_net` solo guarda una cabecera `set-cookie`, así que el cambio de
  ubicación no se puede hacer entero desde la BD. Desde una Edge Function
  (función temporal `amazon-probe`, ya borrada) la portada de Amazon pasa
  solo a veces (1 de 7); reintentar hasta que pase es saltarse su anti-bot y
  se descartó.
- Segundo fallo arreglado: en esa ficha Amazon deja **vacío** el
  `a-offscreen` del precio y el extractor se quedaba con el hueco. Ahora
  solo vale con cifras y si no, sigue a `a-price-whole` + `a-price-fraction`
  (2 tests; 200 en verde). `scrape`, `refresh` y `save-link` redesplegadas.

### Estado final

Enlace corto y precio vacío arreglados y desplegados. **Pendiente de
decisión (B29 sigue abierto):** cómo dar a Amazon una ubicación española de
forma estable — guardar en BD un par de cookies con «Enviar a 28001»
(sacadas una vez, renovar al año; tabla sin `user_id`, excepción a la regla
`_own`: para Cowork) o pasar Amazon a la extensión de Chrome.

### Tercera parte: «Failed to fetch» en la extensión

Tony mandó el error de `chrome://extensions`: `Uncaught (in promise)
TypeError: Failed to fetch` en `api.js` (`authRequest`, renovar la sesión).
Es un fallo de red puntual (el servidor de Auth respondía bien al mirarlo),
pero la extensión no lo recogía: en la alarma quedaba como error sin
capturar, y si pasaba al abrir el icono el popup no recibía respuesta y se
quedaba en blanco.

- `api.js`: `netFetch` convierte el fallo de red en «No hay conexión con
  Vigía. Revisa la conexión y vuelve a probar.».
- `background.js`: la alarma y el login capturan el error de
  `runPassIfDue` (se reintenta en la siguiente alarma); los mensajes del
  popup responden siempre, con `{ error }` si algo falla.
- `popup`: enseña ese error en vez de quedarse en blanco. Versión 1.0.1;
  hay que recargarla en `chrome://extensions`.

### Cuarta parte: la extensión no lee Amazon y tres copias de la mesa

Tony probó la extensión en la ficha («No encuentro el precio en esta
página») y añadió la mesa pegando otras dos direcciones: tres artículos
(`/dp/B0GWHLD5NG`, la misma con `?th=1` y la larga del buscador), ninguno
con precio (el servidor sigue viéndola desde Irlanda).

- **Mismo artículo por ASIN en Amazon:** `amazonProduct` en
  `src/lib/urlKey.js` y su copia en `save-link/link.ts` (que `record-price`
  importa). `cleanUrl` guarda las fichas de Amazon como `/dp/ASIN` y
  `urlKey` las compara así: la web, el atajo de iOS y la extensión ya no
  duplican la misma ficha.
- **La extensión lee Amazon** (`extension/extract.js`, versión 1.0.2): precio
  de la zona `corePriceDisplay` (a-offscreen con cifras, si no
  a-price-whole + a-price-fraction), título, foto `data-old-hires` y stock
  de `#availability` («Envío en N días» cuenta como disponible). Probado con
  la ficha real abierta en el navegador integrado: 185 €, título y foto.
  El botón de marcadores (`browserImport.js`) **no** lleva aún lo de Amazon.
- Tests: 210 en verde. `record-price` y `save-link` redesplegadas.
- Las tres copias siguen en la lista de Tony (no se permitió borrar por
  SQL): tiene que borrar dos desde la app.

### Quinta parte: que todo funcione igual (decisión de Tony)

Tony: «todo debe funcionar; si algo no va, que vaya otra cosa».
`DECISIONES.md` 2026-10-09.

- **Botón de marcadores** (`browserImport.js`): lee Amazon igual que la
  extensión. Probado con el código compactado sobre la ficha real en el
  navegador integrado: 185 €, en stock, título y foto.
- **Relevo servidor → Chrome:** el pase de la extensión (`chromeItemsPath`
  en `api.js`) lee también lo propio sin precio o con error en el servidor.
  Lo añadido sin precio se lee una vez en la hora siguiente
  (`readNewWithoutPrice`, ids intentados en `triedNew`). Captcha de Amazon
  reconocido como bloqueo. `host_permissions` + `www.amazon.es` (pedir
  `https://*/*` lo paró el sistema de permisos: decisión de Tony).
  Extensión 1.1.0.
- Tests: 216 en verde; build en verde.

- Tony lo probó: la mesa ya tiene precio. Aprobó el permiso para cualquier
  tienda: `host_permissions` con `https://*/*`, extensión 1.2.0.

### Estado final

Hecho, subido y probado por Tony con la mesa de Amazon. Tiene que recargar
la extensión para la 1.2.0 (Chrome puede pedir aceptar el permiso nuevo).

## 2026-10-10 (Sesión 38) — Limpieza de CLAUDE.md y WORKFLOW.md

### Contexto

Auditoría de los archivos de instrucciones (`/claude-api prompt-audit`).
El «Estado actual» de `CLAUDE.md` se había convertido en un log de sesiones
de ~80 líneas (contra su propia regla anti-deriva) y se contradecía: fase 6
«en curso» y «cerrada», B10 abierto y cerrado, InstallBanner pendiente y
arreglado. `WORKFLOW.md` decía en dos sitios cosas distintas sobre quién
cierra la sesión.

### Cambios

- `CLAUDE.md`: «Estado actual» reducido a fases, producción, última sesión
  y punteros a `ROADMAP.md` / `DECISIONES.md` / `PROGRESO.md`. Antes se
  comprobó que todos los pendientes que se quitaban (B17, B22, B23, B24,
  B29) están en `ROADMAP.md`; el «Ahora no» de InstallBanner ya se vio
  funcionar en la sesión 32.
- `CLAUDE.md`: regla del schema `public` actualizada (vacío desde la
  migración 014); árbol con `AddItemForm` y las seis Edge Functions; prefijos
  `shr` (`folder_shares`) y `psub` (`push_subscriptions`); RLS por
  `<prefijo>_usr_id` en vez de `user_id`; el paso 4 de inicio de sesión
  recoge la excepción de «decide tú».
- `WORKFLOW.md`: «Al cerrar» dice ahora que Claude Code escribe
  `PROGRESO.md`, `ROADMAP.md` y la línea de estado y hace commit y push,
  igual que la excepción de la sesión 32.

- Sin Cowork (decisión de Tony): `WORKFLOW.md` reescrito para un solo
  entorno (Claude Code decide lo técnico, pregunta a Tony lo de producto y
  lo escribe en `DECISIONES.md`); referencias quitadas de `CLAUDE.md`.
  Revisadas y mantenidas las tres decisiones que esperaban a Cowork
  (2026-10-05, 2026-10-06, 2026-10-09). B18 decidido por Tony: avisar a
  todos los de la carpeta (falta implementarlo).
- Auditoría periódica: `/claude-api prompt-audit` cada 10 sesiones o con
  un modelo nuevo; test `claudeMd.test.js` en el CI que falla si el
  «Estado actual» pasa de 15 líneas o el `CLAUDE.md` de 250.

### Segunda parte: carpetas compartidas editables por el invitado (B30)

Tony vio que solo el dueño podía renombrar o crear subcarpetas en una
carpeta compartida. Migración `023_carpetas_compartidas_editables.sql`:
políticas de `folders` abiertas a quien ve la carpeta (insertar
subcarpeta, renombrar, borrar subcarpeta) y trigger `guard_folder_tree`
(la subcarpeta es del dueño del padre, el dueño no cambia, solo el dueño
mueve). Borrar la de primer nivel y compartir siguen siendo del dueño.
`FolderSidebar` enseña renombrar y «Nueva subcarpeta» en las compartidas, y
renombrar/borrar en sus subcarpetas.

- Probado en producción dentro de una transacción deshecha, como invitado:
  crear subcarpeta (queda a nombre del dueño), renombrar raíz y subcarpeta,
  borrar subcarpeta: sí. Mover una subcarpeta a una carpeta propia,
  quedársela, crear en una carpeta no compartida, crear una raíz a nombre de
  otro, renombrar una no compartida, borrar la raíz compartida: no. Sin
  restos tras deshacerla. Advisors sin avisos nuevos.
- Tests: 219 en verde; build en verde.
- No probado en la interfaz con dos cuentas reales: la cuenta de pruebas
  no tiene una carpeta compartida de otro.

### Estado final

Hecho, desplegado (migración 023 aplicada; la web con el push a `main`).
Pendiente: B18 (avisos a los invitados), ya decidido.
