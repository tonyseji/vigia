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

### 2026-09-03 — El nombre es Vigía, revisado a fondo y confirmado
**Decisión:** El proyecto se llama **Vigía**; el repositorio es `vigia`, sin
tilde, por la URL. Se reabrió la decisión y se cerró en el mismo sitio.
**Por qué:** La duda era legítima y estaba bien formulada: «Vigía» nombra a una
*persona que vigila*, y lo que hay es también *un sitio donde están mis cosas* —
una lista de productos que me estoy pensando, que puede que no compre nunca, y
entre los que a veces comparo. Pero el argumento decisivo va al revés: la lista
sin histórico de precios **ya está resuelta con Notion**, y no justifica
construir nada. Lo que justifica el proyecto es que algo mire los precios por ti
para no tener que entrar cada dos por tres a la URL. El nombre debe apuntar a lo
que hace que esto exista, no a lo que cualquier herramienta ya hace. Y un vigía
es precisamente el que mira **por ti, para que tú no tengas que mirar**: no
empuja a comprar, avisa.
**Descartado, con el motivo de cada uno** (todos comprobados contra lo que ya
existe, tras la lección de `precioteca`):
- `bitacora` — muy ocupada y en español carga el significado de «blog».
- `precioteca` — existe, y es justamente un comparador de ofertas.
- `mirador` — resolvía bien la objeción (un lugar, no un vigilante), pero es una
  palabra demasiado común: miradores turísticos, promociones inmobiliarias.
- `atalaya` — mismo concepto y más distintiva, pero muy ocupada en software
  español (Atalaya IT, Atalaya GRC, Atalaya Interactive) y, sobre todo, *La
  Atalaya* es la revista de los Testigos de Jehová: en España esa asociación se
  come el nombre entero.
- `kairos` — «el momento oportuno», que es literalmente la decisión que la app
  ayuda a tomar, pero está saturado: criptomoneda KAIROS, Kairos Wallet,
  kairos.trade. Un proyecto de precios que suena a cripto es lo contrario de lo
  que se busca.
- `otero` — la loma desde la que se otea; libre, corto, sin tilde, y la mejor
  alternativa encontrada. Cayó solo porque no mejoraba lo suficiente como para
  pagar el cambio.
- `miru` (japonés «ver», que además suena a «mira») — colisión directa con
  `miru-project/miru-app`, un repositorio con tracción en GitHub.
- `begira` (euskera), `utsikt` (sueco), `belvedere`, `terna`, `antesala`,
  `tanteo` — descartados por criterio propio: un nombre en un idioma que no
  hablas envejece mal en un proyecto personal (hay que explicarlo cada vez), y
  `tanteo` además se contradice con el producto, porque *a tanteo* significa «a
  ojo, sin medir» y aquí la gracia es tener el dato exacto.
- Compuestos tipo *miraprecios* o *preciovista* — suenan a extensión de Chrome
  de 2011.
**El riesgo que sí tiene el nombre, y cómo se controla:** «vigía de precios»
puede leerse como alertas y chollos, que es la categoría explícitamente
descartada. Eso no se corrige con el nombre sino con el alcance, que ya está
escrito arriba y en `CLAUDE.md`.
**Revisitar:** Tras unas semanas de uso real. Si para entonces sigue sin
encajar, el cambio es renombrar el repositorio en GitHub y una línea de
interfaz — diez minutos. No merece bloquear ninguna fase.

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

### 2026-09-03 — Refresco: el botón es el camino principal; el automático, un pase al día configurable
**Decisión:** El botón «Actualizar precios» está siempre disponible y no
depende de ningún cron. El pase automático es **uno al día** por defecto, y el
usuario puede apagarlo o subirlo a cada 12 h o cada 6 h desde ajustes
(`user_settings.us_refresh_mode`). Se implementa con un único job de `pg_cron`
horario que decide por usuario, no con un job por frecuencia.
**Por qué:** La app vieja refresca cada 15 minutos, y es desproporcionado: el
precio de un sofá no cambia cada cuarto de hora, así que casi ninguna de esas
peticiones aporta un dato nuevo. Lo que sí hacen es gastar invocaciones del
plan gratuito y, sobre todo, **entrenar a las tiendas para bloquear** — cuanto
más se las consulta, antes aparece el checkpoint anti-bot, que es justo el
problema que ya tenemos con Kave Home. Un pase diario da el mismo histórico
útil con dos órdenes de magnitud menos de ruido.
**Descartado:** (a) Mantener los 15 minutos «porque ya funciona». (b) Quitar el
cron del todo y dejar solo el botón — se descartó porque el valor del proyecto
es el histórico, y un histórico con huecos de semanas (los días que no te
acuerdas de pulsar) vale bastante menos; el pase diario lo rellena sin
molestar. (c) Dejar la frecuencia como constante en el código: la semana del
Black Friday va a querer subirla y bajarla después, y eso no puede ser un
despliegue.
**Revisitar:** Si el pase diario se queda corto en un pico concreto, el ajuste
ya está; si hiciera falta algo más fino (por artículo, no por usuario), eso sí
sería una decisión nueva.

