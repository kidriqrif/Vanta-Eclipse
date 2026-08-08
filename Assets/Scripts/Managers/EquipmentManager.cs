// Ported from scripts/managers/equipment_manager.gd
using System.Collections.Generic;
using UnityEngine;
using VantaEclipse.Core;
using VantaEclipse.Data;

namespace VantaEclipse.Managers
{
    /// <summary>
    /// Owns all gear: inventory, equipped items, procedural generation, drops,
    /// salvage, and the forge.
    ///
    /// PlayerStats reads GetAffixSum() in its stat getters (the same layering
    /// UpgradeManager uses); CombatManager only raises events — this manager
    /// never touches enemy state or scenes.
    /// </summary>
    public sealed class EquipmentManager : ISaveable
    {
        public enum Rarity { COMMON, RARE, EPIC, LEGENDARY, MYTHIC }

        static readonly int[] RarityAffixCount = { 1, 2, 3, 4, 5 };
        static readonly float[] RarityMult = { 1.0f, 1.15f, 1.3f, 1.5f, 1.75f };
        static readonly int[] RaritySalvage = { 2, 5, 12, 30, 75 };

        // Drop tuning — locked by scratchpad/loot_sim.py (docs/ARCHITECTURE.md).
        public const float NormalDropChance = 0.03f;
        static readonly float[] NormalWeights = { 0.74f, 0.20f, 0.05f, 0.009f, 0.001f };
        static readonly float[] BossWeights = { 0.30f, 0.40f, 0.22f, 0.07f, 0.01f };
        static readonly float[] WorldBossWeights = { 0f, 0f, 0.60f, 0.32f, 0.08f };
        public const float ForgeCost = 20f;

        /// <summary>Slot id -> equipped item.</summary>
        readonly Dictionary<string, Item> _equipped = new();
        readonly List<Item> _inventory = new();
        int _nextItemId = 1;

        /// <summary>True between boss spawn and its resolution, so the boss
        /// kill's normal EnemyDied roll is suppressed (the guaranteed boss drop
        /// rides BossFightWon instead). Tracked from events — no upward
        /// CombatManager call. Set true on every boss start (idempotent), and
        /// cleared by either resolution OR by leaving the scene, which voids
        /// the fight without raising one.</summary>
        bool _bossInProgress;

        /// <summary>Per-stat cached sum over equipped items, rebuilt on any
        /// equip change.</summary>
        readonly Dictionary<string, float> _affixSums = new();

        public string SaveKey => "equipment";

        public EquipmentManager()
        {
            Game.Events.EnemyDied += OnEnemyDied;
            Game.Events.BossFightStarted += OnBossFightStarted;
            Game.Events.BossFightWon += OnBossFightWon;
            Game.Events.BossFightFailed += OnBossFightFailed;
            Game.Events.SceneTransitionStarted += OnSceneTransitionStarted;
            RecomputeSums();
        }

        IReadOnlyList<AffixDefinition> Affixes => DefinitionRegistry.All<AffixDefinition>();
        IReadOnlyList<SlotDefinition> Slots => DefinitionRegistry.All<SlotDefinition>();

        // --- Save contract -------------------------------------------------

        public Dictionary<string, object> GetSaveData()
        {
            var equipped = new Dictionary<string, object>();
            foreach (var pair in _equipped) equipped[pair.Key] = pair.Value.ToSaveData();

            var inventory = new List<object>();
            foreach (var item in _inventory) inventory.Add(item.ToSaveData());

            return new Dictionary<string, object>
            {
                { "equipped", equipped },
                { "inventory", inventory },
                { "next_item_id", _nextItemId },
            };
        }

        public void LoadSaveData(Dictionary<string, object> data)
        {
            _equipped.Clear();
            var rawEquipped = SaveRead.Section(data, "equipped");
            foreach (var slotKey in rawEquipped.Keys)
                _equipped[slotKey] = Item.FromSaveData(SaveRead.Section(rawEquipped, slotKey));

            _inventory.Clear();
            foreach (var raw in SaveRead.Array(data, "inventory"))
                _inventory.Add(Item.FromSaveData(AsDictionary(raw)));

            _nextItemId = Mathf.Max(1, SaveRead.Int(data, "next_item_id", 1));
            RecomputeSums();
        }

        static Dictionary<string, object> AsDictionary(object raw)
        {
            if (raw is Dictionary<string, object> already) return already;
            if (raw is Newtonsoft.Json.Linq.JObject jobject)
                return jobject.ToObject<Dictionary<string, object>>();
            return new Dictionary<string, object>();
        }

        // --- Public: data queries -------------------------------------------

        public IReadOnlyList<SlotDefinition> GetSlots() => Slots;

        public SlotDefinition GetSlotDefinition(string slot)
            => DefinitionRegistry.Has<SlotDefinition>(slot)
                ? DefinitionRegistry.Get<SlotDefinition>(slot)
                : null;

