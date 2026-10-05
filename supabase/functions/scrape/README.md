# Función `scrape`

Recibe una URL de producto y devuelve título, imagen, precio y stock.

`index.ts` valida el JWT de la sesión de Supabase Auth (sustituye la clave
compartida `x-key` de la app vieja) y consulta `vigia.store_rules` por dominio
antes de intentar leer nada (ver `docs/ARQUITECTURA.md`, «Tiendas que
bloquean: el flujo»). Si la tienda está bloqueada responde `{ blocked: true }`
sin descargar la ficha.

Desplegada con `--no-verify-jwt` (regla de `CLAUDE.md` para Edge Functions):
la verificación del token se hace a mano dentro del handler.

No escribe en `items`/`price_history` — eso lo hace el frontend con su propio
cliente de sesión, para que RLS decida qué puede insertar cada usuario.

## El extractor (`extract.ts`)

Nació como copia del de la app vieja (primer commit, `muebles/extract.ts`) y
desde entonces ha crecido. Lo usan tres funciones, así que **cambiarlo obliga
a redesplegar `scrape`, `refresh` y `save-link`**.

Orden en el que busca el precio:

1. JSON-LD `Product` (también `ProductGroup` con variantes), con la
   disponibilidad de la oferta como stock.
2. Open Graph / `product:price:amount` y `itemprop="price"`.
3. Casos por tienda (`domainSpecific`):
   - **Amazon**: no publica JSON-LD; precio, imagen y stock del HTML.
   - **Vinted**: un artículo vendido pierde el JSON-LD; el precio se saca de
     los datos de React (`self.__next_f.push`), siempre del objeto con el id
     de la URL, y el aviso «Vendido» (`buyer_item_status`) lo marca sin stock
     (backlog B26).
4. Título de la página como último recurso para el nombre.
5. Datos embebidos (`"price": 429`), solo si ese importe aparece también como
   texto con «€» en la página.

Descarga (`fetchHtml`): prueba varios perfiles de cabeceras si la tienda
bloquea, descarta los muros anti-bot que responden 200 (`isBotPage`: Vercel,
Cloudflare, DataDome, el captcha de Shein, el interstitial de Amazon) y, si
todo falla, prueba el camino alternativo por la IP de Postgres (`pg_net`, RPCs
`fetch_enqueue`/`fetch_result` de la migración 008; Amazon va por ahí
primero). Corta en 3 MB.

## Tests

`extract.test.ts` cubre `parsePrice`, `extractFromHtml` (JSON-LD, Open Graph,
disponibilidad, Vinted vendido, fallback de título) e `isBotPage`, con Vitest
(no `Deno.test`: este entorno no tiene el CLI de Deno, y el módulo no usa
nada de Deno más allá de `fetch`/`URL`/`AbortController` globales).
