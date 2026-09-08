-- Fase 5: disparador del refresco automatico (cierra backlog B8 y la fase 5).
-- pg_cron + pg_net dentro de Supabase, con el secreto en Vault, no en el
-- comando del job. Ver docs/DECISIONES.md 2026-09-06, "El disparador del
-- refresco automatico es pg_cron + pg_net dentro de Supabase, no un cron de
-- Vercel" — incluye el hallazgo de que el job heredado (jobid=1, inactivo)
-- lleva su clave compartida en texto plano en cron.job.command.
--
-- PASO MANUAL OBLIGATORIO ANTES DE QUE ESTO FUNCIONE (no ejecutar en el
-- repo: metería el secreto en un archivo publico). Desde el SQL editor:
--
--   select encode(extensions.gen_random_bytes(32), 'hex');
--   -- copiar el resultado y usarlo en los dos sitios siguientes:
--   select vault.create_secret('<valor-generado-arriba>', 'vigia_cron_secret',
--     'Secreto compartido entre pg_cron y la Edge Function refresh');
--   -- pegar el MISMO valor como secret CRON_SECRET en
--   -- Supabase Dashboard -> Edge Functions -> Secrets

create or replace function vigia.run_scheduled_refresh()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_users uuid[];
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'vigia_cron_secret'
  limit 1;

  if v_secret is null then
    raise warning 'vigia_cron_secret no esta configurado en Vault; refresco automatico omitido';
    return;
  end if;

  select array_agg(us_usr_id) into v_users
  from vigia.user_settings
  where us_refresh_mode <> 'off'
    and (
      (us_refresh_mode = 'daily'
        and extract(hour from (now() at time zone 'Europe/Madrid')) = us_refresh_hour
        and (us_last_refresh_at is null or us_last_refresh_at < now() - interval '20 hours'))
      or (us_refresh_mode = '12h'
        and (us_last_refresh_at is null or us_last_refresh_at < now() - interval '11 hours'))
      or (us_refresh_mode = '6h'
        and (us_last_refresh_at is null or us_last_refresh_at < now() - interval '5 hours'))
    );

  if v_users is null or array_length(v_users, 1) = 0 then
    return;
  end if;

  -- net.http_post es asincrono: encola la peticion y vuelve enseguida.
  -- El limite de 5 minutos de la Edge Function no bloquea este job.
  perform net.http_post(
    url := 'https://ovmnzlbcmuppqctkyngi.supabase.co/functions/v1/refresh',
    body := jsonb_build_object('user_ids', to_jsonb(v_users)),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    timeout_milliseconds := 300000
  );
end;
$$;

revoke execute on function vigia.run_scheduled_refresh() from anon, public;

select cron.schedule(
  'vigia-refresco-horario',
  '5 * * * *',
  $$select vigia.run_scheduled_refresh();$$
);

-- ============================================================
-- Verificacion (ejecutar a mano, sin esperar horas):
-- ============================================================
--
-- 1) Ajustar la hora de prueba a la hora actual y disparar a mano:
--   update vigia.user_settings
--   set us_refresh_hour = extract(hour from now() at time zone 'Europe/Madrid')
--   where us_usr_id = '<tu-user-id>';
--   select vigia.run_scheduled_refresh();
--
-- 2) Ver si la peticion HTTP salio y que respondio la Edge Function:
--   select id, status_code, left(content, 200), created
--   from net._http_response order by id desc limit 5;
--
-- 3) Confirmar que pg_cron ejecuta de verdad (job de prueba a 1 minuto):
--   select cron.schedule('vigia-prueba', '* * * * *', $$select vigia.run_scheduled_refresh();$$);
--   -- esperar ~2 minutos
--   select jobid, runid, status, return_message, start_time, end_time
--   from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'vigia-prueba')
--   order by start_time desc limit 5;
--   select cron.unschedule('vigia-prueba');  -- IMPRESCINDIBLE borrarlo
--
-- 4) Confirmar que el job real quedo bien registrado:
--   select jobname, schedule, active from cron.job where jobname = 'vigia-refresco-horario';
--
-- 5) Confirmar que el secreto no aparece en el comando del job:
--   select command from cron.job where jobname = 'vigia-refresco-horario';
