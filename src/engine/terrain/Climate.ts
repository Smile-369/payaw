import type { ClimateConfig, TerrainConfig } from '../config/GenerationConfig';
import { clamp01, smoothstep } from '../math/Scalar';
import { OpenSimplexNoise2D } from '../rng/OpenSimplex2D';
import type { Random } from '../rng/Random';
import { WaterType } from '../world/Tile';
import type { World } from '../world/World';

export function generateClimate(
  world: World,
  terrainConfig: TerrainConfig,
  climateConfig: ClimateConfig,
  random: Random,
): void {
  const temperatureNoise = new OpenSimplexNoise2D(random.fork('temperature'));
  const moistureNoise = new OpenSimplexNoise2D(random.fork('moisture'));
  const forestNoise = new OpenSimplexNoise2D(random.fork('forest'));
  const widthDenominator = Math.max(1, world.width - 1);
  const heightDenominator = Math.max(1, world.height - 1);

  for (const tile of world.tiles) {
    const normalizedX = tile.x / widthDenominator;
    const normalizedY = tile.y / heightDenominator;
    const elevationAboveSea = Math.max(0, tile.elevation - terrainConfig.seaLevel)
      / Math.max(Number.EPSILON, 1 - terrainConfig.seaLevel);
    const latitudeCooling = climateConfig.preset === 'boreal' ? Math.abs(normalizedY - 0.5) * 0.10 : climateConfig.preset === 'temperate' ? Math.abs(normalizedY - 0.5) * 0.05 : (1 - normalizedY) * 0.025;
    const temperatureVariation = temperatureNoise.sample(
      normalizedX * climateConfig.temperatureNoiseScale,
      normalizedY * climateConfig.temperatureNoiseScale,
    ) * climateConfig.temperatureNoiseStrength;

    tile.temperature = clamp01(
      climateConfig.baseTemperature
      - elevationAboveSea * climateConfig.elevationCooling
      - latitudeCooling
      + temperatureVariation,
    );

    if (tile.water !== WaterType.Land) {
      tile.moisture = 1;
      tile.forestDensity = 0;
      continue;
    }

    const moistureVariation = moistureNoise.sample(
      normalizedX * climateConfig.moistureNoiseScale,
      normalizedY * climateConfig.moistureNoiseScale,
    ) * climateConfig.moistureNoiseStrength;
    const oceanInfluence = Math.exp(
      -tile.coastDistance / Math.max(1, climateConfig.oceanMoistureDistance),
    ) * climateConfig.oceanMoistureStrength;
    const easternRain = smoothstep(0.48, 1, normalizedX) * climateConfig.easternRainStrength;
    const mountainRain = smoothstep(terrainConfig.hillLevel, 0.9, tile.elevation) * (climateConfig.preset === 'tropical-rainforest' ? 0.13 : 0.08);

    tile.moisture = clamp01(
      climateConfig.baseMoisture
      + moistureVariation
      + oceanInfluence
      + easternRain
      + mountainRain,
    );

    const forestVariation = forestNoise.sample(normalizedX * 5.2, normalizedY * 5.2) * 0.12;
    const moistureGrowth = smoothstep(0.38, 0.82, tile.moisture);
    const ruggedGrowth = smoothstep(0.08, 0.48, tile.slope) * 0.2;
    const uplandGrowth = smoothstep(terrainConfig.hillLevel - 0.08, 0.82, tile.elevation) * 0.18;
    const westernFarmlandBias = (1 - smoothstep(0.18, 0.48, normalizedX))
      * smoothstep(0.3, 0.8, normalizedY)
      * climateConfig.westernFarmlandForestReduction;

    tile.forestDensity = clamp01(
      moistureGrowth * 0.72
      + ruggedGrowth
      + uplandGrowth
      + forestVariation
      - westernFarmlandBias,
    );
  }
}
