// THIS FILE IS THE SOURCE. It was generated once, from a definition in the
// previous engine, by a porter that no longer exists — so edit it here.
//
// It is `partial` because the original carried methods as well as fields
// (GetCost, FormatEffect, ...), which could not be derived from a field list.
// Those live in Methods/SkillNodeDefinition.Methods.cs.
using UnityEngine;

namespace VantaEclipse.Data
{

    /// Data asset describing one Ascendant Power (skill-tree node). Designers add
    /// powers by dropping a .tres in data/skills/ — the Eclipse screen builds its
    /// POWERS panel from these, grouped by branch. A node either adds
    /// value_per_level to a stat every level (ADDITIVE) or is a one-level
    /// permanent toggle (FLAG). SkillTreeManager sums/reads them, and the bonuses
    /// layer into PlayerStats / IdleManager exactly as relics and pets do.
    [CreateAssetMenu(menuName = "Vanta Eclipse/Skill Node", fileName = "NewSkillNodeDefinition")]
    public partial class SkillNodeDefinition : ScriptableObject
    {
        public enum EffectKind
        {
            ADDITIVE,
            FLAG,
        }

        public string id = "";
        public string branch = "";
        public string displayName = "";
        public string description = "";
        public EffectKind effectKind = EffectKind.ADDITIVE;
        public string effectStat = "";
        public float valuePerLevel = 0.0f;
        public bool displayAsPercent = false;
        public float baseCost = 4.0f;
        public float costGrowth = 1.55f;
        public int maxLevel = 1;
        public string prereqId = "";
        public int prereqLevel = 1;
        public int sortOrder = 0;
    }
}
