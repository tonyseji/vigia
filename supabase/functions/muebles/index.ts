import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractFromUrl, setAltFetcher } from "./extract.ts";
import { FALLBACK_HTML } from "./ui.ts";

// Clave de acceso compartida (la URL con ?k=... es el "login"). Cambiar aquí y redesplegar para rotarla.
const ACCESS_KEY = "CLAVE-RETIRADA";
const FN_NAME = "muebles";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

type Item = {
  id: string;
  url: string;
  domain: string | null;
  title: string | null;
  image_url: string | null;
  description: string | null;
  category: string;
  notes: string | null;
  added_by: string | null;
  currency: string;
  first_price: number | null;
  current_price: number | null;
  min_price: number | null;
  max_price: number | null;
  in_stock: boolean | null;
  last_checked_at: string | null;
  last_error: string | null;
  created_at: string;
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

function authorized(req: Request, url: URL): boolean {
  return req.headers.get("x-key") === ACCESS_KEY || url.searchParams.get("k") === ACCESS_KEY;
}

function domainOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function cleanUrl(raw: string): string {
  const u = new URL(raw.trim());
  // fuera parámetros de tracking habituales
  for (const k of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|mc_|ref$|tag$|_ga|srsltid)/i.test(k)) u.searchParams.delete(k);
  }
  u.hash = "";
  return u.toString();
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));

// Descarga alternativa vía pg_net (sale por la IP del servidor Postgres, que algunas tiendas —Amazon— no bloquean)
setAltFetcher(async (target, headers) => {
  const { data: id, error } = await supabase.rpc("fetch_enqueue", { p_url: target, p_headers: headers });
  if (error || !id) throw new Error("pg_net: " + (error?.message || "sin id"));
  const deadline = Date.now() + 22_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 700));
    const { data } = await supabase.rpc("fetch_result", { p_id: id });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) continue;
    if (row.error_msg) throw new Error("pg_net: " + row.error_msg);
    if (row.status_code >= 200 && row.status_code < 300 && row.content) return { status: row.status_code, html: row.content };
    return { status: row.status_code || 0 };
  }
  throw new Error("pg_net: tiempo de espera agotado");
});

let uiCache: { html: string; at: number } | null = null;
async function getUiHtml(): Promise<string> {
  if (uiCache && Date.now() - uiCache.at < 60_000) return uiCache.html;
  const { data } = await supabase.from("settings").select("value").eq("key", "ui_html").maybeSingle();
  const html = data?.value || FALLBACK_HTML;
  uiCache = { html, at: Date.now() };
  return html;
}

/** Registra un precio observado y recalcula actual/min/max/inicial */
async function recordPrice(item: Item, price: number, inStock: boolean | null | undefined, extra: Partial<Item> = {}) {
  const changed = item.current_price == null || Number(item.current_price) !== price;
  if (changed) {
    await supabase.from("price_history").insert({ item_id: item.id, price, in_stock: inStock ?? null });
  }
  const patch: Record<string, unknown> = {
    ...extra,
    current_price: price,
    first_price: item.first_price ?? price,
    min_price: item.min_price == null ? price : Math.min(Number(item.min_price), price),
    max_price: item.max_price == null ? price : Math.max(Number(item.max_price), price),
    in_stock: inStock ?? item.in_stock,
    last_checked_at: new Date().toISOString(),
    last_error: null,
  };
  const { data } = await supabase.from("items").update(patch).eq("id", item.id).select().single();
  return { item: data as Item, changed };
}

async function refreshItem(item: Item): Promise<{ id: string; title: string | null; old: number | null; new: number | null; error?: string }> {
  const old = num(item.current_price);
  try {
    const ex = await extractFromUrl(item.url);
    if (ex.price) {
      const extra: Partial<Item> = {};
      if (!item.title && ex.title) extra.title = ex.title;
      if (!item.image_url && ex.image) extra.image_url = ex.image;
      await recordPrice(item, ex.price, ex.inStock, extra);
      return { id: item.id, title: item.title, old, new: ex.price };
    }
    await supabase.from("items").update({ last_checked_at: new Date().toISOString(), last_error: "Precio no encontrado en la página" }).eq("id", item.id);
    return { id: item.id, title: item.title, old, new: null, error: "Precio no encontrado" };
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    await supabase.from("items").update({ last_checked_at: new Date().toISOString(), last_error: "No se pudo leer: " + msg.slice(0, 120) }).eq("id", item.id);
    return { id: item.id, title: item.title, old, new: null, error: msg };
  }
}

async function refreshMany(items: Item[], concurrency = 4) {
  const results: Awaited<ReturnType<typeof refreshItem>>[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const it = items[i++];
      results.push(await refreshItem(it));
    }
  });
  await Promise.all(workers);
  return results;
}

