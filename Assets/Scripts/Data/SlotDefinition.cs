// THIS FILE IS THE SOURCE. It was generated once, from a definition in the
// previous engine, by a porter that no longer exists — so edit it here.
//
// It is `partial` because the original carried methods as well as fields
// (GetCost, FormatEffect, ...), which could not be derived from a field list.
// Those live in Methods/SlotDefinition.Methods.cs.
using UnityEngine;

namespace VantaEclipse.Data
{

    /// One equipment slot. Data-driven so the slot set is content, not code.
    [CreateAssetMenu(menuName = "Vanta Eclipse/Slot", fileName = "NewSlotDefinition")]
    public partial class SlotDefinition : ScriptableObject
    {
        public string id = "";
        public string displayName = "";
        public Sprite icon = null;
        public bool @sealed = false;
        public string sealedFlavor = "";
    }
}
