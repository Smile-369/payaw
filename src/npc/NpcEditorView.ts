import {
  CAMPAIGN_DAYS,
  collectCampaignLocations,
  isResidentialBuilding,
  resolveNpcPlacement,
  validateSchedule,
  venueStatusAt,
  type AuthoredLocationRecord,
  type CampaignLocationOption,
  type NPCLocationAuthoringState,
} from '../campaign/NPCLocationAuthoring';
import { minuteAsTime } from '../campaign/CampaignTime';
import { NPCStatus, type CampaignDay, type NPC, type NPCRelationship, type NPCScheduleEntry } from '../engine/npc/NPC';
import type { EditorSession } from '../models/EditorSession';
import * as elements from '../ui/AppElements';

interface NpcEditorViewDependencies {
  readonly session: EditorSession;
  readonly updateAuthoring: (next: NPCLocationAuthoringState, message?: string) => void;
  readonly updateSchedule: (entries: readonly NPCScheduleEntry[], message?: string) => void;
  readonly updateRelationships: (relationships: readonly NPCRelationship[], message?: string) => void;
  readonly focusMapPoint: (x: number, y: number) => void;
  readonly selectScheduleDay: (day: CampaignDay) => void;
  readonly selectLocation: (sourceRef: string) => void;
}

export class NpcEditorView {
  public constructor(private readonly dependencies: NpcEditorViewDependencies) {}

  public campaignLocations(): readonly CampaignLocationOption[] {
    const { session } = this.dependencies;
    return collectCampaignLocations(session.world, session.authoringLayer);
  }

  public selectedNpc(): NPC | undefined {
    const { session } = this.dependencies;
    return session.selectedNpcKey === null
      ? undefined
      : session.world.npcs.find((npc) => npc.key === session.selectedNpcKey);
  }

  public selectedLocation(): AuthoredLocationRecord | undefined {
    const { session } = this.dependencies;
    const sourceRef = session.selectedLocationRef ?? elements.locationSource.value;
    return session.npcLocationAuthoring.locations.find((record) => record.sourceRef === sourceRef);
  }

  public nearestSettlementForTile(tileIndex: number) {
    const { world } = this.dependencies.session;
    const tile = world.tiles[tileIndex];
    if (tile === undefined) return world.settlements[0];
    return [...world.settlements].sort((left, right) => (
      Math.hypot(left.x - tile.x, left.y - tile.y) - Math.hypot(right.x - tile.x, right.y - tile.y)
    ))[0];
  }

  public renderAll(): void {
    this.renderNpcEditor();
    this.renderLocationEditor();
  }

  public renderSelectors(npc: NPC | undefined): void {
    const { session } = this.dependencies;
    const preferredSettlement = elements.npcEditSettlement.value || String(npc?.settlementId ?? 0);
    this.replaceSelectOptions(
      elements.npcEditSettlement,
      session.world.settlements.map((settlement) => ({ value: String(settlement.id), label: settlement.name })),
      preferredSettlement,
    );
    const selectedSettlement = session.world.settlements.find((settlement) => String(settlement.id) === elements.npcEditSettlement.value);
    const distanceToSelected = (buildingId: number): number => {
      const option = this.campaignLocations().find((candidate) => candidate.ref === `building:${buildingId}`);
      const tile = option === undefined ? undefined : session.world.tiles[option.tileIndex];
      return selectedSettlement === undefined || tile === undefined
        ? Number.POSITIVE_INFINITY
        : Math.hypot(tile.x - selectedSettlement.x, tile.y - selectedSettlement.y);
    };

    const homeOptions = session.world.buildings
      .filter((building) => elements.npcEditUnusualHome.checked || isResidentialBuilding(building))
      .sort((left, right) => distanceToSelected(left.id) - distanceToSelected(right.id)
        || this.buildingCampaignLabel(left.id).localeCompare(this.buildingCampaignLabel(right.id)))
      .map((building) => ({ value: String(building.id), label: this.buildingCampaignLabel(building.id) }));
    this.replaceSelectOptions(
      elements.npcEditHome,
      [{ value: '', label: 'Home unassigned — choose a residential building' }, ...homeOptions],
      npc?.homeBuildingId === null || npc === undefined ? '' : String(npc.homeBuildingId),
    );

    const workplaceOptions = session.world.buildings
      .sort((left, right) => distanceToSelected(left.id) - distanceToSelected(right.id)
        || this.buildingCampaignLabel(left.id).localeCompare(this.buildingCampaignLabel(right.id)))
      .map((building) => ({ value: String(building.id), label: this.buildingCampaignLabel(building.id) }));
    this.replaceSelectOptions(
      elements.npcEditWorkplace,
      [{ value: '', label: 'No workplace assigned' }, ...workplaceOptions],
      npc?.workplaceBuildingId === null || npc === undefined ? '' : String(npc.workplaceBuildingId),
    );

    const locations = this.campaignLocations().map((location) => ({ value: location.ref, label: location.label }));
    this.replaceSelectOptions(elements.npcScheduleLocation, locations);
    this.replaceSelectOptions(elements.npcOverrideLocation, locations);
    this.replaceSelectOptions(
      elements.npcRelationshipTarget,
      session.world.npcs
        .filter((candidate) => candidate.key !== npc?.key)
        .map((candidate) => ({ value: String(candidate.id), label: candidate.name })),
    );
  }

