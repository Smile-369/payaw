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
  private readonly touchPoints = new Map<number, { readonly x: number; readonly y: number }>();
  private primaryTouchEvent: PointerEvent | null = null;
  private pinchDistance: number | null = null;
  private pinchMidpoint: { readonly x: number; readonly y: number } | null = null;
  private suppressTouchDrag = false;
  private ignoreNextClick = false;

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
    canvas.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
    canvas.addEventListener('pointermove', (event) => this.handlePointerMove(event));
    canvas.addEventListener('pointerup', (event) => this.handlePointerEnd(event, false));
    canvas.addEventListener('pointercancel', (event) => this.handlePointerEnd(event, true));
    canvas.addEventListener('wheel', (event) => this.handleWheel(event), { passive: false });
    canvas.addEventListener('dblclick', (event) => this.handleDoubleClick(event));
    canvas.addEventListener('click', (event) => this.handleClick(event));
  }

  private touchGeometry(): { readonly distance: number; readonly x: number; readonly y: number } | null {
    const points = [...this.touchPoints.values()];
    const first = points[0];
    const second = points[1];
    if (first === undefined || second === undefined) return null;
    return {
      distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'touch') {
      this.dependencies.handlePointerDown(event);
      return;
    }
    event.preventDefault();
    this.touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.dependencies.canvas.setPointerCapture(event.pointerId);
    if (this.touchPoints.size === 1) {
      this.primaryTouchEvent = event;
      this.suppressTouchDrag = false;
      this.dependencies.handlePointerDown(event);
      return;
    }
    if (this.touchPoints.size === 2) {
      if (this.primaryTouchEvent !== null) this.dependencies.handlePointerEnd(this.primaryTouchEvent, true);
      for (const pointerId of this.touchPoints.keys()) {
        if (!this.dependencies.canvas.hasPointerCapture(pointerId)) this.dependencies.canvas.setPointerCapture(pointerId);
      }
      this.primaryTouchEvent = null;
      this.suppressTouchDrag = true;
      this.ignoreNextClick = true;
      const geometry = this.touchGeometry();
      this.pinchDistance = geometry?.distance ?? null;
      this.pinchMidpoint = geometry === null ? null : { x: geometry.x, y: geometry.y };
    }
  }

  private handlePointerMove(event: PointerEvent): void {
    if (event.pointerType !== 'touch') {
      this.dependencies.handlePointerMove(event);
      return;
    }
    if (!this.touchPoints.has(event.pointerId)) return;
    this.touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!this.suppressTouchDrag) {
      this.dependencies.handlePointerMove(event);
      return;
    }
    const geometry = this.touchGeometry();
    if (geometry === null) return;
    event.preventDefault();
    const rectangle = this.dependencies.canvas.getBoundingClientRect();
    if (this.pinchMidpoint !== null) {
      this.dependencies.camera.pan(geometry.x - this.pinchMidpoint.x, geometry.y - this.pinchMidpoint.y);
    }
    if (this.pinchDistance !== null) {
      this.dependencies.camera.zoomAt(
        geometry.x - rectangle.left,
        geometry.y - rectangle.top,
        geometry.distance / this.pinchDistance,
      );
    }
    this.pinchDistance = geometry.distance;
    this.pinchMidpoint = { x: geometry.x, y: geometry.y };
    this.dependencies.requestRender();
  }

  private handlePointerEnd(event: PointerEvent, cancelled: boolean): void {
    if (event.pointerType !== 'touch') {
      this.dependencies.handlePointerEnd(event, cancelled);
      return;
    }
    const wasSuppressed = this.suppressTouchDrag;
    this.touchPoints.delete(event.pointerId);
    if (this.dependencies.canvas.hasPointerCapture(event.pointerId)) this.dependencies.canvas.releasePointerCapture(event.pointerId);
    if (!wasSuppressed) {
      this.primaryTouchEvent = null;
      this.dependencies.handlePointerEnd(event, cancelled);
      return;
    }
    this.pinchDistance = null;
    this.pinchMidpoint = null;
    if (this.touchPoints.size === 0) this.suppressTouchDrag = false;
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
    if (this.ignoreNextClick) {
      this.ignoreNextClick = false;
      return;
    }
    if (this.dependencies.shouldIgnoreClick()) return;
    const rectangle = this.dependencies.canvas.getBoundingClientRect();
    const position = this.dependencies.camera.screenToWorld(event.clientX - rectangle.left, event.clientY - rectangle.top);
    if (this.dependencies.session.authoringTool !== 'select' && this.dependencies.handleAuthoringClick(position.x, position.y)) return;
    if (this.dependencies.handleTravelClick(position.x, position.y)) return;
    this.dependencies.inspectPosition(position.x, position.y);
  }
}
