-- Fase 6: retirada de la app vieja. La Edge Function `muebles` se borro el
-- 2026-09-09 (sin invocaciones en 24h, tablas ya vacias). Esta migracion
-- limpia lo que quedaba colgando en la base de datos:
--
-- 1. El cron job `muebles-refresh-precios`, inactivo desde
--    `desactivar_cron_app_vieja` pero aun registrado en cron.job con una
--    clave de acceso en texto plano en el header x-key. Sin la Edge
--    Function que llamaba, no tiene sentido dejarlo ni siquiera inactivo.
-- 2. Las tablas de la app vieja en el schema `public`: `items`,
--    `price_history` (0 filas cada una) y `settings` (1 fila, el HTML de
--    la interfaz vieja, ya sustituida por el frontend Vite/React y
--    conservada igualmente en el primer commit de este repo).

select cron.unschedule('muebles-refresh-precios');

drop table if exists public.price_history;
drop table if exists public.items;
drop table if exists public.settings;
