-- Shein y AliExpress, bloqueadas (docs/TIENDAS.md, sesión 31).
--
-- Probado el 2026-10-04 pidiendo las páginas desde Supabase (pg_net):
-- Shein redirige a su captcha (/risk/challenge?captcha_type=909) en
-- búsqueda y categorías; una ficha de AliExpress pegada en la app se guardó
-- sin precio (lo pinta con JavaScript). Bloqueadas, Vigía avisa al pegarlas
-- y ofrece guardarlas con precio a mano en vez de guardar algo sin precio
-- (o, en Shein, con el título de su portada).
--
-- store_rules se busca por el host exacto sin «www.» (useItems, scrape,
-- refresh, save-link, record-price), así que van los hosts que se usan de
-- verdad: el principal, el de España, el móvil y los de enlaces de compartir.

insert into vigia.store_rules (sr_domain, sr_strategy, sr_fetch_mode, sr_blocked) values
  ('aliexpress.com', '[]'::jsonb, 'direct', true),
  ('es.aliexpress.com', '[]'::jsonb, 'direct', true),
  ('m.aliexpress.com', '[]'::jsonb, 'direct', true),
  ('a.aliexpress.com', '[]'::jsonb, 'direct', true),
  ('shein.com', '[]'::jsonb, 'direct', true),
  ('es.shein.com', '[]'::jsonb, 'direct', true),
  ('m.shein.com', '[]'::jsonb, 'direct', true),
  ('api-shein.shein.com', '[]'::jsonb, 'direct', true),
  ('onelink.shein.com', '[]'::jsonb, 'direct', true)
on conflict (sr_domain) do update set sr_blocked = true;
