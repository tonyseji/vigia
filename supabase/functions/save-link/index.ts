// Guarda en Vigia la direccion que manda el atajo de iOS «Guardar en Vigia»
// (hoja de compartir del iPhone, donde una app web no puede salir). Hace lo
// mismo que Compartir -> Vigia en Android (App.jsx, saveShared), pero en el
// servidor: el atajo no puede abrir la app instalada.
//
// Body: { url, key }. `url` es la entrada del atajo (una URL o una frase que
// la lleva); `key` es la clave del atajo que se crea en Ajustes
// (src/lib/shortcutKey.js), de la que la BD solo guarda el hash
// (us_shortcut_key_hash, migracion 021).
// Respuesta: texto plano, que el atajo ensena tal cual en una notificacion.
//
// Desplegada con --no-verify-jwt (CLAUDE.md): aqui no hay sesion, la clave
// hace de token y se valida a mano. Escribe con service_role, siempre como
// el usuario de la clave.
import { createClient } from "npm:@supabase/supabase-js@2";
import { expandShortLink, type Extracted, extractFromUrl, setAltFetcher } from "../scrape/extract.ts";
import { cleanUrl } from "../record-price/record.ts";
import { duplicateMessage, findSameItem, findUrl, hashKey, parseKey, savedMessage, type VisibleItem } from "./link.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function text(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return text("Método no soportado", 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return text("El atajo no ha mandado nada. Vuelve a añadirlo desde Ajustes de Vigía.", 400);
  }

  const key = parseKey(body?.key);
  if (!key) return text("Falta la clave del atajo. Vuelve a añadirlo desde Ajustes de Vigía.", 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: "vigia" },
    auth: { persistSession: false },
  });

  const { data: owner } = await admin
    .from("user_settings")
    .select("us_usr_id")
    .eq("us_shortcut_key_hash", await hashKey(key))
    .maybeSingle();
  if (!owner) {
    return text("Esta clave ya no vale (se creó otra o se desactivó el atajo). Vuelve a añadirlo desde Ajustes de Vigía.", 401);
  }
  const userId: string = owner.us_usr_id;

  const found = findUrl(body.url);
  if (!found) return text("No he encontrado ninguna dirección web en lo compartido.", 400);
  // Enlace corto (amzn.eu/d/... desde la app de Amazon): se guarda la ficha
  // de verdad, para que se compare y se lea como cualquier otra de la tienda.
  const url = cleanUrl(await expandShortLink(found));

  // Lo que el usuario ve en su lista (RLS, migracion 016): lo suyo y lo de
  // las carpetas compartidas con el, subcarpetas incluidas.
  const { data: shares } = await admin
    .from("folder_shares")
    .select("shr_fld_id")
    .eq("shr_invited_usr_id", userId)
    .eq("shr_status", "accepted");
  const sharedTop = (shares ?? []).map((s) => s.shr_fld_id as string);
  let sharedFolderIds: string[] = [];
  if (sharedTop.length > 0) {
    const list = sharedTop.join(",");
    const { data: folders } = await admin.from("folders").select("fld_id").or(`fld_id.in.(${list}),fld_parent_id.in.(${list})`);
    sharedFolderIds = (folders ?? []).map((f) => f.fld_id as string);
  }
  const { data: ownFolders } = await admin.from("folders").select("fld_id").eq("fld_usr_id", userId);
  const folderIds = [...sharedFolderIds, ...(ownFolders ?? []).map((f) => f.fld_id as string)];
  let visible = admin.from("items").select("itm_usr_id, itm_url, itm_title");
  visible = folderIds.length > 0
    ? visible.or(`itm_usr_id.eq.${userId},itm_fld_id.in.(${folderIds.join(",")})`)
    : visible.eq("itm_usr_id", userId);
  const { data: items, error: listError } = await visible;
  if (listError) return text("No se pudo comprobar tu lista. Inténtalo otra vez.", 500);
  const existing = findSameItem((items ?? []) as VisibleItem[], userId, url);
  if (existing) return text(duplicateMessage(existing));

  const domain = new URL(url).hostname.replace(/^www\./, "");
  const { data: rule } = await admin.from("store_rules").select("sr_blocked").eq("sr_domain", domain).maybeSingle();
  const manual = Boolean(rule?.sr_blocked);

  // Tienda que bloquea: se guarda sin precio y en modo manual, como
  // addManualItem en la web; la extension de Chrome se lo pondra.
  let extracted: Extracted | null = null;
  if (!manual) {
    // Mismo camino alternativo para Amazon que scrape/index.ts (backlog B9).
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
    try {
      extracted = await extractFromUrl(url);
    } catch {
      return text(`No se pudo leer la ficha de ${domain}. Inténtalo otra vez o pega la dirección en Vigía.`, 502);
    }
  }

  const now = new Date().toISOString();
  const { data: item, error: insertError } = await admin
    .from("items")
    .insert({
      itm_usr_id: userId,
      itm_url: url,
      itm_title: extracted?.title ?? url,
      itm_image_url: extracted?.image ?? null,
      itm_price: extracted?.price ?? null,
      itm_currency: extracted?.currency ?? "EUR",
      itm_in_stock: extracted?.inStock ?? null,
      itm_is_manual: manual,
      itm_last_checked_at: manual ? null : now,
    })
    .select("itm_id, itm_title, itm_price")
    .single();
  if (insertError?.code === "23505") return text("Ya lo tenías en Vigía.");
  if (insertError || !item) return text("No se pudo guardar el artículo. Inténtalo otra vez.", 500);

  if (item.itm_price != null) {
    await admin.from("price_history").insert({
      ph_itm_id: item.itm_id,
      ph_price: item.itm_price,
      ph_in_stock: extracted?.inStock ?? null,
      ph_source: "auto",
    });
  }

  return text(savedMessage({ url, title: item.itm_title, price: item.itm_price, manual }));
});
