import { collectCampaignLocations } from '../campaign/NPCLocationAuthoring';
import {
  ALL_PLAYER_CAPABILITIES,
  createKnowledgeGrant,
  revokeKnowledgeGrant,
  resizePlayerViewState,
  setPlayerCapabilities,
  updatePlayerIdentity,
  upsertKnowledgeGrant,
  type Capability,
  type KnowledgeSubjectType,
  type PlayerAudience,
  type PlayerViewState,
} from './PlayerViewState';
import {
  PLAYER_PROJECTION_LATEST_KEY,
  PLAYER_PROJECTION_STORAGE_PREFIX,
  type PlayerProjection,
} from './PlayerProjection';
import { createPlayerProjection, type PlayerProjectionContext } from './ProjectionService';

interface Candidate {
  readonly id: string;
  readonly label: string;
}

export interface GmPlayerPreviewOptions {
  readonly getContext: () => Omit<PlayerProjectionContext, 'playerView' | 'viewerId'>;
  readonly getState: () => PlayerViewState;
  readonly setState: (state: PlayerViewState) => void;
  readonly notify: (message: string, kind?: 'success' | 'error') => void;
}

const FORBIDDEN_PROJECTION_KEYS = new Set([
  'gmDescription', 'gmTitle', 'gmIntent', 'gmNotes', 'secret', 'fear', 'wish',
  'weeklySchedule', 'schedule', 'trigger', 'triggerConfig', 'actions',
  'dependencyIds', 'rightsNote', 'checksum', 'hidden', 'hiddenNotes',
]);

function element<T extends HTMLElement>(selector: string): T {
  const value = document.querySelector<T>(selector);
  if (value === null) throw new Error(`Required Player View control not found: ${selector}`);
  return value;
}

function option(value: string, label: string): HTMLOptionElement {
  const item = document.createElement('option');
  item.value = value;
  item.textContent = label;
  return item;
}

function safeFilename(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'campaign';
}

function structuralSafetyErrors(value: unknown, path = 'projection'): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => structuralSafetyErrors(item, `${path}[${index}]`));
  if (typeof value !== 'object' || value === null) return [];
  const errors: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PROJECTION_KEYS.has(key)) errors.push(`${path}.${key}`);
    errors.push(...structuralSafetyErrors(child, `${path}.${key}`));
  }
  return errors;
}

function labelForCapability(capability: Capability): string {
  return capability.replaceAll('.', ' ').replaceAll('self', 'own character').replaceAll('party', 'party');
}

export class GmPlayerPreview {
  private readonly viewer = element<HTMLSelectElement>('#player-preview-viewer');
  private readonly slotCount = element<HTMLInputElement>('#player-slot-count');
  private readonly applySlotCount = element<HTMLButtonElement>('#player-slot-count-apply');
  private readonly displayName = element<HTMLInputElement>('#player-preview-display-name');
  private readonly characterName = element<HTMLInputElement>('#player-preview-character-name');
  private readonly saveIdentity = element<HTMLButtonElement>('#player-preview-save-identity');
  private readonly capabilityGrid = element<HTMLElement>('#player-capability-grid');
  private readonly saveCapabilities = element<HTMLButtonElement>('#player-preview-save-capabilities');
  private readonly grantType = element<HTMLSelectElement>('#player-grant-type');
  private readonly grantEntitySearch = element<HTMLInputElement>('#player-grant-entity-search');
  private readonly grantEntity = element<HTMLSelectElement>('#player-grant-entity');
  private readonly grantLevel = element<HTMLSelectElement>('#player-grant-level');
  private readonly grantAudience = element<HTMLSelectElement>('#player-grant-audience');
  private readonly grantAlias = element<HTMLInputElement>('#player-grant-alias');
  private readonly grantSource = element<HTMLInputElement>('#player-grant-source');
  private readonly saveGrant = element<HTMLButtonElement>('#player-grant-save');
  private readonly grantList = element<HTMLElement>('#player-grant-list');
  private readonly summary = element<HTMLElement>('#player-projection-summary');
  private readonly safety = element<HTMLElement>('#player-projection-safety');
  private readonly openPreview = element<HTMLButtonElement>('#player-preview-open');
  private readonly refreshPreview = element<HTMLButtonElement>('#player-preview-refresh');
  private readonly downloadProjection = element<HTMLButtonElement>('#player-preview-download');

