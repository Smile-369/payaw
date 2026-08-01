import {
  DEFAULT_LABEL_DISPLAY_SETTINGS,
  type LabelDisplaySettings,
} from '../customization/Customization';
import { RenderLayer } from '../engine/renderer/Layers';
import { normalizeLabelSettings, saveLabelSettings } from '../editor/EditorStatePersistence';
import type { EditorSession, EditorSnapshot } from '../models/EditorSession';

interface LabelDisplayElements {
  readonly roadFontSize: HTMLInputElement;
  readonly roadFontOutput: HTMLOutputElement;
  readonly roadOpacity: HTMLInputElement;
  readonly roadOpacityOutput: HTMLOutputElement;
  readonly roadDensity: HTMLInputElement;
  readonly roadDensityOutput: HTMLOutputElement;
  readonly roadMainZoom: HTMLSelectElement;
  readonly roadSecondaryZoom: HTMLSelectElement;
  readonly roadLocalZoom: HTMLSelectElement;
  readonly roadMain: HTMLInputElement;
  readonly roadSecondary: HTMLInputElement;
  readonly roadLocal: HTMLInputElement;
  readonly roadRotate: HTMLInputElement;
  readonly roadOutline: HTMLInputElement;
  readonly roadSummary: HTMLElement;
  readonly blockFontSize: HTMLInputElement;
  readonly blockFontOutput: HTMLOutputElement;
  readonly blockOpacity: HTMLInputElement;
  readonly blockOpacityOutput: HTMLOutputElement;
  readonly blockDensity: HTMLInputElement;
  readonly blockDensityOutput: HTMLOutputElement;
  readonly blockMinZoom: HTMLSelectElement;
  readonly blockOutline: HTMLInputElement;
  readonly blockSummary: HTMLElement;
  readonly avoidCollisions: HTMLInputElement;
  readonly resetButton: HTMLButtonElement;
  readonly viewPreset: HTMLSelectElement;
  readonly layerElements: Readonly<Record<RenderLayer, HTMLInputElement>>;
}

interface LabelDisplayDependencies {
  readonly session: EditorSession;
  readonly elements: LabelDisplayElements;
  readonly captureSnapshot: () => EditorSnapshot;
  readonly recordHistory: (snapshot: EditorSnapshot, label: string) => void;
  readonly setRenderedLayer: (layer: RenderLayer, visible: boolean) => void;
  readonly syncMap: () => void;
  readonly setStatus: (message: string, state: 'success') => void;
}

export class LabelDisplayController {
  public constructor(private readonly dependencies: LabelDisplayDependencies) {
    this.bindEvents();
  }

  public apply(settings: LabelDisplaySettings): void {
    const { elements } = this.dependencies;
    elements.layerElements[RenderLayer.RoadLabels].checked = settings.road.visible;
    elements.layerElements[RenderLayer.BlockLabels].checked = settings.block.visible;
    this.dependencies.setRenderedLayer(RenderLayer.RoadLabels, settings.road.visible);
    this.dependencies.setRenderedLayer(RenderLayer.BlockLabels, settings.block.visible);
    elements.roadFontSize.value = String(settings.road.fontSizePx);
    elements.roadOpacity.value = String(Math.round(settings.road.opacity * 100));
    elements.roadDensity.value = String(Math.round(settings.road.density * 100));
    elements.roadMainZoom.value = String(settings.road.mainMinZoom);
    elements.roadSecondaryZoom.value = String(settings.road.secondaryMinZoom);
    elements.roadLocalZoom.value = String(settings.road.localMinZoom);
    elements.roadMain.checked = settings.road.showMain;
    elements.roadSecondary.checked = settings.road.showSecondary;
    elements.roadLocal.checked = settings.road.showLocal;
    elements.roadRotate.checked = settings.road.rotateAlongRoad;
    elements.roadOutline.checked = settings.road.outline;
    elements.blockFontSize.value = String(settings.block.fontSizePx);
    elements.blockOpacity.value = String(Math.round(settings.block.opacity * 100));
    elements.blockDensity.value = String(Math.round(settings.block.density * 100));
    elements.blockMinZoom.value = String(settings.block.minZoom);
    elements.blockOutline.checked = settings.block.outline;
    elements.avoidCollisions.checked = settings.avoidCollisions;
    this.updateOutputs();
  }

  public commitFromControls(): void {
    const settings = this.readControls();
    this.dependencies.session.setLabelSettings(settings);
    saveLabelSettings(settings);
    this.updateOutputs();
    this.dependencies.elements.viewPreset.value = 'custom';
    this.dependencies.syncMap();
  }

