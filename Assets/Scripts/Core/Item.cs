using System.Collections.Generic;

namespace VantaEclipse.Core
{
    /// <summary>
    /// One piece of gear.
    ///
    /// The Godot version kept items as plain Dictionaries so they serialised
    /// straight into the save. That cost a normalisation pass on every load —
    /// JSON downgrades StringName to String and Godot treats &amp;"x" and "x"
    /// as different dictionary keys, so slot and affix ids had to be rebuilt
    /// or the stat sums silently missed. A typed class removes the whole class
    /// of bug: there are no string keys left to disagree about, and the
    /// compiler checks the field names.
    /// </summary>
    public sealed class Item
    {
        public int Id;
        public string Slot = "";
        public int Rarity;
        public int ItemLevel = 1;

        /// <summary>Affix id -> rolled magnitude.</summary>
        public Dictionary<string, float> Affixes = new();

        /// <summary>False until the player has seen it on the Gear screen.
        /// Durable: it lives on the item and persists through the save, so the
        /// GEAR count pill and per-row NEW tags survive an app restart.</summary>
        public bool Seen = true;

        public Dictionary<string, object> ToSaveData()
        {
            var affixes = new Dictionary<string, object>();
            foreach (var pair in Affixes) affixes[pair.Key] = pair.Value;
            return new Dictionary<string, object>
            {
                { "id", Id },
                { "slot", Slot },
                { "rarity", Rarity },
                { "item_level", ItemLevel },
                { "affixes", affixes },
                { "seen", Seen },
            };
        }

        public static Item FromSaveData(Dictionary<string, object> raw)
        {
            var item = new Item
            {
                Id = SaveRead.Int(raw, "id"),
                Slot = SaveRead.Str(raw, "slot"),
                Rarity = SaveRead.Int(raw, "rarity"),
                ItemLevel = SaveRead.Int(raw, "item_level", 1),
                Seen = SaveRead.Bool(raw, "seen", true),
            };
            var affixes = SaveRead.Section(raw, "affixes");
            foreach (var key in affixes.Keys)
                item.Affixes[key] = SaveRead.Float(affixes, key);
            return item;
        }
    }
}
