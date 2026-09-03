# Decisiones — Vigía

> Registro de decisiones técnicas y de producto con su contexto y razonamiento.
> Formato: fecha · decisión · por qué · qué se descartó · cuándo revisitar.
>
> **Regla:** cuando se tome una decisión que no sea obvia, añadirla aquí **antes**
> de implementar. Este documento es lo que evita repetir la misma discusión
> dentro de tres meses.

---

## Producto

### 2026-09-03 — Vigía vigila lo que tú guardas; no busca ofertas ni descubre productos
**Decisión:** El alcance es una lista personal de artículos elegidos a mano y su
histórico de precio. Ni recomendaciones, ni catálogo, ni chollos.
**Por qué:** Al mirar qué existe ya aparecieron cuatro familias: agregadores de
ofertas (Chollometro, Slickdeals), histórico de una sola tienda (Keepa,
CamelCamelCamel), wishlist universal (Moonsift, Sortd, Karma) y autoalojados de
código abierto (PriceBuddy, PriceGhost, Discount-Bandit). Los tres primeros
grupos, o no hacen esto, o viven de comisiones de afiliación — y por eso todos
acaban derivando hacia las ofertas y el descubrimiento. La deriva no es
dejadez: es el único modelo que paga el scraping. Dejar el alcance escrito es
la forma de no repetirla sin darse cuenta.
**Descartado:** Añadir descubrimiento «ya que estamos». Requiere catálogo,
consultas a tiendas sin que nadie las haya pedido y un modelo de negocio que
aquí no existe.
**Revisitar:** Si algún día hay usuarios reales pidiendo comparar entre
productos que no han guardado. Hoy no hay usuarios, así que no hay señal.

### 2026-09-03 — Se construye aun sabiendo que PriceBuddy ya hace el 90%
**Decisión:** Construirlo igualmente.
**Por qué:** PriceBuddy es un proyecto de código abierto que resuelve casi lo
mismo, pero pide Docker y servidor propio y está en Laravel. Si el objetivo
fuera solo tener la herramienta, lo sensato sería instalarlo. El objetivo es
también el proyecto en sí: repositorio público, control de versiones y un
segundo sitio donde aplicar lo aprendido en Bilans.
**Descartado:** Instalar PriceBuddy y olvidarse. Es la opción correcta si algún
día el proyecto deja de apetecer.
**Revisitar:** Nunca, salvo que cambie el motivo por el que se construye.

---

## Arquitectura

### 2026-09-03 — Vite + React 18 + Tailwind v4, en la raíz del repositorio
**Decisión:** Mismo stack que Bilans, pero con la app en la raíz (`src/`), no en
una subcarpeta `app/`.
**Por qué:** Un solo modelo mental para los dos proyectos: los mismos
`services`/`hooks`, los mismos tokens en `@theme`, la misma forma de escribir un
componente. Lo de la raíz es donde sí conviene separarse: Bilans arrastra
`cd app && npm install && npm run build` en el `buildCommand` de Vercel y rutas
`app/src/...` en todos lados, y ese anidamiento no le compra nada porque no hay
un segundo paquete que justifique el monorepo.
**Descartado:** (a) JavaScript plano sin framework — se descartó por
alineación, no por tamaño: la app cabría, pero divergir en el framework es
justo lo que obliga a pensar dos veces cada vez que se salta de proyecto.
(b) Copiar la estructura `app/` de Bilans por consistencia — consistencia con
un problema que Bilans no tiene, no es consistencia.
**Revisitar:** Si algún día conviven varios paquetes (por ejemplo, una
extensión de navegador que comparta el extractor), entonces sí toca `packages/`.

### 2026-09-03 — Tailwind v4 desde el primer componente, no «más adelante»
**Decisión:** Tailwind v4 con los tokens del diseño aprobado en `@theme`, desde
el primer archivo de estilos.
**Por qué:** Bilans empezó con CSS a mano y acabó haciendo una migración
big-bang a Tailwind v4 con la app ya en producción (`main.css` eliminado del
todo). Salió bien, pero es un día entero de trabajo que aquí cuesta cero si se
elige ahora. La lección de esa migración no es «Tailwind es mejor», es «esta
decisión no se abarata esperando».
**Descartado:** CSS plano con custom properties, que es lo que ya tiene el
diseño aprobado. Es perfectamente válido para una pantalla; se descarta por
alineación con Bilans y por no repetir la migración.
**Revisitar:** No.

### 2026-09-03 — JavaScript en el frontend, TypeScript solo en la Edge Function
**Decisión:** `.jsx` en `src/`, `.ts` en `supabase/functions/`.
**Por qué:** Es exactamente lo que hace Bilans, y ahí la separación se sostiene
sola: en Deno el TypeScript ya viene de serie, y el extractor —que parsea HTML
ajeno y devuelve formas variables— es justo donde los tipos evitan errores. En
una app de tres tablas, en cambio, añaden fricción sin devolver mucho.
**Descartado:** TypeScript en todo el proyecto. Se puede añadir después
archivo a archivo, sin big-bang; el coste de posponerlo es bajo, al revés que
con Tailwind.
**Revisitar:** Si el frontend pasa de ~15 componentes o si empieza a haber
errores de forma de datos en tiempo de ejecución.

