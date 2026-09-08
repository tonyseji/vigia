-- Fase 5: camino pg_net para tiendas que bloquean la IP de las Edge Functions
-- (cierra backlog B9). Solo service_role puede ejecutarlas: una funcion que
-- descarga una URL arbitraria concedida a authenticated seria un SSRF. Ver
-- docs/DECISIONES.md.

create or replace function vigia.fetch_enqueue(p_url text, p_headers jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id bigint;
begin
  select net.http_get(
    url := p_url,
    headers := p_headers,
    timeout_milliseconds := 20000
  ) into v_request_id;
  return v_request_id;
end;
$$;

revoke execute on function vigia.fetch_enqueue(text, jsonb) from anon, public, authenticated;
grant execute on function vigia.fetch_enqueue(text, jsonb) to service_role;

create or replace function vigia.fetch_result(p_request_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status int;
  v_body text;
begin
  select status_code, content into v_status, v_body
  from net._http_response
  where id = p_request_id;

  if v_status is null and v_body is null then
    return null;
  end if;

  return jsonb_build_object('status', v_status, 'body', v_body);
end;
$$;

revoke execute on function vigia.fetch_result(bigint) from anon, public, authenticated;
grant execute on function vigia.fetch_result(bigint) to service_role;
