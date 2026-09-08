// Refresca precios de items: sirve al boton manual del usuario y al pase
// automatico de pg_cron con el mismo codigo. La autenticacion decide sobre
// que items se opera y nada mas (ver docs/DECISIONES.md 2026-09-06, "El
// disparador del refresco automatico es pg_cron + pg_net dentro de Supabase").
//
// Modo cron: Authorization: Bearer <CRON_SECRET>, body { user_ids: string[] }
// Modo user: Authorization: Bearer <JWT de sesion>, body ignorado -> [user.id]
//
// Desplegada con --no-verify-jwt (CLAUDE.md): valida a mano en el handler,
// igual que supabase/functions/scrape/index.ts.
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractFromUrl, setAltFetcher } from "../scrape/extract.ts";
import { sendPush, type PushSubscriptionRow } from "./push.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BATCH_LIMIT = 40;
const TIME_BUDGET_MS = 240_000; // 4 min, con 1 min de margen sobre el limite de 5 de la Edge Function
const CONCURRENCY = 3;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Comparacion byte a byte sin cortocircuito, para no filtrar por timing
// cuanto del CRON_SECRET coincide. Portado de Bilans (push-daily-reminder).
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const len = Math.max(aBytes.length, bBytes.length, 1);
  const paddedA = new Uint8Array(len);
  const paddedB = new Uint8Array(len);
  paddedA.set(aBytes);
  paddedB.set(bBytes);
  let equal = aBytes.length === bBytes.length;
  for (let i = 0; i < len; i++) {
    if (paddedA[i] !== paddedB[i]) equal = false;
  }
  return equal;
}

