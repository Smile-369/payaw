import type { Camera } from '../engine/renderer/Camera';
import type { EditorSession } from '../models/EditorSession';

export interface MapInteractionControllerDependencies {
  readonly canvas: HTMLCanvasElement;
  readonly viewportShell: HTMLElement;
  readonly camera: Camera;
  readonly session: EditorSession;
  readonly handleDrop: (event: DragEvent) => Promise<void>;
  readonly handlePointerDown: (event: PointerEvent) => void;
  readonly handlePointerMove: (event: PointerEvent) => void;
  readonly handlePointerEnd: (event: PointerEvent, cancelled: boolean) => void;
  readonly shouldIgnoreClick: () => boolean;
  readonly handleAuthoringClick: (x: number, y: number) => boolean;
  readonly handleTravelClick: (x: number, y: number) => boolean;
  readonly inspectPosition: (x: number, y: number) => void;
  readonly fitCamera: () => void;
  readonly requestRender: () => void;
}

export class MapInteractionController {
  private dragDepth = 0;

  public constructor(private readonly dependencies: MapInteractionControllerDependencies) {
    this.bindEvents();
  }

  private bindEvents(): void {
    const { canvas } = this.dependencies;
    canvas.addEventListener('dragenter', (event) => {
      event.preventDefault();
      this.dragDepth += 1;
      this.dependencies.viewportShell.dataset.dropActive = 'true';
    });
    canvas.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy';
      this.dependencies.viewportShell.dataset.dropActive = 'true';
    });
    canvas.addEventListener('dragleave', () => {
      this.dragDepth = Math.max(0, this.dragDepth - 1);
      if (this.dragDepth === 0) this.dependencies.viewportShell.dataset.dropActive = 'false';
    });
    canvas.addEventListener('drop', (event) => {
      this.dragDepth = 0;
      void this.dependencies.handleDrop(event);
    });
    canvas.addEventListener('pointerdown', this.dependencies.handlePointerDown);
    canvas.addEventListener('pointermove', this.dependencies.handlePointerMove);
    canvas.addEventListener('pointerup', (event) => this.dependencies.handlePointerEnd(event, false));
    canvas.addEventListener('pointercancel', (event) => this.dependencies.handlePointerEnd(event, true));
    canvas.addEventListener('wheel', (event) => this.handleWheel(event), { passive: false });
    canvas.addEventListener('dblclick', (event) => this.handleDoubleClick(event));
    canvas.addEventListener('click', (event) => this.handleClick(event));
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const rectangle = this.dependencies.canvas.getBoundingClientRect();
    this.dependencies.camera.zoomAt(
      event.clientX - rectangle.left,
      event.clientY - rectangle.top,
      Math.exp(-event.deltaY * 0.0015),
    );
    this.dependencies.requestRender();
  }

  private handleDoubleClick(event: MouseEvent): void {
    const tool = this.dependencies.session.authoringTool;
    if (tool === 'polyline' || tool === 'polygon' || tool === 'anchor' || tool === 'point') {
      event.preventDefault();
      return;
    }
    this.dependencies.fitCamera();
  }

  private handleClick(event: MouseEvent): void {
    if (this.dependencies.shouldIgnoreClick()) return;
    const rectangle = this.dependencies.canvas.getBoundingClientRect();
    const position = this.dependencies.camera.screenToWorld(event.clientX - rectangle.left, event.clientY - rectangle.top);
    if (this.dependencies.session.authoringTool !== 'select' && this.dependencies.handleAuthoringClick(position.x, position.y)) return;
    if (this.dependencies.handleTravelClick(position.x, position.y)) return;
    this.dependencies.inspectPosition(position.x, position.y);
  }
}