  public constructor(private readonly options: GmPlayerPreviewOptions) {
    this.viewer.addEventListener('change', () => this.refresh());
    this.applySlotCount.addEventListener('click', () => this.resizePlayerTable());
    this.grantType.addEventListener('change', () => this.renderCandidates());
    this.grantEntitySearch.addEventListener('input', () => this.renderCandidates());
    this.saveIdentity.addEventListener('click', () => this.updateIdentity());
    this.saveCapabilities.addEventListener('click', () => this.updateCapabilities());
    this.saveGrant.addEventListener('click', () => this.addGrant());
    this.openPreview.addEventListener('click', () => this.publish(true));
    this.refreshPreview.addEventListener('click', () => this.publish(false));
    this.downloadProjection.addEventListener('click', () => this.download());
    this.grantList.addEventListener('click', (event) => this.handleGrantAction(event));
    this.renderCapabilities();
    this.refresh();
  }

  public refresh(): void {
    const state = this.options.getState();
    this.slotCount.value = String(state.players.length);
    const selected = state.players.some((player) => player.id === this.viewer.value)
      ? this.viewer.value
      : state.players.find((player) => player.active)?.id ?? state.players[0]?.id ?? '';
    this.viewer.replaceChildren(...state.players.filter((player) => player.active).map((player) => option(player.id, `${player.displayName} · ${state.characters.find((character) => character.id === player.characterId)?.name ?? 'Character'}`)));
    this.viewer.value = selected;
    const player = state.players.find((candidate) => candidate.id === selected);
    const character = state.characters.find((candidate) => candidate.ownerPlayerId === selected);
    this.displayName.value = player?.displayName ?? '';
    this.characterName.value = character?.name ?? '';
    this.grantAudience.replaceChildren(option('party', 'Whole party'), option(`player:${selected}`, player === undefined ? 'Selected player' : player.displayName));
    this.renderCapabilities();
    this.renderCandidates();
    this.renderGrants();
    this.renderProjectionSummary();
  }

  private selectedPlayerId(): string {
    const playerId = this.viewer.value;
    if (!this.options.getState().players.some((player) => player.id === playerId)) throw new Error('Select an active player first.');
    return playerId;
  }

  private context(): PlayerProjectionContext {
    return { ...this.options.getContext(), playerView: this.options.getState(), viewerId: this.selectedPlayerId() };
  }

  private projection(includeRenderedMap = false): PlayerProjection {
    const context = this.context();
    if (includeRenderedMap) return createPlayerProjection(context);
    const { renderPublicMapImage: omittedMapRenderer, ...contextWithoutMapRenderer } = context;
    void omittedMapRenderer;
    return createPlayerProjection(contextWithoutMapRenderer);
  }

  private commit(state: PlayerViewState, message: string): void {
    this.options.setState(state);
    this.options.notify(message, 'success');
    this.refresh();
  }

  private updateIdentity(): void {
    const state = updatePlayerIdentity(this.options.getState(), this.selectedPlayerId(), this.displayName.value, this.characterName.value);
    this.commit(state, 'Player identity saved.');
  }

  private resizePlayerTable(): void {
    const state = this.options.getState();
    const requested = Math.max(1, Math.min(32, Math.round(Number(this.slotCount.value) || state.players.length)));
    if (requested === state.players.length) {
      this.options.notify(`The table already has ${requested} player slot${requested === 1 ? '' : 's'}.`, 'success');
      return;
    }
    if (requested < state.players.length && !globalThis.confirm(
      `Reduce the table from ${state.players.length} to ${requested} players? Removed profiles, private grants, and journals will leave this project; publishing will also remove those hosted slots.`,
    )) {
      this.slotCount.value = String(state.players.length);
      return;
    }
    this.commit(
      resizePlayerViewState(state, requested),
      `Player table resized to ${requested} slot${requested === 1 ? '' : 's'}.`,
    );
    document.dispatchEvent(new CustomEvent('payaw:player-slots-changed', { detail: { playerCount: requested } }));
  }

