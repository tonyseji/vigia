-- Grants necesarios para que PostgREST alcance el schema `vigia` por la Data
-- API, verificados contra docs.supabase.com/guides/api/using-custom-schemas
-- en la sesion que escribio esta migracion. Sin este GRANT, PostgREST
-- devuelve 42501 aunque el schema este marcado como expuesto en el dashboard.
--
-- Nada de GRANT ALL a `anon`: aqui no hay usuarios anonimos, y store_rules ya
-- tiene su propia politica de solo lectura para authenticated (migracion 001).
--
-- IMPORTANTE: este GRANT no basta por si solo. El schema `vigia` tambien debe
-- marcarse en el dashboard (Settings > API > Exposed schemas) — ese paso no
-- tiene equivalente en SQL.

grant usage on schema vigia to authenticated, service_role;

grant all on all tables in schema vigia to service_role;
grant all on all sequences in schema vigia to service_role;

grant select, insert, update, delete on all tables in schema vigia to authenticated;
grant usage, select on all sequences in schema vigia to authenticated;

alter default privileges for role postgres in schema vigia
  grant select, insert, update, delete on tables to authenticated;
alter default privileges for role postgres in schema vigia
  grant usage, select on sequences to authenticated;
alter default privileges for role postgres in schema vigia
  grant all on tables to service_role;
alter default privileges for role postgres in schema vigia
  grant all on sequences to service_role;
