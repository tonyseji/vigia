# Roadmap — Vigía

## Fases

| # | Fase | Estado |
|---|---|---|
| 1 | **Repositorio y esqueleto** — estructura, docs, configuración, CI | ✅ 2026-09-03 |
| 2 | **Base de datos y acceso** — migraciones versionadas, enlace mágico, RLS | ✅ 2026-09-05 |
| 3 | **Función de extracción** — `extract.ts` al repo, con tests de las funciones puras | ✅ 2026-09-05 |
| 4 | **Frontend** — la app con el diseño aprobado, incluido el aviso de tienda bloqueada | ✅ 2026-09-05 |
| 5 | **Refresco** — botón manual, pase diario configurable y ajustes | ✅ 2026-09-06 (falta configurar Secrets en el Dashboard, ver abajo) |
| 6 | **Despliegue y retirada** — Vercel conectado, y se apaga la app vieja | ✅ 2026-09-09 |

La fase 0 (revisión de la organización de Bilans para reaprovechar lo aprendido)
se cerró el 2026-09-03; el resultado está repartido entre `CLAUDE.md`
(reglas y convenciones) y `docs/DECISIONES.md`.

**Login y refresco automático verificados en producción el 2026-09-09**
(sesión 9, `docs/PROGRESO.md`): Secrets puestos en Supabase Dashboard →
Edge Functions (par VAPID nuevo, no el original de la sesión 4, que se
perdió; `CRON_SECRET` nuevo generado y sincronizado con Vault), y Redirect
URL de `https://vigia-list.vercel.app` añadida en Authentication → URL
Configuration. `run_scheduled_refresh()` responde `200` (antes `401`), y un
login real por enlace mágico completa sesión contra el dominio de
producción.

**Subida a GitHub:** hecha el 2026-09-08. `tonyseji/vigia` (público), historial
completo subido. Ver `docs/PROGRESO.md` (Sesión 8).

