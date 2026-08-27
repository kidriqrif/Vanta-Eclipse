import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  CurrencyType,
  CombatState,
  EnemyDefinition,
  Item,
  Card,
  OwnedRelic,
  OwnedPet,
  GameSettings,
  OfflineRewardData,
  DamageNumberData,
} from '../types/game';
import {
  WORLDS,
  ENEMIES,
  UPGRADES,
  SLOTS,
  AFFIXES,
  CARD_RARITIES,
  RELICS,
  PETS,
  SKILLS,
  MINIGAMES,
  QUESTS,
  COSMETICS,
  ADS,
} from '../data/definitions';
import { sound } from '../utils/audio';

const STORAGE_KEY = 'vanta_eclipse_save_v1';
const AUTO_ATTACK_UNLOCK_LEVEL = 15;
const BASE_AUTO_ATTACK_INTERVAL = 1.0;
const BOSS_FIGHT_DURATION = 30.0;
const TOKEN_CAP = 5;
const TOKEN_REGEN_SECONDS = 1800; // 30 minutes

interface GameContextType {
  // State
  currencies: Record<CurrencyType, number>;
  combatState: CombatState;
  enemyLevel: number;
  currentEnemy: EnemyDefinition;
  enemyHp: number;
  enemyMaxHp: number;
  bossTimer: number;
  worldIndex: number;
  isWorldUnlocked: (worldId: string) => boolean;
  activeWorld: typeof WORLDS[0];

  // Upgrades
  upgradeLevels: Record<string, number>;
  getUpgradeCost: (id: string, count?: number) => number;
  buyUpgrade: (id: string, count?: number) => boolean;
  buyMaxUpgrade: (id: string) => boolean;

  // Equipment
  equipped: Record<string, Item>;
  inventory: Item[];
  equipItem: (itemId: number) => boolean;
  unequipItem: (slot: string) => boolean;
  salvageItem: (itemId: number) => number;
  salvageAllCommons: () => number;
  forgeItem: (slot: string) => Item | null;
  unseenItemCount: number;
  markAllItemsSeen: () => void;

  // Cards
  cards: Card[];
  absorbCard: (cardId: number) => boolean;

  // Pets
  ownedPets: Record<string, OwnedPet>;
  activePetId: string;
  setActivePet: (id: string) => void;
  getPetLevel: (petId: string) => number;

  // Relics
  relicsAwakened: boolean;
  ownedRelics: OwnedRelic[];
  activeRelicId: string;
  setActiveRelic: (id: string) => void;

  // Skills (Skill Tree)
  skillLevels: Record<string, number>;
  getSkillCost: (id: string) => number;
  buySkill: (id: string) => boolean;
  canBuySkill: (id: string) => boolean;

  // Prestige
  peakRunLevel: number;
  lifetimePeakLevel: number;
  eclipseCount: number;
  calculateEclipsePayout: () => number;
  performEclipse: () => boolean;

  // Stats
  tapDamage: number;
  critChance: number;
  critDamage: number;
  essenceMultiplier: number;
  bossDamageMultiplier: number;
  autoAttackUnlocked: boolean;
  autoAttackInterval: number;
  liveEssenceRate: number;

  // Arcade / Minigames
  tokens: number;
  tokenRegenSecondsLeft: number;
  minigameRecords: Record<string, number>;
  spendToken: (cost?: number) => boolean;
  finishMinigame: (id: string, score: number, won: boolean) => number;

  // Journal / Quests
  questCounters: Record<string, number>;
  completedQuests: string[];
  claimedQuests: string[];
  claimQuestReward: (questId: string) => boolean;
  activeDailyIds: string[];

  // Shop & Monetization
  purchasedProducts: string[];
  activeCosmeticId: string;
  setActiveCosmetic: (id: string) => void;
  buyCosmetic: (id: string) => boolean;
  buyProduct: (productId: string) => boolean;
  adWatchCounts: Record<string, { date: string; count: number }>;
  watchAd: (placementId: string) => boolean;
  hasRemovedAds: boolean;

  // Settings
  settings: GameSettings;
  updateSettings: (partial: Partial<GameSettings>) => void;

  // Actions
  handleTap: (e: React.MouseEvent | React.TouchEvent) => void;
  startBossFight: () => void;
  leaveBossFight: () => void;
  advanceToNextLevel: () => void;
  toggleFarmMode: () => void;

  // Damage Numbers & Visuals
  damageNumbers: DamageNumberData[];
  isEnemyHit: boolean;
  newWorldUnlockedModal: string | null;
  closeWorldModal: () => void;
  offlineRewardsModal: OfflineRewardData | null;
  claimOfflineRewards: (double?: boolean) => void;
  resetGameSave: () => void;
  exportSave: () => string;
  importSave: (jsonStr: string) => boolean;
}

