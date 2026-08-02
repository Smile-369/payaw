import {
  createNpcJsonBundle,
  parseNpcJsonBundle,
  withSettlementNames,
  type NpcJsonBundle,
  type PortableNpcRecord,
} from '../campaign/NpcJson';
import {
  scheduleLocationFromRef,
  validateNpcHome,
  type AuthoredNPCDefinition,
  type NPCLocationAuthoringState,
} from '../campaign/NPCLocationAuthoring';
import type { NPC, NPCScheduleEntry } from '../engine/npc/NPC';
import type { EditorSession } from '../models/EditorSession';
import { createRuleId } from '../utils/Identifiers';

type StatusTone = 'success' | 'warning' | 'error';

interface NpcJsonDependencies {
  readonly session: EditorSession;
  readonly updateAuthoring: (next: NPCLocationAuthoringState, message?: string) => void;
  readonly setStatus: (message: string, tone: StatusTone) => void;
}

export class NpcJsonController {
  public constructor(private readonly dependencies: NpcJsonDependencies) {}

  public download(npcs: readonly NPC[], name: string, includeWeeklySchedule = true): void {
    const { session } = this.dependencies;
    if (npcs.length === 0) {
      this.dependencies.setStatus('No NPCs are available for export.', 'warning');
      return;
    }
    const bundle = withSettlementNames(
      createNpcJsonBundle(
        npcs,
        session.world.npcs,
        { seed: session.world.seed, generationVersion: session.world.metadata.generationVersion },
        name,
        (key) => this.allowNonResidentialHome(key),
        includeWeeklySchedule,
      ),
      (settlementId) => session.world.settlements.find((settlement) => settlement.id === settlementId)?.name ?? '',
    );
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = bundle.name.replaceAll(/[^a-zA-Z0-9_-]/g, '_') || (bundle.kind === 'npc' ? 'npc' : 'npc-group');
    link.download = `${safeName}.${bundle.kind === 'npc' ? 'npc' : 'npc-group'}.json`;
    link.click();
    URL.revokeObjectURL(url);
    const omittedCount = Math.max(0, npcs.length - bundle.npcs.length);
    this.dependencies.setStatus(
      `Exported ${bundle.npcs.length} NPC${bundle.npcs.length === 1 ? '' : 's'} separately from the world.${omittedCount === 0 ? '' : ` The ${omittedCount} records above the 500-NPC portability limit were omitted.`}`,
      omittedCount === 0 ? 'success' : 'warning',
    );
  }

  public async importFile(file: File): Promise<void> {
    if (!file.name.toLocaleLowerCase().endsWith('.json') && file.type !== 'application/json' && file.type !== '') {
      throw new Error('Select a PAYAW NPC JSON file.');
    }
    if (file.size > 64 * 1024 * 1024) throw new Error('NPC JSON is larger than the 64 MB import limit.');
    const bundle = parseNpcJsonBundle(JSON.parse(await file.text()) as unknown);
    const definitions = this.authoredDefinitions(bundle);
    const { session } = this.dependencies;
    session.selectNpc(definitions[0]?.key ?? null);
    this.dependencies.updateAuthoring({
      ...session.npcLocationAuthoring,
      authoredNpcs: [...session.npcLocationAuthoring.authoredNpcs, ...definitions],
    }, `Imported ${definitions.length} NPC${definitions.length === 1 ? '' : 's'} from ${bundle.kind === 'npc' ? 'an NPC file' : 'an NPC group'}.`);
  }

  private allowNonResidentialHome(key: string): boolean {
    const { npcLocationAuthoring } = this.dependencies.session;
    const authored = npcLocationAuthoring.authoredNpcs.find((npc) => npc.key === key);
    if (authored !== undefined) return authored.allowNonResidentialHome;
    return npcLocationAuthoring.npcOverrides.find((npc) => npc.npcKey === key)?.allowNonResidentialHome === true;
  }

  private importedSettlementId(record: PortableNpcRecord, sameWorld: boolean): number {
    const { world } = this.dependencies.session;
    const byName = record.settlementName.length === 0
      ? undefined
      : world.settlements.find((settlement) => settlement.name.toLocaleLowerCase() === record.settlementName.toLocaleLowerCase());
    if (byName !== undefined) return byName.id;
    if (sameWorld && world.settlements.some((settlement) => settlement.id === record.settlementId)) return record.settlementId;
    return world.settlements[0]?.id ?? 0;
  }

  private importedHomeId(record: PortableNpcRecord, sameWorld: boolean): number | null {
    const { world } = this.dependencies.session;
    if (!sameWorld || record.homeBuildingId === null) return null;
    return validateNpcHome(world, record.homeBuildingId, record.allowNonResidentialHome) === null
      ? record.homeBuildingId
      : null;
  }

