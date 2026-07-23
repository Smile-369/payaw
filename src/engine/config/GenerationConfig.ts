export interface NoiseConfig {
  readonly octaves: number;
  readonly persistence: number;
  readonly lacunarity: number;
  /** World tiles per base noise cycle. Larger values create broader terrain. */
  readonly scale: number;
}

export interface WorldConfig {
  readonly width: number;
  readonly height: number;
  /** Physical scale used by travel and distance reporting. */
  readonly tileSizeMeters: number;
}

export interface TerrainConfig {
  readonly shapeProfile: string;
  readonly targetIslandCount: number;
  readonly islandSpacingKilometers: number;
  readonly seaLevel: number;
  readonly deepWaterDepth: number;
  readonly beachWidth: number;
  readonly hillLevel: number;
  readonly mountainLevel: number;
  readonly forestTerrainThreshold: number;
  readonly wetlandFloodRiskThreshold: number;
  readonly northMountainStrength: number;
  readonly southBayStrength: number;
  readonly eastPeninsulaStrength: number;
  readonly westLowlandStrength: number;
  readonly westFarmlandShelfStrength: number;
  readonly coastlineVariation: number;
  readonly coastlineSmoothingPasses: number;
  readonly coastlineSmoothingStrength: number;
  readonly elevationNoise: NoiseConfig;
}

export interface MountainConfig {
  readonly ridgeStrength: number;
  readonly ridgeWidth: number;
  readonly ridgeNoiseScale: number;
  readonly ridgeOctaves: number;
  readonly ridgePersistence: number;
  readonly ridgeLacunarity: number;
  readonly ridgeSharpness: number;
  readonly centerlineControlPoints: number;
  readonly centerlineJitter: number;
  readonly voronoiInfluence: number;
  readonly voronoiCellCount: number;
  readonly passCount: number;
  readonly passDepth: number;
  readonly passWidth: number;
}

export interface ThermalErosionConfig {
  readonly iterations: number;
  readonly talusThreshold: number;
  readonly transferCoefficient: number;
  readonly maximumTransfer: number;
}

export interface ClimateConfig {
  readonly preset: string;
  readonly baseTemperature: number;
  readonly temperatureNoiseStrength: number;
  readonly temperatureNoiseScale: number;
  readonly elevationCooling: number;
  readonly baseMoisture: number;
  readonly moistureNoiseStrength: number;
  readonly moistureNoiseScale: number;
  readonly oceanMoistureStrength: number;
  readonly oceanMoistureDistance: number;
  readonly easternRainStrength: number;
  readonly westernFarmlandForestReduction: number;
}

export interface HydraulicErosionConfig {
  readonly iterations: number;
  readonly rainfallAmount: number;
  readonly mountainRainfallBoost: number;
  readonly flowRate: number;
  readonly evaporationRate: number;
  readonly infiltrationRate: number;
  readonly sedimentCapacity: number;
  readonly erosionRate: number;
  readonly depositionRate: number;
  readonly minimumSlope: number;
  readonly maximumErosionPerIteration: number;
}

export interface HydrologyConfig {
  readonly riverSourceCount: number;
  readonly sourceMinElevation: number;
  readonly sourceMinMoisture: number;
  readonly sourceMinCoastDistance: number;
  readonly sourceSpacing: number;
  readonly minimumRiverLength: number;
  readonly flowEpsilon: number;
  readonly baseRunoff: number;
  readonly moistureRunoff: number;
  readonly maximumRiverWidth: number;
  readonly minimumRiverWidth: number;
  readonly widthCoefficient: number;
  readonly widthExponent: number;
  readonly maximumRiverDepth: number;
  readonly minimumRiverDepth: number;
  readonly depthCoefficient: number;
  readonly depthExponent: number;
  readonly dischargeNormalization: number;
  readonly channelCarvingStrength: number;
  readonly meanderStrength: number;
  readonly meanderNoiseScale: number;
  readonly lateralErosionStrength: number;
  readonly oxbowCutoffDistance: number;
  readonly oxbowMinimumLoopLength: number;
  readonly floodplainMaximumRadius: number;
  readonly floodplainSlopeLimit: number;
  readonly floodplainElevationTolerance: number;
  readonly deltaMinimumDischarge: number;
  readonly deltaVelocityDamping: number;
  readonly deltaDepositionRate: number;
  readonly deltaSearchRadius: number;
  readonly deltaDistributaryCount: number;
  readonly deltaDistributaryLength: number;
}

