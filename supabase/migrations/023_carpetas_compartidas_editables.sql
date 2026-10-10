-- Carpetas compartidas: quien tiene acceso las gestiona igual que el dueno
-- (decision de Tony, 2026-10-10, docs/DECISIONES.md).
--
-- Hasta ahora el invitado solo podia ver la carpeta y operar sobre sus
-- articulos; crear, renombrar o borrar carpetas era solo del dueno (012).
-- Desde aqui, cualquiera con acceso a una carpeta compartida puede:
--   - renombrar la carpeta compartida y sus subcarpetas,
--   - crear subcarpetas dentro de ella,
--   - borrar subcarpetas (sus articulos pasan a «Sin carpeta» de cada uno,
--     por el ON DELETE SET NULL de la 001, igual que cuando borra el dueno).
-- Siguen siendo solo del dueno: borrar la carpeta de primer nivel (la
-- quitaria a todos) y compartirla (create_folder_share_link ya lo exige).
--
-- Una subcarpeta es siempre del dueno de su carpeta padre, la cree quien la
-- cree: si el dueno retira la invitacion, el arbol sigue entero en su cuenta
-- y no queda una subcarpeta huerfana en la del invitado. Por eso el trigger
-- fija fld_usr_id al del padre y nadie puede cambiar el dueno ni sacar una
-- carpeta del arbol de otro.

create or replace function vigia.guard_folder_tree()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_parent_owner uuid;
begin
  if tg_op = 'UPDATE' then
    if new.fld_usr_id is distinct from old.fld_usr_id then
      raise exception 'No se puede cambiar el dueno de una carpeta';
    end if;
    if new.fld_parent_id is distinct from old.fld_parent_id
       and old.fld_usr_id is distinct from (select auth.uid()) then
      raise exception 'Solo el dueno puede mover una carpeta';
    end if;
  end if;

  if new.fld_parent_id is not null then
    -- SECURITY INVOKER: el padre solo se lee si quien llama lo ve (RLS).
    select fld_usr_id into v_parent_owner
    from vigia.folders
    where fld_id = new.fld_parent_id;

    if tg_op = 'INSERT' then
      if v_parent_owner is not null then
        new.fld_usr_id := v_parent_owner;
      end if;
    elsif new.fld_parent_id is distinct from old.fld_parent_id
          and v_parent_owner is distinct from new.fld_usr_id then
      raise exception 'Una subcarpeta solo puede ir dentro de una carpeta del mismo dueno';
    end if;
  end if;

  -- Trigger BEFORE: devolver NULL cancelaria la fila, asi que aqui se
  -- devuelve NEW (mismo patron que check_folder_depth, migracion 009).
  return new;
exception
  when others then
    raise;
end;
$$;

revoke execute on function vigia.guard_folder_tree() from anon, public;

create trigger trg_folders_guard_tree
  before insert or update on vigia.folders
  for each row
  execute function vigia.guard_folder_tree();

drop policy folders_insert on vigia.folders;
drop policy folders_update on vigia.folders;
drop policy folders_delete on vigia.folders;

-- Primer nivel: solo a tu nombre. Subcarpeta: dentro de una carpeta que ves
-- (el trigger ya ha puesto fld_usr_id = dueno del padre cuando esto se mira).
create policy folders_insert on vigia.folders
  for insert
  to authenticated
  with check (
    ((select auth.uid()) = fld_usr_id and fld_parent_id is null)
    or fld_parent_id in (select vigia.visible_folder_ids())
  );

create policy folders_update on vigia.folders
  for update
  to authenticated
  using (
    (select auth.uid()) = fld_usr_id
    or fld_id in (select vigia.visible_folder_ids())
  )
  with check (
    (select auth.uid()) = fld_usr_id
    or fld_id in (select vigia.visible_folder_ids())
  );

create policy folders_delete on vigia.folders
  for delete
  to authenticated
  using (
    (select auth.uid()) = fld_usr_id
    or (fld_parent_id is not null and fld_id in (select vigia.visible_folder_ids()))
  );
