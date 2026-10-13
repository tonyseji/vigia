// Lee el producto de la página abierta con el mismo lector que el servidor
// (supabase/functions/scrape/parse.ts, compilado en parse.js). background.js
// inyecta primero parse.js, que deja `VigiaParse` en la pestaña, y después
// esta función con chrome.scripting.executeScript({ func: readOpenPage }):
// tiene que ser autocontenida, sin nada de fuera salvo VigiaParse.
export function readOpenPage() {
  const canonical = document.querySelector('link[rel="canonical"]')
  return VigiaParse.readPage(document.documentElement.outerHTML, location.href, canonical && canonical.href)
}
