-- Carpetas compartidas (parte 3): RLS combinada (dueno o carpeta compartida
-- aceptada), resolucion de invitaciones al registrarse, y RPCs de
-- aceptar/rechazar/revocar. Ver docs/superpowers/specs/2026-09-06-carpetas-compartidas-design.md,
-- secciones D, E y F.

-- ============================================================
-- Funcion auxiliar: carpetas visibles para el usuario actual
-- ============================================================

create or replace function vigia.visible_folder_ids()
returns setof uuid
language sql
security invoker
stable
set search_path = public
as $$
  select f.fld_id
  from vigia.folders f
  where f.fld_usr_id = (select auth.uid())
  union
  select f.fld_id
  from vigia.folders f
  join vigia.folder_shares s
    on s.shr_fld_id = coalesce(f.fld_parent_id, f.fld_id)
  where s.shr_invited_usr_id = (select auth.uid())
    and s.shr_status = 'accepted'
$$;

revoke execute on function vigia.visible_folder_ids() from anon, public;
grant execute on function vigia.visible_folder_ids() to authenticated;

-- ============================================================
-- folders: el dueno mantiene control total; el invitado solo lectura
-- ============================================================

drop policy folders_own on vigia.folders;

create policy folders_own on vigia.folders
  for all
  to authenticated
  using ((select auth.uid()) = fld_usr_id)
  with check ((select auth.uid()) = fld_usr_id);

create policy folders_shared_read on vigia.folders
  for select
  to authenticated
  using (fld_id in (select vigia.visible_folder_ids()));

-- ============================================================
-- items: el invitado puede ver, anadir, editar y borrar igual que el dueno
-- ============================================================

drop policy items_own on vigia.items;

create policy items_own on vigia.items
  for all
  to authenticated
  using ((select auth.uid()) = itm_usr_id)
  with check ((select auth.uid()) = itm_usr_id);

create policy items_shared on vigia.items
  for all
  to authenticated
  using (itm_fld_id in (select vigia.visible_folder_ids()))
  with check (itm_fld_id in (select vigia.visible_folder_ids()));

create index items_fld_idx on vigia.items (itm_fld_id);

-- ============================================================
-- price_history: hereda visibilidad de items (dueno o carpeta compartida)
-- ============================================================

drop policy price_history_own on vigia.price_history;

create policy price_history_own on vigia.price_history
  for all
  to authenticated
  using (
    exists (
      select 1 from vigia.items
      where itm_id = ph_itm_id
        and (
          itm_usr_id = (select auth.uid())
          or itm_fld_id in (select vigia.visible_folder_ids())
        )
    )
  )
  with check (
    exists (
      select 1 from vigia.items
      where itm_id = ph_itm_id
        and (
          itm_usr_id = (select auth.uid())
          or itm_fld_id in (select vigia.visible_folder_ids())
        )
    )
  );

-- ============================================================
-- Resolver invitaciones pendientes al registrarse (email sin cuenta previa)
-- ============================================================

create or replace function vigia.resolve_pending_shares()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update vigia.folder_shares
  set shr_invited_usr_id = new.id
  where lower(shr_invited_email) = lower(new.email)
    and shr_invited_usr_id is null
    and shr_status = 'pending';
  return new;
exception
  when others then
    return new;
end;
$$;

revoke execute on function vigia.resolve_pending_shares() from anon, public;

create trigger trg_resolve_pending_shares
  after insert on auth.users
  for each row
  execute function vigia.resolve_pending_shares();

-- ============================================================
-- Aceptar / rechazar (el invitado)
-- ============================================================

create or replace function vigia.accept_folder_share(p_shr_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update vigia.folder_shares
  set shr_status = 'accepted', shr_responded_at = now()
  where shr_id = p_shr_id
    and shr_invited_usr_id = (select auth.uid())
    and shr_status = 'pending';

  if not found then
    raise exception 'Invitacion no encontrada o ya resuelta';
  end if;
end;
$$;

revoke execute on function vigia.accept_folder_share(uuid) from anon, public;
grant execute on function vigia.accept_folder_share(uuid) to authenticated;

create or replace function vigia.reject_folder_share(p_shr_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update vigia.folder_shares
  set shr_status = 'revoked', shr_responded_at = now()
  where shr_id = p_shr_id
    and shr_invited_usr_id = (select auth.uid())
    and shr_status = 'pending';

  if not found then
    raise exception 'Invitacion no encontrada o ya resuelta';
  end if;
end;
$$;

revoke execute on function vigia.reject_folder_share(uuid) from anon, public;
grant execute on function vigia.reject_folder_share(uuid) to authenticated;

-- ============================================================
-- Revocar (el dueno): ademas desengancha los items que el invitado anadio
-- ============================================================

create or replace function vigia.revoke_folder_share(p_shr_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fld_id uuid;
  v_invited_usr_id uuid;
begin
  select shr_fld_id, shr_invited_usr_id into v_fld_id, v_invited_usr_id
  from vigia.folder_shares
  where shr_id = p_shr_id
    and shr_owner_usr_id = (select auth.uid());

  if not found then
    raise exception 'Invitacion no encontrada';
  end if;

  update vigia.folder_shares
  set shr_status = 'revoked', shr_responded_at = now()
  where shr_id = p_shr_id;

  -- Los items que el invitado anadio pasan a "Sin carpeta" de su propiedad,
  -- igual que ya ocurre hoy al borrar una carpeta (ON DELETE SET NULL).
  -- Los del dueno se quedan donde estan.
  if v_invited_usr_id is not null then
    update vigia.items
    set itm_fld_id = null
    where itm_usr_id = v_invited_usr_id
      and itm_fld_id in (
        select fld_id from vigia.folders
        where fld_id = v_fld_id or fld_parent_id = v_fld_id
      );
  end if;
end;
$$;

revoke execute on function vigia.revoke_folder_share(uuid) from anon, public;
grant execute on function vigia.revoke_folder_share(uuid) to authenticated;
