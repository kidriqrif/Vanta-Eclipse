using System.Collections.Generic;
using UnityEngine;

namespace VantaEclipse.UI
{
    /// <summary>
    /// The closed sixteen-colour palette, and the named styles built from it.
    ///
    /// THE PALETTE IS CLOSED. Sixteen colours, no sixteen-and-a-halves. Every
    /// pixel of every sprite and every colour in the UI is one of these, and
    /// the validation sweep fails on anything else. These values are the same
    /// hexes tools/pixelart.py generates the art from, so a palette change is
    /// still one edit in one place — it just now has two consumers.
    /// </summary>
    public static class VantaTheme
    {
        // neutrals, darkest to lightest
        public static readonly Color Void = Hex("08080C");     // background behind everything
        public static readonly Color Abyss = Hex("171722");    // panel surface
        public static readonly Color Slate = Hex("2C2C3C");    // a row or tile on a panel
        public static readonly Color Iron = Hex("4E4E66");     // borders, dividers
        public static readonly Color Ash = Hex("8686A2");      // muted and disabled text
        public static readonly Color Bone = Hex("C8C8DA");     // body text
        public static readonly Color Ivory = Hex("F6F6FC");    // titles, the brightest pixel allowed

        // hues
        public static readonly Color Blood = Hex("B01228");    // deep accent — ivory text sits ON it
        public static readonly Color Crimson = Hex("FF3A46");  // the accent, the identity
        public static readonly Color Ember = Hex("FF8A28");    // fire, warning, heat
        public static readonly Color Gold = Hex("FFD23C");     // currency, legendary
        public static readonly Color Moss = Hex("6ADC3E");     // poison, nature, success
        public static readonly Color Frost = Hex("3EDCFA");    // ice, rare
        public static readonly Color Azure = Hex("3E82FF");    // arcane, uncommon
        public static readonly Color Violet = Hex("A85CFF");   // void magic, epic
        public static readonly Color Rose = Hex("FF6EC0");     // mythic, charm

        /// <summary>Every font size in the game is a whole multiple of the 5x7
        /// face's 9px glyph box. The sweep fails the build on any size that is
        /// not, so sizes are rounded to this grid rather than trusted.</summary>
        public const int GlyphBox = 9;

        public sealed class Style
        {
            public Color Text = Bone;
            public int FontSize = 27;
            public Color? Background;
            public bool Bold;
        }

        /// <summary>The theme_type_variation names the .tscn files use, mapped
        /// to what they mean. Anything unnamed falls back to body text.</summary>
        static readonly Dictionary<string, Style> Styles = new()
        {
            { "TitleLabel", new Style { Text = Ivory, FontSize = 54 } },
            { "PanelTitle", new Style { Text = Ivory, FontSize = 36 } },
            { "HeaderLabel", new Style { Text = Ash, FontSize = 27 } },
            { "AccentHeaderLabel", new Style { Text = Crimson, FontSize = 27 } },
            { "AccentLabel", new Style { Text = Crimson, FontSize = 27 } },
            { "MutedLabel", new Style { Text = Ash, FontSize = 27 } },
            { "PrimaryButton", new Style { Text = Ivory, FontSize = 36, Background = Blood } },
            { "DangerButton", new Style { Text = Ivory, FontSize = 36, Background = Crimson } },
            { "BadgePanel", new Style { Text = Ivory, FontSize = 18, Background = Crimson } },
            { "OverlayPanel", new Style { Text = Bone, Background = Abyss } },
            { "ModalCard", new Style { Text = Bone, Background = Abyss } },
            { "CelebrationToast", new Style { Text = Gold, FontSize = 36, Background = Abyss } },
        };

        public static Style Get(string variation)
        {
            if (!string.IsNullOrEmpty(variation) && Styles.TryGetValue(variation, out var style))
                return style;
            return new Style();
        }

        /// <summary>Round a font size onto the glyph grid. A 5x7 bitmap face
        /// resampled to a fractional multiple is the difference between crisp
        /// text and mush, and it is invisible in the editor at desktop scale.</summary>
        public static int SnapFontSize(int requested)
        {
            int multiple = Mathf.Max(1, Mathf.RoundToInt(requested / (float)GlyphBox));
            return multiple * GlyphBox;
        }

        static Color Hex(string rgb)
        {
            int r = System.Convert.ToInt32(rgb.Substring(0, 2), 16);
            int g = System.Convert.ToInt32(rgb.Substring(2, 2), 16);
            int b = System.Convert.ToInt32(rgb.Substring(4, 2), 16);
            return new Color(r / 255f, g / 255f, b / 255f, 1f);
        }
    }
}
