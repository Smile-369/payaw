import { createPlayerProjection, type PlayerProjectionContext } from '../player/ProjectionService';
import type { PlayerViewState } from '../player/PlayerViewState';
import { mergePlayerOwnedProjection } from './ProjectionMerge';
import { readNetcodeConfig } from './NetcodeConfig';
import { SupabaseGateway } from './SupabaseGateway';
import type { CampaignCommandRecord, CampaignMemberRecord, PlayerPortalLoginRecord, PlayerSlotRecord, PresenceRecord } from './NetcodeTypes';
import { parseSharedDiceRoll, showDiceRollBanner } from './DiceRollBanner';

export interface GmNetcodePanelOptions {
  readonly getContext: () => Omit<PlayerProjectionContext, 'playerView' | 'viewerId'>;
  readonly getState: () => PlayerViewState;
  readonly getAuthorityDocument: () => Readonly<Record<string, unknown>>;
  readonly loadAuthorityDocument: (document: Readonly<Record<string, unknown>>) => Promise<void>;
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

function isSchemaCacheError(value: unknown): boolean {
  const message = cleanError(value).toLocaleLowerCase();
  return message.includes('schema cache')
    || message.includes('pgrst202')
    || message.includes('could not find the function');
}

export class GmNetcodePanel {
  private readonly status = element<HTMLElement>('#netcode-status');
  private readonly statusDetail = element<HTMLElement>('#netcode-status-detail');
  private readonly email = element<HTMLInputElement>('#netcode-gm-email');
  private readonly password = element<HTMLInputElement>('#netcode-gm-password');
  private readonly signIn = element<HTMLButtonElement>('#netcode-sign-in');
  private readonly createAccount = element<HTMLButtonElement>('#netcode-create-account');
  private readonly signOut = element<HTMLButtonElement>('#netcode-sign-out');
  private readonly roomName = element<HTMLElement>('#netcode-room-name');
  private readonly campaignIdInput = element<HTMLInputElement>('#netcode-campaign-id');
  private readonly loadCampaignButton = element<HTMLButtonElement>('#netcode-load-campaign');
  private readonly createRoomButton = element<HTMLButtonElement>('#netcode-create-room');
  private readonly publishAllButton = element<HTMLButtonElement>('#netcode-publish-all');
  private readonly portalPlayer = element<HTMLSelectElement>('#netcode-portal-player');
  private readonly createPlayerLoginButton = element<HTMLButtonElement>('#netcode-create-player-login');
  private readonly copyPlayerLoginButton = element<HTMLButtonElement>('#netcode-copy-player-login');
  private readonly playerPortalUrl = element<HTMLInputElement>('#netcode-player-portal-url');
  private readonly playerLoginId = element<HTMLInputElement>('#netcode-player-login-id');
  private readonly playerLoginPassword = element<HTMLInputElement>('#netcode-player-login-password');
  private readonly rosterElement = element<HTMLElement>('#netcode-roster');
  private readonly commandsElement = element<HTMLElement>('#netcode-commands');
  private readonly config = readNetcodeConfig();
  private readonly gateway = this.config.enabled ? new SupabaseGateway() : null;
  private roomId: string | null = null;
  private userId: string | null = null;
  private roster: CampaignMemberRecord[] = [];
  private slots: PlayerSlotRecord[] = [];
  private portalLogins: PlayerPortalLoginRecord[] = [];
  private commands: CampaignCommandRecord[] = [];
  private presence: PresenceRecord[] = [];
  private unsubscribeRealtime: (() => void) | null = null;
  private publishTimer: number | null = null;
  private publishRunning = false;
  private publishPending = false;
  private loadingAuthority = false;
  private readonly uploadedAssetUrls = new Map<string, string>();
  private portalApiReady = true;
  private portalApiError: unknown = null;

