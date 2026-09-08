-- Fase 5: umbral de aviso configurable (user_settings) e idempotencia del
-- aviso de bajada (items). Ver docs/DECISIONES.md 2026-09-06: "El umbral del
-- aviso es configurable..." y "El aviso de bajada de precio se hace
-- idempotente con una columna en items...".
-- Sin logica todavia: la Edge Function refresh (etapa 3) es quien las usa.

alter table vigia.user_settings
  add column us_notify_enabled boolean not null default true,
  add column us_notify_kind text not null default 'any'
    check (us_notify_kind in ('any', 'pct', 'eur')),
  add column us_notify_pct numeric not null default 5,
  add column us_notify_eur numeric not null default 10,
  add column us_notify_min_hist boolean not null default true,
  add column us_notify_back_in_stock boolean not null default true;

comment on column vigia.user_settings.us_notify_kind is
  'any: cualquier bajada avisa. pct: solo si baja >= us_notify_pct por ciento. '
  'eur: solo si baja >= us_notify_eur euros. min_hist y back_in_stock avisan '
  'siempre que esten activados, sin pasar por el umbral.';

alter table vigia.items
  add column itm_notified_price numeric,
  add column itm_notified_at timestamptz;

comment on column vigia.items.itm_notified_price is
  'Ultimo precio por el que ya se avisó. Solo se avisa de nuevo si el precio '
  'baja por debajo de este valor (idempotencia del pase de refresco).';

-- Crea la fila de ajustes para usuarios que ya existan y todavia no la tengan
-- (hoy nadie lee user_settings, asi que puede no existir para nadie).
insert into vigia.user_settings (us_usr_id)
select id from auth.users
on conflict (us_usr_id) do nothing;