### 2026-09-03 — Una tienda bloqueada avisa antes de guardar, y el artículo se guarda igual en modo manual
**Decisión:** Al pegar una URL se comprueba el dominio contra `store_rules`
antes de intentar la extracción. Si está bloqueado, la app lo dice con palabras
llanas y ofrece guardar el artículo con precio manual. El artículo queda
marcado, el refresco automático lo salta, y cada edición del precio escribe una
fila en `price_history` con `ph_source = 'manual'`.
**Por qué:** Hoy el fallo es mudo: se intenta, no sale el precio, y el artículo
queda a medias sin que nadie explique por qué. El usuario acaba pensando que la
app está rota cuando lo que pasa es que la tienda no deja. Avisar por adelantado
convierte un fallo en una elección informada, y el modo manual conserva lo que
de verdad importa —que el artículo esté en la lista y tenga histórico— aunque
se pierda la comodidad.
**Descartado:** (a) Rechazar la URL directamente: perdería el artículo de la
lista por un problema que no es del usuario. (b) Guardarlo en silencio sin
precio: es el comportamiento actual y es el que confunde. (c) Intentar esquivar
el anti-bot: es empezar una carrera que no interesa por dos tiendas.
**Revisitar:** Si alguna de las dos dejara de bloquear, es un `update` en
`store_rules` y los artículos existentes se pueden pasar a automático.

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

### 2026-09-06 — `push_subscriptions.psub_updated_at` se escribe desde la Edge Function, sin trigger `BEFORE UPDATE`
**Decisión:** El timestamp de última actualización de una suscripción push se
fija en el propio `upsert` de la Edge Function `push-subscribe`, no con un
trigger automático.
**Por qué:** La regla de este `CLAUDE.md` exige `RETURN NULL` explícito en todos
los caminos de una función trigger, incluido el `EXCEPTION` — y en un trigger
`BEFORE UPDATE`, `RETURN NULL` cancela la operación en vez de solo señalar "no
hay nada que reportar" (que es lo que significa en un `AFTER`, donde el valor de
retorno se ignora). Cumplir la regla al pie de la letra en un `BEFORE UPDATE`
significaría que un error inesperado en el trigger cancelase silenciosamente la
actualización de la suscripción, que es peor que no tener el trigger. Fijar el
campo desde el código que ya está haciendo el `upsert` evita el conflicto sin
doblar la regla.
**Descartado:** Un trigger `BEFORE UPDATE` que devuelva `NEW` en el camino normal
y `NULL` solo en el `EXCEPTION` — funcionaría, pero deja una asimetría (un
`RETURN` distinto según el camino) que es fácil de copiar mal la próxima vez que
haga falta un trigger parecido.
**Revisitar:** Si aparece una segunda tabla con la misma necesidad y conviene
generalizar el patrón, evaluar entonces si un trigger bien documentado compensa
frente a repetir el campo en cada `upsert`.

### 2026-09-06 — El Service Worker es un archivo estático en `public/`, sin plugin de PWA
**Decisión:** `public/sw.js` y `public/manifest.json` se sirven tal cual, copiados
por Vite al build. No se añade `vite-plugin-pwa` ni ninguna otra dependencia de
build para gestionarlos.
**Por qué:** Es el mismo montaje que ya usa Bilans en producción, y ahí un
Service Worker de 48 líneas (solo `push` + `notificationclick`, sin caché ni
soporte offline) no ha necesitado nunca la capa de generación automática que
ofrece un plugin. Añadirlo aquí sería una dependencia nueva para un problema que
ya está resuelto con dos archivos.
**Descartado:** `vite-plugin-pwa`. Aporta generación automática de manifest,
estrategias de caché y actualización de versión — todo pensado para apps que
quieren funcionar offline, que no es el caso de Vigía.
**Revisitar:** Si algún día Vigía necesita caché offline de verdad (no solo
recibir push), ahí sí un plugin dedicado empieza a compensar su coste.

---

## Seguridad y datos

### 2026-09-03 — Las tablas nuevas viven en un schema `vigia`, no en `public`
**Decisión:** El esquema nuevo se crea en un schema de Postgres propio,
`vigia`, expuesto en la Data API de Supabase, y el cliente se configura con
`{ db: { schema: 'vigia' } }`. El `public` actual —con las `items`,
`price_history` y `settings` de la app vieja— no se toca hasta la fase 6.
**Por qué:** Las tablas nuevas se llaman igual que las viejas y comparten
proyecto de Supabase, así que crearlas en `public` obligaría o a renombrarlas
(divergiendo de toda la documentación) o a apagar la app vieja antes de tener
la nueva funcionando — justo lo que se decidió no hacer. Con un schema aparte
las dos conviven sin tocarse, la retirada de la fase 6 es un `DROP` acotado y
verificable, y si algo sale mal durante la transición la app vieja sigue
sirviendo sin haber sufrido nada.
**Descartado:** (a) Renombrar las tablas nuevas (`v_items`, `watched_items`):
arrastra un prefijo feo para siempre por un problema que dura tres fases.
(b) Un segundo proyecto de Supabase: el plan gratuito permite dos proyectos
activos y gastarlo aquí obliga a migrar los datos entre proyectos al final,
que es más trabajo y más riesgo que un `DROP`. (c) Apagar la app vieja antes:
se descartó explícitamente al hacer el plan.
**Revisitar:** En la fase 6, al retirar la app vieja, decidir si las tablas se
quedan en `vigia` (más limpio, un `search_path` distinto) o se mueven a
`public`. Moverlas es un `ALTER TABLE ... SET SCHEMA` y no rompe nada, así que
la decisión puede esperar a tener la app nueva en marcha.

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

---

## Proceso

