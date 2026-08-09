// THIS FILE IS THE SOURCE. It was generated once, from a definition in the
// previous engine, by a porter that no longer exists — so edit it here.
//
// It is `partial` because the original carried methods as well as fields
// (GetCost, FormatEffect, ...), which could not be derived from a field list.
// Those live in Methods/AdPlacementDefinition.Methods.cs.
using UnityEngine;

namespace VantaEclipse.Data
{

    /// One opt-in rewarded-ad offer. Adding or retuning a placement is a .tres.
    [CreateAssetMenu(menuName = "Vanta Eclipse/Ad Placement", fileName = "NewAdPlacementDefinition")]
    public partial class AdPlacementDefinition : ScriptableObject
    {
        public enum RewardKind
        {
            ESSENCE_SECONDS,
            ARCADE_TOKENS,
            MULTIPLY_PENDING,
        }

        public string id = "";
        public string displayName = "";
        public string description = "";
        public RewardKind rewardKind = RewardKind.ESSENCE_SECONDS;
        public float rewardAmount = 600.0f;
        public int dailyCap = 3;
        public bool contextual = false;
        public int sortOrder = 0;
    }
}
