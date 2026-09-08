# Función `scrape`

Recibe una URL de producto y devuelve título, imagen y precio.

`extract.ts` es una copia literal del extractor de la app vieja (primer commit
`a313915`, `supabase/functions/muebles/extract.ts`), sin cambios de lógica.
`index.ts` sustituye la clave compartida (`x-key`) de la app vieja por
validación del JWT de la sesión de Supabase Auth, y consulta `vigia.store_rules`
por dominio antes de intentar leer nada (ver `docs/ARQUITECTURA.md`, "Tiendas
que bloquean: el flujo").

Desplegada con `--no-verify-jwt` (regla de `CLAUDE.md` para Edge Functions):
la verificación del token se hace a mano dentro del handler, no la hace
Supabase automáticamente.

No escribe en `items`/`price_history` — eso lo hace el frontend con su propio
cliente de sesión, para que RLS decida qué puede insertar cada usuario.

`extract.test.ts` cubre `parsePrice`, `extractFromHtml` (JSON-LD, Open Graph,
fallback de título) e `isBotPage`, con Vitest (no `Deno.test`: este entorno no
tiene el CLI de Deno instalado, y el módulo no usa ninguna API específica de
Deno más allá de `fetch`/`URL`/`AbortController` globales).

**No portado en esta fase:** el camino `pg_net` para Amazon (`setAltFetcher`
con las RPCs `fetch_enqueue`/`fetch_result` de la app vieja) — esas RPCs viven
solo en la base de datos heredada, no en el repositorio. Si se necesita más
adelante, es una migración nueva que las recree en el schema `vigia`.
