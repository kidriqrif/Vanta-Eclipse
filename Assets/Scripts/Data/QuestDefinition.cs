// THIS FILE IS THE SOURCE. It was generated once, from a definition in the
// previous engine, by a porter that no longer exists — so edit it here.
//
// It is `partial` because the original carried methods as well as fields
// (GetCost, FormatEffect, ...), which could not be derived from a field list.
// Those live in Methods/QuestDefinition.Methods.cs.
using UnityEngine;

namespace VantaEclipse.Data
{

    /// Data asset describing one Journal goal — a quest, a daily, or an
    /// achievement. All three kinds share this shape, so new content of any kind
    /// is a .tres in data/quests/ and never a code change.
    [CreateAssetMenu(menuName = "Vanta Eclipse/Quest", fileName = "NewQuestDefinition")]
    public partial class QuestDefinition : ScriptableObject
    {
        public enum Kind
        {
            QUEST,
            DAILY,
            ACHIEVEMENT,
        }

        public enum MetricShape
        {
            CUMULATIVE,
            SNAPSHOT,
        }

        public enum RewardKind
        {
            ESSENCE_SECONDS,
            ARCADE_TOKENS,
            VOID_CRYSTALS,
            ASTRAL_SHARDS,
        }

        public string id = "";
        public string displayName = "";
        public string description = "";
        public Kind kind = Kind.ACHIEVEMENT;
        public string metric = "";
        public MetricShape metricShape = MetricShape.CUMULATIVE;
        public float target = 1.0f;
        public RewardKind rewardKind = RewardKind.ESSENCE_SECONDS;
        public float rewardAmount = 120.0f;
        public int sortOrder = 0;
    }
}
