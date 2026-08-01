-- PAYAW hosted campaigns: server-authoritative rooms, safe projections, commands, and assets.
-- Every browser request is subject to RLS. Never place the service-role key in Vite.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$ begin
  create type public.campaign_role as enum ('owner-gm', 'co-gm', 'player', 'observer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.command_status as enum ('queued', 'processing', 'applied', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.campaign_rooms (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  source_campaign_id text not null,
  name text not null check (char_length(name) between 1 and 160),
  status text not null default 'setup' check (status in ('setup', 'active', 'paused', 'archived')),
  projection_revision bigint not null default 0 check (projection_revision >= 0),
  schema_version integer not null default 23 check (schema_version = 23),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, source_campaign_id)
);

create table if not exists public.campaign_members (
  campaign_id uuid not null references public.campaign_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.campaign_role not null,
  source_player_id text,
  display_name text not null check (char_length(display_name) between 1 and 80),
  assigned_character_id text,
  revoked_at timestamptz,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz,
  primary key (campaign_id, user_id),
  unique nulls not distinct (campaign_id, source_player_id)
);

create table if not exists public.campaign_authority (
  campaign_id uuid primary key references public.campaign_rooms(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  schema_version integer not null default 23,
  campaign_document jsonb not null default '{}'::jsonb,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  check (octet_length(campaign_document::text) <= 10485760)
);

create table if not exists public.campaign_player_slots (
  campaign_id uuid not null references public.campaign_rooms(id) on delete cascade,
  source_player_id text not null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  assigned_character_id text not null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  projection_version integer not null default 1,
  revision bigint not null default 0 check (revision >= 0),
  projection jsonb not null default '{}'::jsonb,
  generated_by uuid not null references auth.users(id),
  generated_at timestamptz not null default now(),
  primary key (campaign_id, source_player_id),
  check (octet_length(projection::text) <= 5242880)
);

-- Multiple unclaimed slots in the same campaign must be allowed. Only enforce
-- uniqueness after a slot has been claimed by a real Supabase Auth user.
create unique index if not exists campaign_player_slots_campaign_assigned_user_unique
on public.campaign_player_slots (campaign_id, assigned_user_id)
where assigned_user_id is not null;

create table if not exists public.campaign_invitations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaign_rooms(id) on delete cascade,
  token_hash text not null unique,
  role public.campaign_role not null check (role in ('co-gm', 'player', 'observer')),
  source_player_id text,
  assigned_character_id text,
  max_uses integer not null default 1 check (max_uses between 1 and 12),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_commands (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaign_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_player_id text not null,
  idempotency_key uuid not null,
  kind text not null,
  payload jsonb not null,
  expected_revision bigint not null check (expected_revision >= 0),
  offline_safe boolean not null default false,
  status public.command_status not null default 'queued',
  result jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (campaign_id, user_id, idempotency_key),
  check (octet_length(payload::text) <= 32768),
  check (kind in ('journal.create', 'journal.share', 'character.update', 'message.send', 'dice.roll', 'map.ping', 'objective.propose'))
);

create table if not exists public.campaign_events (
  sequence bigint generated always as identity primary key,
  id uuid not null default gen_random_uuid() unique,
  campaign_id uuid not null references public.campaign_rooms(id) on delete cascade,
  audience text not null check (audience in ('gm', 'party', 'player')),
  audience_user_id uuid references auth.users(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 80),
  revision bigint not null check (revision >= 0),
  safe_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  check ((audience = 'player' and audience_user_id is not null) or (audience <> 'player' and audience_user_id is null)),
  check (octet_length(safe_payload::text) <= 65536)
);

create table if not exists public.campaign_client_acks (
  campaign_id uuid not null references public.campaign_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_projection_revision bigint not null default 0,
  last_event_sequence bigint not null default 0,
  client_schema_version integer not null default 23,
  updated_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create table if not exists public.campaign_audit_log (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaign_rooms(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_kind text,
  target_id text,
  result text not null default 'ok',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (octet_length(metadata::text) <= 32768)
);

create index if not exists campaign_members_user_idx on public.campaign_members (user_id, campaign_id) where revoked_at is null;
create index if not exists campaign_slots_user_idx on public.campaign_player_slots (assigned_user_id, campaign_id);
create index if not exists campaign_invites_campaign_idx on public.campaign_invitations (campaign_id, expires_at) where revoked_at is null;
create index if not exists campaign_commands_queue_idx on public.campaign_commands (campaign_id, status, created_at);
create index if not exists campaign_events_resume_idx on public.campaign_events (campaign_id, sequence);
create index if not exists campaign_events_audience_idx on public.campaign_events (campaign_id, audience, audience_user_id, sequence);

create or replace function private.is_campaign_member(p_campaign_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.campaign_members m
    where m.campaign_id = p_campaign_id and m.user_id = p_user_id and m.revoked_at is null
  );
$$;

create or replace function private.has_campaign_role(p_campaign_id uuid, p_roles public.campaign_role[], p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.campaign_members m
    where m.campaign_id = p_campaign_id and m.user_id = p_user_id
      and m.revoked_at is null and m.role = any(p_roles)
  );
$$;

create or replace function private.required_capability(p_kind text)
returns text language sql immutable set search_path = '' as $$
  select case p_kind
    when 'journal.create' then 'journal.write.private'
    when 'journal.share' then 'journal.share.party'
    when 'character.update' then 'character.edit.self'
    when 'message.send' then 'message.send.party'
    when 'dice.roll' then 'dice.roll'
    when 'map.ping' then 'map.ping'
    when 'objective.propose' then 'objective.propose'
    else null end;
$$;

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists campaign_rooms_touch on public.campaign_rooms;
create trigger campaign_rooms_touch before update on public.campaign_rooms
for each row execute function private.touch_updated_at();

alter table public.campaign_rooms enable row level security;
alter table public.campaign_members enable row level security;
alter table public.campaign_authority enable row level security;
alter table public.campaign_player_slots enable row level security;
alter table public.campaign_invitations enable row level security;
alter table public.campaign_commands enable row level security;
alter table public.campaign_events enable row level security;
alter table public.campaign_client_acks enable row level security;
alter table public.campaign_audit_log enable row level security;

create policy "members read campaign rooms" on public.campaign_rooms for select to authenticated
using ((select private.is_campaign_member(id)));
create policy "gm updates campaign room" on public.campaign_rooms for update to authenticated
using ((select private.has_campaign_role(id, array['owner-gm','co-gm']::public.campaign_role[])))
with check ((select private.has_campaign_role(id, array['owner-gm','co-gm']::public.campaign_role[])));

create policy "member reads own or gm roster" on public.campaign_members for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_campaign_role(campaign_id, array['owner-gm','co-gm']::public.campaign_role[])));

create policy "gm reads authority" on public.campaign_authority for select to authenticated
using ((select private.has_campaign_role(campaign_id, array['owner-gm','co-gm']::public.campaign_role[])));
create policy "gm writes authority" on public.campaign_authority for all to authenticated
using ((select private.has_campaign_role(campaign_id, array['owner-gm','co-gm']::public.campaign_role[])))
with check ((select private.has_campaign_role(campaign_id, array['owner-gm','co-gm']::public.campaign_role[])));

create policy "recipient or gm reads player slot" on public.campaign_player_slots for select to authenticated
using (assigned_user_id = (select auth.uid()) or (select private.has_campaign_role(campaign_id, array['owner-gm','co-gm']::public.campaign_role[])));

create policy "gm reads invitations" on public.campaign_invitations for select to authenticated
using ((select private.has_campaign_role(campaign_id, array['owner-gm','co-gm']::public.campaign_role[])));

create policy "player reads own commands or gm reads room" on public.campaign_commands for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_campaign_role(campaign_id, array['owner-gm','co-gm']::public.campaign_role[])));

