-- Fase 2: esquema inicial de Vigia.
-- Todo vive en el schema `vigia`, no en `public` (ver docs/DECISIONES.md,
-- 2026-09-03: "El esquema nuevo vive en un schema vigia, no en public").
-- El schema `public` es de la app vieja y no se toca hasta la fase 6.

create schema if not exists vigia;

-- ============================================================
-- folders — carpetas del usuario (cierra backlog B1)
-- ============================================================

create table vigia.folders (
  fld_id uuid primary key default gen_random_uuid(),
  fld_usr_id uuid not null references auth.users(id) on delete cascade,
  fld_name text not null,
  fld_order int not null default 0,
  fld_created_at timestamptz not null default now()
);

alter table vigia.folders enable row level security;

create policy folders_own on vigia.folders
  for all
  to authenticated
  using ((select auth.uid()) = fld_usr_id)
  with check ((select auth.uid()) = fld_usr_id);

grant select, insert, update, delete on vigia.folders to authenticated;
grant all on vigia.folders to service_role;

-- ============================================================
-- items — un articulo vigilado, uno por URL y usuario
-- ============================================================

create table vigia.items (
  itm_id uuid primary key default gen_random_uuid(),
  itm_usr_id uuid not null references auth.users(id) on delete cascade,
  itm_url text not null,
  itm_title text,
  itm_image_url text,
  itm_price numeric,
  itm_currency text not null default 'EUR',
  itm_is_manual boolean not null default false,
  itm_in_stock boolean,
  itm_notes text,
  itm_fld_id uuid references vigia.folders(fld_id) on delete set null,
  itm_last_checked_at timestamptz,
  itm_last_error text,
  itm_created_at timestamptz not null default now()
);

create unique index items_usr_url_key on vigia.items (itm_usr_id, itm_url);
create index items_usr_fld_idx on vigia.items (itm_usr_id, itm_fld_id);

alter table vigia.items enable row level security;

create policy items_own on vigia.items
  for all
  to authenticated
  using ((select auth.uid()) = itm_usr_id)
  with check ((select auth.uid()) = itm_usr_id);

grant select, insert, update, delete on vigia.items to authenticated;
grant all on vigia.items to service_role;

-- ============================================================
-- price_history — una fila por lectura, no se borra ni se compacta
-- ============================================================

create table vigia.price_history (
  ph_id bigint generated always as identity primary key,
  ph_itm_id uuid not null references vigia.items(itm_id) on delete cascade,
  ph_price numeric,
  ph_in_stock boolean,
  ph_source text not null default 'auto' check (ph_source in ('auto', 'manual')),
  ph_checked_at timestamptz not null default now()
);

create index price_history_itm_checked_idx
  on vigia.price_history (ph_itm_id, ph_checked_at desc);

alter table vigia.price_history enable row level security;

-- price_history no tiene columna de dueno propia: hereda el dueno de su item.
create policy price_history_own on vigia.price_history
  for all
  to authenticated
  using (
    exists (
      select 1 from vigia.items
      where itm_id = ph_itm_id
        and itm_usr_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from vigia.items
      where itm_id = ph_itm_id
        and itm_usr_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on vigia.price_history to authenticated;
grant all on vigia.price_history to service_role;

-- ============================================================
-- user_settings — una fila por usuario, preferencias de refresco
-- ============================================================

create table vigia.user_settings (
  us_usr_id uuid primary key references auth.users(id) on delete cascade,
  us_refresh_mode text not null default 'daily'
    check (us_refresh_mode in ('off', 'daily', '12h', '6h')),
  us_refresh_hour int not null default 4 check (us_refresh_hour between 0 and 23),
  us_last_refresh_at timestamptz
);

alter table vigia.user_settings enable row level security;

create policy user_settings_own on vigia.user_settings
  for all
  to authenticated
  using ((select auth.uid()) = us_usr_id)
  with check ((select auth.uid()) = us_usr_id);

grant select, insert, update, delete on vigia.user_settings to authenticated;
grant all on vigia.user_settings to service_role;

-- ============================================================
-- store_rules — reglas de lectura por tienda. Global, no por usuario.
-- ============================================================

create table vigia.store_rules (
  sr_id uuid primary key default gen_random_uuid(),
  sr_domain text not null unique,
  sr_strategy jsonb not null default '[]'::jsonb,
  sr_fetch_mode text not null default 'direct' check (sr_fetch_mode in ('direct', 'pg_net')),
  sr_blocked boolean not null default false,
  sr_updated_at timestamptz not null default now()
);

alter table vigia.store_rules enable row level security;

-- Solo lectura para authenticated: son reglas tecnicas, no datos personales.
-- La escritura queda para service_role (sin politica adicional: RLS deniega
-- por defecto y service_role salta RLS).
create policy store_rules_read on vigia.store_rules
  for select
  to authenticated
  using (true);

grant select on vigia.store_rules to authenticated;
grant all on vigia.store_rules to service_role;

-- ============================================================
-- Indice que faltaba en la FK de folders (detectado por el advisor de
-- rendimiento tras aplicar esta migracion: cubre folders_fld_usr_id_fkey,
-- que la politica RLS de items usa por la relacion itm_fld_id -> folders).
-- ============================================================

create index folders_usr_idx on vigia.folders (fld_usr_id);
