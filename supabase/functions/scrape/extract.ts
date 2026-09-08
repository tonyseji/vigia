// Extractor genérico de producto: JSON-LD (schema.org/Product) + Open Graph + fallbacks.

export interface Extracted {
  title?: string;
  image?: string;
  description?: string;
  price?: number;
  currency?: string;
  inStock?: boolean;
  source?: string; // qué método encontró el precio
}

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// Perfiles de cabeceras que se prueban en orden cuando una tienda bloquea (403/429/503)
export const HEADER_PROFILES: Record<string, string>[] = [
  {
    "User-Agent": CHROME_UA,
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "es-ES,es;q=0.9",
  },
  {
    "User-Agent": CHROME_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.7",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "sec-ch-ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
  },
  {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9",
  },
  {
    "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9",
  },
];

async function fetchOnce(url: string, headers: Record<string, string>, timeoutMs: number): Promise<{ status: number; html?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers });
    if (!res.ok) {
      await res.body?.cancel();
      return { status: res.status };
    }
    const buf = await res.arrayBuffer();
    // límite 3 MB
    const slice = buf.byteLength > 3_000_000 ? buf.slice(0, 3_000_000) : buf;
    return { status: res.status, html: new TextDecoder("utf-8").decode(slice) };
  } finally {
    clearTimeout(t);
  }
}

/** Camino alternativo de descarga (p. ej. vía pg_net desde Postgres, con otra IP). Lo registra index.ts */
export type AltFetcher = (url: string, headers: Record<string, string>) => Promise<{ status: number; html?: string }>;
let altFetcher: AltFetcher | null = null;
export function setAltFetcher(fn: AltFetcher) {
  altFetcher = fn;
}

const BLOCK_STATUSES = [401, 403, 429, 500, 502, 503];

/** Páginas "200 OK" que en realidad son un muro anti-bot o un interstitial sin producto */
export function isBotPage(url: string, html: string): boolean {
  const head = html.slice(0, 20000);
  if (/Vercel Security Checkpoint|Just a moment\.\.\.|Please enable JS and disable any ad blocker|Access Denied|Pardon Our Interruption|captcha-delivery\.com|cf-browser-verification/i.test(head)) return true;
  if (/amazon\./i.test(new URL(url).hostname)) {
    // producto real => tiene productTitle; si no, es el interstitial "Amazon.es" / captcha / "Continuar comprando"
    if (!/id="productTitle"/.test(html)) return true;
  }
  return false;
}

export async function fetchHtml(url: string, timeoutMs = 15000, profile?: number): Promise<string> {
  const profiles = profile != null ? [HEADER_PROFILES[profile] ?? HEADER_PROFILES[0]] : HEADER_PROFILES;
  let lastStatus = 0;
  let lastErr: unknown = null;
  // Amazon bloquea las IPs de las Edge Functions casi siempre: ir primero por el camino alternativo
  if (altFetcher && profile == null && /amazon\./i.test(new URL(url).hostname)) {
    try {
      const r = await altFetcher(url, HEADER_PROFILES[0]);
      if (r.html != null && !isBotPage(url, r.html)) return r.html;
    } catch (e) {
      lastErr = e;
    }
  }
  for (let i = 0; i < profiles.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 400));
    try {
      const r = await fetchOnce(url, profiles[i], timeoutMs);
      if (r.html != null) {
        if (!isBotPage(url, r.html)) return r.html;
        lastStatus = 403; // muro anti-bot con 200: seguimos probando
        continue;
      }
      lastStatus = r.status;
      if (!BLOCK_STATUSES.includes(r.status)) break; // 404 etc.: no tiene sentido reintentar
    } catch (e) {
      lastErr = e;
    }
  }
  // Bloqueo: intentar por el camino alternativo (otra IP de salida)
  if (altFetcher && (lastStatus === 0 || BLOCK_STATUSES.includes(lastStatus))) {
    try {
      const r = await altFetcher(url, HEADER_PROFILES[0]);
      if (r.html != null) {
        if (!isBotPage(url, r.html)) return r.html;
        lastStatus = 403;
      } else if (r.status) lastStatus = r.status;
    } catch (e) {
      lastErr = lastErr ?? e;
    }
  }
  if (lastStatus) throw new Error(`HTTP ${lastStatus} (la tienda bloquea la lectura automática)`);
  throw new Error((lastErr as Error)?.name === "AbortError" ? "Tiempo de espera agotado" : (lastErr as Error)?.message || "Error de red");
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

// deno-lint-ignore no-explicit-any
function offerPrice(offers: any): { price?: number; currency?: string; inStock?: boolean } {
  if (!offers) return {};
  const list = Array.isArray(offers) ? offers : [offers];
  let best: { price?: number; currency?: string; inStock?: boolean } = {};
  for (const o of list) {
    if (!o || typeof o !== "object") continue;
    const cands = [o.price, o.lowPrice, o.priceSpecification?.price, o.highPrice];
    let p: number | undefined;
    for (const c of cands) {
      p = parsePrice(c);
      if (p) break;
    }
    const inStock = o.availability ? /InStock|LimitedAvailability|PreOrder|OnlineOnly/i.test(String(o.availability)) : undefined;
    const currency = o.priceCurrency || o.priceSpecification?.priceCurrency;
    if (p && (!best.price || p < best.price)) best = { price: p, currency, inStock };
    // AggregateOffer con offers anidadas
    if (o.offers) {
      const nested = offerPrice(o.offers);
      if (nested.price && (!best.price || nested.price < best.price)) best = nested;
    }
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
      const p = src.match(/class="a-offscreen">([^<]+)</) ||
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
}

export function extractFromHtml(html: string, url: string): Extracted {
  const r: Extracted = {};
  const meta = metaTags(html);

  // 1) JSON-LD Product
  const products = findProducts(jsonLdBlocks(html));
  for (const p of products) {
    const { price, currency, inStock } = offerPrice(p.offers);
    if (!r.title && p.name) r.title = clean(String(p.name));
    if (!r.image) r.image = abs(firstImage(p.image), url);
    if (!r.description && p.description) r.description = clean(String(p.description));
    if (!r.price && price) {
      r.price = price;
      r.currency = currency;
      r.inStock = inStock;
      r.source = "json-ld";
    }
    // ProductGroup con variantes
    if (!r.price && Array.isArray(p.hasVariant)) {
      const v = offerPrice(p.hasVariant.map((x: { offers: unknown }) => x.offers));
      if (v.price) {
        r.price = v.price;
        r.currency = v.currency;
        r.inStock = v.inStock;
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

export async function extractFromUrl(url: string, profile?: number): Promise<Extracted> {
  const html = await fetchHtml(url, 15000, profile);
  return extractFromHtml(html, url);
}
