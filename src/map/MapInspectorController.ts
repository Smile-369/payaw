import type { Building } from '../engine/buildings/Building';
import type { Road } from '../engine/infrastructure/Road';
import type { Camera } from '../engine/renderer/Camera';
import { WaterType } from '../engine/world/Tile';
import type { EditorSession } from '../models/EditorSession';

interface MapInspectorElements {
  readonly canvas: HTMLCanvasElement;
  readonly inspectorContent: HTMLElement;
  readonly focusSelectionButton: HTMLButtonElement;
  readonly minimapPanel: HTMLElement;
  readonly minimapCanvas: HTMLCanvasElement;
  readonly minimapCollapseButton: HTMLButtonElement;
  readonly statusSeed: HTMLElement;
  readonly statusLayout: HTMLElement;
  readonly statusZoom: HTMLElement;
  readonly statusSelection: HTMLElement;
  readonly statusGeneration: HTMLElement;
}

interface MapInspectorDependencies {
  readonly session: EditorSession;
  readonly camera: Camera;
  readonly elements: MapInspectorElements;
  readonly fitCamera: () => void;
  readonly requestRender: () => void;
  readonly openInspector: () => void;
  readonly adoptRoad: (road: Road) => void;
  readonly adoptBuilding: (building: Building) => void;
  readonly isGenerationRunning: () => boolean;
}

const MINIMAP_STORAGE_KEY = 'payaw.ui-minimap.v1';

export class MapInspectorController {
  private minimapBase: HTMLCanvasElement | null = null;

  public constructor(private readonly dependencies: MapInspectorDependencies) {
    this.bindEvents();
    const collapsed = localStorage.getItem(MINIMAP_STORAGE_KEY) === 'collapsed';
    this.setMinimapCollapsed(collapsed);
  }

  public rebuildMinimapBase(): void {
    const { session, elements } = this.dependencies;
    if (session.world === undefined) return;
    const base = document.createElement('canvas');
    base.width = elements.minimapCanvas.width;
    base.height = elements.minimapCanvas.height;
    const context = base.getContext('2d');
    if (context === null) return;
    const cellWidth = base.width / session.world.width;
    const cellHeight = base.height / session.world.height;
    for (let y = 0; y < session.world.height; y += 1) {
      for (let x = 0; x < session.world.width; x += 1) {
        const tile = session.world.getTile(x, y);
        if (tile === undefined) continue;
        context.fillStyle = this.terrainColor(tile.terrain, tile.water);
        context.fillRect(
          Math.floor(x * cellWidth),
          Math.floor(y * cellHeight),
          Math.ceil(cellWidth + 0.2),
          Math.ceil(cellHeight + 0.2),
        );
      }
    }
    this.minimapBase = base;
    this.renderMinimap();
  }

