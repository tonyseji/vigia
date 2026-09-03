# Muebles · lista de precios

App mínima para guardar URLs de productos (muebles u otros), extraer imagen/título/precio y seguir el precio en el tiempo.
Vive entera en el proyecto Supabase **muebles** (ref `ovmnzlbcmuppqctkyngi`). Coste: 0 €.

## URL de la app
https://ovmnzlbcmuppqctkyngi.supabase.co/functions/v1/muebles?k=CLAVE-RETIRADA
(la clave `k` se guarda en el navegador tras la primera visita; se puede compartir el enlace completo)

## Piezas
- `supabase/functions/muebles/index.ts` — Edge Function: sirve la web y la API (`/api/items`, `/api/refresh`, `/api/extract`).
- `supabase/functions/muebles/extract.ts` — extractor: JSON-LD → Open Graph → itemprop → Amazon → datos embebidos. Reintenta con varios perfiles de cabeceras y, si la tienda bloquea, descarga vía pg_net (IP de Postgres).
- `ui.html` — la interfaz. En producción se guarda en la tabla `settings` (key `ui_html`); para actualizarla:
  `update settings set value = $ui$ ...html... $ui$ where key = 'ui_html';`
- Tablas: `items`, `price_history`, `settings` (RLS activado, sin políticas: solo la función con service role accede).
- Funciones SQL `fetch_enqueue` / `fetch_result` (pg_net) usadas como camino alternativo de descarga.
- pg_cron `muebles-refresh-precios`: cada 15 min revisa hasta 6 artículos que lleven >20 h sin revisar → todos se actualizan a diario.

## Cambiar la clave de acceso
Editar `ACCESS_KEY` en `index.ts`, redesplegar la función y actualizar la cabecera `x-key` del job de pg_cron:
`select cron.alter_job(1, command := $$ ... $$);`

## Redesplegar
`supabase functions deploy muebles --no-verify-jwt --project-ref ovmnzlbcmuppqctkyngi`

## Tiendas
Funcionan: IKEA, Sklum, Leroy Merlin, Amazon.es (vía pg_net) y en general cualquier tienda con JSON-LD/Open Graph.
Bloquean la lectura automática (DataDome / Vercel checkpoint): Kave Home, Maisons du Monde → precio manual con ✎.
