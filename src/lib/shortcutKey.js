/** Atajo de iOS «Guardar en Vigía» (Edge Function save-link).
 *
 * En el iPhone una app web no puede salir en la hoja de compartir (Android
 * sí: share_target, src/lib/shareTarget.js). El atajo manda la dirección a
 * save-link con una clave personal, que se crea en Ajustes y se pega una vez
 * al añadir el atajo. La BD solo guarda su hash (us_shortcut_key_hash):
 * crear otra deja sin valor la anterior. */

/** Enlace de iCloud del atajo ya montado, con la clave como pregunta de
 * importación. Vacío hasta que exista: Ajustes enseña entonces solo los
 * pasos para montarlo a mano. */
export const SHORTCUT_ICLOUD_URL = ''

/** Lo que el atajo ejecuta en la página abierta cuando se comparte desde
 * Safari («Ejecutar JavaScript en página web»): la manda entera a save-link,
 * que la lee con el mismo lector que la extensión (scrape/parse.ts). Así
 * pasa por donde el servidor no: es la página que la persona está viendo
 * (docs/DECISIONES.md 2026-10-21). parsePage (save-link/link.ts) lo lee. */
export const SHORTCUT_PAGE_SCRIPT =
  "var c = document.querySelector('link[rel=\"canonical\"]');\n" +
  'completion(JSON.stringify({ href: location.href, canonical: c ? c.href : null, ' +
  'html: document.documentElement.outerHTML.slice(0, 3000000) }));'

/** Dirección a la que llama el atajo. */
export const SAVE_LINK_URL = `${import.meta.env?.VITE_SUPABASE_URL ?? ''}/functions/v1/save-link`

/** Síncrona a propósito: Safari solo deja copiar al portapapeles dentro del
 * toque, antes de cualquier espera. 32 bytes aleatorios en base64url. */
export function newShortcutKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const b64 = btoa(String.fromCharCode(...bytes))
  return `vigia_${b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

/** SHA-256 en hexadecimal. Copia en supabase/functions/save-link/link.ts
 * (hashKey): si se cambia aquí, allí también. */
export async function hashShortcutKey(key) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
