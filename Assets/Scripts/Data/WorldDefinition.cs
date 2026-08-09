// THIS FILE IS THE SOURCE. It was generated once, from a definition in the
// previous engine, by a porter that no longer exists — so edit it here.
//
// It is `partial` because the original carried methods as well as fields
// (GetCost, FormatEffect, ...), which could not be derived from a field list.
// Those live in Methods/WorldDefinition.Methods.cs.
using UnityEngine;

namespace VantaEclipse.Data
{

    /// Data asset describing one 50-level world. Adding a world is a data drop:
    /// one .tres here, creature/boss definitions, and sprites.
    [CreateAssetMenu(menuName = "Vanta Eclipse/World", fileName = "NewWorldDefinition")]
    public partial class WorldDefinition : ScriptableObject
    {
        public string id = "";
        public string displayName = "";
        public int firstLevel = 1;
        public string[] enemyDefinitionPaths = new string[0];
        public string[] bossDefinitionPaths = new string[0];
        public float essenceMultiplier = 1.0f;
    }
}
