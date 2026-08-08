using UnityEngine;

namespace VantaEclipse.UI
{
    /// <summary>Ported from scripts/ui/rarity_style.gd — the one place a
    /// rarity index becomes a name and a colour, so the five tiers read the
    /// same on every screen that shows gear.</summary>
    public static class RarityStyle
    {
        static readonly string[] Names = { "Common", "Rare", "Epic", "Legendary", "Mythic" };

        static readonly Color[] Colors =
        {
            VantaTheme.Ash,      // Common — deliberately muted; most drops are these
            VantaTheme.Azure,    // Rare
            VantaTheme.Violet,   // Epic
            VantaTheme.Gold,     // Legendary
            VantaTheme.Rose,     // Mythic
        };

        public static string Name(int rarity) => Names[Mathf.Clamp(rarity, 0, Names.Length - 1)];

        public static Color Color(int rarity) => Colors[Mathf.Clamp(rarity, 0, Colors.Length - 1)];
    }
}