  private bindEvents(): void {
    const elements = this.dependencies.elements;
    const rangeControls = [
      elements.roadFontSize,
      elements.roadOpacity,
      elements.roadDensity,
      elements.blockFontSize,
      elements.blockOpacity,
      elements.blockDensity,
    ];
    for (const control of rangeControls) {
      let snapshot: EditorSnapshot | null = null;
      control.addEventListener('focus', () => { snapshot = this.dependencies.captureSnapshot(); });
      control.addEventListener('pointerdown', () => { snapshot = this.dependencies.captureSnapshot(); });
      control.addEventListener('input', () => this.commitFromControls());
      control.addEventListener('change', () => {
        this.commitFromControls();
        if (snapshot !== null) this.dependencies.recordHistory(snapshot, 'change label display');
        snapshot = null;
      });
    }

    const changeControls: readonly (HTMLInputElement | HTMLSelectElement)[] = [
      elements.roadMainZoom,
      elements.roadSecondaryZoom,
      elements.roadLocalZoom,
      elements.roadMain,
      elements.roadSecondary,
      elements.roadLocal,
      elements.roadRotate,
      elements.roadOutline,
      elements.blockMinZoom,
      elements.blockOutline,
      elements.avoidCollisions,
    ];
    for (const control of changeControls) {
      control.addEventListener('change', () => {
        const snapshot = this.dependencies.captureSnapshot();
        this.commitFromControls();
        this.dependencies.recordHistory(snapshot, 'change label display');
      });
    }
    elements.resetButton.addEventListener('click', () => this.reset());
  }

  private reset(): void {
    const snapshot = this.dependencies.captureSnapshot();
    this.dependencies.session.setLabelSettings(DEFAULT_LABEL_DISPLAY_SETTINGS);
    saveLabelSettings(this.dependencies.session.labelSettings);
    this.apply(this.dependencies.session.labelSettings);
    this.dependencies.syncMap();
    this.dependencies.recordHistory(snapshot, 'reset label controls');
    this.dependencies.setStatus('Label controls reset to defaults.', 'success');
  }

  private readControls(): LabelDisplaySettings {
    const { elements } = this.dependencies;
    return normalizeLabelSettings({
      road: {
        visible: elements.layerElements[RenderLayer.RoadLabels].checked,
        fontSizePx: Number(elements.roadFontSize.value),
        opacity: Number(elements.roadOpacity.value) / 100,
        density: Number(elements.roadDensity.value) / 100,
        showMain: elements.roadMain.checked,
        showSecondary: elements.roadSecondary.checked,
        showLocal: elements.roadLocal.checked,
        mainMinZoom: Number(elements.roadMainZoom.value),
        secondaryMinZoom: Number(elements.roadSecondaryZoom.value),
        localMinZoom: Number(elements.roadLocalZoom.value),
        rotateAlongRoad: elements.roadRotate.checked,
        outline: elements.roadOutline.checked,
      },
      block: {
        visible: elements.layerElements[RenderLayer.BlockLabels].checked,
        fontSizePx: Number(elements.blockFontSize.value),
        opacity: Number(elements.blockOpacity.value) / 100,
        density: Number(elements.blockDensity.value) / 100,
        minZoom: Number(elements.blockMinZoom.value),
        outline: elements.blockOutline.checked,
      },
      avoidCollisions: elements.avoidCollisions.checked,
    });
  }

  private updateOutputs(): void {
    const { session, elements } = this.dependencies;
    elements.roadFontOutput.value = `${session.labelSettings.road.fontSizePx.toFixed(0)} px`;
    elements.roadOpacityOutput.value = this.percentage(session.labelSettings.road.opacity);
    elements.roadDensityOutput.value = this.percentage(session.labelSettings.road.density);
    elements.roadSummary.textContent = `${session.labelSettings.road.fontSizePx.toFixed(0)} px · ${this.percentage(session.labelSettings.road.density)}`;
    elements.blockFontOutput.value = `${session.labelSettings.block.fontSizePx.toFixed(0)} px`;
    elements.blockOpacityOutput.value = this.percentage(session.labelSettings.block.opacity);
    elements.blockDensityOutput.value = this.percentage(session.labelSettings.block.density);
    elements.blockSummary.textContent = `${session.labelSettings.block.fontSizePx.toFixed(0)} px · ${this.percentage(session.labelSettings.block.density)}`;
  }

  private percentage(value: number): string {
    return `${Math.round(value * 100)}%`;
  }
}
