// Guarda en Vigia la direccion que manda el atajo de iOS «Guardar en Vigia»
// (hoja de compartir del iPhone, donde una app web no puede salir). Hace lo
// mismo que Compartir -> Vigia en Android (App.jsx, saveShared), pero en el
// servidor: el atajo no puede abrir la app instalada.
//
// Body: { url, key, page? }. `url` es la entrada del atajo (una URL o una
// frase que la lleva); `key` es la clave del atajo que se crea en Ajustes
// (src/lib/shortcutKey.js), de la que la BD solo guarda el hash
// (us_shortcut_key_hash, migracion 021). `page`, si se compartio desde
// Safari: la pagina abierta (SHORTCUT_PAGE_SCRIPT), que se lee con el mismo
// lector que la extension y pasa por donde el servidor no (sesion 44).
// Respuesta: texto plano, que el atajo ensena tal cual en una notificacion.
//
// Desplegada con --no-verify-jwt (CLAUDE.md): aqui no hay sesion, la clave
// hace de token y se valida a mano. Escribe con service_role, siempre como
// el usuario de la clave.
import { createClient } from "npm:@supabase/supabase-js@2";
import { expandShortLink, type Extracted, extractFromHtml, extractFromUrl, isBotPage, isNotFound, setAltFetcher } from "../scrape/extract.ts";
import { cleanUrl } from "../record-price/record.ts";
import {
  completedMessage,
  duplicateMessage,
  fillUpdate,
  findSameItem,
  findUrl,
  type GapItem,
  hashKey,
  missingParts,
  parseKey,
  parsePage,
  savedMessage,
  stillMissingMessage,
  type VisibleItem,
} from "./link.ts";

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
  const page = parsePage(body.page);
  if (!found && !page) return text("No he encontrado ninguna dirección web en lo compartido.", 400);
  // Lo que se ve en Safari, con el lector de siempre. Un captcha no cuenta.
  const pageRead = page && !isBotPage(page.href, page.html) ? extractFromHtml(page.html, page.href) : null;
  const priceFromPage = pageRead?.price != null;
  // Con precio de la pagina se guarda su direccion como la extension: la de
  // la variante o la canonica. Si no, la compartida; un enlace corto
  // (amzn.eu/d/... desde la app de Amazon) se expande a la ficha de verdad.
  const url = priceFromPage
    ? cleanUrl(pageRead!.variantUrl || page!.canonical || page!.href)
    : cleanUrl(await expandShortLink(found ?? page!.href));
  const candidates = [url, page && cleanUrl(page.href), found && cleanUrl(found)].filter((u): u is string => u != null);

  // Lo que el usuario ve en su lista (RLS, migracion 016): lo suyo y lo de
  // las carpetas compartidas con el, con todo lo que cuelga de ellas (hasta
  // tres niveles, migracion 025: se baja un nivel en cada vuelta).
  const { data: shares } = await admin
    .from("folder_shares")
    .select("shr_fld_id")
    .eq("shr_invited_usr_id", userId)
    .eq("shr_status", "accepted");
  const sharedFolderIds: string[] = (shares ?? []).map((s) => s.shr_fld_id as string);
  for (let level = sharedFolderIds; level.length > 0;) {
    const { data: children } = await admin.from("folders").select("fld_id").in("fld_parent_id", level);
    level = (children ?? []).map((f) => f.fld_id as string).filter((id) => !sharedFolderIds.includes(id));
    sharedFolderIds.push(...level);
  }
  const { data: ownFolders } = await admin.from("folders").select("fld_id").eq("fld_usr_id", userId);
  const folderIds = [...sharedFolderIds, ...(ownFolders ?? []).map((f) => f.fld_id as string)];
  let visible = admin.from("items").select("itm_id, itm_usr_id, itm_url, itm_title, itm_image_url, itm_price, itm_notified_price");
  visible = folderIds.length > 0
    ? visible.or(`itm_usr_id.eq.${userId},itm_fld_id.in.(${folderIds.join(",")})`)
    : visible.eq("itm_usr_id", userId);
  const { data: items, error: listError } = await visible;
  if (listError) return text("No se pudo comprobar tu lista. Inténtalo otra vez.", 500);
  const visibleItems = (items ?? []) as (VisibleItem & GapItem & { itm_id: string })[];
  // El articulo pudo guardarse con la direccion compartida o con la canonica.
  const existing = candidates.map((u) => findSameItem(visibleItems, userId, u)).find((i) => i != null) ?? null;
  // Ya estaba: si tiene lo principal, nada que hacer; si le falta algo, se
  // vuelve a leer y se completa ese mismo (docs/DECISIONES.md 2026-10-21).
  // Solo entre los que el usuario ve (lo de arriba replica su RLS), asi que
  // no escribe en nada que el no pudiera editar desde la app.
  if (existing && missingParts(existing).length === 0) return text(duplicateMessage(existing));

  const domain = new URL(url).hostname.replace(/^www\./, "");
  const { data: rule } = await admin.from("store_rules").select("sr_blocked").eq("sr_domain", domain).maybeSingle();
  // Tienda que bloquea al servidor: queda en modo manual (la lee el
  // navegador), con el precio de Safari si lo trajo; si no, sin precio, como
  // addManualItem en la web, y la extension de Chrome se lo pondra.
  const manual = Boolean(rule?.sr_blocked);

  let extracted: Extracted | null = priceFromPage ? pageRead : null;
  // La lectura fallo por algo que puede salir bien mas tarde (bloqueo,
  // tiempo de espera): se guarda sin precio y el pase diario lo reintenta,
  // como «Guardar sin precio» en la web (sesion 42).
  let readError: string | null = null;
  // Safari trajo al menos nombre o foto: sirve aunque falle el servidor.
  const pageDetails = pageRead && (pageRead.title || pageRead.image) ? { title: pageRead.title, image: pageRead.image } : null;
  if (!extracted && !manual) {
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
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Error desconocido";
      // La pagina no existe: guardarla no sirve, el pase volveria a fallar.
      if (isNotFound(err) && !pageDetails && !existing) return text(`No se pudo guardar: ${reason}`, 502);
      readError = reason.slice(0, 200);
    }
  }
  // Sin precio de nadie: al menos el nombre y la foto que se ven en Safari.
  if (!extracted && pageDetails) extracted = pageDetails;
  if (existing && !extracted) {
    return text(stillMissingMessage(existing, readError ?? `${domain} no deja leerlo desde el servidor.`));
  }

  const now = new Date().toISOString();

  if (existing && extracted) {
    const update = fillUpdate(existing, extracted, now);
    if (Object.keys(update).length === 0) return text(stillMissingMessage(existing, readError ?? "la ficha no lo trae."));
    // Tienda que bloquea: aunque Safari traiga el precio, sigue siendo
    // cosa del navegador (el pase de la extension), no del servidor.
    if (manual && "itm_is_manual" in update) update.itm_is_manual = true;
    const { data: filled, error: fillError } = await admin
      .from("items")
      .update(update)
      .eq("itm_id", existing.itm_id)
      .select("itm_id, itm_url, itm_title, itm_price")
      .single();
    if (fillError || !filled) return text("No se pudo completar el artículo. Inténtalo otra vez.", 500);
    if (extracted.price != null) {
      await admin.from("price_history").insert({
        ph_itm_id: filled.itm_id,
        ph_price: extracted.price,
        ph_in_stock: extracted.inStock ?? null,
        ph_source: priceFromPage ? "browser" : "auto",
      });
    }
    return text(completedMessage(filled));
  }
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
      itm_last_checked_at: (manual && !priceFromPage) || readError ? null : now,
      itm_last_error: readError,
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
      ph_source: priceFromPage ? "browser" : "auto",
    });
  }

  return text(savedMessage({ url, title: item.itm_title, price: item.itm_price, manual, unread: readError != null }));
});
