# Cómo se trabaja en Vigía

> Quién decide, quién escribe código, y qué pasa de uno a otro.
> Leer antes de empezar cualquier sesión.

---

## Dos herramientas, dos papeles

| Herramienta | Papel |
|---|---|
| **Cowork** | Planifica, decide y documenta. Su dominio son los `.md` y las decisiones de diseño. |
| **Claude Code** | Implementa. Su dominio es todo el código, los comandos y las migraciones. |

La separación no es burocracia: es lo que evita que las decisiones de
arquitectura se tomen a mitad de un archivo, sin quedar escritas en ningún
sitio y sin que nadie las pueda revisar tres meses después.

### Qué hace Cowork

- **Documenta** — escribe y reorganiza todos los `.md`: `CLAUDE.md`,
  `ARQUITECTURA.md`, `DECISIONES.md`, `PROGRESO.md`, `ROADMAP.md`,
  `TIENDAS.md`, este mismo.
- **Diseña** — esquema de base de datos, contratos entre piezas, estructura de
  componentes, flujos de usuario. Antes de que exista el código.
- **Decide** — resuelve dilemas («¿tabla nueva o columna extra?», «¿en la
  función o en un trigger?») y **registra la decisión en `DECISIONES.md` antes
  de implementar**.
- **Prepara el prompt para Claude Code** cuando hay código que escribir.

**Cowork no toca código** (`.jsx`, `.js`, `.ts`, `.sql`, `.css`, `.html`).
Si algo requiere editarlo, define la tarea y genera el prompt.

### Qué hace Claude Code

Se abre en terminal, desde la carpeta del proyecto:

```bash
cd "C:\Users\anton\Desktop\Vigia"
claude
```

- Escribe y edita el código.
- Ejecuta comandos: `npm run dev`, `npm test`, `npm run build`, `git`,
  `supabase functions deploy`.
- Genera las migraciones SQL siguiendo el esquema que definió Cowork.
- Implementa lo especificado **sin rediseñar la arquitectura por su cuenta**.
  Si aparece un dilema de diseño, para y lo reporta para que se decida en
  Cowork.

---

## El ciclo

```
1. Tony trae una necesidad a Cowork
       ↓
2. Cowork pregunta lo que falte y define la solución
   (qué se construye, qué archivos se tocan, qué se decide y por qué)
       ↓
3. Cowork actualiza los .md que apliquen
       ↓
4. Cowork escribe el prompt para Claude Code
       ↓
5. Tony lo pega en Claude Code y lo ejecuta
       ↓
6. Claude Code implementa y reporta qué tocó
       ↓
7. Tony vuelve a Cowork con el resultado: revisar, iterar o planificar lo siguiente
```

---

## Formato del prompt para Claude Code

```
## Contexto
[Qué está pasando en el proyecto y por qué se hace esto ahora]

## Tarea
[Qué implementar, en una frase o dos]

## Especificación
[Nombres de archivos, funciones, campos, tipos, lógica esperada]

## Restricciones
[Qué NO hacer, qué no romper, qué convenciones respetar]

## Criterio de éxito
[Cómo se sabe que está bien]
```

Con esta estructura Claude Code no tiene que adivinar ni tomar decisiones de
diseño por su cuenta.

---

## Reglas de sesión

**Al empezar en Cowork:** leer las 2 últimas entradas de `PROGRESO.md` y el
`ROADMAP.md`. No tocar código.

**Al empezar en Claude Code:** leer `CLAUDE.md` entero y las 2 últimas entradas
de `PROGRESO.md`. Si la tarea toca la base de datos, leer también
`ARQUITECTURA.md`.

**Al cerrar:** Claude Code reporta exactamente qué archivos tocó y qué queda
pendiente. Cowork escribe la entrada en `PROGRESO.md` y actualiza la línea de
estado del `CLAUDE.md` — solo esa línea (regla anti-deriva).

---

## Dónde va cada cosa

| Situación | Va a… |
|---|---|
| «¿Cómo estructuramos X?» | Cowork |
| «¿Qué columnas necesita esta tabla?» | Cowork |
| «¿Esto en la función o en un trigger?» | Cowork |
| «Actualiza el roadmap con lo de hoy» | Cowork |
| «Escribe la migración 001» | Claude Code |
| «Implementa el componente ItemRow» | Claude Code |
| «Corre los tests y dime qué falla» | Claude Code |
| «Haz commit y push» | Claude Code |
