// Hand-written half of the generated SkillNodeDefinition. Ported from the
// methods on scripts/data/skill_node_definition.gd.
using UnityEngine;
using VantaEclipse.Core;

namespace VantaEclipse.Data
{
    public partial class SkillNodeDefinition
    {
        public float GetCost(int level)
            => Mathf.Round(baseCost * Mathf.Pow(costGrowth, level));

        public float GetTotalValue(int level) => valuePerLevel * level;

        /// <summary>Human-readable total effect at a level, e.g. "+24%", "+6",
        /// or "+0.45".</summary>
        public string FormatTotal(int level)
        {
            if (effectKind == EffectKind.FLAG)
                return level > 0 ? "Active" : "—";

            float total = GetTotalValue(level);
            if (displayAsPercent)
                return "+" + NumberFormat.Num(total * 100f, 0) + "%";

            int decimals = Mathf.Approximately(total, Mathf.Round(total)) ? 0 : 2;
            return "+" + NumberFormat.Num(total, decimals);
        }
    }
}
