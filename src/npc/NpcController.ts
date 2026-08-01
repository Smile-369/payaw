import { readFileAsDataUrl } from '../customization/AssetRepository';
import { minuteFromTimeInput } from '../campaign/CampaignTime';
import {
  scheduleLocationFromRef,
  validateSchedule,
  type AuthoredLocationRecord,
  type NPCLocationAuthoringState,
  type NPCScenePlacement,
  type NPCTemporaryOverride,
  type VenueHoursEntry,
} from '../campaign/NPCLocationAuthoring';
import type { CampaignDay, NPC, NPCRelationship, NPCScheduleEntry } from '../engine/npc/NPC';
import type { EditorSession } from '../models/EditorSession';
import { createRuleId } from '../utils/Identifiers';
import * as elements from '../ui/AppElements';

type StatusTone = 'success' | 'warning' | 'error' | 'working' | 'idle';

interface CampaignLocationOption {
  readonly ref: string;
  readonly tileIndex: number;
}

export interface NpcControllerDependencies {
  readonly session: EditorSession;
  readonly regenerateRoster: () => void;
  readonly renderList: () => void;
  readonly toggleView: () => void;
  readonly createNpc: () => void;
  readonly selectedNpc: () => NPC | undefined;
  readonly filteredNpcs: () => readonly NPC[];
  readonly downloadJson: (npcs: readonly NPC[], name: string) => void;
  readonly importJson: (file: File) => Promise<void>;
  readonly saveNpc: () => void;
  readonly renderSelectors: (npc: NPC | undefined) => void;
  readonly campaignLocations: () => readonly CampaignLocationOption[];
  readonly nearestSettlementForTile: (tileIndex: number) => { readonly id: number } | undefined;
  readonly renderPortrait: (npc: NPC | undefined) => void;
  readonly updateAuthoring: (next: NPCLocationAuthoringState, message?: string) => void;
  readonly updateSchedule: (entries: readonly NPCScheduleEntry[], message?: string) => void;
  readonly updateRelationships: (relationships: readonly NPCRelationship[], message?: string) => void;
  readonly selectedLocation: () => AuthoredLocationRecord | undefined;
  readonly renderLocation: () => void;
  readonly saveLocation: (hoursOverride?: readonly VenueHoursEntry[]) => void;
  readonly setStatus: (message: string, tone?: StatusTone) => void;
}

export class NpcController {
  public constructor(private readonly dependencies: NpcControllerDependencies) {
    this.bindEvents();
  }