### 2026-09-03 — Una sola rama `main` con previews de Vercel; sin entorno de preproducción
**Decisión:** `main` es producción. Cada pull request genera su propia URL de
preview en Vercel.
**Por qué:** Bilans mantiene `preproduccion` → `main` porque tiene usuarios
reales a los que no se puede romper el mes. Vigía tiene un usuario, que además
es quien despliega. Un segundo entorno aquí es un árbol de ramas que mantener y
un segundo juego de variables que se desincroniza, a cambio de una seguridad
que la preview del PR ya da.
**Descartado:** Copiar el flujo de dos ramas de Bilans por costumbre.
**Revisitar:** El día que haya alguien más usando la app en serio.

### 2026-09-03 — Las reglas de lectura de cada tienda son datos, no código
**Decisión:** Tabla `store_rules`: un dominio, su estrategia de lectura, su modo
de descarga y si está bloqueado.
**Por qué:** Es lo único que se copia de PriceBuddy, y se copia porque resuelve
el problema real de este proyecto: hoy la lógica de Amazon está incrustada en el
código, así que si IKEA cambia su web hay que editar, redesplegar y esperar. Con
la regla en una fila, añadir o arreglar una tienda es un `update`.
**Descartado:** Un archivo de configuración en el repo. Sería mejor que el
código, pero sigue exigiendo un despliegue para arreglar una tienda rota.
**Revisitar:** Si las estrategias se vuelven tan específicas que el `jsonb` se
convierte en un lenguaje de programación mal hecho. En ese caso, tienda difícil
= función propia, y la tabla se queda para el resto.

---

## Seguridad y datos

### 2026-09-03 — Auth real (enlace mágico) en vez de clave compartida
**Decisión:** Supabase Auth con enlace mágico por email. Se retira la clave compartida
que estaba incrustada en el código.
**Por qué:** No es una mejora opcional, es una consecuencia del cambio de
arquitectura. Hoy la clave funciona porque el servidor es quien habla con la
base de datos; al mover el frontend a Vercel, el navegador habla con Supabase
directamente y cualquier clave que se ponga ahí queda a la vista en el
JavaScript de la página. Además el repositorio es público. Con auth real, las
políticas RLS pasan a ser de verdad y no hay nada que esconder: la `anon key` es
pública por diseño y no sirve sin sesión.
**Descartado:** Funciones serverless en Vercel de intermediario. Evitan el
login, pero cualquiera con la URL podría escribir en la lista —el mismo agujero
que hoy— y habría que rehacer el modelo entero el día que entre otra persona.
**Revisitar:** Si el enlace mágico resulta incómodo en el día a día, añadir
Google OAuth encima. Es aditivo: mismo `user_id`, misma RLS.

### 2026-09-03 — `user_id` en todas las tablas desde la primera migración
**Decisión:** Toda tabla de datos nace con `user_id NOT NULL` y política `_own`,
aunque hoy el usuario sea uno solo.
**Por qué:** Es la decisión más barata de tomar ahora y la más cara de aplazar:
una columna y una política hoy, contra migrar todas las filas y reescribir todas
las consultas después. La diferencia entre la versión «solo para mí» y la
versión que admite a otra persona es aproximadamente una hora de trabajo, y casi
toda está aquí.
**Descartado:** Tablas sin dueño «porque solo lo uso yo».
**Revisitar:** No.

### 2026-09-03 — `img-src https:` en la CSP, a diferencia de Bilans
**Decisión:** La Content-Security-Policy permite imágenes de cualquier origen
HTTPS, en vez de la lista cerrada de dominios que usa Bilans.
**Por qué:** Las fotos de producto se enlazan directamente desde la tienda, y el
conjunto de tiendas es abierto por definición: el usuario puede pegar mañana la
URL de una tienda que hoy no existe en ninguna lista. Copiar el `img-src`
cerrado de Bilans rompería la app en cuanto se añadiera una tienda nueva.
**Descartado:** (a) Lista blanca de dominios de imagen: se rompe sola.
(b) Copiar las imágenes a Supabase Storage: cuesta almacenamiento, ancho de
banda y una copia que mantener, para un beneficio que hoy no existe.
**Revisitar:** Si en algún momento se copian las imágenes (por ejemplo, para que
la lista siga teniendo foto cuando la tienda retire el producto), cerrar el
`img-src` en la misma sesión.

### 2026-09-03 — Nada llega a Supabase que no exista antes como migración
**Decisión:** Todo cambio de esquema es un archivo numerado en
`supabase/migrations/`, aplicado después.
**Por qué:** Bilans tiene tablas en producción (`shared_goal_members`,
`sg_invite_code`) que no están en ninguna migración: se crearon a mano en algún
momento y hoy nadie sabe reconstruir el esquema desde cero. Cuesta cero
mantenerlo desde el principio y es irreparable a posteriori.
**Descartado:** «Lo aplico ahora y luego escribo la migración». Es exactamente
así como se produce el desfase.
**Revisitar:** No.

---

## Interfaz

### 2026-09-03 — Cero dependencias nuevas: iconos y gráficos a mano
**Decisión:** Iconos como SVG inline en un barrel propio (`components/icons/`),
minigráfico de evolución como `<svg>` escrito a mano. Ninguna librería de
iconos ni de gráficos.
**Por qué:** Es una restricción que en Bilans ya demostró aguantar: su
`Sparkline.jsx` y su `GoalRing.jsx` son SVG de unas pocas líneas y nadie ha
echado de menos la librería. Aquí el gráfico es una línea de precio con puntos:
meter una dependencia de gráficos para eso son cientos de kilobytes y una
actualización pendiente cada pocos meses.
**Descartado:** Recharts (que Bilans sí usa, para gráficos de verdad) y
cualquier pack de iconos.
**Revisitar:** Si aparece un gráfico con ejes, tooltips y zoom. Un histórico de
precio con rango de fechas seleccionable ya estaría en ese terreno.
