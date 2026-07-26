import type { RealtimeChannel, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { parsePlayerProjection, type PlayerProjection } from '../player/PlayerProjection';
import type { PlayerCommand } from '../player/PlayerCommands';
import type {
  CampaignAuthorityRecord, CampaignCommandRecord, CampaignMemberRecord, CampaignRole, CampaignRoomRecord,
  PlayerPortalLoginRecord, PlayerPortalResolution, PlayerSlotRecord, PresenceRecord,
} from './NetcodeTypes';
import { getSupabaseClient } from './SupabaseClient';

interface SupabaseErrorLike {
  readonly message?: unknown;
  readonly code?: unknown;
  readonly details?: unknown;
  readonly hint?: unknown;
  readonly status?: unknown;
  readonly statusCode?: unknown;
}

function textField(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberField(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function failure(error: SupabaseErrorLike | null, fallback: string): Error {
  if (error === null) return new Error(fallback);

  const message = textField(error.message) ?? fallback;
  const code = textField(error.code);
  const details = textField(error.details);
  const hint = textField(error.hint);
  const status = numberField(error.status) ?? numberField(error.statusCode);
  const parts = [
    code === null ? null : `[${code}]`,
    message,
    details === null ? null : `Details: ${details}`,
    hint === null ? null : `Hint: ${hint}`,
    status === null ? null : `HTTP ${status}`,
  ].filter((part): part is string => part !== null);

  return new Error(parts.join(' | '), { cause: error });
}

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(16).padStart(12, '0')}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;
}

export interface PlayerSubscriptionHandlers {
  readonly onProjection: (projection: PlayerProjection) => void;
  readonly onConnection: (state: 'online' | 'reconnecting' | 'offline' | 'error', detail: string) => void;
  readonly onPresence?: (records: readonly PresenceRecord[]) => void;
}

export interface GmSubscriptionHandlers {
  readonly onCommand: (command: CampaignCommandRecord) => void;
  readonly onSlot: (slot: PlayerSlotRecord) => void;
  readonly onPresence: (records: readonly PresenceRecord[]) => void;
  readonly onConnection: (state: 'online' | 'reconnecting' | 'offline' | 'error', detail: string) => void;
}

export interface AtomicPlayerSlot {
  readonly sourcePlayerId: string;
  readonly assignedCharacterId: string;
  readonly displayName: string;
  readonly projectionVersion: 1;
  readonly expectedRevision: number;
  readonly projection: PlayerProjection;
}

export class SupabaseGateway {
  public constructor(private readonly client: SupabaseClient = getSupabaseClient()) {}

  public async session(): Promise<Session | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error !== null) throw failure(error, 'Could not read the Supabase session.');
    return data.session;
  }

  public async user(): Promise<User | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error !== null) return null;
    return data.user;
  }

  public async signInWithPassword(email: string, password: string): Promise<Session> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error !== null || data.session === null) throw failure(error, 'Could not sign in with that email and password.');
    return data.session;
  }

  public async createPasswordAccount(email: string, password: string): Promise<Session> {
    const { data, error } = await this.client.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error !== null) throw failure(error, 'Could not create the GM account.');
    if (data.session === null) {
      throw new Error('GM account created, but Supabase email confirmation is still enabled. Disable Confirm email in Supabase Auth settings, then sign in with the password.');
    }
    return data.session;
  }

  public async signInOrCreatePlayerAccount(
    authEmail: string,
    password: string,
    displayName: string,
    captchaToken?: string,
  ): Promise<Session> {
    const signedIn = await this.client.auth.signInWithPassword({ email: authEmail, password });
    if (signedIn.error === null && signedIn.data.session !== null) return signedIn.data.session;

    const created = await this.client.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: { display_name: displayName.slice(0, 80), account_type: 'payaw-player' },
        ...(captchaToken === undefined ? {} : { captchaToken }),
      },
    });
    if (created.error !== null) throw failure(created.error, 'Could not sign in to the player portal.');
    if (created.data.session === null) {
      throw new Error('Player account created, but Supabase email confirmation is enabled. Disable Confirm email in Authentication settings, then try again.');
    }
    return created.data.session;
  }

  public async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error !== null) throw failure(error, 'Could not sign out.');
  }


  public async verifyPlayerPortalPassword(campaignId: string, password: string): Promise<void> {
    const { data, error } = await this.client.rpc('verify_player_portal_password', {
      p_campaign_id: campaignId,
      p_password: password,
    });
    if (error !== null || data !== true) throw failure(error, 'The current player password is incorrect.');
  }

  public async updateCurrentUserPassword(password: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password });
    if (error !== null) throw failure(error, 'Could not update the player authentication password.');
  }

  public async changePlayerPortalCredentials(
    campaignId: string,
    currentPassword: string,
    newLoginId: string,
    newPassword: string,
  ): Promise<string> {
    const { data, error } = await this.client.rpc('change_player_portal_credentials', {
      p_campaign_id: campaignId,
      p_current_password: currentPassword,
      p_new_login_id: newLoginId,
      p_new_password: newPassword.length === 0 ? null : newPassword,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error !== null || row === null || typeof row !== 'object') {
      throw failure(error, 'Could not update the player portal credentials.');
    }
    const value = row as { login_id?: unknown };
    if (typeof value.login_id !== 'string') throw new Error('The server did not return the updated player username.');
    return value.login_id;
  }

  public async createRoom(name: string, sourceCampaignId: string): Promise<string> {
    const { data, error } = await this.client.rpc('create_campaign_room', { p_name: name, p_source_campaign_id: sourceCampaignId });
    if (error !== null || typeof data !== 'string') throw failure(error, 'Could not create the campaign room.');
    return data;
  }

  public async rooms(): Promise<readonly CampaignRoomRecord[]> {
    const { data, error } = await this.client.from('campaign_rooms').select('*').order('updated_at', { ascending: false });
    if (error !== null) throw failure(error, 'Could not load campaign rooms.');
    return (data ?? []) as CampaignRoomRecord[];
  }

  public async room(campaignId: string): Promise<CampaignRoomRecord> {
    const { data, error } = await this.client.from('campaign_rooms').select('*').eq('id', campaignId).maybeSingle();
    if (error !== null) throw failure(error, 'Could not load the campaign room.');
    if (data === null) throw new Error('CAMPAIGN_ROOM_NOT_FOUND');
    return data as CampaignRoomRecord;
  }

  public async campaignAuthority(campaignId: string): Promise<CampaignAuthorityRecord> {
    const { data, error } = await this.client.from('campaign_authority').select('*').eq('campaign_id', campaignId).maybeSingle();
    if (error !== null) throw failure(error, 'Could not load the hosted campaign state.');
    if (data === null) throw new Error('CAMPAIGN_AUTHORITY_NOT_FOUND');
    if (typeof data.campaign_document !== 'object' || data.campaign_document === null || Array.isArray(data.campaign_document)) {
      throw new Error('The hosted campaign state is invalid.');
    }
    return data as CampaignAuthorityRecord;
  }

  public async roster(campaignId: string): Promise<readonly CampaignMemberRecord[]> {
    const { data, error } = await this.client.from('campaign_members').select('*').eq('campaign_id', campaignId).order('joined_at');
    if (error !== null) throw failure(error, 'Could not load the room roster.');
    return (data ?? []) as CampaignMemberRecord[];
  }

  public async slots(campaignId: string): Promise<readonly PlayerSlotRecord[]> {
    const { data, error } = await this.client.from('campaign_player_slots').select('*').eq('campaign_id', campaignId).order('source_player_id');
    if (error !== null) throw failure(error, 'Could not load player slots.');
    return (data ?? []).map((row) => ({ ...row, projection: parsePlayerProjection(row.projection) })) as PlayerSlotRecord[];
  }

  public async commands(campaignId: string): Promise<readonly CampaignCommandRecord[]> {
    const { data, error } = await this.client.from('campaign_commands').select('*').eq('campaign_id', campaignId)
      .order('created_at', { ascending: false }).limit(40);
    if (error !== null) throw failure(error, 'Could not load player commands.');
    return (data ?? []) as CampaignCommandRecord[];
  }

  public async publishAuthority(campaignId: string, revision: number, campaignDocument: Readonly<Record<string, unknown>>, userId: string): Promise<void> {
    const { error } = await this.client.from('campaign_authority').upsert({
      campaign_id: campaignId, revision: Math.max(0, Math.round(revision)), schema_version: 23,
      campaign_document: campaignDocument, updated_by: userId, updated_at: new Date().toISOString(),
    }, { onConflict: 'campaign_id' });
    if (error !== null) throw failure(error, 'Could not checkpoint the authoritative campaign state.');
  }

  public async publishCampaignSnapshot(
    campaignId: string,
    revision: number,
    authority: Readonly<Record<string, unknown>>,
    slots: readonly AtomicPlayerSlot[],
  ): Promise<number> {
    const { data, error } = await this.client.rpc('publish_campaign_snapshot', {
      p_campaign_id: campaignId,
      p_revision: Math.max(0, Math.round(revision)),
      p_authority: authority,
      p_slots: slots,
    });
    if (error !== null || typeof data !== 'number') throw failure(error, 'Could not publish the complete campaign snapshot.');
    return data;
  }

  public async revokeMember(campaignId: string, userId: string): Promise<void> {
    const { error } = await this.client.rpc('revoke_campaign_member', {
      p_campaign_id: campaignId,
      p_user_id: userId,
    });
    if (error !== null) throw failure(error, 'Could not revoke this player device.');
  }

  public async uploadPlayerAsset(campaignId: string, assetId: string, blob: Blob): Promise<string> {
    const extension = blob.type === 'image/jpeg' ? 'jpg'
      : blob.type === 'image/webp' ? 'webp'
        : blob.type === 'image/gif' ? 'gif'
          : blob.type === 'audio/mpeg' ? 'mp3'
            : blob.type === 'audio/ogg' ? 'ogg'
              : blob.type === 'application/pdf' ? 'pdf'
                : blob.type === 'text/plain' ? 'txt' : 'png';
    const safeAssetId = assetId.replace(/[^a-z0-9_-]/gi, '-').slice(0, 120);
    const path = `${campaignId}/${safeAssetId}.${extension}`;
    const { error } = await this.client.storage.from('payaw-player-assets').upload(path, blob, {
      upsert: true,
      contentType: blob.type,
      cacheControl: '3600',
    });
    if (error !== null) throw failure(error, 'Could not upload a player-safe handout.');
    const signed = await this.client.storage.from('payaw-player-assets').createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signed.error !== null || signed.data.signedUrl.length === 0) throw failure(signed.error, 'Could not create the secure handout link.');
    return signed.data.signedUrl;
  }

  public async playerPortalLogins(campaignId: string): Promise<readonly PlayerPortalLoginRecord[]> {
    const { data, error } = await this.client.rpc('list_player_portal_logins', { p_campaign_id: campaignId });
    if (error !== null) throw failure(error, 'Could not load player portal logins.');
    return (data ?? []) as PlayerPortalLoginRecord[];
  }

  public async configurePlayerPortal(campaignId: string, sourcePlayerId: string): Promise<{ readonly loginId: string; readonly password: string }> {
    const { data, error } = await this.client.rpc('configure_player_portal', {
      p_campaign_id: campaignId,
      p_source_player_id: sourcePlayerId,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error !== null || row === null || typeof row !== 'object') throw failure(error, 'Could not create the persistent player login.');
    const value = row as { login_id?: unknown; portal_password?: unknown };
    if (typeof value.login_id !== 'string' || typeof value.portal_password !== 'string') {
      throw new Error('The server did not return valid player portal credentials.');
    }
    return { loginId: value.login_id, password: value.portal_password };
  }

  public async disablePlayerPortal(campaignId: string, sourcePlayerId: string): Promise<void> {
    const { error } = await this.client.rpc('disable_player_portal', {
      p_campaign_id: campaignId,
      p_source_player_id: sourcePlayerId,
    });
    if (error !== null) throw failure(error, 'Could not disable this player login.');
  }

  public async resolvePlayerPortal(campaignId: string, loginId: string, password: string): Promise<PlayerPortalResolution> {
    const { data, error } = await this.client.rpc('resolve_player_portal_login', {
      p_campaign_id: campaignId,
      p_login_id: loginId,
      p_password: password,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error !== null || row === null || typeof row !== 'object') throw failure(error, 'The player login ID or password is incorrect.');
    const value = row as { auth_email?: unknown; campaign_id?: unknown; source_player_id?: unknown; display_name?: unknown };
    if (typeof value.auth_email !== 'string' || typeof value.campaign_id !== 'string'
      || typeof value.source_player_id !== 'string' || typeof value.display_name !== 'string') {
      throw new Error('The player portal response is incomplete.');
    }
    return {
      authEmail: value.auth_email,
      campaignId: value.campaign_id,
      sourcePlayerId: value.source_player_id,
      displayName: value.display_name,
    };
  }

  public async claimPlayerPortal(campaignId: string, loginId: string, password: string): Promise<{ readonly campaignId: string; readonly sourcePlayerId: string; readonly role: CampaignRole }> {
    const { data, error } = await this.client.rpc('claim_player_portal', {
      p_campaign_id: campaignId,
      p_login_id: loginId,
      p_password: password,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error !== null || row === null || typeof row !== 'object') throw failure(error, 'Could not open this player portal account.');
    const value = row as { campaign_id?: unknown; source_player_id?: unknown; role?: unknown };
    if (typeof value.campaign_id !== 'string' || typeof value.source_player_id !== 'string' || typeof value.role !== 'string') {
      throw new Error('The player portal did not resolve to a player slot.');
    }
    return { campaignId: value.campaign_id, sourcePlayerId: value.source_player_id, role: value.role as CampaignRole };
  }

  public async assignedSlot(campaignId: string, userId: string): Promise<PlayerSlotRecord> {
    const { data, error } = await this.client.from('campaign_player_slots').select('*')
      .eq('campaign_id', campaignId).eq('assigned_user_id', userId).maybeSingle();
    if (error !== null) throw failure(error, 'Could not verify this player portal session.');
    if (data === null) throw new Error('PLAYER_PORTAL_ACCESS_REVOKED');
    return { ...data, projection: parsePlayerProjection(data.projection) } as PlayerSlotRecord;
  }

  public async publishProjection(campaignId: string, sourcePlayerId: string, assignedCharacterId: string, displayName: string, projection: PlayerProjection): Promise<number> {
    const { data, error } = await this.client.rpc('publish_player_projection', {
      p_campaign_id: campaignId, p_source_player_id: sourcePlayerId, p_assigned_character_id: assignedCharacterId,
      p_display_name: displayName, p_projection_version: projection.projectionVersion,
      p_revision: projection.revision, p_projection: projection,
    });
    if (error !== null || typeof data !== 'number') throw failure(error, 'Could not publish the player projection.');
    return data;
  }

  public async prunePlayerSlots(campaignId: string, retainedSourcePlayerIds: readonly string[]): Promise<number> {
    const { data, error } = await this.client.rpc('prune_campaign_player_slots', {
      p_campaign_id: campaignId,
      p_keep_source_player_ids: [...retainedSourcePlayerIds],
    });
    if (error !== null || typeof data !== 'number') throw failure(error, 'Could not synchronize the hosted player slots.');
    return data;
  }

  public async submitCommand(campaignId: string, command: PlayerCommand, expectedRevision: number, offlineSafe: boolean, idempotencyKey = uuid()): Promise<{ readonly projection: PlayerProjection; readonly idempotencyKey: string }> {
    const { data, error } = await this.client.functions.invoke('campaign-command', { body: {
      campaignId, idempotencyKey, kind: command.kind, payload: command, expectedRevision, offlineSafe,
    } });
    if (error !== null) throw failure(error, 'The campaign command could not be processed.');
    if (data?.error !== undefined) throw new Error(String(data.error));
    return { projection: parsePlayerProjection(data.projection), idempotencyKey };
  }

  public async acknowledge(campaignId: string, projectionRevision: number, eventSequence = 0): Promise<void> {
    const { error } = await this.client.rpc('ack_campaign_state', {
      p_campaign_id: campaignId, p_revision: projectionRevision, p_event_sequence: eventSequence,
    });
    if (error !== null) throw failure(error, 'Could not acknowledge campaign state.');
  }

  private presenceRecords(channel: RealtimeChannel): PresenceRecord[] {
    return Object.values(channel.presenceState()).flatMap((items) => items.flatMap((item) => {
      if (typeof item !== 'object' || item === null) return [];
      const value = item as unknown as PresenceRecord;
      return typeof value.userId === 'string' && typeof value.displayName === 'string' ? [value] : [];
    }));
  }

  public async subscribePlayer(campaignId: string, userId: string, presence: PresenceRecord, handlers: PlayerSubscriptionHandlers): Promise<() => void> {
    const session = await this.session();
    if (session !== null) await this.client.realtime.setAuth(session.access_token);
    const channel = this.client.channel(`room:${campaignId}:live`, { config: { private: true, presence: { key: userId } } });
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign_player_slots', filter: `assigned_user_id=eq.${userId}` }, (event) => {
      try { handlers.onProjection(parsePlayerProjection((event.new as { projection?: unknown }).projection)); } catch { handlers.onConnection('error', 'A network projection failed validation.'); }
    });
    channel.on('presence', { event: 'sync' }, () => handlers.onPresence?.(this.presenceRecords(channel)));
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') { await channel.track(presence); handlers.onConnection('online', 'Live with the campaign room.'); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') handlers.onConnection('reconnecting', 'Connection interrupted; retrying safely.');
      else if (status === 'CLOSED') handlers.onConnection('offline', 'Campaign room connection closed.');
    });
    return () => { void channel.untrack(); void this.client.removeChannel(channel); };
  }

  public async subscribeGm(campaignId: string, userId: string, presence: PresenceRecord, handlers: GmSubscriptionHandlers): Promise<() => void> {
    const session = await this.session();
    if (session !== null) await this.client.realtime.setAuth(session.access_token);
    const channel = this.client.channel(`room:${campaignId}:live`, { config: { private: true, presence: { key: userId } } });
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_commands', filter: `campaign_id=eq.${campaignId}` }, (event) => handlers.onCommand(event.new as unknown as CampaignCommandRecord));
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign_player_slots', filter: `campaign_id=eq.${campaignId}` }, (event) => {
      const value = event.new as unknown as Omit<PlayerSlotRecord, 'projection'> & { projection: unknown };
      try { handlers.onSlot({ ...value, projection: parsePlayerProjection(value.projection) }); } catch { /* Never show an invalid projection. */ }
    });
    channel.on('presence', { event: 'sync' }, () => handlers.onPresence(this.presenceRecords(channel)));
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') { await channel.track(presence); handlers.onConnection('online', 'Room is live.'); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') handlers.onConnection('reconnecting', 'Realtime is reconnecting.');
      else if (status === 'CLOSED') handlers.onConnection('offline', 'Room connection closed.');
    });
    return () => { void channel.untrack(); void this.client.removeChannel(channel); };
  }
}
