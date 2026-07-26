-- PAYAW player portal v3: authenticated players may change their own
-- campaign-scoped username and password after receiving initial credentials.

alter table private.player_portal_credentials
  drop constraint if exists player_portal_credentials_login_id_key;

alter table private.player_portal_credentials
  drop constraint if exists player_portal_credentials_login_id_check;

alter table private.player_portal_credentials
  add constraint player_portal_credentials_login_id_check
  check (login_id ~ '^[A-Z0-9][A-Z0-9_-]{2,23}$');

alter table private.player_portal_credentials
  drop constraint if exists player_portal_credentials_campaign_login_key;

alter table private.player_portal_credentials
  add constraint player_portal_credentials_campaign_login_key
  unique (campaign_id, login_id);

create or replace function public.verify_player_portal_password(
  p_campaign_id uuid,
  p_password text
) returns boolean
language plpgsql
security definer
set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_valid boolean;
begin
  if v_user is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  select exists (
    select 1
    from private.player_portal_credentials c
    join public.campaign_player_slots s
      on s.campaign_id = c.campaign_id
     and s.source_player_id = c.source_player_id
    where c.campaign_id = p_campaign_id
      and c.enabled
      and s.assigned_user_id = v_user
      and c.password_hash = extensions.crypt(p_password, c.password_hash)
  ) into v_valid;

  if not v_valid then
    raise exception using errcode = '28000', message = 'CURRENT_PLAYER_PASSWORD_INVALID';
  end if;

  return true;
end;
$$;

create or replace function public.change_player_portal_credentials(
  p_campaign_id uuid,
  p_current_password text,
  p_new_login_id text,
  p_new_password text default null
) returns table(login_id text)
language plpgsql
security definer
set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_credential private.player_portal_credentials%rowtype;
  v_login text := upper(trim(p_new_login_id));
  v_new_password text := nullif(p_new_password, '');
begin
  if v_user is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  if v_login !~ '^[A-Z0-9][A-Z0-9_-]{2,23}$' then
    raise exception using errcode = '22023', message = 'PLAYER_USERNAME_INVALID';
  end if;

  if v_new_password is not null and (length(v_new_password) < 8 or length(v_new_password) > 128) then
    raise exception using errcode = '22023', message = 'PLAYER_PASSWORD_INVALID';
  end if;

  select c.*
  into v_credential
  from private.player_portal_credentials c
  join public.campaign_player_slots s
    on s.campaign_id = c.campaign_id
   and s.source_player_id = c.source_player_id
  where c.campaign_id = p_campaign_id
    and c.enabled
    and s.assigned_user_id = v_user
  for update of c;

  if not found then
    raise exception using errcode = '42501', message = 'PLAYER_PORTAL_ACCESS_REVOKED';
  end if;

  if v_credential.password_hash <> extensions.crypt(p_current_password, v_credential.password_hash) then
    raise exception using errcode = '28000', message = 'CURRENT_PLAYER_PASSWORD_INVALID';
  end if;

  if exists (
    select 1
    from private.player_portal_credentials c
    where c.campaign_id = p_campaign_id
      and c.login_id = v_login
      and c.source_player_id <> v_credential.source_player_id
  ) then
    raise exception using errcode = '23505', message = 'PLAYER_USERNAME_TAKEN';
  end if;

  update private.player_portal_credentials c
  set login_id = v_login,
      password_hash = case
        when v_new_password is null then c.password_hash
        else extensions.crypt(v_new_password, extensions.gen_salt('bf', 10))
      end,
      updated_at = now()
  where c.campaign_id = v_credential.campaign_id
    and c.source_player_id = v_credential.source_player_id;

  insert into public.campaign_audit_log(
    campaign_id, actor_user_id, action, target_kind, target_id
  ) values (
    p_campaign_id,
    v_user,
    'player-portal.credentials-changed',
    'player-slot',
    v_credential.source_player_id
  );

  return query select v_login;
end;
$$;

revoke all on function public.verify_player_portal_password(uuid, text) from public, anon;
revoke all on function public.change_player_portal_credentials(uuid, text, text, text) from public, anon;
grant execute on function public.verify_player_portal_password(uuid, text) to authenticated;
grant execute on function public.change_player_portal_credentials(uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';
