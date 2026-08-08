// Hand-written half of the generated UpgradeDefinition. Ported from the
// methods on scripts/data/upgrade_definition.gd, which the field generator
// cannot derive. Safe from regeneration.
using UnityEngine;
using VantaEclipse.Core;

namespace VantaEclipse.Data
{
    public partial class UpgradeDefinition
    {
        public float GetCost(int level)
            => Mathf.Round(baseCost * Mathf.Pow(costGrowth, level));

        public float GetTotalValue(int level) => valuePerLevel * level;

        /// <summary>Human-readable total effect at a level, e.g. "+12" or "+30%".</summary>
        public string FormatEffect(int level)
        {
            float total = GetTotalValue(level);
            if (displayAsPercent || modifierType == ModifierType.PERCENT)
                return "+" + NumberFormat.Num(total * 100f, 1) + "%";
            return "+" + NumberFormat.Format(total);
        }
    }
}
