// THIS FILE IS THE SOURCE. It was generated once, from a definition in the
// previous engine, by a porter that no longer exists — so edit it here.
//
// It is `partial` because the original carried methods as well as fields
// (GetCost, FormatEffect, ...), which could not be derived from a field list.
// Those live in Methods/RelicDefinition.Methods.cs.
using UnityEngine;

namespace VantaEclipse.Data
{

    /// One relic — a unique, named, permanent coded effect. Not affix gear.
    /// Adding a relic is one .tres; only a NEW effect_id needs manager code.
    [CreateAssetMenu(menuName = "Vanta Eclipse/Relic", fileName = "NewRelicDefinition")]
    public partial class RelicDefinition : ScriptableObject
    {
        public string id = "";
        public string displayName = "";
        public Sprite sigil = null;
        public string effectId = "";
        public float effectValue = 0.0f;
        public string effectDescription = "";
        public string flavor = "";
        public float dropWeight = 1.0f;
    }
}
