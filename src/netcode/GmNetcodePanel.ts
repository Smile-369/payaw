import { createPlayerProjection, type PlayerProjectionContext } from '../player/ProjectionService';
import type { PlayerViewState } from '../player/PlayerViewState';
import { mergePlayerOwnedProjection } from './ProjectionMerge';
import { readNetcodeConfig } from './NetcodeConfig';
import { SupabaseGateway } from './SupabaseGateway';
import type { CampaignCommandRecord, CampaignMemberRecord, PlayerSlotRecord, PresenceRecord } from './NetcodeTypes';

export interface GmNetcodePanelOptions {
  readonly getContext: () => Omit<PlayerProjectionContext, 'playerView' | 'viewerId'>;
  readonly getState: () => PlayerViewState;
  readonly getAssetData?: (assetId: string) => { readonly dataUrl: string; readonly mimeType: string } | null;
  readonly notify: (message: string, kind?: 'success' | 'error') => void;
}

function element<T extends HTMLElement>(selector: string): T {
  const value = document.querySelector<T>(selector);
  if (value === null) throw new Error(`Required netcode control not found: ${selector}`);
  return value;
}

function option(value: string, label: string): HTMLOptionElement {
  const item = document.createElement('option');
  item.value = value;
  item.textContent = label;
  return item;
}

