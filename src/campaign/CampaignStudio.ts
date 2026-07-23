import {
  activateScene,
  addCampaignNote,
  addMessageDraft,
  advanceCampaignTime,
  campaignBacklinks,
  completeActiveScene,
  createAsset,
  createCampaign,
  createCampaignExport,
  createClue,
  createHandout,
  createMessageThread,
  createObjective,
  createScene,
  createTimelineEvent,
  endEncounter,
  endSession,
  pauseActiveScene,
  previewCampaignTimeAdvance,
  restoreCheckpoint,
  revealCampaignEntity,
  searchCampaign,
  sendCampaignMessage,
  setCampaignNoteCompleted,
  setCampaignTime,
  setCampaignTimezone,
  setCampaignWeather,
  stageSceneParticipant,
  startEncounter,
  startSession,
  triggerTimelineEvent,
  updateScene,
  validateCampaignReferences,
  normalizeCampaignState,
  type CampaignAssetType,
  type CampaignEntityRef,
  type CampaignParticipantRef,
  type CampaignParticipantType,
  type CampaignReferenceContext,
  type CampaignScene,
  type CampaignState,
  type CampaignWeather,
  type SceneStatus,
} from './CampaignSystem';

export interface CampaignStudioOption {
  readonly id: string;
  readonly label: string;
  readonly subtitle?: string;
}

export interface CampaignStudioDependencies {
  readonly hostingEnabled: boolean;
  readonly getWorldRef: () => string;
  readonly getNpcOptions: () => readonly CampaignStudioOption[];
  readonly getLocationOptions: () => readonly CampaignStudioOption[];
  readonly getCharacterOptions: () => readonly CampaignStudioOption[];
  readonly getAssetOptions: () => readonly CampaignStudioOption[];
  readonly getExternalAssetIds: () => ReadonlySet<string>;
  readonly onChange: (state: CampaignState) => void;
  readonly onTimeChange: (timestamp: string, timezone: string) => void;
  readonly onWeatherChange: (weather: CampaignWeather | null) => void;
  readonly onActiveSceneChange: (scene: CampaignScene | null) => void;
  readonly onFocusLocation: (locationRef: string) => void;
  readonly notify: (message: string, kind?: 'success' | 'warning' | 'error') => void;
}