### 2026-09-03 — Cowork planifica y documenta; Claude Code escribe el código
**Decisión:** El reparto de Bilans se adopta tal cual y queda escrito en
`docs/WORKFLOW.md`: Cowork decide, diseña y mantiene los `.md`, y prepara el
prompt; Claude Code implementa dentro de lo especificado y para si aparece un
dilema de arquitectura.
**Por qué:** Es donde cada herramienta rinde. Escribir código desde una sesión
de planificación sale caro y disperso; decidir arquitectura a mitad de un
archivo hace que la decisión no quede en ningún sitio. Además obliga a que
cada tarea pase por un prompt escrito, que es una revisión en sí misma: si no
se puede especificar, es que no está decidida.
**Descartado:** Hacerlo todo en Cowork (lento y sin poder ejecutar nada) o todo
en Claude Code (rápido, pero las decisiones no quedan documentadas y se
redescubren cada sesión).
**Revisitar:** No.

### 2026-09-03 — Guardia anti-secretos en el repositorio, no solo confianza
**Decisión:** `.gitignore` amplio (claves, certificados, volcados de base de
datos, carpetas `privado/` y archivos `*.private.md`) más un hook de
`pre-commit` en `.githooks/` que bloquea el commit si detecta un JWT, una clave
privada, un token de GitHub o un `.env` forzado.
**Por qué:** El repositorio es público y basta un despiste para publicar algo
que luego queda en el historial para siempre — borrarlo del último commit no lo
borra de los anteriores. Una lista de patrones y un hook cuestan diez minutos
una sola vez. La carpeta `privado/` existe para que haya un sitio evidente
donde dejar notas sin pensárselo.
**Descartado:** Confiar en revisar antes de cada commit (falla justo el día que
hay prisa) y montar un servicio externo de escaneo de secretos (desproporcionado
para un proyecto personal).
**Revisitar:** Si algún día el repo tiene más de una persona commiteando,
añadir el escaneo también en el CI, porque un hook local cada uno se lo activa
—o no— en su máquina.

### 2026-09-05 — El cron de la app vieja se desactiva en la fase 2, no se espera a la fase 6
**Decisión:** El job de `pg_cron` cada 15 minutos que refresca la app vieja se
desactiva (`cron.alter_job(active := false)`, sin borrarlo) al empezar la fase
2, en vez de esperar a la retirada de la fase 6.
**Por qué:** Auditar el proyecto de Supabase antes de tocar nada reveló que la
app vieja no tenía ningún dato (`items`, `price_history` y `auth.users` en 0
filas): lo único que hacía el cron era gastar ~96 peticiones diarias contra
tiendas reales sin guardar nada, exactamente el ruido que la decisión de
refresco diario (más arriba en este documento) argumenta que hay que evitar
por entrenar a las tiendas a bloquear. No había ningún dato que proteger
esperando a la fase 6.
**Descartado:** Respetar la letra de "no se toca la app vieja hasta la fase
6" a pesar de que no hay tablas ni filas que ese cron esté alimentando de
verdad. La regla protege datos, y aquí no hay datos que proteger.
**Revisitar:** No. Si algún día hiciera falta reactivarlo antes de la fase 6,
el job sigue registrado (`cron.alter_job(active := true)`).

### 2026-09-05 — `folders` entra en la primera migración, no espera a la fase 4
**Decisión:** La tabla `folders` (backlog B1) se crea en
`001_schema_inicial.sql`, junto con el resto del esquema de la fase 2, en vez
de esperar a implementarla en la fase 4.
**Por qué:** `items.itm_fld_id` ya la referencia en el esquema propuesto de
`ARQUITECTURA.md`. Crear `folders` ahora es una tabla más en un archivo que ya
se está escribiendo; dejarla para después habría significado un `ALTER TABLE
items ADD COLUMN itm_fld_id` con una FK añadida a posteriori, sobre una tabla
que para entonces ya podría tener filas.
**Descartado:** Dejarla en el backlog hasta la fase 4, que es lo que decía el
roadmap original. Se descartó porque el coste de adelantarla es prácticamente
cero (una tabla pequeña, sin lógica) y el coste de posponerla crece con el
tiempo.
**Revisitar:** No.

### 2026-09-05 — Exponer `vigia` en la Data API se resuelve por SQL, no por el toggle del dashboard
**Decisión:** El schema `vigia` se expone en la Data API con
`alter role authenticator set pgrst.db_schemas = 'public, graphql_public, vigia'`
seguido de `notify pgrst, 'reload config'`, en vez de marcarlo en Settings →
API → Exposed schemas del dashboard.
**Por qué:** En el momento de aplicar la fase 2 no había acceso inmediato al
dashboard. La documentación oficial de Supabase describe este mismo `ALTER
ROLE` como la vía de recuperación cuando el dashboard no está disponible, así
que no es un atajo improvisado.
**Consecuencia asumida, no un efecto secundario oculto:** a partir de este
`ALTER ROLE`, el dashboard **deja de gestionar** la lista de schemas
expuestos — es un aviso explícito de la documentación de Supabase. Cualquier
cambio futuro a qué schemas están expuestos (añadir uno nuevo, quitar `vigia`)
tiene que hacerse con el mismo patrón por SQL, no con el toggle. Si en algún
momento se prefiere volver a que el dashboard lo gestione, hay que hacer
`alter role authenticator reset pgrst.db_schemas` primero.
**Descartado:** Esperar a tener el dashboard a mano para usar el toggle, que
habría sido la vía por defecto de no mediar la limitación puntual de esta
sesión.
**Revisitar:** Si alguna vez conviene que el dashboard vuelva a gestionar esta
lista, documentarlo aquí en el momento de hacer el `reset`.

