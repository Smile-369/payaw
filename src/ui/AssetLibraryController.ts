import { AssetRepository, loadImage, readFileAsDataUrl } from '../customization/AssetRepository';
import { AssetTargetCategory, type ImportedImageAsset, type PlacedImage, type RuntimeImageAsset } from '../customization/Customization';
import { ASSET_CATEGORY_LABELS, assetTargetsFor, describeAssetTarget } from '../customization/AssetTargets';
import type { Camera } from '../engine/renderer/Camera';
import type { EditorSession } from '../models/EditorSession';
import * as appElements from './AppElements';

type StatusTone = 'success' | 'warning' | 'error' | 'working' | 'idle';

export interface AssetLibraryElements {
  readonly canvas: HTMLCanvasElement;
  readonly assetCount: HTMLElement;
  readonly assetList: HTMLElement;
  readonly placedImageList: HTMLElement;
}

export interface AssetLibraryDependencies<TSnapshot> {
  readonly elements: AssetLibraryElements;
  readonly session: EditorSession;
  readonly repository: AssetRepository;
  readonly camera: Camera;
  readonly createId: () => string;
  readonly captureSnapshot: () => TSnapshot;
  readonly recordHistory: (snapshot: TSnapshot, label: string) => void;
  readonly persist: () => void;
  readonly syncMap: () => void;
  readonly onLibraryChanged: () => void;
  readonly focusMapPoint: (x: number, y: number) => void;
  readonly setStatus: (message: string, tone?: StatusTone) => void;
}

export class AssetLibraryController<TSnapshot> {
  public constructor(private readonly dependencies: AssetLibraryDependencies<TSnapshot>) {}

  public updateImportTargetOptions(): void {
    const category = appElements.assetTargetCategory.value as AssetTargetCategory;
    const targets = assetTargetsFor(category);
    appElements.assetTargetType.replaceChildren();
    if (targets.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No procedural target';
      appElements.assetTargetType.append(option);
      appElements.assetTargetType.disabled = true;
      return;
    }
    appElements.assetTargetType.disabled = false;
    appElements.assetTargetType.append(...targets.map((target) => {
      const option = document.createElement('option');
      option.value = target.value;
      option.textContent = target.label;
      return option;
    }));
  }

  public createPlacement(asset: RuntimeImageAsset, x: number, y: number): PlacedImage {
    const placements = this.dependencies.session.placedImages;
    const aspect = asset.image.naturalWidth / Math.max(1, asset.image.naturalHeight);
    const baseWidth = 8;
    return {
      id: this.dependencies.createId(),
      assetId: asset.definition.id,
      name: asset.definition.name,
      x,
      y,
      width: baseWidth,
      height: Math.max(1, baseWidth / Math.max(0.15, aspect)),
      rotation: 0,
      opacity: 1,
      zIndex: placements.length === 0 ? 0 : Math.max(...placements.map((item) => item.zIndex)) + 1,
    };
  }

  public placeAt(assetId: string, x: number, y: number): void {
    const asset = this.runtimeAsset(assetId);
    if (asset === undefined) {
      this.dependencies.setStatus('That image asset is not available.', 'error');
      return;
    }
    const snapshot = this.dependencies.captureSnapshot();
    this.dependencies.session.placedImages = [...this.dependencies.session.placedImages, this.createPlacement(asset, x, y)];
    this.dependencies.persist();
    this.renderPlacements();
    this.dependencies.syncMap();
    this.dependencies.recordHistory(snapshot, `place image ${asset.definition.name}`);
    this.dependencies.setStatus(`Placed ${asset.definition.name}. Turn on Edit to move it.`, 'success');
  }

  public renderAssets(): void {
    const { assetCount, assetList } = this.dependencies.elements;
    const assets = this.dependencies.session.importedAssets;
    assetCount.textContent = String(assets.length);
    assetList.replaceChildren();
    if (assets.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'asset-empty';
      empty.textContent = 'No imported assets yet.';
      assetList.append(empty);
      return;
    }
    for (const definition of assets) assetList.append(this.assetCard(definition));
  }

  public renderPlacements(): void {
    const { placedImageList } = this.dependencies.elements;
    const placements = this.dependencies.session.placedImages;
    placedImageList.replaceChildren();
    if (placements.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'asset-empty';
      empty.textContent = 'Drop an image onto the map or place one from the asset library.';
      placedImageList.append(empty);
      return;
    }
    for (const placement of placements) {
      const definition = this.dependencies.session.importedAssets.find((asset) => asset.id === placement.assetId);
      if (definition !== undefined) placedImageList.append(this.placementCard(placement, definition));
    }
  }

  public async refresh(): Promise<void> {
    const imported = await this.dependencies.repository.list();
    this.dependencies.session.importedAssets = imported;
    const loaded = await Promise.all(imported.map(async (definition) => {
      try {
        return { definition, image: await loadImage(definition.dataUrl) } satisfies RuntimeImageAsset;
      } catch {
        return undefined;
      }
    }));
    this.dependencies.session.runtimeImageAssets = loaded.filter((asset): asset is RuntimeImageAsset => asset !== undefined);
    this.renderAssets();
    this.renderPlacements();
    this.dependencies.syncMap();
    this.dependencies.onLibraryChanged();
  }

