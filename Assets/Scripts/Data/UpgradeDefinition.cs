// THIS FILE IS THE SOURCE. It was generated once, from a definition in the
// previous engine, by a porter that no longer exists — so edit it here.
//
// It is `partial` because the original carried methods as well as fields
// (GetCost, FormatEffect, ...), which could not be derived from a field list.
// Those live in Methods/UpgradeDefinition.Methods.cs.
using UnityEngine;

namespace VantaEclipse.Data
{

    /// Data asset describing one shop upgrade. Designers add upgrades by creating
    /// a .tres file in data/upgrades/ — the shop UI builds itself from these. An
    /// upgrade modifies one player stat, either: ADDITIVE — each level adds
    /// value_per_level to the stat directly PERCENT — each level adds
    /// value_per_level to a percentage multiplier (0.10 at level 3 means the stat
    /// is multiplied by 1.30)
    [CreateAssetMenu(menuName = "Vanta Eclipse/Upgrade", fileName = "NewUpgradeDefinition")]
    public partial class UpgradeDefinition : ScriptableObject
    {
        public enum ModifierType
        {
            ADDITIVE,
            PERCENT,
        }

        public string id = "";
        public string displayName = "";
        public string description = "";
        public string stat = "";
        public ModifierType modifierType = ModifierType.ADDITIVE;
        public float valuePerLevel = 1.0f;
        public bool displayAsPercent = false;
        public float baseCost = 5.0f;
        public float costGrowth = 1.15f;
        public int maxLevel = 0;
        public int sortOrder = 0;
    }
}