  private bindEvents(): void {
    const { session } = this.dependencies;
    elements.npcGenerateButton.addEventListener('click', this.dependencies.regenerateRoster);
    elements.npcSearch.addEventListener('input', this.dependencies.renderList);
    elements.npcViewToggleButton.addEventListener('click', this.dependencies.toggleView);
    elements.npcCreateButton.addEventListener('click', this.dependencies.createNpc);
    elements.npcExportSelected.addEventListener('click', () => {
      const npc = this.dependencies.selectedNpc();
      if (npc === undefined) {
        this.dependencies.setStatus('Select an NPC before exporting it.', 'warning');
        return;
      }
      this.dependencies.downloadJson([npc], npc.name);
    });
    elements.npcExportGroup.addEventListener('click', () => {
      const query = elements.npcSearch.value.trim();
      this.dependencies.downloadJson(
        this.dependencies.filteredNpcs(),
        query.length > 0 ? `${query} NPCs` : `${session.world.seed} NPC roster`,
      );
    });
    elements.npcImportFile.addEventListener('change', () => {
      const file = elements.npcImportFile.files?.[0];
      if (file === undefined) return;
      this.dependencies.setStatus('Validating NPC JSON…', 'working');
      void this.dependencies.importJson(file).catch((error: unknown) => {
        this.dependencies.setStatus(error instanceof Error ? error.message : String(error), 'error');
      });
      elements.npcImportFile.value = '';
    });
    elements.npcSaveButton.addEventListener('click', this.dependencies.saveNpc);
    elements.npcEditUnusualHome.addEventListener('change', () => this.dependencies.renderSelectors(this.dependencies.selectedNpc()));
    elements.npcEditSettlement.addEventListener('change', () => this.dependencies.renderSelectors(this.dependencies.selectedNpc()));
    elements.npcEditHome.addEventListener('change', () => {
      if (elements.npcEditHome.value === '') return;
      const option = this.dependencies.campaignLocations().find((candidate) => candidate.ref === `building:${elements.npcEditHome.value}`);
      const community = option === undefined ? undefined : this.dependencies.nearestSettlementForTile(option.tileIndex);
      if (community !== undefined) elements.npcEditSettlement.value = String(community.id);
    });
    elements.npcEditPortrait.addEventListener('change', async () => {
      const file = elements.npcEditPortrait.files?.[0];
      if (file === undefined) return;
      if (!file.type.startsWith('image/')) {
        this.dependencies.setStatus('Choose an image file for the NPC portrait.', 'error');
        elements.npcEditPortrait.value = '';
        return;
      }
      try {
        session.pendingNpcPortraitDataUrl = await readFileAsDataUrl(file);
        this.dependencies.renderPortrait(this.dependencies.selectedNpc());
        this.dependencies.setStatus('Portrait ready. Save the NPC to keep it.', 'success');
      } catch (error) {
        this.dependencies.setStatus(error instanceof Error ? error.message : String(error), 'error');
      }
    });
    elements.npcResetButton.addEventListener('click', () => this.resetNpc());
    elements.npcDeleteButton.addEventListener('click', () => this.deleteNpc());
    elements.npcScheduleAdd.addEventListener('click', () => this.addSchedule());
    elements.npcScheduleCopyWeekdays.addEventListener('click', () => this.copyScheduleToWeekdays());
    elements.npcScheduleClearDay.addEventListener('click', () => this.clearScheduleDay());
    elements.npcRelationshipAdd.addEventListener('click', () => this.addRelationship());
    elements.npcOverrideAdd.addEventListener('click', () => this.addTemporaryOverride());
    elements.npcScenePlace.addEventListener('click', () => this.addScenePlacement());
    elements.npcPlacementClear.addEventListener('click', () => this.clearPlacements());
    elements.locationSource.addEventListener('change', () => {
      session.selectedLocationRef = elements.locationSource.value || null;
      this.dependencies.renderLocation();
    });
    elements.locationSave.addEventListener('click', () => this.dependencies.saveLocation());
    elements.locationDelete.addEventListener('click', () => this.deleteLocation());
    elements.locationHoursClosed.addEventListener('change', () => {
      elements.locationHoursOpen.disabled = elements.locationHoursClosed.checked;
      elements.locationHoursClose.disabled = elements.locationHoursClosed.checked;
    });
    elements.locationHoursSave.addEventListener('click', () => this.saveLocationHours());
  }

  private resetNpc(): void {
    const npc = this.dependencies.selectedNpc();
    if (npc === undefined || npc.source === 'authored') return;
    const existing = this.dependencies.session.npcLocationAuthoring.npcOverrides.find((override) => override.npcKey === npc.key);
    if (existing === undefined) {
      this.dependencies.setStatus(`${npc.name} already uses generated defaults.`, 'warning');
      return;
    }
    this.dependencies.session.pendingNpcPortraitDataUrl = null;
    this.dependencies.updateAuthoring({
      ...this.dependencies.session.npcLocationAuthoring,
      npcOverrides: this.dependencies.session.npcLocationAuthoring.npcOverrides.filter((override) => override.npcKey !== npc.key),
    }, `Restored generated fields for ${npc.name}.`);
  }

  private deleteNpc(): void {
    const npc = this.dependencies.selectedNpc();
    if (npc === undefined || npc.source !== 'authored') return;
    const { session } = this.dependencies;
    session.selectedNpcKey = null;
    session.pendingNpcPortraitDataUrl = null;
    this.dependencies.updateAuthoring({
      ...session.npcLocationAuthoring,
      authoredNpcs: session.npcLocationAuthoring.authoredNpcs.filter((definition) => definition.key !== npc.key),
      temporaryOverrides: session.npcLocationAuthoring.temporaryOverrides.filter((override) => override.npcKey !== npc.key),
      scenePlacements: session.npcLocationAuthoring.scenePlacements.filter((placement) => placement.npcKey !== npc.key),
      locations: session.npcLocationAuthoring.locations.map((location) => location.ownerNpcKey === npc.key ? { ...location, ownerNpcKey: null } : location),
    }, `Deleted authored NPC ${npc.name}.`);
  }

