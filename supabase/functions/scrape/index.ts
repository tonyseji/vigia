// Recibe una URL de producto y devuelve titulo, imagen y precio.
// Desplegada con --no-verify-jwt (CLAUDE.md: "Edge Functions: desplegar con
// --no-verify-jwt y validar el token a mano en el handler"). Sustituye la
// clave compartida de la app vieja (x-key) por el JWT real de la sesion.
//
// No escribe en items/price_history: eso lo hace el frontend con su propio
// cliente de sesion, para que RLS decida quien puede insertar que.
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractFromUrl, setAltFetcher } from "./extract.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// El navegador manda un preflight OPTIONS antes del POST real porque la
// llamada lleva Authorization/Content-Type. Sin responderlo, supabase-js
// nunca llega a enviar el POST (se veia como "OPTIONS | 405" en los logs).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function domainOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

async function getUserFromRequest(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo no soportado" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let url: string;
  try {
    const body = await req.json();
    url = String(body.url ?? "");
    new URL(url);
  } catch {
    return new Response(JSON.stringify({ error: "URL invalida" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Antes de intentar nada: se mira el dominio contra store_rules
  // (docs/ARQUITECTURA.md, "Tiendas que bloquean: el flujo").
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: "vigia" },
    auth: { persistSession: false },
  });

  // Camino alternativo para Amazon: sale por la IP de Postgres via pg_net
  // (backlog B9). Ver supabase/migrations/008_fetch_via_pg_net.sql.
  setAltFetcher(async (fetchUrl, headers) => {
    const { data: reqId, error } = await admin.rpc("fetch_enqueue", { p_url: fetchUrl, p_headers: headers });
    if (error || reqId == null) throw new Error("No se pudo encolar la peticion pg_net");
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
      const { data: result } = await admin.rpc("fetch_result", { p_request_id: reqId });
      if (result) return { status: result.status, html: result.body };
    }
    throw new Error("Tiempo de espera agotado (pg_net)");
  });

  const domain = domainOf(url);
  const { data: rule } = await admin
    .from("store_rules")
    .select("sr_blocked")
    .eq("sr_domain", domain)
    .maybeSingle();

  if (rule?.sr_blocked) {
    return new Response(JSON.stringify({ blocked: true, domain }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const extracted = await extractFromUrl(url);
    return new Response(JSON.stringify({ blocked: false, ...extracted }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error desconocido" }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});
