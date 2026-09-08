# Vigía — Contexto para IA

> ⚠️ **Este archivo es solo REFERENCIA durable.** El historial de sesiones va en
> `docs/PROGRESO.md`, NO aquí. Ver la regla anti-deriva al final.
>
> Leer ANTES de tocar cualquier archivo.
> - Últimas sesiones: `docs/PROGRESO.md`
> - Pendientes y fases: `docs/ROADMAP.md`
> - Decisiones con razonamiento: `docs/DECISIONES.md`
> - Cómo encaja todo y esquema de BD: `docs/ARQUITECTURA.md`
> - Qué tiendas dejan leer el precio: `docs/TIENDAS.md`
> - Quién hace qué (Cowork / Claude Code): `docs/WORKFLOW.md`
> - Cómo tiene que verse: `docs/DISENO.md` + `docs/diseno-referencia.html`

---

## Qué es

Lista personal de productos cuyo precio se quiere vigilar. Se pega la URL de un
producto, Vigía guarda título, imagen y precio, y a partir de ahí registra cómo
evoluciona ese precio en el tiempo.

**Qué NO es**, y condiciona todo lo demás:

| Es | No es |
|---|---|
| Un registro de lo que **tú** eliges guardar, en tus propias carpetas | Un buscador de ofertas |
| El histórico de precio desde que guardaste cada artículo | Un descubridor de productos |
| Válido para cualquier producto (hoy muebles, mañana piezas de PC) | Una app de muebles |

El descubrimiento de productos está **fuera de alcance**. Puede reconsiderarse,
pero nada del diseño actual debe darlo por supuesto.

---

## Estado actual

**Fases 3, 4 y 5 cerradas. Fase 6 en curso.** Repositorio subido a GitHub
(`tonyseji/vigia`, público) y proyecto Vercel conectado con deploy automático
en cada push a `main` — producción en `https://vigia-lyart.vercel.app`
(2026-09-08). Falta configurar los Secrets de Supabase (`VAPID_*`,
`CRON_SECRET`) desde el Dashboard antes de que el pase automático funcione de
verdad — sigue sin confirmarse hecho. Miniaturas de artículo (68×68, recorte
sesgado) mejoradas el 2026-09-07 pero no resueltas del todo (backlog B10).
Siguiente dentro de la fase 6: confirmar las URLs de redirect de Supabase
Auth para el dominio de Vercel y decidir cuándo se retira la Edge Function
`muebles` de la app vieja.

La app antigua (Edge Function `muebles` en el mismo proyecto Supabase) **sigue
viva y en uso**, y no se toca hasta la fase 6. Su código está en el primer
commit de este repo.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Vite + React 18 (lib + hooks, sin librería de estado) + Tailwind CSS v4 |
| Base de datos | Supabase (PostgreSQL) — proyecto `muebles` (`ovmnzlbcmuppqctkyngi`), schema `vigia` |
| Auth | Supabase Auth — enlace mágico por email |
| Lectura de precios | Edge Function `scrape` (Deno/TypeScript) |
| Refresco | Botón manual + un pase diario configurable (`pg_cron`) |
| Deploy | Vercel (plan Hobby) |

Coste objetivo: 0 €. No se añade nada que obligue a salir del plan gratuito.

---

## Estructura

```
vigia/
├── CLAUDE.md
├── vercel.json              ← cabeceras de seguridad + SPA rewrite
├── .github/workflows/ci.yml ← test + build en cada push y PR
├── docs/
│   ├── ARQUITECTURA.md      ← cómo encaja todo + esquema de BD
│   ├── DECISIONES.md        ← decisiones con razonamiento
│   ├── PROGRESO.md          ← log de sesiones
│   ├── WORKFLOW.md          ← Cowork planifica, Claude Code implementa
│   ├── DISENO.md            ← qué se copia de la referencia y qué cambia
│   └── diseno-referencia.html ← prototipo aprobado, abrible en el navegador
│   ├── ROADMAP.md           ← fases y pendientes
│   └── TIENDAS.md           ← qué tiendas funcionan y cuáles bloquean
├── src/
│   ├── components/          ← UI (ItemRow, AddForm, Sparkline…)
│   ├── hooks/               ← estado React que consume lib/
│   ├── lib/
│   │   ├── supabase.js      ← cliente único
│   │   └── format.js        ← euros, porcentajes
│   ├── styles/tailwind.css  ← tokens en @theme (fuente única de color)
│   ├── App.jsx
│   └── main.jsx
└── supabase/
    ├── migrations/          ← SQL versionado, numerado
    └── functions/scrape/    ← lectura de precios
```

