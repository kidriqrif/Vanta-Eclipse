// Ported from scripts/managers/upgrade_manager.gd
using System.Collections.Generic;
using UnityEngine;
using VantaEclipse.Core;
using VantaEclipse.Data;

namespace VantaEclipse.Managers
{
    /// <summary>
    /// Owns all upgrade definitions and purchased levels.
    ///
    /// PlayerStats queries GetStatAdditive()/GetStatMultiplier() when computing
    /// stats, so buying an upgrade changes combat instantly with no other
    /// system involved.
    ///
    /// The Godot original kept a hard-coded UPGRADE_DEFINITION_PATHS array and
    /// load()ed each entry. That list is gone: DefinitionRegistry finds every
    /// UpgradeDefinition asset, so adding one is a data drop and nothing else.
    /// </summary>
    public sealed class UpgradeManager : ISaveable
    {
        /// <summary>Upgrade id -> owned level.</summary>
        readonly Dictionary<string, int> _levels = new();

        public string SaveKey => "upgrades";

        /// <summary>Definitions in shop display order.</summary>
        public IReadOnlyList<UpgradeDefinition> GetDefinitions()
            => DefinitionRegistry.All<UpgradeDefinition>();

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
                int level;
                try { level = System.Convert.ToInt32(pair.Value); }
                catch (System.Exception)
                {
                    Debug.LogError($"UpgradeManager: {pair.Key} level was {pair.Value} — reset to 0.");
                    continue;
                }
                _levels[pair.Key] = Mathf.Max(0, level);
            }
        }

        // --- Public API ----------------------------------------------------

        public int GetLevel(string id) => _levels.TryGetValue(id, out var level) ? level : 0;

        public float GetCost(string id)
        {
            var definition = DefinitionRegistry.Get<UpgradeDefinition>(id);
            if (definition == null) return 0f;
            return definition.GetCost(GetLevel(id));
        }

        public bool IsMaxed(string id)
        {
            var definition = DefinitionRegistry.Get<UpgradeDefinition>(id);
            if (definition == null) return true;
            return definition.maxLevel > 0 && GetLevel(id) >= definition.maxLevel;
        }

        public bool CanBuy(string id)
            => !IsMaxed(id) && Game.Currency.CanAfford(CurrencyManager.Essence, GetCost(id));

        /// <summary>Attempt to purchase one level. Returns true on success.</summary>
        public bool Buy(string id)
        {
            if (!DefinitionRegistry.Has<UpgradeDefinition>(id))
            {
                Debug.LogError($"UpgradeManager: unknown upgrade: {id}");
                return false;
            }
            if (IsMaxed(id)) return false;
            if (!Game.Currency.TrySpend(CurrencyManager.Essence, GetCost(id))) return false;

            _levels[id] = GetLevel(id) + 1;
            Game.Events.RaiseUpgradePurchased(id, _levels[id]);
            return true;
        }

        /// <summary>Clear every purchased upgrade on an Eclipse (M8). The shop
        /// is a run-scoped economy; prestige rebuilds it from scratch.
        /// PrestigeManager only.</summary>
        public void ResetForPrestige() => _levels.Clear();

        /// <summary>Sum of all ADDITIVE bonuses for a stat across owned levels.</summary>
        public float GetStatAdditive(string stat)
        {
            float total = 0f;
            foreach (var d in GetDefinitions())
                if (d.stat == stat && d.modifierType == UpgradeDefinition.ModifierType.ADDITIVE)
                    total += d.GetTotalValue(GetLevel(d.id));
            return total;
        }

        /// <summary>Product of all PERCENT multipliers for a stat across owned
        /// levels.</summary>
        public float GetStatMultiplier(string stat)
        {
            float multiplier = 1f;
            foreach (var d in GetDefinitions())
                if (d.stat == stat && d.modifierType == UpgradeDefinition.ModifierType.PERCENT)
                    multiplier *= 1f + d.GetTotalValue(GetLevel(d.id));
            return multiplier;
        }
    }
}
