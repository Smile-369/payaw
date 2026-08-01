import type { AuthoringFeatureCategory } from './AuthoringLayer';
import type { EditorSession } from '../models/EditorSession';
import * as elements from '../ui/AppElements';

export interface AuthoringControllerDependencies<TSnapshot> {
  readonly session: EditorSession;
  readonly setTool: (tool: EditorSession['authoringTool']) => void;
  readonly beginSettlementPlacement: (duplicate: boolean) => void;
  readonly applyAnchorDetails: () => void;
  readonly updateAnchorType: () => void;
  readonly renderLists: () => void;
  readonly applyFeatureDetails: () => void;
  readonly finishFeature: () => void;
  readonly captureSnapshot: () => TSnapshot;
  readonly persist: () => void;
  readonly regenerateFrom: (stage: string, message: string) => boolean;
  readonly recordHistory: (snapshot: TSnapshot, label: string) => void;
  readonly syncMap: () => void;
  readonly setAuthoringStatus: (message: string) => void;
  readonly resetSelection: (deleteSelection: boolean) => void;
  readonly setWorkspace: (workspace: 'editor' | 'dm') => void;
}

export class AuthoringController<TSnapshot> {
  private bound = false;

  public constructor(private readonly dependencies: AuthoringControllerDependencies<TSnapshot>) {}

  public initialize(): void {
    if (!this.bound) {
      this.bindEvents();
      this.bound = true;
    }
    this.dependencies.updateAnchorType();
    this.dependencies.setTool('select');
  }

  private bindEvents(): void {
    const { session } = this.dependencies;
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-authoring-tool]')) {
      button.addEventListener('click', () => this.dependencies.setTool(button.dataset.authoringTool as EditorSession['authoringTool']));
    }
    elements.authoringPlaceSettlement.addEventListener('click', () => this.dependencies.beginSettlementPlacement(false));
    elements.authoringApplySettlement.addEventListener('click', this.dependencies.applyAnchorDetails);
    elements.authoringDuplicateSettlement.addEventListener('click', () => this.dependencies.beginSettlementPlacement(true));
    elements.authoringSettlementKind.addEventListener('change', () => {
      session.pendingSettlementPlacement = null;
      session.pendingPointAnchorPlacement = false;
      session.activeAuthoringSettlementKey = null;
      session.activeAuthoringFeatureId = null;
      this.dependencies.updateAnchorType();
      this.dependencies.renderLists();
      this.dependencies.setTool('select');
    });
    elements.authoringStartFeature.addEventListener('click', this.dependencies.applyFeatureDetails);
    elements.authoringFinishFeature.addEventListener('click', this.dependencies.finishFeature);
    elements.authoringCancelFeature.addEventListener('click', () => {
      session.pendingSettlementPlacement = null;
      session.pendingPointAnchorPlacement = false;
      session.authoringDraftPoints = [];
      elements.authoringStartFeature.textContent = session.activeAuthoringFeatureId === null ? 'Draw with selected tool' : 'Apply feature details';
      this.dependencies.setTool('select');
    });
    elements.authoringClearTerrain.addEventListener('click', () => this.clearTerrain());
    elements.authoringLockTerrain.addEventListener('click', () => this.toggleTerrainLocks());
    elements.authoringShowAll.addEventListener('click', () => this.showAll());
    elements.authoringResetSelected.addEventListener('click', () => this.dependencies.resetSelection(false));
    elements.authoringDeleteSelected.addEventListener('click', () => this.dependencies.resetSelection(true));
    elements.authoringFeatureCategory.addEventListener('change', () => this.applyCategoryDefaults());
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-open-authoring]')) {
      button.addEventListener('click', () => {
        this.dependencies.setWorkspace('editor');
        elements.authoringCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  private clearTerrain(): void {
    const { session } = this.dependencies;
    if (session.authoringLayer.terrainOverrides.length === 0) return;
    const snapshot = this.dependencies.captureSnapshot();
    session.authoringLayer = { ...session.authoringLayer, terrainOverrides: [] };
    this.dependencies.persist();
    if (this.dependencies.regenerateFrom('terrain', 'Cleared terrain overrides.')) {
      this.dependencies.recordHistory(snapshot, 'clear terrain overrides');
    }
  }

  private toggleTerrainLocks(): void {
    const { session } = this.dependencies;
    const snapshot = this.dependencies.captureSnapshot();
    const lock = session.authoringLayer.terrainOverrides.some((override) => !override.locked);
    session.authoringLayer = {
      ...session.authoringLayer,
      terrainOverrides: session.authoringLayer.terrainOverrides.map((override) => ({ ...override, locked: lock })),
    };
    this.dependencies.persist();
    this.dependencies.renderLists();
    this.dependencies.syncMap();
    this.dependencies.recordHistory(snapshot, `${lock ? 'lock' : 'unlock'} terrain overrides`);
    this.dependencies.setAuthoringStatus(`${lock ? 'Locked' : 'Unlocked'} all terrain overrides.`);
  }

  private showAll(): void {
    const { session } = this.dependencies;
    const snapshot = this.dependencies.captureSnapshot();
    session.authoringLayer = {
      ...session.authoringLayer,
      features: session.authoringLayer.features.map((feature) => ({ ...feature, hidden: false })),
      settlementOverrides: session.authoringLayer.settlementOverrides.map((override) => ({
        ...override,
        hidden: false,
        visibility: override.visibility === 'hidden' ? 'gm-only' : override.visibility,
      })),
    };
    this.dependencies.persist();
    if (this.dependencies.regenerateFrom('settlements', 'Revealed authored world features.')) {
      this.dependencies.recordHistory(snapshot, 'show authored world');
    }
  }

  private applyCategoryDefaults(): void {
    const category = elements.authoringFeatureCategory.value as AuthoringFeatureCategory;
    if (category === 'hidden-payaw') elements.authoringFeatureReality.value = 'hidden-payaw';
    if (category === 'river') elements.authoringFeatureColor.value = '#4ba4cf';
    else if (category === 'natural') elements.authoringFeatureColor.value = '#6cb778';
    else if (category === 'landmark') elements.authoringFeatureColor.value = '#f2c05e';
    else if (category === 'district') elements.authoringFeatureColor.value = '#73c7b0';
  }
}
