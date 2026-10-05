# Cesta — diseño (2026-10-03)

Sustituye al comparador de conjuntos (sesión 7). Aprobado por Tony en el chat
de la sesión 28.

## Por qué

El botón «Comparar» parecía no hacer nada:

1. En la vista Fotos no salían casillas (solo `ItemRow` las tenía).
2. La barra con el contador quedaba al final de toda la lista: `sticky` dentro
   de un `div` que solo la contenía a ella, así que nunca se pegaba.
3. Para ver un total había que poner nombre al conjunto y guardarlo, y el
   resultado salía arriba del todo. Al terminar se perdía.

Lo que Tony quiere es una previsualización de cesta: marcas artículos (de
tiendas distintas, de carpetas distintas) y ves cuánto te costaría todo.

## Qué hace

- Botón **Cesta** en la cabecera (icono + número de unidades). Activa el modo
  elegir: casilla en cada artículo, en Lista y en Fotos.
- **Barra fija abajo de la pantalla** (`position: fixed`, encima del
  contenido) mientras la cesta tenga algo o se esté eligiendo: unidades,
  tiendas, total y cambio desde que se guardaron. Se ve estés donde estés.
  La página deja hueco abajo para que no tape el último artículo; respeta la
  zona segura del iPhone.
- **Detalle** (hoja desde abajo en móvil, panel lateral en escritorio):
  artículos agrupados por tienda con subtotal, cantidad «− N +» por artículo,
  quitar, vaciar, y tres cifras:
  - **Hoy**: precio actual × cantidad.
  - **Al guardarlos**: primer precio registrado de cada artículo × cantidad
    (el mismo que usa la variación de cada fila).
  - **Mínimo visto**: precio más bajo registrado de cada artículo × cantidad.
  - Artículos sin precio no suman; se avisa con «+N sin precio».
- **«Añadir a la cesta»** en el menú «⋮» de cada carpeta (también las
  compartidas): mete sus artículos y los de sus subcarpetas. Los que ya
  estaban conservan su cantidad.

## Dónde vive

En `localStorage` de este dispositivo (`vigia.cesta`: `{ itm_id: cantidad }`).
No toca la base de datos. La versión anterior vivía solo en memoria y en la
app instalada del iPhone se perdía cada vez que se reabría. Pega: móvil y
ordenador tienen cestas distintas; lo resolvería la fase 2.

Los artículos borrados salen solos de la cesta, pero solo con la lista
cargada sin errores (un fallo de lectura no puede vaciarla).

## Código

- `src/lib/basket.js` — cálculos puros y lectura/escritura del
  almacenamiento, con tests en `src/lib/__tests__/basket.test.js`.
- `src/hooks/useBasket.js` — estado + guardado.
- `src/components/Basket.jsx` — `BasketBar` y `BasketSheet`.
- `ItemRow`/`ItemTile` — casilla en modo elegir.
- `FolderSidebar` — «Añadir a la cesta» en el menú de carpeta.
- Se borran `useComparison.js` y `ComparisonPanel.jsx`.

## Fuera de esta versión (fase 2)

Cestas guardadas con nombre en la base de datos («Salón opción A / B»),
comparadas lado a lado y compartidas entre dispositivos. Gastos de envío: no
se conocen, no se inventan; el desglose por tienda sirve para sumarlos a mano.

## Actualización 2026-10-06 — lo vendido no suma (B27)

Un artículo con `itm_in_stock = false` (vendido en Vinted/Wallapop, sin stock
en el resto) no se puede comprar, así que no entra en ninguna de las tres
cifras ni en el subtotal de su tienda. Se cuenta aparte (`unavailable` en
`basketSummary`), la barra dice «+N sin stock», la línea lleva el precio
tachado con la píldora «Vendido»/«Sin stock» y abajo se explica que no suma.
Decisión en `docs/DECISIONES.md` (2026-10-06).

