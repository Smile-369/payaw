-- Revision safety is a server policy, not a client-controlled flag. Older
-- Player builds sent character.sheet.update with offline_safe=false, causing
-- valid profile imports to fail with STALE_REVISION after any party update.
create or replace function private.command_is_offline_safe(p_kind text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_kind in (
    'journal.create',
    'journal.share',
    'character.update',
    'character.sheet.update',
    'objective.propose'
  );
$$;

revoke all on function private.command_is_offline_safe(text) from public, anon, authenticated;

create or replace function public.submit_campaign_command(
  p_campaign_id uuid,
  p_idempotency_key uuid,
  p_kind text,
  p_payload jsonb,
  p_expected_revision bigint,
  p_offline_safe boolean default false
)
returns public.campaign_commands
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_member public.campaign_members%rowtype;
  v_slot public.campaign_player_slots%rowtype;
  v_existing public.campaign_commands%rowtype;
  v_result public.campaign_commands%rowtype;
  v_cap text;
  v_rate integer;
  v_offline_safe boolean := private.command_is_offline_safe(p_kind);
begin
  select * into v_member
  from public.campaign_members
  where campaign_id = p_campaign_id
    and user_id = v_user
    and revoked_at is null;

  if not found or v_member.role <> 'player' then
    raise exception using errcode = '42501', message = 'PLAYER_MEMBERSHIP_REQUIRED';
  end if;

  select * into v_existing
  from public.campaign_commands
  where campaign_id = p_campaign_id
    and user_id = v_user
    and idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  select * into v_slot
  from public.campaign_player_slots
  where campaign_id = p_campaign_id
    and assigned_user_id = v_user;
  if not found then
    raise exception using errcode = '42501', message = 'PLAYER_SLOT_REQUIRED';
  end if;

  v_cap := case
    when p_kind = 'message.send' and p_payload->>'privateToGm' = 'true'
      then 'message.send.private'
    else private.required_capability(p_kind)
  end;
  if v_cap is null or not coalesce((v_slot.projection->'capabilities') ? v_cap, false) then
    raise exception using errcode = '42501', message = 'CAPABILITY_DENIED';
  end if;

  if p_expected_revision <> v_slot.revision and not v_offline_safe then
    raise exception using errcode = '40001', message = 'STALE_REVISION';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_PAYLOAD';
  end if;
  if octet_length(p_payload::text) > 32768 then
    raise exception using errcode = '22023', message = 'PAYLOAD_TOO_LARGE';
  end if;

  select count(*) into v_rate
  from public.campaign_commands
  where campaign_id = p_campaign_id
    and user_id = v_user
    and created_at > now() - interval '1 minute';
  if v_rate >= 30 then
    raise exception using errcode = '54000', message = 'RATE_LIMITED';
  end if;

  insert into public.campaign_commands(
    campaign_id,
    user_id,
    source_player_id,
    idempotency_key,
    kind,
    payload,
    expected_revision,
    offline_safe
  ) values (
    p_campaign_id,
    v_user,
    v_member.source_player_id,
    p_idempotency_key,
    p_kind,
    p_payload,
    greatest(0, p_expected_revision),
    v_offline_safe
  )
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.submit_campaign_command(uuid, uuid, text, jsonb, bigint, boolean)
  from public, anon;
grant execute on function public.submit_campaign_command(uuid, uuid, text, jsonb, bigint, boolean)
  to authenticated;
