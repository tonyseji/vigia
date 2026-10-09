# Extensión de Chrome de Vigía

Hace dos cosas:

1. **Guardar la página que estás viendo.** Pulsas el icono (el ojo de Vigía)
   en una ficha de producto y se guarda en tu lista, o se apunta el precio
   de hoy si ya lo tenías. Sustituye al botón «Guardar en Vigía» de la barra
   de marcadores, que sigue funcionando para otros navegadores.
2. **Precio automático para lo que el servidor no puede leer:** las tiendas
   que lo bloquean (Maisons du Monde, Kave Home: `docs/TIENDAS.md`) y, de
   cualquier tienda, lo que se quedó sin precio o falló en el último pase del
   servidor (Amazon, que lo ve desde Irlanda). Una vez al día abre esos
   artículos en una ventana minimizada, lee el precio y lo apunta. Si baja,
   llega el aviso igual que con el resto. Lo que se añade sin precio (por
   ejemplo desde el móvil) se lee una vez en la hora siguiente, sin esperar
   al pase.

Solo funciona con el ordenador encendido y Chrome abierto. Si a la hora del
pase estaba apagado, lo hace en cuanto se abre Chrome (mira cada hora si el
último pase tiene más de 20 h).

Solo para Chrome de escritorio y navegadores basados en él (Edge, Brave,
Opera). **Chrome para Android no admite extensiones**, ni Safari: en el
móvil se usa el botón «Guardar en Vigía» (Ajustes → «Copiar código»). El
pase diario lo hace el Chrome del ordenador para toda la lista, sin
importar desde dónde se guardó cada artículo.

## Instalar

1. En Chrome, abrir `chrome://extensions`.
2. Activar **Modo de desarrollador** (arriba a la derecha).
3. **Cargar descomprimida** → elegir esta carpeta (`extension/`).
4. Fijar el icono: el puzle de la barra → chincheta junto a «Vigía».
5. Pulsar el icono y entrar con el email y la contraseña de Vigía (una vez).

Para actualizarla tras un cambio en esta carpeta: `chrome://extensions` →
el botón de recargar de la tarjeta de Vigía.

## Cómo está hecha

| Archivo | Qué hace |
|---|---|
| `manifest.json` | Permisos: `activeTab` + `scripting` para leer la pestaña al pulsar el icono; `host_permissions` para el pase (cualquier tienda `https`), Supabase y la web. |
| `background.js` | Service worker. Pase diario (`chrome.alarms`), guardar la pestaña, sesión. |
| `api.js` | Login con email y contraseña contra Supabase Auth, renovación del token, lectura de artículos y llamada a `record-price`. |
| `extract.js` | Lee JSON-LD / Open Graph de la página, y la ficha de Amazon (no tiene JSON-LD). Misma lógica que el botón de marcadores (`src/lib/browserImport.js`). |
| `popup.*` | La ventana del icono. |

- **Sin claves en el repositorio:** la URL y la clave pública de Supabase se
  descargan de `https://vigia-list.vercel.app/extension-config.json`, que
  genera `vite.config.js` en cada build a partir de las variables de Vercel.
- **Sesión propia:** la extensión inicia su propia sesión y no reutiliza la
  de la web. Si las dos renovaran el mismo refresh token, Supabase cerraría
  la sesión. La contraseña no se guarda, solo los tokens.
- **Escritura:** todo pasa por la Edge Function `record-price`, que valida el
  token, actualiza o crea el artículo, apunta el histórico con
  `ph_source = 'browser'` y manda el aviso de bajada. Al guardar una página
  reconoce el artículo aunque la dirección no se escriba igual (barra final,
  `www.`, parámetros de campaña): misma comparación que la web (`urlKey`,
  backlog B25), así no se duplica.
- **Pase:** manda la URL guardada del artículo, no la de la página, para que
  una redirección no cree un artículo duplicado. Entre artículo y artículo
  espera 4–8 s. Si la tienda pide captcha, ese artículo se salta y queda
  anotado en la ventana del icono.
- **Cualquier tienda en el pase:** `host_permissions` incluye `https://*/*`
  (decisión de Tony, 2026-10-09): el pase puede leer la ficha de cualquier
  tienda sin tocar el manifiesto. Solo lee las pestañas que abre él mismo,
  con las direcciones de la lista de Vigía.
