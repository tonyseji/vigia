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
| Sklum | ✅ | JSON-LD | |
| Leroy Merlin | ✅ | JSON-LD / Open Graph | |
| Amazon.es | ⚠️ | Datos embebidos, vía `pg_net` | Bloquea la IP de las Edge Functions. Funciona saliendo por la de Postgres. |
| Kave Home | ❌ | — | DataDome. Precio manual. |
| Maisons du Monde | ❌ | — | Checkpoint de Vercel. Precio manual. |
| Cualquier tienda con JSON-LD u Open Graph | ✅ | Genérico | Es el caso mayoritario. |

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
del diseño. Un artículo con `itm_is_manual = true` no se toca en el refresco
automático, y su histórico se marca con `ph_source = 'manual'` para no mezclar
lo leído con lo tecleado.

---

## Riesgo conocido

Cuantos más artículos se vigilen de la misma tienda, más probable es que empiece
a bloquear. Kave Home ya bloqueaba con diez artículos. Es un límite del enfoque,
no un fallo a corregir: para una lista personal de decenas de artículos no
molesta, y es una de las razones por las que el descubrimiento de productos está
fuera de alcance.
