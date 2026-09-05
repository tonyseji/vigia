# Vigía

Tu lista de productos y cómo evoluciona su precio.

Pegas la URL de un producto y Vigía guarda su título, su imagen y su precio.
A partir de ahí registra el precio cada día, para que cuando llegue el momento
de comprar sepas si lo que estás viendo es realmente una bajada.

No es un buscador de ofertas ni un descubridor de productos: solo vigila lo que
tú has decidido guardar.

---

## Estado

**En reconstrucción.** Este repositorio contiene el esqueleto del proyecto; la
funcionalidad se está portando desde una versión anterior que vivía entera
dentro de una Edge Function de Supabase (ver el primer commit del historial).
Las fases están en [`docs/ROADMAP.md`](docs/ROADMAP.md).

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
| [`docs/PROGRESO.md`](docs/PROGRESO.md) | Log de sesiones de trabajo |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Fases y pendientes |
| [`docs/WORKFLOW.md`](docs/WORKFLOW.md) | Cómo se trabaja: quién decide y quién escribe código |
| [`docs/DISENO.md`](docs/DISENO.md) | Cómo tiene que verse, y el prototipo aprobado al lado |
| [`docs/TIENDAS.md`](docs/TIENDAS.md) | Qué tiendas dejan leer el precio |

## Licencia

Sin licencia definida todavía. Proyecto personal, público para que se pueda ver
cómo está hecho.
