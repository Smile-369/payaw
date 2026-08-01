import type { World } from '../engine/world/World';
import { WaterType } from '../engine/world/Tile';

export interface WorldStatisticsContext {
  readonly zoneOverrideCount: number;
  readonly storyRuleOverrideCount: number;
  readonly importedAssetCount: number;
  readonly placedImageCount: number;
}

export function renderWorldStatistics(container: HTMLElement, world: World, context: WorldStatisticsContext): void {
  let minimumElevation = 1;
  let maximumElevation = 0;
  let landTiles = 0;
  let riverTiles = 0;
  let floodplainTiles = 0;
  let totalLandValue = 0;
  let totalAccessibility = 0;
  for (const tile of world.tiles) {
    minimumElevation = Math.min(minimumElevation, tile.elevation);
    maximumElevation = Math.max(maximumElevation, tile.elevation);
    if (tile.water === WaterType.Land) {
      landTiles += 1;
      totalLandValue += tile.landValue;
      totalAccessibility += tile.accessibility;
    }
    if (tile.river) riverTiles += 1;
    if (tile.floodRisk >= 0.35) floodplainTiles += 1;
  }
  const duration = Object.values(world.diagnostics.stageTimingsMs).reduce((sum, value) => sum + value, 0);
  const divisor = Math.max(1, landTiles);
  const rows: readonly [string, string][] = [
    ['Seed', world.seed],
    ['Profile', `${world.metadata.terrainSize} · ${world.metadata.townScale}`],
    ['Dimensions', `${world.width} × ${world.height} tiles · ${world.metadata.worldWidthKilometers.toFixed(0)} × ${world.metadata.worldHeightKilometers.toFixed(0)} km`],
    ['Tile scale', `${world.metadata.tileSizeMeters} m per tile`],
    ['Island profile', `${world.metadata.targetIslandCount} target · ${world.metadata.islandSpacingKilometers.toFixed(1)} km gap`],
    ['Land', `${((landTiles / world.tiles.length) * 100).toFixed(1)}%`],
    ['Landmasses', world.landmasses.length.toLocaleString()],
    ['Islands', world.islands.length.toLocaleString()],
    ['Communities', world.settlements.length.toLocaleString()],
    ['Regional population', world.islands.reduce((sum, island) => sum + island.allocatedPopulation, 0).toLocaleString()],
    ['Rivers', `${world.rivers.length} · ${riverTiles.toLocaleString()} tiles`],
    ['Floodplain', `${floodplainTiles.toLocaleString()} tiles`],
    ['Anchors', world.anchors.length.toLocaleString()],
    ['Roads', world.roads.length.toLocaleString()],
    ['Bridges', world.bridges.length.toLocaleString()],
    ['Ports', world.ports.length.toLocaleString()],
    ['Blocks', world.blocks.length.toLocaleString()],
    ['Zones', world.zones.length.toLocaleString()],
    ['Zone overrides', context.zoneOverrideCount.toLocaleString()],
    ['Buildings', world.buildings.length.toLocaleString()],
    ['Vegetation', world.vegetation.length.toLocaleString()],
    ['Story sites', world.storyObjects.length.toLocaleString()],
    ['NPCs', world.npcs.length.toLocaleString()],
    ['Story rule overrides', context.storyRuleOverrideCount.toLocaleString()],
    ['Imported assets', context.importedAssetCount.toLocaleString()],
    ['Placed images', context.placedImageCount.toLocaleString()],
    ['Accessibility', (totalAccessibility / divisor).toFixed(3)],
    ['Land value', (totalLandValue / divisor).toFixed(3)],
    ['Elevation', `${minimumElevation.toFixed(3)}–${maximumElevation.toFixed(3)}`],
    ['Generation', `${duration.toFixed(1)} ms`],
    ['Version', world.metadata.generationVersion],
  ];
  container.replaceChildren();
  for (const [label, value] of rows) {
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value;
    container.append(term, description);
  }
}
