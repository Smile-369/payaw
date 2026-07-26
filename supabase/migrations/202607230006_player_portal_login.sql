-- PAYAW player portal: replace single-use invitation links with persistent
-- per-slot login credentials. Credentials remain valid until the GM resets or
-- disables them. Password hashes and auth aliases stay in the private schema.

create table if not exists private.player_portal_credentials (
  campaign_id uuid not null,
  source_player_id text not null,
  login_id text not null,
  auth_alias text not null,
  password_hash text not null,
  enabled boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, source_player_id),
  unique (login_id),
  unique (auth_alias),
  foreign key (campaign_id, source_player_id)
    references public.campaign_player_slots(campaign_id, source_player_id)
    on delete cascade,
  check (login_id ~ '^[A-Z0-9]{12}$'),
  check (auth_alias ~ '^[a-f0-9]{24}$')
);

revoke all on private.player_portal_credentials from public, anon, authenticated;

-- Existing one-time invitations must stop working as soon as this migration is
-- applied. The historical table is retained only so older migrations and audit
-- records remain valid.
update public.campaign_invitations
set revoked_at = coalesce(revoked_at, now())
where revoked_at is null;

create or replace function public.configure_player_portal(
  p_campaign_id uuid,
  p_source_player_id text
) returns table(login_id text, portal_password text)
language plpgsql
security definer
set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_login text;
  v_password text;
  v_alias text;
  v_previous_user uuid;
begin
  if v_actor is null or not private.has_campaign_role(
    p_campaign_id,
    array['owner-gm','co-gm']::public.campaign_role[],
    v_actor
  ) then
    raise exception using errcode = '42501', message = 'GM_ROLE_REQUIRED';
  end if;

  select s.assigned_user_id
  into v_previous_user
  from public.campaign_player_slots s
  where s.campaign_id = p_campaign_id
    and s.source_player_id = p_source_player_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'UNKNOWN_PLAYER_SLOT';
  end if;

  loop
    v_login := upper(encode(extensions.gen_random_bytes(6), 'hex'));
    exit when not exists (
      select 1 from private.player_portal_credentials c where c.login_id = v_login
    );
  end loop;

  loop
    v_alias := encode(extensions.gen_random_bytes(12), 'hex');
    exit when not exists (
      select 1 from private.player_portal_credentials c where c.auth_alias = v_alias
    );
  end loop;

  v_password := upper(encode(extensions.gen_random_bytes(8), 'hex'));

  if v_previous_user is not null then
    delete from public.campaign_members m
    where m.campaign_id = p_campaign_id
      and m.user_id = v_previous_user
      and m.role <> 'owner-gm';
  end if;

  update public.campaign_player_slots s
  set assigned_user_id = null
  where s.campaign_id = p_campaign_id
    and s.source_player_id = p_source_player_id;

  insert into private.player_portal_credentials(
    campaign_id, source_player_id, login_id, auth_alias, password_hash,
    enabled, created_by, created_at, updated_at
  ) values (
    p_campaign_id,
    left(trim(p_source_player_id), 160),
    v_login,
    v_alias,
    extensions.crypt(v_password, extensions.gen_salt('bf', 10)),
    true,
    v_actor,
    now(),
    now()
  )
  on conflict (campaign_id, source_player_id) do update set
    login_id = excluded.login_id,
    auth_alias = excluded.auth_alias,
    password_hash = excluded.password_hash,
    enabled = true,
    created_by = excluded.created_by,
    updated_at = now();

  update public.campaign_invitations i
  set revoked_at = coalesce(i.revoked_at, now())
  where i.campaign_id = p_campaign_id
    and i.source_player_id = p_source_player_id
    and i.revoked_at is null;

  insert into public.campaign_audit_log(
    campaign_id, actor_user_id, action, target_kind, target_id
  ) values (
    p_campaign_id, v_actor, 'player-portal.configure', 'player-slot', p_source_player_id
  );

  return query select v_login, v_password;
end;
$$;

create or replace function public.list_player_portal_logins(p_campaign_id uuid)
returns table(
  source_player_id text,
  login_id text,
  enabled boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.has_campaign_role(
    p_campaign_id,
    array['owner-gm','co-gm']::public.campaign_role[],
    v_actor
  ) then
    raise exception using errcode = '42501', message = 'GM_ROLE_REQUIRED';
  end if;

  return query
  select c.source_player_id, c.login_id, c.enabled, c.updated_at
  from private.player_portal_credentials c
  where c.campaign_id = p_campaign_id
  order by c.source_player_id;
end;
$$;

create or replace function public.resolve_player_portal_login(
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
  where c.login_id = upper(trim(p_login_id))
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
  where c.login_id = upper(trim(p_login_id))
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

create or replace function public.disable_player_portal(
  p_campaign_id uuid,
  p_source_player_id text
) returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_user uuid;
begin
  if v_actor is null or not private.has_campaign_role(
    p_campaign_id,
    array['owner-gm','co-gm']::public.campaign_role[],
    v_actor
  ) then
    raise exception using errcode = '42501', message = 'GM_ROLE_REQUIRED';
  end if;

  select s.assigned_user_id
  into v_user
  from public.campaign_player_slots s
  where s.campaign_id = p_campaign_id
    and s.source_player_id = p_source_player_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'UNKNOWN_PLAYER_SLOT';
  end if;

  update private.player_portal_credentials c
  set enabled = false, updated_at = now()
  where c.campaign_id = p_campaign_id
    and c.source_player_id = p_source_player_id;

  if v_user is not null then
    delete from public.campaign_members m
    where m.campaign_id = p_campaign_id
      and m.user_id = v_user
      and m.role <> 'owner-gm';
  end if;

  update public.campaign_player_slots s
  set assigned_user_id = null
  where s.campaign_id = p_campaign_id
    and s.source_player_id = p_source_player_id;

  insert into public.campaign_audit_log(
    campaign_id, actor_user_id, action, target_kind, target_id
  ) values (
    p_campaign_id, v_actor, 'player-portal.disable', 'player-slot', p_source_player_id
  );
end;
$$;

-- Delete any legacy baked-map fields from hosted projections. New clients never
-- render the lightweight raster fallback and will regenerate from worldRecipe.
update public.campaign_player_slots
set projection = projection #- '{baseImageDataUrl}' #- '{map,baseImageDataUrl}'
where projection ? 'baseImageDataUrl'
   or (projection->'map') ? 'baseImageDataUrl';

revoke all on function public.configure_player_portal(uuid, text) from public, anon;
revoke all on function public.list_player_portal_logins(uuid) from public, anon;
revoke all on function public.resolve_player_portal_login(text, text) from public;
revoke all on function public.claim_player_portal(text, text) from public, anon;
revoke all on function public.disable_player_portal(uuid, text) from public, anon;

grant execute on function public.configure_player_portal(uuid, text) to authenticated;
grant execute on function public.list_player_portal_logins(uuid) to authenticated;
grant execute on function public.resolve_player_portal_login(text, text) to anon, authenticated;
grant execute on function public.claim_player_portal(text, text) to authenticated;
grant execute on function public.disable_player_portal(uuid, text) to authenticated;

-- Remove the old link-claim API from the exposed surface.
revoke all on function public.create_campaign_invitation(uuid, public.campaign_role, text, text, integer) from public, anon, authenticated;
revoke all on function public.claim_campaign_invitation(text, text) from public, anon, authenticated;
