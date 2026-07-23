-- PAYAW 0.23.2: publish the authority document and every player projection atomically.
-- A player command can update a slot between the GM reading and publishing it. The
-- expectedRevision check prevents that player-owned work from being silently lost.

create or replace function public.publish_campaign_snapshot(
  p_campaign_id uuid,
  p_revision bigint,
  p_authority jsonb,
  p_slots jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_next bigint;
  v_slot jsonb;
  v_source_player_id text;
  v_current_revision bigint;
  v_expected_revision bigint;
  v_assigned_user_id uuid;
  v_keep text[] := array[]::text[];
begin
  if v_actor is null or not private.has_campaign_role(
    p_campaign_id,
    array['owner-gm', 'co-gm']::public.campaign_role[],
    v_actor
  ) then
    raise exception using errcode = '42501', message = 'GM_ROLE_REQUIRED';
  end if;

  if octet_length(p_authority::text) > 10485760 then
    raise exception using errcode = '22023', message = 'AUTHORITY_TOO_LARGE';
  end if;
  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) > 32 then
    raise exception using errcode = '22023', message = 'INVALID_PLAYER_SLOTS';
  end if;

  -- Validate every projection and every optimistic concurrency token before
  -- modifying any record. PostgreSQL rolls the whole function back on failure.
  for v_slot in select value from jsonb_array_elements(p_slots)
  loop
    v_source_player_id := nullif(trim(v_slot->>'sourcePlayerId'), '');
    if v_source_player_id is null
      or nullif(trim(v_slot->>'assignedCharacterId'), '') is null
      or nullif(trim(v_slot->>'displayName'), '') is null
      or coalesce((v_slot->>'projectionVersion')::integer, 0) <> 1
      or jsonb_typeof(v_slot->'projection') <> 'object'
      or octet_length((v_slot->'projection')::text) > 5242880
    then
      raise exception using errcode = '22023', message = 'INVALID_PLAYER_PROJECTION';
    end if;

    select revision into v_current_revision
    from public.campaign_player_slots
    where campaign_id = p_campaign_id and source_player_id = v_source_player_id
    for update;

    v_expected_revision := coalesce((v_slot->>'expectedRevision')::bigint, -1);
    if found and v_expected_revision <> v_current_revision then
      raise exception using errcode = '40001', message = 'SNAPSHOT_CONFLICT';
    elsif not found and v_expected_revision <> -1 then
      raise exception using errcode = '40001', message = 'SNAPSHOT_CONFLICT';
    end if;
    v_keep := array_append(v_keep, left(v_source_player_id, 160));
  end loop;

  update public.campaign_rooms
  set projection_revision = greatest(projection_revision + 1, greatest(0, p_revision))
  where id = p_campaign_id
  returning projection_revision into v_next;
  if not found then
    raise exception using errcode = '22023', message = 'CAMPAIGN_ROOM_NOT_FOUND';
  end if;

  insert into public.campaign_authority(
    campaign_id, revision, schema_version, campaign_document, updated_by, updated_at
  )
  values (p_campaign_id, v_next, 23, p_authority, v_actor, now())
  on conflict (campaign_id) do update set
    revision = excluded.revision,
    schema_version = excluded.schema_version,
    campaign_document = excluded.campaign_document,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  for v_slot in select value from jsonb_array_elements(p_slots)
  loop
    v_source_player_id := left(trim(v_slot->>'sourcePlayerId'), 160);
    select assigned_user_id into v_assigned_user_id
    from public.campaign_player_slots
    where campaign_id = p_campaign_id and source_player_id = v_source_player_id;

    insert into public.campaign_player_slots(
      campaign_id, source_player_id, assigned_user_id, assigned_character_id,
      display_name, projection_version, revision, projection, generated_by, generated_at
    )
    values (
      p_campaign_id,
      v_source_player_id,
      v_assigned_user_id,
      left(v_slot->>'assignedCharacterId', 160),
      left(v_slot->>'displayName', 80),
      1,
      v_next,
      jsonb_set(
        jsonb_set(v_slot->'projection', '{revision}', to_jsonb(v_next), true),
        '{generatedAt}',
        to_jsonb(now()::text),
        true
      ),
      v_actor,
      now()
    )
    on conflict (campaign_id, source_player_id) do update set
      assigned_character_id = excluded.assigned_character_id,
      display_name = excluded.display_name,
      projection_version = excluded.projection_version,
      revision = excluded.revision,
      projection = excluded.projection,
      generated_by = excluded.generated_by,
      generated_at = excluded.generated_at;

    insert into public.campaign_events(
      campaign_id, audience, audience_user_id, event_type, revision, safe_payload
    )
    values (
      p_campaign_id,
      case when v_assigned_user_id is null then 'gm' else 'player' end,
      v_assigned_user_id,
      'projection.replaced',
      v_next,
      jsonb_build_object('sourcePlayerId', v_source_player_id)
    );
  end loop;

  update public.campaign_invitations
  set revoked_at = now()
  where campaign_id = p_campaign_id
    and source_player_id is not null
    and not (source_player_id = any(v_keep))
    and revoked_at is null;
  delete from public.campaign_members
  where campaign_id = p_campaign_id
    and source_player_id is not null
    and not (source_player_id = any(v_keep));
  delete from public.campaign_player_slots
  where campaign_id = p_campaign_id
    and not (source_player_id = any(v_keep));

  insert into public.campaign_audit_log(
    campaign_id, actor_user_id, action, target_kind, target_id, metadata
  )
  values (
    p_campaign_id,
    v_actor,
    'campaign.publish-atomic',
    'campaign',
    p_campaign_id::text,
    jsonb_build_object('revision', v_next, 'playerSlots', jsonb_array_length(p_slots))
  );

  return v_next;
end;
$$;

revoke all on function public.publish_campaign_snapshot(uuid, bigint, jsonb, jsonb) from public, anon;
grant execute on function public.publish_campaign_snapshot(uuid, bigint, jsonb, jsonb) to authenticated;