function required<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Campaign Studio element missing: ${selector}`);
  return element;
}

function option(select: HTMLSelectElement, value: string, label: string): HTMLOptionElement {
  const item = document.createElement('option');
  item.value = value;
  item.textContent = label;
  select.append(item);
  return item;
}

function clearAndEmpty(container: HTMLElement, message: string): void {
  container.replaceChildren();
  const empty = document.createElement('span');
  empty.className = 'campaign-empty';
  empty.textContent = message;
  container.append(empty);
}

function localInputValue(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function safeIsoFromInput(value: string): string | null {
  if (value.length === 0) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function formatCampaignDate(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: timezone,
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

function eventTriggerLabel(event: CampaignState['timelineEvents'][number]): string {
  switch (event.trigger.kind) {
    case 'manual': return 'Manual';
    case 'time': return formatCampaignDate(event.trigger.at, 'Asia/Manila');
    case 'scene-activation': return `When scene activates`;
    case 'relative': return `${event.trigger.offsetMinutes}m after another event`;
    case 'window': return `${new Date(event.trigger.startsAt).toLocaleString()}–${new Date(event.trigger.endsAt).toLocaleString()}`;
    case 'condition': return `${event.trigger.key} = ${event.trigger.expectedValue}`;
    case 'recurring': return `Every ${event.trigger.everyMinutes}m`;
  }
}

function recordCard(title: string, subtitle: string, body?: string): HTMLElement {
  const card = document.createElement('article');
  card.className = 'campaign-record-card';
  const header = document.createElement('header');
  const copy = document.createElement('div');
  const strong = document.createElement('strong'); strong.textContent = title;
  const small = document.createElement('small'); small.textContent = subtitle;
  copy.append(strong, small); header.append(copy); card.append(header);
  if (body !== undefined && body.trim().length > 0) {
    const paragraph = document.createElement('p'); paragraph.textContent = body; card.append(paragraph);
  }
  return card;
}

export class CampaignStudio {
  private stateValue: CampaignState;
  private selectedSceneId: string | null = null;
  private dependencies: CampaignStudioDependencies;

  private readonly campaignName = required<HTMLInputElement>('#campaign-name');
  private readonly campaignStatus = required<HTMLSelectElement>('#campaign-status');
  private readonly saveState = required<HTMLElement>('#campaign-save-state');
  private readonly currentSession = required<HTMLElement>('#campaign-current-session');
  private readonly currentScene = required<HTMLElement>('#campaign-current-scene');
  private readonly currentTime = required<HTMLElement>('#campaign-current-time');
  private readonly upcomingCount = required<HTMLElement>('#campaign-upcoming-count');
  private readonly revealCount = required<HTMLElement>('#campaign-reveal-count');
  private readonly revision = required<HTMLElement>('#campaign-revision');
  private readonly currentWorld = required<HTMLElement>('#campaign-current-world');
  private readonly currentWeather = required<HTMLElement>('#campaign-current-weather');
  private readonly startSessionButton = required<HTMLButtonElement>('#campaign-start-session');
  private readonly endSessionButton = required<HTMLButtonElement>('#campaign-end-session');
  private readonly checklistTitle = required<HTMLInputElement>('#campaign-checklist-title');
  private readonly checklistList = required<HTMLElement>('#campaign-checklist-list');
  private readonly campaignImportFile = required<HTMLInputElement>('#campaign-import-file');
  private readonly recentActivity = required<HTMLElement>('#campaign-recent-activity');
  private readonly directorState = required<HTMLElement>('#campaign-director-state');
  private readonly activeSceneTitle = required<HTMLElement>('#campaign-active-scene-title');
  private readonly activeSceneLocation = required<HTMLElement>('#campaign-active-scene-location');
  private readonly directorTime = required<HTMLElement>('#campaign-director-time');
  private readonly directorWeather = required<HTMLElement>('#campaign-director-weather');
  private readonly sceneSelect = required<HTMLSelectElement>('#campaign-scene-select');
  private readonly activateSceneButton = required<HTMLButtonElement>('#campaign-activate-scene');
  private readonly pauseSceneButton = required<HTMLButtonElement>('#campaign-pause-scene');
  private readonly completeSceneButton = required<HTMLButtonElement>('#campaign-complete-scene');
  private readonly exactTime = required<HTMLInputElement>('#campaign-exact-time');
  private readonly timezone = required<HTMLInputElement>('#campaign-timezone');
  private readonly timeReason = required<HTMLInputElement>('#campaign-time-reason');
  private readonly timePreview = required<HTMLElement>('#campaign-time-preview');
  private readonly weather = required<HTMLSelectElement>('#campaign-weather');
  private readonly participantType = required<HTMLSelectElement>('#campaign-participant-type');
  private readonly participantRef = required<HTMLSelectElement>('#campaign-participant-ref');
  private readonly participantList = required<HTMLElement>('#campaign-participant-list');
  private readonly actionFeedback = required<HTMLElement>('#campaign-action-feedback');
  private readonly liveNoteTitle = required<HTMLInputElement>('#campaign-live-note-title');
  private readonly liveNoteBody = required<HTMLTextAreaElement>('#campaign-live-note-body');
  private readonly sceneName = required<HTMLInputElement>('#campaign-scene-name');
  private readonly sceneType = required<HTMLSelectElement>('#campaign-scene-type');
  private readonly sceneStatus = required<HTMLSelectElement>('#campaign-scene-status');
  private readonly sceneLocationSearch = required<HTMLInputElement>('#campaign-scene-location-search');
  private readonly sceneLocation = required<HTMLSelectElement>('#campaign-scene-location');
  private readonly sceneGmDescription = required<HTMLTextAreaElement>('#campaign-scene-gm-description');
  private readonly scenePlayerDescription = required<HTMLTextAreaElement>('#campaign-scene-player-description');
  private readonly sceneReadAloud = required<HTMLTextAreaElement>('#campaign-scene-read-aloud');
  private readonly sceneList = required<HTMLElement>('#campaign-scene-list');
  private readonly eventName = required<HTMLInputElement>('#campaign-event-name');
  private readonly eventTriggerKind = required<HTMLSelectElement>('#campaign-event-trigger-kind');
  private readonly eventTime = required<HTMLInputElement>('#campaign-event-time');
  private readonly eventScene = required<HTMLSelectElement>('#campaign-event-scene');
  private readonly eventDescription = required<HTMLInputElement>('#campaign-event-description');
  private readonly eventConfirmation = required<HTMLInputElement>('#campaign-event-confirmation');
  private readonly eventList = required<HTMLElement>('#campaign-event-list');
  private readonly informationType = required<HTMLSelectElement>('#campaign-information-type');
  private readonly informationTitle = required<HTMLInputElement>('#campaign-information-title');
  private readonly informationDescription = required<HTMLTextAreaElement>('#campaign-information-description');
  private readonly informationList = required<HTMLElement>('#campaign-information-list');
  private readonly threadName = required<HTMLInputElement>('#campaign-thread-name');
  private readonly threadMedium = required<HTMLSelectElement>('#campaign-thread-medium');
  private readonly threadSelect = required<HTMLSelectElement>('#campaign-thread-select');
  private readonly messageSender = required<HTMLInputElement>('#campaign-message-sender');
  private readonly messageBody = required<HTMLTextAreaElement>('#campaign-message-body');
  private readonly messageSchedule = required<HTMLInputElement>('#campaign-message-schedule');
  private readonly messageGlitch = required<HTMLInputElement>('#campaign-message-glitch');
  private readonly messageList = required<HTMLElement>('#campaign-message-list');
  private readonly externalAsset = required<HTMLSelectElement>('#campaign-external-asset');
  private readonly assetName = required<HTMLInputElement>('#campaign-asset-name');
  private readonly assetType = required<HTMLSelectElement>('#campaign-asset-type');
  private readonly assetUri = required<HTMLInputElement>('#campaign-asset-uri');
  private readonly assetAlt = required<HTMLInputElement>('#campaign-asset-alt');
  private readonly assetRights = required<HTMLInputElement>('#campaign-asset-rights');
  private readonly assetList = required<HTMLElement>('#campaign-asset-list');
  private readonly sessionRecap = required<HTMLTextAreaElement>('#campaign-session-recap');
  private readonly sessionList = required<HTMLElement>('#campaign-session-list');
  private readonly checkpointList = required<HTMLElement>('#campaign-checkpoint-list');
  private readonly search = required<HTMLInputElement>('#campaign-search');
  private readonly searchResults = required<HTMLElement>('#campaign-search-results');
  private readonly referenceHealth = required<HTMLElement>('#campaign-reference-health');

  public constructor(initialState: CampaignState | null, dependencies: CampaignStudioDependencies) {
    this.dependencies = dependencies;
    this.stateValue = initialState ?? createCampaign(dependencies.getWorldRef(), 'Hidden Payaw');
    this.bind();
    this.render();
  }

  public state(): CampaignState { return this.stateValue; }

  public replaceState(state: CampaignState): void {
    this.stateValue = state;
    if (this.selectedSceneId !== null && !state.scenes.some((scene) => scene.id === this.selectedSceneId)) this.selectedSceneId = null;
    this.render();
  }

  public ensureWorldReference(worldRef: string): void {
    if (this.stateValue.worldRef === worldRef) return;
    const isEmpty = this.stateValue.scenes.length === 0 && this.stateValue.sessions.length === 0 && this.stateValue.activityLog.length === 0;
    if (isEmpty) {
      this.stateValue = { ...this.stateValue, worldRef, updatedAt: new Date().toISOString() };
      this.commit(false);
    } else {
      this.renderReferenceHealth();
    }
  }

  public refreshExternalReferences(): void {
    this.renderSceneLocationOptions();
    this.renderParticipantOptions();
    this.renderExternalAssetOptions();
    this.renderReferenceHealth();
  }

  private bind(): void {
    this.campaignName.addEventListener('change', () => {
      const value = this.campaignName.value.trim();
      if (value.length === 0) { this.campaignName.value = this.stateValue.name; return; }
      this.stateValue = { ...this.stateValue, name: value, updatedAt: new Date().toISOString() };
      this.commit();
    });
    this.campaignStatus.addEventListener('change', () => {
      this.stateValue = { ...this.stateValue, status: this.campaignStatus.value as CampaignState['status'], updatedAt: new Date().toISOString() };
      this.commit();
    });
    this.startSessionButton.addEventListener('click', () => this.startSession());
    this.endSessionButton.addEventListener('click', () => this.sessionRecap.focus());
    required<HTMLButtonElement>('#campaign-confirm-end-session').addEventListener('click', () => this.finishSession());
    required<HTMLButtonElement>('#campaign-new-scene').addEventListener('click', () => { this.clearSceneForm(); this.sceneName.focus(); });
    required<HTMLButtonElement>('#campaign-new-event').addEventListener('click', () => this.eventName.focus());
    required<HTMLButtonElement>('#campaign-new-clue').addEventListener('click', () => { this.informationType.value = 'clue'; this.informationTitle.focus(); });
    required<HTMLButtonElement>('#campaign-new-thread').addEventListener('click', () => this.threadName.focus());
    required<HTMLButtonElement>('#campaign-add-live-note').addEventListener('click', () => this.liveNoteBody.focus());
    required<HTMLButtonElement>('#campaign-export').addEventListener('click', () => this.exportCampaign());
    this.campaignImportFile.addEventListener('change', () => { void this.importCampaignFile(); });
    required<HTMLButtonElement>('#campaign-add-checklist').addEventListener('click', () => this.addChecklistItem());
    this.activateSceneButton.addEventListener('click', () => this.activateSelectedScene());
    this.pauseSceneButton.addEventListener('click', () => this.apply(pauseActiveScene(this.stateValue)));
    this.completeSceneButton.addEventListener('click', () => this.apply(completeActiveScene(this.stateValue)));
    this.sceneLocationSearch.addEventListener('input', () => this.renderSceneLocationOptions());
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-campaign-minutes]')) {
      button.addEventListener('click', () => this.advanceTime(Number(button.dataset.campaignMinutes) || 0));
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-campaign-semantic]')) {
      button.addEventListener('click', () => this.advanceSemanticTime(button.dataset.campaignSemantic ?? 'tomorrow'));
    }
    required<HTMLButtonElement>('#campaign-apply-exact-time').addEventListener('click', () => this.applyExactTime());
    required<HTMLButtonElement>('#campaign-apply-timezone').addEventListener('click', () => this.applyTimezone());
    required<HTMLButtonElement>('#campaign-apply-weather').addEventListener('click', () => this.applyWeather());
    this.participantType.addEventListener('change', () => this.renderParticipantOptions());
    required<HTMLButtonElement>('#campaign-stage-participant').addEventListener('click', () => this.stageParticipant());
    required<HTMLButtonElement>('#campaign-reveal-clue').addEventListener('click', () => this.revealNext('clue'));
    required<HTMLButtonElement>('#campaign-show-handout').addEventListener('click', () => this.revealNext('handout'));
    required<HTMLButtonElement>('#campaign-send-message').addEventListener('click', () => this.sendNextDraft());
    required<HTMLButtonElement>('#campaign-start-encounter').addEventListener('click', () => this.toggleEncounter());
    required<HTMLButtonElement>('#campaign-save-live-note').addEventListener('click', () => this.saveLiveNote());
    required<HTMLButtonElement>('#campaign-save-scene').addEventListener('click', () => this.saveScene(false));
    required<HTMLButtonElement>('#campaign-update-scene').addEventListener('click', () => this.saveScene(true));
    required<HTMLButtonElement>('#campaign-clear-scene-form').addEventListener('click', () => this.clearSceneForm());
    required<HTMLButtonElement>('#campaign-save-event').addEventListener('click', () => this.saveEvent());
    required<HTMLButtonElement>('#campaign-save-information').addEventListener('click', () => this.saveInformation());
    required<HTMLButtonElement>('#campaign-create-thread').addEventListener('click', () => this.createThread());
    required<HTMLButtonElement>('#campaign-save-message').addEventListener('click', () => this.saveMessage());
    this.externalAsset.addEventListener('change', () => this.populateExternalAsset());
    required<HTMLButtonElement>('#campaign-register-asset').addEventListener('click', () => this.registerAsset());
    this.search.addEventListener('input', () => this.renderSearch());
    this.sceneSelect.addEventListener('change', () => {
      this.activateSceneButton.disabled = this.sceneSelect.value.length === 0;
      if (this.sceneSelect.value.length === 0) return;
      this.selectedSceneId = this.sceneSelect.value;
      this.loadSceneForm(this.selectedSceneId);
      this.renderSceneList();
    });
    this.eventTriggerKind.addEventListener('change', () => this.updateEventTriggerUi());
    this.updateEventTriggerUi();
  }

  private apply(state: CampaignState, feedback?: string): void {
    if (state === this.stateValue) return;
    this.stateValue = state;
    if (feedback !== undefined) this.setFeedback(feedback);
    this.commit();
  }

  private commit(render = true): void {
    this.saveState.dataset.state = 'saving';
    this.saveState.textContent = this.dependencies.hostingEnabled ? 'LOCAL SAVED · HOST SYNC PENDING' : 'LOCAL · SAVING';
    this.dependencies.onChange(this.stateValue);
    if (render) this.render();
    window.setTimeout(() => {
      this.saveState.dataset.state = 'saved';
      this.saveState.textContent = this.dependencies.hostingEnabled ? 'LOCAL SAVED · HOST AUTO-SYNC' : 'LOCAL · SAVED';
    }, 120);
  }

  private exportCampaign(): void {
    const payload = createCampaignExport(this.stateValue);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.stateValue.name.replaceAll(/[^a-zA-Z0-9_-]/g, '_') || 'payaw-campaign'}.campaign.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.setFeedback('Campaign JSON exported.');
  }

  private async importCampaignFile(): Promise<void> {
    const file = this.campaignImportFile.files?.[0];
    this.campaignImportFile.value = '';
    if (file === undefined) return;
    if (file.size > 32 * 1024 * 1024) { this.setFeedback('Campaign JSON exceeds the 32 MB import limit.', 'error'); return; }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (typeof parsed !== 'object' || parsed === null) throw new Error('Campaign JSON must contain an object.');
      const root = parsed as Record<string, unknown>;
      const source = root.campaign ?? root;
      const next = normalizeCampaignState(source, this.dependencies.getWorldRef());
      if (next.worldRef !== this.dependencies.getWorldRef() && !window.confirm(`This campaign references ${next.worldRef}, not the current world. Import it and keep the broken-world warning?`)) return;
      this.stateValue = next;
      this.selectedSceneId = next.runState.activeSceneId;
      this.dependencies.onTimeChange(next.runState.campaignTime, next.runState.timezone);
      this.dependencies.onWeatherChange(next.runState.weatherOverride);
      this.dependencies.onActiveSceneChange(this.activeScene() ?? null);
      this.commit();
      this.setFeedback('Campaign imported. Review reference health before running.');
    } catch (error) {
      this.setFeedback(error instanceof Error ? error.message : 'Campaign import failed.', 'error');
    }
  }

  private addChecklistItem(): void {
    const title = this.checklistTitle.value.trim();
    if (title.length === 0) { this.setFeedback('Write a preparation task first.', 'warning'); return; }
    this.apply(addCampaignNote(this.stateValue, title, '', 'checklist'), 'Preparation task added.');
    this.checklistTitle.value = '';
  }

  private advanceSemanticTime(kind: string): void {
    if (kind === 'tomorrow') { this.advanceTime(1440); return; }
    const targetHour = kind === 'morning' ? 8 : 19;
    let hour = 0;
    let minute = 0;
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: this.stateValue.runState.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(new Date(this.stateValue.runState.campaignTime));
      hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
      minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
    } catch {
      const date = new Date(this.stateValue.runState.campaignTime);
      hour = date.getHours(); minute = date.getMinutes();
    }
    let delta = targetHour * 60 - (hour * 60 + minute);
    if (delta <= 0) delta += 1440;
    this.advanceTime(delta);
  }

  private applyTimezone(): void {
    const value = this.timezone.value.trim();
    const next = setCampaignTimezone(this.stateValue, value);
    if (next === this.stateValue) { this.setFeedback('Enter a valid IANA timezone such as Asia/Manila.', 'warning'); return; }
    this.stateValue = next;
    this.dependencies.onTimeChange(next.runState.campaignTime, next.runState.timezone);
    this.commit();
    this.setFeedback(`Campaign timezone set to ${next.runState.timezone}.`);
  }

  private populateExternalAsset(): void {
    const selected = this.dependencies.getAssetOptions().find((asset) => asset.id === this.externalAsset.value);
    if (selected === undefined) return;
    this.assetName.value = selected.label;
    this.assetType.value = 'image';
    this.assetUri.value = `payaw-asset:${selected.id}`;
  }

  private registerAsset(): void {
    const external = this.dependencies.getAssetOptions().find((asset) => asset.id === this.externalAsset.value);
    const name = this.assetName.value.trim() || external?.label || '';
    if (name.length === 0) { this.setFeedback('Asset name is required.', 'warning'); return; }
    const assetId = external?.id;
    if (assetId !== undefined && this.stateValue.assets.some((asset) => asset.id === assetId)) { this.setFeedback('That PAYAW asset is already registered in the campaign.', 'warning'); return; }
    const uri = this.assetUri.value.trim() || (assetId === undefined ? '' : `payaw-asset:${assetId}`);
    this.apply(createAsset(this.stateValue, {
      ...(assetId === undefined ? {} : { id: assetId }),
      name,
      type: this.assetType.value as CampaignAssetType,
      uri,
      mimeType: external?.subtitle ?? '',
      alternateText: this.assetAlt.value.trim(),
      caption: this.assetAlt.value.trim(),
      rightsNote: this.assetRights.value.trim(),
    }), 'Campaign asset registered.');
    this.externalAsset.value = '';
    this.assetName.value = '';
    this.assetUri.value = '';
    this.assetAlt.value = '';
    this.assetRights.value = '';
  }

  private startSession(): void {
    if (this.stateValue.runState.activeSessionId !== null) {
      required<HTMLElement>('#campaign-scene-director').scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.setFeedback('Continuing the active session.');
      return;
    }
    const openingSceneId = this.stateValue.runState.activeSceneId ?? (this.sceneSelect.value || null);
    this.apply(startSession(this.stateValue, { openingSceneId, openingTime: this.stateValue.runState.campaignTime }), 'Session started and checkpointed.');
  }

  private finishSession(): void {
    if (this.stateValue.runState.activeSessionId === null) { this.setFeedback('No active session to complete.', 'warning'); return; }
    this.apply(endSession(this.stateValue, this.sessionRecap.value.trim()), 'Session completed and checkpointed.');
    this.sessionRecap.value = '';
  }

  private activateSelectedScene(): void {
    const sceneId = this.sceneSelect.value || this.selectedSceneId;
    if (sceneId === null || sceneId.length === 0) { this.setFeedback('Create or select a scene first.', 'warning'); return; }
    this.selectedSceneId = sceneId;
    this.apply(activateScene(this.stateValue, sceneId), 'Scene activated.');
  }

  private advanceTime(minutes: number): void {
    const preview = previewCampaignTimeAdvance(this.stateValue, minutes);
    if (preview.largeJump && preview.eligibleEventIds.length > 0) {
      const names = preview.eligibleEventIds.map((eventId) => this.stateValue.timelineEvents.find((event) => event.id === eventId)?.name ?? eventId);
      if (!window.confirm(`This time jump crosses ${names.length} scheduled event${names.length === 1 ? '' : 's'}:\n\n${names.join('\n')}\n\nAdvance anyway?`)) return;
    }
    const result = advanceCampaignTime(this.stateValue, minutes);
    this.timePreview.textContent = result.preview.eligibleEventIds.length === 0
      ? 'No scheduled events crossed.'
      : `${result.preview.eligibleEventIds.length} event${result.preview.eligibleEventIds.length === 1 ? '' : 's'} became eligible.`;
    this.stateValue = result.state;
    this.dependencies.onTimeChange(result.state.runState.campaignTime, result.state.runState.timezone);
    this.commit();
  }

  private applyExactTime(): void {
    const target = safeIsoFromInput(this.exactTime.value);
    if (target === null) { this.setFeedback('Choose a valid campaign date and time.', 'warning'); return; }
    const current = Date.parse(this.stateValue.runState.campaignTime);
    const targetMs = Date.parse(target);
    const preview = previewCampaignTimeAdvance(this.stateValue, Math.round((targetMs - current) / 60_000));
    if (preview.largeJump && preview.eligibleEventIds.length > 0 && !window.confirm(`This jump crosses ${preview.eligibleEventIds.length} scheduled event(s). Continue?`)) return;
    const result = setCampaignTime(this.stateValue, target, 'GM', this.timeReason.value.trim() || 'campaign-clock');
    this.stateValue = result.state;
    this.dependencies.onTimeChange(target, result.state.runState.timezone);
    this.timePreview.textContent = result.preview.eligibleEventIds.length === 0 ? 'No scheduled events crossed.' : `${result.preview.eligibleEventIds.length} event(s) became eligible.`;
    this.timeReason.value = '';
    this.commit();
  }

  private applyWeather(): void {
    const value = this.weather.value as CampaignWeather;
    this.stateValue = setCampaignWeather(this.stateValue, value);
    this.dependencies.onWeatherChange(value === 'auto' ? null : value);
    this.setFeedback(value === 'auto' ? 'Weather returned to automatic.' : `Weather set to ${value.replaceAll('-', ' ')}.`);
    this.commit();
  }

  private stageParticipant(): void {
    const sceneId = this.stateValue.runState.activeSceneId ?? this.selectedSceneId;
    if (sceneId === null) { this.setFeedback('Activate or select a scene first.', 'warning'); return; }
    const value = this.participantRef.value;
    if (value.length === 0) { this.setFeedback('Choose a participant.', 'warning'); return; }
    const type = this.participantType.value as CampaignParticipantType;
    const label = this.participantRef.selectedOptions[0]?.textContent ?? value;
    const participant: CampaignParticipantRef = { id: value, type, label, hidden: false };
    this.apply(stageSceneParticipant(this.stateValue, sceneId, participant, true), `${label} staged in the scene.`);
  }

  private removeParticipant(sceneId: string, participant: CampaignParticipantRef): void {
    this.apply(stageSceneParticipant(this.stateValue, sceneId, participant, false), `${participant.label} removed from the scene.`);
  }

  private revealNext(kind: 'clue' | 'handout'): void {
    const activeReveals = new Set(this.stateValue.reveals.filter((reveal) => reveal.revokedAt === null && reveal.audience === 'party').map((reveal) => `${reveal.entityType}:${reveal.entityId}`));
    const entity = kind === 'clue'
      ? this.stateValue.clues.find((clue) => !activeReveals.has(`clue:${clue.id}`))
      : this.stateValue.handouts.find((handout) => !activeReveals.has(`handout:${handout.id}`));
    if (entity === undefined) { this.setFeedback(`No unrevealed ${kind}s are prepared.`, 'warning'); return; }
    const entityId = entity.id;
    this.apply(revealCampaignEntity(this.stateValue, kind, entityId, 'party'), `${kind === 'clue' ? 'Clue' : 'Handout'} revealed to the party.`);
  }

  private sendNextDraft(): void {
    for (const thread of this.stateValue.messageThreads) {
      const draft = thread.messages.find((message) => message.status === 'draft' || message.status === 'queued');
      if (draft !== undefined) { this.apply(sendCampaignMessage(this.stateValue, thread.id, draft.id), `Message sent in ${thread.name}.`); return; }
    }
    this.setFeedback('No draft message is ready to send.', 'warning');
  }

  private toggleEncounter(): void {
    if (this.stateValue.runState.activeEncounterId !== null) {
      this.apply(endEncounter(this.stateValue), 'Encounter ended.');
      return;
    }
    const scene = this.activeScene();
    this.apply(startEncounter(this.stateValue, scene === undefined ? 'Encounter' : `${scene.name} encounter`, scene?.participants.map((participant) => participant.id) ?? []), 'Encounter marker started.');
  }

  private saveLiveNote(): void {
    const body = this.liveNoteBody.value.trim();
    const title = this.liveNoteTitle.value.trim();
    if (body.length === 0 && title.length === 0) { this.setFeedback('Write a note first.', 'warning'); return; }
    const refs: CampaignEntityRef[] = this.stateValue.runState.activeSceneId === null ? [] : [{ type: 'scene', id: this.stateValue.runState.activeSceneId }];
    this.apply(addCampaignNote(this.stateValue, title, body, 'live', 'GM', new Date(), refs), 'Live note recorded.');
    this.liveNoteTitle.value = '';
    this.liveNoteBody.value = '';
  }

  private saveScene(updating: boolean): void {
    const name = this.sceneName.value.trim();
    if (name.length === 0) { this.setFeedback('Scene name is required.', 'warning'); this.sceneName.focus(); return; }
    const patch = {
      name, type: this.sceneType.value, status: this.sceneStatus.value as SceneStatus,
      locationRef: this.sceneLocation.value || null,
      gmDescription: this.sceneGmDescription.value,
      playerDescription: this.scenePlayerDescription.value,
      readAloud: this.sceneReadAloud.value,
    };
    if (updating && this.selectedSceneId !== null) {
      this.apply(updateScene(this.stateValue, this.selectedSceneId, patch), 'Scene updated.');
      return;
    }
    const beforeIds = new Set(this.stateValue.scenes.map((scene) => scene.id));
    const next = createScene(this.stateValue, patch);
    this.selectedSceneId = next.scenes.find((scene) => !beforeIds.has(scene.id))?.id ?? null;
    this.apply(next, 'Scene created.');
  }

  private clearSceneForm(): void {
    this.selectedSceneId = null;
    this.sceneName.value = '';
    this.sceneType.value = 'location';
    this.sceneStatus.value = 'draft';
    this.sceneLocation.value = '';
    this.sceneGmDescription.value = '';
    this.scenePlayerDescription.value = '';
    this.sceneReadAloud.value = '';
    this.renderSceneList();
  }

  private loadSceneForm(sceneId: string): void {
    const scene = this.stateValue.scenes.find((candidate) => candidate.id === sceneId);
    if (scene === undefined) return;
    this.sceneName.value = scene.name;
    this.sceneType.value = scene.type;
    this.sceneStatus.value = scene.status === 'active' || scene.status === 'archived' ? 'ready' : scene.status;
    this.sceneLocation.value = scene.locationRef ?? '';
    this.sceneGmDescription.value = scene.gmDescription;
    this.scenePlayerDescription.value = scene.playerDescription;
    this.sceneReadAloud.value = scene.readAloud;
  }

  private saveEvent(): void {
    const name = this.eventName.value.trim();
    if (name.length === 0) { this.setFeedback('Event name is required.', 'warning'); return; }
    const kind = this.eventTriggerKind.value;
    const time = safeIsoFromInput(this.eventTime.value) ?? this.stateValue.runState.campaignTime;
    const sceneId = this.eventScene.value || null;
    const trigger = kind === 'time' ? { kind: 'time' as const, at: time }
      : kind === 'scene-activation' && sceneId !== null ? { kind: 'scene-activation' as const, sceneId }
      : kind === 'window' ? { kind: 'window' as const, startsAt: time, endsAt: new Date(Date.parse(time) + 60 * 60_000).toISOString() }
      : kind === 'condition' ? { kind: 'condition' as const, key: 'gm-condition', expectedValue: 'true' }
      : { kind: 'manual' as const };
    const actions = sceneId === null ? [] : [{ id: `action:${Date.now().toString(36)}`, kind: 'activate-scene' as const, sceneId }];
    this.apply(createTimelineEvent(this.stateValue, { name, description: this.eventDescription.value, trigger, actions, targetSceneId: sceneId, confirmationRequired: this.eventConfirmation.checked }), 'Timeline event created.');
    this.eventName.value = '';
    this.eventDescription.value = '';
  }

  private saveInformation(): void {
    const title = this.informationTitle.value.trim();
    if (title.length === 0) { this.setFeedback('Information title is required.', 'warning'); return; }
    const description = this.informationDescription.value;
    if (this.informationType.value === 'clue') this.apply(createClue(this.stateValue, { gmTitle: title, playerTitle: title, description, source: this.activeScene()?.name ?? '' }), 'Clue created.');
    else if (this.informationType.value === 'handout') this.apply(createHandout(this.stateValue, { title, caption: description, alternateText: description }), 'Handout created.');
    else this.apply(createObjective(this.stateValue, { gmIntent: title, playerWording: description }), 'Objective created.');
    this.informationTitle.value = '';
    this.informationDescription.value = '';
  }

  private createThread(): void {
    const name = this.threadName.value.trim();
    if (name.length === 0) { this.setFeedback('Thread name is required.', 'warning'); return; }
    this.apply(createMessageThread(this.stateValue, name, this.threadMedium.value), 'Message thread created.');
    this.threadName.value = '';
  }

  private saveMessage(): void {
    const threadId = this.threadSelect.value;
    const body = this.messageBody.value.trim();
    if (threadId.length === 0 || body.length === 0) { this.setFeedback('Choose a thread and write a message.', 'warning'); return; }
    const scheduledAt = safeIsoFromInput(this.messageSchedule.value);
    this.apply(addMessageDraft(this.stateValue, threadId, {
      senderRef: this.messageSender.value.trim() || 'custom:unknown', senderLabel: this.messageSender.value.trim() || 'Unknown', body,
      status: scheduledAt === null ? 'draft' : 'queued', scheduledAt,
      style: { typingDelayMs: 650, glitch: this.messageGlitch.checked, corruption: this.messageGlitch.checked ? 0.15 : 0, soundAssetId: null },
    }), scheduledAt === null ? 'Message draft saved.' : 'Message queued for authored delivery.');
    this.messageBody.value = '';
    this.messageSchedule.value = '';
  }

  private triggerEvent(eventId: string): void {
    let result = triggerTimelineEvent(this.stateValue, eventId);
    if (result.requiresConfirmation) {
      const event = this.stateValue.timelineEvents.find((candidate) => candidate.id === eventId);
      if (!window.confirm(`Trigger “${event?.name ?? 'event'}”?\n\nThis can reveal information or change campaign state.`)) return;
      result = triggerTimelineEvent(this.stateValue, eventId, { confirmed: true });
    }
    this.apply(result.state, result.message);
  }

  private render(): void {
    this.campaignName.value = this.stateValue.name;
    this.campaignStatus.value = this.stateValue.status;
    const session = this.stateValue.sessions.find((candidate) => candidate.id === this.stateValue.runState.activeSessionId);
    const scene = this.activeScene();
    this.currentSession.textContent = session?.title ?? 'Not started';
    this.currentScene.textContent = scene?.name ?? 'None';
    this.currentTime.textContent = formatCampaignDate(this.stateValue.runState.campaignTime, this.stateValue.runState.timezone);
    this.upcomingCount.textContent = String(this.stateValue.timelineEvents.filter((event) => event.enabled && ['scheduled', 'eligible', 'delayed'].includes(event.status)).length);
    this.revealCount.textContent = String(this.stateValue.reveals.filter((reveal) => reveal.revokedAt === null).length);
    this.revision.textContent = this.stateValue.runState.revision.toLocaleString();
    this.currentWorld.textContent = this.stateValue.worldRef.replace(/^world:/, '');
    this.currentWorld.title = this.stateValue.worldRef;
    this.currentWeather.textContent = this.stateValue.runState.weatherOverride === null ? 'Automatic' : this.stateValue.runState.weatherOverride.replaceAll('-', ' ');
    this.startSessionButton.textContent = session === undefined ? 'Start session' : 'Continue session';
    this.endSessionButton.disabled = session === undefined;
    this.timezone.value = this.stateValue.runState.timezone;
    this.directorState.textContent = session === undefined ? 'PREP' : scene === undefined ? 'SESSION' : 'LIVE';
    this.directorState.dataset.state = session === undefined ? 'prep' : scene === undefined ? 'session' : 'live';
    this.activeSceneTitle.textContent = scene?.name ?? 'No active scene';
    this.activeSceneLocation.textContent = scene === undefined ? 'Choose a prepared scene below.' : this.locationLabel(scene.locationRef) || scene.freeformLocation || scene.type;
    this.directorTime.textContent = formatCampaignDate(this.stateValue.runState.campaignTime, this.stateValue.runState.timezone);
    this.directorWeather.textContent = this.stateValue.runState.weatherOverride === null ? 'Automatic weather' : this.stateValue.runState.weatherOverride.replaceAll('-', ' ');
    this.pauseSceneButton.disabled = scene === undefined;
    this.completeSceneButton.disabled = scene === undefined;
    this.exactTime.value = localInputValue(this.stateValue.runState.campaignTime);
    this.weather.value = this.stateValue.runState.weatherOverride ?? 'auto';
    this.renderSceneOptions();
    this.activateSceneButton.disabled = this.sceneSelect.value.length === 0;
    this.renderSceneLocationOptions();
    this.renderParticipantOptions();
    this.renderParticipants();
    this.renderSceneList();
    this.renderEventList();
    this.renderInformationList();
    this.renderMessageThreads();
    this.renderExternalAssetOptions();
    this.renderAssets();
    this.renderChecklist();
    this.renderSessions();
    this.renderRecentActivity();
    this.renderSearch();
    this.renderReferenceHealth();
    this.dependencies.onActiveSceneChange(scene ?? null);
  }

  private activeScene(): CampaignScene | undefined { return this.stateValue.scenes.find((scene) => scene.id === this.stateValue.runState.activeSceneId); }

  private renderChecklist(): void {
    const items = this.stateValue.notes.filter((note) => note.kind === 'checklist');
    this.checklistList.replaceChildren();
    if (items.length === 0) { clearAndEmpty(this.checklistList, 'No preparation tasks.'); return; }
    for (const note of items) {
      const row = document.createElement('label');
      row.className = 'campaign-checklist-item';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = note.completed;
      checkbox.addEventListener('change', () => this.apply(setCampaignNoteCompleted(this.stateValue, note.id, checkbox.checked)));
      const copy = document.createElement('span'); copy.textContent = note.title;
      if (note.completed) copy.dataset.completed = 'true';
      row.append(checkbox, copy); this.checklistList.append(row);
    }
  }

  private renderExternalAssetOptions(): void {
    const selected = this.externalAsset.value;
    this.externalAsset.replaceChildren();
    option(this.externalAsset, '', 'Create metadata-only asset');
    for (const asset of this.dependencies.getAssetOptions()) option(this.externalAsset, asset.id, asset.subtitle === undefined ? asset.label : `${asset.label} · ${asset.subtitle}`);
    if ([...this.externalAsset.options].some((item) => item.value === selected)) this.externalAsset.value = selected;
  }

  private renderAssets(): void {
    this.assetList.replaceChildren();
    if (this.stateValue.assets.length === 0) { clearAndEmpty(this.assetList, 'No campaign assets registered.'); return; }
    for (const asset of this.stateValue.assets) {
      const backlinks = campaignBacklinks(this.stateValue, { type: 'asset', id: asset.id });
      const card = recordCard(asset.name, `${asset.type} · ${backlinks.length} linked use${backlinks.length === 1 ? '' : 's'}`, asset.alternateText || asset.caption || asset.uri);
      const meta = document.createElement('small'); meta.textContent = asset.rightsNote.length === 0 ? 'No rights note' : asset.rightsNote; card.append(meta);
      this.assetList.append(card);
    }
  }

  private renderSceneOptions(): void {
    const selected = this.sceneSelect.value || this.selectedSceneId || this.stateValue.runState.activeSceneId || '';
    this.sceneSelect.replaceChildren();
    option(this.sceneSelect, '', this.stateValue.scenes.length === 0 ? 'No prepared scenes' : 'Choose a scene');
    this.eventScene.replaceChildren();
    option(this.eventScene, '', 'None');
    for (const scene of this.stateValue.scenes.filter((item) => item.status !== 'archived')) {
      option(this.sceneSelect, scene.id, `${scene.name} · ${scene.status}`);
      option(this.eventScene, scene.id, scene.name);
    }
    if ([...this.sceneSelect.options].some((item) => item.value === selected)) this.sceneSelect.value = selected;
  }

  private renderSceneLocationOptions(): void {
    const selected = this.sceneLocation.value;
    const query = this.sceneLocationSearch.value.trim().toLocaleLowerCase();
    this.sceneLocation.replaceChildren();
    option(this.sceneLocation, '', 'No map location');
    for (const location of this.dependencies.getLocationOptions().filter((item) =>
      query.length === 0 || `${item.label} ${item.subtitle ?? ''}`.toLocaleLowerCase().includes(query)
    )) option(this.sceneLocation, location.id, location.subtitle === undefined ? location.label : `${location.label} · ${location.subtitle}`);
    if ([...this.sceneLocation.options].some((item) => item.value === selected)) this.sceneLocation.value = selected;
  }

  private renderParticipantOptions(): void {
    const selected = this.participantRef.value;
    const type = this.participantType.value as CampaignParticipantType;
    const source = type === 'npc' ? this.dependencies.getNpcOptions() : type === 'character' ? this.dependencies.getCharacterOptions() : [{ id: 'group:party', label: 'The party' }, { id: 'group:bystanders', label: 'Bystanders' }];
    this.participantRef.replaceChildren();
    option(this.participantRef, '', source.length === 0 ? 'No options' : 'Choose participant');
    for (const item of source) option(this.participantRef, item.id, item.subtitle === undefined ? item.label : `${item.label} · ${item.subtitle}`);
    if ([...this.participantRef.options].some((item) => item.value === selected)) this.participantRef.value = selected;
  }

  private renderParticipants(): void {
    const scene = this.activeScene() ?? this.stateValue.scenes.find((candidate) => candidate.id === this.selectedSceneId);
    this.participantList.replaceChildren();
    if (scene === undefined || scene.participants.length === 0) { clearAndEmpty(this.participantList, 'No one staged.'); return; }
    for (const participant of scene.participants) {
      const chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'campaign-chip'; chip.textContent = `${participant.label} ×`;
      chip.title = 'Remove from this scene only'; chip.addEventListener('click', () => this.removeParticipant(scene.id, participant));
      this.participantList.append(chip);
    }
  }

  private renderSceneList(): void {
    this.sceneList.replaceChildren();
    if (this.stateValue.scenes.length === 0) { clearAndEmpty(this.sceneList, 'No scenes prepared yet.'); return; }
    for (const scene of this.stateValue.scenes) {
      const location = this.locationLabel(scene.locationRef) || scene.freeformLocation || 'No map location';
      const card = recordCard(scene.name, `${scene.status} · ${scene.type} · ${location}`, scene.gmDescription);
      card.dataset.selected = String(scene.id === this.selectedSceneId);
      const actions = document.createElement('div'); actions.className = 'campaign-record-actions';
      const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Edit'; edit.addEventListener('click', () => { this.selectedSceneId = scene.id; this.loadSceneForm(scene.id); this.renderSceneList(); });
      const activate = document.createElement('button'); activate.type = 'button'; activate.textContent = scene.id === this.stateValue.runState.activeSceneId ? 'Active' : 'Activate'; activate.disabled = scene.id === this.stateValue.runState.activeSceneId; activate.addEventListener('click', () => { this.selectedSceneId = scene.id; this.apply(activateScene(this.stateValue, scene.id)); });
      const focus = document.createElement('button'); focus.type = 'button'; focus.textContent = 'Focus map'; focus.disabled = scene.locationRef === null; focus.addEventListener('click', () => { if (scene.locationRef !== null) this.dependencies.onFocusLocation(scene.locationRef); });
      const backlinks = campaignBacklinks(this.stateValue, { type: 'scene', id: scene.id });
      const links = document.createElement('span'); links.className = 'campaign-backlink-count'; links.textContent = `${backlinks.length} backlink${backlinks.length === 1 ? '' : 's'}`;
      actions.append(edit, activate, focus, links); card.append(actions); this.sceneList.append(card);
    }
  }

  private renderEventList(): void {
    this.eventList.replaceChildren();
    if (this.stateValue.timelineEvents.length === 0) { clearAndEmpty(this.eventList, 'No timeline events prepared.'); return; }
    for (const event of [...this.stateValue.timelineEvents].sort((left, right) => (left.status === 'eligible' ? -1 : 0) - (right.status === 'eligible' ? -1 : 0))) {
      const card = recordCard(event.name, `${event.status} · ${eventTriggerLabel(event)}`, event.description);
      const actions = document.createElement('div'); actions.className = 'campaign-record-actions';
      const trigger = document.createElement('button'); trigger.type = 'button'; trigger.textContent = event.status === 'completed' ? 'Applied' : 'Trigger'; trigger.disabled = event.status === 'completed' || !event.enabled; trigger.addEventListener('click', () => this.triggerEvent(event.id));
      const target = document.createElement('span'); target.textContent = event.targetSceneId === null ? 'No scene action' : this.stateValue.scenes.find((scene) => scene.id === event.targetSceneId)?.name ?? 'Missing scene';
      actions.append(trigger, target); card.append(actions); this.eventList.append(card);
    }
  }

  private renderInformationList(): void {
    this.informationList.replaceChildren();
    const total = this.stateValue.clues.length + this.stateValue.handouts.length + this.stateValue.objectives.length;
    if (total === 0) { clearAndEmpty(this.informationList, 'No clues, handouts, or objectives prepared.'); return; }
    for (const clue of this.stateValue.clues) {
      const card = recordCard(clue.gmTitle, `Clue · ${clue.discoveryState}`, clue.description);
      const actions = document.createElement('div'); actions.className = 'campaign-record-actions';
      const reveal = document.createElement('button'); reveal.type = 'button'; reveal.textContent = clue.discoveryState === 'revealed' ? 'Revealed' : 'Reveal'; reveal.disabled = clue.discoveryState === 'revealed'; reveal.addEventListener('click', () => this.apply(revealCampaignEntity(this.stateValue, 'clue', clue.id, 'party')));
      actions.append(reveal); card.append(actions); this.informationList.append(card);
    }
    for (const handout of this.stateValue.handouts) {
      const revealed = this.stateValue.reveals.some((reveal) => reveal.entityType === 'handout' && reveal.entityId === handout.id && reveal.revokedAt === null);
      const card = recordCard(handout.title, `Handout · order ${handout.presentationOrder + 1}`, handout.caption);
      const actions = document.createElement('div'); actions.className = 'campaign-record-actions';
      const reveal = document.createElement('button'); reveal.type = 'button'; reveal.textContent = revealed ? 'Shown' : 'Show'; reveal.disabled = revealed; reveal.addEventListener('click', () => this.apply(revealCampaignEntity(this.stateValue, 'handout', handout.id, 'party')));
      actions.append(reveal); card.append(actions); this.informationList.append(card);
    }
    for (const objective of this.stateValue.objectives) this.informationList.append(recordCard(objective.gmIntent, `Objective · ${objective.status}`, objective.playerWording));
  }

  private renderMessageThreads(): void {
    const selected = this.threadSelect.value;
    this.threadSelect.replaceChildren();
    option(this.threadSelect, '', this.stateValue.messageThreads.length === 0 ? 'No threads' : 'Choose thread');
    this.messageList.replaceChildren();
    if (this.stateValue.messageThreads.length === 0) { clearAndEmpty(this.messageList, 'No in-world message threads.'); return; }
    for (const thread of this.stateValue.messageThreads) {
      option(this.threadSelect, thread.id, `${thread.name} · ${thread.medium}`);
      const card = recordCard(thread.name, `${thread.medium} · ${thread.messages.length} message${thread.messages.length === 1 ? '' : 's'}`);
      for (const message of thread.messages.slice(-5)) {
        const row = document.createElement('div'); row.className = 'campaign-message-row';
        const copy = document.createElement('span'); copy.textContent = `${message.senderLabel}: ${message.body}`;
        const status = document.createElement('small'); status.textContent = `${message.status}${message.scheduledAt === null ? '' : ` · ${formatCampaignDate(message.scheduledAt, this.stateValue.runState.timezone)}`}${message.style.glitch ? ' · glitch' : ''}`;
        row.append(copy, status);
        if (message.status === 'draft' || message.status === 'queued') {
          const send = document.createElement('button'); send.type = 'button'; send.textContent = 'Send'; send.addEventListener('click', () => this.apply(sendCampaignMessage(this.stateValue, thread.id, message.id)));
          row.append(send);
        }
        card.append(row);
      }
      this.messageList.append(card);
    }
    if ([...this.threadSelect.options].some((item) => item.value === selected)) this.threadSelect.value = selected;
    else if (this.stateValue.messageThreads[0] !== undefined) this.threadSelect.value = this.stateValue.messageThreads[0].id;
  }

  private renderSessions(): void {
    this.sessionList.replaceChildren();
    if (this.stateValue.sessions.length === 0) clearAndEmpty(this.sessionList, 'No sessions recorded.');
    else for (const session of [...this.stateValue.sessions].reverse()) {
      const card = recordCard(session.title, `${session.status} · ${session.startedAt === null ? 'not started' : new Date(session.startedAt).toLocaleString()}`, session.recap);
      if (session.unusedPreparedSceneIds.length > 0) {
        const unused = document.createElement('small'); unused.textContent = `${session.unusedPreparedSceneIds.length} prepared scene(s) unused.`; card.append(unused);
      }
      this.sessionList.append(card);
    }
    this.checkpointList.replaceChildren();
    if (this.stateValue.checkpoints.length === 0) clearAndEmpty(this.checkpointList, 'No recovery checkpoints.');
    else for (const checkpoint of [...this.stateValue.checkpoints].reverse().slice(0, 12)) {
      const row = recordCard(checkpoint.label, `${new Date(checkpoint.timestamp).toLocaleString()} · revision ${checkpoint.revision}`);
      const actions = document.createElement('div'); actions.className = 'campaign-record-actions';
      const restore = document.createElement('button'); restore.type = 'button'; restore.textContent = 'Restore';
      restore.addEventListener('click', () => {
        if (!window.confirm(`Restore “${checkpoint.label}”? Newer campaign changes remain in history but the checkpointed run state will replace current run state.`)) return;
        const next = restoreCheckpoint(this.stateValue, checkpoint.id);
        this.stateValue = next;
        this.dependencies.onTimeChange(next.runState.campaignTime, next.runState.timezone);
        this.dependencies.onWeatherChange(next.runState.weatherOverride);
        this.commit();
      });
      actions.append(restore); row.append(actions); this.checkpointList.append(row);
    }
  }

  private renderRecentActivity(): void {
    this.recentActivity.replaceChildren();
    if (this.stateValue.activityLog.length === 0) { clearAndEmpty(this.recentActivity, 'No campaign actions yet.'); return; }
    for (const item of this.stateValue.activityLog.slice(0, 8)) {
      const row = document.createElement('div');
      const copy = document.createElement('span'); copy.textContent = item.summary;
      const time = document.createElement('small'); time.textContent = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      row.append(copy, time); this.recentActivity.append(row);
    }
  }

  private renderSearch(): void {
    const query = this.search.value.trim();
    if (query.length === 0) { clearAndEmpty(this.searchResults, 'Type to search.'); return; }
    const results = searchCampaign(this.stateValue, query);
    this.searchResults.replaceChildren();
    if (results.length === 0) { clearAndEmpty(this.searchResults, 'No campaign record matches.'); return; }
    for (const result of results.slice(0, 40)) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'campaign-search-result';
      const title = document.createElement('strong'); title.textContent = result.title;
      const subtitle = document.createElement('small'); subtitle.textContent = `${result.type} · ${result.subtitle}`;
      button.append(title, subtitle);
      button.addEventListener('click', () => {
        if (result.type === 'scene') { this.selectedSceneId = result.id; this.loadSceneForm(result.id); this.sceneName.scrollIntoView({ behavior: 'smooth', block: 'center' }); this.renderSceneList(); }
        else this.dependencies.notify(`Found ${result.type}: ${result.title}`, 'success');
      });
      this.searchResults.append(button);
    }
  }

  private renderReferenceHealth(): void {
    const context = this.referenceContext();
    const issues = validateCampaignReferences(this.stateValue, context);
    this.referenceHealth.replaceChildren();
    this.referenceHealth.dataset.state = issues.some((issue) => issue.severity === 'error') ? 'error' : issues.length > 0 ? 'warning' : 'healthy';
    if (issues.length === 0) { this.referenceHealth.textContent = 'All campaign references are healthy.'; return; }
    const strong = document.createElement('strong'); strong.textContent = `${issues.length} broken or stale reference${issues.length === 1 ? '' : 's'}`;
    const list = document.createElement('ul');
    for (const issue of issues.slice(0, 8)) { const item = document.createElement('li'); item.textContent = issue.message; list.append(item); }
    this.referenceHealth.append(strong, list);
  }

  private referenceContext(): CampaignReferenceContext {
    return {
      worldRef: this.dependencies.getWorldRef(),
      npcIds: new Set(this.dependencies.getNpcOptions().map((item) => item.id)),
      locationIds: new Set(this.dependencies.getLocationOptions().map((item) => item.id)),
      characterIds: new Set(this.dependencies.getCharacterOptions().map((item) => item.id)),
      externalAssetIds: this.dependencies.getExternalAssetIds(),
    };
  }

  private locationLabel(ref: string | null): string {
    if (ref === null) return '';
    return this.dependencies.getLocationOptions().find((location) => location.id === ref)?.label ?? ref;
  }

  private updateEventTriggerUi(): void {
    const kind = this.eventTriggerKind.value;
    this.eventTime.disabled = kind === 'manual' || kind === 'scene-activation' || kind === 'condition';
    this.eventScene.disabled = kind !== 'scene-activation' && kind !== 'manual' && kind !== 'time';
  }

  private setFeedback(message: string, kind: 'success' | 'warning' | 'error' = 'success'): void {
    this.actionFeedback.textContent = message;
    this.actionFeedback.dataset.state = kind;
    this.dependencies.notify(message, kind);
  }
}
