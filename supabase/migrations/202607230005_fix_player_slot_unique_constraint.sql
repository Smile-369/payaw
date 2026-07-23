-- PAYAW hotfix: allow more than one unclaimed player slot per campaign.
--
-- The original UNIQUE NULLS NOT DISTINCT constraint treated every NULL
-- assigned_user_id as the same value. That made the second unclaimed slot in
-- a campaign fail with:
-- campaign_player_slots_campaign_id_assigned_user_id_key

alter table public.campaign_player_slots
  drop constraint if exists campaign_player_slots_campaign_id_assigned_user_id_key;

-- Keep the intended protection: one authenticated user may claim only one
-- player slot inside a given campaign. Unclaimed slots remain unrestricted.
create unique index if not exists campaign_player_slots_campaign_assigned_user_unique
  on public.campaign_player_slots (campaign_id, assigned_user_id)
  where assigned_user_id is not null;
