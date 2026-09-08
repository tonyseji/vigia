-- Semilla de store_rules con el estado real de cada tienda (docs/TIENDAS.md).
-- Datos, no estructura: se editan con el tiempo sin tocar codigo ni redesplegar.

insert into vigia.store_rules (sr_domain, sr_strategy, sr_fetch_mode, sr_blocked) values
  ('ikea.com', '["json-ld"]'::jsonb, 'direct', false),
  ('sklum.com', '["json-ld"]'::jsonb, 'direct', false),
  ('leroymerlin.es', '["json-ld", "open-graph"]'::jsonb, 'direct', false),
  ('amazon.es', '["embedded", "domain-specific"]'::jsonb, 'pg_net', false),
  ('kavehome.com', '[]'::jsonb, 'direct', true),
  ('maisonsdumonde.com', '[]'::jsonb, 'direct', true)
on conflict (sr_domain) do nothing;