  public renderPortrait(npc: NPC | undefined): void {
    const { session } = this.dependencies;
    elements.npcPortraitPreview.replaceChildren();
    const source = session.pendingNpcPortraitDataUrl ?? npc?.portraitDataUrl ?? null;
    if (source === null) {
      const placeholder = document.createElement('span');
      placeholder.textContent = npc === undefined ? 'No NPC selected' : npc.name.slice(0, 1).toLocaleUpperCase();
      elements.npcPortraitPreview.append(placeholder);
      return;
    }
    const image = document.createElement('img');
    image.src = source;
    image.alt = npc === undefined ? 'NPC portrait preview' : `${npc.name} portrait`;
    elements.npcPortraitPreview.append(image);
  }

  public renderNpcEditor(): void {
    const { session } = this.dependencies;
    const npc = this.selectedNpc();
    const controls: Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement> = [
      elements.npcEditName, elements.npcEditAge, elements.npcEditStatus, elements.npcEditOccupation,
      elements.npcEditSettlement, elements.npcEditHome, elements.npcEditUnusualHome, elements.npcEditWorkplace,
      elements.npcEditPublicDescription, elements.npcEditPersonality, elements.npcEditWish, elements.npcEditFear,
      elements.npcEditSecret, elements.npcEditRumor, elements.npcEditTags, elements.npcEditNotes,
      elements.npcEditPortrait, elements.npcSaveButton, elements.npcScheduleStart, elements.npcScheduleEnd,
      elements.npcScheduleActivity, elements.npcScheduleLocation, elements.npcScheduleTravel,
      elements.npcScheduleVisibility, elements.npcScheduleAdd, elements.npcScheduleCopyWeekdays,
      elements.npcScheduleClearDay, elements.npcRelationshipTarget, elements.npcRelationshipKind,
      elements.npcRelationshipHidden, elements.npcRelationshipLabel, elements.npcRelationshipAdd,
      elements.npcOverrideLocation, elements.npcOverrideActivity, elements.npcOverrideDuration,
      elements.npcSceneId, elements.npcOverrideReason, elements.npcSceneVisible, elements.npcOverrideAdd,
      elements.npcScenePlace, elements.npcPlacementClear,
    ];
    controls.forEach((control) => { control.disabled = npc === undefined; });
    elements.npcResetButton.disabled = npc === undefined || npc.source === 'authored';
    elements.npcDeleteButton.disabled = npc === undefined || npc.source !== 'authored';

    if (npc === undefined) {
      elements.npcEditorHeading.textContent = 'Select an NPC or create one.';
      elements.npcEditName.value = '';
      elements.npcEditAge.value = '30';
      elements.npcEditStatus.value = NPCStatus.Alive;
      elements.npcEditOccupation.value = '';
      elements.npcEditPublicDescription.value = '';
      elements.npcEditPersonality.value = '';
      elements.npcEditWish.value = '';
      elements.npcEditFear.value = '';
      elements.npcEditSecret.value = '';
      elements.npcEditRumor.value = '';
      elements.npcEditTags.value = '';
      elements.npcEditNotes.value = '';
      this.renderSelectors(undefined);
      this.renderPortrait(undefined);
      this.renderSchedule(undefined);
      this.renderRelationships(undefined);
      this.renderPlacements(undefined);
      return;
    }

    elements.npcEditorHeading.textContent = `${npc.source === 'authored' ? 'Authored NPC' : 'Generated suggestion'} · ${npc.name}`;
    elements.npcEditName.value = npc.name;
    elements.npcEditAge.value = String(npc.age);
    elements.npcEditStatus.value = npc.status;
    elements.npcEditOccupation.value = npc.occupation;
    elements.npcEditUnusualHome.checked = session.npcLocationAuthoring.authoredNpcs
      .find((definition) => definition.key === npc.key)?.allowNonResidentialHome
      ?? session.npcLocationAuthoring.npcOverrides
        .find((override) => override.npcKey === npc.key)?.allowNonResidentialHome
      ?? false;
    this.renderSelectors(npc);
    elements.npcEditSettlement.value = String(npc.settlementId);
    elements.npcEditHome.value = npc.homeBuildingId === null ? '' : String(npc.homeBuildingId);
    elements.npcEditWorkplace.value = npc.workplaceBuildingId === null ? '' : String(npc.workplaceBuildingId);
    elements.npcEditPublicDescription.value = npc.publicDescription ?? '';
    elements.npcEditPersonality.value = npc.personality;
    elements.npcEditWish.value = npc.wish;
    elements.npcEditFear.value = npc.fear;
    elements.npcEditSecret.value = npc.secret;
    elements.npcEditRumor.value = npc.rumor;
    elements.npcEditTags.value = (npc.tags ?? []).join(', ');
    elements.npcEditNotes.value = npc.gmNotes ?? '';
    this.renderPortrait(npc);
    this.renderSchedule(npc);
    this.renderRelationships(npc);
    this.renderPlacements(npc);
  }