        public Item GetEquipped(string slot) => _equipped.TryGetValue(slot, out var item) ? item : null;

        public IReadOnlyList<Item> GetInventory() => _inventory;

        /// <summary>Sum of an affix stat across all equipped items (read by
        /// PlayerStats).</summary>
        public float GetAffixSum(string stat) => _affixSums.TryGetValue(stat, out var v) ? v : 0f;

        public AffixDefinition GetAffixDefinition(string id)
        {
            foreach (var affix in Affixes)
                if (affix.id == id) return affix;
            return null;
        }

        /// <summary>Void Scraps an item is worth if salvaged.</summary>
        public int GetSalvageYield(int rarity)
            => RaritySalvage[Mathf.Clamp(rarity, 0, RaritySalvage.Length - 1)];

        /// <summary>Inventory items the player hasn't seen on the Gear screen
        /// yet.</summary>
        public int GetUnseenCount()
        {
            int count = 0;
            foreach (var item in _inventory)
                if (!item.Seen) count++;
            return count;
        }

        public bool IsItemUnseen(Item item) => item != null && !item.Seen;

        public int GetCommonsCount()
        {
            int count = 0;
            foreach (var item in _inventory)
                if (item.Rarity == (int)Rarity.COMMON) count++;
            return count;
        }

        /// <summary>Human-readable affix line, e.g. "Tap Damage +12" or
        /// "Crit Chance +0.8%".</summary>
        public string FormatAffix(string affixId, float value)
        {
            var affix = GetAffixDefinition(affixId);
            if (affix == null) return $"{affixId} +{value}";
            string shown = affix.isPercent
                ? NumberFormat.FormatPercent(value)
                : NumberFormat.Format(value);
            return affix.displayTemplate.Replace("{value}", shown);
        }

        // --- Public: player actions -----------------------------------------

        /// <summary>Equip an item from the inventory by id. The previously
        /// equipped item (if any) returns to the inventory. Sealed slots
        /// refuse.</summary>
        public bool Equip(int itemId)
        {
            int index = InventoryIndex(itemId);
            if (index == -1) return false;

            var item = _inventory[index];
            var slotDef = GetSlotDefinition(item.Slot);
            if (slotDef == null || slotDef.@sealed) return false;

            _inventory.RemoveAt(index);
            if (_equipped.TryGetValue(item.Slot, out var previous))
                _inventory.Add(previous);
            _equipped[item.Slot] = item;

            RecomputeSums();
            Game.Events.RaiseItemEquipped(item.Slot);
            Game.Events.RaiseInventoryChanged();
            return true;
        }

        /// <summary>Move the equipped item in a slot back to the inventory.</summary>
        public bool Unequip(string slot)
        {
            if (!_equipped.TryGetValue(slot, out var item)) return false;
            _inventory.Add(item);
            _equipped.Remove(slot);
            RecomputeSums();
            Game.Events.RaiseItemEquipped(slot);
            Game.Events.RaiseInventoryChanged();
            return true;
        }

        /// <summary>Salvage an inventory item into Void Scraps. Returns scraps
        /// granted, or 0.</summary>
        public int Salvage(int itemId)
        {
            int index = InventoryIndex(itemId);
            if (index == -1) return 0;
            int scraps = GetSalvageYield(_inventory[index].Rarity);
            _inventory.RemoveAt(index);
            Game.Currency.Add(CurrencyManager.VoidScraps, scraps);
            Game.Events.RaiseInventoryChanged();
            return scraps;
        }

        /// <summary>Salvage every Common in the inventory at once. Returns
        /// total scraps.</summary>
        public int SalvageAllCommons()
        {
            int total = 0;
            for (int i = _inventory.Count - 1; i >= 0; i--)
            {
                if (_inventory[i].Rarity != (int)Rarity.COMMON) continue;
                total += RaritySalvage[(int)Rarity.COMMON];
                _inventory.RemoveAt(i);
            }
            if (total > 0)
            {
                Game.Currency.Add(CurrencyManager.VoidScraps, total);
                Game.Events.RaiseInventoryChanged();
            }
            return total;
        }

        /// <summary>Spend scraps to forge a random item for a slot at the given
        /// level (the caller passes the current enemy level — this manager is
        /// built before CombatManager and must not read it directly). Returns
        /// the new item, or null if unaffordable / invalid slot.</summary>
        public Item Forge(string slot, int level)
        {
            var slotDef = GetSlotDefinition(slot);
            if (slotDef == null || slotDef.@sealed) return null;
            if (!Game.Currency.TrySpend(CurrencyManager.VoidScraps, ForgeCost)) return null;

            var item = GenerateItem(level, RollRarity(NormalWeights), slot);
            AddToInventory(item);
            return item;
        }

