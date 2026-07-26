import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type JsonRecord = Record<string, unknown>;

interface RequestBody {
  campaignId: string;
  idempotencyKey: string;
  kind: string;
  payload: JsonRecord;
  expectedRevision: number;
  offlineSafe?: boolean;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function record(value: unknown): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('INVALID_PAYLOAD');
  return value as JsonRecord;
}

function text(value: unknown, maximum: number, fallback = ''): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : fallback;
}

function list(value: unknown, maximum: number): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))].slice(0, maximum)
    : [];
}

function id(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

function secureRoll(sides: number): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] ?? 0) % sides + 1;
}

function parseDice(value: unknown): { notation: string; count: number; sides: number; modifier: number } {
  const notation = text(value, 20).toLowerCase().replaceAll(' ', '');
  const match = /^(\d{0,2})d(\d{1,4})([+-]\d{1,3})?$/.exec(notation);
  if (match === null) throw new Error('INVALID_DICE');
  const count = Math.max(1, Number(match[1] || 1));
  const sides = Number(match[2]);
  const modifier = Number(match[3] || 0);
  if (!Number.isInteger(count) || count > 20 || !Number.isInteger(sides) || sides < 2 || sides > 1000) throw new Error('INVALID_DICE');
  return { notation: `${count}d${sides}${modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : modifier}`, count, sides, modifier };
}

function applyCommand(projectionValue: unknown, kind: string, payloadValue: unknown, now: string): JsonRecord {
  const projection = structuredClone(record(projectionValue));
  const payload = record(payloadValue);
  const viewer = record(projection.viewer);
  const journal = record(projection.journal);

  if (kind === 'journal.create') {
    const sharedWithParty = payload.sharedWithParty === true;
    const entry = {
      id: id('journal'), title: text(payload.title, 160, 'Untitled note'), body: text(payload.body, 20000),
      ownerLabel: text(viewer.displayName, 80, 'Player'), sharedWithParty, linkedEntityIds: [], createdAt: now, updatedAt: now,
    };
    journal.personal = [...(Array.isArray(journal.personal) ? journal.personal : []), entry];
    if (sharedWithParty) journal.shared = [...(Array.isArray(journal.shared) ? journal.shared : []), entry];
  } else if (kind === 'journal.share') {
    const entryId = text(payload.entryId, 200);
    const personal = Array.isArray(journal.personal) ? journal.personal : [];
    const original = personal.find((item) => record(item).id === entryId);
    if (original === undefined) throw new Error('JOURNAL_ENTRY_NOT_FOUND');
    const updated = { ...record(original), sharedWithParty: payload.sharedWithParty === true, updatedAt: now };
    journal.personal = personal.map((item) => record(item).id === entryId ? updated : item);
    const shared = (Array.isArray(journal.shared) ? journal.shared : []).filter((item) => record(item).id !== entryId);
    journal.shared = payload.sharedWithParty === true ? [...shared, updated] : shared;
  } else if (kind === 'character.update') {
    const character = record(projection.character);
    const field = text(payload.field, 40);
    const editable = Array.isArray(character.editableFields) ? character.editableFields : [];
    if (!editable.includes(field)) throw new Error('CHARACTER_FIELD_DENIED');
    if (field === 'conditions') character[field] = list(payload.value, 40);
    else if (field === 'inventory') character[field] = list(payload.value, 100);
    else if (['name', 'pronouns', 'background', 'privateNotes'].includes(field)) {
      character[field] = text(payload.value, field === 'privateNotes' ? 8000 : field === 'background' ? 2000 : 160);
    } else throw new Error('CHARACTER_FIELD_DENIED');
  } else if (kind === 'message.send') {
    const threadId = text(payload.threadId, 200);
    const body = text(payload.body, 4000);
    if (body.length === 0) throw new Error('EMPTY_MESSAGE');
    const threads = Array.isArray(projection.messages) ? projection.messages : [];
    let matched = false;
    projection.messages = threads.map((item) => {
      const thread = record(item);
      if (thread.id !== threadId || thread.canReply !== true) return item;
      matched = true;
      return { ...thread, messages: [...(Array.isArray(thread.messages) ? thread.messages : []), {
        id: id('message'), senderLabel: text(viewer.characterName, 120, 'Character'), body, sentAt: now,
        status: 'sent', presentation: { glitch: false, corruption: 0 },
      }] };
    });
    if (!matched) throw new Error('MESSAGE_THREAD_DENIED');
  } else if (kind === 'dice.roll') {
    const dice = parseDice(payload.notation);
    const rollerUsername = text(payload.rollerUsername, 24, text(viewer.displayName, 24, 'PLAYER'));
    const values = Array.from({ length: dice.count }, () => secureRoll(dice.sides));
    const roll = { id: id('roll'), rollerUsername, notation: dice.notation, values, modifier: dice.modifier, total: values.reduce((sum, value) => sum + value, 0) + dice.modifier, visibility: 'party', rolledAt: now };
    projection.diceRolls = [roll, ...(Array.isArray(projection.diceRolls) ? projection.diceRolls : [])].slice(0, 100);
  } else if (kind === 'map.ping') {
    const x = Number(payload.x); const y = Number(payload.y);
    const map = record(projection.map); const base = typeof map.base === 'object' && map.base !== null ? record(map.base) : null;
    const width = Number(base?.worldWidth ?? Number.POSITIVE_INFINITY); const height = Number(base?.worldHeight ?? Number.POSITIVE_INFINITY);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > width || y > height) throw new Error('INVALID_MAP_POSITION');
    const ping = { id: id('ping'), kind: 'ping', label: text(payload.label, 80, `${text(viewer.characterName, 120, 'Player')}'s ping`), knowledge: 'visited', position: { x, y }, approximateRadius: null, detail: 'Temporary player ping', linkedEntityId: null, color: text(viewer.color, 20, '#73b7a4'), expiresAt: new Date(Date.parse(now) + 15 * 60 * 1000).toISOString() };
    map.features = [...(Array.isArray(map.features) ? map.features : []), ping];
  } else if (kind === 'objective.propose') {
    const wording = text(payload.wording, 500);
    if (wording.length === 0) throw new Error('EMPTY_OBJECTIVE');
    projection.objectives = [...(Array.isArray(projection.objectives) ? projection.objectives : []), { id: id('objective'), wording, status: 'proposed', completionNote: '', playerCreated: true }];
  } else throw new Error('UNSUPPORTED_COMMAND');

  projection.generatedAt = now;
  return projection;
}

