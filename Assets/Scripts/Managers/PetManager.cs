// Ported from scripts/managers/pet_manager.gd
using System.Collections.Generic;
using UnityEngine;
using VantaEclipse.Core;
using VantaEclipse.Data;

namespace VantaEclipse.Managers
{
    /// <summary>
    /// Owns the pet roster, the active pet, and XP/level/evolution. Built
    /// before PlayerStats, which reads its bonus getter. The active pet's
    /// passive bonus flows through PlayerStats; XP comes from EnemyDied (live)
    /// and OfflineKillsEstimated (offline).
    /// </summary>
    public sealed class PetManager : ISaveable
    {
        public const int FrozenRuinsFloor = 51;
        public const float XpBase = 60f;
        public const float XpPerKill = 3f;

        /// <summary>The pet granted free when the roster awakens.</summary>
        public const string StarterId = "ember";

        /// <summary>Chance a Frozen-Ruins boss yields the second pet (once, if
        /// unowned).</summary>
        public const float PetDropChance = 0.15f;

        /// <summary>Ceiling on the bonus one pet may absorb from boss cards. It
        /// lives HERE, with the field it clamps and the getter that feeds
        /// PlayerStats, rather than being handed in by whichever system happens
        /// to be doing the feeding — an invariant enforced by convention at one
        /// call site is not enforced.</summary>
        public const float AbsorbedBonusCap = 0.5f;

        sealed class OwnedPet
        {
            public float Xp;
            public bool Seen;
            public float Absorbed;
        }

        readonly Dictionary<string, OwnedPet> _owned = new();
        string _activeId = "";

        public string SaveKey => "pets";

        public PetManager()
        {
            Game.Events.WorldUnlocked += OnWorldUnlocked;
            Game.Events.EnemySpawned += OnEnemySpawned;
            Game.Events.EnemyDied += OnEnemyDied;
            Game.Events.BossFightWon += OnBossFightWon;
            Game.Events.OfflineKillsEstimated += OnOfflineKills;
        }

        // --- Save contract -------------------------------------------------

        public Dictionary<string, object> GetSaveData()
        {
            var owned = new Dictionary<string, object>();
            foreach (var pair in _owned)
                owned[pair.Key] = new Dictionary<string, object>
                {
                    { "xp", pair.Value.Xp },
                    { "seen", pair.Value.Seen },
                    { "absorbed", pair.Value.Absorbed },
                };
            return new Dictionary<string, object>
            {
                { "active", _activeId },
                { "owned", owned },
            };
        }

        public void LoadSaveData(Dictionary<string, object> data)
        {
            _owned.Clear();
            var rawOwned = SaveRead.Section(data, "owned");
            foreach (var key in rawOwned.Keys)
            {
                if (!DefinitionRegistry.Has<PetDefinition>(key)) continue;
                var entry = SaveRead.Section(rawOwned, key);
                // "absorbed" defaults to 0 rather than being required, so a
                // save written before boss cards existed loads as a pet that
                // has eaten nothing instead of failing to load at all.
                _owned[key] = new OwnedPet
                {
                    Xp = SaveRead.Float(entry, "xp"),
                    Seen = SaveRead.Bool(entry, "seen", true),
                    Absorbed = Mathf.Max(0f, SaveRead.Float(entry, "absorbed")),
                };
            }

            _activeId = SaveRead.Str(data, "active");
            if (!DefinitionRegistry.Has<PetDefinition>(_activeId)) _activeId = "";
        }

        // --- Bonus query (read by PlayerStats) ------------------------------

        /// <summary>
        /// Additive bonus fraction the ACTIVE pet contributes to a stat.
        /// 0 = none.
        ///
        /// Two terms: what the pet has grown into (level) and what it has been
        /// fed (absorbed boss cards). Both land on the SAME stat, because a
        /// companion that boosted one number by living and a different one by
        /// eating would need the player to track two things to answer one
        /// question.
        /// </summary>
        public float GetActiveBonusAdditive(string stat)
        {
            if (string.IsNullOrEmpty(_activeId)) return 0f;
            var def = GetDefinition(_activeId);
            if (def == null || def.bonusStat != stat) return 0f;
            return def.bonusPerLevel * GetLevel(_activeId) + GetAbsorbedBonus(_activeId);
        }

        /// <summary>The permanent bonus fraction a pet has absorbed from boss
        /// cards.</summary>
        public float GetAbsorbedBonus(string id)
            => _owned.TryGetValue(id, out var pet) ? pet.Absorbed : 0f;

        /// <summary>Add to a pet's absorbed bonus, clamped to
        /// AbsorbedBonusCap. Returns what was actually added, which is less
        /// than asked for once the pet is near the ceiling — the caller reports
        /// that number, so a card eaten into a full pet cannot claim to have
        /// done something it did not.</summary>
        public float AddAbsorbedBonus(string id, float amount)
        {
            if (!_owned.TryGetValue(id, out var pet) || amount <= 0f) return 0f;
            float before = pet.Absorbed;
            float after = Mathf.Min(AbsorbedBonusCap, before + amount);
            pet.Absorbed = after;
            return after - before;
        }