export interface AnchorConfig {
  readonly minimumSpacing: number;
  readonly candidateLimit: number;
  readonly centerSearchRadius: number;
  readonly plazaRadius: number;
  readonly churchRadius: number;
  readonly marketRadius: number;
  readonly schoolRadius: number;
  readonly hospitalRadius: number;
  readonly portRadius: number;
  readonly airportRadius: number;
  readonly riceFieldsRadius: number;
  readonly haciendaRadius: number;
  readonly airportFlatRadius: number;
  readonly airportMaximumRelief: number;
  readonly maximumUrbanSlope: number;
  readonly maximumAirportSlope: number;
  readonly maximumFloodRisk: number;
}

export interface RoadConfig {
  readonly slopeWeight: number;
  readonly elevationWeight: number;
  readonly mountainPenalty: number;
  readonly forestPenalty: number;
  readonly floodplainPenalty: number;
  readonly riverCrossingPenalty: number;
  readonly existingRoadDiscount: number;
  readonly extraAnchorConnections: number;
  readonly secondaryRoadCount: number;
  readonly secondaryMinimumLength: number;
  readonly secondaryMaximumLength: number;
  readonly secondaryTargetRadius: number;
  readonly localRoadCount: number;
  readonly localMinimumLength: number;
  readonly localMaximumLength: number;
  readonly localTownRadius: number;
  readonly localPairMinimumDistance: number;
  readonly localPairMaximumDistance: number;
  readonly maximumPathVisits: number;
}


export interface BridgeConfig {
  readonly minimumSpan: number;
  readonly maximumSpan: number;
  readonly maximumManualSpan: number;
  readonly maximumBridges: number;
  readonly extraBridgeConnections: number;
  readonly maximumCoastSamples: number;
  readonly supportSpacing: number;
  readonly spanCostWeight: number;
  readonly depthCostWeight: number;
  readonly approachSlopeCostWeight: number;
  readonly approachRoadCostWeight: number;
  readonly badShorelineAnglePenalty: number;
  readonly populationBenefitWeight: number;
  readonly roleBenefitWeight: number;
  readonly minimumExtraConnectionScore: number;
}


export interface MaritimeConfig {
  readonly maximumPortsPerIsland: number;
  readonly maximumRoutes: number;
  readonly extraRouteConnections: number;
  readonly maximumCoastSamples: number;
  readonly minimumPortWaterDepth: number;
  readonly maximumPortRoadDistance: number;
  readonly portDepthWeight: number;
  readonly portShelterWeight: number;
  readonly portFlatnessWeight: number;
  readonly portRoadAccessWeight: number;
  readonly portFloodPenalty: number;
  readonly routeDistanceWeight: number;
  readonly routeDemandWeight: number;
  readonly bridgeCompetitionPenalty: number;
  readonly shallowWaterPenalty: number;
  readonly openWaterPenalty: number;
  readonly maximumPathVisits: number;
  readonly tileSizeKilometers: number;
  readonly smallBoatSpeedKph: number;
  readonly cargoSpeedKph: number;
  readonly boardingMinutes: number;
}

export interface AccessibilityConfig {
  readonly mainRoadCost: number;
  readonly secondaryRoadCost: number;
  readonly localRoadCost: number;
  readonly offRoadCost: number;
  readonly diagonalCost: number;
  readonly slopeWeight: number;
  readonly floodRiskWeight: number;
  readonly serviceCostScale: number;
  readonly roadDistanceScale: number;
  readonly maximumRoadDistance: number;
  readonly serviceWeight: number;
  readonly roadProximityWeight: number;
}

export interface BlockConfig {
  readonly maximumRoadDistance: number;
  readonly maximumSlope: number;
  readonly maximumFloodRisk: number;
  readonly minimumArea: number;
  readonly maximumArea: number;
  readonly minimumRoadFrontage: number;
  readonly urbanAnchorRadius: number;
  readonly portAnchorRadius: number;
  readonly airportAnchorRadius: number;
}

export interface LandValueConfig {
  readonly baseValue: number;
  readonly accessibilityWeight: number;
  readonly roadProximityWeight: number;
  readonly roadDistanceScale: number;
  readonly marketInfluence: number;
  readonly marketRadius: number;
  readonly churchInfluence: number;
  readonly churchRadius: number;
  readonly plazaInfluence: number;
  readonly plazaRadius: number;
  readonly hospitalInfluence: number;
  readonly hospitalRadius: number;
  readonly coastInfluence: number;
  readonly coastRadius: number;
  readonly slopePenalty: number;
  readonly floodPenalty: number;
  readonly isolationPenalty: number;
  readonly isolationDistance: number;
  readonly forestPenalty: number;
}

