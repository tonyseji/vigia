-- Carpetas compartidas (parte 1): jerarquia de dos niveles en folders.
-- Ver docs/superpowers/specs/2026-09-06-carpetas-compartidas-design.md, seccion A.
-- No destructivo: fld_parent_id nace NULL, asi que todas las carpetas
-- existentes quedan como de primer nivel sin backfill.

alter table vigia.folders
  add column fld_parent_id uuid references vigia.folders(fld_id) on delete cascade;

comment on column vigia.folders.fld_parent_id is
  'NULL = carpeta de primer nivel. No NULL = subcarpeta. Maximo dos niveles, '
  'forzado por el trigger trg_folders_max_two_levels (un CHECK de columna no '
  'puede consultar otras filas de la misma tabla).';

create index folders_parent_idx on vigia.folders (fld_parent_id);

-- Impide un tercer nivel: si el padre referenciado ya tiene padre, rechaza.
create or replace function vigia.check_folder_depth()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_parent_of_parent uuid;
begin
  if new.fld_parent_id is null then
    return new;
  end if;

  select fld_parent_id into v_parent_of_parent
  from vigia.folders
  where fld_id = new.fld_parent_id;

  if v_parent_of_parent is not null then
    raise exception 'Vigia solo admite dos niveles de carpetas: la carpeta padre ya es una subcarpeta';
  end if;

  return new;
exception
  when others then
    raise;
end;
$$;

revoke execute on function vigia.check_folder_depth() from anon, public;

create trigger trg_folders_max_two_levels
  before insert or update on vigia.folders
  for each row
  execute function vigia.check_folder_depth();