create policy "authorized audiences read events" on public.campaign_events for select to authenticated
using (
  (audience = 'gm' and (select private.has_campaign_role(campaign_id, array['owner-gm','co-gm']::public.campaign_role[])))
  or (audience = 'party' and (select private.is_campaign_member(campaign_id)))
  or (audience = 'player' and audience_user_id = (select auth.uid()))
);

create policy "user reads own ack" on public.campaign_client_acks for select to authenticated
using (user_id = (select auth.uid()));
create policy "user inserts own ack" on public.campaign_client_acks for insert to authenticated
with check (user_id = (select auth.uid()) and (select private.is_campaign_member(campaign_id)));
create policy "user updates own ack" on public.campaign_client_acks for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "gm reads audit log" on public.campaign_audit_log for select to authenticated
using ((select private.has_campaign_role(campaign_id, array['owner-gm','co-gm']::public.campaign_role[])));

create or replace function public.create_campaign_room(p_name text, p_source_campaign_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_room uuid;
begin
  if v_user is null then raise exception using errcode = '28000', message = 'AUTH_REQUIRED'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception using errcode = '42501', message = 'PERMANENT_GM_ACCOUNT_REQUIRED';
  end if;
  insert into public.campaign_rooms(owner_user_id, source_campaign_id, name)
  values (v_user, left(coalesce(nullif(trim(p_source_campaign_id), ''), gen_random_uuid()::text), 160), left(trim(p_name), 160))
  on conflict (owner_user_id, source_campaign_id) do update set name = excluded.name
  returning id into v_room;
  insert into public.campaign_members(campaign_id, user_id, role, display_name)
  values (v_room, v_user, 'owner-gm', coalesce(nullif(auth.jwt()->>'email',''), 'Game Master'))
  on conflict (campaign_id, user_id) do update set role='owner-gm', revoked_at=null;
  insert into public.campaign_authority(campaign_id, updated_by) values (v_room, v_user)
  on conflict (campaign_id) do nothing;
  insert into public.campaign_audit_log(campaign_id, actor_user_id, action, target_kind, target_id)
  values (v_room, v_user, 'room.create', 'campaign', v_room::text);
  return v_room;
end; $$;

create or replace function public.publish_player_projection(
  p_campaign_id uuid, p_source_player_id text, p_assigned_character_id text,
  p_display_name text, p_projection_version integer, p_revision bigint, p_projection jsonb
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_next bigint; v_assigned uuid;
begin
  if not private.has_campaign_role(p_campaign_id, array['owner-gm','co-gm']::public.campaign_role[], v_user) then
    raise exception using errcode='42501', message='NOT_GM';
  end if;
  if p_projection_version <> 1 or octet_length(p_projection::text) > 5242880 then
    raise exception using errcode='22023', message='INVALID_PROJECTION';
  end if;
  select assigned_user_id into v_assigned from public.campaign_player_slots
    where campaign_id=p_campaign_id and source_player_id=p_source_player_id;
  update public.campaign_rooms set projection_revision = greatest(projection_revision + 1, p_revision)
    where id=p_campaign_id returning projection_revision into v_next;
  insert into public.campaign_player_slots(
    campaign_id, source_player_id, assigned_user_id, assigned_character_id,
    display_name, projection_version, revision, projection, generated_by
  ) values (
    p_campaign_id, left(p_source_player_id,160), v_assigned, left(p_assigned_character_id,160),
    left(p_display_name,80), p_projection_version, v_next,
    jsonb_set(jsonb_set(p_projection, '{revision}', to_jsonb(v_next), true), '{generatedAt}', to_jsonb(now()::text), true), v_user
  ) on conflict (campaign_id, source_player_id) do update set
    assigned_character_id=excluded.assigned_character_id, display_name=excluded.display_name,
    projection_version=excluded.projection_version, revision=excluded.revision,
    projection=excluded.projection, generated_by=excluded.generated_by, generated_at=now();
  insert into public.campaign_events(campaign_id, audience, audience_user_id, event_type, revision, safe_payload)
  values (p_campaign_id, case when v_assigned is null then 'gm' else 'player' end, v_assigned,
    'projection.replaced', v_next, jsonb_build_object('sourcePlayerId', p_source_player_id));
  return v_next;
end; $$;

create or replace function public.create_campaign_invitation(
  p_campaign_id uuid, p_role public.campaign_role, p_source_player_id text default null,
  p_assigned_character_id text default null, p_expires_hours integer default 168
) returns text language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_token text; v_hash text;
begin
  if not private.has_campaign_role(p_campaign_id, array['owner-gm','co-gm']::public.campaign_role[], v_user) then
    raise exception using errcode='42501', message='NOT_GM';
  end if;
  if p_role not in ('co-gm','player','observer') then raise exception using errcode='22023', message='INVALID_ROLE'; end if;
  if p_role in ('player','observer') and p_source_player_id is null then raise exception using errcode='22023', message='PLAYER_SLOT_REQUIRED'; end if;
  if p_source_player_id is not null and not exists (
    select 1 from public.campaign_player_slots where campaign_id=p_campaign_id and source_player_id=p_source_player_id
  ) then raise exception using errcode='22023', message='UNKNOWN_PLAYER_SLOT'; end if;
  v_token := upper(encode(extensions.gen_random_bytes(8), 'hex'));
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  insert into public.campaign_invitations(campaign_id, token_hash, role, source_player_id, assigned_character_id, expires_at, created_by)
  values (p_campaign_id, v_hash, p_role, p_source_player_id, p_assigned_character_id, now() + make_interval(hours => greatest(1, least(720, p_expires_hours))), v_user);
  insert into public.campaign_audit_log(campaign_id, actor_user_id, action, target_kind, target_id, metadata)
  values (p_campaign_id, v_user, 'invite.create', 'player-slot', p_source_player_id, jsonb_build_object('role',p_role));
  return v_token;
end; $$;

create or replace function public.claim_campaign_invitation(p_token text, p_display_name text)
returns table(campaign_id uuid, source_player_id text, role public.campaign_role)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare v_user uuid := auth.uid(); v_invite public.campaign_invitations%rowtype;
begin
  if v_user is null then raise exception using errcode='28000', message='AUTH_REQUIRED'; end if;
  select * into v_invite from public.campaign_invitations i
  where i.token_hash=encode(extensions.digest(upper(trim(p_token)), 'sha256'),'hex')
    and i.revoked_at is null and i.expires_at > now() and i.use_count < i.max_uses
  for update;
  if not found then raise exception using errcode='22023', message='INVITE_INVALID_OR_EXPIRED'; end if;
  if v_invite.source_player_id is not null and exists (
    select 1 from public.campaign_player_slots s
    where s.campaign_id=v_invite.campaign_id and s.assigned_user_id=v_user
      and s.source_player_id<>v_invite.source_player_id
  ) then raise exception using errcode='23505', message='PLAYER_DEVICE_ALREADY_ASSIGNED'; end if;
  insert into public.campaign_members(campaign_id,user_id,role,source_player_id,display_name,assigned_character_id)
  values (v_invite.campaign_id,v_user,v_invite.role,v_invite.source_player_id,left(coalesce(nullif(trim(p_display_name),''),'Player'),80),v_invite.assigned_character_id)
  on conflict on constraint campaign_members_pkey do update set role=excluded.role, source_player_id=excluded.source_player_id,
    display_name=excluded.display_name, assigned_character_id=excluded.assigned_character_id, revoked_at=null;
  if v_invite.source_player_id is not null then
    update public.campaign_player_slots set assigned_user_id=v_user
      where campaign_player_slots.campaign_id=v_invite.campaign_id and campaign_player_slots.source_player_id=v_invite.source_player_id
        and (campaign_player_slots.assigned_user_id is null or campaign_player_slots.assigned_user_id=v_user);
    if not found then raise exception using errcode='23505', message='PLAYER_SLOT_ALREADY_CLAIMED'; end if;
  end if;
  update public.campaign_invitations
    set use_count=public.campaign_invitations.use_count+1
    where public.campaign_invitations.id=v_invite.id;
  insert into public.campaign_audit_log(campaign_id,actor_user_id,action,target_kind,target_id)
  values(v_invite.campaign_id,v_user,'invite.claim','member',v_user::text);
  return query select v_invite.campaign_id,v_invite.source_player_id,v_invite.role;
end; $$;

create or replace function public.submit_campaign_command(
  p_campaign_id uuid, p_idempotency_key uuid, p_kind text, p_payload jsonb,
  p_expected_revision bigint, p_offline_safe boolean default false
) returns public.campaign_commands language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_member public.campaign_members%rowtype; v_slot public.campaign_player_slots%rowtype;
  v_existing public.campaign_commands%rowtype; v_result public.campaign_commands%rowtype; v_cap text; v_rate integer;
begin
  select * into v_member from public.campaign_members where campaign_id=p_campaign_id and user_id=v_user and revoked_at is null;
  if not found or v_member.role <> 'player' then raise exception using errcode='42501', message='PLAYER_MEMBERSHIP_REQUIRED'; end if;
  select * into v_existing from public.campaign_commands where campaign_id=p_campaign_id and user_id=v_user and idempotency_key=p_idempotency_key;
  if found then return v_existing; end if;
  select * into v_slot from public.campaign_player_slots where campaign_id=p_campaign_id and assigned_user_id=v_user;
  if not found then raise exception using errcode='42501', message='PLAYER_SLOT_REQUIRED'; end if;
  v_cap := private.required_capability(p_kind);
  if v_cap is null or not coalesce((v_slot.projection->'capabilities') ? v_cap,false) then
    raise exception using errcode='42501', message='CAPABILITY_DENIED';
  end if;
  if p_expected_revision <> v_slot.revision and not p_offline_safe then raise exception using errcode='40001', message='STALE_REVISION'; end if;
  if octet_length(p_payload::text) > 32768 then raise exception using errcode='22023', message='PAYLOAD_TOO_LARGE'; end if;
  select count(*) into v_rate from public.campaign_commands where campaign_id=p_campaign_id and user_id=v_user and created_at > now()-interval '1 minute';
  if v_rate >= 30 then raise exception using errcode='54000', message='RATE_LIMITED'; end if;
  insert into public.campaign_commands(campaign_id,user_id,source_player_id,idempotency_key,kind,payload,expected_revision,offline_safe)
  values(p_campaign_id,v_user,v_member.source_player_id,p_idempotency_key,p_kind,p_payload,greatest(0,p_expected_revision),p_offline_safe)
  returning * into v_result;
  return v_result;
end; $$;

create or replace function public.ack_campaign_state(p_campaign_id uuid, p_revision bigint, p_event_sequence bigint)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.campaign_client_acks(campaign_id,user_id,last_projection_revision,last_event_sequence)
  values(p_campaign_id,auth.uid(),greatest(0,p_revision),greatest(0,p_event_sequence))
  on conflict(campaign_id,user_id) do update set last_projection_revision=greatest(campaign_client_acks.last_projection_revision,excluded.last_projection_revision),
    last_event_sequence=greatest(campaign_client_acks.last_event_sequence,excluded.last_event_sequence), updated_at=now();
end; $$;

create or replace function public.revoke_campaign_member(p_campaign_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if not private.has_campaign_role(p_campaign_id,array['owner-gm']::public.campaign_role[],v_actor) then raise exception using errcode='42501',message='OWNER_GM_REQUIRED'; end if;
  if p_user_id=v_actor then raise exception using errcode='22023',message='OWNER_CANNOT_REVOKE_SELF'; end if;
  update public.campaign_members set revoked_at=now() where campaign_id=p_campaign_id and user_id=p_user_id and role<>'owner-gm';
  update public.campaign_player_slots set assigned_user_id=null where campaign_id=p_campaign_id and assigned_user_id=p_user_id;
  insert into public.campaign_audit_log(campaign_id,actor_user_id,action,target_kind,target_id)
  values(p_campaign_id,v_actor,'member.revoke','member',p_user_id::text);
end; $$;

grant usage on schema public to authenticated;
grant select, update on public.campaign_rooms to authenticated;
grant select on public.campaign_members, public.campaign_player_slots,
  public.campaign_invitations, public.campaign_commands, public.campaign_events, public.campaign_audit_log to authenticated;
grant select, insert, update on public.campaign_authority to authenticated;
grant select, insert, update on public.campaign_client_acks to authenticated;
grant execute on function public.create_campaign_room(text,text) to authenticated;
grant execute on function public.publish_player_projection(uuid,text,text,text,integer,bigint,jsonb) to authenticated;
grant execute on function public.create_campaign_invitation(uuid,public.campaign_role,text,text,integer) to authenticated;
grant execute on function public.claim_campaign_invitation(text,text) to authenticated;
grant execute on function public.submit_campaign_command(uuid,uuid,text,jsonb,bigint,boolean) to authenticated;
grant execute on function public.ack_campaign_state(uuid,bigint,bigint) to authenticated;
grant execute on function public.revoke_campaign_member(uuid,uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
  ('payaw-player-assets','payaw-player-assets',false,26214400,array['image/png','image/jpeg','image/webp','image/gif','audio/mpeg','audio/ogg','application/pdf','text/plain']),
  ('payaw-gm-assets','payaw-gm-assets',false,26214400,array['image/png','image/jpeg','image/webp','image/gif','audio/mpeg','audio/ogg','application/pdf','text/plain'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "members read player assets" on storage.objects for select to authenticated using (
  bucket_id='payaw-player-assets' and private.is_campaign_member(((storage.foldername(name))[1])::uuid)
);
create policy "gm manages player assets" on storage.objects for all to authenticated using (
  bucket_id='payaw-player-assets' and private.has_campaign_role(((storage.foldername(name))[1])::uuid,array['owner-gm','co-gm']::public.campaign_role[])
) with check (
  bucket_id='payaw-player-assets' and private.has_campaign_role(((storage.foldername(name))[1])::uuid,array['owner-gm','co-gm']::public.campaign_role[])
);
create policy "gm reads private assets" on storage.objects for select to authenticated using (
  bucket_id='payaw-gm-assets' and private.has_campaign_role(((storage.foldername(name))[1])::uuid,array['owner-gm','co-gm']::public.campaign_role[])
);
create policy "gm manages private assets" on storage.objects for all to authenticated using (
  bucket_id='payaw-gm-assets' and private.has_campaign_role(((storage.foldername(name))[1])::uuid,array['owner-gm','co-gm']::public.campaign_role[])
) with check (
  bucket_id='payaw-gm-assets' and private.has_campaign_role(((storage.foldername(name))[1])::uuid,array['owner-gm','co-gm']::public.campaign_role[])
);

-- Private Presence/Broadcast topics use room:<campaign-uuid>:live.
-- Realtime evaluates these policies when a client joins the channel.
create policy "campaign members receive private room realtime" on realtime.messages for select to authenticated using (
  realtime.messages.extension in ('presence','broadcast')
  and split_part((select realtime.topic()), ':', 1) = 'room'
  and private.is_campaign_member(split_part((select realtime.topic()), ':', 2)::uuid)
);
create policy "campaign members send private room realtime" on realtime.messages for insert to authenticated with check (
  realtime.messages.extension in ('presence','broadcast')
  and split_part((select realtime.topic()), ':', 1) = 'room'
  and private.is_campaign_member(split_part((select realtime.topic()), ':', 2)::uuid)
);

do $$ begin
  alter publication supabase_realtime add table public.campaign_player_slots;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.campaign_commands;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.campaign_events;
exception when duplicate_object then null; end $$;
