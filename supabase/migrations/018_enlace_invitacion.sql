-- Compartir carpeta con un enlace de invitacion (docs/DECISIONES.md,
-- 2026-09-29). Sustituye a invitar por email en la interfaz: el dueno crea
-- un enlace, lo manda por WhatsApp o lo que sea, y quien lo abre (tras
-- entrar con su cuenta) se une a la carpeta. No hace falta saber su email.
--
-- Un enlace es una fila de folder_shares en estado 'pending' con token y
-- sin email ni usuario invitado. Al aceptarlo se rellenan con los de quien
-- lo abre, se pasa a 'accepted' y se borra el token: un solo uso. Caduca a
-- los 7 dias. Nadie mas que el dueno puede leer la fila (la politica
-- folder_shares_select exige ser dueno o invitado), asi que el token no se
-- filtra a otros usuarios.

alter table vigia.folder_shares
  alter column shr_invited_email drop not null,
  add column shr_token text unique,
  add column shr_expires_at timestamptz,
  add constraint folder_shares_email_o_token
    check (shr_invited_email is not null or shr_token is not null);

comment on column vigia.folder_shares.shr_token is
  'Token de un enlace de invitacion sin usar. Null en invitaciones por email '
  'y en enlaces ya aceptados (un solo uso).';
comment on column vigia.folder_shares.shr_expires_at is
  'Caducidad del enlace de invitacion (7 dias). Null en invitaciones por email.';

-- ============================================================
-- Crear enlace (el dueno)
-- ============================================================

create or replace function vigia.create_folder_share_link(p_fld_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_token text;
begin
  select fld_name into v_name
  from vigia.folders
  where fld_id = p_fld_id
    and fld_usr_id = (select auth.uid())
    and fld_parent_id is null;

  if not found then
    raise exception 'carpeta_no_valida';
  end if;

  -- 122 bits aleatorios de gen_random_uuid (nucleo de Postgres, no pgcrypto).
  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into vigia.folder_shares (
    shr_fld_id, shr_owner_usr_id, shr_invited_email, shr_invited_usr_id,
    shr_fld_name, shr_status, shr_token, shr_expires_at
  ) values (
    p_fld_id, (select auth.uid()), null, null,
    coalesce(v_name, ''), 'pending', v_token, now() + interval '7 days'
  );

  return v_token;
end;
$$;

revoke execute on function vigia.create_folder_share_link(uuid) from anon, public;
grant execute on function vigia.create_folder_share_link(uuid) to authenticated;

-- ============================================================
-- Aceptar enlace (quien lo abre)
-- ============================================================

create or replace function vigia.accept_folder_share_link(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_share vigia.folder_shares%rowtype;
  v_email text;
  v_existing uuid;
begin
  if v_uid is null then
    raise exception 'enlace_no_valido';
  end if;

  select * into v_share
  from vigia.folder_shares
  where shr_token = p_token
  for update;

  if not found
     or v_share.shr_status <> 'pending'
     or v_share.shr_invited_usr_id is not null
     or v_share.shr_expires_at is null
     or v_share.shr_expires_at <= now() then
    raise exception 'enlace_no_valido';
  end if;

  if v_share.shr_owner_usr_id = v_uid then
    raise exception 'carpeta_propia';
  end if;

  select lower(email) into v_email from auth.users where id = v_uid;

  -- Si ya habia una fila para esta persona en esta carpeta (una invitacion
  -- por email, o un acceso revocado antes), se reutiliza esa y se descarta
  -- la del enlace: unique (shr_fld_id, shr_invited_email) no admite dos.
  select shr_id into v_existing
  from vigia.folder_shares
  where shr_fld_id = v_share.shr_fld_id
    and shr_invited_email = v_email
    and shr_id <> v_share.shr_id;

  if found then
    update vigia.folder_shares
    set shr_status = 'accepted', shr_invited_usr_id = v_uid, shr_responded_at = now()
    where shr_id = v_existing;

    delete from vigia.folder_shares where shr_id = v_share.shr_id;
  else
    update vigia.folder_shares
    set shr_status = 'accepted',
        shr_invited_usr_id = v_uid,
        shr_invited_email = v_email,
        shr_token = null,
        shr_responded_at = now()
    where shr_id = v_share.shr_id;
  end if;

  return json_build_object('fld_id', v_share.shr_fld_id, 'fld_name', v_share.shr_fld_name);
end;
$$;

revoke execute on function vigia.accept_folder_share_link(text) from anon, public;
grant execute on function vigia.accept_folder_share_link(text) to authenticated;
