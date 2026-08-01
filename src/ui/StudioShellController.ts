import { RenderLayer } from '../engine/renderer/Layers';
import type { EditorSession, StudioTab } from '../models/EditorSession';

export type UiTheme = 'dark' | 'light' | 'contrast';

interface StudioShellElements {
  readonly toggleLeftPanelButton: HTMLButtonElement;
  readonly toggleStudioDockButton: HTMLButtonElement;
  readonly closeStudioDockButton: HTMLButtonElement;
  readonly tabButtons: Readonly<Record<StudioTab, HTMLButtonElement>>;
  readonly tabPanels: Readonly<Record<StudioTab, HTMLElement>>;
  readonly layerList: HTMLElement;
  readonly layerSearchInput: HTMLInputElement;
  readonly layersAllButton: HTMLButtonElement;
  readonly layersNoneButton: HTMLButtonElement;
  readonly themeSelect: HTMLSelectElement;
  readonly viewPreset: HTMLSelectElement;
  readonly layerElements: Readonly<Record<RenderLayer, HTMLInputElement>>;
}

interface StudioShellDependencies {
  readonly session: EditorSession;
  readonly elements: StudioShellElements;
  readonly fitCamera: () => void;
  readonly requestRender: () => void;
  readonly setLayer: (layer: RenderLayer, visible: boolean) => void;
}

const STORAGE_KEYS = {
  theme: 'payaw.ui-theme.v1',
  leftPanel: 'payaw.ui-left-panel.v1',
  studioDock: 'payaw.ui-studio-dock.v1',
  studioTab: 'payaw.ui-studio-tab.v1',
} as const;

const LAYER_GROUPS: readonly {
  readonly title: string;
  readonly layers: readonly { readonly layer: RenderLayer; readonly label: string }[];
}[] = [
  { title: 'Base', layers: [
    { layer: RenderLayer.Terrain, label: 'Terrain' },
    { layer: RenderLayer.Elevation, label: 'Elevation' },
    { layer: RenderLayer.Moisture, label: 'Moisture' },
    { layer: RenderLayer.Temperature, label: 'Temperature' },
  ] },
  { title: 'Planning', layers: [
    { layer: RenderLayer.Accessibility, label: 'Accessibility' },
    { layer: RenderLayer.LandValue, label: 'Land value' },
    { layer: RenderLayer.Zones, label: 'Zones' },
    { layer: RenderLayer.Blocks, label: 'Blocks' },
    { layer: RenderLayer.BlockLabels, label: 'Block labels' },
  ] },
  { title: 'Region', layers: [
    { layer: RenderLayer.Floodplains, label: 'Flood risk' },
    { layer: RenderLayer.Rivers, label: 'Rivers' },
    { layer: RenderLayer.Islands, label: 'Island boundaries' },
    { layer: RenderLayer.IslandLabels, label: 'Island labels' },
    { layer: RenderLayer.Settlements, label: 'Settlements' },
  ] },
  { title: 'Infrastructure', layers: [
    { layer: RenderLayer.Roads, label: 'Roads' },
    { layer: RenderLayer.RoadLabels, label: 'Road labels' },
    { layer: RenderLayer.Bridges, label: 'Bridges' },
    { layer: RenderLayer.BridgeLabels, label: 'Bridge labels' },
    { layer: RenderLayer.Ports, label: 'Ports' },
    { layer: RenderLayer.PortLabels, label: 'Port labels' },
  ] },
  { title: 'Live world', layers: [
    { layer: RenderLayer.LiveInfrastructure, label: 'Infrastructure status' },
    { layer: RenderLayer.VenueStatus, label: 'Venue status' },
    { layer: RenderLayer.SettlementActivity, label: 'Settlement activity' },
    { layer: RenderLayer.SupernaturalActivity, label: 'Supernatural activity' },
    { layer: RenderLayer.NPCs, label: 'NPCs' },
    { layer: RenderLayer.Travel, label: 'Travel route' },
  ] },
  { title: 'World objects', layers: [
    { layer: RenderLayer.Buildings, label: 'Buildings' },
    { layer: RenderLayer.Vegetation, label: 'Vegetation' },
    { layer: RenderLayer.CustomImages, label: 'Custom images' },
    { layer: RenderLayer.Anchors, label: 'Anchors' },
    { layer: RenderLayer.Story, label: 'Story sites' },
    { layer: RenderLayer.Grid, label: 'Grid' },
  ] },
];

export class StudioShellController {
  public constructor(private readonly dependencies: StudioShellDependencies) {
    this.bindEvents();
  }

  public restore(): void {
    const storedTheme = localStorage.getItem(STORAGE_KEYS.theme);
    this.setTheme(storedTheme === 'dark' || storedTheme === 'contrast' ? storedTheme : 'light');
    this.setLeftPanel(localStorage.getItem(STORAGE_KEYS.leftPanel) !== 'closed');
    this.setStudioDock(localStorage.getItem(STORAGE_KEYS.studioDock) === 'open');
    const storedTab = localStorage.getItem(STORAGE_KEYS.studioTab);
    const tab: StudioTab = storedTab === 'layers' || storedTab === 'project' ? storedTab : 'inspector';
    this.setTab(tab === 'layers' || tab === 'project' ? tab : 'inspector', false);
    this.renderLayerManager();
  }