  private importedWorkplaceId(record: PortableNpcRecord, sameWorld: boolean): number | null {
    const { world } = this.dependencies.session;
    if (!sameWorld || record.workplaceBuildingId === null) return null;
    return world.buildings.some((building) => building.id === record.workplaceBuildingId)
      ? record.workplaceBuildingId
      : null;
  }

  private importedSchedule(
    record: PortableNpcRecord,
    settlementId: number,
    homeBuildingId: number | null,
    sameWorld: boolean,
  ): readonly NPCScheduleEntry[] {
    const { session } = this.dependencies;
    const settlement = session.world.settlements.find((candidate) => candidate.id === settlementId)
      ?? session.world.settlements[0];
    const home = homeBuildingId === null
      ? undefined
      : scheduleLocationFromRef(session.world, session.authoringLayer, `building:${homeBuildingId}`, 'Imported NPC home');
    const fallbackTileIndex = home?.tileIndex ?? settlement?.tileIndex ?? 0;
    return (record.weeklySchedule ?? []).map((entry) => {
      const resolved = sameWorld
        ? scheduleLocationFromRef(session.world, session.authoringLayer, entry.location.ref, entry.location.label)
        : undefined;
      return {
        ...entry,
        id: `schedule:${createRuleId()}`,
        location: resolved ?? {
          kind: 'custom',
          ref: `custom:imported:${createRuleId()}`,
          label: entry.location.label || 'Imported location',
          tileIndex: fallbackTileIndex,
        },
      };
    });
  }

  private authoredDefinitions(bundle: NpcJsonBundle): readonly AuthoredNPCDefinition[] {
    const { session } = this.dependencies;
    const availableSlots = Math.max(0, 500 - session.npcLocationAuthoring.authoredNpcs.length);
    if (availableSlots === 0) throw new Error('This world already has the maximum of 500 authored NPCs.');
    const records = bundle.npcs.slice(0, availableSlots);
    const sameWorld = bundle.sourceWorld.seed === session.world.seed
      && bundle.sourceWorld.generationVersion === session.world.metadata.generationVersion;
    const baseNpcId = session.world.npcs.length;
    const prepared = records.map((record, index) => {
      const settlementId = this.importedSettlementId(record, sameWorld);
      const homeBuildingId = this.importedHomeId(record, sameWorld);
      return {
        record,
        key: `npc:imported:${createRuleId()}`,
        npcId: baseNpcId + index,
        settlementId,
        homeBuildingId,
        workplaceBuildingId: this.importedWorkplaceId(record, sameWorld),
        weeklySchedule: this.importedSchedule(record, settlementId, homeBuildingId, sameWorld),
      };
    });
    const importedIdBySourceKey = new Map<string, number>();
    for (const item of prepared) {
      if (item.record.sourceKey.length > 0 && !importedIdBySourceKey.has(item.record.sourceKey)) {
        importedIdBySourceKey.set(item.record.sourceKey, item.npcId);
      }
    }
    const existingIdByKey = new Map(session.world.npcs.map((npc) => [npc.key, npc.id]));
    return prepared.map((item): AuthoredNPCDefinition => ({
      key: item.key,
      name: item.record.name,
      age: item.record.age,
      occupation: item.record.occupation,
      status: item.record.status,
      settlementId: item.settlementId,
      homeBuildingId: item.homeBuildingId,
      allowNonResidentialHome: item.record.allowNonResidentialHome && item.homeBuildingId !== null,
      workplaceBuildingId: item.workplaceBuildingId,
      personality: item.record.personality,
      wish: item.record.wish,
      fear: item.record.fear,
      secret: item.record.secret,
      rumor: item.record.rumor,
      weeklySchedule: item.weeklySchedule,
      relationships: item.record.relationships.flatMap((relationship) => {
        const targetId = importedIdBySourceKey.get(relationship.npcKey) ?? existingIdByKey.get(relationship.npcKey);
        if (targetId === undefined || targetId === item.npcId) return [];
        return [{
          npcId: targetId,
          kind: relationship.kind,
          ...(relationship.label === null ? {} : { label: relationship.label }),
          ...(relationship.notes === null ? {} : { notes: relationship.notes }),
          hidden: relationship.hidden,
        }];
      }),
      portraitAssetId: null,
      portraitDataUrl: item.record.portraitDataUrl,
      publicDescription: item.record.publicDescription,
      gmNotes: item.record.gmNotes,
      tags: item.record.tags,
    }));
  }
}
