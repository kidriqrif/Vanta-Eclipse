// Hand-written half of the generated QuestDefinition. Ported from
// format_reward() on scripts/data/quest_definition.gd.
using UnityEngine;

namespace VantaEclipse.Data
{
    public partial class QuestDefinition
    {
        /// <summary>Human-readable reward, e.g. "+4m of Essence" or
        /// "+3 Void Crystals".</summary>
        public string FormatReward()
        {
            switch (rewardKind)
            {
                case RewardKind.ARCADE_TOKENS:
                {
                    int tokens = (int)rewardAmount;
                    return $"+{tokens} Arcade Token{(tokens == 1 ? "" : "s")}";
                }
                case RewardKind.VOID_CRYSTALS:
                {
                    int crystals = (int)rewardAmount;
                    return $"+{crystals} Void Crystal{(crystals == 1 ? "" : "s")}";
                }
                case RewardKind.ASTRAL_SHARDS:
                    return $"+{(int)rewardAmount} Astral Shards";
                default:
                {
                    // Essence is priced in seconds of progress, so say it in
                    // those terms rather than as a figure that would be
                    // meaningless out of context.
                    int minutes = (int)Mathf.Round(rewardAmount / 60f);
                    if (minutes < 1) return $"+{(int)rewardAmount}s of Essence";
                    return $"+{minutes}m of Essence";
                }
            }
        }
    }
}