  public setTheme(theme: UiTheme): void {
    document.documentElement.dataset.theme = theme;
    this.dependencies.elements.themeSelect.value = theme;
    localStorage.setItem(STORAGE_KEYS.theme, theme);
    this.dependencies.requestRender();
  }

  public toggleLeftPanel(): void {
    this.setLeftPanel(document.body.dataset.leftPanel === 'closed');
  }

  public setLeftPanel(open: boolean): void {
    document.body.dataset.leftPanel = open ? 'open' : 'closed';
    this.dependencies.elements.toggleLeftPanelButton.setAttribute('aria-pressed', String(open));
    localStorage.setItem(STORAGE_KEYS.leftPanel, open ? 'open' : 'closed');
    window.setTimeout(this.dependencies.fitCamera, 190);
  }

  public toggleStudioDock(): void {
    this.setStudioDock(document.body.dataset.studioDock === 'closed');
  }

  public setStudioDock(open: boolean): void {
    document.body.dataset.studioDock = open ? 'open' : 'closed';
    this.dependencies.elements.toggleStudioDockButton.setAttribute('aria-pressed', String(open));
    localStorage.setItem(STORAGE_KEYS.studioDock, open ? 'open' : 'closed');
    window.setTimeout(this.dependencies.fitCamera, 190);
  }

  public setTab(tab: StudioTab, openDock = true): void {
    this.dependencies.session.setStudioTab(tab);
    localStorage.setItem(STORAGE_KEYS.studioTab, tab);
    const { tabButtons, tabPanels } = this.dependencies.elements;
    for (const key of Object.keys(tabButtons) as StudioTab[]) {
      tabButtons[key].setAttribute('aria-selected', String(key === tab));
      tabPanels[key].hidden = key !== tab;
    }
    if (openDock) this.setStudioDock(true);
  }

  public syncLayerManager(): void {
    const { layerList, layerElements } = this.dependencies.elements;
    for (const input of layerList.querySelectorAll<HTMLInputElement>('input[data-layer]')) {
      const layer = input.dataset.layer as RenderLayer;
      input.checked = layerElements[layer].checked;
    }
  }

  private bindEvents(): void {
    const elements = this.dependencies.elements;
    elements.toggleLeftPanelButton.addEventListener('click', () => this.toggleLeftPanel());
    elements.toggleStudioDockButton.addEventListener('click', () => this.toggleStudioDock());
    elements.closeStudioDockButton.addEventListener('click', () => this.setStudioDock(false));
    elements.tabButtons.inspector.addEventListener('click', () => this.setTab('inspector'));
    elements.tabButtons.layers.addEventListener('click', () => this.setTab('layers'));
    elements.tabButtons.project.addEventListener('click', () => this.setTab('project'));
    elements.layerSearchInput.addEventListener('input', () => this.filterLayers());
    elements.layersAllButton.addEventListener('click', () => this.setAllLayers(true));
    elements.layersNoneButton.addEventListener('click', () => this.setAllLayers(false));
    elements.themeSelect.addEventListener('change', () => this.setTheme(elements.themeSelect.value as UiTheme));
  }

  private renderLayerManager(): void {
    const { layerList, layerElements } = this.dependencies.elements;
    layerList.replaceChildren();
    for (const groupDefinition of LAYER_GROUPS) {
      const group = document.createElement('section');
      group.className = 'studio-layer-group';
      const title = document.createElement('strong');
      title.textContent = groupDefinition.title;
      group.append(title);
      for (const item of groupDefinition.layers) {
        const row = document.createElement('label');
        row.className = 'studio-layer-row';
        row.dataset.search = `${groupDefinition.title} ${item.label}`.toLocaleLowerCase();
        const label = document.createElement('span');
        label.textContent = item.label;
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = layerElements[item.layer].checked;
        input.dataset.layer = item.layer;
        input.addEventListener('change', () => {
          layerElements[item.layer].checked = input.checked;
          layerElements[item.layer].dispatchEvent(new Event('change'));
        });
        layerElements[item.layer].addEventListener('change', () => { input.checked = layerElements[item.layer].checked; });
        row.append(label, input);
        group.append(row);
      }
      layerList.append(group);
    }
  }

  private filterLayers(): void {
    const { layerList, layerSearchInput } = this.dependencies.elements;
    const query = layerSearchInput.value.trim().toLocaleLowerCase();
    for (const row of layerList.querySelectorAll<HTMLElement>('.studio-layer-row')) {
      row.dataset.filtered = String(query.length > 0 && !(row.dataset.search ?? '').includes(query));
    }
  }

  private setAllLayers(visible: boolean): void {
    for (const layer of Object.values(RenderLayer)) {
      this.dependencies.setLayer(layer, visible || layer === RenderLayer.Terrain);
    }
    this.dependencies.elements.viewPreset.value = 'custom';
    this.syncLayerManager();
    this.dependencies.requestRender();
  }
}
