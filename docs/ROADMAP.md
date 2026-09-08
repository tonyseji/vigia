# Roadmap — Vigía

## Fases

| # | Fase | Estado |
|---|---|---|
| 1 | **Repositorio y esqueleto** — estructura, docs, configuración, CI | ✅ 2026-09-03 |
| 2 | **Base de datos y acceso** — migraciones versionadas, enlace mágico, RLS | ✅ 2026-09-05 |
| 3 | **Función de extracción** — `extract.ts` al repo, con tests de las funciones puras | ✅ 2026-09-05 |
| 4 | **Frontend** — la app con el diseño aprobado, incluido el aviso de tienda bloqueada | ✅ 2026-09-05 |
| 5 | **Refresco** — botón manual, pase diario configurable y ajustes | ✅ 2026-09-06 (falta configurar Secrets en el Dashboard, ver abajo) |
| 6 | **Despliegue y retirada** — Vercel conectado, y se apaga la app vieja | 🔶 En curso desde 2026-09-08 (GitHub y Vercel listos, falta retirar la app vieja) |

La fase 0 (revisión de la organización de Bilans para reaprovechar lo aprendido)
se cerró el 2026-09-03; el resultado está repartido entre `CLAUDE.md`
(reglas y convenciones) y `docs/DECISIONES.md`.

**Bloqueante para que el refresco automático y el push funcionen de verdad:**
faltan los Secrets en el Dashboard de Supabase (`VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`). El código ya está
desplegado desde el 2026-09-06; sin esto configurado a mano en el Dashboard
(Claude Code no tiene acceso a esa pantalla), `pg_cron` sigue disparando
`run_scheduled_refresh()` pero la Edge Function fallará al autenticar o al
firmar el push. Sin confirmar como hecho en ninguna sesión hasta ahora.

**Subida a GitHub:** hecha el 2026-09-08. `tonyseji/vigia` (público), historial
completo subido. Ver `docs/PROGRESO.md` (Sesión 8).

**Vercel:** proyecto `vigia` conectado a `tonyseji/vigia`, deploy automático
en cada push a `main`, producción en `https://vigia-lyart.vercel.app`.
Variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_VAPID_PUBLIC_KEY`) configuradas en Production y Preview. Pendiente:
confirmar que las URLs de redirect de Supabase Auth incluyen este dominio, y
decidir cuándo se retira la Edge Function `muebles` de la app vieja.

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
| B7 | SMTP propio para Auth | El SMTP de pruebas de Supabase (límite bajo, sin garantía de entrega) no aguanta un ciclo de desarrollo con varios logins seguidos — bloqueó la sesión del 2026-09-05 con `429 over_email_send_rate_limit`. Configurar un proveedor (Resend u otro con plan gratuito) antes de la próxima sesión de pruebas intensivas. Independiente del push (que no usa SMTP). |
| B8 | ~~Job `pg_cron` de refresco diario~~ | **Cerrado 2026-09-06.** `vigia.run_scheduled_refresh()` + `pg_cron` horario + `pg_net`, secreto en Vault. Migración `007_cron_refresco.sql`. |
| B9 | ~~Camino `pg_net` para Amazon~~ | **Cerrado 2026-09-06.** RPCs `fetch_enqueue`/`fetch_result` recreadas en `vigia` (migración `008_fetch_via_pg_net.sql`), conectadas a `extract.ts` vía `setAltFetcher`. |
| B10 | Miniaturas de artículo siguen mal en algunos casos | Ajuste del 2026-09-07 (68×68 px, recorte sesgado 50%/35%) mejora pero no resuelve del todo — Tony lo confirmó el 2026-09-08. Revisitar con la vista "Fotos" en rejilla (`docs/DISENO.md`) si sigue molestando. |
