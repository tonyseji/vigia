-- Carpetas de tres niveles: Pisito / Dormitorio / Camas (peticion de Tony,
-- 2026-10-25, docs/DECISIONES.md).
--
-- Hasta aqui la jerarquia era de dos niveles (009) y tres sitios lo daban
-- por hecho: el trigger de profundidad, visible_folder_ids() (que buscaba la
-- carpeta compartida con coalesce(padre, propia)) y revoke_folder_share()
-- (que soltaba los articulos de la carpeta y sus hijas directas). Los tres
-- pasan a recorrer el arbol entero, asi que subir el tope otra vez solo
-- exigiria cambiar v_max_levels.
--
-- Compartir sigue siendo de una carpeta de primer nivel completa (010, 018):
-- todo lo que cuelga de ella, a cualquier profundidad, se comparte con ella.

create or replace function vigia.check_folder_depth()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_max_levels constant int := 3;
  v_depth int := 1;
  v_height int := 0;
  v_current uuid := new.fld_parent_id;
begin
  -- Primer nivel, o un cambio que no la mueve (renombrar, reordenar).
  if new.fld_parent_id is null
     or (tg_op = 'UPDATE' and new.fld_parent_id is not distinct from old.fld_parent_id) then
    return new;
  end if;

  -- Niveles por encima: se sube desde el padre hasta la raiz. Si en el
  -- camino aparece la propia carpeta, se estaria metiendo dentro de si misma.
  while v_current is not null loop
    if v_current = new.fld_id then
      raise exception 'Una carpeta no puede ir dentro de si misma';
    end if;
    v_depth := v_depth + 1;
    select fld_parent_id into v_current
    from vigia.folders
    where fld_id = v_current;
  end loop;

  -- Al mover una carpeta que ya tiene subcarpetas, sus niveles de debajo
  -- tambien cuentan. Al crearla no tiene ninguna.
  if tg_op = 'UPDATE' then
    with recursive below as (
      select fld_id, 1 as lvl from vigia.folders where fld_parent_id = new.fld_id
      union all
      select f.fld_id, b.lvl + 1 from vigia.folders f join below b on f.fld_parent_id = b.fld_id
    )
    select coalesce(max(lvl), 0) into v_height from below;
  end if;

  if v_depth + v_height > v_max_levels then
    raise exception 'Vigia solo admite tres niveles de carpetas';
  end if;

  return new;
exception
  when others then
    raise;
end;
$$;

revoke execute on function vigia.check_folder_depth() from anon, public;

alter trigger trg_folders_max_two_levels on vigia.folders rename to trg_folders_max_depth;

comment on column vigia.folders.fld_parent_id is
  'NULL = carpeta de primer nivel. No NULL = subcarpeta. Maximo tres niveles, '
  'forzado por el trigger trg_folders_max_depth (un CHECK de columna no '
  'puede consultar otras filas de la misma tabla).';

-- Lo propio, y la carpeta compartida aceptada con todo lo que cuelga de ella.
-- Sigue siendo SECURITY DEFINER por lo explicado en la 015 (sin recursion de
-- RLS) y sigue filtrando por (select auth.uid()).
create or replace function vigia.visible_folder_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  with recursive shared as (
    select f.fld_id
    from vigia.folders f
    join vigia.folder_shares s on s.shr_fld_id = f.fld_id
    where s.shr_invited_usr_id = (select auth.uid())
      and s.shr_status = 'accepted'
    union
    select c.fld_id
    from vigia.folders c
    join shared p on c.fld_parent_id = p.fld_id
  )
  select f.fld_id
  from vigia.folders f
  where f.fld_usr_id = (select auth.uid())
  union
  select fld_id from shared
$$;

revoke execute on function vigia.visible_folder_ids() from anon, public;
grant execute on function vigia.visible_folder_ids() to authenticated;

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

  -- Los items que el invitado anadio en cualquier nivel del arbol pasan a
  -- "Sin carpeta" de su propiedad (como en la 011). Los del dueno se quedan.
  if v_invited_usr_id is not null then
    with recursive tree as (
      select v_fld_id as fld_id
      union
      select f.fld_id from vigia.folders f join tree t on f.fld_parent_id = t.fld_id
    )
    update vigia.items
    set itm_fld_id = null
    where itm_usr_id = v_invited_usr_id
      and itm_fld_id in (select fld_id from tree);
  end if;
end;
$$;

revoke execute on function vigia.revoke_folder_share(uuid) from anon, public;
grant execute on function vigia.revoke_folder_share(uuid) to authenticated;
