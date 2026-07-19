export enum VegetationType {
  CoconutPalm = 'coconut-palm',
  MangoTree = 'mango-tree',
  Acacia = 'acacia',
  Banana = 'banana',
  Bamboo = 'bamboo',
  Mangrove = 'mangrove',
  RiceCrop = 'rice-crop',
  Sugarcane = 'sugarcane',
  ForestTree = 'forest-tree',
  Scrub = 'scrub',
}

export interface VegetationInstance {
  readonly id: number;
  readonly type: VegetationType;
  readonly tileIndex: number;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly scale: number;
  readonly age: number;
}
