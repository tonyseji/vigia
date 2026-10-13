// Lector de la ficha de producto: JSON-LD (schema.org/Product) + Open Graph +
// fallbacks. Solo recibe el HTML como texto: sin red ni nada de Deno.
//
// Es el ÚNICO lector. El servidor lo usa desde extract.ts; la extensión de
// Chrome y el botón de marcadores, desde extension/parse.js, que se genera
// con `npm run build:parse` (un test falla si no está al día). Un arreglo
// aquí vale para los tres caminos (DECISIONES.md, 2026-10-14).

export interface Extracted {
  title?: string;
  image?: string;
  description?: string;
  price?: number;
  currency?: string;
  inStock?: boolean;
  source?: string; // qué método encontró el precio
  url?: string; // la dirección leída de verdad, si era un enlace corto (expandShortLink)
  variantUrl?: string; // la de la variante que elige la dirección (Sklum ?id_c=), si la hay
}

/** Páginas "200 OK" que en realidad son un muro anti-bot o un interstitial sin producto */
export function isBotPage(url: string, html: string): boolean {
  const head = html.slice(0, 20000);
  if (/Vercel Security Checkpoint|Just a moment\.\.\.|Please enable JS and disable any ad blocker|Access Denied|Pardon Our Interruption|captcha-delivery\.com|cf-browser-verification/i.test(head)) return true;
  // Shein: responde 200 con su portada y la redirección al captcha metida en
  // el estado de la página, lejos del principio (sesión 31).
  if (/\/risk\/challenge\?captcha_type=/.test(html)) return true;
  if (/amazon\./i.test(new URL(url).hostname)) {
    // producto real => tiene productTitle; si no, es el interstitial "Amazon.es" / captcha / "Continuar comprando"
    if (!/id="productTitle"/.test(html)) return true;
  }
  return false;
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&euro;/g, "€")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

/** Parsea precios en formato europeo o americano: "1.299,00 €", "1,299.00", "649", "1 299,95" */
export function parsePrice(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "number") return isFinite(raw) && raw > 0 ? raw : undefined;
  let s = String(raw).trim();
  if (!s) return undefined;
  s = s.replace(/[^\d.,]/g, ""); // fuera símbolos y espacios (incl. NBSP)
  if (!s) return undefined;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    // el último separador es el decimal
    if (lastComma > lastDot) normalized = s.replace(/\./g, "").replace(",", ".");
    else normalized = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const dec = s.length - lastComma - 1;
    const commas = (s.match(/,/g) || []).length;
    // "1,299" o "1,299,000" → miles; "649,00" / "1,5" → decimal
    if (commas > 1 || dec === 3) normalized = s.replace(/,/g, "");
    else normalized = s.replace(",", ".");
  } else if (lastDot >= 0) {
    const dec = s.length - lastDot - 1;
    const dots = (s.match(/\./g) || []).length;
    if (dots > 1 || dec === 3) normalized = s.replace(/\./g, "");
    else normalized = s;
  } else normalized = s;
  const n = parseFloat(normalized);
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
}

