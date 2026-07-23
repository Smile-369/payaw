-- PAYAW 0.23.2 hotfix: remove PL/pgSQL output-column ambiguity during
-- invitation claims. Browser-side player auth isolation is implemented in
-- src/netcode/SupabaseClient.ts; this migration repairs already-deployed DBs.

create or replace function public.claim_campaign_invitation(p_token text, p_display_name text)
returns table(campaign_id uuid, source_player_id text, role public.campaign_role)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_invite public.campaign_invitations%rowtype;
begin
  if v_user is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  select * into v_invite
  from public.campaign_invitations i
  where i.token_hash = encode(extensions.digest(upper(trim(p_token)), 'sha256'), 'hex')
    and i.revoked_at is null
    and i.expires_at > now()
    and i.use_count < i.max_uses
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'INVITE_INVALID_OR_EXPIRED';
  end if;

  if v_invite.source_player_id is not null and exists (
    select 1
    from public.campaign_player_slots s
    where s.campaign_id = v_invite.campaign_id
      and s.assigned_user_id = v_user
      and s.source_player_id <> v_invite.source_player_id
  ) then
    raise exception using errcode = '23505', message = 'PLAYER_DEVICE_ALREADY_ASSIGNED';
  end if;

  insert into public.campaign_members(
    campaign_id, user_id, role, source_player_id, display_name, assigned_character_id
  )
  values (
    v_invite.campaign_id,
    v_user,
    v_invite.role,
    v_invite.source_player_id,
    left(coalesce(nullif(trim(p_display_name), ''), 'Player'), 80),
    v_invite.assigned_character_id
  )
  on conflict on constraint campaign_members_pkey do update set
    role = excluded.role,
    source_player_id = excluded.source_player_id,
    display_name = excluded.display_name,
    assigned_character_id = excluded.assigned_character_id,
    revoked_at = null;

  if v_invite.source_player_id is not null then
    update public.campaign_player_slots
    set assigned_user_id = v_user
    where campaign_player_slots.campaign_id = v_invite.campaign_id
      and campaign_player_slots.source_player_id = v_invite.source_player_id
      and (
        campaign_player_slots.assigned_user_id is null
        or campaign_player_slots.assigned_user_id = v_user
      );

    if not found then
      raise exception using errcode = '23505', message = 'PLAYER_SLOT_ALREADY_CLAIMED';
    end if;
  end if;

  update public.campaign_invitations
  set use_count = public.campaign_invitations.use_count + 1
  where public.campaign_invitations.id = v_invite.id;

  insert into public.campaign_audit_log(
    campaign_id, actor_user_id, action, target_kind, target_id
  )
  values (v_invite.campaign_id, v_user, 'invite.claim', 'member', v_user::text);

  return query
  select v_invite.campaign_id, v_invite.source_player_id, v_invite.role;
end;
$$;

revoke all on function public.claim_campaign_invitation(text, text) from public, anon;
grant execute on function public.claim_campaign_invitation(text, text) to authenticated;
