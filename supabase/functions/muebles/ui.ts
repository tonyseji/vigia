// La interfaz (HTML) vive en la tabla `settings` (key = 'ui_html') para poder
// actualizarla con un simple UPDATE sin redesplegar la función. Esto es solo el fallback.
export const FALLBACK_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Muebles</title></head>
<body style="font-family:system-ui;padding:40px;text-align:center"><h2>Interfaz no cargada</h2>
<p>Falta la fila <code>ui_html</code> en la tabla <code>settings</code>.</p></body></html>`;
