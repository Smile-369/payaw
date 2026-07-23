export enum RoadType {
  Main = 'main',
  Secondary = 'secondary',
  Local = 'local',
}

export interface Road {
  readonly id: number;
  name: string;
  readonly type: RoadType;
  readonly path: readonly number[];
  readonly bridgeTiles: readonly number[];
  readonly connectsAnchorIds: readonly number[];
  readonly connectsSettlementIds: readonly number[];
  readonly length: number;
  /** null for ordinary roads; otherwise the owning inter-island bridge. */
  readonly bridgeId: number | null;
  /** null unless this is an approach road created for a maritime port. */
  readonly portId: number | null;
  /** Stable identity before authoring suppression and runtime reindexing. */
  readonly generatedId?: number;
  readonly source?: 'generated' | 'authored';
  readonly authoringFeatureId?: string;
}
