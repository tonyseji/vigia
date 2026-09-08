-- Carpetas compartidas (parte 2): invitaciones a compartir una carpeta de
-- primer nivel. Ver docs/superpowers/specs/2026-09-06-carpetas-compartidas-design.md,
-- seccion B. shr_invited_usr_id puede ser NULL mientras la persona invitada
-- no tiene cuenta en Vigia todavia (se resuelve en la migracion 011, trigger
-- sobre auth.users).

create table vigia.folder_shares (
  shr_id uuid primary key default gen_random_uuid(),
  shr_fld_id uuid not null references vigia.folders(fld_id) on delete cascade,
  shr_owner_usr_id uuid not null references auth.users(id) on delete cascade,
  shr_invited_email text not null,
  shr_invited_usr_id uuid references auth.users(id) on delete cascade,
  shr_status text not null default 'pending'
    check (shr_status in ('pending', 'accepted', 'revoked')),
  shr_created_at timestamptz not null default now(),
  shr_responded_at timestamptz,
  unique (shr_fld_id, shr_invited_email)
);

comment on column vigia.folder_shares.shr_fld_id is
  'Debe ser una carpeta de primer nivel (fld_parent_id is null). Se valida '
  'con el trigger trg_folder_shares_top_level, no con CHECK, porque hace '
  'falta leer la fila referenciada.';
comment on column vigia.folder_shares.shr_invited_email is
  'Email normalizado en minusculas. Es la clave de invitacion hasta que se '
  'resuelve a shr_invited_usr_id.';
comment on column vigia.folder_shares.shr_invited_usr_id is
  'Se rellena al invitar (si el email ya tiene cuenta) o al registrarse '
  '(trigger sobre auth.users, migracion 011). Null mientras tanto.';

create index folder_shares_fld_idx on vigia.folder_shares (shr_fld_id);
create index folder_shares_invited_usr_idx on vigia.folder_shares (shr_invited_usr_id)
  where shr_status = 'accepted';
create index folder_shares_pending_email_idx on vigia.folder_shares (shr_invited_email)
  where shr_status = 'pending' and shr_invited_usr_id is null;

-- Solo se puede compartir una carpeta de primer nivel (seccion B del diseno).
create or replace function vigia.check_share_top_level()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_parent uuid;
begin
  select fld_parent_id into v_parent
  from vigia.folders
  where fld_id = new.shr_fld_id;

  if v_parent is not null then
    raise exception 'Solo se pueden compartir carpetas de primer nivel, no subcarpetas';
  end if;

  return new;
exception
  when others then
    raise;
end;
$$;

revoke execute on function vigia.check_share_top_level() from anon, public;

create trigger trg_folder_shares_top_level
  before insert or update on vigia.folder_shares
  for each row
  execute function vigia.check_share_top_level();

alter table vigia.folder_shares enable row level security;

create policy folder_shares_owner on vigia.folder_shares
  for all
  to authenticated
  using ((select auth.uid()) = shr_owner_usr_id)
  with check ((select auth.uid()) = shr_owner_usr_id);

create policy folder_shares_invited_read on vigia.folder_shares
  for select
  to authenticated
  using ((select auth.uid()) = shr_invited_usr_id);

create policy folder_shares_invited_respond on vigia.folder_shares
  for update
  to authenticated
  using ((select auth.uid()) = shr_invited_usr_id)
  with check ((select auth.uid()) = shr_invited_usr_id);

grant select, insert, update, delete on vigia.folder_shares to authenticated;
grant all on vigia.folder_shares to service_role;
