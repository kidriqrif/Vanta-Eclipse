// THIS FILE IS THE SOURCE. It was generated once, from a definition in the
// previous engine, by a porter that no longer exists — so edit it here.
//
// It is `partial` because the original carried methods as well as fields
// (GetCost, FormatEffect, ...), which could not be derived from a field list.
// Those live in Methods/MinigameDefinition.Methods.cs.
using UnityEngine;

namespace VantaEclipse.Data
{

    /// Data asset describing one Arcade minigame. Designers add a minigame by
    /// writing a scene whose root extends Minigame and dropping a .tres here —
    /// the Arcade hub and the host build themselves from these, so the framework
    /// never changes to gain a game.
    [CreateAssetMenu(menuName = "Vanta Eclipse/Minigame", fileName = "NewMinigameDefinition")]
    public partial class MinigameDefinition : ScriptableObject
    {
        public string id = "";
        public string displayName = "";
        public string description = "";
        public Sprite icon = null;
        public string scenePath = "";
        public int unlockLevel = 20;
        public float rewardSeconds = 240.0f;
        public int tokenCost = 1;
        public bool lowerIsBetter = false;
        public string context = "{}";
        public int sortOrder = 0;
    }
}