  private renderCapabilities(): void {
    const state = this.options.getState();
    const enabled = new Set(state.capabilitiesByPlayer[this.viewer.value] ?? []);
    this.capabilityGrid.replaceChildren();
    for (const capability of ALL_PLAYER_CAPABILITIES) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = capability;
      input.checked = enabled.has(capability);
      input.dataset.playerCapability = capability;
      label.append(input, document.createTextNode(labelForCapability(capability)));
      this.capabilityGrid.append(label);
    }
  }

  private updateCapabilities(): void {
    const capabilities = [...this.capabilityGrid.querySelectorAll<HTMLInputElement>('input[data-player-capability]:checked')].map((input) => input.value as Capability);
    this.commit(setPlayerCapabilities(this.options.getState(), this.selectedPlayerId(), capabilities), 'Player permissions saved.');
  }

  private candidates(type = this.grantType.value as KnowledgeSubjectType): Candidate[] {
    const context = this.options.getContext();
    if (type === 'location') {
      const candidates = new Map<string, Candidate>();
      for (const story of context.world.storyObjects) {
        const id = `story:${story.key}`;
        candidates.set(id, { id, label: `${story.name} · story location` });
      }
      const campaignLocations = new Map(collectCampaignLocations(context.world, context.authoringLayer).map((item) => [item.ref, item]));
      for (const location of context.npcLocationAuthoring.locations) {
        if (location.visibility === 'players') continue;
        const source = campaignLocations.get(location.sourceRef);
        candidates.set(location.sourceRef, {
          id: location.sourceRef,
          label: `${location.name || source?.label || 'Campaign location'} · story location`,
        });
      }
      return [...candidates.values()].sort((left, right) => left.label.localeCompare(right.label));
    }
    if (type === 'npc') return context.world.npcs.map((npc) => ({ id: npc.key, label: npc.name }));
    if (type === 'scene') return context.campaign.scenes.map((item) => ({ id: item.id, label: item.name }));
    if (type === 'clue') return context.campaign.clues.map((item) => ({ id: item.id, label: item.playerTitle || item.gmTitle || 'Untitled clue' }));
    if (type === 'handout') return context.campaign.handouts.map((item) => ({ id: item.id, label: item.title }));
    if (type === 'objective') return context.campaign.objectives.map((item) => ({ id: item.id, label: item.playerWording || item.gmIntent || 'Untitled objective' }));
    return context.campaign.messageThreads.map((item) => ({ id: item.id, label: item.name }));
  }

  private renderCandidates(): void {
    const selected = this.grantEntity.value;
    const query = this.grantEntitySearch.value.trim().toLocaleLowerCase();
    const items = this.candidates().filter((item) => query.length === 0 || item.label.toLocaleLowerCase().includes(query));
    this.grantEntity.replaceChildren(...(items.length === 0 ? [option('', 'No matching campaign records')] : items.map((item) => option(item.id, item.label))));
    if (items.some((item) => item.id === selected)) this.grantEntity.value = selected;
    this.saveGrant.disabled = this.grantEntity.value.length === 0;
  }

  private addGrant(): void {
    if (this.grantEntity.value.length === 0) return;
    const state = upsertKnowledgeGrant(this.options.getState(), createKnowledgeGrant({
      subjectType: this.grantType.value as KnowledgeSubjectType,
      subjectId: this.grantEntity.value,
      audience: this.grantAudience.value as PlayerAudience,
      level: this.grantLevel.value as 'rumored' | 'discovered' | 'visited' | 'investigated',
      alias: this.grantAlias.value.trim() || null,
      source: this.grantSource.value.trim() || 'GM reveal',
      expiresAt: null,
    }));
    this.grantAlias.value = '';
    this.commit(state, 'Knowledge grant published to the preview.');
  }

  private renderGrants(): void {
    const selectedAudience = `player:${this.viewer.value}`;
    const state = this.options.getState();
    const items = state.knowledgeGrants.filter((grant) => grant.audience === 'party' || grant.audience === selectedAudience).slice().reverse().slice(0, 80);
    this.grantList.replaceChildren();
    if (items.length === 0) {
      const empty = document.createElement('p'); empty.className = 'player-preview-empty'; empty.textContent = 'No knowledge has been revealed to this view.'; this.grantList.append(empty); return;
    }
    for (const grant of items) {
      const row = document.createElement('article'); row.className = 'player-grant-item';
      const copy = document.createElement('span');
      const candidate = this.candidates(grant.subjectType).find((item) => item.id === grant.subjectId);
      const title = document.createElement('strong'); title.textContent = grant.alias ?? candidate?.label ?? grant.subjectId;
      const meta = document.createElement('small'); meta.textContent = `${grant.subjectType.replaceAll('-', ' ')} · ${grant.level} · ${grant.audience === 'party' ? 'whole party' : 'this player'}${grant.revokedAt === null ? '' : ' · revoked'}`;
      copy.append(title, meta); row.append(copy);
      if (grant.revokedAt === null) {
        const revoke = document.createElement('button'); revoke.type = 'button'; revoke.textContent = 'Revoke'; revoke.dataset.revokeGrant = grant.id; row.append(revoke);
      }
      this.grantList.append(row);
    }
  }

  private handleGrantAction(event: Event): void {
    const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('button[data-revoke-grant]');
    const grantId = button?.dataset.revokeGrant;
    if (grantId === undefined) return;
    this.commit(revokeKnowledgeGrant(this.options.getState(), grantId), 'Knowledge grant revoked.');
  }

  private renderProjectionSummary(): void {
    try {
      const projection = this.projection();
      const values: readonly [string, number][] = [
        ['Map markers', projection.map.features.length], ['Buildings', projection.map.buildings.length],
        ['People', projection.knownNpcs.length], ['Places', projection.knownLocations.length],
        ['Clues', projection.clues.length], ['Messages', projection.messages.reduce((sum, thread) => sum + thread.messages.length, 0)],
      ];
      this.summary.replaceChildren(...values.map(([label, value]) => {
        const card = document.createElement('span'); const strong = document.createElement('strong'); strong.textContent = value.toLocaleString(); const small = document.createElement('small'); small.textContent = label; card.append(strong, small); return card;
      }));
      const errors = structuralSafetyErrors(projection);
      this.safety.textContent = errors.length === 0
        ? 'SAFE PROJECTION · GM-only fields are absent'
        : `BLOCKED · forbidden fields: ${errors.slice(0, 3).join(', ')}`;
      this.safety.dataset.status = errors.length === 0 ? 'safe' : 'blocked';
      this.openPreview.disabled = errors.length > 0;
      this.downloadProjection.disabled = errors.length > 0;
    } catch (error) {
      this.summary.replaceChildren();
      this.safety.textContent = error instanceof Error ? `PREVIEW ERROR · ${error.message}` : 'PREVIEW ERROR';
      this.safety.dataset.status = 'blocked';
      this.openPreview.disabled = true;
      this.downloadProjection.disabled = true;
    }
  }

  private publish(openWindow: boolean): void {
    const projection = this.projection(true);
    const errors = structuralSafetyErrors(projection);
    if (errors.length > 0) { this.options.notify('Player preview blocked by the secrecy audit.', 'error'); return; }
    const token = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(`${PLAYER_PROJECTION_STORAGE_PREFIX}${token}`, JSON.stringify(projection));
    localStorage.setItem(PLAYER_PROJECTION_LATEST_KEY, JSON.stringify(projection));
    if (openWindow) window.open(`${location.pathname}?view=player&projection=${encodeURIComponent(token)}`, '_blank', 'noopener');
    this.options.notify(openWindow ? 'Opened an isolated player preview.' : 'Player preview projection refreshed.', 'success');
    this.renderProjectionSummary();
  }

  private download(): void {
    const projection = this.projection(true);
    const blob = new Blob([JSON.stringify(projection, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${safeFilename(projection.campaign.name)}-${safeFilename(projection.viewer.displayName)}-player-view.json`; anchor.click();
    URL.revokeObjectURL(url);
  }
}