function partyDelta(projection: JsonRecord, kind: string, payload: JsonRecord): JsonRecord | null {
  if (kind === 'message.send' && payload.privateToGm !== true) {
    const threadId = text(payload.threadId, 200);
    const thread = (Array.isArray(projection.messages) ? projection.messages : []).map(record).find((item) => item.id === threadId);
    const message = thread !== undefined && Array.isArray(thread.messages) ? thread.messages.at(-1) : undefined;
    return message === undefined ? null : { kind, threadId, message };
  }
  if (kind === 'dice.roll') {
    const roll = Array.isArray(projection.diceRolls) ? projection.diceRolls[0] : undefined;
    return roll === undefined ? null : { kind, roll };
  }
  if (kind === 'map.ping') {
    const map = record(projection.map);
    const ping = (Array.isArray(map.features) ? map.features : []).map(record).filter((item) => item.kind === 'ping').at(-1);
    return ping === undefined ? null : { kind, ping };
  }
  if ((kind === 'journal.create' || kind === 'journal.share') && payload.sharedWithParty === true) {
    const journal = record(projection.journal);
    const entries = Array.isArray(journal.shared) ? journal.shared : [];
    const entryId = text(payload.entryId, 200);
    const entry = kind === 'journal.share' ? entries.map(record).find((item) => item.id === entryId) : entries.at(-1);
    return entry === undefined ? null : { kind: 'journal.party', entry };
  }
  return null;
}

