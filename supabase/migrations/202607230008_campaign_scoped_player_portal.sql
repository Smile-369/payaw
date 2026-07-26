-- PAYAW player portal v2: players enter Campaign ID + username + password.
-- Credentials are resolved only inside the requested campaign room.

revoke all on function public.resolve_player_portal_login(text, text) from public, anon, authenticated;
revoke all on function public.claim_player_portal(text, text) from public, anon, authenticated;
drop function if exists public.resolve_player_portal_login(text, text);
drop function if exists public.claim_player_portal(text, text);

create or replace function public.resolve_player_portal_login(
  p_campaign_id uuid,
  p_login_id text,
  p_password text
) returns table(
  auth_email text,
  campaign_id uuid,
  source_player_id text,
  display_name text
)
language plpgsql
security definer
set search_path = '' as $$
declare
  v_credential private.player_portal_credentials%rowtype;
  v_display_name text;
begin
  select c.*
  into v_credential
  from private.player_portal_credentials c
  where c.campaign_id = p_campaign_id
    and c.login_id = upper(trim(p_login_id))
    and c.enabled
    and c.password_hash = extensions.crypt(p_password, c.password_hash);

  if not found then
    raise exception using errcode = '28000', message = 'PLAYER_LOGIN_INVALID';
  end if;

  select s.display_name
  into v_display_name
  from public.campaign_player_slots s
  where s.campaign_id = v_credential.campaign_id
    and s.source_player_id = v_credential.source_player_id;

  if not found then
    raise exception using errcode = '22023', message = 'PLAYER_SLOT_NOT_FOUND';
  end if;

  return query select
    'player.' || v_credential.auth_alias || '@payaw.invalid',
    v_credential.campaign_id,
    v_credential.source_player_id,
    v_display_name;
end;
$$;

create or replace function public.claim_player_portal(
  p_campaign_id uuid,
  p_login_id text,
  p_password text
) returns table(
  campaign_id uuid,
  source_player_id text,
  role public.campaign_role
)
language plpgsql
security definer
set search_path = '' as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_credential private.player_portal_credentials%rowtype;
  v_slot public.campaign_player_slots%rowtype;
  v_expected_email text;
  v_actual_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if v_user is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  select c.*
  into v_credential
  from private.player_portal_credentials c
  where c.campaign_id = p_campaign_id
    and c.login_id = upper(trim(p_login_id))
    and c.enabled
    and c.password_hash = extensions.crypt(p_password, c.password_hash)
  for update;

  if not found then
    raise exception using errcode = '28000', message = 'PLAYER_LOGIN_INVALID';
  end if;

  v_expected_email := 'player.' || v_credential.auth_alias || '@payaw.invalid';
  if v_actual_email <> lower(v_expected_email) then
    raise exception using errcode = '42501', message = 'PLAYER_PORTAL_ACCOUNT_MISMATCH';
  end if;

  select s.*
  into v_slot
  from public.campaign_player_slots s
  where s.campaign_id = v_credential.campaign_id
    and s.source_player_id = v_credential.source_player_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'PLAYER_SLOT_NOT_FOUND';
  end if;

  if v_slot.assigned_user_id is not null and v_slot.assigned_user_id <> v_user then
    raise exception using errcode = '23505', message = 'PLAYER_SLOT_ALREADY_ACTIVE';
  end if;

  delete from public.campaign_members m
  where m.campaign_id = v_credential.campaign_id
    and m.source_player_id = v_credential.source_player_id
    and m.user_id <> v_user
    and m.role <> 'owner-gm';

  insert into public.campaign_members(
    campaign_id, user_id, role, source_player_id, display_name,
    assigned_character_id, revoked_at, last_seen_at
  ) values (
    v_credential.campaign_id,
    v_user,
    'player',
    v_credential.source_player_id,
    v_slot.display_name,
    v_slot.assigned_character_id,
    null,
    now()
  )
  on conflict on constraint campaign_members_pkey do update set
    role = 'player',
    source_player_id = excluded.source_player_id,
    display_name = excluded.display_name,
    assigned_character_id = excluded.assigned_character_id,
    revoked_at = null,
    last_seen_at = now();

  update public.campaign_player_slots s
  set assigned_user_id = v_user
  where s.campaign_id = v_credential.campaign_id
    and s.source_player_id = v_credential.source_player_id;

  insert into public.campaign_audit_log(
    campaign_id, actor_user_id, action, target_kind, target_id
  ) values (
    v_credential.campaign_id, v_user, 'player-portal.login', 'player-slot', v_credential.source_player_id
  );

  return query select v_credential.campaign_id, v_credential.source_player_id, 'player'::public.campaign_role;
end;
$$;

revoke all on function public.resolve_player_portal_login(uuid, text, text) from public;
revoke all on function public.claim_player_portal(uuid, text, text) from public, anon;
grant execute on function public.resolve_player_portal_login(uuid, text, text) to anon, authenticated;
grant execute on function public.claim_player_portal(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
