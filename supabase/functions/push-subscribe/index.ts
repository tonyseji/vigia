// Registra o cancela la suscripcion Web Push de un dispositivo. Portado de
// Bilans (supabase/functions/push-subscribe/index.ts), recortado a
// subscribe/unsubscribe: las preferencias de aviso viven en vigia.user_settings
// y se leen/escriben directo con RLS, sin pasar por esta funcion.
//
// Desplegada con --no-verify-jwt (CLAUDE.md): valida el JWT a mano.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://vigia-list.vercel.app",
  "null", // PWA standalone (Android/iOS homescreen)
];

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return { "Access-Control-Allow-Origin": "null" };
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
}

const KNOWN_PUSH_SERVICES = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "notify.windows.com",
  "push.apple.com",
  "web.push.apple.com",
];

function isValidEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string") return false;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    return KNOWN_PUSH_SERVICES.some((host) => url.hostname.endsWith(host));
  } catch {
    return false;
  }
}

const B64URL_RE = /^[A-Za-z0-9\-_]+$/;

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { error: "Metodo no soportado" }, 405);
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(req, { error: "No autorizado" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { db: { schema: "vigia" } });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json(req, { error: "No autorizado" }, 401);
  const userId = authData.user.id;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "JSON invalido" }, 400);
  }

  const { action, endpoint, p256dh, auth } = body;
  if (action !== "subscribe" && action !== "unsubscribe") {
    return json(req, { error: "action debe ser subscribe o unsubscribe" }, 400);
  }
  if (!isValidEndpoint(endpoint)) {
    return json(req, { error: "endpoint debe ser una URL https valida" }, 400);
  }

  if (action === "unsubscribe") {
    const { error } = await supabase
      .from("push_subscriptions")
      .update({ psub_is_active: false, psub_updated_at: new Date().toISOString() })
      .eq("psub_usr_id", userId)
      .eq("psub_endpoint", endpoint);
    if (error) return json(req, { error: "No se pudo desactivar la suscripcion" }, 500);
    return json(req, { success: true });
  }

  // subscribe: limite de 5 dispositivos activos por usuario
  const { count } = await supabase
    .from("push_subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("psub_usr_id", userId)
    .eq("psub_is_active", true);

  if (count !== null && count >= 5) {
    const { count: existing } = await supabase
      .from("push_subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("psub_usr_id", userId)
      .eq("psub_endpoint", endpoint);
    if (!existing) {
      return json(req, { error: "Limite de suscripciones alcanzado (max 5 dispositivos)" }, 429);
    }
  }

  if (typeof p256dh !== "string" || !p256dh.trim() || !B64URL_RE.test(p256dh) || p256dh.length > 200) {
    return json(req, { error: "p256dh invalido" }, 400);
  }
  if (typeof auth !== "string" || !auth.trim() || !B64URL_RE.test(auth) || auth.length > 50) {
    return json(req, { error: "auth invalido" }, 400);
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        psub_usr_id: userId,
        psub_endpoint: endpoint,
        psub_p256dh: p256dh,
        psub_auth: auth,
        psub_is_active: true,
        psub_updated_at: new Date().toISOString(),
      },
      { onConflict: "psub_usr_id,psub_endpoint", ignoreDuplicates: false },
    );

  if (error) return json(req, { error: "No se pudo guardar la suscripcion" }, 500);
  return json(req, { success: true });
});
