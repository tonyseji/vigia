# Compras — diseño (sesión 47)

Registro de lo que Tony ha comprado, dentro o fuera de Vigía, para saber
cuánto lleva gastado en un ordenador, un dormitorio, etc. Decidido con Tony
el 2026-11-12.

## Decisiones de producto (de Tony)

1. **Hoja de gastos propia**, no un estado de los artículos: una compra puede
   no tener URL ni precio vigilado.
2. **Se agrupa con las carpetas de siempre** (cambio sobre el primer diseño):
   si la carpeta es compartida, sus compras también. Una carpeta «Pisito»
   compartida suma lo vigilado y lo gastado, y los dos lo ven. Una compra sin
   carpeta es privada de quien la registró (p. ej. «Ordenador»).
3. **«Comprado» sobre un artículo vigilado** crea la compra (precio actual
   precargado, editable), deja de vigilarse, conserva su histórico y se puede
   deshacer. Cierra el pendiente B41.

## Datos (migración 026)

`vigia.purchases` (prefijo `pur`):

| Campo | Notas |
|---|---|
| `pur_id` uuid PK | |
| `pur_usr_id` uuid | Quien la registró. NOT NULL. |
| `pur_title` text | Qué se compró. |
| `pur_amount` numeric(12,2) | Lo pagado, ≥ 0. |
| `pur_currency` text | `EUR`. |
| `pur_date` date | Fecha de compra. |
| `pur_store` text | Opcional. |
| `pur_notes` text | Opcional. |
| `pur_fld_id` uuid | FK a `folders`, `ON DELETE SET NULL`. Null = privada. |
| `pur_itm_id` uuid | FK a `items`, `ON DELETE SET NULL`. Opcional: de qué artículo vino. |
| `pur_created_at` | |

RLS `purchases_all`: igual que `items_all` (mía, o de una carpeta que veo;
la carpeta de destino tiene que ser null o visible; el artículo enlazado, uno
que veo). Índices por `pur_usr_id`, `pur_fld_id`, `pur_itm_id`.

`vigia.items.itm_bought_at timestamptz null`: si no es null, el artículo está
comprado. `refresh` y el pase de la extensión lo saltan; la lista lo enseña
apagado con «Comprado»; no suma en la cesta ni en los totales de grupo.

## Capas y contrato

`src/lib/purchases.js` (funciones puras, con tests):
- `purchaseDraftFromItem(item, today)` → `{ title, amount, store, date, notes, folderId }`.
- `purchasesTotal(purchases)` → número (suma en céntimos para no arrastrar decimales).
- `purchasesInFolder(purchases, folderId, folders)` → la carpeta y todo lo que
  cuelga (`folderSubtreeIds`); `null` = todas.
- `groupPurchasesByFolder(purchases, folders)` → `[{ key, name, purchases, total }]`
  (nombre con jerarquía, `NO_FOLDER` = «Sin carpeta»), en orden de árbol.
- `purchaseYears(purchases)` y `purchasesInYear(purchases, year)`.
- `paidVsLowest(purchase, item)` → diferencia con el mínimo histórico del
  artículo, o `null`.

`src/hooks/usePurchases.js`: `{ purchases, loading, loadError, addPurchase,
updatePurchase, deletePurchase, markItemBought, undoItemBought, reload }`.
Cada acción devuelve `{ error? }` con texto en español. `markItemBought(item,
fields)` crea la compra (`pur_itm_id`, carpeta del artículo) y pone
`itm_bought_at`; `undoItemBought(itemId)` borra esa compra y vuelve a poner
`itm_bought_at = null`; `deletePurchase` de una compra ligada a un artículo
también lo devuelve a vigilado.

UI: botón «Compras» en la cabecera que cambia la vista principal (la barra de
carpetas se queda y filtra); total general + por carpeta + filtro por año;
formulario de compra (alta/edición) con selector de carpeta; botón «Comprado»
en fila, ficha de Fotos y modal de edición; «Deshacer» en un artículo comprado.

## Fuera de alcance

Importar extractos, facturas adjuntas, varias monedas, devoluciones, exportar.

## Reparto del trabajo

| Tarea | Quién | Archivos |
|---|---|---|
| A. Lib `purchases.js` + hook `usePurchases` + tests | subagente | `src/lib/purchases.js`, `src/lib/__tests__/purchases.test.js`, `src/hooks/usePurchases.js` |
| B. UI y conexión | subagente | `src/components/*`, `src/App.jsx`, `src/lib/loadErrors.js`, `src/lib/basket.js`, `src/lib/itemGroups.js` |
| C. BD, refresco, extensión, docs | sesión principal | `supabase/**`, `extension/api.js`, `docs/**` |
