# Estudio de viabilidad — búsqueda visual e integración de imagen

> No se construye nada de esto en la app. Se deja documentado con cifras para
> poder reabrirlo con información en vez de a ciegas. Ver la decisión completa
> en `docs/DECISIONES.md`, 2026-09-06, "Las ideas de búsqueda visual y de
> integrar un mueble en una foto quedan fuera de la app".

## Qué se pidió

1. Un buscador de productos similares a partir de una imagen o de la URL de un
   artículo ya guardado, para explorar alternativas en otras tiendas.
2. Una función que componga uno de los muebles guardados sobre la foto de un
   salón real, para ver cómo quedaría antes de decidir.

## Cómo se resuelve hoy, sin construir nada

El botón «Copiar para Claude» (`src/lib/clipboard.js`) copia título, precio,
URL e imagen de un artículo o de una carpeta entera en texto limpio. Se pega
esa información en una conversación con Claude y se pide directamente la
búsqueda de similares o la composición visual. Coste: 0 €, con la suscripción
que ya se paga. Sin código nuevo que mantener, sin credenciales nuevas que
gestionar, sin superficie de ataque nueva.

## Qué haría falta para automatizarlo dentro de la app

### Búsqueda visual (idea 1)

| Opción | Qué hace | Precio real | Capa gratis |
|---|---|---|---|
| Google Cloud Vision API (Web Detection) | Busca páginas con imágenes visualmente similares | ~1,50 $ / 1000 imágenes tras la capa gratis | 1000 unidades/mes gratis, después de pago |
| SerpApi (Google Lens) | Scraping legal de resultados de Google Lens | Desde 75 $/mes (5000 búsquedas) | 100 búsquedas/mes en el plan de prueba, no viable en producción |
| Bing Visual Search API (Azure) | Similar a Google Lens, vía Azure Cognitive Services | ~1 $/1000 transacciones tras la capa gratis | 1000 transacciones/mes gratis los primeros 30 días, luego de pago |
| Embeddings de imagen (CLIP) + `pgvector` | Genera un vector por imagen guardada y busca por similitud coseno en Postgres | Depende del proveedor de inferencia (p. ej. Replicate: fracciones de centavo por imagen) + `pgvector` es gratis (extensión de Postgres, no instalada hoy) | Solo paga la inferencia; sin capa realmente gratis para uso continuo |

Ninguna de las cuatro tiene un nivel gratuito que aguante un uso normal y
recurrente sin tarjeta de crédito de por medio. La más barata a largo plazo
(embeddings + `pgvector`) es también la que más superficie nueva añade: un
pipeline de generación de vectores, una tabla nueva, una consulta de similitud
y un proveedor de inferencia externo.

### Composición de imagen (idea 2)

| Opción | Qué hace | Precio real |
|---|---|---|
| OpenAI (`gpt-image-1` / DALL·E edición) | Edición de imagen guiada por texto | ~0,04-0,17 $ por imagen según resolución y calidad |
| Stability AI (Stable Diffusion inpainting) | Composición/inpainting de imagen | ~0,01-0,04 $ por imagen |
| Replicate (varios modelos de composición) | Alquiler de GPU por segundo | Variable, normalmente unos céntimos por imagen |

Todas se facturan por imagen generada. Un uso ocasional (unas pocas veces al
mes) costaría céntimos; automatizarlo como función de la app implicaría además
gestionar la subida de la foto del salón, el recorte/preparación de la imagen
del mueble, y una clave de API en Secrets de Supabase — nunca en una variable
`VITE_*`, seguiría el mismo criterio que cualquier otra clave de servicio de
pago del proyecto.

## Qué se rompería del alcance

**La búsqueda de similares (idea 1) no es una función más: es exactamente el
descubrimiento de productos que `docs/DECISIONES.md` excluye del alcance de
Vigía** desde la primera decisión del proyecto (2026-09-03, "Vigía vigila lo
que tú guardas; no busca ofertas ni descubre productos"). Construirla
significaría deshacer esa decisión, no ampliarla. El argumento de fondo sigue
siendo el mismo que entonces: los agregadores que hacen esto viven de
afiliación, y ese modelo de negocio no existe aquí.

**La composición de imagen (idea 2) no rompe el alcance.** No descubre nada
nuevo: parte de un mueble que el usuario ya decidió guardar y solo ayuda a
visualizarlo. Su único freno real es el coste y el mantenimiento, no un
choque de producto.

## Qué señal reabriría cada una

- **Búsqueda de similares:** la misma señal que la decisión de alcance
  original — usuarios reales (más allá de quien mantiene el proyecto) pidiendo
  comparar productos que no han guardado. Hoy no hay usuarios, así que no hay
  señal.
- **Composición de imagen:** si el flujo manual con Claude se usa tan a menudo
  que el tiempo de copiar y pegar empieza a pesar más que el coste de
  automatizarlo. Con los precios de la tabla de arriba, el punto de equilibrio
  está en el entorno de varias composiciones por semana de uso sostenido.
