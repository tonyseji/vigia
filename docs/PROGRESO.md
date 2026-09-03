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

### Estado final

Esqueleto verificado: `npm install`, `npm test` y `npm run build` en verde.
Sin funcionalidad todavía — la app vieja sigue siendo la que se usa y no se toca
hasta la fase 6. Pendiente de que el repositorio se suba a GitHub
(`tonyseji/vigia`, público).
