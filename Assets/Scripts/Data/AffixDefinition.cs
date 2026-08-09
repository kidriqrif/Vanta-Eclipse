// THIS FILE IS THE SOURCE. It was generated once, from a definition in the
// previous engine, by a porter that no longer exists — so edit it here.
//
// It is `partial` because the original carried methods as well as fields
// (GetCost, FormatEffect, ...), which could not be derived from a field list.
// Those live in Methods/AffixDefinition.Methods.cs.
using UnityEngine;

namespace VantaEclipse.Data
{

    /// One rollable equipment affix. The affix pool is data — new affixes are new
    /// .tres files, no code change.
    [CreateAssetMenu(menuName = "Vanta Eclipse/Affix", fileName = "NewAffixDefinition")]
    public partial class AffixDefinition : ScriptableObject
    {
        public string id = "";
        public string stat = "";
        public string displayTemplate = "{value}";
        public float minValue = 0.0f;
        public float maxValue = 1.0f;
        public bool isPercent = true;
        public float levelScale = 0.0f;
    }
}
