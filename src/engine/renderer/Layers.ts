export enum RenderLayer {
  Terrain = 'terrain',
  Elevation = 'elevation',
  Moisture = 'moisture',
  Temperature = 'temperature',
  Accessibility = 'accessibility',
  LandValue = 'land-value',
  Zones = 'zones',
  Floodplains = 'floodplains',
  Rivers = 'rivers',
  Islands = 'islands',
  IslandLabels = 'island-labels',
  Settlements = 'settlements',
  Blocks = 'blocks',
  BlockLabels = 'block-labels',
  Roads = 'roads',
  Bridges = 'bridges',
  BridgeLabels = 'bridge-labels',
  Ports = 'ports',
  PortLabels = 'port-labels',
  RoadLabels = 'road-labels',
  Buildings = 'buildings',
  CustomImages = 'custom-images',
  Vegetation = 'vegetation',
  Anchors = 'anchors',
  Story = 'story',
  NPCs = 'npcs',
  Authoring = 'authoring',
  HiddenPayaw = 'hidden-payaw',
  LiveInfrastructure = 'live-infrastructure',
  VenueStatus = 'venue-status',
  SettlementActivity = 'settlement-activity',
  SupernaturalActivity = 'supernatural-activity',
  Travel = 'travel',
  Grid = 'grid',
}

export class LayerVisibility {
  private readonly visibleLayers = new Set<RenderLayer>([
    RenderLayer.Terrain,
    RenderLayer.Zones,
    RenderLayer.Floodplains,
    RenderLayer.Rivers,
    RenderLayer.Islands,
    RenderLayer.IslandLabels,
    RenderLayer.Settlements,
    RenderLayer.Blocks,
    RenderLayer.BlockLabels,
    RenderLayer.Roads,
    RenderLayer.Bridges,
    RenderLayer.BridgeLabels,
    RenderLayer.Ports,
    RenderLayer.PortLabels,
    RenderLayer.RoadLabels,
    RenderLayer.Buildings,
    RenderLayer.CustomImages,
    RenderLayer.Vegetation,
    RenderLayer.Anchors,
    RenderLayer.Story,
    RenderLayer.NPCs,
    RenderLayer.Authoring,
    RenderLayer.Travel,
  ]);

  public isVisible(layer: RenderLayer): boolean {
    return this.visibleLayers.has(layer);
  }

  public setVisible(layer: RenderLayer, visible: boolean): void {
    if (visible) this.visibleLayers.add(layer);
    else this.visibleLayers.delete(layer);
  }

  public visible(): readonly RenderLayer[] {
    return [...this.visibleLayers];
  }

  public copyFrom(other: LayerVisibility): void {
    this.visibleLayers.clear();
    for (const layer of other.visible()) this.visibleLayers.add(layer);
  }
}
