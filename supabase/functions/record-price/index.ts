// Apunta un precio leido desde el navegador del usuario: la extension de
// Chrome (extension/), al guardar la pagina abierta o en su pase diario por
// las tiendas que bloquean al servidor (docs/TIENDAS.md, backlog B21).
//
// Body: { url, altUrl?, itemId?, title?, image?, price, currency?, inStock? }
// Si el articulo ya esta en la lista del usuario, actualiza su precio y avisa
// de bajadas igual que el pase automatico (refresh/notify.ts). Si no, lo crea
// sin carpeta (sale el primero de la lista, src/lib/itemGroups.js).
// Respuesta: { itemId, created, previousPrice, manual, notified }
//
// Desplegada con --no-verify-jwt (CLAUDE.md): valida el token a mano, como
// scrape y refresh. Escribe con service_role, siempre filtrando por el
// usuario del token: nunca toca articulos de otro.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendPush, type PushSubscriptionRow } from "../refresh/push.ts";
import { alertReasons, buildPushBody, type NotifySettings } from "../refresh/notify.ts";
import { cleanUrl, findOwnItem, itemUpdate, parsePricePayload } from "./record.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function getUserFromRequest(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Metodo no soportado" }, 405);

  const user = await getUserFromRequest(req);
  if (!user) return json({ error: "No autorizado" }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Cuerpo invalido" }, 400);
  }
  const data = parsePricePayload(body);
  if (!data) return json({ error: "Faltan la URL o el precio" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: "vigia" },
    auth: { persistSession: false },
  });

  const url = cleanUrl(data.url);
  const domain = new URL(url).hostname.replace(/^www\./, "");
  const now = new Date().toISOString();

  const { data: rule } = await admin.from("store_rules").select("sr_blocked").eq("sr_domain", domain).maybeSingle();
  // Tienda bloqueada = el pase del servidor no puede leerla: queda en modo
  // manual y solo la actualiza el navegador.
  const manual = Boolean(rule?.sr_blocked);

  // El pase de la extension manda el id del articulo que esta leyendo; al
  // guardar una pagina se busca por la URL canonica y por la de la barra
  // (el articulo pudo guardarse con cualquiera de las dos), y aunque no se
  // escriban igual que la guardada (findOwnItem). Solo entre los del
  // usuario: con service_role nunca se escribe en un articulo ajeno.
  let lookup = admin
    .from("items")
    .select("itm_id, itm_url, itm_title, itm_image_url, itm_price, itm_min_price, itm_in_stock, itm_notified_price")
    .eq("itm_usr_id", user.id);
  if (data.itemId) lookup = lookup.eq("itm_id", data.itemId);
  const { data: found, error: findError } = await lookup;
  if (findError) return json({ error: "No se pudo leer la lista" }, 500);
  const existing = data.itemId
    ? found?.[0] ?? null
    : findOwnItem(found ?? [], [url, data.altUrl ? cleanUrl(data.altUrl) : null].filter((u): u is string => u != null));
  // Borrado mientras el pase lo leia: no se vuelve a crear.
  if (data.itemId && !existing) return json({ error: "El articulo ya no esta en la lista" }, 404);

  let itemId: string;
  if (existing) {
    const { error } = await admin.from("items").update(itemUpdate(existing, data, manual, now)).eq("itm_id", existing.itm_id);
    if (error) return json({ error: "No se pudo guardar el precio" }, 500);
    itemId = existing.itm_id;
  } else {
    const { data: item, error } = await admin
      .from("items")
      .insert({
        itm_usr_id: user.id,
        itm_url: url,
        itm_title: data.title ?? url,
        itm_image_url: data.image,
        itm_price: data.price,
        itm_currency: data.currency,
        itm_in_stock: data.inStock,
        itm_is_manual: manual,
        itm_last_checked_at: now,
      })
      .select("itm_id")
      .single();
    if (error || !item) return json({ error: "No se pudo guardar el articulo" }, 500);
    itemId = item.itm_id;
  }

  const { error: historyError } = await admin.from("price_history").insert({
    ph_itm_id: itemId,
    ph_price: data.price,
    ph_in_stock: data.inStock,
    ph_source: "browser",
  });
  if (historyError) return json({ error: "No se pudo guardar el historico" }, 500);

  // Avisos: solo si ya estaba (un articulo nuevo no "baja" de nada). Mismas
  // reglas y mismo envio que el bucle de refresh/index.ts.
  let notified = false;
  if (existing) {
    const { data: settings } = await admin
      .from("user_settings")
      .select("us_refresh_mode, us_notify_enabled, us_notify_kind, us_notify_pct, us_notify_eur, us_notify_min_hist, us_notify_back_in_stock")
      .eq("us_usr_id", user.id)
      .maybeSingle();
    const reasons = settings
      ? alertReasons(settings as NotifySettings, {
        prev: existing.itm_price,
        next: data.price,
        prevMin: existing.itm_min_price,
        wasInStock: existing.itm_in_stock,
        nowInStock: data.inStock,
        alreadyNotified: existing.itm_notified_price,
      })
      : [];
    if (reasons.length > 0) {
      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("psub_id, psub_endpoint, psub_p256dh, psub_auth")
        .eq("psub_usr_id", user.id)
        .eq("psub_is_active", true);
      if (subs && subs.length > 0) {
        const title = existing.itm_title && existing.itm_title !== existing.itm_url ? existing.itm_title : data.title ?? url;
        const payload = JSON.stringify({
          title: "Vigía",
          body: buildPushBody([{ title, reasons, prev: existing.itm_price, next: data.price }]),
          tag: "vigia-drops",
        });
        const results = await Promise.all((subs as PushSubscriptionRow[]).map((sub) => sendPush(sub, payload)));
        const goneIds = results.filter((r) => r.status === "gone").map((r) => r.psub_id);
        if (goneIds.length > 0) {
          await admin.from("push_subscriptions").update({ psub_is_active: false }).in("psub_id", goneIds);
        }
        if (results.some((r) => r.status === "sent")) {
          notified = true;
          await admin.from("items").update({ itm_notified_price: data.price, itm_notified_at: now }).eq("itm_id", itemId);
        }
      }
    }
  }

  return json({
    itemId,
    created: !existing,
    previousPrice: existing?.itm_price ?? null,
    manual,
    notified,
  });
});
