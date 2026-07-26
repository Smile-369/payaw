-- PAYAW 0.24 netcode write-reduction pass.
--
-- Goals:
--   1. Dice rolls are durable campaign events, not copies embedded into every player slot.
--   2. GM snapshot publication only writes player slots whose player-safe contents changed.
--   3. Hot command/event history lookups use purpose-built indexes.
--   4. Old transient transport history can be pruned by the GM without touching campaign state.

create index if not exists campaign_commands_user_rate_idx
  on public.campaign_commands (campaign_id, user_id, created_at desc);

create index if not exists campaign_commands_history_idx
  on public.campaign_commands (campaign_id, created_at desc);

create index if not exists campaign_events_dice_history_idx
  on public.campaign_events (campaign_id, sequence desc)
  where event_type = 'command.dice.roll';

create index if not exists campaign_events_retention_idx
  on public.campaign_events (campaign_id, occurred_at);

-- Called only by the Edge Function with the service-role key after it authenticates
-- the request. It records a roll and its command atomically without touching any
-- large campaign_player_slots.projection JSON document.
create or replace function public.record_campaign_dice_roll(
  p_campaign_id uuid,
  p_actor_user_id uuid,
  p_idempotency_key uuid,
  p_payload jsonb,
  p_expected_revision bigint,
  p_roll jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.campaign_members%rowtype;
  v_slot public.campaign_player_slots%rowtype;
  v_existing public.campaign_commands%rowtype;
  v_command public.campaign_commands%rowtype;
  v_event public.campaign_events%rowtype;
  v_rate integer;
  v_revision bigint := 0;
  v_source_player_id text;
begin
  if p_actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_member
  from public.campaign_members
  where campaign_id = p_campaign_id
    and user_id = p_actor_user_id
    and revoked_at is null;

  if not found or v_member.role not in (
    'owner-gm'::public.campaign_role,
    'co-gm'::public.campaign_role,
    'player'::public.campaign_role
  ) then
    raise exception using errcode = '42501', message = 'CAMPAIGN_MEMBER_REQUIRED';
  end if;

  select * into v_existing
  from public.campaign_commands
  where campaign_id = p_campaign_id
    and user_id = p_actor_user_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.kind <> 'dice.roll' then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return jsonb_build_object(
      'command', to_jsonb(v_existing),
      'diceRoll', v_existing.result->'diceRoll'
    );
  end if;

  if p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 32768
    or p_roll is null
    or jsonb_typeof(p_roll) <> 'object'
    or nullif(trim(p_roll->>'id'), '') is null
    or nullif(trim(p_roll->>'rollerUsername'), '') is null
    or nullif(trim(p_roll->>'notation'), '') is null
    or nullif(trim(p_roll->>'rolledAt'), '') is null
    or octet_length(p_roll::text) > 8192
  then
    raise exception using errcode = '22023', message = 'INVALID_DICE_ROLL';
  end if;

  if p_roll->'values' is null or jsonb_typeof(p_roll->'values') <> 'array' then
    raise exception using errcode = '22023', message = 'INVALID_DICE_ROLL';
  end if;

  if jsonb_array_length(p_roll->'values') < 1
    or jsonb_array_length(p_roll->'values') > 20
  then
    raise exception using errcode = '22023', message = 'INVALID_DICE_ROLL';
  end if;

  if v_member.role = 'player'::public.campaign_role then
    select * into v_slot
    from public.campaign_player_slots
    where campaign_id = p_campaign_id
      and assigned_user_id = p_actor_user_id;

    if not found then
      raise exception using errcode = '42501', message = 'PLAYER_SLOT_REQUIRED';
    end if;
    if not coalesce((v_slot.projection->'capabilities') ? 'dice.roll', false) then
      raise exception using errcode = '42501', message = 'CAPABILITY_DENIED';
    end if;

    v_source_player_id := v_slot.source_player_id;
    v_revision := v_slot.revision;
  else
    v_source_player_id := coalesce(v_member.source_player_id, 'gm:' || p_actor_user_id::text);
    select projection_revision into v_revision
    from public.campaign_rooms
    where id = p_campaign_id;
    if not found then
      raise exception using errcode = '22023', message = 'CAMPAIGN_ROOM_NOT_FOUND';
    end if;
  end if;

  select count(*) into v_rate
  from public.campaign_commands
  where campaign_id = p_campaign_id
    and user_id = p_actor_user_id
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
    offline_safe,
    status,
    result,
    resolved_at
  ) values (
    p_campaign_id,
    p_actor_user_id,
    v_source_player_id,
    p_idempotency_key,
    'dice.roll',
    p_payload,
    greatest(0, p_expected_revision),
    false,
    'applied',
    jsonb_build_object('revision', v_revision, 'diceRoll', p_roll),
    now()
  )
  on conflict (campaign_id, user_id, idempotency_key) do nothing
  returning * into v_command;

  if not found then
    select * into v_command
    from public.campaign_commands
    where campaign_id = p_campaign_id
      and user_id = p_actor_user_id
      and idempotency_key = p_idempotency_key;

    if v_command.kind <> 'dice.roll' then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;

    return jsonb_build_object(
      'command', to_jsonb(v_command),
      'diceRoll', v_command.result->'diceRoll'
    );
  end if;

  insert into public.campaign_events(
    campaign_id,
    audience,
    audience_user_id,
    event_type,
    revision,
    safe_payload
  ) values (
    p_campaign_id,
    'party',
    null,
    'command.dice.roll',
    v_revision,
    jsonb_build_object(
      'commandId', v_command.id,
      'sourcePlayerId', v_source_player_id,
      'actorRole', v_member.role,
      'idempotencyKey', p_idempotency_key,
      'revision', v_revision,
      'diceRoll', p_roll
    )
  )
  returning * into v_event;

  return jsonb_build_object(
    'command', to_jsonb(v_command),
    'event', to_jsonb(v_event),
    'diceRoll', p_roll
  );
