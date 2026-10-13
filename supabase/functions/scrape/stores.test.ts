import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { readPage } from './parse.ts'

// Barrido de tiendas (sesión 39): recortes de fichas reales, sacados en el
// navegador el 2026-10-14 (los bloques JSON-LD y metas de producto, sin
// opiniones ni descripciones). El precio esperado es el que enseñaba la
// página. Si un cambio del lector rompe una tienda, falla aquí. Para añadir
// una: guardar su recorte en fixtures/ y una fila en STORES.

interface Store {
  file: string;
  url: string;
  price: number;
  inStock: boolean | null;
  title: string;
}

const STORES: Store[] = [
  {
    file: 'pccomponentes.html',
    url: 'https://www.pccomponentes.com/procesador-amd-ryzen-7-9700x-3-8-5-5ghz',
    price: 304.79, // la oferta que enseña la página; el lowPrice (304,78) es de otro vendedor
    inStock: true,
    title: 'AMD Ryzen 7 9700X 3.8/5.5GHz',
  },
  {
    file: 'mediamarkt.html',
    url: 'https://www.mediamarkt.es/es/product/_raton-gaming-logitech-g-g502-hero-sensor-hero-25k-25600-dpi-rgb-peso-personalizable-memoria-integrada-11-botones-programables-negro-1438627.html',
    price: 37.95,
    inStock: true,
    title: 'Ratón gaming - Logitech G G502 Hero',
  },
  {
    file: 'elcorteingles.html',
    url: 'https://www.elcorteingles.es/electronica/A36296707-5099206089167-pr-raton-optico-gaming-logitech-g203-lightsync-negro-negro/',
    price: 31.99,
    inStock: true,
    title: 'Ratón óptico Gaming Logitech G203 LightSync - Negro',
  },
  {
    file: 'coolmod.html',
    url: 'https://www.coolmod.com/samsung-t9-ssd-1tb-usb3-2-gen2x2/',
    price: 189.95,
    inStock: true,
    title: 'Disco Duro Externo Samsung T9 SSD 1TB USB 3.2 Negro',
  },
  {
    file: 'alternate.html',
    url: 'https://www.alternate.es/Logitech/M100-Rat%C3%B3n/html/product/1905874',
    price: 7.59,
    inStock: true,
    title: 'M100, Ratón',
  },
  {
    file: 'decathlon.html',
    url: 'https://www.decathlon.es/es/p/esterilla-de-yoga-confort-173-cm-x-61-cm-x-8-mm-azul-oscuro/15191/c364c344m8665059',
    price: 29.99,
    inStock: true,
    title: 'Esterilla de yoga Confort 173 cm x 61 cm x 8 mm azul oscuro',
  },
  {
    // Misma ficha (todas las variantes) abierta en otro color: vale su precio,
    // no el del primer Product.
    file: 'decathlon.html',
    url: 'https://www.decathlon.es/es/p/esterilla-de-yoga-confort-173-cm-x-61-cm-x-8-mm-burdeos/15191/c106c344m8644104',
    price: 24.99,
    inStock: true,
    title: 'Esterilla de yoga Confort 173 cm x 61 cm x 8 mm burdeos',
  },
  {
    // El precio va en una lista de priceSpecification, con el tachado al lado.
    file: 'ikea.html',
    url: 'https://www.ikea.com/es/es/p/kallax-estanteria-blanco-80275887/',
    price: 54.99,
    inStock: true,
    title: 'KALLAX Estantería - blanco 77x147 cm',
  },
  {
    file: 'leroymerlin.html',
    url: 'https://www.leroymerlin.es/productos/taladro-percutor-a-bateria-worx-20v-brushless-2-baterias-wx356-98695907.html',
    price: 219,
    inStock: true,
    title: 'Taladro percutor a batería WORX 20V Brushless',
  },
  {
    // Dos tallas; la otra (119 €) está agotada.
    file: 'zarahome.html',
    url: 'https://www.zarahome.com/es/espejo-ondas-l46382106?pelement=507789965',
    price: 99.99,
    inStock: true,
    title: 'ESPEJO ONDAS',
  },
  {
    // AggregateOffer sin ofertas dentro ni disponibilidad.
    file: 'conforama.html',
    url: 'https://www.conforama.es/sofa-cama-3-plazas-bowy',
    price: 159,
    inStock: null,
    title: 'Sofá cama 3 plazas BOWY',
  },
  {
    // Sin JSON-LD: precio de la zona corePriceDisplay (a-offscreen vacío,
    // entero + fracción); el «Precio recomendado» no cuenta.
    file: 'amazon.html',
    url: 'https://www.amazon.es/Logitech-Silencioso-inal%C3%A1mbrico-seguimiento-compatible/dp/B07W6HCFYX?th=1',
    price: 12.99,
    inStock: true,
    title: 'Logitech M240 Silencioso Bluetooth Ratón',
  },
  {
    // Una oferta por acabado. La dirección elige el beige (?id_c=617585),
    // el que enseña la página por defecto.
    file: 'sklum.html',
    url: 'https://www.sklum.com/es/comprar-bases-para-lamparas/219212-base-para-lampara-de-mesa-en-piedra-natural-orlena.html?id_c=617585&utm_source=x',
    price: 32.95,
    inStock: true,
    title: 'Base para lámpara de mesa en piedra natural Orlena',
  },
  {
    // Sin acabado en la dirección, el JSON-LD no dice cuál sale por defecto:
    // la más barata (mármol verde).
    file: 'sklum.html',
    url: 'https://www.sklum.com/es/comprar-bases-para-lamparas/219212-base-para-lampara-de-mesa-en-piedra-natural-orlena.html',
    price: 20.95,
    inStock: true,
    title: 'Base para lámpara de mesa en piedra natural Orlena',
  },
  {
    file: 'jysk.html',
    url: 'https://jysk.es/almacenaje/comodas/comoda-4-cajones-markskel-blanco-color-roble-salvaje-natural',
    price: 200,
    inStock: true,
    title: 'Cómoda 4 cajones MARKSKEL',
  },
  {
    // Shopify (como miles de tiendas pequeñas): ProductGroup con hasVariant.
    file: 'arenaa-shopify.html',
    url: 'https://arenaa.es/products/aparador-mikonos',
    price: 199,
    inStock: true,
    title: 'Aparador Mikonos',
  },
  {
    // WooCommerce: Product dentro de @graph.
    file: 'papelespintadosdc-woocommerce.html',
    url: 'https://papelespintadosdc.com/producto/papel-pintado-jaipur-488-3/',
    price: 49.9,
    inStock: true,
    title: 'Papel Pintado Jaipur 488-3',
  },
  {
    // Precio por m², solo en priceSpecification.
    file: 'photowall.html',
    url: 'https://www.photowall.es/classic-pinstripe-pattern-red-papel-pintado',
    price: 35,
    inStock: true,
    title: 'Patrón Clásico de Raya Diplomática - Rojo',
  },
  {
    // El Product es el sexto nodo del @graph.
    file: 'kavehome.html',
    url: 'https://kavehome.com/es/es/p/mesa-extensible-erisia-de-madera-maciza-de-roble-con-acabado-ebonizado-180-230-x-90-cm-fsc-100',
    price: 999,
    inStock: true,
    title: 'Mesa extensible Erisia',
  },
  {
    file: 'wallapop.html',
    url: 'https://es.wallapop.com/item/lampara-de-pie-hektar-gris-1309402404',
    price: 29,
    inStock: true,
    title: 'Lámpara de pie Hektar gris',
  },
]

describe('barrido de tiendas', () => {
  for (const s of STORES) {
    it(`${s.file} → ${s.price} €`, () => {
      const html = readFileSync(new URL(`./fixtures/${s.file}`, import.meta.url), 'utf8')
      const read = readPage(html, s.url)
      expect(read).toMatchObject({ blocked: false, price: s.price, inStock: s.inStock })
      expect((read as { title: string }).title).toContain(s.title)
    })
  }
})
