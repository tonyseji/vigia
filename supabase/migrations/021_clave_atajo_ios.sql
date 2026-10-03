-- Clave del atajo de iOS «Guardar en Vigía» (Edge Function save-link).
--
-- En el iPhone una app web no puede salir en la hoja de compartir, así que
-- un atajo de la app Atajos manda la dirección a save-link. El atajo no
-- tiene sesión: lleva una clave personal que se crea en Ajustes
-- (src/lib/shortcutKey.js). Aquí solo se guarda su SHA-256; la clave no
-- vuelve a verse. Crear otra o desactivar el atajo la deja sin valor.
--
-- La columna la escribe el propio usuario con la política _own que ya tiene
-- user_settings (001). Poner un hash cualquiera solo afecta a su cuenta.
-- save-link la lee con service_role.

alter table vigia.user_settings
  add column us_shortcut_key_hash text
    check (us_shortcut_key_hash ~ '^[0-9a-f]{64}$');

comment on column vigia.user_settings.us_shortcut_key_hash is
  'SHA-256 (hex) de la clave del atajo de iOS. null: sin atajo.';

-- save-link busca al usuario por el hash.
create unique index user_settings_shortcut_key_hash_key
  on vigia.user_settings (us_shortcut_key_hash)
  where us_shortcut_key_hash is not null;
