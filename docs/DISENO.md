# Diseño — Vigía

> El objetivo visual está en **`docs/diseno-referencia.html`**: ábrelo en el
> navegador antes de construir la fase 4. Es un prototipo estático con datos
> inventados; este documento dice qué se copia, qué cambia y por qué.
>
> Los colores y tipografías ya están en `src/styles/tailwind.css` (`@theme`).
> Ningún hex suelto en un componente.

---

## La idea

Una sola pantalla. Densa, sin tarjetas grandes ni espacio desperdiciado, porque
la gracia es **ver muchos artículos a la vez y comparar de un vistazo**. Lo que
salta a la vista es la bajada de precio, no la foto.

Nada de dashboards ni de navegación por secciones: se abre y ya está todo.

---

## Estructura, de arriba abajo

1. **Cabecera fija** — el nombre «Vigía», el botón de tema (claro/oscuro) y
   **Actualizar**. Al pulsar Actualizar, el botón se deshabilita y dice
   «Leyendo…» hasta que termina.
2. **Tres cifras** en una barra: artículos, cuántos han bajado, y el total de la
   lista con su variación. La de bajadas va en verde.
3. **Barra de añadir** — un campo ancho («Pega aquí la URL de un producto») y el
   botón Añadir. Es lo primero que se usa, así que va arriba y ocupa el ancho.
4. **Herramientas** — buscador, orden (mayor bajada · más recientes · más
   baratos · más caros), un chip «Solo bajadas», y un conmutador Lista / Fotos.
5. **La lista, agrupada por carpeta**, con un título por grupo que lleva el
   número de artículos y el total de esa carpeta.

## La fila (vista Lista, la principal)

De izquierda a derecha: una franja vertical de color en el borde, la miniatura,
el nombre y la tienda, el minigráfico, y el precio con su variación.

| Elemento | Regla |
|---|---|
| Franja lateral | Verde si el precio ha bajado, rojo si ha subido, ámbar si no hay precio. Es lo que permite escanear la lista sin leer. |
| Miniatura | 54×54. Si no hay imagen, un icono según el tipo de producto sobre fondo `surface-2`. |
| Nombre | Máximo dos líneas, y es el enlace a la tienda. |
| Segunda línea | Dominio de la tienda · nº de registros · en ámbar, «la tienda bloquea la lectura» cuando aplica. |
| Minigráfico | Solo si hay dos o más registros. 74×26, línea con relleno tenue y punto en el último valor, del color de la dirección. |
| Precio | Mono, `tabular-nums`, el número más grande de la fila. |
| Variación | Píldora con el porcentaje y, debajo, el precio anterior tachado cuando ha bajado. |
| Sin precio | En vez del precio, la píldora ámbar «Sin precio · edítalo». |

La vista **Fotos** es la misma información en rejilla, con la imagen grande y
sin minigráfico. Es secundaria: se usa para comparar diseños, no precios.

---

## Qué cambia respecto a la referencia

La referencia se hizo antes de cerrar varias decisiones. Al implementarla:

- **El rótulo es «Vigía»**, no «Muebles a la baja». El proyecto ya no es de
  muebles.
- **Las agrupaciones son carpetas del usuario** (tabla `folders`), no un campo
  de texto `category`. El usuario las crea y las ordena.
- **Los datos son reales**: nada de arrays en el propio archivo. Vienen de
  Supabase a través de hooks.
- **Los iconos van al barrel** `src/components/icons/`, uno por archivo o todos
  en un `index.jsx`, nunca SVG suelto dentro de una vista.
- **El aviso de tienda bloqueada** no es solo la etiqueta de la fila: hay
  además un aviso al añadir la URL, antes de guardar. Flujo completo en
  `docs/ARQUITECTURA.md`.
- **El botón de tema** puede quedarse fuera de la primera versión: los tokens ya
  responden a la preferencia del sistema. Si se implementa, que recuerde la
  elección.
- **El minigráfico se escribe a mano** como en la referencia. No entra ninguna
  librería de gráficos.

## Estados que la referencia no muestra y hay que construir

| Estado | Qué se ve |
|---|---|
| Lista vacía | Un texto que invita a pegar la primera URL, no una pantalla en blanco. |
| Cargando la lista | Esqueletos con la forma de las filas, no un spinner centrado. |
| Añadiendo una URL | El botón deshabilitado mientras se lee la ficha; puede tardar varios segundos. |
| Error al añadir | El motivo en palabras llanas, junto al campo, y la URL sin perderse. |
| Artículo sin histórico | Sin minigráfico y sin variación: solo el precio. Es lo normal el primer día. |
| Búsqueda sin resultados | «Nada que coincida», como en la referencia. |

---

## Detalles que no son negociables

- Los números de dinero siempre en `--font-mono` con `tabular-nums`, para que
  las columnas cuadren al escanear.
- Formato español: `1.234,50 €`. Ya está resuelto en `src/lib/format.js`.
- Foco visible en todo lo que se pueda tabular (`outline` de 2 px en `--accent`).
- Móvil: la fila aguanta en 360 px de ancho. El precio nunca se parte en dos
  líneas.
- Modo claro y oscuro, los dos, desde el primer componente.