  public async importFiles(
    files: readonly File[],
    targetCategory: AssetTargetCategory,
    targetType: string | null,
  ): Promise<RuntimeImageAsset[]> {
    const imported: RuntimeImageAsset[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 16 * 1024 * 1024) throw new Error(`${file.name} is larger than the 16 MB per-image limit.`);
      const dataUrl = await readFileAsDataUrl(file);
      const image = await loadImage(dataUrl);
      const definition: ImportedImageAsset = {
        id: this.dependencies.createId(),
        name: file.name.replace(/\.[^.]+$/, '') || 'Imported image',
        mimeType: file.type,
        dataUrl,
        targetCategory,
        targetType,
        createdAt: new Date().toISOString(),
      };
      await this.dependencies.repository.put(definition);
      imported.push({ definition, image });
    }
    await this.refresh();
    return imported;
  }

  private runtimeAsset(assetId: string): RuntimeImageAsset | undefined {
    return this.dependencies.session.runtimeImageAssets.find((asset) => asset.definition.id === assetId);
  }

  private updatePlacement(id: string, update: (item: PlacedImage) => PlacedImage, persist = true): void {
    this.dependencies.session.placedImages = this.dependencies.session.placedImages.map((item) => item.id === id ? update(item) : item);
    if (persist) {
      this.dependencies.persist();
      this.renderPlacements();
    }
    this.dependencies.syncMap();
  }

  private removePlacement(id: string): void {
    const snapshot = this.dependencies.captureSnapshot();
    const placement = this.dependencies.session.placedImages.find((item) => item.id === id);
    this.dependencies.session.placedImages = this.dependencies.session.placedImages.filter((item) => item.id !== id);
    this.dependencies.persist();
    this.renderPlacements();
    this.dependencies.syncMap();
    this.dependencies.recordHistory(snapshot, `remove image ${placement?.name ?? id}`);
  }

  private appendCategoryOptions(select: HTMLSelectElement, selected: AssetTargetCategory): void {
    select.replaceChildren(...Object.values(AssetTargetCategory).map((category) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = ASSET_CATEGORY_LABELS[category];
      return option;
    }));
    select.value = selected;
  }

  private appendTargetOptions(select: HTMLSelectElement, category: AssetTargetCategory, selected: string | null): void {
    const targets = assetTargetsFor(category);
    select.replaceChildren();
    if (targets.length === 0) {
      const option = document.createElement('option'); option.value = ''; option.textContent = 'No procedural target';
      select.append(option); select.disabled = true; return;
    }
    select.disabled = false;
    select.append(...targets.map((target) => {
      const option = document.createElement('option'); option.value = target.value; option.textContent = target.label; return option;
    }));
    select.value = selected !== null && targets.some((target) => target.value === selected) ? selected : targets[0]?.value ?? '';
  }

  private assetCard(definition: ImportedImageAsset): HTMLElement {
    const item = document.createElement('article'); item.className = 'asset-item'; item.draggable = true;
    item.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('application/x-payaw-asset-id', definition.id);
      if (event.dataTransfer !== null) event.dataTransfer.effectAllowed = 'copy';
    });
    const preview = document.createElement('div'); preview.className = 'asset-preview';
    const image = document.createElement('img'); image.src = definition.dataUrl; image.alt = ''; preview.append(image);
    const content = document.createElement('div'); content.className = 'asset-content';
    const titleRow = document.createElement('div'); titleRow.className = 'asset-title-row';
    const title = document.createElement('strong'); title.textContent = definition.name;
    const type = document.createElement('span'); type.textContent = describeAssetTarget(definition.targetCategory, definition.targetType);
    titleRow.append(title, type);
    const controls = document.createElement('div'); controls.className = 'asset-controls';
    const categorySelect = document.createElement('select');
    categorySelect.setAttribute('aria-label', `Asset category for ${definition.name}`);
    this.appendCategoryOptions(categorySelect, definition.targetCategory);
    const targetSelect = document.createElement('select');
    targetSelect.setAttribute('aria-label', `Procedural target for ${definition.name}`);
    this.appendTargetOptions(targetSelect, definition.targetCategory, definition.targetType);
    const saveAssignment = (): void => {
      const category = categorySelect.value as AssetTargetCategory;
      const targetType = category === AssetTargetCategory.Map || targetSelect.value.length === 0 ? null : targetSelect.value;
      const { buildingType: _legacyBuildingType, ...withoutLegacy } = definition;
      void this.dependencies.repository.put({ ...withoutLegacy, targetCategory: category, targetType }).then(() => this.refresh()).catch((error: unknown) => {
        this.dependencies.setStatus(error instanceof Error ? error.message : String(error), 'error');
      });
    };
    categorySelect.addEventListener('change', () => {
      this.appendTargetOptions(targetSelect, categorySelect.value as AssetTargetCategory, null);
      saveAssignment();
    });
    targetSelect.addEventListener('change', saveAssignment);
    const place = document.createElement('button'); place.type = 'button'; place.textContent = 'Place';
    place.addEventListener('click', () => {
      const center = this.dependencies.camera.screenToWorld(
        this.dependencies.elements.canvas.clientWidth * 0.5,
        this.dependencies.elements.canvas.clientHeight * 0.5,
      );
      this.placeAt(definition.id, center.x, center.y);
    });
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Delete';
    remove.addEventListener('click', () => {
      void this.dependencies.repository.delete(definition.id).then(() => {
        this.dependencies.session.placedImages = this.dependencies.session.placedImages.filter((placement) => placement.assetId !== definition.id);
        this.dependencies.persist();
        return this.refresh();
      }).catch((error: unknown) => this.dependencies.setStatus(error instanceof Error ? error.message : String(error), 'error'));
    });
    controls.append(categorySelect, targetSelect, place, remove);
    content.append(titleRow, controls); item.append(preview, content);
    return item;
  }

  private placementCard(placement: PlacedImage, definition: ImportedImageAsset): HTMLElement {
    const item = document.createElement('article'); item.className = 'placed-image-item';
    const preview = document.createElement('div'); preview.className = 'asset-preview';
    const image = document.createElement('img'); image.src = definition.dataUrl; image.alt = ''; preview.append(image);
    const content = document.createElement('div'); content.className = 'placed-image-content';
    const titleRow = document.createElement('div'); titleRow.className = 'asset-title-row';
    const title = document.createElement('strong'); title.textContent = placement.name;
    const coordinate = document.createElement('span'); coordinate.textContent = `${placement.x.toFixed(1)}, ${placement.y.toFixed(1)}`;
    titleRow.append(title, coordinate);
    const controls = document.createElement('div'); controls.className = 'placed-image-controls';
    const sizeLabel = document.createElement('label'); sizeLabel.textContent = 'Size';
    const size = document.createElement('input'); size.type = 'range'; size.min = '2'; size.max = '32'; size.step = '0.5'; size.value = String(placement.width);
    let sizeSnapshot: TSnapshot | null = null;
    const beginSizeEdit = (): void => { sizeSnapshot ??= this.dependencies.captureSnapshot(); };
    size.addEventListener('pointerdown', beginSizeEdit); size.addEventListener('keydown', beginSizeEdit);
    size.addEventListener('input', () => {
      beginSizeEdit();
      const asset = this.runtimeAsset(placement.assetId);
      const aspect = asset === undefined ? placement.width / Math.max(0.1, placement.height) : asset.image.naturalWidth / Math.max(1, asset.image.naturalHeight);
      this.updatePlacement(placement.id, (current) => ({
        ...current,
        width: Number(size.value),
        height: Math.max(0.5, Number(size.value) / Math.max(0.15, aspect)),
      }), false);
    });
    size.addEventListener('change', () => {
      this.dependencies.persist();
      if (sizeSnapshot !== null) this.dependencies.recordHistory(sizeSnapshot, `resize image ${placement.name}`);
      sizeSnapshot = null;
    });
    sizeLabel.append(size);
    const opacityLabel = document.createElement('label'); opacityLabel.textContent = 'Opacity';
    const opacity = document.createElement('input'); opacity.type = 'range'; opacity.min = '0.1'; opacity.max = '1'; opacity.step = '0.05'; opacity.value = String(placement.opacity);
    let opacitySnapshot: TSnapshot | null = null;
    const beginOpacityEdit = (): void => { opacitySnapshot ??= this.dependencies.captureSnapshot(); };
    opacity.addEventListener('pointerdown', beginOpacityEdit); opacity.addEventListener('keydown', beginOpacityEdit);
    opacity.addEventListener('input', () => {
      beginOpacityEdit();
      this.updatePlacement(placement.id, (current) => ({ ...current, opacity: Number(opacity.value) }), false);
    });
    opacity.addEventListener('change', () => {
      this.dependencies.persist();
      if (opacitySnapshot !== null) this.dependencies.recordHistory(opacitySnapshot, `change opacity for ${placement.name}`);
      opacitySnapshot = null;
    });
    opacityLabel.append(opacity); controls.append(sizeLabel, opacityLabel);
    const actions = document.createElement('div'); actions.className = 'placed-image-actions';
    const focus = document.createElement('button'); focus.type = 'button'; focus.textContent = 'Focus';
    focus.addEventListener('click', () => this.dependencies.focusMapPoint(placement.x, placement.y));
    const rotate = document.createElement('button'); rotate.type = 'button'; rotate.textContent = 'Rotate';
    rotate.addEventListener('click', () => {
      const snapshot = this.dependencies.captureSnapshot();
      this.updatePlacement(placement.id, (current) => ({ ...current, rotation: current.rotation + Math.PI / 2 }));
      this.dependencies.recordHistory(snapshot, `rotate image ${placement.name}`);
    });
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove';
    remove.addEventListener('click', () => this.removePlacement(placement.id));
    actions.append(focus, rotate, remove);
    content.append(titleRow, controls, actions); item.append(preview, content);
    return item;
  }
}
