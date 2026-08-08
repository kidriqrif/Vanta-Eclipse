// Ported from scripts/managers/skill_tree_manager.gd
using System.Collections.Generic;
using UnityEngine;
using VantaEclipse.Core;
using VantaEclipse.Data;

namespace VantaEclipse.Managers
{
    /// <summary>
    /// Owns the Ascendant Powers (skill-tree) definitions and purchased levels.
    /// Built before PlayerStats, which reads its bonus getters. Powers are
    /// bought with Void Crystals and are PERMANENT — they never reset on an
    /// Eclipse; that is the whole point of prestige.
    ///
    /// Its bonuses layer into the existing PlayerStats / IdleManager getters
    /// exactly as relics and pets do, so no combat code changes to gain a new
    /// power.
    /// </summary>
    public sealed class SkillTreeManager : ISaveable
    {
        /// <summary>Skill id -> owned level.</summary>
        readonly Dictionary<string, int> _levels = new();

        public string SaveKey => "skills";

        /// <summary>Definitions in branch/sort order.</summary>
        public IReadOnlyList<SkillNodeDefinition> GetDefinitions()
            => DefinitionRegistry.All<SkillNodeDefinition>();

        public SkillNodeDefinition GetDefinition(string id)
            => DefinitionRegistry.Get<SkillNodeDefinition>(id);

        // --- Save contract -------------------------------------------------

        public Dictionary<string, object> GetSaveData()
        {
            var data = new Dictionary<string, object>();
            foreach (var pair in _levels)
                if (pair.Value > 0) data[pair.Key] = pair.Value;
            return data;
        }

        public void LoadSaveData(Dictionary<string, object> data)
        {
            _levels.Clear();
            if (data == null) return;
            foreach (var pair in data)
            {
                // A removed or renamed power — drop it, never crash.
                if (!DefinitionRegistry.Has<SkillNodeDefinition>(pair.Key)) continue;
                _levels[pair.Key] = Mathf.Max(0, SaveRead.Int(data, pair.Key));
            }
        }

        // --- Public reads / actions ----------------------------------------

        public int GetLevel(string id) => _levels.TryGetValue(id, out var level) ? level : 0;

        public float GetCost(string id)
        {
            var def = GetDefinition(id);
            return def == null ? 0f : def.GetCost(GetLevel(id));
        }

        public bool IsMaxed(string id)
        {
            var def = GetDefinition(id);
            if (def == null) return true;
            return GetLevel(id) >= def.maxLevel;
        }

        public bool PrereqMet(string id)
        {
            var def = GetDefinition(id);
            if (def == null) return false;
            if (string.IsNullOrEmpty(def.prereqId)) return true;
            return GetLevel(def.prereqId) >= def.prereqLevel;
        }

        public bool CanBuy(string id)
            => !IsMaxed(id) && PrereqMet(id)
               && Game.Currency.CanAfford(CurrencyManager.VoidCrystals, GetCost(id));

        /// <summary>Attempt to buy one level. Returns true on success.</summary>
        public bool Buy(string id)
        {
            if (!DefinitionRegistry.Has<SkillNodeDefinition>(id)) return false;
            if (IsMaxed(id) || !PrereqMet(id)) return false;
            if (!Game.Currency.TrySpend(CurrencyManager.VoidCrystals, GetCost(id))) return false;

            _levels[id] = GetLevel(id) + 1;
            Game.Save.SaveGame();
            Game.Events.RaiseSkillPurchased(id, _levels[id]);
            return true;
        }

        // --- Bonus getters (PlayerStats / IdleManager / PrestigeManager) ----

        /// <summary>Sum of valuePerLevel*level across ADDITIVE nodes feeding
        /// this stat.</summary>
        public float GetStatAdditive(string stat)
        {
            float total = 0f;
            foreach (var def in GetDefinitions())
                if (def.effectKind == SkillNodeDefinition.EffectKind.ADDITIVE
                    && def.effectStat == stat)
                    total += def.GetTotalValue(GetLevel(def.id));
            return total;
        }

        /// <summary>Multiplier form for auto-attack cadence (Swift Hunt).
        /// 1.0 = no bonus.</summary>
        public float GetAttackSpeedMult() => 1f + GetStatAdditive("attack_speed");

        /// <summary>True when a FLAG node (e.g. auto_attack_start) is owned.</summary>
        public bool HasFlag(string flag)
        {
            foreach (var def in GetDefinitions())
                if (def.effectKind == SkillNodeDefinition.EffectKind.FLAG
                    && def.effectStat == flag)
                    return GetLevel(def.id) > 0;
            return false;
        }

        /// <summary>Powers are permanent — an Eclipse never touches them.
        /// Present for symmetry with the run-scoped managers' reset hooks.</summary>
        public void ResetForPrestige() { }
    }
}