export interface ZoningConfig {
  readonly governmentRadius: number;
  readonly institutionalRadius: number;
  readonly commercialLandValueThreshold: number;
  readonly commercialRoadDistance: number;
  readonly residentialLandValueThreshold: number;
  readonly industrialAnchorRadius: number;
  readonly agriculturalAnchorRadius: number;
  readonly agriculturalWestThreshold: number;
  readonly forestDensityThreshold: number;
  readonly forestRoadDistance: number;
  readonly smoothingPasses: number;
  readonly minimumZoneArea: number;
}

export interface BuildingConfig {
  readonly maximumBuildingsPerBlock: number;
  readonly minimumBuildingSpacing: number;
  readonly minimumLotDepth: number;
  readonly maximumFloodRisk: number;
  readonly maximumSlope: number;
  readonly anchorSearchRadius: number;
  readonly roadFrontageSearchRadius: number;
  readonly occupancyTargetResidential: number;
  readonly occupancyTargetCommercial: number;
  readonly occupancyTargetIndustrial: number;
  readonly occupancyTargetInstitutional: number;
  readonly occupancyTargetGovernment: number;
  readonly specialBuildingChance: number;
}

export interface VegetationConfig {
  readonly forestSpawnThreshold: number;
  readonly forestDensityScale: number;
  readonly agriculturalCropSpacing: number;
  readonly roadsideTreeChance: number;
  readonly coastalPalmChance: number;
  readonly mangroveFloodRiskThreshold: number;
  readonly minimumBuildingDistance: number;
  readonly maximumInstances: number;
}

export interface StoryConfig {
  readonly baleteCount: number;
  readonly baleteMinimumSpacing: number;
  readonly baleteMinimumForestDensity: number;
  readonly baleteMaximumNearbyBuildings: number;
  readonly landmarkMinimumSpacing: number;
  readonly candidateLimit: number;
  readonly buildingSearchRadius: number;
}

export interface GenerationConfig {
  readonly version: string;
  readonly world: WorldConfig;
  readonly terrain: TerrainConfig;
  readonly mountains: MountainConfig;
  readonly thermalErosion: ThermalErosionConfig;
  readonly climate: ClimateConfig;
  readonly hydraulicErosion: HydraulicErosionConfig;
  readonly hydrology: HydrologyConfig;
  readonly anchors: AnchorConfig;
  readonly roads: RoadConfig;
  readonly bridges: BridgeConfig;
  readonly maritime: MaritimeConfig;
  readonly accessibility: AccessibilityConfig;
  readonly blocks: BlockConfig;
  readonly landValue: LandValueConfig;
  readonly zoning: ZoningConfig;
  readonly buildings: BuildingConfig;
  readonly vegetation: VegetationConfig;
  readonly story: StoryConfig;
}

