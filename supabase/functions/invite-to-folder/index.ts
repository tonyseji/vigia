// Invita a otra cuenta de Vigia a compartir una carpeta de primer nivel.
// Resuelve el email a user_id con service_role SIN exponer al cliente si la
// cuenta existe o no (evita enumeracion de cuentas por fuerza bruta). Ver
// docs/superpowers/specs/2026-09-06-carpetas-compartidas-design.md, seccion C.
//
// Desplegada con --no-verify-jwt (CLAUDE.md): valida el JWT a mano.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { error: "Metodo no soportado" }, 405);
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(req, { error: "No autorizado" }, 401);

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await anon.auth.getUser(token);
  if (authError || !authData.user) return json(req, { error: "No autorizado" }, 401);
  const userId = authData.user.id;

  let body: { fld_id?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "JSON invalido" }, 400);
  }

  const fldId = typeof body.fld_id === "string" ? body.fld_id : null;
  const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;

  if (!fldId || !emailRaw || !EMAIL_RE.test(emailRaw)) {
    return json(req, { error: "fld_id y un email valido son obligatorios" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: "vigia" },
    auth: { persistSession: false },
  });

  // Valida que quien llama es dueno de la carpeta y que es de primer nivel
  // (el trigger trg_folder_shares_top_level tambien lo revalida al insertar,
  // pero comprobarlo aqui da un mensaje de error mas claro al frontend).
  const { data: folder, error: folderError } = await admin
    .from("folders")
    .select("fld_usr_id, fld_parent_id, fld_name")
    .eq("fld_id", fldId)
    .maybeSingle();

  if (folderError || !folder) return json(req, { error: "Carpeta no encontrada" }, 404);
  if (folder.fld_usr_id !== userId) return json(req, { error: "No autorizado" }, 403);
  if (folder.fld_parent_id != null) {
    return json(req, { error: "Solo se pueden compartir carpetas de primer nivel" }, 400);
  }

  if (emailRaw === authData.user.email?.toLowerCase()) {
    return json(req, { error: "No puedes compartir una carpeta contigo mismo" }, 400);
  }

  // Resuelve el email a user_id sin filtrar al cliente si existe o no.
  // auth.admin.listUsers no filtra por email en todas las versiones del SDK,
  // asi que se pagina y se compara en memoria (la base de usuarios de un
  // proyecto personal es pequeña; no hace falta mas).
  let invitedUsrId: string | null = null;
  let page = 1;
  while (invitedUsrId == null) {
    const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (usersError || !usersPage || usersPage.users.length === 0) break;
    const match = usersPage.users.find((u) => u.email?.toLowerCase() === emailRaw);
    if (match) invitedUsrId = match.id;
    if (usersPage.users.length < 200) break;
    page++;
  }

  const { error: upsertError } = await admin
    .from("folder_shares")
    .upsert(
      {
        shr_fld_id: fldId,
        shr_owner_usr_id: userId,
        shr_invited_email: emailRaw,
        shr_invited_usr_id: invitedUsrId,
        shr_fld_name: folder.fld_name ?? '',
        shr_status: "pending",
        shr_responded_at: null,
      },
      { onConflict: "shr_fld_id,shr_invited_email" },
    );

  if (upsertError) return json(req, { error: "No se pudo crear la invitacion" }, 500);

  // Respuesta siempre identica exista o no la cuenta: no se filtra
  // informacion sobre que emails estan registrados en Vigia.
  return json(req, { ok: true });
});
