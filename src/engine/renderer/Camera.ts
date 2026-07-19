export interface Point {
  readonly x: number;
  readonly y: number;
}

export class Camera {
  public x = 0;
  public y = 0;
  public zoom = 3;

  private readonly minimumZoom = 0.5;
  private readonly maximumZoom = 24;

  public pan(screenDeltaX: number, screenDeltaY: number): void {
    this.x += screenDeltaX;
    this.y += screenDeltaY;
  }

  public zoomAt(screenX: number, screenY: number, factor: number): void {
    const worldBefore = this.screenToWorld(screenX, screenY);
    this.zoom = Math.min(this.maximumZoom, Math.max(this.minimumZoom, this.zoom * factor));
    const screenAfter = this.worldToScreen(worldBefore.x, worldBefore.y);
    this.x += screenX - screenAfter.x;
    this.y += screenY - screenAfter.y;
  }

  public worldToScreen(worldX: number, worldY: number): Point {
    return {
      x: this.x + worldX * this.zoom,
      y: this.y + worldY * this.zoom,
    };
  }

  public screenToWorld(screenX: number, screenY: number): Point {
    return {
      x: (screenX - this.x) / this.zoom,
      y: (screenY - this.y) / this.zoom,
    };
  }

  public focus(
    worldX: number,
    worldY: number,
    viewportWidth: number,
    viewportHeight: number,
    zoom = 8,
  ): void {
    this.zoom = Math.min(this.maximumZoom, Math.max(this.minimumZoom, zoom));
    this.x = viewportWidth * 0.5 - (worldX + 0.5) * this.zoom;
    this.y = viewportHeight * 0.5 - (worldY + 0.5) * this.zoom;
  }

  public fit(worldWidth: number, worldHeight: number, viewportWidth: number, viewportHeight: number): void {
    const padding = 24;
    const availableWidth = Math.max(1, viewportWidth - padding * 2);
    const availableHeight = Math.max(1, viewportHeight - padding * 2);
    this.zoom = Math.min(
      this.maximumZoom,
      Math.max(this.minimumZoom, Math.min(availableWidth / worldWidth, availableHeight / worldHeight)),
    );
    this.x = (viewportWidth - worldWidth * this.zoom) * 0.5;
    this.y = (viewportHeight - worldHeight * this.zoom) * 0.5;
  }
}