---

## Convención de nombres en BD

Copiada de Bilans porque funciona: nombre de tabla en inglés, campos con
prefijo de tabla. Hace legible cualquier consulta con JOINs.

| Tabla | Prefijo |
|---|---|
| `items` | `itm` |
| `price_history` | `ph` |
| `folders` | `fld` |
| `store_rules` | `sr` |
| `user_settings` | `us` |

Las etiquetas en la interfaz van siempre en español (`itm_price` → «Precio»).

---

## Reglas que NO romper

Todas vienen de haberlas roto en Bilans. Ninguna es teórica.

- **El repositorio es público.** Nada de claves, ni de ejemplo. El `.gitignore`
  cubre credenciales, volcados de BD, `privado/` y `*.private.md`; el hook de
  `.githooks/pre-commit` bloquea el commit si detecta un secreto. Activarlo una
  vez por máquina: `git config core.hooksPath .githooks`.
- **El schema `public` de ese proyecto es de la app vieja y NO se toca** hasta
  la fase 6. Todo lo nuevo va en el schema `vigia`.
- **Nada se aplica en Supabase que no exista antes como archivo** en
  `supabase/migrations/`. En Bilans hay tablas en producción que no están en
  ninguna migración y ya nadie sabe cómo se crearon.
- Toda tabla nueva: RLS activado + política `_own` por `user_id` +
  `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` y
  `GRANT ALL ... TO service_role`.
- Políticas RLS con `(select auth.uid())`, nunca `auth.uid()` directo — sin el
  `select` Postgres lo reevalúa fila a fila.
- Toda función `SECURITY DEFINER`: `SET search_path = public` **y**
  `REVOKE EXECUTE ... FROM anon, PUBLIC` explícito. Postgres concede EXECUTE a
  PUBLIC por defecto al crear la función.
- Ojo: `gen_random_bytes` y demás de pgcrypto viven en el schema `extensions`.
  Con `SET search_path = public` hay que cualificarlas.
- Funciones trigger: `RETURN NULL` explícito en **todos** los caminos, incluido
  el `EXCEPTION`.
- Edge Functions: desplegar con `--no-verify-jwt` y validar el token a mano en
  el handler. Mantener el criterio igual en todas.
- La API key de cualquier servicio de pago va en Secrets de Supabase, nunca en
  una variable `VITE_*` (esas acaban en el JavaScript que descarga el navegador).
- **Cero dependencias nuevas sin justificación.** Los iconos son SVG inline en
  un barrel propio y el minigráfico es un `<svg>` a mano — no entra ninguna
  librería de iconos ni de gráficos.
- Los colores viven en `@theme` de `tailwind.css`. Ningún hex suelto en un
  componente.

---

## Al comenzar una sesión

1. Leer este `CLAUDE.md`.
2. Leer las 2 últimas entradas de `docs/PROGRESO.md`.
3. Si toca BD, leer `docs/ARQUITECTURA.md`.
4. Si hay una decisión de diseño no obvia, **no decidirla aquí**: pararla y
   llevarla a Cowork, que la registra en `docs/DECISIONES.md` antes de
   implementar. Ver `docs/WORKFLOW.md`.

## Regla anti-deriva (OBLIGATORIA al cerrar sesión)

- La entrada completa de la sesión va **solo** en `docs/PROGRESO.md`
  (Contexto · Cambios · Estado final).
- En este `CLAUDE.md` se actualiza **únicamente** la línea de «Estado actual».
  Nunca pegar aquí la entrada completa.
- Cuando `docs/PROGRESO.md` pase de ~100 KB, mover las entradas antiguas a
  `docs/PROGRESO-ARCHIVO.md`.

> Esta regla existe porque el `CLAUDE.md` de Bilans creció de 180 a 890 líneas
> por no tenerla, y su `PROGRESO.md` va por 426 KB en un solo archivo.
