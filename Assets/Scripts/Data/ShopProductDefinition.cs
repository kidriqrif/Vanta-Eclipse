// THIS FILE IS THE SOURCE. It was generated once, from a definition in the
// previous engine, by a porter that no longer exists — so edit it here.
//
// It is `partial` because the original carried methods as well as fields
// (GetCost, FormatEffect, ...), which could not be derived from a field list.
// Those live in Methods/ShopProductDefinition.Methods.cs.
using UnityEngine;

namespace VantaEclipse.Data
{

    /// One purchasable product. `store_id` is the SKU a real store would use; the
    /// stub billing provider ignores it.
    [CreateAssetMenu(menuName = "Vanta Eclipse/Shop Product", fileName = "NewShopProductDefinition")]
    public partial class ShopProductDefinition : ScriptableObject
    {
        public enum Kind
        {
            ENTITLEMENT,
            BUNDLE,
            SHARDS,
        }

        public string id = "";
        public string storeId = "";
        public string displayName = "";
        public string description = "";
        public Kind kind = Kind.BUNDLE;
        public string priceText = "$2.99";
        public float crystals = 0.0f;
        public int tokens = 0;
        public float shards = 0.0f;
        public string cosmeticId = "";
        public int sortOrder = 0;
    }
}
