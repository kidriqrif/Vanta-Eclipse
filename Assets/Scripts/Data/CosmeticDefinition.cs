// THIS FILE IS THE SOURCE. It was generated once, from a definition in the
// previous engine, by a porter that no longer exists — so edit it here.
//
// It is `partial` because the original carried methods as well as fields
// (GetCost, FormatEffect, ...), which could not be derived from a field list.
// Those live in Methods/CosmeticDefinition.Methods.cs.
using UnityEngine;

namespace VantaEclipse.Data
{

    /// A tap-trail cosmetic. Cosmetics live where NO state is encoded — the tap
    /// impact and its damage numbers — so they can reuse family hues freely
    /// without touching the accent scope law.
    [CreateAssetMenu(menuName = "Vanta Eclipse/Cosmetic", fileName = "NewCosmeticDefinition")]
    public partial class CosmeticDefinition : ScriptableObject
    {
        public string id = "";
        public string displayName = "";
        public Color trailColor = new Color(1f, 0.231f, 0.188f, 1f);
        public Color numberColor = new Color(0.929f, 0.929f, 0.941f, 1f);
        public float shardPrice = 0.0f;
        public int sortOrder = 0;
    }
}