  private addSchedule(): void {
    const npc = this.dependencies.selectedNpc();
    if (npc === undefined) return;
    const { session } = this.dependencies;
    const startMinute = minuteFromTimeInput(elements.npcScheduleStart.value);
    const endMinute = minuteFromTimeInput(elements.npcScheduleEnd.value);
    const location = scheduleLocationFromRef(session.world, session.authoringLayer, elements.npcScheduleLocation.value);
    if (startMinute === null || endMinute === null || endMinute <= startMinute) {
      this.dependencies.setStatus('Schedule blocks need a valid start time before the end time.', 'error');
      return;
    }
    if (location === undefined) {
      this.dependencies.setStatus('Choose a valid schedule location.', 'error');
      return;
    }
    const entry: NPCScheduleEntry = {
      id: `schedule:${createRuleId()}`,
      day: session.selectedNpcScheduleDay,
      startMinute,
      endMinute,
      activity: elements.npcScheduleActivity.value.trim() || 'At location',
      location,
      travelMode: elements.npcScheduleTravel.value as NPCScheduleEntry['travelMode'],
      visibility: elements.npcScheduleVisibility.value as NPCScheduleEntry['visibility'],
    };
    const next = [...npc.weeklySchedule, entry];
    const errors = validateSchedule(next);
    if (errors.length > 0) {
      this.dependencies.setStatus(errors[0] ?? 'That schedule block conflicts with another block.', 'error');
      return;
    }
    this.dependencies.updateSchedule(next, `Added ${entry.activity} to ${session.selectedNpcScheduleDay}.`);
  }

  private copyScheduleToWeekdays(): void {
    const npc = this.dependencies.selectedNpc();
    if (npc === undefined) return;
    const selectedDay = this.dependencies.session.selectedNpcScheduleDay;
    const source = npc.weeklySchedule.filter((entry) => entry.day === selectedDay);
    if (source.length === 0) {
      this.dependencies.setStatus('The selected day has no schedule blocks to copy.', 'warning');
      return;
    }
    const weekdays: readonly CampaignDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const retained = npc.weeklySchedule.filter((entry) => !weekdays.includes(entry.day));
    const copied = weekdays.flatMap((day) => source.map((entry) => ({ ...entry, id: `schedule:${createRuleId()}`, day })));
    this.dependencies.updateSchedule([...retained, ...copied], `Copied ${selectedDay} to weekdays.`);
  }

  private clearScheduleDay(): void {
    const npc = this.dependencies.selectedNpc();
    if (npc === undefined) return;
    const day = this.dependencies.session.selectedNpcScheduleDay;
    this.dependencies.updateSchedule(npc.weeklySchedule.filter((entry) => entry.day !== day), `Cleared ${day}.`);
  }

  private addRelationship(): void {
    const npc = this.dependencies.selectedNpc();
    const targetId = Number(elements.npcRelationshipTarget.value);
    if (npc === undefined || !Number.isInteger(targetId) || targetId === npc.id) {
      this.dependencies.setStatus('Choose another NPC for the relationship.', 'error');
      return;
    }
    const relationship: NPCRelationship = {
      npcId: targetId,
      kind: elements.npcRelationshipKind.value as NPCRelationship['kind'],
      ...(elements.npcRelationshipLabel.value.trim() ? { label: elements.npcRelationshipLabel.value.trim() } : {}),
      hidden: elements.npcRelationshipHidden.checked,
    };
    const next = [...npc.relationships.filter((item) => !(item.npcId === targetId && item.kind === relationship.kind)), relationship];
    elements.npcRelationshipLabel.value = '';
    this.dependencies.updateRelationships(next, 'Saved NPC relationship.');
  }

