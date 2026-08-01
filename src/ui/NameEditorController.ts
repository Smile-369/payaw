import type { EditorSession } from '../models/EditorSession';
import * as elements from './AppElements';

type StatusTone = 'success' | 'warning' | 'error' | 'working' | 'idle';

export interface NameEditorDependencies<TSnapshot> {
  readonly session: EditorSession;
  readonly captureSnapshot: () => TSnapshot;
  readonly recordHistory: (snapshot: TSnapshot, label: string) => void;
  readonly persistNames: () => void;
  readonly regenerateFrom: (stage: string, message: string) => boolean;
  readonly requestRender: () => void;
  readonly setStatus: (message: string, tone?: StatusTone) => void;
}

export class NameEditorController<TSnapshot> {
  public constructor(private readonly dependencies: NameEditorDependencies<TSnapshot>) {
    elements.roadNameTarget.addEventListener('change', () => this.syncRoadInput());
    elements.blockNameTarget.addEventListener('change', () => this.syncBlockInput());
    elements.roadNameForm.addEventListener('submit', (event) => this.renameRoad(event));
    elements.roadNameReset.addEventListener('click', () => this.resetRoad());
    elements.blockNameForm.addEventListener('submit', (event) => this.renameBlock(event));
    elements.blockNameReset.addEventListener('click', () => this.resetBlock());
  }

  public render(): void {
    const world = this.dependencies.session.world;
    const selectedRoad = Number(elements.roadNameTarget.value);
    elements.roadNameTarget.replaceChildren(...world.roads.map((road) => {
      const option = document.createElement('option');
      option.value = String(road.id);
      option.textContent = `#${road.id} · ${road.name} · ${road.type}`;
      return option;
    }));
    elements.roadNameTarget.value = world.roads[selectedRoad] === undefined ? '0' : String(selectedRoad);
    this.syncRoadInput();

    const selectedBlock = Number(elements.blockNameTarget.value);
    elements.blockNameTarget.replaceChildren(...world.blocks.map((block) => {
      const option = document.createElement('option');
      option.value = String(block.id);
      const zone = block.zoneId === null ? 'unassigned' : world.zones[block.zoneId]?.type ?? 'unassigned';
      option.textContent = `#${block.id} · ${block.name} · ${zone}`;
      return option;
    }));
    elements.blockNameTarget.value = world.blocks[selectedBlock] === undefined ? '0' : String(selectedBlock);
    this.syncBlockInput();
  }

  private syncRoadInput(): void {
    elements.roadNameInput.value = this.dependencies.session.world.roads[Number(elements.roadNameTarget.value)]?.name ?? '';
  }

  private syncBlockInput(): void {
    elements.blockNameInput.value = this.dependencies.session.world.blocks[Number(elements.blockNameTarget.value)]?.name ?? '';
  }

  private renameRoad(event: SubmitEvent): void {
    event.preventDefault();
    const id = Number(elements.roadNameTarget.value);
    const name = elements.roadNameInput.value.trim();
    const road = this.dependencies.session.world.roads[id];
    if (road === undefined || name.length === 0) return;
    const snapshot = this.dependencies.captureSnapshot();
    this.dependencies.session.renameRoad(id, name);
    this.dependencies.persistNames();
    this.render();
    this.dependencies.requestRender();
    this.dependencies.recordHistory(snapshot, `rename road ${road.name}`);
    this.dependencies.setStatus(`Renamed road #${id}.`, 'success');
  }

  private resetRoad(): void {
    const snapshot = this.dependencies.captureSnapshot();
    const id = Number(elements.roadNameTarget.value);
    this.dependencies.session.roadNameOverrides = this.dependencies.session.roadNameOverrides.filter((item) => item.id !== id);
    this.dependencies.persistNames();
    if (this.dependencies.regenerateFrom('place-naming', `Reset road #${id} name.`)) {
      this.dependencies.recordHistory(snapshot, 'reset road name');
    }
  }

  private renameBlock(event: SubmitEvent): void {
    event.preventDefault();
    const id = Number(elements.blockNameTarget.value);
    const name = elements.blockNameInput.value.trim();
    const block = this.dependencies.session.world.blocks[id];
    if (block === undefined || name.length === 0) return;
    const snapshot = this.dependencies.captureSnapshot();
    this.dependencies.session.renameBlock(id, name);
    this.dependencies.persistNames();
    this.render();
    this.dependencies.requestRender();
    this.dependencies.recordHistory(snapshot, `rename block ${block.name}`);
    this.dependencies.setStatus(`Renamed block #${id}.`, 'success');
  }

  private resetBlock(): void {
    const snapshot = this.dependencies.captureSnapshot();
    const id = Number(elements.blockNameTarget.value);
    this.dependencies.session.blockNameOverrides = this.dependencies.session.blockNameOverrides.filter((item) => item.id !== id);
    this.dependencies.persistNames();
    if (this.dependencies.regenerateFrom('place-naming', `Reset block #${id} name.`)) {
      this.dependencies.recordHistory(snapshot, 'reset block name');
    }
  }
}
