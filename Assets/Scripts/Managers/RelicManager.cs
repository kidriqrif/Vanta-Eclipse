// Ported from scripts/managers/relic_manager.gd
using System.Collections.Generic;
using UnityEngine;
using VantaEclipse.Core;
using VantaEclipse.Data;

namespace VantaEclipse.Managers
{
    /// <summary>
    /// Owns relic collection, the active relic, and the awaken state. Built
    /// before PlayerStats/IdleManager, which read its effect-query getters. It
    /// never touches enemy state; combat/idle read specific hooks, everything
    /// else routes through PlayerStats getters.
    /// </summary>
    public sealed class RelicManager : ISaveable
    {
        /// <summary>Frozen Ruins begins at level 51 (world index 1) — the
        /// awaken point.</summary>
        public const int FrozenRuinsFloor = 51;

        /// <summary>Chance a Frozen-Ruins boss kill yields a relic (once
        /// awakened).</summary>
        public const float RelicDropChance = 0.25f;

        public sealed class OwnedRelic
        {
            public string Id;
            public bool Seen;
        }

        bool _awakened;
        /// <summary>Newest first.</summary>
        readonly List<OwnedRelic> _owned = new();
        string _activeId = "";

        public string SaveKey => "relics";

        public RelicManager()
        {
            Game.Events.WorldUnlocked += OnWorldUnlocked;
            Game.Events.EnemySpawned += OnEnemySpawned;
            Game.Events.BossFightWon += OnBossFightWon;
        }

        IReadOnlyList<RelicDefinition> Definitions => DefinitionRegistry.All<RelicDefinition>();

        // --- Save contract -------------------------------------------------

        public Dictionary<string, object> GetSaveData()
        {
            var owned = new List<object>();
            foreach (var entry in _owned)
                owned.Add(new Dictionary<string, object>
                {
                    { "id", entry.Id },
                    { "seen", entry.Seen },
                });

            return new Dictionary<string, object>
            {
                { "awakened", _awakened },
                { "active", _activeId },
                { "owned", owned },
            };
        }

        public void LoadSaveData(Dictionary<string, object> data)
        {
            _awakened = SaveRead.Bool(data, "awakened");
            _activeId = SaveRead.Str(data, "active");

            _owned.Clear();
            foreach (var raw in SaveRead.Array(data, "owned"))
            {
                var entry = AsDictionary(raw);
                string id = SaveRead.Str(entry, "id");
                // A removed or renamed relic — drop it, never crash.
                if (!DefinitionRegistry.Has<RelicDefinition>(id)) continue;
                _owned.Add(new OwnedRelic { Id = id, Seen = SaveRead.Bool(entry, "seen", true) });
            }

            if (!DefinitionRegistry.Has<RelicDefinition>(_activeId)) _activeId = "";
        }

        static Dictionary<string, object> AsDictionary(object raw)
        {
            if (raw is Dictionary<string, object> already) return already;
            if (raw is Newtonsoft.Json.Linq.JObject jobject)
                return jobject.ToObject<Dictionary<string, object>>();
            return new Dictionary<string, object>();
        }

        // --- Effect queries (PlayerStats + IdleManager) ---------------------

        public float GetEffectAdditive(string stat)
        {
            var def = ActiveDefinition();
            if (def == null) return 0f;
            switch (def.effectId)
            {
                case "boss_pct":
                    if (stat == "boss") return def.effectValue;
                    break;
                case "crit_dmg":
                    if (stat == "crit_damage") return def.effectValue;
                    break;
            }
            return 0f;
        }

        public float GetEffectMultiplier(string stat)
        {
            var def = ActiveDefinition();
            if (def != null && def.effectId == "essence_mult" && stat == "essence")
                return def.effectValue;
            return 1f;
        }

        /// <summary>Eclipse Heart — a factor on
        /// PlayerStats.GetOfflineMultiplier(). 1.0 = none.</summary>
        public float GetOfflineMultiplier()
        {
            var def = ActiveDefinition();
            if (def != null && def.effectId == "offline_mult") return def.effectValue;
            return 1f;
        }

        /// <summary>Twin Fang — auto-attack cadence factor read by
        /// IdleManager. 1.0 = none.</summary>
        public float GetAttackSpeedMult()
        {
            var def = ActiveDefinition();
            if (def != null && def.effectId == "attack_speed") return def.effectValue;
            return 1f;
        }

        // --- Public reads / actions ----------------------------------------

        public bool IsAwakened() => _awakened;
        public string GetActiveId() => _activeId;
        public IReadOnlyList<OwnedRelic> GetOwned() => _owned;

        public RelicDefinition GetDefinition(string id)
            => DefinitionRegistry.Get<RelicDefinition>(id);

        public int GetUnseenCount()
        {
            int count = 0;
            foreach (var entry in _owned)
                if (!entry.Seen) count++;
            return count;
        }

        public void Attune(string id)
        {
            if (!Owns(id)) return;
            _activeId = id;
            Game.Save.SaveGame();
            Game.Events.RaiseActiveRelicChanged(id);
        }

        public void Detach()
        {
            _activeId = "";
            Game.Save.SaveGame();
            Game.Events.RaiseActiveRelicChanged("");
        }

        public void MarkAllSeen()
        {
            foreach (var entry in _owned) entry.Seen = true;
        }

        // --- Internals -----------------------------------------------------

        RelicDefinition ActiveDefinition()
        {
            if (!_awakened || string.IsNullOrEmpty(_activeId)) return null;
            return DefinitionRegistry.Has<RelicDefinition>(_activeId)
                ? DefinitionRegistry.Get<RelicDefinition>(_activeId)
                : null;
        }

        bool Owns(string id)
        {
            foreach (var entry in _owned)
                if (entry.Id == id) return true;
            return false;
        }

        void Awaken(bool ceremony)
        {
            if (_awakened) return;
            _awakened = true;
            Game.Save.SaveGame();
            if (ceremony) Game.Events.RaiseRelicsAwakened();
        }

        // Live unlock: awaken with ceremony (the World Unlock modal is up).
        void OnWorldUnlocked(WorldDefinition world) => Awaken(true);

        // Silent back-fill for a save already past Frozen Ruins.
        void OnEnemySpawned(EnemyDefinition definition, int level, float maxHp)
        {
            if (!_awakened && level >= FrozenRuinsFloor) Awaken(false);
        }

        void OnBossFightWon(int level, float payout, bool isWorldBoss)
        {
            if (!_awakened) return;
            if (Random.value >= RelicDropChance) return;

            string id = RollUndroppedRelic();
            if (string.IsNullOrEmpty(id)) return;  // collection complete — no dupes

            _owned.Insert(0, new OwnedRelic { Id = id, Seen = false });
            Game.Save.SaveGame();
            Game.Events.RaiseRelicDropped(id);
        }

        /// <summary>Pick a random not-yet-owned relic by drop weight, or "" if
        /// all are owned.</summary>
        string RollUndroppedRelic()
        {
            var pool = new List<RelicDefinition>();
            float total = 0f;
            foreach (var def in Definitions)
                if (!Owns(def.id))
                {
                    pool.Add(def);
                    total += def.dropWeight;
                }
            if (pool.Count == 0) return "";

            float roll = Random.value * total;
            float acc = 0f;
            foreach (var def in pool)
            {
                acc += def.dropWeight;
                if (roll <= acc) return def.id;
            }
            return pool[pool.Count - 1].id;
        }
    }
}