export const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  version: 'payaw-m20-campaign-system-v1',
  world: {
    width: 256,
    height: 192,
    tileSizeMeters: 125,
  },
  terrain: {
    shapeProfile: 'full-island',
    targetIslandCount: 5,
    islandSpacingKilometers: 4,
    seaLevel: 0.38,
    deepWaterDepth: 0.085,
    beachWidth: 0.025,
    hillLevel: 0.64,
    mountainLevel: 0.78,
    forestTerrainThreshold: 0.57,
    wetlandFloodRiskThreshold: 0.46,
    northMountainStrength: 0.34,
    southBayStrength: 0.4,
    eastPeninsulaStrength: 0.25,
    westLowlandStrength: 0.12,
    westFarmlandShelfStrength: 0.34,
    coastlineVariation: 0.16,
    coastlineSmoothingPasses: 2,
    coastlineSmoothingStrength: 0.012,
    elevationNoise: {
      octaves: 5,
      persistence: 0.5,
      lacunarity: 2,
      scale: 80,
    },
  },
  mountains: {
    ridgeStrength: 0.17,
    ridgeWidth: 0.145,
    ridgeNoiseScale: 3.4,
    ridgeOctaves: 5,
    ridgePersistence: 0.52,
    ridgeLacunarity: 2.05,
    ridgeSharpness: 1.8,
    centerlineControlPoints: 7,
    centerlineJitter: 0.052,
    voronoiInfluence: 0.16,
    voronoiCellCount: 13,
    passCount: 3,
    passDepth: 0.075,
    passWidth: 0.045,
  },
  thermalErosion: {
    iterations: 12,
    talusThreshold: 0.035,
    transferCoefficient: 0.24,
    maximumTransfer: 0.018,
  },
  climate: {
    preset: 'tropical-monsoon',
    baseTemperature: 0.86,
    temperatureNoiseStrength: 0.075,
    temperatureNoiseScale: 3.2,
    elevationCooling: 0.47,
    baseMoisture: 0.43,
    moistureNoiseStrength: 0.22,
    moistureNoiseScale: 2.65,
    oceanMoistureStrength: 0.31,
    oceanMoistureDistance: 38,
    easternRainStrength: 0.08,
    westernFarmlandForestReduction: 0.31,
  },
  hydraulicErosion: {
    iterations: 22,
    rainfallAmount: 0.012,
    mountainRainfallBoost: 0.018,
    flowRate: 0.46,
    evaporationRate: 0.06,
    infiltrationRate: 0.018,
    sedimentCapacity: 4.2,
    erosionRate: 0.085,
    depositionRate: 0.14,
    minimumSlope: 0.0015,
    maximumErosionPerIteration: 0.0035,
  },
  hydrology: {
    riverSourceCount: 9,
    sourceMinElevation: 0.59,
    sourceMinMoisture: 0.41,
    sourceMinCoastDistance: 11,
    sourceSpacing: 18,
    minimumRiverLength: 24,
    flowEpsilon: 0.000001,
    baseRunoff: 0.35,
    moistureRunoff: 1.65,
    maximumRiverWidth: 2.25,
    minimumRiverWidth: 0.3,
    widthCoefficient: 0.32,
    widthExponent: 0.5,
    maximumRiverDepth: 0.072,
    minimumRiverDepth: 0.008,
    depthCoefficient: 0.0085,
    depthExponent: 0.4,
    dischargeNormalization: 40,
    channelCarvingStrength: 0.68,
    meanderStrength: 1.85,
    meanderNoiseScale: 0.14,
    lateralErosionStrength: 0.3,
    oxbowCutoffDistance: 2.2,
    oxbowMinimumLoopLength: 14,
    floodplainMaximumRadius: 8,
    floodplainSlopeLimit: 0.2,
    floodplainElevationTolerance: 0.05,
    deltaMinimumDischarge: 42,
    deltaVelocityDamping: 0.12,
    deltaDepositionRate: 0.72,
    deltaSearchRadius: 5,
    deltaDistributaryCount: 3,
    deltaDistributaryLength: 14,
  },
  anchors: {
    minimumSpacing: 12,
    candidateLimit: 384,
    centerSearchRadius: 72,
    plazaRadius: 5,
    churchRadius: 4,
    marketRadius: 5,
    schoolRadius: 7,
    hospitalRadius: 6,
    portRadius: 7,
    airportRadius: 13,
    riceFieldsRadius: 15,
    haciendaRadius: 11,
    airportFlatRadius: 7,
    airportMaximumRelief: 0.18,
    maximumUrbanSlope: 0.16,
    maximumAirportSlope: 0.075,
    maximumFloodRisk: 0.58,
  },
  roads: {
    slopeWeight: 22,
    elevationWeight: 3.5,
    mountainPenalty: 34,
    forestPenalty: 2.5,
    floodplainPenalty: 7,
    riverCrossingPenalty: 18,
    existingRoadDiscount: 0.34,
    extraAnchorConnections: 3,
    secondaryRoadCount: 18,
    secondaryMinimumLength: 12,
    secondaryMaximumLength: 34,
    secondaryTargetRadius: 30,
    localRoadCount: 20,
    localMinimumLength: 7,
    localMaximumLength: 26,
    localTownRadius: 54,
    localPairMinimumDistance: 8,
    localPairMaximumDistance: 26,
    maximumPathVisits: 140000,
  },
  bridges: {
    minimumSpan: 3,
    maximumSpan: 62,
    maximumManualSpan: 92,
    maximumBridges: 4,
    extraBridgeConnections: 1,
    maximumCoastSamples: 96,
    supportSpacing: 6,
    spanCostWeight: 0.34,
    depthCostWeight: 44,
    approachSlopeCostWeight: 18,
    approachRoadCostWeight: 0.18,
    badShorelineAnglePenalty: 3.5,
    populationBenefitWeight: 2.6,
    roleBenefitWeight: 6,
    minimumExtraConnectionScore: 3.5,
  },
  maritime: {
    maximumPortsPerIsland: 1,
    maximumRoutes: 8,
    extraRouteConnections: 2,
    maximumCoastSamples: 120,
    minimumPortWaterDepth: 0.012,
    maximumPortRoadDistance: 34,
    portDepthWeight: 18,
    portShelterWeight: 5.5,
    portFlatnessWeight: 4.5,
    portRoadAccessWeight: 0.22,
    portFloodPenalty: 5,
    routeDistanceWeight: 0.11,
    routeDemandWeight: 2.3,
    bridgeCompetitionPenalty: 9,
    shallowWaterPenalty: 14,
    openWaterPenalty: 0.18,
    maximumPathVisits: 180000,
    tileSizeKilometers: 0.125,
    smallBoatSpeedKph: 18,
    cargoSpeedKph: 20,
    boardingMinutes: 8,
  },
  accessibility: {
    mainRoadCost: 0.42,
    secondaryRoadCost: 0.68,
    localRoadCost: 0.82,
    offRoadCost: 2.35,
    diagonalCost: 1.41421356237,
    slopeWeight: 9,
    floodRiskWeight: 4.5,
    serviceCostScale: 92,
    roadDistanceScale: 13,
    maximumRoadDistance: 80,
    serviceWeight: 0.64,
    roadProximityWeight: 0.36,
  },
  blocks: {
    maximumRoadDistance: 13,
    maximumSlope: 0.22,
    maximumFloodRisk: 0.76,
    minimumArea: 8,
    maximumArea: 1900,
    minimumRoadFrontage: 3,
    urbanAnchorRadius: 58,
    portAnchorRadius: 28,
    airportAnchorRadius: 34,
  },
  landValue: {
    baseValue: 0.18,
    accessibilityWeight: 0.31,
    roadProximityWeight: 0.2,
    roadDistanceScale: 8,
    marketInfluence: 0.18,
    marketRadius: 34,
    churchInfluence: 0.09,
    churchRadius: 30,
    plazaInfluence: 0.12,
    plazaRadius: 38,
    hospitalInfluence: 0.06,
    hospitalRadius: 34,
    coastInfluence: 0.08,
    coastRadius: 22,
    slopePenalty: 0.22,
    floodPenalty: 0.18,
    isolationPenalty: 0.14,
    isolationDistance: 18,
    forestPenalty: 0.08,
  },
  zoning: {
    governmentRadius: 9,
    institutionalRadius: 11,
    commercialLandValueThreshold: 0.57,
    commercialRoadDistance: 4,
    residentialLandValueThreshold: 0.31,
    industrialAnchorRadius: 31,
    agriculturalAnchorRadius: 43,
    agriculturalWestThreshold: 0.58,
    forestDensityThreshold: 0.66,
    forestRoadDistance: 17,
    smoothingPasses: 2,
    minimumZoneArea: 5,
  },
  buildings: {
    maximumBuildingsPerBlock: 34,
    minimumBuildingSpacing: 1,
    minimumLotDepth: 3,
    maximumFloodRisk: 0.62,
    maximumSlope: 0.18,
    anchorSearchRadius: 32,
    roadFrontageSearchRadius: 3,
    occupancyTargetResidential: 0.42,
    occupancyTargetCommercial: 0.58,
    occupancyTargetIndustrial: 0.46,
    occupancyTargetInstitutional: 0.35,
    occupancyTargetGovernment: 0.32,
    specialBuildingChance: 0.13,
  },
  vegetation: {
    forestSpawnThreshold: 0.52,
    forestDensityScale: 0.42,
    agriculturalCropSpacing: 3,
    roadsideTreeChance: 0.075,
    coastalPalmChance: 0.16,
    mangroveFloodRiskThreshold: 0.42,
    minimumBuildingDistance: 1,
    maximumInstances: 18000,
  },
  story: {
    baleteCount: 3,
    baleteMinimumSpacing: 24,
    baleteMinimumForestDensity: 0.5,
    baleteMaximumNearbyBuildings: 4,
    landmarkMinimumSpacing: 18,
    candidateLimit: 320,
    buildingSearchRadius: 8,
  },
};