function metaTags(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<meta\s+([^>]*?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const attrs: Record<string, string> = {};
    const are = /([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
    let a: RegExpExecArray | null;
    while ((a = are.exec(m[1]))) attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? "";
    const key = (attrs.property || attrs.name || attrs.itemprop || "").toLowerCase();
    if (key && attrs.content != null && !(key in out)) out[key] = decodeEntities(attrs.content);
  }
  return out;
}

function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const txt = m[1].trim();
    if (!txt) continue;
    try {
      out.push(JSON.parse(txt));
    } catch {
      // algunos sitios meten varios objetos o comentarios; intento de limpieza
      try {
        out.push(JSON.parse(txt.replace(/^\s*\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1")));
      } catch { /* ignorar */ }
    }
  }
  return out;
}

// deno-lint-ignore no-explicit-any
function findProducts(node: any, acc: any[] = [], depth = 0): any[] {
  if (!node || depth > 8) return acc;
  if (Array.isArray(node)) {
    for (const n of node) findProducts(n, acc, depth + 1);
    return acc;
  }
  if (typeof node === "object") {
    const t = node["@type"];
    const types = Array.isArray(t) ? t : t ? [t] : [];
    if (types.some((x: string) => /Product$/i.test(String(x)) || /^Product/i.test(String(x)))) acc.push(node);
    for (const k of Object.keys(node)) {
      if (k === "@context") continue;
      const v = node[k];
      if (v && typeof v === "object") findProducts(v, acc, depth + 1);
    }
  }
  return acc;
}

/** schema.org/ItemAvailability. BackOrder (Sklum: «entrega estimada en
 * noviembre») se puede pedir, así que cuenta como en stock. Sin stock solo
 * cuando la tienda lo dice; lo que no se reconoce queda sin dato. */
function availabilityInStock(a: unknown): boolean | undefined {
  const s = String(a ?? "");
  if (/OutOfStock|SoldOut|Discontinued/i.test(s)) return false;
  if (/InStock|LimitedAvailability|PreOrder|PreSale|BackOrder|MadeToOrder|OnlineOnly/i.test(s)) return true;
  return undefined;
}

/** priceSpecification suelta o en lista (IKEA: el precio actual y el
 * tachado). El tachado (StrikethroughPrice, ListPrice) no es lo que se paga. */
// deno-lint-ignore no-explicit-any
function specPrice(spec: any): { price?: unknown; currency?: string } {
  const list = (Array.isArray(spec) ? spec : [spec]).filter((s) => s && typeof s === "object");
  const current = list.filter((s) => !/Strikethrough|ListPrice/i.test(String(s.priceType ?? "")));
  const s = (current.length ? current : list).find((x) => parsePrice(x.price));
  return s ? { price: s.price, currency: s.priceCurrency } : {};
}

// deno-lint-ignore no-explicit-any
function offerPrice(offers: any, pageUrl?: string): { price?: number; currency?: string; inStock?: boolean; url?: string } {
  if (!offers) return {};
  const list = Array.isArray(offers) ? offers : [offers];
  // Una oferta por acabado o talla (Sklum ?id_c=, Shopify ?variant=): si la
  // dirección de la página elige una, vale esa. Si no elige ninguna, la más
  // barata de abajo.
  const chosen = pageUrl && list.length > 1 ? list.find((o) => o && isVariantOf(o.url, pageUrl)) : undefined;
  if (chosen) return { ...offerPrice(chosen), url: abs(chosen.url, pageUrl!) };
  let best: { price?: number; currency?: string; inStock?: boolean } = {};
  for (const o of list) {
    if (!o || typeof o !== "object") continue;
    // AggregateOffer con las ofertas dentro (PcComponentes): mandan las de
    // dentro, que son lo que enseña la página. Su lowPrice puede ser el de
    // otro vendedor del marketplace.
    const nested = o.offers ? offerPrice(o.offers) : {};
    let cur: { price?: number; currency?: string; inStock?: boolean };
    if (nested.price) {
      cur = { ...nested, currency: nested.currency || o.priceCurrency, inStock: nested.inStock ?? availabilityInStock(o.availability) };
    } else {
      const spec = specPrice(o.priceSpecification);
      const cands = [o.price, o.lowPrice, spec.price, o.highPrice];
      let p: number | undefined;
      for (const c of cands) {
        p = parsePrice(c);
        if (p) break;
      }
      const currency = o.priceCurrency || spec.currency;
      cur = { price: p, currency, inStock: availabilityInStock(o.availability) ?? nested.inStock };
    }
    if (cur.price && (!best.price || cur.price < best.price)) best = cur;
  }
  return best;
}

// deno-lint-ignore no-explicit-any
function firstImage(img: any): string | undefined {
  if (!img) return undefined;
  if (typeof img === "string") return img;
  if (Array.isArray(img)) return firstImage(img[0]);
  if (typeof img === "object") return img.url || img.contentUrl || firstImage(img["@list"]);
  return undefined;
}

function abs(u: string | undefined, base: string): string | undefined {
  if (!u) return undefined;
  try {
    return new URL(u.trim(), base).toString();
  } catch {
    return undefined;
  }
}

/** La oferta es la variante que elige la página: misma ruta y todos los
 * parámetros de la oferta (id_c, variant…) con el mismo valor en la
 * dirección de la página, que puede llevar otros (utm…). */
function isVariantOf(offerUrl: unknown, pageUrl: string): boolean {
  if (typeof offerUrl !== "string") return false;
  try {
    const o = new URL(offerUrl, pageUrl);
    const p = new URL(pageUrl);
    if (o.host !== p.host || o.pathname.replace(/\/$/, "") !== p.pathname.replace(/\/$/, "")) return false;
    const params = [...o.searchParams];
    return params.length > 0 && params.every(([k, v]) => p.searchParams.get(k) === v);
  } catch {
    return false;
  }
}

/** El producto (o una de sus ofertas) apunta a esta misma página, sin
 * contar parámetros ni la barra final. */
// deno-lint-ignore no-explicit-any
function isThisPage(p: any, url: string): boolean {
  const path = (u: unknown) => {
    if (typeof u !== "string") return null;
    try {
      const x = new URL(u, url);
      return x.host + x.pathname.replace(/\/$/, "");
    } catch {
      return null;
    }
  };
  const here = path(url);
  const offers = Array.isArray(p.offers) ? p.offers : [p.offers];
  return [p.url, ...offers.map((o: { url?: unknown } | undefined) => o?.url)].some((u) => u != null && path(u) === here);
}

function clean(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const t = decodeEntities(s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return t || undefined;
}

/** Fallbacks específicos por dominio (Amazon no publica JSON-LD de producto) */
function domainSpecific(html: string, url: string, r: Extracted) {
  const host = new URL(url).hostname;
  if (/amazon\./i.test(host)) {
    if (!r.title) {
      const t = html.match(/id="productTitle"[^>]*>([\s\S]*?)<\/span>/);
      if (t) r.title = clean(t[1]);
    }
    if (!r.price) {
      const zone = html.match(/id="corePriceDisplay_desktop_feature_div"[\s\S]{0,8000}|id="corePrice_feature_div"[\s\S]{0,8000}|id="apex_desktop"[\s\S]{0,10000}|id="corePriceDisplay_mobile_feature_div"[\s\S]{0,8000}/);
      const src = zone ? zone[0] : "";
      // a-offscreen puede venir vacío (el texto pasa a aok-offscreen): solo vale con cifras.
      const p = src.match(/class="a-offscreen">\s*([^<]*\d[^<]*)</) ||
        src.match(/class="a-price-whole">([\d.,]+)<[\s\S]{0,200}?class="a-price-fraction">(\d+)</) ||
        html.match(/"priceAmount"\s*:\s*([\d.]+)/) ||
        html.match(/id="priceblock_(?:our|deal|sale)price"[^>]*>([^<]+)</);
      if (p) {
        const raw = p[2] ? `${p[1]},${p[2]}` : p[1];
        r.price = parsePrice(raw);
        r.source = "amazon";
        r.currency = "EUR";
      }
    }
    if (!r.image) {
      const i = html.match(/"hiRes":"(https:[^"]+)"/) || html.match(/data-old-hires="(https:[^"]+)"/) ||
        html.match(/id="landingImage"[^>]*src="(https:[^"]+)"/);
      if (i) r.image = i[1];
    }
    const av = html.match(/id="availability"[\s\S]{0,800}?<span[^>]*>([\s\S]*?)<\/span>/);
    if (av) r.inStock = !/no disponible|not available|unavailable|agotado/i.test(av[1]);
    else r.inStock ??= /a-color-success[^>]*>\s*(En stock|Disponible)/i.test(html) ? true : undefined;
  }
  // Vinted, al venderse un articulo, deja la ficha pero le quita el JSON-LD
  // y los botones de compra (backlog B26). El precio sigue en los datos de
  // React (self.__next_f.push), con las comillas escapadas, y el lateral
  // lleva el aviso de estado «Vendido» (buyer_item_status). Siempre del
  // articulo de la URL, nunca de otro de la pagina: entre su id y su precio
  // no puede empezar otro objeto.
  const vintedId = /(^|\.)vinted\./i.test(host) ? new URL(url).pathname.match(/\/items\/(\d+)/)?.[1] : undefined;
  if (vintedId) {
    const data = html.replace(/\\"/g, '"');
    if (!r.price) {
      const m = data.match(new RegExp(
        `[{,]"id":"?${vintedId}"?,(?:(?![{,]"id":)[\\s\\S]){0,1000}?"price":\\{"amount":"(\\d+(?:\\.\\d+)?)","currency_code":"([A-Z]{3})"`,
      ));
      const price = m ? Number(m[1]) : NaN;
      if (price > 0) {
        r.price = price;
        r.currency = m![2];
        r.source = "vinted";
      }
    }
    if (new RegExp(`"data":\\{"item_id":"${vintedId}"[^}]*\\},"exposures":\\[[^\\]]*\\],"name":"buyer_item_status"`).test(data)) {
      r.inStock = false;
    }
  }
}

export function extractFromHtml(html: string, url: string): Extracted {
  const r: Extracted = {};
  const meta = metaTags(html);

  // 1) JSON-LD Product. Si la ficha publica todas sus variantes (Decathlon:
  // un Product por color, cada uno con su url), primero la de esta página;
  // el resto mantiene su orden.
  const products = findProducts(jsonLdBlocks(html));
  products.sort((a, b) => Number(isThisPage(b, url)) - Number(isThisPage(a, url)));
  for (const p of products) {
    const { price, currency, inStock, url: variantUrl } = offerPrice(p.offers, url);
    if (!r.title && p.name) r.title = clean(String(p.name));
    if (!r.image) r.image = abs(firstImage(p.image), url);
    if (!r.description && p.description) r.description = clean(String(p.description));
    if (!r.price && price) {
      r.price = price;
      r.currency = currency;
      r.inStock = inStock;
      r.variantUrl = variantUrl;
      r.source = "json-ld";
    }
    // ProductGroup con variantes
    if (!r.price && Array.isArray(p.hasVariant)) {
      // La url de la variante puede ir en el Product y no en su oferta.
      // deno-lint-ignore no-explicit-any
      const v = offerPrice(p.hasVariant.map((x: any) => x?.offers && !Array.isArray(x.offers) && !x.offers.url ? { ...x.offers, url: x.url } : x?.offers), url);
      if (v.price) {
        r.price = v.price;
        r.currency = v.currency;
        r.inStock = v.inStock;
        r.variantUrl = v.url;
        r.source = "json-ld-variant";
      }
    }
  }

  // 2) Open Graph / meta product
  r.title ||= clean(meta["og:title"] || meta["twitter:title"]);
  r.image ||= abs(meta["og:image:secure_url"] || meta["og:image"] || meta["twitter:image"] || meta["image"], url);
  r.description ||= clean(meta["og:description"] || meta["description"] || meta["twitter:description"]);
  if (!r.price) {
    const p = parsePrice(meta["product:price:amount"] || meta["og:price:amount"] || meta["product:sale_price:amount"] || meta["price"]);
    if (p) {
      r.price = p;
      r.currency = meta["product:price:currency"] || meta["og:price:currency"] || r.currency;
      r.source = "meta";
    }
  }
  if (!r.price) {
    // itemprop="price" content="649.00"
    const m = html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/content=["']([^"']+)["'][^>]*itemprop=["']price["']/i);
    if (m) {
      const p = parsePrice(m[1]);
      if (p) {
        r.price = p;
        r.source = "itemprop";
      }
    }
  }

  // 3) específicos por dominio
  domainSpecific(html, url, r);

  // 4) título de la página como último recurso
  if (!r.title) {
    const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (t) r.title = clean(t[1]);
  }

  // 5) último recurso: patrones típicos de datos embebidos ("price":"429.00", data-price="429")
  if (!r.price) {
    const m = html.match(/["']?(?:price|salePrice|currentPrice|finalPrice)["']?\s*[:=]\s*["']?(\d{1,6}(?:[.,]\d{1,2})?)["']?/) ||
      html.match(/data-(?:product-)?price=["'](\d{1,6}(?:[.,]\d{1,2})?)["']/i);
    if (m) {
      const p = parsePrice(m[1]);
      // solo lo aceptamos si ese importe aparece también como texto con € en la página (evita coger el precio de otro producto)
      if (p) {
        const [ent, dec] = p.toFixed(2).split(".");
        const entEs = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        const re = new RegExp(`(?:${entEs}|${ent})(?:[.,]${dec})?\\s?(?:€|&euro;|EUR)`);
        if (re.test(html)) {
          r.price = p;
          r.source = "embedded";
        }
      }
    }
  }

  r.currency = (r.currency || "EUR").toUpperCase();
  if (r.title && r.title.length > 200) r.title = r.title.slice(0, 200);
  if (r.description && r.description.length > 500) r.description = r.description.slice(0, 500) + "…";
  return r;
}


/** Lo que la extensión y el botón de marcadores leen de la página abierta. */
export type PageRead =
  | { blocked: true }
  | { blocked: false; price: null }
  | {
    blocked: false;
    url: string;
    altUrl: string;
    title: string | null;
    image: string | null;
    price: number;
    currency: string;
    inStock: boolean | null;
  };

/** Lee la página que el usuario tiene abierta en su navegador. `html` es
 * document.documentElement.outerHTML; `canonical`, el href de
 * <link rel="canonical">, si lo hay: es la dirección con la que se guarda. */
export function readPage(html: string, href: string, canonical?: string | null): PageRead {
  if (isBotPage(href, html)) {
    // Una página de Amazon que no es ficha (portada, búsqueda) tampoco tiene
    // productTitle: solo es bloqueo si es su captcha.
    const amazonNoProduct = /amazon\./i.test(new URL(href).hostname) && !/validateCaptcha/i.test(html);
    return amazonNoProduct ? { blocked: false, price: null } : { blocked: true };
  }
  const r = extractFromHtml(html, href);
  if (!r.price) return { blocked: false, price: null };
  return {
    blocked: false,
    // La canónica no lleva la variante (Sklum la quita): si la dirección
    // eligió una, se guarda la de esa variante para que el servidor lea lo mismo.
    url: r.variantUrl || canonical || href,
    altUrl: href,
    title: r.title ?? null,
    image: r.image ?? null,
    price: r.price,
    currency: r.currency || "EUR",
    inStock: r.inStock ?? null,
  };
}
