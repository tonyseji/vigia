# Arquitectura — Vigía

> Cómo encaja todo y qué forma tienen los datos.
> El esquema de esta página es la **propuesta** que se cierra en la fase 2, al
> escribir la primera migración. Hasta entonces, la verdad sigue estando en la
> app vieja.

---

## Las piezas

| Pieza | Dónde vive | Qué hace |
|---|---|---|
| Frontend | Vercel | App Vite + React. Habla con Supabase directamente, con la sesión del usuario. |
| Base de datos | Supabase | `items`, `price_history`, `store_rules`. RLS por `user_id`. |
| Auth | Supabase | Enlace mágico por email. Sin contraseñas. |
| Función `scrape` | Supabase Edge Functions | Recibe una URL, devuelve título, imagen y precio. |
| Refresco automático | `pg_cron` (Supabase) | Cada 15 min revisa los artículos con más de 20 h sin mirar, de 6 en 6. |
| Reglas por tienda | Tabla `store_rules` | Cómo leer el precio en cada dominio, editable sin redesplegar. |

```
Navegador ──sesión──▶ Supabase (RLS filtra por user_id)
    │                     ▲
    │  "añade esta URL"   │ guarda item + primer precio
    └───────────▶ Edge Function scrape ──▶ tienda
                          ▲
                   pg_cron cada 15 min
```

Todo dentro del plan gratuito: Vercel Hobby y Supabase Free. El proyecto de
Supabase (`muebles`, `ovmnzlbcmuppqctkyngi`) es exclusivo de Vigía y no tiene
ninguna relación con Bilans.

---

## Por qué el navegador habla con Supabase y no con un backend propio

Porque RLS **es** el backend. Con `user_id` en cada tabla y una política `_own`,
la base de datos rechaza por sí misma cualquier fila que no sea del usuario de la
sesión, aunque alguien manipule la petición desde la consola del navegador. Meter
un intermediario solo tendría sentido para esconder credenciales, y con auth real
no hay credenciales que esconder: la `anon key` es pública por diseño y no sirve
de nada sin una sesión válida.

La única pieza que sí necesita servidor es `scrape`, porque descarga páginas de
terceros: eso el navegador no puede hacerlo (CORS) y además conviene que salga
desde una IP que no sea la del usuario.

---

## Esquema propuesto

Convención: nombre de tabla en inglés, campos con prefijo de tabla.

### `items`

Un artículo vigilado. Uno por URL y usuario.

| Campo | Tipo | Notas |
|---|---|---|
| `itm_id` | uuid PK | |
| `itm_usr_id` | uuid | FK a `auth.users`. **NOT NULL.** Base de toda la RLS. |
| `itm_url` | text | Normalizada (sin parámetros de tracking). Única por usuario. |
| `itm_title` | text | Del extractor, editable a mano. |
| `itm_image_url` | text | Se enlaza la de la tienda, no se copia. |
| `itm_price` | numeric | Último precio conocido. |
| `itm_currency` | text | Default `EUR`. |
| `itm_is_manual` | boolean | `true` si el precio lo mete el usuario porque la tienda bloquea. |
| `itm_in_stock` | boolean | Nullable: hay tiendas que no lo dicen. |
| `itm_notes` | text | |
| `itm_fld_id` | uuid | FK a `folders`. Nullable. |
| `itm_last_checked_at` | timestamptz | |
| `itm_last_error` | text | Último fallo de lectura, para poder diagnosticar. |
| `itm_created_at` | timestamptz | Desde aquí arranca el histórico. |

### `price_history`

Una fila por lectura. Es el corazón del proyecto: no se borra ni se compacta.

| Campo | Tipo | Notas |
|---|---|---|
| `ph_id` | bigint PK | |
| `ph_itm_id` | uuid | FK a `items`, `ON DELETE CASCADE`. |
| `ph_price` | numeric | |
| `ph_in_stock` | boolean | Nullable. |
| `ph_source` | text | `auto` · `manual`. Distingue lo leído de lo tecleado. |
| `ph_checked_at` | timestamptz | Índice por `(ph_itm_id, ph_checked_at)`. |

### `folders`

Las carpetas del usuario. Sustituyen al campo `category` de texto libre de la
app vieja.

| Campo | Tipo | Notas |
|---|---|---|
| `fld_id` | uuid PK | |
| `fld_usr_id` | uuid | FK a `auth.users`. |
| `fld_name` | text | |
| `fld_order` | int | Orden manual. |

### `store_rules`

Cómo leer el precio en cada dominio. **Datos, no código**: añadir una tienda
difícil no exige tocar la función ni redesplegar.

| Campo | Tipo | Notas |
|---|---|---|
| `sr_id` | uuid PK | |
| `sr_domain` | text | `ikea.com`, `sklum.com`… Único. |
| `sr_strategy` | jsonb | Orden de intentos: JSON-LD, Open Graph, selector propio. |
| `sr_fetch_mode` | text | `direct` · `pg_net` (salida alternativa para Amazon). |
| `sr_blocked` | boolean | `true` = solo precio manual. Ver `docs/TIENDAS.md`. |
| `sr_updated_at` | timestamptz | |

Esta tabla es **global**, no por usuario: son reglas técnicas, no datos
personales. Lectura para `authenticated`, escritura solo `service_role`.

---

## Qué se queda de la app vieja

| Pieza | Destino |
|---|---|
| `extract.ts` (extracción de precios) | **Se queda.** Es lo más valioso: JSON-LD → Open Graph → fallbacks por tienda, probado contra tiendas reales. |
| Modelo `items` / `price_history` | **Se queda**, con la convención de nombres nueva y `user_id`. |
| Salida por `pg_net` para Amazon | **Se queda.** Amazon bloquea la IP de las Edge Functions; salir por la de Postgres funciona. |
| `ui.html` dentro de una fila de la BD | Fuera. La interfaz pasa a ser una app Vite normal. |
| Clave de acceso compartida en el código | Fuera. Sustituida por auth real. |
| Edge Function que servía la web | Fuera. Queda una sola función, y solo para leer precios. |