        /// <summary>Feed one pet XP. Names its TARGET rather than assuming the
        /// active pet: absorption is aimed and the kill loop is not, and that
        /// lone difference is what had this existing twice, as two copies of
        /// the same statements that both had to be kept in step through every
        /// level-up and evolution.</summary>
        public void GrantXp(string id, float amount)
        {
            if (string.IsNullOrEmpty(id) || !_owned.TryGetValue(id, out var pet)) return;
            if (amount <= 0f) return;
            var def = GetDefinition(id);
            if (def == null) return;

            int beforeLevel = GetLevel(id);
            int beforeStage = GetStage(id);
            float capXp = XpForLevel(def.maxLevel);
            pet.Xp = Mathf.Min(capXp, pet.Xp + amount);

            int afterLevel = GetLevel(id);
            if (afterLevel > beforeLevel)
            {
                Game.Events.RaisePetLeveled(id, afterLevel);
                if (GetStage(id) > beforeStage)
                    Game.Events.RaisePetEvolved(id, GetStage(id));
            }
        }

        // --- Public reads / actions ----------------------------------------

        public string GetActiveId() => _activeId;
        public IEnumerable<string> GetOwnedIds() => _owned.Keys;
        public bool Owns(string id) => _owned.ContainsKey(id);

        public PetDefinition GetDefinition(string id)
            => DefinitionRegistry.Has<PetDefinition>(id)
                ? DefinitionRegistry.Get<PetDefinition>(id)
                : null;

        public float GetXp(string id) => _owned.TryGetValue(id, out var pet) ? pet.Xp : 0f;

        public int GetLevel(string id)
        {
            var def = GetDefinition(id);
            if (def == null) return 1;
            return LevelForXp(GetXp(id), def);
        }

        public int GetStage(string id)
        {
            var def = GetDefinition(id);
            if (def == null) return 0;
            int level = GetLevel(id);
            int stage = 0;
            foreach (int threshold in def.evolutionLevels)
                if (level >= threshold) stage++;

            // Clamped against BOTH parallel arrays, not just the names. Five UI
            // sites take this index straight into stageSprites, so a pet given
            // a third name before its third sprite exists would break the
            // companion button — which is on screen the entire game.
            // check_data.py rejects that content at build time; this is what
            // keeps a build that slipped through merely wrong-looking instead
            // of dead.
            int stages = Mathf.Min(def.stageNames.Length, def.stageSprites.Length);
            return Mathf.Clamp(stage, 0, Mathf.Max(0, stages - 1));
        }

        /// <summary>XP into the current level, and XP needed to reach the
        /// next.</summary>
        public (float Into, float Needed) GetLevelProgress(string id)
        {
            var def = GetDefinition(id);
            if (def == null) return (0f, 1f);
            int level = GetLevel(id);
            if (level >= def.maxLevel) return (1f, 1f);
            float xp = GetXp(id);
            float floorXp = XpForLevel(level);
            return (xp - floorXp, XpForLevel(level + 1) - floorXp);
        }

        public void SetActive(string id)
        {
            if (!_owned.ContainsKey(id)) return;
            _activeId = id;
            Game.Save.SaveGame();
            Game.Events.RaiseActivePetChanged(id);
        }

        public void MarkAllSeen()
        {
            foreach (var pet in _owned.Values) pet.Seen = true;
        }

        public int GetUnseenCount()
        {
            int count = 0;
            foreach (var pet in _owned.Values)
                if (!pet.Seen) count++;
            return count;
        }

        public bool IsUnseen(string id) => _owned.TryGetValue(id, out var pet) && !pet.Seen;

        // --- Internals -----------------------------------------------------

        void Grant(string id, bool makeActive)
        {
            if (_owned.ContainsKey(id) || !DefinitionRegistry.Has<PetDefinition>(id)) return;
            _owned[id] = new OwnedPet { Xp = 0f, Seen = false, Absorbed = 0f };
            if (makeActive && string.IsNullOrEmpty(_activeId)) _activeId = id;
            Game.Save.SaveGame();
            Game.Events.RaisePetUnlocked(id);
            if (makeActive) Game.Events.RaiseActivePetChanged(id);
        }

        /// <summary>Total XP to reach a level: XpBase * (level-1)*level/2.</summary>
        static float XpForLevel(int level)
        {
            int l = Mathf.Max(1, level) - 1;
            return XpBase * (l * (l + 1)) / 2f;
        }

        static int LevelForXp(float xp, PetDefinition def)
        {
            int level = 1;
            while (level < def.maxLevel && xp >= XpForLevel(level + 1)) level++;
            return level;
        }

        void OnWorldUnlocked(WorldDefinition world) => Grant(StarterId, true);

        void OnEnemySpawned(EnemyDefinition definition, int level, float maxHp)
        {
            // Migration back-fill: a save already past Frozen Ruins gets the
            // starter.
            if (_owned.Count == 0 && level >= FrozenRuinsFloor) Grant(StarterId, true);
        }

        void OnEnemyDied(int level, int totalKills) => GrantXp(_activeId, XpPerKill);

        void OnOfflineKills(int kills)
        {
            if (kills > 0) GrantXp(_activeId, XpPerKill * kills);
        }

        void OnBossFightWon(int level, float payout, bool isWorldBoss)
        {
            if (_owned.Count == 0) return;  // roster not awakened yet
            if (_owned.ContainsKey("frostling") || Random.value >= PetDropChance) return;
            Grant("frostling", false);
        }
    }
}
