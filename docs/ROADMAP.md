# Roadmap — Vigía

## Fases

| # | Fase | Estado |
|---|---|---|
| 1 | **Repositorio y esqueleto** — estructura, docs, configuración, CI | ✅ 2026-09-03 |
| 2 | **Base de datos y acceso** — migraciones versionadas, enlace mágico, RLS | Pendiente |
| 3 | **Función de extracción** — `extract.ts` al repo, con tests de las funciones puras | Pendiente |
| 4 | **Frontend** — la app con el diseño aprobado, incluido el aviso de tienda bloqueada | Pendiente |
| 5 | **Refresco** — botón manual, pase diario configurable y ajustes | Pendiente |
| 6 | **Despliegue y retirada** — Vercel conectado, y se apaga la app vieja | Pendiente |

La fase 0 (revisión de la organización de Bilans para reaprovechar lo aprendido)
se cerró el 2026-09-03; el resultado está repartido entre `CLAUDE.md`
(reglas y convenciones) y `docs/DECISIONES.md`.

**Subida a GitHub:** pospuesta a propósito hasta tener la primera prueba de que
la cosa funciona (final de la fase 4). Los commits se siguen haciendo en local,
así que el historial no se pierde; lo único que se acepta mientras tanto es que
no hay copia fuera de este ordenador. En cuanto haya algo que enseñar, se crea
`tonyseji/vigia` y se sube todo el historial de golpe.

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
| Notificaciones, panel de administración, app móvil | Se añaden encima sin tocar nada de lo anterior |
| Listas compartidas, permisos, equipos | Con `user_id` ya puesto, es aditivo |
| Descubrimiento, landing, pagos, multi-idioma | Requieren saber quién es el usuario, y hoy no lo sabes |

---

## Backlog

| ID | Qué | Notas |
|---|---|---|
| B1 | Carpetas de organización (`folders`) | El agrupado por categoría de la app vieja pasa a ser carpetas propias del usuario. Decidir en la fase 2 si va en la primera migración o después. |
| B2 | Precio manual para tiendas bloqueadas | Sube a la fase 4: no es backlog, es parte de añadir un artículo. Flujo en `docs/ARQUITECTURA.md`. |
| B3 | Min/max histórico como referencia | La app vieja lo muestra. Decidir si se calcula en la consulta o se materializa en `items`. |
| B4 | Aviso cuando un artículo baja de su mínimo histórico | Depende de B3. Sin notificaciones todavía: bastaría con destacarlo en la lista. |
| B5 | Exportar la lista | Aún sin demanda real. Anotado para no olvidarlo. |
| B6 | Refresco por artículo | Hoy la frecuencia es por usuario. Si aparece un artículo que sí merece más vigilancia que el resto, sería una decisión nueva. |