        // --- Generation ------------------------------------------------------

        /// <summary>Build one item. If slot is empty, a random non-sealed slot
        /// is chosen.</summary>
        public Item GenerateItem(int level, int rarity, string slot = "")
        {
            if (string.IsNullOrEmpty(slot)) slot = RandomUnsealedSlot();

            int count = RarityAffixCount[Mathf.Clamp(rarity, 0, RarityAffixCount.Length - 1)];
            var pool = new List<AffixDefinition>(Affixes);
            Shuffle(pool);

            var affixes = new Dictionary<string, float>();
            for (int i = 0; i < Mathf.Min(count, pool.Count); i++)
                affixes[pool[i].id] = RollAffixValue(pool[i], level, rarity);

            var item = new Item
            {
                Id = _nextItemId,
                Slot = slot,
                Rarity = rarity,
                ItemLevel = level,
                Affixes = affixes,
            };
            _nextItemId++;
            return item;
        }

        static float RollAffixValue(AffixDefinition affix, int level, int rarity)
        {
            float coefficient = Random.Range(affix.minValue, affix.maxValue);
            float mult = RarityMult[Mathf.Clamp(rarity, 0, RarityMult.Length - 1)];
            if (affix.isPercent) return coefficient * mult;
            // Flat stats scale with the dropping level (loot_sim.py model).
            return Mathf.Max(1f, Mathf.Round(level * coefficient * mult));
        }

        /// <summary>Fisher-Yates through Unity's RNG, so a seeded
        /// Random.InitState makes generation reproducible in tests. List.Sort
        /// with a random comparator would not be a uniform shuffle.</summary>
        static void Shuffle<T>(IList<T> list)
        {
            for (int i = list.Count - 1; i > 0; i--)
            {
                int j = Random.Range(0, i + 1);
                (list[i], list[j]) = (list[j], list[i]);
            }
        }

        // --- Internals -------------------------------------------------------

        void OnEnemyDied(int level, int totalKills)
        {
            // The boss kill's normal roll is suppressed; its guaranteed drop
            // rides BossFightWon instead (no double drop).
            if (_bossInProgress) return;
            if (Random.value < NormalDropChance)
                Drop(GenerateItem(level, RollRarity(NormalWeights)));
        }

        void OnBossFightStarted(EnemyDefinition d, int level, float maxHp, float duration)
            => _bossInProgress = true;

        void OnBossFightFailed(int level) => _bossInProgress = false;

        void OnSceneTransitionStarted(string scenePath)
        {
            // CombatManager voids an in-progress boss on this same event
            // without raising won/failed, so this is the only clear on that
            // path. Reachable by tapping ECLIPSE mid-boss: nothing else ever
            // resets the flag — not even prestige — so leaving it latched
            // suppresses EVERY normal drop for the rest of the run.
            _bossInProgress = false;
        }

        void OnBossFightWon(int level, float payout, bool isWorldBoss)
        {
            _bossInProgress = false;
            var weights = isWorldBoss ? WorldBossWeights : BossWeights;
            Drop(GenerateItem(level, RollRarity(weights)));
            // TODO(polish): surface the world-boss drop inside the
            // WorldUnlockModal; for now it enters inventory + the count pill.
        }

        void Drop(Item item)
        {
            item.Seen = false;
            AddToInventory(item);
            Game.Events.RaiseItemDropped(item);
        }

        /// <summary>Called by the Gear screen on open — every inventory item is
        /// now seen.</summary>
        public void MarkAllSeen()
        {
            foreach (var item in _inventory) item.Seen = true;
        }

        void AddToInventory(Item item)
        {
            // Newest first — the sort order the Gear screen displays.
            _inventory.Insert(0, item);
            Game.Events.RaiseInventoryChanged();
        }

        static int RollRarity(float[] weights)
        {
            float roll = Random.value;
            float acc = 0f;
            for (int i = 0; i < weights.Length; i++)
            {
                acc += weights[i];
                if (roll <= acc) return i;
            }
            return weights.Length - 1;
        }

        string RandomUnsealedSlot()
        {
            var open = new List<string>();
            foreach (var slot in Slots)
                if (!slot.@sealed) open.Add(slot.id);
            if (open.Count == 0)
            {
                Debug.LogError("EquipmentManager: every slot is sealed — cannot place a drop.");
                return "";
            }
            return open[Random.Range(0, open.Count)];
        }

        int InventoryIndex(int itemId)
        {
            for (int i = 0; i < _inventory.Count; i++)
                if (_inventory[i].Id == itemId) return i;
            return -1;
        }

        void RecomputeSums()
        {
            _affixSums.Clear();
            foreach (var item in _equipped.Values)
                foreach (var pair in item.Affixes)
                    _affixSums[pair.Key] = GetAffixSum(pair.Key) + pair.Value;
        }
    }
}
