# Cómo se trabaja en Vigía

> Todo se hace desde Claude Code: decidir, documentar, escribir código,
> desplegar. Desde el 2026-10-10 no hay un segundo entorno (antes, Cowork
> planificaba y Claude Code implementaba; ver `DECISIONES.md`).

---

## Quién decide

Tony decide el producto; Claude Code decide lo técnico y lo implementa.

- **Decisiones técnicas** (tabla nueva o columna, función o trigger, cómo
  repartir un componente): las toma Claude Code y, si no son obvias, las deja
  en `DECISIONES.md` antes de implementar, con el razonamiento y lo
  descartado.
- **Decisiones de producto o de diseño que cambian lo que ve Tony** (qué se
  enseña, a quién se avisa, qué entra en la app y qué no): se le preguntan a
  Tony con las opciones y una recomendación, y la respuesta se registra en
  `DECISIONES.md` antes de implementar.
- Si Tony dice «decide tú», Claude Code decide y lo anota igual.

El motivo de escribirlo todo sigue siendo el mismo que con Cowork: que
ninguna decisión se quede tomada a mitad de un archivo sin que nadie la
pueda revisar tres meses después.

---

## Reglas de sesión

**Al empezar:** leer `CLAUDE.md` entero y las 2 últimas entradas de
`PROGRESO.md`. Si la tarea toca la base de datos, leer también
`ARQUITECTURA.md`; si toca el aspecto, `DISENO.md`.

**Al cerrar:** escribir la entrada en `PROGRESO.md` (Contexto · Cambios ·
Estado final), actualizar `ROADMAP.md` y la línea de estado del `CLAUDE.md`
— solo esa línea (regla anti-deriva) — y hacer commit y push a `main`.
Decir a Tony qué archivos se tocaron y qué queda pendiente.

**Auditoría de instrucciones:** cuando el número de la sesión que se cierra
sea múltiplo de 10 (40, 50…), o cuando salga un modelo nuevo de Claude,
ejecutar `/claude-api prompt-audit` sobre `CLAUDE.md` y los `docs/` de
instrucciones, aplicar lo que aguante la revisión y anotarlo en
`PROGRESO.md`. Un test (`src/lib/__tests__/claudeMd.test.js`) para el CI si
el «Estado actual» del `CLAUDE.md` vuelve a crecer.
