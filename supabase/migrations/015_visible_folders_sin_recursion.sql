-- Arregla la recursion infinita de RLS en carpetas compartidas (2026-09-28).
--
-- vigia.visible_folder_ids() era SECURITY INVOKER: su consulta a
-- vigia.folders pasaba por la politica folders_select, que a su vez llama a
-- visible_folder_ids(), que vuelve a consultar folders... hasta
-- "stack depth limit exceeded". Al dueno no le pasaba por suerte del plan
-- (el OR de la politica se resolvia con fld_usr_id sin llegar a la
-- subconsulta), pero en cuanto un usuario tenia una invitacion ACEPTADA,
-- cualquier select suyo sobre folders, items o price_history fallaba, y el
-- frontend lo mostraba como lista vacia. Reproducido en produccion con la
-- invitacion aceptada de la carpeta "Pisito".
--
-- Solucion: SECURITY DEFINER, para que la consulta interna no vuelva a
-- pasar por la RLS de folders/folder_shares. Sigue filtrando por
-- (select auth.uid()), asi que solo devuelve las carpetas del usuario de la
-- sesion: no amplia lo que nadie puede ver. search_path fijado y EXECUTE
-- revocado a anon/PUBLIC, como exige CLAUDE.md para toda SECURITY DEFINER.

create or replace function vigia.visible_folder_ids()
returns setof uuid
language sql
security definer
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