end;
$$;

revoke all on function public.record_campaign_dice_roll(uuid, uuid, uuid, jsonb, bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_campaign_dice_roll(uuid, uuid, uuid, jsonb, bigint, jsonb)
  to service_role;

-- Finalizes every non-dice player command in one database transaction. The Edge
-- Function computes recipient-safe projections, while this RPC locks revisions,
-- updates all affected slots, emits one event, and resolves the command without
-- opening one PostgREST request per player.
create or replace function public.finalize_campaign_projection_command(
  p_campaign_id uuid,
  p_command_id uuid,
  p_updates jsonb,
  p_audience text,
  p_audience_user_id uuid,
  p_event_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_command public.campaign_commands%rowtype;
  v_update jsonb;
  v_slot public.campaign_player_slots%rowtype;
  v_event public.campaign_events%rowtype;
  v_source_player_id text;
  v_expected_revision bigint;
  v_next_revision bigint;
  v_projection jsonb;
  v_source_projection jsonb;
  v_source_revision bigint := 0;
  v_keep text[] := array[]::text[];
  v_revisions jsonb := '[]'::jsonb;
begin
  select * into v_command
  from public.campaign_commands
  where id = p_command_id
    and campaign_id = p_campaign_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'COMMAND_NOT_FOUND';
  end if;

  if v_command.kind = 'dice.roll' then
    raise exception using errcode = '22023', message = 'DICE_COMMAND_USES_EVENT_PATH';
  end if;

  if v_command.status = 'applied'::public.command_status then
    select projection, revision
    into v_source_projection, v_source_revision
    from public.campaign_player_slots
    where campaign_id = p_campaign_id
      and source_player_id = v_command.source_player_id;

    return jsonb_build_object(
      'command', to_jsonb(v_command),
      'projection', v_source_projection,
      'revision', v_source_revision,
      'replayed', true
    );
  end if;

  if v_command.status = 'rejected'::public.command_status then
    return jsonb_build_object(
      'command', to_jsonb(v_command),
      'error', coalesce(v_command.error_code, 'COMMAND_REJECTED')
    );
  end if;

  if v_command.status not in (
    'queued'::public.command_status,
    'processing'::public.command_status
  ) then
    raise exception using errcode = '22023', message = 'COMMAND_STATUS_INVALID';
  end if;

  if p_updates is null or jsonb_typeof(p_updates) <> 'array' then
    raise exception using errcode = '22023', message = 'INVALID_PROJECTION_UPDATES';
  end if;
  if jsonb_array_length(p_updates) < 1 or jsonb_array_length(p_updates) > 32 then
    raise exception using errcode = '22023', message = 'INVALID_PROJECTION_UPDATES';
  end if;
  if p_audience is null
    or p_audience not in ('gm', 'party', 'player')
    or (p_audience = 'player' and p_audience_user_id is null)
    or (p_audience <> 'player' and p_audience_user_id is not null)
  then
    raise exception using errcode = '22023', message = 'INVALID_EVENT_AUDIENCE';
  end if;
  if p_event_payload is null
    or jsonb_typeof(p_event_payload) <> 'object'
    or octet_length(p_event_payload::text) > 32768
  then
    raise exception using errcode = '22023', message = 'INVALID_EVENT_PAYLOAD';
  end if;

  -- Validate and lock every target before changing any projection.
  for v_update in select value from jsonb_array_elements(p_updates)
  loop
    v_source_player_id := nullif(trim(v_update->>'sourcePlayerId'), '');
    if v_source_player_id is null
      or v_update->'projection' is null
      or jsonb_typeof(v_update->'projection') <> 'object'
      or octet_length((v_update->'projection')::text) > 5242880
    then
      raise exception using errcode = '22023', message = 'INVALID_PROJECTION_UPDATE';
    end if;
    if v_source_player_id = any(v_keep) then
      raise exception using errcode = '22023', message = 'DUPLICATE_PROJECTION_UPDATE';
    end if;

    v_expected_revision := coalesce((v_update->>'expectedRevision')::bigint, -1);
    select * into v_slot
    from public.campaign_player_slots
    where campaign_id = p_campaign_id
      and source_player_id = v_source_player_id
    for update;

    if not found or v_slot.revision <> v_expected_revision then
      return jsonb_build_object(
        'command', to_jsonb(v_command),
        'error', 'REVISION_CONFLICT'
      );
    end if;

    v_keep := array_append(v_keep, left(v_source_player_id, 160));
  end loop;

  if not (v_command.source_player_id = any(v_keep)) then
    raise exception using errcode = '22023', message = 'SOURCE_PROJECTION_UPDATE_REQUIRED';
  end if;

  for v_update in select value from jsonb_array_elements(p_updates)
  loop
    v_source_player_id := left(trim(v_update->>'sourcePlayerId'), 160);
    select * into v_slot
    from public.campaign_player_slots
    where campaign_id = p_campaign_id
      and source_player_id = v_source_player_id;

    v_next_revision := v_slot.revision + 1;
    v_projection := jsonb_set(
      jsonb_set(
        v_update->'projection',
        '{revision}',
        to_jsonb(v_next_revision),
        true
      ),
      '{generatedAt}',
      to_jsonb(now()::text),
      true
    );

    update public.campaign_player_slots
    set projection = v_projection,
        revision = v_next_revision,
        generated_at = now()
    where campaign_id = p_campaign_id
      and source_player_id = v_source_player_id;

    if v_source_player_id = v_command.source_player_id then
      v_source_projection := v_projection;
      v_source_revision := v_next_revision;
    end if;

    v_revisions := v_revisions || jsonb_build_array(jsonb_build_object(
      'sourcePlayerId', v_source_player_id,
      'revision', v_next_revision
    ));
  end loop;

  insert into public.campaign_events(
    campaign_id,
    audience,
    audience_user_id,
    event_type,
    revision,
    safe_payload
  ) values (
    p_campaign_id,
    p_audience,
    p_audience_user_id,
    'command.' || v_command.kind,
    v_source_revision,
    p_event_payload || jsonb_build_object(
      'commandId', v_command.id,
      'sourcePlayerId', v_command.source_player_id
    )
  )
  returning * into v_event;

  update public.campaign_commands
  set status = 'applied',
      result = jsonb_build_object('revision', v_source_revision),
      error_code = null,
      resolved_at = now()
  where id = v_command.id
  returning * into v_command;

  return jsonb_build_object(
    'command', to_jsonb(v_command),
    'projection', v_source_projection,
    'revision', v_source_revision,
    'revisions', v_revisions,
    'event', to_jsonb(v_event),
    'replayed', false
  );
end;
$$;

revoke all on function public.finalize_campaign_projection_command(uuid, uuid, jsonb, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.finalize_campaign_projection_command(uuid, uuid, jsonb, text, uuid, jsonb)
  to service_role;

-- Optimized snapshot writer. It returns exact per-slot revisions so the GM client
-- can update its local concurrency tokens without rereading five room resources.
create or replace function public.publish_campaign_snapshot_optimized(
  p_campaign_id uuid,
  p_revision bigint,
  p_authority jsonb,
  p_slots jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_room_revision bigint;
  v_slot jsonb;
  v_source_player_id text;
  v_current public.campaign_player_slots%rowtype;
  v_expected_revision bigint;
  v_assigned_user_id uuid;
  v_keep text[] := array[]::text[];
  v_candidate jsonb;
  v_slot_revision bigint;
  v_changed boolean;
  v_changed_slots integer := 0;
  v_slot_results jsonb := '[]'::jsonb;
begin
  if v_actor is null or not private.has_campaign_role(
    p_campaign_id,
    array['owner-gm', 'co-gm']::public.campaign_role[],
    v_actor
  ) then
    raise exception using errcode = '42501', message = 'GM_ROLE_REQUIRED';
  end if;

  if p_authority is null
    or jsonb_typeof(p_authority) <> 'object'
    or octet_length(p_authority::text) > 10485760
  then
    raise exception using errcode = '22023', message = 'AUTHORITY_TOO_LARGE';
  end if;
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' then
    raise exception using errcode = '22023', message = 'INVALID_PLAYER_SLOTS';
  end if;
  if jsonb_array_length(p_slots) > 32 then
    raise exception using errcode = '22023', message = 'INVALID_PLAYER_SLOTS';
  end if;

  -- Lock and validate every optimistic concurrency token before writing anything.
  for v_slot in select value from jsonb_array_elements(p_slots)
  loop
    v_source_player_id := nullif(trim(v_slot->>'sourcePlayerId'), '');
    if v_source_player_id is null
      or nullif(trim(v_slot->>'assignedCharacterId'), '') is null
      or nullif(trim(v_slot->>'displayName'), '') is null
      or coalesce((v_slot->>'projectionVersion')::integer, 0) <> 1
      or v_slot->'projection' is null
      or jsonb_typeof(v_slot->'projection') <> 'object'
      or octet_length((v_slot->'projection')::text) > 5242880
    then
      raise exception using errcode = '22023', message = 'INVALID_PLAYER_PROJECTION';
    end if;

    if v_source_player_id = any(v_keep) then
      raise exception using errcode = '22023', message = 'DUPLICATE_PLAYER_SLOT';
    end if;

    select * into v_current
    from public.campaign_player_slots
    where campaign_id = p_campaign_id
      and source_player_id = v_source_player_id
    for update;

    v_expected_revision := coalesce((v_slot->>'expectedRevision')::bigint, -1);
    if found and v_expected_revision <> v_current.revision then
      raise exception using errcode = '40001', message = 'SNAPSHOT_CONFLICT';
    elsif not found and v_expected_revision <> -1 then
      raise exception using errcode = '40001', message = 'SNAPSHOT_CONFLICT';
    end if;

    v_keep := array_append(v_keep, left(v_source_player_id, 160));
  end loop;

  update public.campaign_rooms
  set projection_revision = greatest(projection_revision + 1, greatest(0, p_revision)),
      updated_at = now()
  where id = p_campaign_id
  returning projection_revision into v_room_revision;

  if not found then
    raise exception using errcode = '22023', message = 'CAMPAIGN_ROOM_NOT_FOUND';
  end if;

  insert into public.campaign_authority(
    campaign_id,
    revision,
    schema_version,
    campaign_document,
    updated_by,
    updated_at
  ) values (
    p_campaign_id,
    v_room_revision,
    23,
    p_authority,
    v_actor,
    now()
  )
  on conflict (campaign_id) do update set
    revision = excluded.revision,
    schema_version = excluded.schema_version,
    campaign_document = excluded.campaign_document,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  for v_slot in select value from jsonb_array_elements(p_slots)
  loop
    v_source_player_id := left(trim(v_slot->>'sourcePlayerId'), 160);

    select * into v_current
    from public.campaign_player_slots
    where campaign_id = p_campaign_id
      and source_player_id = v_source_player_id;

    if found then
      v_assigned_user_id := v_current.assigned_user_id;
      v_changed := v_current.assigned_character_id is distinct from left(v_slot->>'assignedCharacterId', 160)
        or v_current.display_name is distinct from left(v_slot->>'displayName', 80)
        or v_current.projection_version <> 1
        or (v_current.projection - 'revision' - 'generatedAt')
          is distinct from ((v_slot->'projection') - 'revision' - 'generatedAt');
      v_slot_revision := case
        when v_changed then greatest(v_current.revision + 1, v_room_revision)
        else v_current.revision
      end;
    else
      v_assigned_user_id := null;
      v_changed := true;
      v_slot_revision := v_room_revision;
    end if;

    if v_changed then
      v_candidate := jsonb_set(
        jsonb_set(
          v_slot->'projection',
          '{revision}',
          to_jsonb(v_slot_revision),
          true
        ),
        '{generatedAt}',
        to_jsonb(now()::text),
        true
      );

      insert into public.campaign_player_slots(
        campaign_id,
        source_player_id,
        assigned_user_id,
        assigned_character_id,
        display_name,
        projection_version,
        revision,
        projection,
        generated_by,
        generated_at
      ) values (
        p_campaign_id,
        v_source_player_id,
        v_assigned_user_id,
        left(v_slot->>'assignedCharacterId', 160),
        left(v_slot->>'displayName', 80),
        1,
        v_slot_revision,
        v_candidate,
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

      v_changed_slots := v_changed_slots + 1;
    end if;

    v_slot_results := v_slot_results || jsonb_build_array(jsonb_build_object(
      'sourcePlayerId', v_source_player_id,
      'revision', v_slot_revision,
      'changed', v_changed
    ));
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

  return jsonb_build_object(
    'revision', v_room_revision,
    'changedSlots', v_changed_slots,
    'slots', v_slot_results
  );
end;
$$;

revoke all on function public.publish_campaign_snapshot_optimized(uuid, bigint, jsonb, jsonb)
  from public, anon;
grant execute on function public.publish_campaign_snapshot_optimized(uuid, bigint, jsonb, jsonb)
  to authenticated;

create or replace function public.prune_campaign_netcode_history(
  p_campaign_id uuid,
  p_event_days integer default 30,
  p_command_days integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_events integer;
  v_commands integer;
begin
  if v_actor is null or not private.has_campaign_role(
    p_campaign_id,
    array['owner-gm', 'co-gm']::public.campaign_role[],
    v_actor
  ) then
    raise exception using errcode = '42501', message = 'GM_ROLE_REQUIRED';
  end if;

  delete from public.campaign_events
  where campaign_id = p_campaign_id
    and occurred_at < now() - make_interval(days => greatest(7, least(365, p_event_days)));
  get diagnostics v_events = row_count;

  delete from public.campaign_commands
  where campaign_id = p_campaign_id
    and created_at < now() - make_interval(days => greatest(14, least(730, p_command_days)));
  get diagnostics v_commands = row_count;

  return jsonb_build_object('eventsDeleted', v_events, 'commandsDeleted', v_commands);
end;
$$;

revoke all on function public.prune_campaign_netcode_history(uuid, integer, integer)
  from public, anon;
grant execute on function public.prune_campaign_netcode_history(uuid, integer, integer)
  to authenticated;

notify pgrst, 'reload schema';
