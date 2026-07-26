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

function createDiceRoll(payloadValue: unknown, fallbackName: string, now: string): JsonRecord {
  const payload = record(payloadValue);
  const dice = parseDice(payload.notation);
  const rollerUsername = text(payload.rollerUsername, 24, text(fallbackName, 24, 'PLAYER'));
  const values = Array.from({ length: dice.count }, () => secureRoll(dice.sides));
  return {
    id: id('roll'),
    rollerUsername,
    notation: dice.notation,
    values,
    modifier: dice.modifier,
    total: values.reduce((sum, value) => sum + value, 0) + dice.modifier,
    visibility: 'party',
    rolledAt: now,
  };
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
  if (kind === 'map.ping') {
    const map = record(projection.map);
    const ping = (Array.isArray(map.features) ? map.features : []).map(record).filter((item) => item.kind === 'ping').at(-1);
    return ping === undefined ? null : { kind, ping };
  }
  if (kind === 'journal.create' && payload.sharedWithParty === true || kind === 'journal.share') {
    const journal = record(projection.journal);
    const entryId = text(payload.entryId, 200);
    const entries = kind === 'journal.share'
      ? (Array.isArray(journal.personal) ? journal.personal : [])
      : (Array.isArray(journal.shared) ? journal.shared : []);
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
  } else if (delta.kind === 'map.ping') {
    const map = record(projection.map); const ping = record(delta.ping); const features = Array.isArray(map.features) ? map.features : [];
    map.features = features.some((candidate) => record(candidate).id === ping.id) ? features : [...features, ping];
  } else if (delta.kind === 'journal.party') {
    const journal = record(projection.journal); const entry = record(delta.entry); const shared = Array.isArray(journal.shared) ? journal.shared : [];
    journal.shared = entry.sharedWithParty === true
      ? [...shared.filter((candidate) => record(candidate).id !== entry.id), entry]
      : shared.filter((candidate) => record(candidate).id !== entry.id);
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

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError !== null || authData.user === null) return json(401, { error: 'AUTH_REQUIRED' });
    const { data: member, error: memberError } = await service.from('campaign_members')
      .select('role,display_name,source_player_id').eq('campaign_id', body.campaignId).eq('user_id', authData.user.id)
      .is('revoked_at', null).maybeSingle();
    if (memberError !== null) return json(400, { error: memberError.message });
    if (member === null) return json(403, { error: 'CAMPAIGN_MEMBER_REQUIRED' });

    if (body.kind === 'dice.roll') {
      if (member.role !== 'player' && member.role !== 'owner-gm' && member.role !== 'co-gm') {
        return json(403, { error: 'DICE_ROLL_DENIED' });
      }
      const now = new Date().toISOString();
      const roll = createDiceRoll(body.payload, member.display_name ?? (member.role === 'player' ? 'PLAYER' : 'GM'), now);
      const { data: recorded, error: recordError } = await service.rpc('record_campaign_dice_roll', {
        p_campaign_id: body.campaignId,
        p_actor_user_id: authData.user.id,
        p_idempotency_key: body.idempotencyKey,
        p_payload: body.payload,
        p_expected_revision: Math.max(0, Math.round(body.expectedRevision)),
        p_roll: roll,
      });
      if (recordError !== null) {
        return json(recordError.code === '42501' ? 403 : recordError.code === '54000' ? 429 : 400, { error: recordError.message });
      }
      const result = record(recorded);
      return json(200, {
        command: result.command,
        diceRoll: result.diceRoll ?? roll,
      });
    }

    if (member.role === 'owner-gm' || member.role === 'co-gm') {
      return json(403, { error: 'GM_COMMAND_NOT_SUPPORTED' });
    }

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

    const partyVisible = body.kind === 'message.send' && body.payload.privateToGm !== true
      || body.kind === 'map.ping'
      || body.kind === 'journal.share'
      || body.kind === 'journal.create' && body.payload.sharedWithParty === true;
    const gmOnly = body.kind === 'message.send' && body.payload.privateToGm === true;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const slotQuery = service.from('campaign_player_slots')
        .select('source_player_id,assigned_user_id,revision,projection')
        .eq('campaign_id', body.campaignId);
      const { data: slotRows, error: slotError } = partyVisible
        ? await slotQuery
        : await slotQuery.eq('source_player_id', String(command.source_player_id));
      if (slotError !== null) return json(400, { error: slotError.message });
      const slots = (slotRows ?? []).map(record);
      const slot = slots.find((candidate) => candidate.source_player_id === command.source_player_id);
      if (slot === undefined) return json(409, { error: 'PLAYER_SLOT_UNAVAILABLE' });
      if (command.status === 'applied') return json(200, { command, projection: slot.projection });
      if (command.status === 'rejected') return json(409, { error: text(command.error_code, 80, 'COMMAND_REJECTED') });

      const now = new Date().toISOString();
      const projection = applyCommand(slot.projection, body.kind, body.payload, now);
      const updates: JsonRecord[] = [{
        sourcePlayerId: slot.source_player_id,
        expectedRevision: Number(slot.revision),
        projection,
      }];

      const delta = partyVisible ? partyDelta(projection, body.kind, body.payload) : null;
      if (delta !== null) {
        for (const partySlot of slots) {
          if (partySlot.source_player_id === slot.source_player_id) continue;
          updates.push({
            sourcePlayerId: partySlot.source_player_id,
            expectedRevision: Number(partySlot.revision),
            projection: applyPartyDelta(partySlot.projection, delta, now),
          });
        }
      }

      const { data: finalized, error: finalizeError } = await service.rpc('finalize_campaign_projection_command', {
        p_campaign_id: body.campaignId,
        p_command_id: command.id,
        p_updates: updates,
        p_audience: partyVisible ? 'party' : gmOnly ? 'gm' : 'player',
        p_audience_user_id: partyVisible || gmOnly ? null : command.user_id,
        p_event_payload: {},
      });
      if (finalizeError !== null) {
        return json(finalizeError.code === '40001' ? 409 : finalizeError.code === '42501' ? 403 : 400, { error: finalizeError.message });
      }
      const result = record(finalized);
      if (result.error === 'REVISION_CONFLICT' && attempt === 0) continue;
      if (typeof result.error === 'string') return json(result.error === 'REVISION_CONFLICT' ? 409 : 400, { error: result.error });
      return json(200, { command: result.command, projection: result.projection });
    }

    return json(409, { error: 'REVISION_CONFLICT' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'COMMAND_FAILED';
    return json(400, { error: message });
  }
});