  public renderLocationEditor(): void {
    const { session } = this.dependencies;
    const options = this.campaignLocations();
    const selectedRef = session.selectedLocationRef !== null
      && options.some((option) => option.ref === session.selectedLocationRef)
      ? session.selectedLocationRef
      : options[0]?.ref ?? null;
    if (selectedRef !== session.selectedLocationRef) this.dependencies.selectLocation(selectedRef ?? '');
    this.replaceSelectOptions(
      elements.locationSource,
      options.map((option) => ({ value: option.ref, label: option.label })),
      selectedRef ?? '',
    );
    elements.locationSource.disabled = options.length === 0;
    const record = this.selectedLocation();
    const source = options.find((option) => option.ref === selectedRef);

    elements.locationName.value = record?.name ?? source?.label ?? '';
    elements.locationType.value = record?.locationType ?? (source?.kind ?? 'location');
    elements.locationVisibility.value = record?.visibility ?? 'gm-only';
    elements.locationStatus.value = record?.manualStatus ?? '';
    elements.locationTags.value = record?.tags.join(', ') ?? '';
    elements.locationDescription.value = record?.description ?? '';
    elements.locationPlayerDescription.value = record?.playerDescription ?? '';
    elements.locationNotes.value = record?.gmNotes ?? '';
    this.replaceSelectOptions(
      elements.locationOwner,
      [{ value: '', label: 'No owner assigned' }, ...session.world.npcs.map((npc) => ({ value: npc.key, label: npc.name }))],
      record?.ownerNpcKey ?? '',
    );
    elements.locationDelete.disabled = record === undefined;
    elements.locationSave.disabled = source === undefined;
    elements.locationHoursSave.disabled = source === undefined;
    this.renderVenueHours(record);
    this.renderLocationList(options);
  }