const GameContext = createContext<GameContextType | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Currencies
  const [currencies, setCurrencies] = useState<Record<CurrencyType, number>>({
    essence: 0,
    void_crystals: 0,
    astral_shards: 0,
    void_scraps: 0,
  });

  // Combat State
  const [enemyLevel, setEnemyLevel] = useState<number>(1);
  const [combatState, setCombatState] = useState<CombatState>('NORMAL');
  const [enemyHp, setEnemyHp] = useState<number>(10);
  const [enemyMaxHp, setEnemyMaxHp] = useState<number>(10);
  const [bossTimer, setBossTimer] = useState<number>(BOSS_FIGHT_DURATION);
  const [isEnemyHit, setIsEnemyHit] = useState<boolean>(false);
  const [currentEnemyDef, setCurrentEnemyDef] = useState<EnemyDefinition>(ENEMIES['gloom_wisp']);

  // Progression & Peaks
  const [peakRunLevel, setPeakRunLevel] = useState<number>(1);
  const [lifetimePeakLevel, setLifetimePeakLevel] = useState<number>(1);
  const [eclipseCount, setEclipseCount] = useState<number>(0);
  const [unlockedWorlds, setUnlockedWorlds] = useState<string[]>(['dark_forest']);
  const [newWorldUnlockedModal, setNewWorldUnlockedModal] = useState<string | null>(null);

  // Upgrades
  const [upgradeLevels, setUpgradeLevels] = useState<Record<string, number>>({});

  // Equipment
  const [equipped, setEquipped] = useState<Record<string, Item>>({});
  const [inventory, setInventory] = useState<Item[]>([]);
  const [nextItemId, setNextItemId] = useState<number>(1);

  // Cards
  const [cards, setCards] = useState<Card[]>([]);

  // Pets & Relics
  const [ownedPets, setOwnedPets] = useState<Record<string, OwnedPet>>({});
  const [activePetId, setActivePetId] = useState<string>('');
  const [relicsAwakened, setRelicsAwakened] = useState<boolean>(false);
  const [ownedRelics, setOwnedRelics] = useState<OwnedRelic[]>([]);
  const [activeRelicId, setActiveRelicId] = useState<string>('');

  // Skills
  const [skillLevels, setSkillLevels] = useState<Record<string, number>>({});

  // Arcade
  const [tokens, setTokens] = useState<number>(TOKEN_CAP);
  const [tokenRegenSecondsLeft, setTokenRegenSecondsLeft] = useState<number>(TOKEN_REGEN_SECONDS);
  const [minigameRecords, setMinigameRecords] = useState<Record<string, number>>({});

  // Quests & Journal
  const [questCounters, setQuestCounters] = useState<Record<string, number>>({
    kills: 0,
    boss_wins: 0,
    upgrades_bought: 0,
    items_dropped: 0,
    eclipses: 0,
    minigame_played: 0,
    minigame_wins: 0,
  });
  const [completedQuests, setCompletedQuests] = useState<string[]>([]);
  const [claimedQuests, setClaimedQuests] = useState<string[]>([]);
  const [activeDailyIds, setActiveDailyIds] = useState<string[]>(['d_slayer', 'd_bosses', 'd_shopper']);
  const [lastDailyDate, setLastDailyDate] = useState<string>('');

  // Shop & Monetization
  const [purchasedProducts, setPurchasedProducts] = useState<string[]>([]);
  const [activeCosmeticId, setActiveCosmeticId] = useState<string>('trail_void');
  const [adWatchCounts, setAdWatchCounts] = useState<Record<string, { date: string; count: number }>>({});

  // Settings
  const [settings, setSettings] = useState<GameSettings>({
    sfxVolume: 0.8,
    bgmVolume: 0.5,
    sfxMuted: false,
    bgmMuted: false,
    hapticsEnabled: true,
    damageNumbers: true,
    screenShake: true,
  });

  // UI Floating Damage Numbers
  const [damageNumbers, setDamageNumbers] = useState<DamageNumberData[]>([]);
  const [offlineRewardsModal, setOfflineRewardsModal] = useState<OfflineRewardData | null>(null);

  const lastSaveTimeRef = useRef<number>(Date.now());
  const autoAttackAccRef = useRef<number>(0);

  // --- World determination ---
  const activeWorld = enemyLevel >= 51 ? WORLDS[1] : WORLDS[0];

  const isWorldUnlocked = useCallback(
    (worldId: string) => unlockedWorlds.includes(worldId),
    [unlockedWorlds]
  );

  // --- Helper to increment journal counters ---
  const bumpCounter = useCallback((metric: string, amount: number = 1) => {
    setQuestCounters((prev) => {
      const current = prev[metric] || 0;
      return { ...prev, [metric]: current + amount };
    });
  }, []);

  // --- Stats Calculations ---
  const getAffixSum = useCallback(
    (stat: string): number => {
      let sum = 0;
      Object.values(equipped).forEach((item) => {
        if (item && item.affixes && item.affixes[stat] !== undefined) {
          sum += item.affixes[stat];
        }
      });
      return sum;
    },
    [equipped]
  );

  const getPetBonus = useCallback(
    (stat: string): number => {
      if (!activePetId || !ownedPets[activePetId]) return 0;
      const petDef = PETS.find((p) => p.id === activePetId);
      if (!petDef || petDef.bonusStat !== stat) return 0;
      const petData = ownedPets[activePetId];
      const petLevel = Math.min(petDef.maxLevel, 1 + Math.floor(petData.xp / 60));
      const baseBonus = petLevel * petDef.bonusPerLevel;
      const absorbedBonus = Math.min(0.5, petData.absorbed || 0);
      return baseBonus + absorbedBonus;
    },
    [activePetId, ownedPets]
  );

  const getRelicBonus = useCallback(
    (effectId: string): number => {
      if (!activeRelicId) return 0;
      const relic = RELICS.find((r) => r.id === activeRelicId);
      if (relic && relic.effectId === effectId) {
        return relic.effectValue;
      }
      return 0;
    },
    [activeRelicId]
  );

  const getSkillStat = useCallback(
    (stat: string): number => {
      let sum = 0;
      SKILLS.forEach((skill) => {
        if (skill.effectStat === stat) {
          const level = skillLevels[skill.id] || 0;
          sum += level * skill.valuePerLevel;
        }
      });
      return sum;
    },
    [skillLevels]
  );

  // Computed Tap Damage
  const baseTapFlat = 1 + (upgradeLevels['void_claws'] || 0) * 1.0 + getAffixSum('tap_flat');
  const tapPctMultiplier =
    (1 + (upgradeLevels['eclipse_fangs'] || 0) * 0.1) *
    (1 + getAffixSum('tap_pct')) *
    (1 + getPetBonus('tap_pct')) *
    (1 + getSkillStat('tap_pct'));
  const tapDamage = Math.max(1, Math.round(baseTapFlat * tapPctMultiplier));

  // Computed Crit Chance
  const baseCritChance = 0.05 + (upgradeLevels['dark_focus'] || 0) * 0.005 + getAffixSum('crit_chance');
  const critChance = Math.min(1.0, Math.max(0.05, baseCritChance));

  // Computed Crit Damage
  const baseCritDamage =
    2.0 +
    (upgradeLevels['blood_moon'] || 0) * 0.25 +
    getAffixSum('crit_damage') +
    getRelicBonus('crit_dmg') +
    getSkillStat('crit_damage');
  const critDamage = Math.max(1.5, baseCritDamage);

  // Computed Essence Multiplier
  const essenceMultiplier =
    activeWorld.essenceMultiplier *
    (1 + (upgradeLevels['essence_siphon'] || 0) * 0.1) *
    (1 + getAffixSum('essence')) *
    (1 + getPetBonus('essence')) *
    (1 + getSkillStat('essence')) *
    (getRelicBonus('essence_mult') > 0 ? getRelicBonus('essence_mult') : 1.0);

  // Boss Damage Multiplier
  const bossDamageMultiplier =
    (1 + getAffixSum('boss')) *
    (1 + getRelicBonus('boss_pct')) *
    (1 + getSkillStat('boss'));

  // Auto Attack Speed
  const autoAttackUnlocked =
    enemyLevel >= AUTO_ATTACK_UNLOCK_LEVEL || (skillLevels['eternal_reflex'] || 0) > 0;
  const attackSpeedMult =
    (getRelicBonus('attack_speed') > 0 ? getRelicBonus('attack_speed') : 1.0) *
    (1 + getSkillStat('attack_speed'));
  const autoAttackInterval = BASE_AUTO_ATTACK_INTERVAL / Math.max(0.1, attackSpeedMult);

  // Live Essence Earning Rate (essence/sec)
  const baseEnemyHpAtLevel = 10 * Math.pow(enemyLevel, 1.45);
  const baseKillTime = Math.max(0.5, baseEnemyHpAtLevel / (tapDamage * (1 / autoAttackInterval)));
  const essencePerKill = Math.max(1, Math.round(Math.pow(enemyLevel, 1.25) * essenceMultiplier));
  const liveEssenceRate = autoAttackUnlocked ? essencePerKill / baseKillTime : 0;

  // --- Currency Helpers ---
  const addCurrency = useCallback((currency: CurrencyType, amount: number) => {
    if (amount <= 0 || isNaN(amount)) return;
    setCurrencies((prev) => ({
      ...prev,
      [currency]: (prev[currency] || 0) + amount,
    }));
    if (currency === 'essence') bumpCounter('essence_earned', amount);
    if (currency === 'void_crystals') bumpCounter('crystals_earned', amount);
  }, [bumpCounter]);

  const trySpendCurrency = useCallback((currency: CurrencyType, amount: number): boolean => {
    let success = false;
    setCurrencies((prev) => {
      if ((prev[currency] || 0) >= amount) {
        success = true;
        return { ...prev, [currency]: prev[currency] - amount };
      }
      return prev;
    });
    return success;
  }, []);

  // --- Spawn Enemy Helper ---
  const spawnEnemy = useCallback(
    (level: number, state: CombatState) => {
      const world = level >= 51 ? WORLDS[1] : WORLDS[0];
      const isBossGate = level % 10 === 0 && state !== 'FARM_MODE';
      const isBoss = isBossGate || state === 'BOSS_FIGHT';

      let def: EnemyDefinition;
      if (isBoss) {
        const bossPool = world.bossIds;
        const bossId = bossPool[(Math.floor((level - 1) / 10)) % bossPool.length] || bossPool[0];
        def = ENEMIES[bossId] || ENEMIES['elder_gloom_wisp'];
      } else {
        const enemyPool = world.enemyIds;
        const enemyId = enemyPool[Math.floor(Math.random() * enemyPool.length)];
        def = ENEMIES[enemyId] || ENEMIES['gloom_wisp'];
      }

      const hpMult = def.hpMultiplier || 1.0;
      const baseHp = Math.round(10 * Math.pow(level, 1.45) * (isBoss ? 4.5 : 1.0) * hpMult);

      setCurrentEnemyDef(def);
      setEnemyMaxHp(baseHp);
      setEnemyHp(baseHp);
      setBossTimer(BOSS_FIGHT_DURATION);
    },
    []
  );

  // --- Enemy Death & Rewards ---
  const handleEnemyDied = useCallback(() => {
    sound.play('enemy_death');
    bumpCounter('kills', 1);

    // Give Pet XP
    if (activePetId) {
      setOwnedPets((prev) => {
        const current = prev[activePetId] || { xp: 0, seen: true, absorbed: 0 };
        return {
          ...prev,
          [activePetId]: { ...current, xp: current.xp + 3 },
        };
      });
    }

    const isBoss = currentEnemyDef.isBoss || enemyLevel % 10 === 0;

    if (isBoss) {
      sound.play('boss_defeat');
      bumpCounter('boss_wins', 1);

      // Boss payout
      const bossEssence = Math.max(10, Math.round(Math.pow(enemyLevel, 1.35) * essenceMultiplier * 5));
      addCurrency('essence', bossEssence);

      // Card Trophy Drop
      const roll = Math.random();
      let rarity = 'common';
      let acc = 0;
      for (const r of CARD_RARITIES) {
        acc += r.dropWeight;
        if (roll <= acc) {
          rarity = r.id;
          break;
        }
      }
      const rarityDef = CARD_RARITIES.find((r) => r.id === rarity) || CARD_RARITIES[0];
      const cardPower = Math.round(enemyLevel * 8 * rarityDef.potency * (0.85 + Math.random() * 0.3));
      const cardVigor = Math.round(10 * rarityDef.potency * (0.85 + Math.random() * 0.3));

      const newCard: Card = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        bossId: currentEnemyDef.id,
        bossName: currentEnemyDef.displayName,
        rarity,
        level: enemyLevel,
        power: cardPower,
        vigor: cardVigor,
        obtainedAt: Date.now(),
      };

      setCards((prev) => [newCard, ...prev].slice(0, 200));

      // Relic Drop in Frozen Ruins
      if (enemyLevel >= 51 && relicsAwakened && ownedRelics.length < RELICS.length) {
        if (Math.random() < 0.25) {
          const unowned = RELICS.filter((r) => !ownedRelics.some((o) => o.id === r.id));
          if (unowned.length > 0) {
            const chosen = unowned[Math.floor(Math.random() * unowned.length)];
            setOwnedRelics((prev) => [{ id: chosen.id, seen: false }, ...prev]);
            sound.play('loot');
          }
        }
      }

      // Pet Drop in Frozen Ruins
      if (enemyLevel >= 51 && !ownedPets['frostling'] && Math.random() < 0.15) {
        setOwnedPets((prev) => ({
          ...prev,
          frostling: { xp: 0, seen: false, absorbed: 0 },
        }));
        sound.play('fanfare');
      }

      // 10% Chance for Bonus Arcade Token
      if (Math.random() < 0.1) {
        setTokens((prev) => Math.min(TOKEN_CAP, prev + 1));
      }

      // Guaranteed Boss Gear Drop
      const rollRarity = Math.random();
      let gearRarity: 0 | 1 | 2 | 3 | 4 = 0;
      if (rollRarity < 0.3) gearRarity = 0;
      else if (rollRarity < 0.7) gearRarity = 1;
      else if (rollRarity < 0.92) gearRarity = 2;
      else if (rollRarity < 0.99) gearRarity = 3;
      else gearRarity = 4;

      const unsealedSlots = SLOTS.filter((s) => !s.sealed);
      const chosenSlot = unsealedSlots[Math.floor(Math.random() * unsealedSlots.length)].id;
      const affixCount = gearRarity + 1;
      const shuffledAffixes = [...AFFIXES].sort(() => 0.5 - Math.random());
      const itemAffixes: Record<string, number> = {};

      shuffledAffixes.slice(0, affixCount).forEach((affix) => {
        const coef = affix.minValue + Math.random() * (affix.maxValue - affix.minValue);
        const rMult = [1.0, 1.15, 1.3, 1.5, 1.75][gearRarity];
        if (affix.isPercent) {
          itemAffixes[affix.id] = Number((coef * rMult).toFixed(3));
        } else {
          itemAffixes[affix.id] = Math.max(1, Math.round(enemyLevel * coef * rMult));
        }
      });

      const droppedItem: Item = {
        id: nextItemId,
        slot: chosenSlot,
        rarity: gearRarity,
        itemLevel: enemyLevel,
        affixes: itemAffixes,
        seen: false,
      };
      setNextItemId((prev) => prev + 1);
      setInventory((prev) => [droppedItem, ...prev]);
      bumpCounter('items_dropped', 1);

      // Advance Level past Boss
      const nextLvl = enemyLevel + 1;
      setEnemyLevel(nextLvl);
      setPeakRunLevel((prev) => Math.max(prev, nextLvl));
      setLifetimePeakLevel((prev) => Math.max(prev, nextLvl));
      setCombatState('NORMAL');

      // Check World Unlock
      if (nextLvl >= 51 && !unlockedWorlds.includes('frozen_ruins')) {
        setUnlockedWorlds((prev) => [...prev, 'frozen_ruins']);
        setRelicsAwakened(true);
        // Grant starter pet if none owned
        setOwnedPets((prev) => {
          if (!prev['ember']) {
            return { ...prev, ember: { xp: 0, seen: false, absorbed: 0 } };
          }
          return prev;
        });
        if (!activePetId) setActivePetId('ember');
        setNewWorldUnlockedModal('frozen_ruins');
        sound.play('fanfare');
      }

      spawnEnemy(nextLvl, 'NORMAL');
    } else {
      // Normal Kill
      const normalEssence = Math.max(1, Math.round(Math.pow(enemyLevel, 1.25) * essenceMultiplier));
      addCurrency('essence', normalEssence);

      // Normal Drop Chance (3%)
      if (Math.random() < 0.03) {
        const rollRarity = Math.random();
        let gearRarity: 0 | 1 | 2 | 3 | 4 = 0;
        if (rollRarity < 0.74) gearRarity = 0;
        else if (rollRarity < 0.94) gearRarity = 1;
        else if (rollRarity < 0.99) gearRarity = 2;
        else gearRarity = 3;

        const unsealedSlots = SLOTS.filter((s) => !s.sealed);
        const chosenSlot = unsealedSlots[Math.floor(Math.random() * unsealedSlots.length)].id;
        const affixCount = gearRarity + 1;
        const shuffledAffixes = [...AFFIXES].sort(() => 0.5 - Math.random());
        const itemAffixes: Record<string, number> = {};

        shuffledAffixes.slice(0, affixCount).forEach((affix) => {
          const coef = affix.minValue + Math.random() * (affix.maxValue - affix.minValue);
          const rMult = [1.0, 1.15, 1.3, 1.5, 1.75][gearRarity];
          if (affix.isPercent) {
            itemAffixes[affix.id] = Number((coef * rMult).toFixed(3));
          } else {
            itemAffixes[affix.id] = Math.max(1, Math.round(enemyLevel * coef * rMult));
          }
        });

        const droppedItem: Item = {
          id: nextItemId,
          slot: chosenSlot,
          rarity: gearRarity,
          itemLevel: enemyLevel,
          affixes: itemAffixes,
          seen: false,
        };
        setNextItemId((prev) => prev + 1);
        setInventory((prev) => [droppedItem, ...prev]);
        bumpCounter('items_dropped', 1);
      }

      // Progression
      if (combatState === 'FARM_MODE') {
        spawnEnemy(enemyLevel, 'FARM_MODE');
      } else {
        const nextLvl = enemyLevel + 1;
        // Boss Gate check
        if (nextLvl % 10 === 0) {
          setEnemyLevel(nextLvl);
          setPeakRunLevel((prev) => Math.max(prev, nextLvl));
          setLifetimePeakLevel((prev) => Math.max(prev, nextLvl));
          setCombatState('BOSS_FIGHT');
          spawnEnemy(nextLvl, 'BOSS_FIGHT');
          sound.play('boss_warn');
        } else {
          setEnemyLevel(nextLvl);
          setPeakRunLevel((prev) => Math.max(prev, nextLvl));
          setLifetimePeakLevel((prev) => Math.max(prev, nextLvl));
          spawnEnemy(nextLvl, 'NORMAL');
        }
      }
    }
  }, [
    activePetId,
    activeRelicId,
    addCurrency,
    bumpCounter,
    combatState,
    currentEnemyDef,
    enemyLevel,
    essenceMultiplier,
    nextItemId,
    ownedPets,
    ownedRelics,
    relicsAwakened,
    spawnEnemy,
    unlockedWorlds,
  ]);

  // --- Damage Applicator ---
  const applyDamage = useCallback(
    (isAuto: boolean, clientX?: number, clientY?: number) => {
      const isCrit = Math.random() < critChance;
      const isBoss = currentEnemyDef.isBoss || enemyLevel % 10 === 0;
      const bossMult = isBoss ? bossDamageMultiplier : 1.0;
      const rawDamage = tapDamage * (isCrit ? critDamage : 1.0) * bossMult;
      const damageDone = Math.max(1, Math.round(rawDamage));

      if (isCrit) {
        sound.play('crit_hit');
      } else {
        sound.play('tap_hit');
      }

      setIsEnemyHit(true);
      setTimeout(() => setIsEnemyHit(false), 200);

      // Trigger Damage Number
      if (settings.damageNumbers) {
        const numId = `${Date.now()}_${Math.random()}`;
        const x = clientX ?? window.innerWidth / 2 + (Math.random() * 80 - 40);
        const y = clientY ?? window.innerHeight / 3 + (Math.random() * 40 - 20);
        setDamageNumbers((prev) => [...prev, { id: numId, amount: damageDone, isCrit, x, y }]);
        setTimeout(() => {
          setDamageNumbers((prev) => prev.filter((d) => d.id !== numId));
        }, 850);
      }

      // Apply HP
      setEnemyHp((prev) => {
        const newHp = prev - damageDone;
        if (newHp <= 0) {
          handleEnemyDied();
          return 0;
        }
        return newHp;
      });
    },
    [bossDamageMultiplier, critChance, critDamage, currentEnemyDef, enemyLevel, handleEnemyDied, settings.damageNumbers, tapDamage]
  );

  // --- Tap Handler ---
  const handleTap = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      let x = window.innerWidth / 2;
      let y = window.innerHeight / 3;

      if ('touches' in e && e.touches.length > 0) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
      } else if ('clientX' in e) {
        x = (e as React.MouseEvent).clientX;
        y = (e as React.MouseEvent).clientY;
      }

      applyDamage(false, x, y);
    },
    [applyDamage]
  );

  // --- Boss Timers & Auto Attack Loop ---
  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Boss Timer
      if (combatState === 'BOSS_FIGHT') {
        setBossTimer((prev) => {
          if (prev <= 0.1) {
            // Boss Failed: fall back to farm mode on previous level
            sound.play('fail');
            setCombatState('FARM_MODE');
            const fallbackLevel = Math.max(1, enemyLevel - 1);
            setEnemyLevel(fallbackLevel);
            spawnEnemy(fallbackLevel, 'FARM_MODE');
            return BOSS_FIGHT_DURATION;
          }
          return prev - 0.1;
        });
      }

      // 2. Auto-attack ticker
      if (autoAttackUnlocked) {
        autoAttackAccRef.current += 0.1;
        if (autoAttackAccRef.current >= autoAttackInterval) {
          autoAttackAccRef.current -= autoAttackInterval;
          applyDamage(true);
        }
      }

      // 3. Arcade Token Regen (every 1 second)
      setTokens((curTokens) => {
        if (curTokens < TOKEN_CAP) {
          setTokenRegenSecondsLeft((prevSec) => {
            if (prevSec <= 1) {
              return TOKEN_REGEN_SECONDS;
            }
            return prevSec - 0.1;
          });
        }
        return curTokens;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [autoAttackInterval, autoAttackUnlocked, applyDamage, combatState, enemyLevel, spawnEnemy]);

  // Handle Token Increment when regen completes
  useEffect(() => {
    if (tokens < TOKEN_CAP && tokenRegenSecondsLeft <= 1) {
      setTokens((prev) => Math.min(TOKEN_CAP, prev + 1));
      setTokenRegenSecondsLeft(TOKEN_REGEN_SECONDS);
    }
  }, [tokenRegenSecondsLeft, tokens]);

  // --- Upgrades Actions ---
  const getUpgradeCost = useCallback(
    (id: string, count: number = 1): number => {
      const def = UPGRADES.find((u) => u.id === id);
      if (!def) return 0;
      const currentLevel = upgradeLevels[id] || 0;
      let total = 0;
      for (let i = 0; i < count; i++) {
        total += Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel + i));
      }
      return total;
    },
    [upgradeLevels]
  );

  const buyUpgrade = useCallback(
    (id: string, count: number = 1): boolean => {
      const cost = getUpgradeCost(id, count);
      const def = UPGRADES.find((u) => u.id === id);
      if (!def) return false;
      const curLvl = upgradeLevels[id] || 0;
      if (def.maxLevel > 0 && curLvl + count > def.maxLevel) return false;

      if (trySpendCurrency('essence', cost)) {
        setUpgradeLevels((prev) => ({
          ...prev,
          [id]: (prev[id] || 0) + count,
        }));
        bumpCounter('upgrades_bought', count);
        sound.play('levelup');
        return true;
      }
      return false;
    },
    [bumpCounter, getUpgradeCost, trySpendCurrency, upgradeLevels]
  );

  const buyMaxUpgrade = useCallback(
    (id: string): boolean => {
      const def = UPGRADES.find((u) => u.id === id);
      if (!def) return false;
      const curLvl = upgradeLevels[id] || 0;
      let count = 0;
      let costSum = 0;

      while (true) {
        if (def.maxLevel > 0 && curLvl + count >= def.maxLevel) break;
        const nextCost = Math.round(def.baseCost * Math.pow(def.costGrowth, curLvl + count));
        if (currencies.essence < costSum + nextCost) break;
        costSum += nextCost;
        count++;
        if (count >= 1000) break; // safety guard
      }

      if (count > 0) {
        return buyUpgrade(id, count);
      }
      return false;
    },
    [buyUpgrade, currencies.essence, upgradeLevels]
  );

  // --- Equipment Actions ---
  const equipItem = useCallback(
    (itemId: number): boolean => {
      const itemIndex = inventory.findIndex((i) => i.id === itemId);
      if (itemIndex === -1) return false;
      const item = inventory[itemIndex];
      const slotDef = SLOTS.find((s) => s.id === item.slot);
      if (!slotDef || slotDef.sealed) return false;

      setInventory((prev) => {
        const next = [...prev];
        next.splice(itemIndex, 1);
        const prevEquipped = equipped[item.slot];
        if (prevEquipped) next.unshift(prevEquipped);
        return next;
      });

      setEquipped((prev) => ({
        ...prev,
        [item.slot]: { ...item, seen: true },
      }));

      sound.play('confirm');
      return true;
    },
    [equipped, inventory]
  );

  const unequipItem = useCallback((slot: string): boolean => {
    setEquipped((prev) => {
      const item = prev[slot];
      if (!item) return prev;
      setInventory((inv) => [item, ...inv]);
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    sound.play('click');
    return true;
  }, []);

  const salvageItem = useCallback(
    (itemId: number): number => {
      const item = inventory.find((i) => i.id === itemId);
      if (!item) return 0;
      const yieldTable = [2, 5, 12, 30, 75];
      const scraps = yieldTable[item.rarity] || 2;

      setInventory((prev) => prev.filter((i) => i.id !== itemId));
      addCurrency('void_scraps', scraps);
      sound.play('claim');
      return scraps;
    },
    [addCurrency, inventory]
  );

  const salvageAllCommons = useCallback((): number => {
    let total = 0;
    setInventory((prev) => {
      const remaining: Item[] = [];
      prev.forEach((item) => {
        if (item.rarity === 0) {
          total += 2;
        } else {
          remaining.push(item);
        }
      });
      return remaining;
    });

    if (total > 0) {
      addCurrency('void_scraps', total);
      sound.play('claim');
    }
    return total;
  }, [addCurrency]);

  const forgeItem = useCallback(
    (slot: string): Item | null => {
      const slotDef = SLOTS.find((s) => s.id === slot);
      if (!slotDef || slotDef.sealed) return null;
      if (!trySpendCurrency('void_scraps', 20)) return null;

      const rollRarity = Math.random();
      let gearRarity: 0 | 1 | 2 | 3 | 4 = 0;
      if (rollRarity < 0.74) gearRarity = 0;
      else if (rollRarity < 0.94) gearRarity = 1;
      else if (rollRarity < 0.99) gearRarity = 2;
      else gearRarity = 3;

      const affixCount = gearRarity + 1;
      const shuffledAffixes = [...AFFIXES].sort(() => 0.5 - Math.random());
      const itemAffixes: Record<string, number> = {};

      shuffledAffixes.slice(0, affixCount).forEach((affix) => {
        const coef = affix.minValue + Math.random() * (affix.maxValue - affix.minValue);
        const rMult = [1.0, 1.15, 1.3, 1.5, 1.75][gearRarity];
        if (affix.isPercent) {
          itemAffixes[affix.id] = Number((coef * rMult).toFixed(3));
        } else {
          itemAffixes[affix.id] = Math.max(1, Math.round(enemyLevel * coef * rMult));
        }
      });

      const newItem: Item = {
        id: nextItemId,
        slot,
        rarity: gearRarity,
        itemLevel: enemyLevel,
        affixes: itemAffixes,
        seen: true,
      };

      setNextItemId((prev) => prev + 1);
      setInventory((prev) => [newItem, ...prev]);
      sound.play('loot');
      return newItem;
    },
    [enemyLevel, nextItemId, trySpendCurrency]
  );

  const unseenItemCount = inventory.filter((i) => !i.seen).length;
  const markAllItemsSeen = useCallback(() => {
    setInventory((prev) => prev.map((item) => ({ ...item, seen: true })));
  }, []);

  // --- Cards Absorption ---
  const absorbCard = useCallback(
    (cardId: number): boolean => {
      const card = cards.find((c) => c.id === cardId);
      if (!card || !activePetId) return false;

      // Add Pet XP and Vigor
      setOwnedPets((prev) => {
        const current = prev[activePetId] || { xp: 0, seen: true, absorbed: 0 };
        return {
          ...prev,
          [activePetId]: {
            ...current,
            xp: current.xp + card.power,
            absorbed: Math.min(0.5, current.absorbed + card.vigor * 0.002),
          },
        };
      });

      setCards((prev) => prev.filter((c) => c.id !== cardId));
      sound.play('fanfare');
      return true;
    },
    [activePetId, cards]
  );

  // --- Pets Helpers ---
  const getPetLevel = useCallback(
    (petId: string): number => {
      const petDef = PETS.find((p) => p.id === petId);
      const pet = ownedPets[petId];
      if (!pet || !petDef) return 1;
      return Math.min(petDef.maxLevel, 1 + Math.floor(pet.xp / 60));
    },
    [ownedPets]
  );

  // --- Skills (Skill Tree) ---
  const canBuySkill = useCallback(
    (id: string): boolean => {
      const skill = SKILLS.find((s) => s.id === id);
      if (!skill) return false;
      const curLvl = skillLevels[id] || 0;
      if (curLvl >= skill.maxLevel) return false;
      if (skill.prereqId) {
        const prereqLvl = skillLevels[skill.prereqId] || 0;
        if (prereqLvl < (skill.prereqLevel || 1)) return false;
      }
      const cost = Math.round(skill.baseCost * Math.pow(skill.costGrowth, curLvl));
      return currencies.void_crystals >= cost;
    },
    [currencies.void_crystals, skillLevels]
  );

  const getSkillCost = useCallback(
    (id: string): number => {
      const skill = SKILLS.find((s) => s.id === id);
      if (!skill) return 0;
      const curLvl = skillLevels[id] || 0;
      return Math.round(skill.baseCost * Math.pow(skill.costGrowth, curLvl));
    },
    [skillLevels]
  );

  const buySkill = useCallback(
    (id: string): boolean => {
      if (!canBuySkill(id)) return false;
      const cost = getSkillCost(id);
      if (trySpendCurrency('void_crystals', cost)) {
        setSkillLevels((prev) => ({
          ...prev,
          [id]: (prev[id] || 0) + 1,
        }));
        bumpCounter('skills_bought', 1);
        sound.play('goal');
        return true;
      }
      return false;
    },
    [bumpCounter, canBuySkill, getSkillCost, trySpendCurrency]
  );

  // --- Prestige / Eclipse ---
  const calculateEclipsePayout = useCallback((): number => {
    if (peakRunLevel < 50) return 0;
    const crystalSkillBonus = getSkillStat('crystal_gain');
    const basePayout = Math.floor(Math.pow(peakRunLevel / 10, 1.6));
    return Math.max(1, Math.round(basePayout * (1 + crystalSkillBonus)));
  }, [getSkillStat, peakRunLevel]);

  const performEclipse = useCallback((): boolean => {
    const payout = calculateEclipsePayout();
    if (payout <= 0) return false;

    sound.play('eclipse');
    addCurrency('void_crystals', payout);
    setEclipseCount((prev) => prev + 1);
    bumpCounter('eclipses', 1);

    // Reset Run-scoped items
    setCurrencies((prev) => ({
      ...prev,
      essence: 0,
    }));
    setUpgradeLevels({});
    setEnemyLevel(1);
    setPeakRunLevel(1);
    setCombatState('NORMAL');
    spawnEnemy(1, 'NORMAL');
    return true;
  }, [addCurrency, bumpCounter, calculateEclipsePayout, spawnEnemy]);

  // --- Arcade & Minigames ---
  const spendToken = useCallback(
    (cost: number = 1): boolean => {
      if (tokens >= cost) {
        setTokens((prev) => prev - cost);
        sound.play('click');
        return true;
      }
      return false;
    },
    [tokens]
  );

  const finishMinigame = useCallback(
    (id: string, score: number, won: boolean): number => {
      const def = MINIGAMES.find((m) => m.id === id);
      if (!def) return 0;

      // Update record
      setMinigameRecords((prev) => {
        const curBest = prev[id];
        if (curBest === undefined) return { ...prev, [id]: score };
        if (def.lowerIsBetter) {
          return { ...prev, [id]: Math.min(curBest, score) };
        }
        return { ...prev, [id]: Math.max(curBest, score) };
      });

      bumpCounter('minigame_played', 1);
      if (won) bumpCounter('minigame_wins', 1);

      // Scaled reward
      const baseSec = def.rewardSeconds;
      const mult = won ? 1.0 : 0.25;
      const rate = liveEssenceRate > 0 ? liveEssenceRate : 5;
      const essenceReward = Math.max(25, Math.round(rate * baseSec * mult));

      addCurrency('essence', essenceReward);
      if (won) {
        sound.play('fanfare');
      } else {
        sound.play('claim');
      }
      return essenceReward;
    },
    [addCurrency, bumpCounter, liveEssenceRate]
  );

  // --- Quest Claims ---
  // Evaluate completions automatically
  useEffect(() => {
    QUESTS.forEach((quest) => {
      if (completedQuests.includes(quest.id)) return;
      let val = 0;
      if (quest.metric === 'enemy_level') val = enemyLevel;
      else if (quest.metric === 'relics_owned') val = ownedRelics.length;
      else if (quest.metric === 'pets_owned') val = Object.keys(ownedPets).length;
      else if (quest.metric === 'skills_bought') {
        val = Object.values(skillLevels).reduce((a, b) => a + b, 0);
      } else {
        val = questCounters[quest.metric] || 0;
      }

      if (val >= quest.targetValue) {
        setCompletedQuests((prev) => [...prev, quest.id]);
      }
    });
  }, [completedQuests, enemyLevel, ownedPets, ownedRelics.length, questCounters, skillLevels]);

  const claimQuestReward = useCallback(
    (questId: string): boolean => {
      const quest = QUESTS.find((q) => q.id === questId);
      if (!quest || !completedQuests.includes(questId) || claimedQuests.includes(questId)) {
        return false;
      }

      if (quest.rewardKind === 'ESSENCE') {
        addCurrency('essence', quest.rewardAmount);
      } else if (quest.rewardKind === 'TOKENS') {
        setTokens((prev) => Math.min(TOKEN_CAP, prev + quest.rewardAmount));
      } else if (quest.rewardKind === 'CRYSTALS') {
        addCurrency('void_crystals', quest.rewardAmount);
      } else if (quest.rewardKind === 'SHARDS') {
        addCurrency('astral_shards', quest.rewardAmount);
      }

      setClaimedQuests((prev) => [...prev, questId]);
      sound.play('goal');
      return true;
    },
    [addCurrency, claimedQuests, completedQuests]
  );

  // --- Shop & Monetization ---
  const hasRemovedAds = purchasedProducts.includes('remove_ads');

  const buyCosmetic = useCallback(
    (id: string): boolean => {
      const cosmetic = COSMETICS.find((c) => c.id === id);
      if (!cosmetic) return false;
      if (cosmetic.shardPrice > 0 && !purchasedProducts.includes(id)) {
        if (trySpendCurrency('astral_shards', cosmetic.shardPrice)) {
          setPurchasedProducts((prev) => [...prev, id]);
          setActiveCosmeticId(id);
          sound.play('confirm');
          return true;
        }
        return false;
      }
      setActiveCosmeticId(id);
      return true;
    },
    [purchasedProducts, trySpendCurrency]
  );

  const buyProduct = useCallback(
    (productId: string): boolean => {
      sound.play('fanfare');
      if (productId === 'remove_ads') {
        setPurchasedProducts((prev) => [...prev, 'remove_ads']);
      } else if (productId === 'starter_pack') {
        setPurchasedProducts((prev) => [...prev, 'starter_pack', 'trail_ember']);
        addCurrency('void_crystals', 25);
        setTokens((prev) => Math.min(TOKEN_CAP, prev + 5));
      } else if (productId === 'shards_small') {
        addCurrency('astral_shards', 200);
      }
      return true;
    },
    [addCurrency]
  );

  const watchAd = useCallback(
    (placementId: string): boolean => {
      const adDef = ADS.find((a) => a.id === placementId);
      if (!adDef) return false;

      const today = new Date().toISOString().slice(0, 10);
      const current = adWatchCounts[placementId] || { date: today, count: 0 };
      const todayCount = current.date === today ? current.count : 0;

      if (!hasRemovedAds && todayCount >= adDef.dailyCap) return false;

      setAdWatchCounts((prev) => ({
        ...prev,
        [placementId]: { date: today, count: todayCount + 1 },
      }));

      sound.play('claim');
      if (adDef.rewardKind === 'TOKEN') {
        setTokens((prev) => Math.min(TOKEN_CAP, prev + 1));
      } else if (adDef.rewardKind === 'ESSENCE') {
        const rate = liveEssenceRate > 0 ? liveEssenceRate : 5;
        addCurrency('essence', Math.round(rate * adDef.rewardAmount));
      }
      return true;
    },
    [adWatchCounts, addCurrency, hasRemovedAds, liveEssenceRate]
  );

  // --- Combat Controls ---
  const startBossFight = useCallback(() => {
    sound.play('boss_warn');
    setCombatState('BOSS_FIGHT');
    spawnEnemy(enemyLevel, 'BOSS_FIGHT');
  }, [enemyLevel, spawnEnemy]);

  const leaveBossFight = useCallback(() => {
    setCombatState('FARM_MODE');
    const fallbackLevel = Math.max(1, enemyLevel - 1);
    setEnemyLevel(fallbackLevel);
    spawnEnemy(fallbackLevel, 'FARM_MODE');
  }, [enemyLevel, spawnEnemy]);

  const advanceToNextLevel = useCallback(() => {
    const nextLvl = enemyLevel + 1;
    setEnemyLevel(nextLvl);
    setCombatState('NORMAL');
    spawnEnemy(nextLvl, 'NORMAL');
  }, [enemyLevel, spawnEnemy]);

  const toggleFarmMode = useCallback(() => {
    if (combatState === 'FARM_MODE') {
      setCombatState('NORMAL');
      spawnEnemy(enemyLevel, 'NORMAL');
    } else {
      setCombatState('FARM_MODE');
      spawnEnemy(enemyLevel, 'FARM_MODE');
    }
  }, [combatState, enemyLevel, spawnEnemy]);

  // --- Settings Update ---
  const updateSettings = useCallback((partial: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      sound.setVolumes(next.sfxVolume, next.bgmVolume, next.sfxMuted, next.bgmMuted);
      return next;
    });
  }, []);

  // --- Save / Load Persistence ---
  useEffect(() => {
    // Initial Load
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const save = JSON.parse(raw);
        if (save.currencies) setCurrencies(save.currencies);
        if (save.enemyLevel) setEnemyLevel(save.enemyLevel);
        if (save.peakRunLevel) setPeakRunLevel(save.peakRunLevel);
        if (save.lifetimePeakLevel) setLifetimePeakLevel(save.lifetimePeakLevel);
        if (save.eclipseCount) setEclipseCount(save.eclipseCount);
        if (save.unlockedWorlds) setUnlockedWorlds(save.unlockedWorlds);
        if (save.upgradeLevels) setUpgradeLevels(save.upgradeLevels);
        if (save.equipped) setEquipped(save.equipped);
        if (save.inventory) setInventory(save.inventory);
        if (save.nextItemId) setNextItemId(save.nextItemId);
        if (save.cards) setCards(save.cards);
        if (save.ownedPets) setOwnedPets(save.ownedPets);
        if (save.activePetId) setActivePetId(save.activePetId);
        if (save.relicsAwakened) setRelicsAwakened(save.relicsAwakened);
        if (save.ownedRelics) setOwnedRelics(save.ownedRelics);
        if (save.activeRelicId) setActiveRelicId(save.activeRelicId);
        if (save.skillLevels) setSkillLevels(save.skillLevels);
        if (save.tokens !== undefined) setTokens(save.tokens);
        if (save.minigameRecords) setMinigameRecords(save.minigameRecords);
        if (save.questCounters) setQuestCounters(save.questCounters);
        if (save.completedQuests) setCompletedQuests(save.completedQuests);
        if (save.claimedQuests) setClaimedQuests(save.claimedQuests);
        if (save.purchasedProducts) setPurchasedProducts(save.purchasedProducts);
        if (save.activeCosmeticId) setActiveCosmeticId(save.activeCosmeticId);
        if (save.settings) {
          setSettings(save.settings);
          sound.setVolumes(
            save.settings.sfxVolume,
            save.settings.bgmVolume,
            save.settings.sfxMuted,
            save.settings.bgmMuted
          );
        }

        // Calculate Offline Rewards
        const lastTime = save.timestamp || Date.now();
        const awaySeconds = Math.floor((Date.now() - lastTime) / 1000);
        if (awaySeconds >= 60 && (save.enemyLevel || 1) >= AUTO_ATTACK_UNLOCK_LEVEL) {
          const capHours = 8 + (save.skillLevels?.long_slumber || 0) * 2;
          const maxSec = capHours * 3600;
          const effectiveAwaySec = Math.min(awaySeconds, maxSec);
          const offlineMult = save.activeRelicId === 'eclipse_heart' ? 3.0 : 1.0;
          const rate = save.liveEssenceRate || 10;
          const amount = Math.round(rate * effectiveAwaySec * 0.5 * offlineMult);

          if (amount > 0) {
            setOfflineRewardsModal({
              amount,
              secondsAway: awaySeconds,
              wasCapped: awaySeconds > maxSec,
            });
          }
        }
      }
    } catch {
      // Save load parse failure
    }
  }, []);

  // Autosave periodically
  useEffect(() => {
    const saveInterval = setInterval(() => {
      const saveData = {
        timestamp: Date.now(),
        currencies,
        enemyLevel,
        peakRunLevel,
        lifetimePeakLevel,
        eclipseCount,
        unlockedWorlds,
        upgradeLevels,
        equipped,
        inventory,
        nextItemId,
        cards,
        ownedPets,
        activePetId,
        relicsAwakened,
        ownedRelics,
        activeRelicId,
        skillLevels,
        tokens,
        minigameRecords,
        questCounters,
        completedQuests,
        claimedQuests,
        purchasedProducts,
        activeCosmeticId,
        settings,
        liveEssenceRate,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
    }, 3000);

    return () => clearInterval(saveInterval);
  }, [
    currencies,
    enemyLevel,
    peakRunLevel,
    lifetimePeakLevel,
    eclipseCount,
    unlockedWorlds,
    upgradeLevels,
    equipped,
    inventory,
    nextItemId,
    cards,
    ownedPets,
    activePetId,
    relicsAwakened,
    ownedRelics,
    activeRelicId,
    skillLevels,
    tokens,
    minigameRecords,
    questCounters,
    completedQuests,
    claimedQuests,
    purchasedProducts,
    activeCosmeticId,
    settings,
    liveEssenceRate,
  ]);

  const claimOfflineRewards = useCallback(
    (double: boolean = false) => {
      if (!offlineRewardsModal) return;
      const finalAmount = double ? offlineRewardsModal.amount * 2 : offlineRewardsModal.amount;
      addCurrency('essence', finalAmount);
      sound.play('fanfare');
      setOfflineRewardsModal(null);
    },
    [addCurrency, offlineRewardsModal]
  );

  const closeWorldModal = useCallback(() => {
    setNewWorldUnlockedModal(null);
  }, []);

  const resetGameSave = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }, []);

  const exportSave = useCallback((): string => {
    return localStorage.getItem(STORAGE_KEY) || '{}';
  }, []);

  const importSave = useCallback((jsonStr: string): boolean => {
    try {
      JSON.parse(jsonStr);
      localStorage.setItem(STORAGE_KEY, jsonStr);
      window.location.reload();
      return true;
    } catch {
      return false;
    }
  }, []);

  return (
    <GameContext.Provider
      value={{
        currencies,
        combatState,
        enemyLevel,
        currentEnemy: currentEnemyDef,
        enemyHp,
        enemyMaxHp,
        bossTimer,
        worldIndex: activeWorld.id === 'frozen_ruins' ? 1 : 0,
        isWorldUnlocked,
        activeWorld,

        upgradeLevels,
        getUpgradeCost,
        buyUpgrade,
        buyMaxUpgrade,

        equipped,
        inventory,
        equipItem,
        unequipItem,
        salvageItem,
        salvageAllCommons,
        forgeItem,
        unseenItemCount,
        markAllItemsSeen,

        cards,
        absorbCard,

        ownedPets,
        activePetId,
        setActivePet: setActivePetId,
        getPetLevel,

        relicsAwakened,
        ownedRelics,
        activeRelicId,
        setActiveRelic: setActiveRelicId,

        skillLevels,
        getSkillCost,
        buySkill,
        canBuySkill,

        peakRunLevel,
        lifetimePeakLevel,
        eclipseCount,
        calculateEclipsePayout,
        performEclipse,

        tapDamage,
        critChance,
        critDamage,
        essenceMultiplier,
        bossDamageMultiplier,
        autoAttackUnlocked,
        autoAttackInterval,
        liveEssenceRate,

        tokens,
        tokenRegenSecondsLeft,
        minigameRecords,
        spendToken,
        finishMinigame,

        questCounters,
        completedQuests,
        claimedQuests,
        claimQuestReward,
        activeDailyIds,

        purchasedProducts,
        activeCosmeticId,
        setActiveCosmetic: setActiveCosmeticId,
        buyCosmetic,
        buyProduct,
        adWatchCounts,
        watchAd,
        hasRemovedAds,

        settings,
        updateSettings,

        handleTap,
        startBossFight,
        leaveBossFight,
        advanceToNextLevel,
        toggleFarmMode,

        damageNumbers,
        isEnemyHit,
        newWorldUnlockedModal,
        closeWorldModal,
        offlineRewardsModal,
        claimOfflineRewards,
        resetGameSave,
        exportSave,
        importSave,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
};
