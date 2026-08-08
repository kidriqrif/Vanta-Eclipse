using System.Collections.Generic;
using UnityEngine;

namespace VantaEclipse.Core
{
    /// <summary>
    /// One boss trophy card.
    ///
    /// A card is an INSTANCE, not a definition: its stats are rolled at the
    /// kill from the boss's level and the tier that came up, and the result
    /// lives in the save. Only the shape of the roll is data
    /// (CardRarityDefinition), so retuning drop rates or potency is a data edit
    /// and never touches manager code.
    /// </summary>
    public sealed class Card
    {
        public string Boss = "";
        public string Name = "Unknown";
        public string Rarity = "";
        public int Level = 1;
        public float Power;
        public float Vigor;
        public float Focus;

        public Dictionary<string, object> ToSaveData() => new()
        {
            { "boss", Boss },
            { "name", Name },
            { "rarity", Rarity },
            { "level", Level },
            { "power", Power },
            { "vigor", Vigor },
            { "focus", Focus },
        };

        /// <summary>
        /// Rebuild a card from a save document, or null if it cannot be made
        /// whole.
        ///
        /// A card off disk is untrusted: an edited save, or one written before
        /// a rarity was renamed, must not reach the UI half-built. Anything
        /// that cannot be made whole is dropped rather than repaired into a
        /// lie — which is why the rarity check is the caller's job and this
        /// returns null rather than a default.
        /// </summary>
        public static Card FromSaveData(Dictionary<string, object> raw)
        {
            if (raw == null) return null;
            return new Card
            {
                Boss = SaveRead.Str(raw, "boss"),
                Name = SaveRead.Str(raw, "name", "Unknown"),
                Rarity = SaveRead.Str(raw, "rarity"),
                Level = Mathf.Max(1, SaveRead.Int(raw, "level", 1)),
                Power = Mathf.Max(0f, SaveRead.Float(raw, "power")),
                Vigor = Mathf.Max(0f, SaveRead.Float(raw, "vigor")),
                Focus = Mathf.Max(0f, SaveRead.Float(raw, "focus")),
            };
        }
    }
}