### 2026-09-05 — No se mueve `pg_net` fuera de `public` en esta fase
**Decisión:** El aviso `extension_in_public` de `get_advisors` sobre `pg_net`
(instalada en `public`, debería vivir en `extensions`) se deja sin corregir
por ahora.
**Por qué:** `pg_net` no es una extensión relocatable — `ALTER EXTENSION
pg_net SET SCHEMA extensions` falla en Postgres con `0A000`. Moverla de verdad
exige `DROP EXTENSION pg_net CASCADE` seguido de `CREATE EXTENSION pg_net
SCHEMA extensions`, lo que borra el historial de peticiones de `net.
_http_response` y puede romper cualquier referencia existente — incluida la
que usa `extract.ts` de la app vieja para salir por otra IP en Amazon. Es una
operación destructiva para corregir un WARN informativo, y no entraba en el
alcance mínimo aprobado para esta fase.
**Descartado:** Moverla de todos modos aprovechando que ya se estaba tocando
DDL. Se descartó en cuanto `ALTER EXTENSION` reveló que no es un movimiento
trivial.
**Revisitar:** En la fase 6, al retirar la app vieja y su uso de `pg_net` para
Amazon: en ese momento un `DROP`/`CREATE EXTENSION` ya no arriesga nada que
siga en uso, y es el momento natural para hacer la migración con seguridad.