  public constructor(private readonly options: GmNetcodePanelOptions) {
    this.signIn.addEventListener('click', () => void this.signInWithPassword());
    this.createAccount.addEventListener('click', () => void this.createPasswordAccount());
    this.password.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void this.signInWithPassword();
    });
    this.signOut.addEventListener('click', () => void this.doSignOut());
    this.loadCampaignButton.addEventListener('click', () => void this.loadCampaignById());
    this.campaignIdInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void this.loadCampaignById();
    });
    this.createRoomButton.addEventListener('click', () => void this.createOrLinkRoom());
    this.publishAllButton.addEventListener('click', () => void this.publishAll(true));
    this.createPlayerLoginButton.addEventListener('click', () => void this.createPlayerLogin());
    this.copyPlayerLoginButton.addEventListener('click', () => void this.copyPlayerLogin());
    this.portalPlayer.addEventListener('change', () => this.showSelectedPortalLogin());
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
    this.portalPlayer.replaceChildren(...players.map((player) => {
      const character = state.characters.find((candidate) => candidate.id === player.characterId);
      return option(player.id, `${player.displayName} · ${character?.name ?? 'Character'}`);
    }));
    this.publishAllButton.textContent = `Sync ${players.length} player view${players.length === 1 ? '' : 's'} now`;
    this.showSelectedPortalLogin();
  }

  private roomSummary(): string {
    const players = this.options.getState().players.filter((player) => player.active);
    const playerIds = new Set(players.map((player) => player.id));
    const configured = this.portalLogins.filter((login) => login.enabled && playerIds.has(login.source_player_id)).length;
    const joined = this.roster.filter((member) => member.revoked_at === null
      && member.source_player_id !== null && playerIds.has(member.source_player_id)).length;
    return `${configured}/${players.length} logins ready · ${joined} joined · ${this.presence.length} online`;
  }

  private setEnabled(enabled: boolean): void {
    for (const control of [
      this.email, this.password, this.signIn, this.createAccount, this.signOut, this.campaignIdInput, this.loadCampaignButton, this.createRoomButton, this.publishAllButton,
      this.portalPlayer, this.createPlayerLoginButton, this.copyPlayerLoginButton,
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
        this.setStatus('SIGN IN REQUIRED', 'Sign in with the GM email and password. Players use persistent portal logins.');
        this.signOut.disabled = true;
        this.campaignIdInput.disabled = true;
        this.loadCampaignButton.disabled = true;
        this.createRoomButton.disabled = true;
        this.publishAllButton.disabled = true;
        this.createPlayerLoginButton.disabled = true;
        return;
      }
      this.userId = session.user.id;
      this.email.value = session.user.email ?? '';
      this.email.disabled = true;
      this.password.value = '';
      this.password.disabled = true;
      this.signIn.disabled = true;
      this.createAccount.disabled = true;
      this.signOut.disabled = false;
      this.campaignIdInput.disabled = false;
      this.loadCampaignButton.disabled = false;
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
      this.campaignIdInput.value = room.id;
      this.roomName.textContent = `${room.name} · ${room.id}`;
      await this.refreshRoom();
      await this.startRealtime();
      this.setStatus('ROOM LINKED', 'Enter the Campaign ID and press Load campaign to restore the hosted state into the GM editor.');
    } catch (error) { this.fail(error); }
  }

  private validatePasswordCredentials(): { readonly email: string; readonly password: string } {
    const email = this.email.value.trim();
    const password = this.password.value;
    if (!this.email.validity.valid || email.length === 0) throw new Error('Enter a valid GM email address.');
    if (password.length < 8) throw new Error('Enter a password with at least 8 characters.');
    return { email, password };
  }

  private async signInWithPassword(): Promise<void> {
    if (this.gateway === null) return;
    try {
      const credentials = this.validatePasswordCredentials();
      this.signIn.disabled = true;
      this.createAccount.disabled = true;
      this.setStatus('SIGNING IN', 'Checking the GM email and password.');
      await this.gateway.signInWithPassword(credentials.email, credentials.password);
      this.options.notify('GM signed in.', 'success');
      location.reload();
    } catch (error) {
      this.signIn.disabled = false;
      this.createAccount.disabled = false;
      this.fail(error);
    }
  }

  private async createPasswordAccount(): Promise<void> {
    if (this.gateway === null) return;
    try {
      const credentials = this.validatePasswordCredentials();
      this.signIn.disabled = true;
      this.createAccount.disabled = true;
      this.setStatus('CREATING ACCOUNT', 'Creating the password-protected GM identity.');
      await this.gateway.createPasswordAccount(credentials.email, credentials.password);
      this.options.notify('GM account created and signed in.', 'success');
      location.reload();
    } catch (error) {
      this.signIn.disabled = false;
      this.createAccount.disabled = false;
      this.fail(error);
    }
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
    this.createRoomButton.disabled = true;
    this.setStatus('CREATING ROOM', 'Creating or reconnecting the hosted campaign room.');
    try {
      const campaign = this.options.getContext().campaign;
      const nextRoomId = await this.gateway.createRoom(campaign.name, campaign.id);
      if (this.roomId !== nextRoomId) {
        this.unsubscribeRealtime?.();
        this.unsubscribeRealtime = null;
      }
      this.roomId = nextRoomId;
      localStorage.setItem(this.roomStorageKey(), this.roomId);
      this.campaignIdInput.value = this.roomId;
      this.roomName.textContent = `${campaign.name} · ${this.roomId}`;
      await this.refreshRoom();
      await this.startRealtime();
      this.schedulePublish();
      this.options.notify('Private campaign room is ready and automatic sync is on.', 'success');
    } catch (error) {
      this.fail(error);
    } finally {
      this.createRoomButton.disabled = false;
    }
  }

  private async loadCampaignById(): Promise<void> {
    if (this.gateway === null || this.userId === null) {
      this.fail(new Error('Sign in as the GM first.'));
      return;
    }
    const campaignId = this.campaignIdInput.value.trim().toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId)) {
      this.fail(new Error('Enter a valid Campaign ID.'));
      return;
    }

    this.loadCampaignButton.disabled = true;
    this.loadingAuthority = true;
    this.setStatus('LOADING CAMPAIGN', `Pulling ${campaignId} from Supabase.`);
    try {
      const [room, authority] = await Promise.all([
        this.gateway.room(campaignId),
        this.gateway.campaignAuthority(campaignId),
      ]);
      await this.options.loadAuthorityDocument(authority.campaign_document);
      if (this.roomId !== campaignId) {
        this.unsubscribeRealtime?.();
        this.unsubscribeRealtime = null;
      }
      this.roomId = campaignId;
      localStorage.setItem(this.roomStorageKey(), campaignId);
      this.campaignIdInput.value = campaignId;
      this.roomName.textContent = `${room.name} · ${campaignId}`;
      await this.refreshRoom();
      await this.startRealtime();
      this.setStatus('CAMPAIGN LOADED', `${room.name} · revision ${authority.revision}`);
      this.options.notify('Hosted campaign state loaded from Supabase.', 'success');
    } catch (error) {
      this.fail(error);
    } finally {
      this.loadingAuthority = false;
      this.loadCampaignButton.disabled = false;
    }
  }

  private schedulePublish(): void {
    if (this.loadingAuthority || this.roomId === null || this.userId === null || this.gateway === null) return;
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
    const authority = this.options.getAuthorityDocument();
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

  private async publishAll(manual: boolean): Promise<boolean> {
    if (this.gateway === null || this.roomId === null || this.userId === null) {
      this.fail(new Error('Create or link the room first.'));
      return false;
    }
    if (this.publishRunning) {
      this.publishPending = true;
      return false;
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
      return true;
    } catch (error) {
      this.fail(error);
      return false;
    } finally {
      this.publishRunning = false;
      this.publishAllButton.disabled = false;
      if (this.publishPending) this.schedulePublish();
    }
  }

  private portalUrl(): string {
    return `${location.origin}${location.pathname}?view=player`;
  }

  private showSelectedPortalLogin(): void {
    this.playerPortalUrl.value = this.portalUrl();
    const existing = this.portalLogins.find((item) => item.source_player_id === this.portalPlayer.value && item.enabled);
    this.playerLoginId.value = existing?.login_id ?? '';
    this.playerLoginPassword.value = '';
    this.copyPlayerLoginButton.disabled = true;
  }

  private async createPlayerLogin(): Promise<void> {
    if (this.gateway === null || this.roomId === null) {
      this.fail(new Error('Create the room first.'));
      return;
    }
    if (!this.portalApiReady) {
      this.fail(this.portalApiError);
      return;
    }
    try {
      const state = this.options.getState();
      const player = state.players.find((candidate) => candidate.id === this.portalPlayer.value);
      if (player === undefined) throw new Error('Choose a player slot.');
      if (!this.slots.some((slot) => slot.source_player_id === player.id)) {
        const published = await this.publishAll(false);
        if (!published) throw new Error('The player slot could not be synchronized, so no login was created.');
        await this.refreshRoom();
      }
      if (!this.slots.some((slot) => slot.source_player_id === player.id)) {
        throw new Error('The player slot is still missing after synchronization.');
      }
      const credentials = await this.gateway.configurePlayerPortal(this.roomId, player.id);
      this.playerPortalUrl.value = this.portalUrl();
      this.playerLoginId.value = credentials.loginId;
      this.playerLoginPassword.value = credentials.password;
      await this.refreshRoom();
      this.portalPlayer.value = player.id;
      this.playerLoginId.value = credentials.loginId;
      this.playerLoginPassword.value = credentials.password;
      this.copyPlayerLoginButton.disabled = false;
      this.options.notify(`Persistent player login created for ${player.displayName}.`, 'success');
    } catch (error) { this.fail(error); }
  }

  private async copyPlayerLogin(): Promise<void> {
    const loginId = this.playerLoginId.value.trim();
    const password = this.playerLoginPassword.value.trim();
    if (loginId.length === 0) {
      this.fail(new Error('Create or select a player login first.'));
      return;
    }
    if (password.length === 0) {
      this.fail(new Error('The password is only shown when credentials are created or reset. Reset this player login to generate a new password.'));
      return;
    }
    if (this.roomId === null) {
      this.fail(new Error('Create or load the campaign room first.'));
      return;
    }
    const text = `PAYAW Player Portal\n${this.portalUrl()}\nCampaign ID: ${this.roomId}\nUsername: ${loginId}\nPassword: ${password}`;
    try {
      await navigator.clipboard.writeText(text);
      this.options.notify('Player portal credentials copied.', 'success');
    } catch {
      this.playerLoginPassword.select();
      document.execCommand('copy');
      this.options.notify('Password copied. Copy the portal URL and login ID separately.', 'success');
    }
  }

  private async refreshRoom(): Promise<void> {
    if (this.gateway === null || this.roomId === null) return;
    [this.roster, this.slots, this.commands] = await Promise.all([
      this.gateway.roster(this.roomId).then((items) => [...items]),
      this.gateway.slots(this.roomId).then((items) => [...items]),
      this.gateway.commands(this.roomId).then((items) => [...items]),
    ]);

    try {
      this.portalLogins = [...await this.gateway.playerPortalLogins(this.roomId)];
      this.portalApiReady = true;
      this.portalApiError = null;
    } catch (error) {
      if (!isSchemaCacheError(error)) throw error;
      this.portalLogins = [];
      this.portalApiReady = false;
      this.portalApiError = error;
    }

    this.publishAllButton.disabled = false;
    this.createPlayerLoginButton.disabled = !this.portalApiReady;
    this.populatePlayers();
    this.renderRoster();
    this.renderCommands();
    this.setStatus(
      'ROOM READY',
      this.portalApiReady
        ? this.roomSummary()
        : `${this.roomSummary()} · ${cleanError(this.portalApiError)}`,
    );
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
        this.announceDiceRoll(command);
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
      onEvent: (event) => {
        if (event.event_type !== 'command.dice.roll') return;
        const roll = parseSharedDiceRoll(event.safe_payload.diceRoll);
        if (roll !== null) showDiceRollBanner(roll);
      },
    });
  }

  private renderRoster(): void {
    this.rosterElement.replaceChildren();
    const online = new Set(this.presence.map((item) => item.userId));
    const state = this.options.getState();
    for (const player of state.players.filter((item) => item.active)) {
      const slot = this.slots.find((item) => item.source_player_id === player.id);
      const member = this.roster.find((item) => item.source_player_id === player.id && item.revoked_at === null);
      const portalLogin = this.portalLogins.find((item) => item.source_player_id === player.id && item.enabled);
      const row = document.createElement('article');
      const copy = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = player.displayName;
      const detail = document.createElement('small');
      detail.textContent = portalLogin === undefined
        ? 'Player portal login not configured'
        : member === undefined
          ? `Login ${portalLogin.login_id} · not signed in yet · revision ${slot?.revision ?? 0}`
          : `Login ${portalLogin.login_id} · ${online.has(member.user_id) ? 'online' : 'offline'} · revision ${slot?.revision ?? 0}`;
      copy.append(title, detail);
      const actions = document.createElement('span');
      actions.className = 'netcode-roster-actions';
      const badge = document.createElement('small');
      badge.textContent = portalLogin === undefined ? 'NO LOGIN' : member === undefined ? 'READY' : online.has(member.user_id) ? 'LIVE' : 'JOINED';
      actions.append(badge);
      if (portalLogin !== undefined) {
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.textContent = 'Reset login';
        reset.addEventListener('click', () => {
          this.portalPlayer.value = player.id;
          void this.createPlayerLogin();
        });
        const disable = document.createElement('button');
        disable.type = 'button';
        disable.textContent = 'Disable';
        disable.addEventListener('click', () => void this.disablePlayerLogin(player.id, player.displayName));
        actions.append(reset, disable);
      } else {
        const configure = document.createElement('button');
        configure.type = 'button';
        configure.textContent = 'Create login';
        configure.addEventListener('click', () => {
          this.portalPlayer.value = player.id;
          void this.createPlayerLogin();
        });
        actions.append(configure);
      }
      row.append(copy, actions);
      this.rosterElement.append(row);
    }
  }

  private async disablePlayerLogin(sourcePlayerId: string, displayName: string): Promise<void> {
    if (this.gateway === null || this.roomId === null) return;
    if (!window.confirm(`Disable ${displayName}'s player portal login? Their current session will lose access.`)) return;
    try {
      await this.gateway.disablePlayerPortal(this.roomId, sourcePlayerId);
      await this.refreshRoom();
      this.options.notify('Player portal login disabled.', 'success');
    } catch (error) { this.fail(error); }
  }


  private announceDiceRoll(command: CampaignCommandRecord): void {
    if (command.kind !== 'dice.roll' || command.status !== 'applied' || command.result === null) return;
    const roll = parseSharedDiceRoll(command.result.diceRoll);
    if (roll !== null) showDiceRollBanner(roll);
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
      const diceRoll = command.kind === 'dice.roll' && command.result !== null
        ? parseSharedDiceRoll(command.result.diceRoll)
        : null;
      title.textContent = diceRoll === null ? command.kind : `${diceRoll.rollerUsername} rolled ${diceRoll.total}`;
      const detail = document.createElement('small');
      detail.textContent = diceRoll === null
        ? `${command.source_player_id} · ${new Date(command.created_at).toLocaleTimeString()}`
        : `${diceRoll.notation} · ${new Date(command.created_at).toLocaleTimeString()}`;
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