function applyPartyDelta(projectionValue: unknown, delta: JsonRecord, now: string): JsonRecord {
  const projection = structuredClone(record(projectionValue));
  if (delta.kind === 'message.send') {
    projection.messages = (Array.isArray(projection.messages) ? projection.messages : []).map((item) => {
      const thread = record(item);
      if (thread.id !== delta.threadId) return item;
      const messages = Array.isArray(thread.messages) ? thread.messages : [];
      const message = record(delta.message);
      return messages.some((candidate) => record(candidate).id === message.id) ? item : { ...thread, messages: [...messages, message] };
    });
  } else if (delta.kind === 'dice.roll') {
    const roll = record(delta.roll); const values = Array.isArray(projection.diceRolls) ? projection.diceRolls : [];
    projection.diceRolls = values.some((candidate) => record(candidate).id === roll.id) ? values : [roll, ...values].slice(0, 100);
  } else if (delta.kind === 'map.ping') {
    const map = record(projection.map); const ping = record(delta.ping); const features = Array.isArray(map.features) ? map.features : [];
    map.features = features.some((candidate) => record(candidate).id === ping.id) ? features : [...features, ping];
  } else if (delta.kind === 'journal.party') {
    const journal = record(projection.journal); const entry = record(delta.entry); const shared = Array.isArray(journal.shared) ? journal.shared : [];
    journal.shared = [...shared.filter((candidate) => record(candidate).id !== entry.id), entry];
  }
  projection.generatedAt = now;
  return projection;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  const authorization = request.headers.get('Authorization');
  if (authorization === null) return json(401, { error: 'AUTH_REQUIRED' });

  try {
    const body = record(await request.json()) as unknown as RequestBody;
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const service = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const { data: queued, error: queueError } = await userClient.rpc('submit_campaign_command', {
      p_campaign_id: body.campaignId,
      p_idempotency_key: body.idempotencyKey,
      p_kind: body.kind,
      p_payload: body.payload,
      p_expected_revision: Math.max(0, Math.round(body.expectedRevision)),
      p_offline_safe: body.offlineSafe === true,
    });
    if (queueError !== null) return json(queueError.code === '42501' ? 403 : queueError.code === '40001' ? 409 : 400, { error: queueError.message });
    const command = record(queued);

    const { data: slot, error: slotError } = await service.from('campaign_player_slots').select('*')
      .eq('campaign_id', body.campaignId).eq('assigned_user_id', command.user_id).single();
    if (slotError !== null || slot === null) return json(409, { error: 'PLAYER_SLOT_UNAVAILABLE' });
    if (command.status === 'applied') return json(200, { command, projection: slot.projection });

    await service.from('campaign_commands').update({ status: 'processing' }).eq('id', command.id).eq('status', 'queued');
    const now = new Date().toISOString();
    const projection = applyCommand(slot.projection, body.kind, body.payload, now);
    const nextRevision = Number(slot.revision) + 1;
    projection.revision = nextRevision;
    const { data: updated, error: updateError } = await service.from('campaign_player_slots')
      .update({ projection, revision: nextRevision, generated_at: now })
      .eq('campaign_id', body.campaignId).eq('source_player_id', slot.source_player_id).eq('revision', slot.revision)
      .select('projection,revision').maybeSingle();
    if (updateError !== null || updated === null) {
      await service.from('campaign_commands').update({ status: 'rejected', error_code: 'REVISION_CONFLICT', resolved_at: now }).eq('id', command.id);
      return json(409, { error: 'REVISION_CONFLICT' });
    }

    const partyVisible = body.kind === 'message.send' && body.payload.privateToGm !== true
      || body.kind === 'dice.roll'
      || body.kind === 'map.ping'
      || (body.kind === 'journal.create' || body.kind === 'journal.share') && body.payload.sharedWithParty === true;
    const delta = partyVisible ? partyDelta(projection, body.kind, body.payload) : null;
    if (delta !== null) {
      const { data: partySlots } = await service.from('campaign_player_slots').select('*')
        .eq('campaign_id', body.campaignId).neq('source_player_id', slot.source_player_id);
      for (const partySlot of partySlots ?? []) {
        const partyProjection = applyPartyDelta(partySlot.projection, delta, now);
        const partyRevision = Number(partySlot.revision) + 1; partyProjection.revision = partyRevision;
        await service.from('campaign_player_slots').update({ projection: partyProjection, revision: partyRevision, generated_at: now })
          .eq('campaign_id', body.campaignId).eq('source_player_id', partySlot.source_player_id).eq('revision', partySlot.revision);
      }
    }
    const gmOnly = body.kind === 'message.send' && body.payload.privateToGm === true;
    const latestDiceRoll = body.kind === 'dice.roll' && Array.isArray(projection.diceRolls)
      ? projection.diceRolls[0]
      : undefined;
    const eventPayload = latestDiceRoll === undefined
      ? { commandId: command.id, sourcePlayerId: slot.source_player_id }
      : { commandId: command.id, sourcePlayerId: slot.source_player_id, diceRoll: latestDiceRoll };
    await service.from('campaign_events').insert({
      campaign_id: body.campaignId, audience: partyVisible ? 'party' : gmOnly ? 'gm' : 'player',
      audience_user_id: partyVisible || gmOnly ? null : command.user_id, event_type: `command.${body.kind}`,
      revision: nextRevision, safe_payload: eventPayload,
    });
    const commandResult = latestDiceRoll === undefined
      ? { revision: nextRevision }
      : { revision: nextRevision, diceRoll: latestDiceRoll };
    await service.from('campaign_commands').update({ status: 'applied', result: commandResult, resolved_at: now }).eq('id', command.id);
    return json(200, { command: { ...command, status: 'applied', result: commandResult }, projection: updated.projection });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'COMMAND_FAILED';
    return json(400, { error: message });
  }
});
