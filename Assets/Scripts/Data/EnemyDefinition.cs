// THIS FILE IS THE SOURCE. It was generated once, from a definition in the
// previous engine, by a porter that no longer exists — so edit it here.
//
// It is `partial` because the original carried methods as well as fields
// (GetCost, FormatEffect, ...), which could not be derived from a field list.
// Those live in Methods/EnemyDefinition.Methods.cs.
using UnityEngine;

namespace VantaEclipse.Data
{

    /// Data asset describing one enemy type. Designers add new enemies by
    /// creating a .tres file in data/enemies/ — no code changes needed. Note: a
    /// world names its own roster via WorldDefinition.enemy_definition_paths
    /// rather than each enemy naming its world, and loot is generated from the
    /// kill LEVEL by EquipmentManager rather than a per-enemy table. Both were
    /// considered here and deliberately solved on the other side.
    [CreateAssetMenu(menuName = "Vanta Eclipse/Enemy", fileName = "NewEnemyDefinition")]
    public partial class EnemyDefinition : ScriptableObject
    {
        public string id = "";
        public string displayName = "";
        public Sprite texture = null;
        public float hpMultiplier = 1.0f;
        public Color glowColor = new Color(0.769f, 0.769f, 0.804f, 1f);
        public bool isBoss = false;
        public float viewScale = 1.0f;
    }
}
