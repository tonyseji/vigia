-- Toda cuenta tiene su fila de user_settings desde que se crea.
--
-- Hasta ahora la fila solo existia si el usuario pulsaba Guardar en Ajustes
-- (la 005 rellenó a los que habia entonces). run_scheduled_refresh() elige a
-- quien refrescar leyendo user_settings, y la Edge Function refresh lee de ahi
-- el umbral de aviso: sin fila, los articulos de esa cuenta nunca se
-- refrescaban solos ni avisaban. El 2026-09-29 eran dos de las tres cuentas.
--
-- La fila se crea con los valores por defecto de la tabla (refresco diario a
-- las 4:00, cualquier bajada avisa), los mismos que ya mostraba Ajustes.

create or replace function vigia.create_user_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into vigia.user_settings (us_usr_id)
  values (new.id)
  on conflict (us_usr_id) do nothing;
  return null;
exception
  when others then
    -- Un fallo aqui no puede impedir que alguien se registre.
    raise warning 'create_user_settings: %', sqlerrm;
    return null;
end;
$$;

revoke execute on function vigia.create_user_settings() from anon, authenticated, public;

create trigger trg_create_user_settings
  after insert on auth.users
  for each row
  execute function vigia.create_user_settings();

-- Cuentas creadas entre la 005 y esta migracion.
insert into vigia.user_settings (us_usr_id)
select id from auth.users
on conflict (us_usr_id) do nothing;