  public renderMinimap(): void {
    const { session, camera, elements } = this.dependencies;
    if (session.world === undefined || this.minimapBase === null || elements.minimapPanel.dataset.collapsed === 'true') return;
    const context = elements.minimapCanvas.getContext('2d');
    if (context === null) return;
    context.clearRect(0, 0, elements.minimapCanvas.width, elements.minimapCanvas.height);
    context.drawImage(this.minimapBase, 0, 0);
    const left = Math.max(0, -camera.x / camera.zoom);
    const top = Math.max(0, -camera.y / camera.zoom);
    const right = Math.min(session.world.width, (elements.canvas.clientWidth - camera.x) / camera.zoom);
    const bottom = Math.min(session.world.height, (elements.canvas.clientHeight - camera.y) / camera.zoom);
    context.strokeStyle = '#ffffff';
    context.lineWidth = 1.5;
    context.strokeRect(
      left / session.world.width * elements.minimapCanvas.width,
      top / session.world.height * elements.minimapCanvas.height,
      Math.max(3, (right - left) / session.world.width * elements.minimapCanvas.width),
      Math.max(3, (bottom - top) / session.world.height * elements.minimapCanvas.height),
    );
    if (session.selectedInspectorItem !== null) {
      context.fillStyle = '#f0d68a';
      context.beginPath();
      context.arc(
        (session.selectedInspectorItem.x + 0.5) / session.world.width * elements.minimapCanvas.width,
        (session.selectedInspectorItem.y + 0.5) / session.world.height * elements.minimapCanvas.height,
        3,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }

  public updateStatusBar(): void {
    const { session, camera, elements } = this.dependencies;
    if (session.world === undefined) return;
    elements.statusSeed.textContent = `Seed: ${session.world.seed}`;
    elements.statusLayout.textContent = `Layout: ${session.world.metadata.terrainShape}`;
    elements.statusZoom.textContent = `Zoom: ${Math.round(camera.zoom * 100)}%`;
    elements.statusSelection.textContent = `Selected: ${session.selectedInspectorItem?.title ?? 'none'}`;
    const total = Object.values(session.world.diagnostics.stageTimingsMs).reduce((sum, value) => sum + value, 0);
    elements.statusGeneration.textContent = this.dependencies.isGenerationRunning()
      ? 'Generation: running'
      : `Generation: ${total.toFixed(0)} ms`;
  }

  public renderInspector(): void {
    const { session, elements } = this.dependencies;
    elements.focusSelectionButton.disabled = session.selectedInspectorItem === null;
    if (session.selectedInspectorItem === null || session.world === undefined) {
      elements.inspectorContent.className = 'inspector-empty';
      elements.inspectorContent.innerHTML = '<strong>Nothing selected</strong><p>Click the map to inspect terrain, roads, districts, settlements, anchors, story sites, and NPCs.</p>';
      this.updateStatusBar();
      return;
    }
    const tile = session.world.getTile(session.selectedInspectorItem.x, session.selectedInspectorItem.y);
    if (tile === undefined) return;
    const island = tile.islandId === null ? undefined : session.world.islands[tile.islandId];
    const settlement = tile.settlementId === null ? undefined : session.world.settlements[tile.settlementId];
    const road = tile.roadId === null ? undefined : session.world.roads[tile.roadId];
    const block = tile.blockId === null ? undefined : session.world.blocks[tile.blockId];
    const building = tile.buildingId === null ? undefined : session.world.buildings[tile.buildingId];
    const anchor = session.world.anchors.find((item) => item.tileIndex === session.selectedInspectorItem?.tileIndex);
    const story = session.world.storyObjects.find((item) => item.tileIndex === session.selectedInspectorItem?.tileIndex);
    const npc = session.world.npcs.find((item) => item.tileIndex === session.selectedInspectorItem?.tileIndex);
    const tags = [
      tile.river ? 'River' : '',
      tile.coast ? 'Coast' : '',
      tile.bridge ? 'Bridge' : '',
      tile.hasZoneOverride ? 'Zone override' : '',
    ].filter(Boolean);

    elements.inspectorContent.className = 'inspector-card';
    elements.inspectorContent.replaceChildren();
    const header = document.createElement('header');
    const title = document.createElement('strong');
    title.textContent = session.selectedInspectorItem.title;
    const subtitle = document.createElement('span');
    subtitle.textContent = session.selectedInspectorItem.subtitle;
    header.append(title, subtitle);
    const list = document.createElement('dl');
    list.className = 'inspector-grid';
    const rows: readonly [string, string][] = [
      ['Coordinates', `${tile.x}, ${tile.y}`],
      ['Terrain', tile.terrain],
      ['Elevation', tile.elevation.toFixed(3)],
      ['Slope', tile.slope.toFixed(3)],
      ['Moisture', tile.moisture.toFixed(2)],
      ['Flood risk', `${Math.round(tile.floodRisk * 100)}%`],
      ['Zone', tile.zoneType ?? 'none'],
      ['Island', island?.name ?? 'none'],
      ['Settlement', settlement?.name ?? 'none'],
      ['Road', road?.name ?? 'none'],
      ['Block', block?.name ?? 'none'],
      ['Building', building === undefined ? 'none' : `#${building.id}`],
      ['Anchor', anchor?.name ?? 'none'],
      ['Story site', story?.name ?? 'none'],
      ['NPC', npc === undefined ? 'none' : `${npc.name} · ${npc.occupation} · ${npc.status}`],
    ];
    for (const [name, value] of rows) {
      const term = document.createElement('dt');
      term.textContent = name;
      const description = document.createElement('dd');
      description.textContent = value;
      list.append(term, description);
    }
    const tagContainer = document.createElement('div');
    tagContainer.className = 'inspector-tags';
    for (const tag of tags) {
      const span = document.createElement('span');
      span.textContent = tag;
      tagContainer.append(span);
    }
    const actions = document.createElement('div');
    actions.className = 'button-row inspector-actions';
    if (road !== undefined && road.source !== 'authored' && road.bridgeId === null && road.portId === null) {
      const adopt = document.createElement('button');
      adopt.type = 'button';
      adopt.textContent = 'Adopt road into authoring';
      adopt.addEventListener('click', () => this.dependencies.adoptRoad(road));
      actions.append(adopt);
    }
    if (building !== undefined && building.source !== 'authored') {
      const adopt = document.createElement('button');
      adopt.type = 'button';
      adopt.textContent = 'Adopt building into authoring';
      adopt.addEventListener('click', () => this.dependencies.adoptBuilding(building));
      actions.append(adopt);
    }
    elements.inspectorContent.append(header, list, tagContainer);
    if (actions.childElementCount > 0) elements.inspectorContent.append(actions);
    this.updateStatusBar();
    this.renderMinimap();
  }

  public inspectMapPosition(worldX: number, worldY: number): void {
    const { session } = this.dependencies;
    const x = Math.floor(worldX);
    const y = Math.floor(worldY);
    const tile = session.world.getTile(x, y);
    if (tile === undefined) return;
    const tileIndex = y * session.world.width + x;
    const story = session.world.storyObjects.find((item) => item.tileIndex === tileIndex);
    const npc = session.world.npcs.find((item) => item.tileIndex === tileIndex);
    const anchor = session.world.anchors.find((item) => item.tileIndex === tileIndex);
    const settlement = tile.settlementId === null ? undefined : session.world.settlements[tile.settlementId];
    const road = tile.roadId === null ? undefined : session.world.roads[tile.roadId];
    const block = tile.blockId === null ? undefined : session.world.blocks[tile.blockId];
    const title = npc?.name ?? story?.name ?? anchor?.name ?? settlement?.name ?? road?.name ?? block?.name ?? `${tile.terrain} tile`;
    const subtitle = npc !== undefined ? 'NPC'
      : story !== undefined ? 'Story site'
        : anchor !== undefined ? 'Anchor'
          : settlement !== undefined ? 'Settlement'
            : road !== undefined ? 'Road'
              : block !== undefined ? 'Block'
                : 'Terrain';
    session.setInspectorSelection({ tileIndex, x, y, title, subtitle });
    this.renderInspector();
    this.dependencies.openInspector();
  }

  public focusSelection(): void {
    const { session, camera, elements } = this.dependencies;
    if (session.selectedInspectorItem === null) {
      this.dependencies.fitCamera();
      return;
    }
    camera.focus(
      session.selectedInspectorItem.x,
      session.selectedInspectorItem.y,
      elements.canvas.clientWidth,
      elements.canvas.clientHeight,
      Math.max(7, camera.zoom),
    );
    this.dependencies.requestRender();
  }

  public clearSelection(): void {
    this.dependencies.session.setInspectorSelection(null);
    this.renderInspector();
  }

  private bindEvents(): void {
    const { elements, session, camera } = this.dependencies;
    elements.focusSelectionButton.addEventListener('click', () => this.focusSelection());
    elements.minimapCollapseButton.addEventListener('click', () => {
      this.setMinimapCollapsed(elements.minimapPanel.dataset.collapsed !== 'true');
    });
    elements.minimapCanvas.addEventListener('click', (event) => {
      const rectangle = elements.minimapCanvas.getBoundingClientRect();
      const x = (event.clientX - rectangle.left) / rectangle.width * session.world.width;
      const y = (event.clientY - rectangle.top) / rectangle.height * session.world.height;
      camera.focus(x, y, elements.canvas.clientWidth, elements.canvas.clientHeight, camera.zoom);
      this.dependencies.requestRender();
    });
  }

  private setMinimapCollapsed(collapsed: boolean): void {
    const { minimapPanel, minimapCollapseButton } = this.dependencies.elements;
    minimapPanel.dataset.collapsed = String(collapsed);
    minimapCollapseButton.textContent = collapsed ? '+' : '−';
    localStorage.setItem(MINIMAP_STORAGE_KEY, collapsed ? 'collapsed' : 'open');
    if (!collapsed) this.renderMinimap();
  }

  private terrainColor(terrain: string, water: WaterType): string {
    if (water === WaterType.Ocean) return terrain === 'shallow-water' ? '#406b74' : '#254650';
    if (water === WaterType.Lake) return '#3e7180';
    switch (terrain) {
      case 'beach': return '#b7a777';
      case 'river-channel': return '#4a7881';
      case 'delta': return '#67816a';
      case 'floodplain': return '#758d6a';
      case 'forest': return '#355c3d';
      case 'hill': return '#776f55';
      case 'mountain': return '#716b62';
      default: return '#66805d';
    }
  }
}
