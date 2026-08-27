export type CurrencyType = 'essence' | 'void_crystals' | 'astral_shards' | 'void_scraps';

export type CombatState = 'NORMAL' | 'BOSS_FIGHT' | 'FARM_MODE';

export interface EnemyDefinition {
  id: string;
  displayName: string;
  texture: string;
  hpMultiplier: number;
  isBoss?: boolean;
  glowColor?: { r: number; g: number; b: number; a: number };
  viewScale?: number;
}

export interface WorldDefinition {
  id: string;
  displayName: string;
  description?: string;
  firstLevel: number;
  enemyIds: string[];
  bossIds: string[];
  essenceMultiplier: number;
}

export interface UpgradeDefinition {
  id: string;
  displayName: string;
  description: string;
  stat: string;
  modifierType: 'ADDITIVE' | 'PERCENT'; // 0 = ADDITIVE, 1 = PERCENT
  valuePerLevel: number;
  displayAsPercent: boolean;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  sortOrder: number;
}

export type ItemRarity = 0 | 1 | 2 | 3 | 4; // Common, Rare, Epic, Legendary, Mythic

export interface SlotDefinition {
  id: string;
  displayName: string;
  icon: string;
  sealed: boolean;
  sortOrder: number;
}

export interface AffixDefinition {
  id: string;
  stat: string;
  displayName: string;
  displayTemplate: string;
  isPercent: boolean;
  minValue: number;
  maxValue: number;
}

export interface Item {
  id: number;
  slot: string;
  rarity: ItemRarity;
  itemLevel: number;
  affixes: Record<string, number>;
  seen?: boolean;
}

export interface CardRarityDefinition {
  id: string;
  displayName: string;
  tierColor: string;
  potency: number;
  dropWeight: number;
}

export interface Card {
  id: number;
  bossId: string;
  bossName: string;
  rarity: string;
  level: number;
  power: number; // Pet XP
  vigor: number; // Permanent Pet Bonus
  obtainedAt: number;
}

export interface RelicDefinition {
  id: string;
  displayName: string;
  sigil: string;
  effectId: string;
  effectValue: number;
  effectDescription: string;
  flavor: string;
  dropWeight: number;
}

export interface OwnedRelic {
  id: string;
  seen: boolean;
}

export interface PetDefinition {
  id: string;
  stageNames: string[];
  stageSprites: string[];
  evolutionLevels: number[];
  bonusStat: string;
  bonusPerLevel: number;
  maxLevel: number;
}

export interface OwnedPet {
  xp: number;
  seen: boolean;
  absorbed: number;
}

export interface SkillNodeDefinition {
  id: string;
  branch: 'Fortune' | 'Ascendance' | 'Automation' | 'Might';
  displayName: string;
  description: string;
  effectKind: number; // 0 = stat, 1 = flag
  effectStat: string;
  valuePerLevel: number;
  displayAsPercent: boolean;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  prereqId?: string;
  prereqLevel?: number;
  sortOrder: number;
}

export interface MinigameDefinition {
  id: string;
  displayName: string;
  description: string;
  icon: string;
  unlockLevel: number;
  rewardSeconds: number;
  tokenCost: number;
  lowerIsBetter?: boolean;
  sortOrder: number;
}

export type QuestKind = 'CHAIN' | 'DAILY' | 'ACHIEVEMENT'; // 0 = chain, 1 = daily, 2 = achievement

export interface QuestDefinition {
  id: string;
  displayName: string;
  description: string;
  kind: QuestKind;
  metric: string;
  targetValue: number;
  rewardKind: 'ESSENCE' | 'TOKENS' | 'CRYSTALS' | 'SHARDS'; // 0 = essence, 1 = tokens, 2 = crystals, 3 = shards
  rewardAmount: number;
  sortOrder: number;
  prereqId?: string;
}

export interface ShopProductDefinition {
  id: string;
  storeId: string;
  displayName: string;
  description: string;
  kind: 'REMOVE_ADS' | 'STARTER_PACK' | 'SHARDS';
  priceText: string;
  crystals?: number;
  tokens?: number;
  cosmeticId?: string;
  shards?: number;
  sortOrder: number;
}

export interface CosmeticDefinition {
  id: string;
  displayName: string;
  description?: string;
  trailColor: { r: number; g: number; b: number; a: number };
  numberColor: { r: number; g: number; b: number; a: number };
  shardPrice: number;
  sortOrder: number;
}

export interface AdPlacementDefinition {
  id: string;
  displayName: string;
  description: string;
  rewardKind: 'ESSENCE' | 'TOKEN' | 'OFFLINE_DOUBLE'; // 0 = essence, 1 = token, 2 = offline double
  rewardAmount: number;
  dailyCap: number;
  contextual?: boolean;
  sortOrder: number;
}

export interface GameSettings {
  sfxVolume: number;
  bgmVolume: number;
  sfxMuted: boolean;
  bgmMuted: boolean;
  hapticsEnabled: boolean;
  damageNumbers: boolean;
  screenShake: boolean;
}

export interface OfflineRewardData {
  amount: number;
  secondsAway: number;
  wasCapped: boolean;
}

export interface DamageNumberData {
  id: string;
  amount: number;
  isCrit: boolean;
  x: number;
  y: number;
}
