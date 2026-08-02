-- Keep the database command constraint aligned with PlayerCommand and the
-- campaign-command Edge Function. Character sheet saves were previously
-- accepted by the client/function but rejected by PostgreSQL with 23514,
-- leaving the optimistic local projection ahead of the hosted projection.
alter table public.campaign_commands
  drop constraint if exists campaign_commands_kind_check;

alter table public.campaign_commands
  add constraint campaign_commands_kind_check
  check (kind in (
    'journal.create',
    'journal.share',
    'character.update',
    'character.sheet.update',
    'message.send',
    'dice.roll',
    'map.ping',
    'objective.propose'
  ));