  private renderSchedule(npc: NPC | undefined): void {
    const { session } = this.dependencies;
    elements.npcScheduleDayTabs.replaceChildren();
    for (const day of CAMPAIGN_DAYS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = day.slice(0, 3).toLocaleUpperCase();
      button.dataset.active = String(day === session.selectedNpcScheduleDay);
      button.addEventListener('click', () => {
        this.dependencies.selectScheduleDay(day);
        this.renderSchedule(this.selectedNpc());
      });
      elements.npcScheduleDayTabs.append(button);
    }

    elements.npcScheduleList.replaceChildren();
    const entries = (npc?.weeklySchedule ?? [])
      .filter((entry) => entry.day === session.selectedNpcScheduleDay)
      .sort((left, right) => left.startMinute - right.startMinute);
    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'helper-text empty-authoring-state';
      empty.textContent = npc === undefined
        ? 'Select an NPC to edit a schedule.'
        : 'No blocks on this day. Schedule gaps resolve to the residential home.';
      elements.npcScheduleList.append(empty);
    }
    for (const entry of entries) {
      const row = document.createElement('article');
      row.className = 'schedule-entry';
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = `${minuteAsTime(entry.startMinute)}–${minuteAsTime(entry.endMinute)} · ${entry.activity}`;
      const meta = document.createElement('small');
      meta.textContent = `${entry.location.label} · ${entry.travelMode.replace('-', ' ')} · ${entry.visibility.replace('-', ' ')}`;
      copy.append(title, meta);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => this.dependencies.updateSchedule(
        (npc?.weeklySchedule ?? []).filter((candidate) => candidate.id !== entry.id),
        'Removed schedule block.',
      ));
      row.append(copy, remove);
      elements.npcScheduleList.append(row);
    }
    const errors = validateSchedule(npc?.weeklySchedule ?? []);
    elements.npcScheduleValidation.dataset.valid = String(errors.length === 0);
    elements.npcScheduleValidation.textContent = errors.length === 0
      ? npc === undefined ? '' : 'Schedule valid. Unscheduled time resolves to home.'
      : errors.join(' ');
  }

  private renderRelationships(npc: NPC | undefined): void {
    const { session } = this.dependencies;
    elements.npcRelationshipList.replaceChildren();
    if (npc === undefined || npc.relationships.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'helper-text empty-authoring-state';
      empty.textContent = npc === undefined ? 'Select an NPC to edit relationships.' : 'No authored relationships.';
      elements.npcRelationshipList.append(empty);
      return;
    }
    for (let index = 0; index < npc.relationships.length; index += 1) {
      const relationship = npc.relationships[index];
      if (relationship === undefined) continue;
      const target = session.world.npcs.find((candidate) => candidate.id === relationship.npcId);
      const row = document.createElement('article');
      row.className = 'relationship-entry';
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = `${target?.name ?? 'Missing NPC'} · ${relationship.kind}`;
      const meta = document.createElement('small');
      meta.textContent = [relationship.label, relationship.hidden ? 'GM only' : 'visible'].filter(Boolean).join(' · ');
      copy.append(title, meta);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => this.dependencies.updateRelationships(
        npc.relationships.filter((_, candidateIndex) => candidateIndex !== index),
        'Removed relationship.',
      ));
      row.append(copy, remove);
      elements.npcRelationshipList.append(row);
    }
  }

  private renderPlacements(npc: NPC | undefined): void {
    const { session } = this.dependencies;
    elements.npcPlacementList.replaceChildren();
    if (npc === undefined) {
      const empty = document.createElement('p');
      empty.className = 'helper-text empty-authoring-state';
      empty.textContent = 'Select an NPC to place them in a scene or temporarily override their routine.';
      elements.npcPlacementList.append(empty);
      return;
    }
    const timestamp = session.simulation?.state().time.campaignTimestampMs ?? Date.now();
    const timezone = session.simulation?.state().time.timezone ?? 'Asia/Manila';
    const resolved = resolveNpcPlacement(session.world, npc, session.npcLocationAuthoring, timestamp, timezone);
    const now = document.createElement('article');
    now.className = 'placement-entry placement-current';
    const nowCopy = document.createElement('div');
    const nowTitle = document.createElement('strong');
    nowTitle.textContent = `Now: ${resolved.location.label}`;
    const nowMeta = document.createElement('small');
    nowMeta.textContent = `${resolved.activity} · source: ${resolved.source}`;
    nowCopy.append(nowTitle, nowMeta);
    const focus = document.createElement('button');
    focus.type = 'button';
    focus.textContent = 'Focus';
    focus.addEventListener('click', () => {
      const tile = session.world.tiles[resolved.location.tileIndex];
      if (tile !== undefined) this.dependencies.focusMapPoint(tile.x, tile.y);
    });
    now.append(nowCopy, focus);
    elements.npcPlacementList.append(now);

    const temporary = session.npcLocationAuthoring.temporaryOverrides.filter((override) => override.npcKey === npc.key);
    const scenes = session.npcLocationAuthoring.scenePlacements.filter((placement) => placement.npcKey === npc.key);
    for (const placement of [...temporary, ...scenes]) {
      const isTemporary = 'startsAtMs' in placement;
      const row = document.createElement('article');
      row.className = 'placement-entry';
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = `${isTemporary ? 'Temporary' : `Scene ${placement.sceneId}`} · ${placement.location.label}`;
      const meta = document.createElement('small');
      meta.textContent = isTemporary
        ? `${placement.activity} · until ${new Date(placement.endsAtMs).toLocaleString()}`
        : `${placement.activity}${placement.sceneId === session.npcLocationAuthoring.activeSceneId ? ' · active' : ''}`;
      copy.append(title, meta);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => this.dependencies.updateAuthoring({
        ...session.npcLocationAuthoring,
        temporaryOverrides: isTemporary
          ? session.npcLocationAuthoring.temporaryOverrides.filter((candidate) => candidate.id !== placement.id)
          : session.npcLocationAuthoring.temporaryOverrides,
        scenePlacements: isTemporary
          ? session.npcLocationAuthoring.scenePlacements
          : session.npcLocationAuthoring.scenePlacements.filter((candidate) => candidate.id !== placement.id),
      }, 'Removed NPC placement.'));
      row.append(copy, remove);
      elements.npcPlacementList.append(row);
    }
  }

  private renderVenueHours(record: AuthoredLocationRecord | undefined): void {
    elements.locationHoursList.replaceChildren();
    for (const day of CAMPAIGN_DAYS) {
      const hours = record?.venueHours.find((entry) => entry.day === day);
      const row = document.createElement('article');
      row.className = 'venue-hours-entry';
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = day.charAt(0).toLocaleUpperCase() + day.slice(1);
      const meta = document.createElement('small');
      meta.textContent = hours === undefined
        ? 'No hours authored'
        : hours.closed ? 'Closed all day' : `${minuteAsTime(hours.openMinute)}–${minuteAsTime(hours.closeMinute)}`;
      copy.append(title, meta);
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => {
        elements.locationHoursDay.value = day;
        elements.locationHoursOpen.value = minuteAsTime(hours?.openMinute ?? 8 * 60);
        elements.locationHoursClose.value = minuteAsTime(hours?.closeMinute ?? 17 * 60);
        elements.locationHoursClosed.checked = hours?.closed ?? false;
      });
      row.append(copy, edit);
      elements.locationHoursList.append(row);
    }
  }

  private renderLocationList(options: readonly CampaignLocationOption[]): void {
    const { session } = this.dependencies;
    elements.locationList.replaceChildren();
    if (session.npcLocationAuthoring.locations.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'helper-text empty-authoring-state';
      empty.textContent = 'No authored locations yet. Select a map source and save it as a campaign location.';
      elements.locationList.append(empty);
    }
    const timestamp = session.simulation?.state().time.campaignTimestampMs ?? Date.now();
    const timezone = session.simulation?.state().time.timezone ?? 'Asia/Manila';
    for (const location of session.npcLocationAuthoring.locations) {
      const row = document.createElement('article');
      row.className = 'location-entry';
      row.dataset.selected = String(location.sourceRef === session.selectedLocationRef);
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = location.name;
      const meta = document.createElement('small');
      meta.textContent = `${location.locationType} · ${location.visibility.replace('-', ' ')} · ${venueStatusAt(location, timestamp, timezone).replace('-', ' ')}`;
      copy.append(title, meta);
      const actions = document.createElement('div');
      actions.className = 'compact-buttons';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => {
        this.dependencies.selectLocation(location.sourceRef);
        this.renderLocationEditor();
      });
      const focus = document.createElement('button');
      focus.type = 'button';
      focus.textContent = 'Focus';
      focus.addEventListener('click', () => {
        const option = options.find((candidate) => candidate.ref === location.sourceRef);
        const tile = option === undefined ? undefined : session.world.tiles[option.tileIndex];
        if (tile !== undefined) this.dependencies.focusMapPoint(tile.x, tile.y);
      });
      actions.append(edit, focus);
      row.append(copy, actions);
      elements.locationList.append(row);
    }
  }

  private buildingCampaignLabel(buildingId: number): string {
    const location = this.campaignLocations().find((candidate) => candidate.ref === `building:${buildingId}`);
    const community = location === undefined ? undefined : this.nearestSettlementForTile(location.tileIndex);
    const buildingLabel = location?.label ?? `Building #${buildingId + 1}`;
    return community === undefined ? buildingLabel : `${community.name} · ${buildingLabel}`;
  }

  private replaceSelectOptions(
    select: HTMLSelectElement,
    options: readonly { readonly value: string; readonly label: string }[],
    preferredValue?: string,
  ): void {
    const previous = preferredValue ?? select.value;
    select.replaceChildren(...options.map(({ value, label }) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      return option;
    }));
    if (options.some((option) => option.value === previous)) select.value = previous;
  }
}