### 2026-09-05 — La función `scrape` valida el JWT a mano, desplegada con `--no-verify-jwt`
**Decisión:** `scrape` se despliega con `verify_jwt: false` y el propio
handler extrae el header `Authorization`, llama a `supabase.auth.getUser(token)`
con un cliente `anon` y responde 401 si no hay usuario válido.
**Por qué:** Es exactamente el patrón que fija `CLAUDE.md` ("Edge Functions:
desplegar con `--no-verify-jwt` y validar el token a mano en el handler.
Mantener el criterio igual en todas"). Cumple a la vez el pedido de Tony de
sustituir la clave compartida de la app vieja (`x-key` fija en el código) por
el JWT real del usuario logueado — el resultado de seguridad es el mismo que
`verify_jwt: true`, solo que la verificación la hace el código propio en vez
del flag automático de Supabase, así que el criterio queda uniforme con el
resto de funciones que se añadan después.
**Descartado:** `verify_jwt: true` (el valor por defecto que recomienda la
documentación de Supabase para casos generales). Se descartó porque `CLAUDE.md`
ya fija el criterio contrario para este proyecto, y cambiarlo función por
función rompería la uniformidad que la regla busca.
**Revisitar:** Si `CLAUDE.md` cambia ese criterio para todo el proyecto.

### 2026-09-05 — Fase 5 se cierra solo con el botón manual; `pg_cron` queda para otra sesión
**Decisión:** El refresco automático diario vía `pg_cron` (descrito en
`ARQUITECTURA.md`) no se implementa en la sesión que cerró las fases 3 y 4;
solo el botón «Actualizar» manual.
**Por qué:** El objetivo del día era probar la app funcionando con datos
reales en la propia sesión. Un job de `pg_cron` diario no se puede verificar
en el momento (tarda horas en dispararse), así que añadirlo no aportaba nada
observable hoy y sí más superficie de código sin probar. El botón manual ya
cubre "ver la funcionalidad funcionando", que era el objetivo real.
**Descartado:** Implementar también el cron "ya que se estaba tocando refresco".
Se descartó porque no había forma de comprobarlo en la sesión, y `user_settings`
(que guarda la preferencia de frecuencia) ya existe desde la fase 2 sin que
nada dependa de tenerlo ahora mismo.
**Revisitar:** En la próxima sesión dedicada a la fase 5 completa (backlog B8
en `ROADMAP.md`).

### 2026-09-06 — El disparador del refresco automático es `pg_cron` + `pg_net` dentro de Supabase, no un cron de Vercel
**Decisión:** El pase automático diario/12h/6h se dispara desde un job de
`pg_cron` en la propia base de datos, que llama a la Edge Function `refresh` vía
`pg_net`. No se usa el cron de Vercel (el mecanismo que dispara el push diario en
Bilans), aunque era la opción más rápida de verificar.
**Por qué:** El plan Hobby de Vercel solo permite un cron al día y con la hora
aproximada, no garantizada al minuto. Adoptarlo habría obligado a retirar las
opciones `12h`/`6h` de `us_refresh_mode` y a volver decorativo `us_refresh_hour`
— es decir, sacrificar una decisión de producto ya tomada (la de arriba, "Refresco:
el botón es el camino principal...") para acomodar una limitación de plataforma.
Con `pg_cron` horario dentro de Supabase, la hora elegida por el usuario se
respeta de verdad y las tres frecuencias siguen siendo reales. Además, portar
`pg_net` para Amazon (backlog B9) ya iba a exigir esa infraestructura en la BD, así
que el job horario es cinco líneas sobre algo que hay que construir de todos
modos.
**El secreto no va en el comando del job.** Al revisar `cron.job` se encontró que
el job heredado (`jobid=1`, `muebles-refresh-precios`, inactivo desde la decisión
del 2026-09-05) lleva su clave compartida en texto plano dentro de
`cron.job.command` (`"x-key":"okeaq2s5"`), legible por cualquiera con `select`
sobre esa tabla del sistema. El `CRON_SECRET` nuevo se genera con
`extensions.gen_random_bytes(32)` y se guarda en Supabase Vault
(`vault.create_secret`), nunca en el texto del `cron.schedule`. La función
`vigia.run_scheduled_refresh()` lo lee de `vault.decrypted_secrets` en tiempo de
ejecución.
**Descartado:** (a) Cron de Vercel, por la pérdida de 12h/6h explicada arriba.
(b) Guardar el secreto en una tabla propia sin cifrar: es exactamente el error
que se acaba de encontrar en el job heredado. (c) Guardarlo como variable de
entorno de la función y pasarlo también al job: duplica el secreto en dos sitios
sin necesidad, cuando Vault ya resuelve guardar-uno-leer-uno sin que aparezca en
ningún archivo del repositorio.
**Revisitar:** Si algún día se necesita refresco por artículo (no por usuario) en
vez de por franja horaria — eso ya estaba señalado como decisión nueva en la
entrada de refresco de arriba.

### 2026-09-06 — El mínimo y máximo histórico se materializan en `items`, no se calculan en consulta
**Decisión:** `vigia.items` gana dos columnas, `itm_min_price` e `itm_max_price`,
mantenidas por un trigger `AFTER INSERT` sobre `price_history`. Cierra el backlog
B3, que dejaba la elección abierta.
**Por qué:** El pase de refresco necesita el mínimo histórico *antes* de escribir
el precio nuevo, para decidir si avisar por "toca mínimo" (backlog B4). Tenerlo ya
en la fila del artículo que el pase acaba de leer es gratis; calcularlo con
`min(ph_price)` sería una consulta agregada más por artículo, justo en el camino
que tiene un presupuesto de tiempo ajustado (el límite de 5 minutos de las Edge
Functions). Además la lista de la interfaz puede pintar "mínimo: X €" sin tocar
`price_history` en absoluto.
**Descartado:** Calcularlo en consulta cada vez. Es más simple y no puede
desincronizarse, pero cuesta una consulta agregada extra multiplicada por cada
artículo del pase nocturno, exactamente donde no sobra tiempo.
**Revisitar:** Si algún día se permite borrar filas sueltas de `price_history`
(hoy no se borran nunca, según `ARQUITECTURA.md`), el trigger tendría que
recalcular en el `DELETE` en vez de limitarse a `least`/`greatest` en el `INSERT`.

### 2026-09-06 — El aviso de bajada de precio se hace idempotente con una columna en `items`, no con una tabla de notificaciones
**Decisión:** `itm_notified_price` guarda el último precio por el que ya se avisó
a un artículo. Solo se manda un aviso nuevo si `itm_notified_price IS NULL` o el
precio nuevo es menor que ese valor.
**Por qué:** Lo que hay que recordar es "¿ya avisé del precio actual de este
artículo?", que es una relación uno a uno con el artículo, no un histórico de
avisos. Una tabla aparte tendría sentido si hiciera falta un registro auditable de
notificaciones enviadas, o si un artículo pudiera tener varios avisos vivos a la
vez — ninguna de las dos cosas es el caso. La columna además desaparece sola con
el `ON DELETE CASCADE` del artículo, sin una política RLS más que mantener. La
regla de comparación (`nuevo < itm_notified_price`, nunca se resetea al subir)
hace que un rebote de precio (baja, sube, vuelve a bajar por debajo del último
aviso) siga avisando correctamente sin lógica adicional.
**Descartado:** Tabla `notifications` con una fila por aviso enviado. Se
descartó por ser la pieza más pesada para un problema que es un flag por
artículo, no un log.
**Revisitar:** Si algún día se quiere un historial de "qué avisos se han
mandado" visible para el usuario (más que el estado actual), eso sí justificaría
la tabla.

### 2026-09-06 — El umbral del aviso es configurable, con dos condiciones que lo puentean
**Decisión:** `user_settings` gana `us_notify_enabled`, `us_notify_kind`
(`any`/`pct`/`eur`), `us_notify_pct`, `us_notify_eur`, `us_notify_min_hist` y
`us_notify_back_in_stock`. Por defecto, cualquier bajada avisa. El usuario puede
subir el umbral a un porcentaje o a un importe en euros. "Toca mínimo histórico"
y "vuelve a haber stock" avisan siempre que estén activados, sin pasar por el
umbral.
**Por qué:** El backlog B4 preveía un aviso simple ("destacarlo en la lista");
Tony pidió explícitamente poder ajustarlo desde ajustes. Puentear el umbral en
los dos casos especiales es intencional: tocar el mínimo histórico es la señal
que de verdad importa para decidir comprar, aunque la bajada sea de pocos
céntimos, y "vuelve a haber stock" no es una bajada de precio en absoluto, así
que aplicarle un umbral en % no tendría sentido.
**Descartado:** Un único umbral fijo en código. Se descartó porque lo que es
ruido para un artículo de 30 € es una señal real para uno de 900 €, y un
porcentaje o un importe fijo no sirven igual de bien para ambos — dejar los dos
modos y que el usuario elija evita tener que acertar a la primera.
**Revisitar:** No, salvo que aparezca demanda de un umbral por artículo en vez de
por usuario.

### 2026-09-06 — Notificaciones push nativas (Web Push + VAPID), portadas de Bilans, no un servicio de terceros
**Decisión:** El aviso llega como notificación push del sistema operativo, con
el mismo mecanismo que ya usa Bilans: Web Push RFC 8291 con claves VAPID propias,
sin Firebase Cloud Messaging, sin OneSignal y sin ningún SMTP de por medio.
**Por qué:** Es exactamente la decisión que Bilans ya tomó y ya tiene
funcionando en producción a coste cero (`Bilans/docs/decisions.md`, "Push
notifications con VAPID nativo"), y las dos apps comparten el mismo criterio de
"cero dependencias nuevas sin justificación" de este `CLAUDE.md`. Reutilizar el
mismo mecanismo (mismo Service Worker, mismo par de funciones de criptografía)
evita descubrir de nuevo las trampas que esa implementación ya resolvió: la
importación de la clave ECDSA como JWK porque Deno no soporta `'raw'`, la
cabecera `Service-Worker-Allowed`, el origen `'null'` de una PWA en modo
standalone.
**Descartado:** Firebase Cloud Messaging — añade una dependencia de Google y un
SDK en el frontend por un problema que Web Push nativo ya resuelve sin ninguna
de las dos cosas. Un email por SMTP — es un canal distinto, más lento de ver en
el móvil, y no resuelve el "popup en el móvil como en Bilans" que Tony pidió
explícitamente; además ligarlo al SMTP propio (backlog B7, todavía sin resolver)
habría bloqueado el aviso a que se resolviera un problema no relacionado.
**Revisitar:** Si algún día hace falta push en iOS Safari sin instalar la PWA —
ni Web Push nativo ni FCM lo resuelven hoy, es una limitación de Apple.

### 2026-09-06 — Las ideas de búsqueda visual y de integrar un mueble en una foto quedan fuera de la app
**Decisión:** No se construye un buscador de productos similares por imagen o
URL, ni una función que componga un mueble guardado sobre la foto de un salón.
Ambas se resuelven a mano, fuera de la app: un botón «Copiar para Claude» en cada
artículo y en cada carpeta copia título, precio, URL e imagen en texto limpio, y
esa información se pega en una conversación con Claude cuando haga falta
inspiración o una composición visual.
**Por qué:** Son dos problemas distintos con el mismo veredicto por caminos
distintos. El buscador de similares **es**, literalmente, el descubrimiento de
productos que la primera decisión de este documento excluye del alcance de
Vigía — construirlo no sería añadir una función, sería deshacer esa decisión.
Integrar un mueble en una foto no rompe el alcance (no descubre nada nuevo, es
una ayuda visual sobre algo que ya se guardó), pero no existe ninguna vía para
hacerlo dentro de la app a coste 0 €: todo modelo de visión o de generación de
imagen se factura por uso. La vía manual con Claude resuelve las dos con las
herramientas que Tony ya paga en su suscripción, sin escribir ni mantener código
nuevo.
**Descartado:** Automatizarlo dentro de la app con una API de pago (Google
Lens/Vision, Bing Visual Search, un modelo de generación de imágenes). Queda
documentado con cifras reales en `docs/ESTUDIO-IMAGEN.md` para poder reabrirlo
con información si algún día compensa, en vez de decidirlo hoy a ciegas.
**Revisitar:** La búsqueda de similares, con la misma señal que la decisión de
alcance original: usuarios reales pidiendo comparar productos que no han
guardado. La integración visual, si en algún momento se usa tan a menudo a mano
que compense pagar por automatizarla — la cifra concreta está en
`docs/ESTUDIO-IMAGEN.md`.

### 2026-09-06 — Carpetas compartidas: jerarquía de dos niveles e invitación con aceptación
**Decisión:** Se implementa la funcionalidad completa diseñada en
`docs/superpowers/specs/2026-09-06-carpetas-compartidas-design.md`: carpetas
en dos niveles (`fld_parent_id`), tabla `folder_shares` para invitar a
compartir una carpeta de primer nivel, Edge Function `invite-to-folder` que
resuelve el email a cuenta con `service_role` sin filtrar si existe o no, y
RLS combinada (dueño o carpeta compartida aceptada) vía la función
`vigia.visible_folder_ids()`.
**Por qué:** Tony quería que él y su pareja pudieran tener cada uno sus
propias carpetas privadas (electrónica, cremas…) y a la vez compartir
íntegramente otras (muebles), con subcarpetas dentro de ambos casos, cada uno
con su propia cuenta.
**Ajuste sobre el diseño original, encontrado al construir la UI:**
`folder_shares` gana la columna `shr_fld_name`, que el diseño no prevía. Sin
ella, el invitado no puede ver el nombre de la carpeta que le están
compartiendo antes de aceptar — la RLS de `folders` solo da acceso de lectura
una vez `shr_status = 'accepted'`, así que mostrar "te han compartido «X»" en
el banner de invitaciones pendientes exigía o bien romper esa RLS para dar
una rendija de lectura anticipada, o denormalizar el nombre en el momento de
invitar. Se eligió lo segundo (migración 013): no abre ninguna vía nueva de
acceso a datos ajenos, porque el nombre de una carpeta no es información
sensible una vez que su dueño ya ha decidido explícitamente compartirla con
ese email.
**Consolidación de políticas RLS:** el `get_advisors` de rendimiento marcó
`multiple_permissive_policies` en `folders`/`items`/`folder_shares` tras
aplicar la RLS combinada (dos políticas separadas para la misma acción, que
Postgres evalúa ambas por fila). Se consolidaron en una sola política por
acción con la condición unida por `OR` (migración 012), sin cambiar el
comportamiento.
**Descartado:** dar acceso de lectura a `folders` antes de aceptar (abriría
una vía de fuga distinta: vería también cuántas subcarpetas tiene, su
`fld_order`, etc., no solo el nombre). Rol de "solo lectura" para el
invitado — no pedido, permisos iguales al dueño en toda esta versión.
**Revisitar:** si algún día se comparte con más de una persona a la vez de
forma habitual (hoy pensado para el caso dueño + un invitado, típicamente
pareja), o si se pide compartir una subcarpeta suelta sin compartir toda la
carpeta padre.

### 2026-09-06 — Las carpetas salen de Ajustes a su propio modal, con asignación rápida desde la fila
**Decisión:** `FolderManager` deja de vivir dentro de `SettingsModal` y pasa a
ser `FolderManagerModal`, un modal propio con su botón de icono en la
cabecera junto a Ajustes. Además, cada fila de artículo (`ItemRow.jsx`) gana
un selector de carpeta compacto (chip + `<select>` nativo superpuesto) para
mover un artículo sin abrir ningún modal.
**Por qué:** Tony probó la versión anterior y señaló dos problemas: (1) el
botón "Añadir carpeta" no funcionaba, y (2) gestionar carpetas escondidas
dentro de Ajustes no era el sitio natural, ni había forma rápida de asignar
carpeta a un artículo sin entrar a editarlo. El bug (1) tenía una causa
concreta: `SettingsModal` es un `<form>` completo (para el botón "Guardar"),
y el `FolderManager` de dentro tenía sus propios `<form>` anidados para
"Añadir carpeta"/"Añadir subcarpeta" — un `<form>` dentro de otro `<form>` es
HTML inválido, y el navegador podía interpretar el submit del formulario
interior como el del exterior, disparando `handleSave` de Ajustes en vez de
`createFolder`. Sacar la gestión de carpetas a su propio modal (sin `<form>`,
solo botones `type="button"` y `Enter` a mano en los inputs) resuelve el bug
de raíz, no solo el síntoma, y de paso resuelve el problema de ubicación que
Tony señaló por separado.
**Verificado:** con un harness de desarrollo temporal (sin tocar el flujo de
login real, para no volver a gastar el límite del SMTP de pruebas) se
reprodujo el click de "Añadir" y se confirmó en consola que ahora llega
correctamente a `createFolder` con el nombre tecleado, sin interferencia de
ningún otro formulario.
**Descartado:** arreglar solo el bug dejando la ubicación dentro de Ajustes
— habría dejado sin resolver la queja de diseño real de Tony en la misma
sesión que la señaló.
**Revisitar:** No.

### 2026-09-06 — El sidebar de carpetas sustituye al modal de gestión
**Decisión:** `FolderManagerModal` (el modal que abría "Carpetas" en la
cabecera) se retira. En su lugar, un sidebar fijo a la izquierda
(`FolderSidebar.jsx`) con el árbol de dos niveles, siempre visible en
escritorio y como panel deslizante en móvil. Clic en una carpeta filtra la
lista de artículos a esa carpeta (y sus subcarpetas si es de primer nivel);
"Todos los artículos" arriba quita el filtro. Las acciones (renombrar, nueva
subcarpeta, compartir, borrar) viven en un menú «⋮» que solo aparece al pasar
el ratón sobre la fila, no como botones de texto permanentes.
**Por qué:** Tony probó el modal y señaló dos problemas de fondo: todo se
mezclaba en una sola lista (carpetas de gestión y artículos sin relación
visual entre ambos) y los botones de acción eran texto diminuto, incómodo de
pulsar. Es exactamente el patrón que resuelven Notion, Linear, Gmail y
Todoist con un sidebar de navegación: la carpeta se selecciona para filtrar,
no se "gestiona" en un panel aparte, y las acciones secundarias se ocultan
tras un menú para no competir visualmente con la navegación.
**Verificado:** con un harness de desarrollo temporal (mismo criterio que la
sesión de las carpetas: no volver a gastar el límite del SMTP de pruebas) se
comprobó el filtrado al seleccionar una carpeta, el conteo correcto en
carpetas de primer nivel (suma de sus subcarpetas), la apertura y cierre del
menú «⋮» al clic fuera, y que el layout se comporta en columnas correctamente.
**Descartado:** mantener el modal y solo agrandar los botones — no resolvía
el problema real de "todo mezclado en una lista".
**Revisitar:** No.

### 2026-09-07 — Total visible al filtrar por carpeta, selector de carpeta propio, icono de etiqueta, y comparador puntual de conjuntos
**Decisión, cuatro piezas de la misma ronda de feedback:**
1. La vista filtrada a una carpeta (`groupByFolder=false` en `ItemList.jsx`)
   gana una cabecera con el recuento y la suma total, igual que ya tenían las
   cabeceras de grupo en la vista "Todos". Antes solo el sidebar mostraba un
   total, y desaparecía al entrar en una carpeta.
2. El selector de carpeta de cada fila (`ItemRow.jsx`) deja de ser un
   `<select>` nativo superpuesto con opacidad 0. Se sustituye por un
   desplegable propio con los tokens del proyecto, porque un `<select>`
   nativo no permite controlar el color de sus `<option>` de forma fiable
   entre navegadores — el bug real que Tony reportó (texto en blanco sobre
   fondo blanco al abrir el desplegable) no tenía arreglo parcial fiable.
3. El icono de "carpeta" en ese selector de fila pasa a ser una etiqueta
   (`IconEtiqueta`), menos literal que un archivador de sistema operativo —
   aquí una carpeta se trata como una categoría del artículo, no como un
   contenedor de archivos. El sidebar de navegación conserva `IconCarpeta`
   porque ahí sí es una carpeta de verdad (se crea, se renombra, se borra).
4. Comparador de conjuntos: un modo "Comparar" (botón en la cabecera) añade
   un checkbox a cada fila visible, **cruzando carpetas** (comparar un sofá
   de Muebles con un teclado de Electrónica es el caso de uso real que Tony
   describió). Se pueden seleccionar artículos, darles un nombre y "Guardar
   conjunto"; los conjuntos guardados se ven lado a lado con su suma y el más
   barato resaltado. Todo vive en memoria (`useComparison.js`) y se pierde al
   salir del modo o recargar — Tony lo pidió explícitamente como puntual, no
   como algo que necesite guardarse en la base de datos.
**Por qué el comparador no persiste:** evita una tabla nueva, una migración
y una decisión de RLS para una funcionalidad que el propio Tony calificó de
"mientras lo miro". Si en el futuro se pide guardarlo entre sesiones, es una
decisión nueva y aditiva (tabla `comparison_sets`, o similar).
**Verificado:** con un harness de desarrollo temporal (mismo criterio que las
rondas anteriores — no tocar el servidor real ni volver a gastar el SMTP de
pruebas), se comprobó el filtrado cruzando dos carpetas distintas, el resaltado
de la fila seleccionada, el guardado de dos conjuntos con nombres distintos, y
que el conjunto más barato se marca correctamente.
**Descartado:** arrastrar artículos a "cajas" de comparación — más vistoso
pero peor en móvil (arrastrar sin ratón) y más complejo de construir bien;
Tony prefirió explícitamente el checkbox + guardar.
**Revisitar:** si se pide persistencia del comparador entre sesiones.

### 2026-09-07 — El desplegable de carpeta ya no queda recortado por la fila
**Decisión:** se quita `overflow-hidden` del `<article>` de `ItemRow.jsx`; la
franja lateral de color (que era la razón de tenerlo) pasa a llevar su propio
`rounded-l-lg` en vez de depender del recorte del padre.
**Por qué:** Tony reportó, con captura, que al abrir el desplegable de
carpeta en una fila, este quedaba clipeado dentro de los límites de esa
misma fila y se veía montado sobre la píldora de porcentaje de la fila
siguiente — ilegible. La causa era el `overflow-hidden` de la fila: el
desplegable usa `position: absolute` para flotar por encima del resto de la
lista, y un ancestro con `overflow-hidden` recorta cualquier hijo
posicionado que intente salirse de su propio área, aunque el `z-index` sea
correcto.
**Verificado:** con un harness de desarrollo temporal (misma cautela de
siempre: no tocar el servidor real de Tony ni volver a gastar el SMTP), se
reprodujeron tres filas seguidas y se abrió el desplegable de la última —
ya flota limpio por encima, sin solaparse con nada.
**Revisitar:** No.

### 2026-09-07 — Miniatura de artículo más grande, con borde propio y recorte sesgado hacia arriba
**Decisión:** la miniatura de `ItemRow.jsx` sube de 54×54 a 68×68 px, gana un
`border border-line` propio (antes solo tenía el color de fondo `surface-2`),
y su `object-position` pasa de `center` (50/50) a `50% 35%`.
**Por qué:** Tony reportó, con captura, que algunas miniaturas se ven como
fragmentos irreconocibles de foto — la causa de fondo es que varias tiendas
(Sklum, Kave Home) publican como imagen principal una foto de ambiente
completa (el salón entero decorado), no una foto de producto recortada sobre
fondo blanco. Con una caja pequeña y `object-cover` centrado, el recorte cae
donde toque — a veces techo, a veces suelo vacío, casi nunca el mueble en sí.
Subir el tamaño ayuda a que quepa más contexto reconocible; sesgar el punto
de recorte al 35% vertical (en vez del 50% centrado) apunta al tercio
superior-medio de la foto, que es donde suele estar el mueble en una foto de
ambiente estándar (encima del suelo, no en el techo). El borde propio evita
que una foto oscura se funda visualmente con el fondo de la fila.
**No resuelve del todo:** una foto muy panorámica o con el mueble descentrado
seguirá recortando mal en algunos casos — es una mejora estadística de
encuadre, no una garantía. Las alternativas más completas (difuminar el
fondo, o depender de la vista "Fotos" en rejilla que ya prevé `docs/DISENO.md`)
se descartaron explícitamente por ahora: Tony pidió el ajuste más simple.
**Verificado:** con un harness de desarrollo temporal y una imagen generada
localmente (sin depender de red externa, que el sandbox del navegador
bloquea) simulando una foto de ambiente vertical con el "mueble" en el
tercio superior — el recorte muestra la franja del mueble en vez de un
fragmento vacío.
**Descartado:** `object-contain` (dejaría barras vacías y seguiría sin
mostrar un fragmento reconocible en fotos muy distintas de proporción a
1:1); difuminar el fondo (oculta el problema, más currado de construir);
forzar la vista "Fotos" — queda como opción futura si el problema persiste.
**Revisitar:** si Tony sigue viendo miniaturas irreconocibles tras esta
mejora, considerar la vista "Fotos" en rejilla (ya prevista en
`docs/DISENO.md`) como vía alternativa para ver bien la imagen completa.

### 2026-09-06 — El SMTP de pruebas de Supabase no sirve para ciclos de desarrollo con login repetido
**Hallazgo, no decisión de diseño, pero que condiciona el trabajo futuro:**
pedir el enlace mágico varias veces seguidas para verificar login y luego
"añadir artículo" chocó con `429 over_email_send_rate_limit` de forma
repetida. La documentación oficial de Supabase confirma que el SMTP integrado
gratuito está pensado solo para probar plantillas de correo, con límites bajos
que pueden cambiar sin aviso — no para desarrollo con múltiples inicios de
sesión en poco tiempo.
**Qué se hizo en el momento:** esperar a que el límite se liberase (varios
minutos) y, cuando el correo llegó pero el cliente de correo de Tony no lo
mostró como enlace clicable, verificar el flujo pidiéndole que abriera él
mismo la URL completa (visible en el texto plano del correo) en su propio
navegador. Se descartó explícitamente generar el enlace por la vía
`service_role` + `auth.admin.generateLink` sin pasar por email: el sistema de
permisos bloqueó el intento por tratarse de una función que toca autenticación
de forma sensible, y no se buscó ningún rodeo.
**Pendiente (backlog B7):** configurar SMTP propio (Resend u otro proveedor
con plan gratuito) antes de la próxima sesión de pruebas intensivas con login.
**Revisitar:** En cuanto se retome el trabajo de auth/login con datos reales.