async function getUserFromRequest(token: string) {
  if (!token) return null;
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

interface ItemRow {
  itm_id: string;
  itm_usr_id: string;
  itm_url: string;
  itm_price: number | null;
  itm_min_price: number | null;
  itm_in_stock: boolean | null;
  itm_notified_price: number | null;
}

interface NotifySettings {
  us_notify_enabled: boolean;
  us_notify_kind: "any" | "pct" | "eur";
  us_notify_pct: number;
  us_notify_eur: number;
  us_notify_min_hist: boolean;
  us_notify_back_in_stock: boolean;
}

function shouldNotify(
  settings: NotifySettings,
  prev: number | null,
  next: number,
  prevMin: number | null,
  wasInStock: boolean | null,
  nowInStock: boolean | undefined,
  alreadyNotified: number | null,
): boolean {
  if (!settings.us_notify_enabled) return false;
  if (alreadyNotified != null && next >= alreadyNotified) return false;

  const esBajada = prev != null && next < prev;
  const esMinHistorico = prevMin != null && next < prevMin;
  const vuelveAStock = wasInStock === false && nowInStock === true;

  let superaUmbral = false;
  if (esBajada) {
    if (settings.us_notify_kind === "any") superaUmbral = true;
    else if (settings.us_notify_kind === "pct") {
      superaUmbral = ((prev! - next) / prev!) * 100 >= settings.us_notify_pct;
    } else if (settings.us_notify_kind === "eur") {
      superaUmbral = (prev! - next) >= settings.us_notify_eur;
    }
  }

  return (
    superaUmbral ||
    (settings.us_notify_min_hist && esMinHistorico) ||
    (settings.us_notify_back_in_stock && vuelveAStock)
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Metodo no soportado" }, 405);
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");

  let mode: "cron" | "user";
  let userIds: string[];

  if (CRON_SECRET && timingSafeEqual(token, CRON_SECRET)) {
    mode = "cron";
    let body: { user_ids?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      // body vacio es valido: no hay usuarios a los que tocarles ahora
    }
    userIds = Array.isArray(body.user_ids) ? body.user_ids.filter((x) => typeof x === "string") : [];
    if (userIds.length === 0) return json({ checked: 0, updated: 0, failed: 0, notified: 0 });
  } else {
    const user = await getUserFromRequest(token);
    if (!user) return json({ error: "No autorizado" }, 401);
    mode = "user";
    // En modo user los ids del body se ignoran: cada sesion solo puede
    // refrescar sus propios articulos, nunca los de otro usuario.
    userIds = [user.id];
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: "vigia" },
    auth: { persistSession: false },
  });

  setAltFetcher(async (url, headers) => {
    const { data: reqId, error } = await admin.rpc("fetch_enqueue", { p_url: url, p_headers: headers });
    if (error || reqId == null) throw new Error("No se pudo encolar la peticion pg_net");
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
      const { data: result } = await admin.rpc("fetch_result", { p_request_id: reqId });
      if (result) return { status: result.status, html: result.body };
    }
    throw new Error("Tiempo de espera agotado (pg_net)");
  });

  const cutoff = mode === "cron"
    ? new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()
    : new Date().toISOString();

  const { data: items, error: itemsError } = await admin
    .from("items")
    .select("itm_id, itm_usr_id, itm_url, itm_price, itm_min_price, itm_in_stock, itm_notified_price")
    .in("itm_usr_id", userIds)
    .eq("itm_is_manual", false)
    .or(`itm_last_checked_at.is.null,itm_last_checked_at.lt.${cutoff}`)
    .order("itm_last_checked_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_LIMIT);

  if (itemsError) return json({ error: "No se pudo leer la lista de articulos" }, 500);

  const toRefresh = (items ?? []) as ItemRow[];

  const { data: rules } = await admin.from("store_rules").select("sr_domain, sr_blocked");
  const blockedDomains = new Set((rules ?? []).filter((r) => r.sr_blocked).map((r) => r.sr_domain));

  const uniqueUserIds = [...new Set(toRefresh.map((it) => it.itm_usr_id))];
  const { data: settingsRows } = uniqueUserIds.length > 0
    ? await admin
      .from("user_settings")
      .select("us_usr_id, us_notify_enabled, us_notify_kind, us_notify_pct, us_notify_eur, us_notify_min_hist, us_notify_back_in_stock")
      .in("us_usr_id", uniqueUserIds)
    : { data: [] as (NotifySettings & { us_usr_id: string })[] };
  const settingsByUser = new Map((settingsRows ?? []).map((s) => [s.us_usr_id, s as NotifySettings]));

  interface DropInfo {
    itemId: string;
    title: string;
    pct: number;
    newPrice: number;
  }
  const dropsByUser = new Map<string, DropInfo[]>();
  let updated = 0;
  let failed = 0;
  const deadline = Date.now() + TIME_BUDGET_MS;

  for (let i = 0; i < toRefresh.length; i += CONCURRENCY) {
    if (Date.now() > deadline) break;
    const batch = toRefresh.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (item) => {
      let domain: string;
      try {
        domain = new URL(item.itm_url).hostname.replace(/^www\./, "");
      } catch {
        domain = "";
      }
      if (blockedDomains.has(domain)) return;

      try {
        const extracted = await extractFromUrl(item.itm_url);
        if (extracted.price == null) {
          await admin.from("items").update({
            itm_last_checked_at: new Date().toISOString(),
            itm_last_error: "No se encontro el precio en la pagina",
          }).eq("itm_id", item.itm_id);
          failed++;
          return;
        }

        const next = extracted.price;
        const prev = item.itm_price;
        const prevMin = item.itm_min_price;

        await admin.from("items").update({
          itm_price: next,
          itm_in_stock: extracted.inStock ?? null,
          itm_last_checked_at: new Date().toISOString(),
          itm_last_error: null,
        }).eq("itm_id", item.itm_id);

        await admin.from("price_history").insert({
          ph_itm_id: item.itm_id,
          ph_price: next,
          ph_in_stock: extracted.inStock ?? null,
          ph_source: "auto",
        });

        updated++;

        const settings = settingsByUser.get(item.itm_usr_id);
        if (settings && shouldNotify(
          settings,
          prev,
          next,
          prevMin,
          item.itm_in_stock,
          extracted.inStock,
          item.itm_notified_price,
        )) {
          const pct = prev != null && prev > 0 ? Math.round(((prev - next) / prev) * 100) : 0;
          const list = dropsByUser.get(item.itm_usr_id) ?? [];
          list.push({ itemId: item.itm_id, title: extracted.title ?? item.itm_url, pct, newPrice: next });
          dropsByUser.set(item.itm_usr_id, list);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        await admin.from("items").update({
          itm_last_checked_at: new Date().toISOString(),
          itm_last_error: message.slice(0, 200),
        }).eq("itm_id", item.itm_id);
        failed++;
      }
    }));
  }

  let notified = 0;
  for (const [userId, drops] of dropsByUser) {
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("psub_id, psub_endpoint, psub_p256dh, psub_auth")
      .eq("psub_usr_id", userId)
      .eq("psub_is_active", true);

    if (!subs || subs.length === 0) continue;

    const body = drops.length === 1
      ? `${drops[0].title}: ${drops[0].pct > 0 ? `-${drops[0].pct} %` : "ha bajado de precio"}`
      : `${drops.length} artículos han bajado: ${
        drops.slice(0, 3).map((d) => `${d.title} -${d.pct}%`).join(", ")
      }${drops.length > 3 ? ` y ${drops.length - 3} más` : ""}`;

    const payload = JSON.stringify({ title: "Vigía", body, tag: "vigia-drops" });

    const results = await Promise.all(
      (subs as PushSubscriptionRow[]).map((sub) => sendPush(sub, payload)),
    );

    const anySent = results.some((r) => r.status === "sent");
    const goneIds = results.filter((r) => r.status === "gone").map((r) => r.psub_id);
    if (goneIds.length > 0) {
      await admin.from("push_subscriptions").update({ psub_is_active: false }).in("psub_id", goneIds);
    }

    // Solo se marca como notificado si el push salio bien; si no, se
    // reintenta en la pasada siguiente (docs/DECISIONES.md, idempotencia).
    if (anySent) {
      notified += drops.length;
      await Promise.all(drops.map((d) =>
        admin.from("items").update({
          itm_notified_price: d.newPrice,
          itm_notified_at: new Date().toISOString(),
        }).eq("itm_id", d.itemId)
      ));
    }
  }

  if (mode === "cron") {
    await admin.from("user_settings").update({ us_last_refresh_at: new Date().toISOString() }).in("us_usr_id", userIds);
  }

  return json({
    checked: toRefresh.length,
    updated,
    failed,
    remaining: toRefresh.length >= BATCH_LIMIT,
    notified,
  });
});
