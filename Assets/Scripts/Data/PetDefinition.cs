// THIS FILE IS THE SOURCE. It was generated once, from a definition in the
// previous engine, by a porter that no longer exists — so edit it here.
//
// It is `partial` because the original carried methods as well as fields
// (GetCost, FormatEffect, ...), which could not be derived from a field list.
// Those live in Methods/PetDefinition.Methods.cs.
using UnityEngine;

namespace VantaEclipse.Data
{

    /// One pet line — a companion that levels and evolves through stages, each
    /// granting one passive bonus that scales with level.
    [CreateAssetMenu(menuName = "Vanta Eclipse/Pet", fileName = "NewPetDefinition")]
    public partial class PetDefinition : ScriptableObject
    {
        public string id = "";
        public string[] stageNames = new string[0];
        public Sprite[] stageSprites = new Sprite[0];
        public int[] evolutionLevels = new int[0];
        public string bonusStat = "";
        public float bonusPerLevel = 0.02f;
        public int maxLevel = 30;
    }
}