function cleanError(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

export class GmNetcodePanel {
  private readonly status = element<HTMLElement>('#netcode-status');
  private readonly statusDetail = element<HTMLElement>('#netcode-status-detail');
  private readonly email = element<HTMLInputElement>('#netcode-gm-email');
  private readonly signIn = element<HTMLButtonElement>('#netcode-sign-in');
  private readonly signOut = element<HTMLButtonElement>('#netcode-sign-out');
  private readonly roomName = element<HTMLElement>('#netcode-room-name');
  private readonly createRoomButton = element<HTMLButtonElement>('#netcode-create-room');
  private readonly publishAllButton = element<HTMLButtonElement>('#netcode-publish-all');
  private readonly invitePlayer = element<HTMLSelectElement>('#netcode-invite-player');
  private readonly createInviteButton = element<HTMLButtonElement>('#netcode-create-invite');
  private readonly copyInviteButton = element<HTMLButtonElement>('#netcode-copy-invite');
  private readonly inviteLink = element<HTMLInputElement>('#netcode-invite-link');
  private readonly rosterElement = element<HTMLElement>('#netcode-roster');
  private readonly commandsElement = element<HTMLElement>('#netcode-commands');
  private readonly config = readNetcodeConfig();
  private readonly gateway = this.config.enabled ? new SupabaseGateway() : null;
  private roomId: string | null = null;
  private userId: string | null = null;
  private roster: CampaignMemberRecord[] = [];
  private slots: PlayerSlotRecord[] = [];
  private commands: CampaignCommandRecord[] = [];
  private presence: PresenceRecord[] = [];
  private unsubscribeRealtime: (() => void) | null = null;
  private publishTimer: number | null = null;
  private publishRunning = false;
  private publishPending = false;
  private readonly uploadedAssetUrls = new Map<string, string>();

  public constructor(private readonly options: GmNetcodePanelOptions) {
    this.signIn.addEventListener('click', () => void this.sendMagicLink());
    this.signOut.addEventListener('click', () => void this.doSignOut());
    this.createRoomButton.addEventListener('click', () => void this.createOrLinkRoom());
    this.publishAllButton.addEventListener('click', () => void this.publishAll(true));
    this.createInviteButton.addEventListener('click', () => void this.createInvitation());
    this.copyInviteButton.addEventListener('click', () => void this.copyInvitation());
    document.addEventListener('payaw:player-slots-changed', () => {
      this.populatePlayers();
      this.renderRoster();
      this.schedulePublish();
    });
    document.addEventListener('payaw:campaign-state-changed', () => this.schedulePublish());
    document.addEventListener('payaw:player-state-changed', () => this.schedulePublish());
    document.addEventListener('payaw:project-state-changed', () => this.schedulePublish());
    this.populatePlayers();
    if (!this.config.enabled) {
      this.setStatus('LOCAL ONLY', 'Hosting is off. Add the Supabase public URL and publishable key in your deployment settings.');
      this.setEnabled(false);
      return;
    }
    void this.initialize();
  }

  private roomStorageKey(): string {
    return `payaw:netcode:room:${this.options.getContext().campaign.id}`;
  }

  private populatePlayers(): void {
    const state = this.options.getState();
    const players = state.players.filter((player) => player.active);
    this.invitePlayer.replaceChildren(...players.map((player) => {
      const character = state.characters.find((candidate) => candidate.id === player.characterId);
      return option(player.id, `${player.displayName} · ${character?.name ?? 'Character'}`);
    }));
    this.publishAllButton.textContent = `Sync ${players.length} player view${players.length === 1 ? '' : 's'} now`;
  }

  private roomSummary(): string {
    const players = this.options.getState().players.filter((player) => player.active);
    const playerIds = new Set(players.map((player) => player.id));
    const claimed = this.roster.filter((member) => member.revoked_at === null
      && member.source_player_id !== null && playerIds.has(member.source_player_id)).length;
    return `${claimed}/${players.length} player slot${players.length === 1 ? '' : 's'} claimed · ${this.presence.length} online`;
  }

  private setEnabled(enabled: boolean): void {
    for (const control of [
      this.email, this.signIn, this.signOut, this.createRoomButton, this.publishAllButton,
      this.invitePlayer, this.createInviteButton, this.copyInviteButton,
    ]) control.disabled = !enabled;
  }

  private setStatus(label: string, detail: string): void {
    this.status.textContent = label;
    this.statusDetail.textContent = detail;
    this.status.dataset.status = label.toLocaleLowerCase().replaceAll(' ', '-');
  }

  private async initialize(): Promise<void> {
    try {
      const session = await this.gateway?.session();
      if (session === undefined || session === null) {
        this.setStatus('SIGN IN REQUIRED', 'Use an email magic link for the GM account. Players use single-use invitations.');
        this.signOut.disabled = true;
        this.createRoomButton.disabled = true;
        this.publishAllButton.disabled = true;
        this.createInviteButton.disabled = true;
        return;
      }
      this.userId = session.user.id;
      this.email.value = session.user.email ?? '';
      this.signIn.disabled = true;
      this.signOut.disabled = false;
      this.createRoomButton.disabled = false;
      const stored = localStorage.getItem(this.roomStorageKey());
      const rooms = await this.gateway?.rooms() ?? [];
      const context = this.options.getContext();
      const room = rooms.find((candidate) => candidate.id === stored)
        ?? rooms.find((candidate) => candidate.source_campaign_id === context.campaign.id)
        ?? null;
      if (room === null) {
        this.setStatus('SIGNED IN', 'Create a private room. Future local changes will synchronize automatically.');
        return;
      }
      this.roomId = room.id;
      localStorage.setItem(this.roomStorageKey(), room.id);
      this.roomName.textContent = `${room.name} · ${room.id}`;
      await this.refreshRoom();
      await this.startRealtime();
      this.schedulePublish();
    } catch (error) { this.fail(error); }
  }

  private async sendMagicLink(): Promise<void> {
    if (this.gateway === null) return;
    try {
      if (!this.email.validity.valid || this.email.value.trim().length === 0) throw new Error('Enter the GM email address first.');
      await this.gateway.sendMagicLink(this.email.value, `${location.origin}${location.pathname}`);
      this.setStatus('CHECK EMAIL', 'Open the sign-in link on this device, then return to PAYAW.');
      this.options.notify('GM sign-in link sent.', 'success');
    } catch (error) { this.fail(error); }
  }

  private async doSignOut(): Promise<void> {
    try {
      await this.gateway?.signOut();
      this.unsubscribeRealtime?.();
      location.reload();
    } catch (error) { this.fail(error); }
  }

  private async createOrLinkRoom(): Promise<void> {
    if (this.gateway === null || this.userId === null) {
      this.fail(new Error('Sign in as the GM first.'));
      return;
    }
    try {
      const campaign = this.options.getContext().campaign;
      this.roomId = await this.gateway.createRoom(campaign.name, campaign.id);
      localStorage.setItem(this.roomStorageKey(), this.roomId);
      this.roomName.textContent = `${campaign.name} · ${this.roomId}`;
      await this.refreshRoom();
      await this.startRealtime();
      this.schedulePublish();
      this.options.notify('Private campaign room is ready and automatic sync is on.', 'success');
    } catch (error) { this.fail(error); }
  }

  private schedulePublish(): void {
    if (this.roomId === null || this.userId === null || this.gateway === null) return;
    this.publishPending = true;
    if (this.publishTimer !== null) window.clearTimeout(this.publishTimer);
    this.setStatus('SYNC PENDING', 'Local changes are saved. Updating every player view shortly.');
    this.publishTimer = window.setTimeout(() => {
      this.publishTimer = null;
      void this.publishAll(false);
    }, 650);
  }

  private async playerSafeContext(): Promise<Omit<PlayerProjectionContext, 'playerView' | 'viewerId'>> {
    const context = this.options.getContext();
    const assets = await Promise.all(context.campaign.assets.map(async (asset) => {
      if (!asset.uri.startsWith('payaw-asset:')) return asset;
      const assetId = asset.uri.slice('payaw-asset:'.length);
      const imported = this.options.getAssetData?.(assetId) ?? null;
      if (imported === null || this.gateway === null || this.roomId === null) return asset;
      const cached = this.uploadedAssetUrls.get(assetId);
      if (cached !== undefined) return { ...asset, uri: cached };
      const blob = await fetch(imported.dataUrl).then((response) => response.blob());
      const signedUrl = await this.gateway.uploadPlayerAsset(this.roomId, assetId, blob);
      this.uploadedAssetUrls.set(assetId, signedUrl);
      return { ...asset, uri: signedUrl };
    }));
    return { ...context, campaign: { ...context.campaign, assets } };
  }

  private async publishSnapshotWithRetry(): Promise<number> {
    if (this.gateway === null || this.roomId === null) throw new Error('Create or link the room first.');
    const state = this.options.getState();
    const context = await this.playerSafeContext();
    const authority = {
      schemaVersion: 23,
      campaign: this.options.getContext().campaign,
      playerView: state,
      checkpointedAt: new Date().toISOString(),
    };
    let existing = await this.gateway.slots(this.roomId);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const slots = state.players.filter((candidate) => candidate.active).map((player) => {
        const generated = createPlayerProjection({ ...context, playerView: state, viewerId: player.id });
        const hosted = existing.find((slot) => slot.source_player_id === player.id);
        return {
          sourcePlayerId: player.id,
          assignedCharacterId: player.characterId,
          displayName: player.displayName,
          projectionVersion: 1 as const,
          expectedRevision: hosted?.revision ?? -1,
          projection: mergePlayerOwnedProjection(generated, hosted?.projection ?? null),
        };
      });
      try {
        return await this.gateway.publishCampaignSnapshot(
          this.roomId,
          context.campaign.runState.revision,
          authority,
          slots,
        );
      } catch (error) {
        if (attempt === 1 || !cleanError(error).includes('SNAPSHOT_CONFLICT')) throw error;
        existing = await this.gateway.slots(this.roomId);
      }
    }
    throw new Error('The room changed during synchronization.');
  }

  private async publishAll(manual: boolean): Promise<void> {
    if (this.gateway === null || this.roomId === null || this.userId === null) {
      this.fail(new Error('Create or link the room first.'));
      return;
    }
    if (this.publishRunning) {
      this.publishPending = true;
      return;
    }
    this.publishRunning = true;
    this.publishPending = false;
    this.publishAllButton.disabled = true;
    this.setStatus('SYNCING', 'Publishing one atomic campaign snapshot.');
    try {
      const revision = await this.publishSnapshotWithRetry();
      await this.refreshRoom();
      this.setStatus('ROOM LIVE', `${this.roomSummary()} · revision ${revision}`);
      if (manual) this.options.notify('Campaign and every player view are synchronized.', 'success');
    } catch (error) {
      this.fail(error);
    } finally {
      this.publishRunning = false;
      this.publishAllButton.disabled = false;
      if (this.publishPending) this.schedulePublish();
    }
  }

  private async createInvitation(): Promise<void> {
    if (this.gateway === null || this.roomId === null) {
      this.fail(new Error('Create the room first.'));
      return;
    }
    try {
      const state = this.options.getState();
      const player = state.players.find((candidate) => candidate.id === this.invitePlayer.value);
      if (player === undefined) throw new Error('Choose a player slot.');
      if (!this.slots.some((slot) => slot.source_player_id === player.id)) await this.publishAll(false);
      const token = await this.gateway.createInvitation(this.roomId, 'player', player.id, player.characterId, 168);
      this.inviteLink.value = this.invitationUrl(token);
      this.options.notify(`Single-use invitation created for ${player.displayName}.`, 'success');
    } catch (error) { this.fail(error); }
  }

  private invitationUrl(token: string): string {
    if (this.roomId === null) return '';
    return `${location.origin}${location.pathname}?view=player&room=${encodeURIComponent(this.roomId)}&invite=${encodeURIComponent(token)}`;
  }

  private async copyInvitation(): Promise<void> {
    if (this.inviteLink.value.length === 0) {
      this.fail(new Error('Create an invitation first.'));
      return;
    }
    try {
      await navigator.clipboard.writeText(this.inviteLink.value);
      this.options.notify('Player invitation copied.', 'success');
    } catch {
      this.inviteLink.select();
      document.execCommand('copy');
      this.options.notify('Player invitation copied.', 'success');
    }
  }

  private async refreshRoom(): Promise<void> {
    if (this.gateway === null || this.roomId === null) return;
    [this.roster, this.slots, this.commands] = await Promise.all([
      this.gateway.roster(this.roomId).then((items) => [...items]),
      this.gateway.slots(this.roomId).then((items) => [...items]),
      this.gateway.commands(this.roomId).then((items) => [...items]),
    ]);
    this.publishAllButton.disabled = false;
    this.createInviteButton.disabled = false;
    this.populatePlayers();
    this.renderRoster();
    this.renderCommands();
    this.setStatus('ROOM READY', this.roomSummary());
  }

  private async startRealtime(): Promise<void> {
    if (this.gateway === null || this.roomId === null || this.userId === null || this.unsubscribeRealtime !== null) return;
    const ownMembership = this.roster.find((member) => member.user_id === this.userId);
    const presence: PresenceRecord = {
      userId: this.userId,
      displayName: ownMembership?.display_name ?? 'Game Master',
      role: ownMembership?.role ?? 'owner-gm',
      sourcePlayerId: null,
      view: 'gm',
      state: 'online',
      onlineAt: new Date().toISOString(),
    };
    this.unsubscribeRealtime = await this.gateway.subscribeGm(this.roomId, this.userId, presence, {
      onCommand: (command) => {
        this.commands = [command, ...this.commands.filter((item) => item.id !== command.id)].slice(0, 40);
        this.renderCommands();
      },
      onSlot: (slot) => {
        this.slots = [slot, ...this.slots.filter((item) => item.source_player_id !== slot.source_player_id)];
        this.renderRoster();
      },
      onPresence: (records) => {
        this.presence = [...records];
        this.renderRoster();
        this.setStatus('ROOM LIVE', this.roomSummary());
      },
      onConnection: (state, detail) => this.setStatus(state === 'online' ? 'ROOM LIVE' : state.toLocaleUpperCase(), detail),
    });
  }

  private renderRoster(): void {
    this.rosterElement.replaceChildren();
    const online = new Set(this.presence.map((item) => item.userId));
    const state = this.options.getState();
    for (const player of state.players.filter((item) => item.active)) {
      const slot = this.slots.find((item) => item.source_player_id === player.id);
      const member = this.roster.find((item) => item.source_player_id === player.id && item.revoked_at === null);
      const row = document.createElement('article');
      const copy = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = player.displayName;
      const detail = document.createElement('small');
      detail.textContent = member === undefined
        ? 'Invite not claimed'
        : `player · ${online.has(member.user_id) ? 'online' : 'offline'} · revision ${slot?.revision ?? 0}`;
      copy.append(title, detail);
      const actions = document.createElement('span');
      actions.className = 'netcode-roster-actions';
      const badge = document.createElement('small');
      badge.textContent = member === undefined ? 'OPEN' : online.has(member.user_id) ? 'LIVE' : 'JOINED';
      actions.append(badge);
      if (member !== undefined) {
        const replace = document.createElement('button');
        replace.type = 'button';
        replace.textContent = 'Replace device';
        replace.addEventListener('click', () => void this.replacePlayerDevice(player.id, member));
        const revoke = document.createElement('button');
        revoke.type = 'button';
        revoke.textContent = 'Revoke';
        revoke.addEventListener('click', () => void this.revokePlayer(member));
        actions.append(replace, revoke);
      }
      row.append(copy, actions);
      this.rosterElement.append(row);
    }
  }

  private async revokePlayer(member: CampaignMemberRecord): Promise<void> {
    if (this.gateway === null || this.roomId === null) return;
    if (!window.confirm(`Revoke ${member.display_name}'s current browser access?`)) return;
    try {
      await this.gateway.revokeMember(this.roomId, member.user_id);
      await this.refreshRoom();
      this.options.notify('Player browser access revoked.', 'success');
    } catch (error) { this.fail(error); }
  }

  private async replacePlayerDevice(sourcePlayerId: string, member: CampaignMemberRecord): Promise<void> {
    if (this.gateway === null || this.roomId === null) return;
    if (!window.confirm(`Replace ${member.display_name}'s current browser? Their old link will stop working.`)) return;
    try {
      await this.gateway.revokeMember(this.roomId, member.user_id);
      await this.refreshRoom();
      const player = this.options.getState().players.find((candidate) => candidate.id === sourcePlayerId);
      if (player === undefined) throw new Error('The player slot no longer exists.');
      const token = await this.gateway.createInvitation(this.roomId, 'player', player.id, player.characterId, 168);
      this.invitePlayer.value = player.id;
      this.inviteLink.value = this.invitationUrl(token);
      this.options.notify(`Fresh device link created for ${player.displayName}.`, 'success');
    } catch (error) { this.fail(error); }
  }

  private renderCommands(): void {
    this.commandsElement.replaceChildren();
    if (this.commands.length === 0) {
      this.commandsElement.append(document.createTextNode('No player actions received.'));
      return;
    }
    for (const command of this.commands.slice(0, 12)) {
      const row = document.createElement('article');
      const copy = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = command.kind;
      const detail = document.createElement('small');
      detail.textContent = `${command.source_player_id} · ${new Date(command.created_at).toLocaleTimeString()}`;
      copy.append(title, detail);
      const status = document.createElement('small');
      status.textContent = command.status.toLocaleUpperCase();
      row.append(copy, status);
      this.commandsElement.append(row);
    }
  }

  private fail(error: unknown): void {
    const message = cleanError(error);
    this.setStatus('ERROR', message);
    this.options.notify(message, 'error');
  }
}
