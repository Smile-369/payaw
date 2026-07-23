-- PAYAW 0.23.1: make the hosted roster follow the GM-configured player count.

create or replace function public.prune_campaign_player_slots(
  p_campaign_id uuid,
  p_keep_source_player_ids text[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keep text[] := coalesce(p_keep_source_player_ids, array[]::text[]);
  v_removed integer := 0;
begin
  if auth.uid() is null or not private.has_campaign_role(
    p_campaign_id,
    array['owner-gm', 'co-gm']::public.campaign_role[]
  ) then
    raise exception using errcode = '42501', message = 'GM_ROLE_REQUIRED';
  end if;

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
  get diagnostics v_removed = row_count;

  insert into public.campaign_audit_log(
    campaign_id,
    actor_user_id,
    action,
    target_kind,
    target_id,
    metadata
  )
  values (
    p_campaign_id,
    auth.uid(),
    'player-slots.pruned',
    'campaign',
    p_campaign_id::text,
    jsonb_build_object('removed', v_removed, 'retained', cardinality(v_keep))
  );

  return v_removed;
end;
$$;

revoke all on function public.prune_campaign_player_slots(uuid, text[]) from public, anon;
grant execute on function public.prune_campaign_player_slots(uuid, text[]) to authenticated;