**Vercel:** proyecto `vigia` conectado a `tonyseji/vigia`, deploy automático
en cada push a `main`, producción en `https://vigia-list.vercel.app` (Tony
eligió este dominio corto tras comprobar que `vigia.vercel.app` y varias
variantes ya pertenecían a otros usuarios del namespace global
`*.vercel.app`; el alias autogenerado `vigia-lyart.vercel.app` se retiró).
Variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_VAPID_PUBLIC_KEY`) configuradas en Production y Preview.

**Retirada de la app vieja (sesión 11, 2026-09-09):** antes de borrar nada
se comprobaron los logs de Edge Functions (`function_edge_logs`) de las
últimas 24h — cero invocaciones a `muebles`, solo a `refresh`/`scrape` (la
app nueva) — y las tablas `public.items`/`public.price_history` (0 filas
cada una; `public.settings` con 1 fila). Con Tony confirmado, se borró la
Edge Function `muebles` con `supabase functions delete muebles --project-ref
ovmnzlbcmuppqctkyngi`.

Limpieza completa en la misma sesión: se encontró un cron job
`muebles-refresh-precios` en `cron.job` (inactivo desde
`desactivar_cron_app_vieja`, pero aún registrado con la clave de acceso
vieja en texto plano en el header `x-key`). Con Tony confirmado de nuevo,
la migración `supabase/migrations/014_limpiar_app_vieja.sql` hace
`cron.unschedule` de ese job y `DROP TABLE` de `public.items`,
`public.price_history` y `public.settings` (el HTML de la interfaz vieja,
única fila con contenido, ya conservado en el primer commit del repo). El
schema `public` queda vacío. Verificado con `list_tables` y `get_advisors`
tras aplicar — sin tablas restantes y sin lints nuevos.

---

## Se decide ahora, aunque no se construya ahora

Ordenado por lo que cuesta deshacerlo, no por lo que aporta hoy:

| Decisión | Coste hoy | Coste si se deja para después |
|---|---|---|
| Columna `user_id` en cada tabla | Una columna y una política | Migrar todas las filas y reescribir todas las consultas |
| Auth de verdad en vez de clave compartida | Media hora | Rehacer el modelo de seguridad entero |
| Reglas de tienda como datos | Una tabla | Redesplegar cada vez que una tienda cambia |
| Migraciones versionadas | Gratis desde el principio | Reconstruir el historial a mano |
| Tailwind v4 desde el primer componente | Gratis | Migración big-bang a mitad de camino (le pasó a Bilans) |

## No se construye ahora

| Qué | Por qué puede esperar |
|---|---|
| Panel de administración, app móvil nativa | Se añaden encima sin tocar nada de lo anterior |
| Descubrimiento, landing, pagos, multi-idioma | Requieren saber quién es el usuario, y hoy no lo sabes |

**Vista "Fotos"** (rejilla, conmutador junto a Lista) construida el
2026-09-11 (sesión 14): estaba en el prototipo aprobado
(`docs/diseno-referencia.html`) pero nunca se había implementado.

**Notificaciones** (push nativo VAPID) y **listas/carpetas compartidas**
(jerarquía de dos niveles + invitación con aceptación) se construyeron el
2026-09-06 — ver `docs/DECISIONES.md` y
`docs/superpowers/specs/2026-09-06-carpetas-compartidas-design.md`.

---

## Backlog

| ID | Qué | Notas |
|---|---|---|
| B1 | ~~Carpetas de organización (`folders`)~~ | **Cerrado 2026-09-05.** Entró en `001_schema_inicial.sql` de la fase 2: la tabla es pequeña y `items.itm_fld_id` ya la referenciaba en el esquema propuesto. |
| B2 | ~~Precio manual para tiendas bloqueadas~~ | **Cerrado 2026-09-05.** Implementado en `useItems.js`/`AddItemForm.jsx`; probado con Kave Home real. |
| B3 | ~~Min/max histórico como referencia~~ | **Cerrado 2026-09-06.** Materializado en `items` con trigger, migración `004_min_max_materializado.sql`. |
| B4 | ~~Aviso cuando un artículo baja de su mínimo histórico~~ | **Cerrado 2026-09-06.** Push nativo (VAPID) con umbral configurable en ajustes; ver `docs/DECISIONES.md`. |
| B5 | Exportar la lista | Aún sin demanda real. Anotado para no olvidarlo. El botón «Copiar para Claude» (2026-09-06) cubre el caso de uso de sacar los datos para trabajar fuera de la app. |
| B6 | Refresco por artículo | Hoy la frecuencia es por usuario. Si aparece un artículo que sí merece más vigilancia que el resto, sería una decisión nueva. |
| B7 | SMTP propio para Auth | El SMTP de pruebas de Supabase (límite bajo, sin garantía de entrega) no aguanta un ciclo de desarrollo con varios logins seguidos — bloqueó la sesión del 2026-09-05 con `429 over_email_send_rate_limit`. Configurar un proveedor (Resend u otro con plan gratuito) antes de la próxima sesión de pruebas intensivas. Independiente del push (que no usa SMTP). Menos urgente desde el 2026-09-29: con contraseña ya no hace falta un correo en cada entrada. 2026-10-01: se mantiene «Confirm email» activado; si un correo de confirmar o recuperar no llega de verdad, la respuesta es este SMTP propio, no quitar la confirmación. Hasta hoy las 3 cuentas recibieron su confirmación en menos de 20 s. |
| B8 | ~~Job `pg_cron` de refresco diario~~ | **Cerrado 2026-09-06.** `vigia.run_scheduled_refresh()` + `pg_cron` horario + `pg_net`, secreto en Vault. Migración `007_cron_refresco.sql`. |
| B9 | ~~Camino `pg_net` para Amazon~~ | **Cerrado 2026-09-06.** RPCs `fetch_enqueue`/`fetch_result` recreadas en `vigia` (migración `008_fetch_via_pg_net.sql`), conectadas a `extract.ts` vía `setAltFetcher`. |
| B10 | ~~Miniaturas de artículo siguen mal en algunos casos~~ | **Cerrado 2026-09-11 (sesión 13).** El problema no era el porcentaje de recorte: variaba según la tienda, porque un recorte fijo (`object-cover` 50%/35%) solo funciona con fotos de catálogo centradas y falla en fotos de ambiente/lifestyle donde el producto ocupa una posición impredecible dentro de la imagen. Cambiado a `object-contain` en `ItemRow.jsx`: la imagen se muestra entera, sin recortar nunca, con el fondo `surface-2` de sobra en los lados cuando la proporción no es cuadrada. Coste aceptado: fotos muy panorámicas o muy verticales dejan ver margen de fondo, pero el resultado es consistente en vez de acertar a veces y fallar otras. |
| B11 | ~~Títulos de artículo mal extraídos en algunos casos~~ | **Cerrado 2026-09-09 (sesión 10).** No era el extractor: el título en BD siempre fue correcto. Causa real encontrada con la sesión real de Tony en producción, en móvil (375px): `ItemRow.jsx` no tenía ningún breakpoint responsive — los 7 elementos de ancho fijo de la fila (miniatura, minigráfico, precio, selector de carpeta, botones) ya sumaban más que el ancho disponible, y el título (el único elemento `flex-1`) se colapsaba a `width: 0` y desaparecía visualmente. Arreglado en `ItemRow.jsx`: la fila usa `flex-wrap` con el título en su propia línea completa (`basis-full`) por debajo de `sm:` (640px), precio/carpeta/acciones se apilan debajo, y el minigráfico se oculta en móvil (no hay sitio). A partir de `sm:` vuelve al layout de una sola línea sin cambios. Verificado con el componente real y datos reales (incluido el título largo del Samsung) en 375px, 600px, 768px y escritorio. |
| B12 | ~~`InstallBanner` se corta en móvil~~ | **Cerrado 2026-09-11 (sesión 12).** Pendiente anotado "visto de pasada" en la sesión 10. El overlay (`fixed inset-0 flex items-center justify-center`) no tenía scroll: en viewports bajos (móvil horizontal, o vertical con teclado abierto) la tarjeta podía superar la altura visible y quedaba cortada simétricamente por `items-center`, sin manera de llegar al botón de descarte. En vertical normal (incluido iPhone SE) siempre cupo bien. Arreglado añadiendo `overflow-y-auto` y `py-8` al overlay. Verificado reproduciendo el caso 667×375 antes y después del fix. |
| B13 | ~~La app instalada en iPhone no guarda la sesión~~ | **Cerrado 2026-09-29 (sesión 17).** El enlace mágico siempre abre Safari, que en iOS no comparte almacenamiento con la app de pantalla de inicio. Solución copiada de Bilans: email + contraseña, que se completa dentro de la app. Enlace mágico como alternativa. Pendiente de probar por Tony en iPhone real. |
| B14 | ~~Carpeta compartida: el invitado no ve nada~~ | **Cerrado 2026-09-28/29 (sesión 17).** Recursión infinita en la RLS (`visible_folder_ids` SECURITY INVOKER, migración 015) y aceptar no recargaba carpetas ni artículos. De paso: 016 y 017 cierran dos formas de acceder a carpetas ajenas, y 018 cambia invitar por email a enlace de invitación de un solo uso (7 días). |
| B15 | Retirar la Edge Function `invite-to-folder` | Desde el 2026-09-29 la interfaz invita con enlace y ya no la llama. Sigue desplegada por si hay que volver atrás; retirarla cuando el enlace esté probado en uso real. |
| B16 | ~~Los hooks esconden los errores de lectura~~ | **Cerrado 2026-09-29 (sesión 18).** `useItems`, `useFolders`, `useFolderShares` y `useSettings` devuelven `loadError`; si una lectura falla conservan lo que ya tenían (no vacían) y `App` muestra un aviso con «Reintentar» que nombra qué falló (`src/lib/loadErrors.js`). `useSettings` además dejaba de cargar los valores por defecto ante un fallo: guardar Ajustes habría pisado los reales. |
| B17 | Probar el aviso push de principio a fin | El 2026-09-29 había 0 dispositivos suscritos: nunca ha llegado un aviso real. Pendiente de Tony: Ajustes → «Activar en este dispositivo» desde la app instalada en el iPhone. Con la suscripción creada, mandar un push de prueba y confirmar que llega (y que `VITE_VAPID_PUBLIC_KEY` en Vercel es la del par regenerado en la sesión 9). |
| B18 | Avisos para los invitados de una carpeta compartida | Hoy solo avisa a quien añadió el artículo. Decisión de producto, para Cowork. |
| B19 | ~~Un artículo de IKEA (ÄNGSJÖN / BACKSJÖN) ya no da precio~~ | **Cerrado 2026-10-05 (sesión 33).** Fallo puntual del pase del 2026-09-29: ese mismo día volvió a leerse y lleva 7 lecturas seguidas sin error. La ficha real da 437 € (JSON-LD y página, lo mismo que guarda Vigía) y no aparece ningún 555 €: esa cifra de la nota era un error. Nada que arreglar en el extractor. |
| B20 | ~~«Crear cuenta» con un email ya registrado se queda esperando un correo que no existe~~ | **Cerrado 2026-10-01 (sesión 20).** Supabase no manda correo ni da error en ese caso. `Login.jsx` lo detecta (`identities` vacío) y lleva a recuperar contraseña. Quitar «Confirm email» no lo arreglaba y se deja activado: con él desactivado cualquiera podría registrar un email que no es suyo. |
| B21 | ~~Maisons du Monde: leer el precio pese a DataDome~~ | **Cerrado 2026-10-01 (sesiones 21 y 23).** El servidor no puede (pruebas en `docs/TIENDAS.md`); el navegador sí. Botón «Guardar en Vigía» para la barra de marcadores y extensión de Chrome (`extension/`) con pase diario y avisos vía la Edge Function `record-price`. |
| B22 | Comprobar en uso real el pase diario de la extensión | Instalada y probada por Tony el 2026-10-01 (3 de 3 artículos). Dejar pasar unos días y mirar en su ventana si algún artículo da captcha. Si pasa a menudo, espaciar el pase o leer menos artículos por pasada. |
| B23 | Probar el atajo «Guardar en Vigía» en el iPhone | **Rehecho 2026-10-04 (sesión 30).** Ya no abre Safari: guarda desde el servidor (`save-link`) con una clave personal, probado con `curl` contra producción. Pendiente de Tony: montarlo una vez en su iPhone (pasos en Ajustes), comprobar los nombres de las acciones en iOS en español y, si va bien, compartirlo por iCloud con la clave como pregunta de importación y pegar el enlace en `SHORTCUT_ICLOUD_URL` (`src/lib/shortcutKey.js`). Así los demás solo tocan «Añadir atajo». |
| B24 | Cestas guardadas (fase 2 de la cesta) | La cesta (sesión 28) vive en el dispositivo. Siguiente paso pedido por Tony: guardar conjuntos con nombre en la BD, compararlos lado a lado y verlos en móvil y ordenador. Tabla nueva con RLS; decisión en `DECISIONES.md` 2026-10-03. |
| B25 | ~~Duplicados por URL en la extensión de Chrome~~ | **Cerrado 2026-10-05 (sesión 33).** `record-price` (v3) compara por `urlKey`, la misma clave que la web y `save-link` (importada de `save-link/link.ts`, sin una tercera copia): `findOwnItem` en `record.ts`. Solo entre los artículos del propio usuario: si el mismo artículo está en una carpeta compartida por otro, la extensión sigue creando uno propio (escribir en un artículo ajeno con `service_role` sería una decisión nueva). Probado en producción con la cuenta de pruebas. |
| B26 | ~~Vinted falla en el pase del servidor~~ | **Cerrado 2026-10-06 (sesión 34).** No era la IP ni un bloqueo: la lámpara se había **vendido**. Al venderse, Vinted deja la ficha pero le quita el JSON-LD y los botones de compra; el precio solo queda en los datos de React. `extract.ts` lo lee de ahí (solo el objeto del id de la URL) y marca `inStock: false` con el aviso «Vendido» (`buyer_item_status`). `scrape` v9, `refresh` v8 y `save-link` v3. |
| B27 | ~~Enseñar «Vendido» / «Sin stock» en la lista~~ | **Cerrado 2026-10-06 (sesión 35)**, decidido en Claude Code a petición de Tony (`DECISIONES.md` 2026-10-06, para revisar en Cowork). Fila, tarjeta y cesta lo enseñan apagado con la píldora «Vendido»/«Sin stock»; no suma en la cesta ni en los totales de grupo; se sigue leyendo cada día. |
| B28 | ~~Sklum salía «Sin stock» pudiéndose comprar~~ | **Cerrado 2026-10-06 (sesión 36).** Sklum publica `BackOrder` (entrega más tarde) y el extractor lo guardaba como sin stock. Ahora cuenta como en stock; sin stock solo con `OutOfStock`/`SoldOut`/`Discontinued`. Verificado con los artículos reales de Tony. |
| B29 | Amazon sin precio: enlace corto y ubicación de Irlanda | **Abierto.** Arreglados (sesión 37) el enlace corto `amzn.eu/d/…` (`expandShortLink`) y el `a-offscreen` vacío. Queda: Amazon ve las peticiones desde Irlanda (BD en `eu-west-1`) y no enseña precio de lo que no se envía allí. Probado que dos cookies con «Enviar a 28001» lo arreglan desde `pg_net`; falta decidir dónde guardarlas y cómo renovarlas, o pasar Amazon a la extensión. |