async function historyFor(ids: string[]) {
  if (!ids.length) return {};
  const { data } = await supabase.from("price_history").select("item_id, price, in_stock, checked_at").in("item_id", ids).order("checked_at", { ascending: true });
  const map: Record<string, unknown[]> = {};
  for (const r of data || []) (map[r.item_id] ||= []).push({ price: Number(r.price), in_stock: r.in_stock, checked_at: r.checked_at });
  return map;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  // ruta relativa a la función: /functions/v1/muebles/<sub>
  const idx = url.pathname.indexOf(`/${FN_NAME}`);
  const sub = (idx >= 0 ? url.pathname.slice(idx + FN_NAME.length + 1) : url.pathname).replace(/^\/+|\/+$/g, "");

  // Página
  if (req.method === "GET" && sub === "") {
    return new Response(await getUiHtml(), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }

  if (!sub.startsWith("api/")) return new Response("Not found", { status: 404 });
  if (!authorized(req, url)) return json({ error: "401 no autorizado" }, 401);

  const parts = sub.split("/"); // ["api", "items", id?]
  const resource = parts[1];
  const id = parts[2];

  try {
    // ---- LISTA ----
    if (resource === "items" && !id && req.method === "GET") {
      const { data, error } = await supabase.from("items").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const history = await historyFor((data || []).map((x) => x.id));
      return json({ items: data, history });
    }

    // ---- AÑADIR ----
    if (resource === "items" && !id && req.method === "POST") {
      const body = await req.json();
      let cleaned: string;
      try {
        cleaned = cleanUrl(String(body.url || ""));
      } catch {
        return json({ error: "URL no válida" }, 400);
      }
      const { data: dup } = await supabase.from("items").select("id,title").eq("url", cleaned).maybeSingle();
      if (dup) return json({ error: "Ya está en la lista: " + (dup.title || cleaned) }, 409);

      let ex: Awaited<ReturnType<typeof extractFromUrl>> = {};
      let err: string | null = null;
      try {
        ex = await extractFromUrl(cleaned);
        if (!ex.price) err = "Precio no encontrado en la página";
      } catch (e) {
        err = "No se pudo leer: " + ((e as Error)?.message || String(e)).slice(0, 120);
      }
      const category = String(body.category || "").trim() || "Sin categoría";
      const { data: inserted, error } = await supabase.from("items").insert({
        url: cleaned,
        domain: domainOf(cleaned),
        title: ex.title || null,
        image_url: ex.image || null,
        description: ex.description || null,
        category,
        notes: String(body.notes || "").trim() || null,
        added_by: String(body.added_by || "").trim() || null,
        currency: ex.currency || "EUR",
        in_stock: ex.inStock ?? null,
        last_checked_at: new Date().toISOString(),
        last_error: err,
      }).select().single();
      if (error) throw error;
      let item = inserted as Item;
      if (ex.price) item = (await recordPrice(item, ex.price, ex.inStock)).item;
      const history = await historyFor([item.id]);
      return json({ item, history: history[item.id] || [] }, 201);
    }

    // ---- EDITAR ----
    if (resource === "items" && id && req.method === "PATCH") {
      const body = await req.json();
      const patch: Record<string, unknown> = {};
      for (const k of ["title", "category", "notes", "image_url", "description"]) {
        if (k in body) patch[k] = String(body[k] ?? "").trim() || (k === "category" ? "Sin categoría" : null);
      }
      const { data: cur, error: e1 } = await supabase.from("items").update(patch).eq("id", id).select().single();
      if (e1) throw e1;
      let item = cur as Item;
      const manual = Number(body.price);
      if (body.price != null && isFinite(manual) && manual > 0) {
        item = (await recordPrice(item, Math.round(manual * 100) / 100, item.in_stock)).item;
      }
      const history = await historyFor([id]);
      return json({ item, history: history[id] || [] });
    }

    // ---- BORRAR ----
    if (resource === "items" && id && req.method === "DELETE") {
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    // ---- ACTUALIZAR PRECIOS ----
    if (resource === "refresh" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const ids: string[] | undefined = Array.isArray(body.ids) && body.ids.length ? body.ids : undefined;
      let q = supabase.from("items").select("*");
      if (ids) q = q.in("id", ids);
      else {
        // Modo cron: solo los que llevan >20 h sin revisar, los más antiguos primero, en lotes pequeños
        const limit = Math.min(Number(body.limit) || 6, 20);
        const cutoff = new Date(Date.now() - 20 * 3600_000).toISOString();
        q = q.or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`).order("last_checked_at", { ascending: true, nullsFirst: true }).limit(limit);
      }
      const { data, error } = await q;
      if (error) throw error;
      const items = (data || []) as Item[];
      const results = await refreshMany(items);
      return json({ results, count: items.length });
    }

    // ---- PROBAR EXTRACCIÓN (debug) ----
    if (resource === "extract" && req.method === "GET") {
      const target = url.searchParams.get("url");
      if (!target) return json({ error: "url requerida" }, 400);
      const profile = url.searchParams.get("profile");
      const ex = await extractFromUrl(target, profile != null ? Number(profile) : undefined);
      return json(ex);
    }

    return json({ error: "Ruta no encontrada" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});
