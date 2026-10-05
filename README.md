# Vigía

Tu lista de productos y cómo evoluciona su precio.

Pegas la URL de un producto y Vigía guarda su título, su imagen y su precio.
A partir de ahí registra el precio cada día, para que cuando llegue el momento
de comprar sepas si lo que estás viendo es realmente una bajada.

No es un buscador de ofertas ni un descubridor de productos: solo vigila lo que
tú has decidido guardar.

---

## Estado

**En uso.** Las seis fases están cerradas y la app funciona en
[vigia-list.vercel.app](https://vigia-list.vercel.app): carpetas (también
compartidas), refresco diario y avisos de bajada, cesta, vista de fotos,
extensión de Chrome para las tiendas que no dejan leer el precio desde el
servidor, y guardar desde Compartir en Android o con un atajo en el iPhone.
Lo pendiente está en el backlog de [`docs/ROADMAP.md`](docs/ROADMAP.md).

La versión anterior vivía entera dentro de una Edge Function de Supabase; su
código solo queda en el primer commit del historial.

## Stack

Vite + React + Tailwind CSS v4, Supabase (PostgreSQL, Auth y Edge Functions)
y Vercel. Todo dentro de los planes gratuitos.

## Arrancar en local

```bash
npm install                             # imprescindible: esbuild y rollup traen
                                        # binarios distintos por sistema operativo
cp .env.example .env                    # y rellenar VITE_SUPABASE_ANON_KEY
git config core.hooksPath .githooks     # guardia anti-secretos, una sola vez
npm run dev
```

Otros comandos:

```bash
npm test          # tests de las funciones puras (Vitest)
npm run build     # build de produccion
npm run preview   # servir el build
```

## Documentación

| Documento | Qué contiene |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Contexto del proyecto y reglas que no romper |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Cómo encaja todo y esquema de base de datos |
| [`docs/DECISIONES.md`](docs/DECISIONES.md) | Qué se decidió, por qué, y qué se descartó |
| [`docs/PROGRESO.md`](docs/PROGRESO.md) | Log de las sesiones recientes (las antiguas, en [`PROGRESO-ARCHIVO.md`](docs/PROGRESO-ARCHIVO.md)) |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Fases y pendientes |
| [`docs/WORKFLOW.md`](docs/WORKFLOW.md) | Cómo se trabaja: quién decide y quién escribe código |
| [`docs/DISENO.md`](docs/DISENO.md) | Cómo tiene que verse, y el prototipo aprobado al lado |
| [`docs/TIENDAS.md`](docs/TIENDAS.md) | Qué tiendas dejan leer el precio |
| [`extension/README.md`](extension/README.md) | La extensión de Chrome: instalarla y cómo está hecha |
| [`supabase/functions/scrape/README.md`](supabase/functions/scrape/README.md) | El extractor de precios |

## Licencia

Sin licencia definida todavía. Proyecto personal, público para que se pueda ver
cómo está hecho.
