-- Fase 5: suscripciones Web Push (VAPID nativo, portado de Bilans).
-- Ver docs/DECISIONES.md 2026-09-06, "Notificaciones push nativas..." y
-- "psub_updated_at se escribe desde la Edge Function...".

create table vigia.push_subscriptions (
  psub_id uuid primary key default gen_random_uuid(),
  psub_usr_id uuid not null references auth.users(id) on delete cascade,
  psub_endpoint text not null,
  psub_p256dh text not null,
  psub_auth text not null,
  psub_is_active boolean not null default true,
  psub_created_at timestamptz not null default now(),
  psub_updated_at timestamptz not null default now(),
  unique (psub_usr_id, psub_endpoint)
);

comment on column vigia.push_subscriptions.psub_updated_at is
  'Se actualiza desde la Edge Function push-subscribe en cada upsert, no por '
  'trigger: ver docs/DECISIONES.md 2026-09-06 sobre por que no hay un '
  'BEFORE UPDATE aqui.';

create index push_subscriptions_usr_idx on vigia.push_subscriptions (psub_usr_id);
create index push_subscriptions_active_idx on vigia.push_subscriptions (psub_is_active)
  where psub_is_active = true;

alter table vigia.push_subscriptions enable row level security;

create policy push_subscriptions_own on vigia.push_subscriptions
  for all
  to authenticated
  using ((select auth.uid()) = psub_usr_id)
  with check ((select auth.uid()) = psub_usr_id);

grant select, insert, update, delete on vigia.push_subscriptions to authenticated;
grant all on vigia.push_subscriptions to service_role;
