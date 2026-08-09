// THIS FILE IS THE SOURCE. It was generated once, from a definition in the
// previous engine, by a porter that no longer exists — so edit it here.
//
// It is `partial` because the original carried methods as well as fields
// (GetCost, FormatEffect, ...), which could not be derived from a field list.
// Those live in Methods/CardRarityDefinition.Methods.cs.
using UnityEngine;

namespace VantaEclipse.Data
{

    /// One rarity tier a boss card can roll. Adding a tier is one .tres. Card
    /// STATS are rolled at runtime and live in the save, not here — a card is an
    /// instance, not a definition, so there is no .tres per card. What lives in
    /// data is the shape of the roll: how often a tier comes up, how hard it
    /// hits, and what colour it wears. That keeps the tuning a designer actually
    /// turns out of CardManager entirely.
    [CreateAssetMenu(menuName = "Vanta Eclipse/Card Rarity", fileName = "NewCardRarityDefinition")]
    public partial class CardRarityDefinition : ScriptableObject
    {
        public string id = "";
        public string displayName = "";
        public float dropWeight = 1.0f;
        public float potencyMultiplier = 1.0f;
        public int minimumBossLevel = 1;
        public Color color = new Color(0.525f, 0.525f, 0.635f, 1f);
        public int sortOrder = 0;
    }
}
