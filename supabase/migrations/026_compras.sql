-- Compras: registro de lo comprado, dentro o fuera de Vigia (sesion 47).
-- Ver docs/superpowers/specs/2026-11-12-compras-design.md.
--
-- Una compra puede colgar de una carpeta: si la carpeta esta compartida, sus
-- compras tambien (misma regla que items). Sin carpeta es privada de quien la
-- registro. Puede venir de un articulo vigilado (pur_itm_id) o ser de fuera.

create table vigia.purchases (
  pur_id uuid primary key default gen_random_uuid(),
  pur_usr_id uuid not null default (select auth.uid()) references auth.users(id) on delete cascade,
  pur_title text not null check (length(btrim(pur_title)) > 0),
  pur_amount numeric(12,2) not null check (pur_amount >= 0),
  pur_currency text not null default 'EUR',
  pur_date date not null default current_date,
  pur_store text,
  pur_notes text,
  pur_fld_id uuid references vigia.folders(fld_id) on delete set null,
  pur_itm_id uuid references vigia.items(itm_id) on delete set null,
  pur_created_at timestamptz not null default now()
);

create index purchases_usr_idx on vigia.purchases (pur_usr_id, pur_date desc);
create index purchases_fld_idx on vigia.purchases (pur_fld_id);
create index purchases_itm_idx on vigia.purchases (pur_itm_id);

alter table vigia.purchases enable row level security;

-- Misma forma que items_all (016): veo las mias y las de carpetas que veo; la
-- carpeta de destino tiene que ser null o una que veo; el articulo enlazado,
-- uno que veo (la subconsulta pasa por la RLS de items).
create policy purchases_all on vigia.purchases
  for all
  to authenticated
  using (
    (select auth.uid()) = pur_usr_id
    or pur_fld_id in (select vigia.visible_folder_ids())
  )
  with check (
    (pur_fld_id is null or pur_fld_id in (select vigia.visible_folder_ids()))
    and (
      (select auth.uid()) = pur_usr_id
      or pur_fld_id in (select vigia.visible_folder_ids())
    )
    and (pur_itm_id is null or exists (select 1 from vigia.items where itm_id = pur_itm_id))
  );

grant select, insert, update, delete on vigia.purchases to authenticated;
grant all on vigia.purchases to service_role;

-- Articulo comprado: deja de vigilarse (refresh y extension lo saltan).
alter table vigia.items add column itm_bought_at timestamptz;
