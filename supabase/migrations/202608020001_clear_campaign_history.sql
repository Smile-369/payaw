-- GM-authoritative message and dice-history cleanup. The clear event makes the
-- change immediate for connected players while the updated safe projections
-- make it durable for reconnecting clients.

create or replace function private.clear_campaign_message_threads(p_threads jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(jsonb_set(thread.value, '{messages}', '[]'::jsonb, true)),
    '[]'::jsonb
  )
  from jsonb_array_elements(
    case when jsonb_typeof(p_threads) = 'array' then p_threads else '[]'::jsonb end
  ) as thread(value);
$$;

revoke all on function private.clear_campaign_message_threads(jsonb) from public, anon, authenticated;

create or replace function public.clear_campaign_room_history(
  p_campaign_id uuid,
  p_history text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
  v_revision bigint;
  v_commands integer := 0;
  v_events integer := 0;
  v_slots integer := 0;
  v_document jsonb;
begin
  if v_actor is null or not private.has_campaign_role(
    p_campaign_id,
    array['owner-gm', 'co-gm']::public.campaign_role[],
    v_actor
  ) then
    raise exception using errcode = '42501', message = 'GM_ROLE_REQUIRED';
  end if;

  if p_history not in ('messages', 'dice') then
    raise exception using errcode = '22023', message = 'INVALID_HISTORY_KIND';
  end if;

  update public.campaign_rooms
  set projection_revision = projection_revision + 1,
      updated_at = v_now
  where id = p_campaign_id
  returning projection_revision into v_revision;

  if not found then
    raise exception using errcode = '22023', message = 'CAMPAIGN_ROOM_NOT_FOUND';
  end if;

  if p_history = 'messages' then
    delete from public.campaign_commands
    where campaign_id = p_campaign_id and kind = 'message.send';
    get diagnostics v_commands = row_count;

    delete from public.campaign_events
    where campaign_id = p_campaign_id and event_type = 'command.message.send';
    get diagnostics v_events = row_count;

    update public.campaign_player_slots
    set revision = greatest(revision + 1, v_revision),
        projection = jsonb_set(
          jsonb_set(
            jsonb_set(
              projection,
              '{messages}',
              private.clear_campaign_message_threads(projection->'messages'),
              true
            ),
            '{revision}',
            to_jsonb(greatest(revision + 1, v_revision)),
            true
          ),
          '{generatedAt}',
          to_jsonb(v_now::text),
          true
        ),
        generated_by = v_actor,
        generated_at = v_now
    where campaign_id = p_campaign_id;
    get diagnostics v_slots = row_count;

    select campaign_document into v_document
    from public.campaign_authority
    where campaign_id = p_campaign_id
    for update;

    if found then
      if jsonb_typeof(v_document#>'{campaign,messageThreads}') = 'array' then
        v_document := jsonb_set(
          v_document,
          '{campaign,messageThreads}',
          private.clear_campaign_message_threads(v_document#>'{campaign,messageThreads}'),
          false
        );
      end if;
      if jsonb_typeof(v_document#>'{project,authoring,campaign,messageThreads}') = 'array' then
        v_document := jsonb_set(
          v_document,
          '{project,authoring,campaign,messageThreads}',
          private.clear_campaign_message_threads(v_document#>'{project,authoring,campaign,messageThreads}'),
          false
        );
      end if;
      update public.campaign_authority
      set revision = v_revision,
          campaign_document = v_document,
          updated_by = v_actor,
          updated_at = v_now
      where campaign_id = p_campaign_id;
    end if;
  else
    delete from public.campaign_commands
    where campaign_id = p_campaign_id and kind = 'dice.roll';
    get diagnostics v_commands = row_count;

    delete from public.campaign_events
    where campaign_id = p_campaign_id and event_type = 'command.dice.roll';
    get diagnostics v_events = row_count;

    update public.campaign_player_slots
    set revision = greatest(revision + 1, v_revision),
        projection = jsonb_set(
          jsonb_set(
            jsonb_set(projection, '{diceRolls}', '[]'::jsonb, true),
            '{revision}',
            to_jsonb(greatest(revision + 1, v_revision)),
            true
          ),
          '{generatedAt}',
          to_jsonb(v_now::text),
          true
        ),
        generated_by = v_actor,
        generated_at = v_now
    where campaign_id = p_campaign_id;
    get diagnostics v_slots = row_count;
  end if;

  insert into public.campaign_events(
    campaign_id,
    audience,
    audience_user_id,
    event_type,
    revision,
    safe_payload,
    occurred_at
  ) values (
    p_campaign_id,
    'party',
    null,
    case when p_history = 'messages' then 'history.messages.clear' else 'history.dice.clear' end,
    v_revision,
    jsonb_build_object('clearedAt', v_now),
    v_now
  );

  insert into public.campaign_audit_log(
    campaign_id,
    actor_user_id,
    action,
    target_kind,
    target_id,
    metadata
  ) values (
    p_campaign_id,
    v_actor,
    'campaign.history-clear',
    p_history,
    p_campaign_id::text,
    jsonb_build_object(
      'history', p_history,
      'commandsDeleted', v_commands,
      'eventsDeleted', v_events,
      'slotsUpdated', v_slots
    )
  );

  return jsonb_build_object(
    'history', p_history,
    'revision', v_revision,
    'commandsDeleted', v_commands,
    'eventsDeleted', v_events,
    'slotsUpdated', v_slots,
    'clearedAt', v_now
  );
end;
$$;

revoke all on function public.clear_campaign_room_history(uuid, text) from public, anon;
grant execute on function public.clear_campaign_room_history(uuid, text) to authenticated;

notify pgrst, 'reload schema';