  private addTemporaryOverride(): void {
    const npc = this.dependencies.selectedNpc();
    const { session } = this.dependencies;
    const location = scheduleLocationFromRef(session.world, session.authoringLayer, elements.npcOverrideLocation.value);
    if (npc === undefined || location === undefined) {
      this.dependencies.setStatus('Choose an NPC and a valid temporary location.', 'error');
      return;
    }
    const startsAtMs = session.simulation?.state().time.campaignTimestampMs ?? Date.now();
    const durationMinutes = Math.max(1, Number(elements.npcOverrideDuration.value) || 60);
    const override: NPCTemporaryOverride = {
      id: `npc-override:${createRuleId()}`,
      npcKey: npc.key,
      startsAtMs,
      endsAtMs: startsAtMs + durationMinutes * 60_000,
      location,
      activity: elements.npcOverrideActivity.value.trim() || 'Temporarily present',
      reason: elements.npcOverrideReason.value.trim(),
      priority: 100,
    };
    this.dependencies.updateAuthoring({ ...session.npcLocationAuthoring, temporaryOverrides: [...session.npcLocationAuthoring.temporaryOverrides, override] }, `Temporarily placed ${npc.name} at ${location.label}.`);
  }

  private addScenePlacement(): void {
    const npc = this.dependencies.selectedNpc();
    const { session } = this.dependencies;
    const location = scheduleLocationFromRef(session.world, session.authoringLayer, elements.npcOverrideLocation.value);
    if (npc === undefined || location === undefined) {
      this.dependencies.setStatus('Choose an NPC and a valid scene location.', 'error');
      return;
    }
    const sceneId = elements.npcSceneId.value.trim() || session.npcLocationAuthoring.activeSceneId || 'scene-1';
    const placement: NPCScenePlacement = {
      id: `npc-scene:${createRuleId()}`,
      sceneId,
      npcKey: npc.key,
      location,
      activity: elements.npcOverrideActivity.value.trim() || 'Present in scene',
      visibleToPlayers: elements.npcSceneVisible.checked,
    };
    this.dependencies.updateAuthoring({
      ...session.npcLocationAuthoring,
      activeSceneId: sceneId,
      scenePlacements: [...session.npcLocationAuthoring.scenePlacements.filter((candidate) => !(candidate.sceneId === sceneId && candidate.npcKey === npc.key)), placement],
    }, `Placed ${npc.name} in ${sceneId}.`);
  }

  private clearPlacements(): void {
    const npc = this.dependencies.selectedNpc();
    if (npc === undefined) return;
    const { session } = this.dependencies;
    this.dependencies.updateAuthoring({
      ...session.npcLocationAuthoring,
      temporaryOverrides: session.npcLocationAuthoring.temporaryOverrides.filter((override) => override.npcKey !== npc.key),
      scenePlacements: session.npcLocationAuthoring.scenePlacements.filter((placement) => placement.npcKey !== npc.key),
    }, `Cleared live placements for ${npc.name}.`);
  }

  private deleteLocation(): void {
    const record = this.dependencies.selectedLocation();
    if (record === undefined) return;
    this.dependencies.updateAuthoring({
      ...this.dependencies.session.npcLocationAuthoring,
      locations: this.dependencies.session.npcLocationAuthoring.locations.filter((candidate) => candidate.sourceRef !== record.sourceRef),
    }, `Removed the authored record for ${record.name}.`);
  }

  private saveLocationHours(): void {
    const record = this.dependencies.selectedLocation();
    const day = elements.locationHoursDay.value as CampaignDay;
    const openMinute = minuteFromTimeInput(elements.locationHoursOpen.value);
    const closeMinute = minuteFromTimeInput(elements.locationHoursClose.value);
    if (!elements.locationHoursClosed.checked && (openMinute === null || closeMinute === null || closeMinute <= openMinute)) {
      this.dependencies.setStatus('Venue hours need a valid opening time before the closing time.', 'error');
      return;
    }
    const entry: VenueHoursEntry = {
      day,
      openMinute: openMinute ?? 8 * 60,
      closeMinute: closeMinute ?? 17 * 60,
      closed: elements.locationHoursClosed.checked,
    };
    const hours = [...(record?.venueHours ?? []).filter((candidate) => candidate.day !== day), entry];
    this.dependencies.saveLocation(hours);
  }
}
