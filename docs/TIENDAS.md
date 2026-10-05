# Tiendas — Vigía

> Qué tiendas dejan leer el precio automáticamente y cuáles no.
> Actualizar esta tabla cada vez que se añada una tienda o cambie su
> comportamiento. Lo que aquí se marca como bloqueado acaba en `store_rules`
> con `sr_blocked = true`.

---

## Estado por tienda

| Tienda | Lectura | Cómo se lee | Notas |
|---|---|---|---|
| IKEA | ✅ | JSON-LD | Sin problemas conocidos. |
| Sklum | ✅ | JSON-LD | Lo que tarda en llegar lo publica como `BackOrder` («entrega estimada…»): cuenta como en stock (B28). |
| Leroy Merlin | ✅ | JSON-LD / Open Graph | |
| Amazon.es | ⚠️ | Datos embebidos, vía `pg_net` | Bloquea la IP de las Edge Functions. Funciona saliendo por la de Postgres. |
| Kave Home | ⚠️ | Extensión de Chrome (pase diario) o botón | DataDome. El servidor no puede; un navegador real sí (probado el 2026-10-01). |
| Maisons du Monde | ⚠️ | Extensión de Chrome (pase diario) o botón «Guardar en Vigía» | DataDome desde (al menos) 2026-10-01; antes, checkpoint de Vercel. El servidor no puede leerla; el navegador sí (JSON-LD de la página abierta). Con la extensión, precio diario mientras Chrome esté abierto (`extension/README.md`). Ver «Maisons du Monde: qué se probó». |
| Vinted | ✅ | JSON-LD (vendidos: datos de React) | Probado el 2026-10-04 desde la IP de Postgres y el 2026-10-06 desde la Edge Function. Segunda mano: al venderse, la ficha **no** desaparece; Vinted le quita el JSON-LD y los botones de compra y pone «Vendido» (`buyer_item_status`). El extractor saca entonces el precio de los datos de React (atado al id de la URL) y marca sin stock (B26). |
| Wallapop | ✅ | JSON-LD | Igual que Vinted (precio y `availability`). Segunda mano. |
| Shein | ❌ | — | Captcha propio (`/risk/challenge?captcha_type=909`) en búsqueda y categorías desde Supabase. Bloqueada en `store_rules` (migración 022): se guarda con precio a mano. No probado si una ficha abierta en el navegador trae JSON-LD. |
| AliExpress | ❌ | — | Una ficha pegada en la app se guardó sin precio (2026-10-04); el precio lo pinta JavaScript. Los enlaces de compartir son `a.aliexpress.com/_…` (redirigen). Bloqueada (migración 022). |
| Cualquier tienda con JSON-LD u Open Graph | ✅ | Genérico | Es el caso mayoritario. |

---

## Maisons du Monde: qué se probó (2026-10-01, sesión 21)

Desde una IP residencial (la de casa, no la de Supabase), con `curl`:

| Intento | Resultado |
|---|---|
| Ficha de producto, cabeceras de Chrome completas + cookie de la home | 403, página de DataDome (`captcha-delivery.com`) |
| Misma ficha con User-Agent de Googlebot, Pinterest, Facebook, WhatsApp, iPhone | 403 en todos |
| Páginas de categoría | 403 |
| API interna (`bff-www.maisonsdumonde.com/api/graphql`, la que usa su web) | 403, también detrás de DataDome |
| Clave pública de Algolia en el JavaScript | No hay; la búsqueda pasa por su API interna |
| Home | 200, y sus tarjetas llevan precio, pero solo salen los artículos que ellos destacan |

Desde la IP de Supabase (Edge Function o `pg_net`) será igual o peor: DataDome
castiga más las IP de centro de datos.

En un navegador de verdad la ficha sí carga, y trae el precio en JSON-LD
(`offers.price`, `availability`). **El extractor actual lo leería sin
cambios**: el problema es solo conseguir el HTML, no interpretarlo.
`isBotPage` ya reconoce la página de DataDome.

**Elegida la 1** el mismo día (botón para la barra de marcadores, ver
`docs/DECISIONES.md` 2026-10-01). Alternativas que se valoraron:

1. **Leer desde el navegador del usuario.** Un atajo de iOS («Ejecutar
   JavaScript en página web» desde compartir en Safari) o un bookmarklet en
   escritorio coge el JSON-LD de la página ya abierta y lo manda a Vigía.
   0 €, sin depender de nadie, y no es esquivar nada: es la página que el
   usuario está viendo. Da precio al añadir y cada vez que se vuelve a abrir
   la ficha; **no** da refresco automático diario.
2. **Servicio de scraping con plan gratuito** (ScrapingAnt, ScraperAPI,
   Scrapfly…). Ellos ponen navegador e IP residencial. Da refresco
   automático. Contras: dependencia externa y clave en Secrets, el modo
   anti-bot gasta muchos créditos por petición (los planes gratuitos dan para
   pocas lecturas al mes de tiendas protegidas), ninguno garantiza pasar
   DataDome, y es exactamente la «carrera» que este documento decía no querer.
   Si se prueba, solo para dominios marcados (un `sr_fetch_mode` nuevo), nunca
   para todos.
3. **Dejarlo como está** (precio manual).

Descartado sin más pruebas: navegador headless propio en GitHub Actions u
otro servidor gratuito (IP de centro de datos, DataDome lo detecta).

---

## Orden de intentos del extractor

1. **JSON-LD** (`<script type="application/ld+json">` con `@type: Product`).
   Es el camino bueno: dato estructurado y explícito.
2. **Open Graph** (`og:price:amount`, `og:title`, `og:image`).
3. **Microdatos** (`itemprop="price"`).
4. **Regla propia de la tienda**, si la hay en `store_rules`.
5. **Reintento con otro perfil de cabeceras**, por si el rechazo era por
   `User-Agent`.
6. **Salida por `pg_net`** (descarga desde la IP de Postgres) para los dominios
   marcados así.

---

## Qué significa «bloquea»

No es que la tienda esconda el precio: es que detecta que la petición no viene
de un navegador de verdad (DataDome, Cloudflare, el checkpoint de Vercel) y
devuelve una página de verificación en lugar de la del producto. Desde una
función serverless no hay forma limpia de esquivarlo, y buscarla sería empezar
una carrera que no interesa: son dos tiendas y el precio se teclea a mano en
diez segundos.

**Consecuencia de producto:** el precio manual no es un apaño temporal, es parte
del diseño, y se avisa **antes** de guardar el artículo (flujo completo en
`docs/ARQUITECTURA.md`). Un artículo con `itm_is_manual = true` no se toca en el refresco
automático, y su histórico se marca con `ph_source = 'manual'` para no mezclar
lo leído con lo tecleado.

---

## Riesgo conocido

Cuantos más artículos se vigilen de la misma tienda, y más a menudo se consulte,
más probable es que empiece a bloquear. Kave Home ya bloqueaba con diez
artículos. Es la razón de fondo por la que el refresco automático es un pase al
día y no cada quince minutos. Es un límite del enfoque,
no un fallo a corregir: para una lista personal de decenas de artículos no
molesta, y es una de las razones por las que el descubrimiento de productos está
fuera de alcance.
