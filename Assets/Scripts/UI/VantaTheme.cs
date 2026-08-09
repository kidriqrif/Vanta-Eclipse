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

        // --- Semantic names ---------------------------------------------------
        //
        // Ported from scripts/ui/ui_palette.gd, which existed because sixteen
        // screens each kept their own `const IVORY` copy of the same literal.
        // That was invisible duplication right up until the palette changed, at
        // which point every copy silently kept the old colour and the restyle
        // half-applied.
        //
        // In Godot these read the Theme resource at runtime so a stylebox could
        // never drift from the value a script used. There is no Theme resource
        // here — Unity's UI has no equivalent global — so instead they are
        // aliases onto the sixteen above, which is the same single source of
        // truth reached one step earlier. The values were lifted from
        // ui/theme/main_theme.tres entry by entry.

        /// <summary>Primary body text (Label/colors/font_color).</summary>
        public static Color Ink => Ivory;

        /// <summary>Secondary / supporting text — the muted register
        /// (HeaderLabel, MutedLabel).</summary>
        public static Color Muted => Bone;

        /// <summary>Display headlines (TitleLabel).</summary>
        public static Color Title => Ivory;

        /// <summary>The bright accent: marks, active state, small text on
        /// black.</summary>
        public static Color Accent => Crimson;

        /// <summary>The deep accent: a fill that ivory text sits ON. Not
        /// interchangeable with <see cref="Accent"/> — that one is tuned to be
        /// READ against black, this one to be read THROUGH, and neither clears
        /// 7:1 in the other's job.</summary>
        public static Color AccentDeep => Blood;

        /// <summary>Panel fill (PanelContainer/styles/panel).</summary>
        public static Color Surface => Abyss;

        /// <summary>A row or tile sitting on a panel — one step up from the
        /// surface (Button hover).</summary>
        public static Color Raised => Slate;

        /// <summary>Hairline dividers and inactive borders (Button normal
        /// border).</summary>
        public static Color Line => Slate;

        /// <summary>Same colour at a different alpha, for scrims and
        /// de-emphasised states.</summary>
        public static Color Fade(Color color, float alpha)
            => new(color.r, color.g, color.b, alpha);

        /// <summary>Not a colour: the absence of one. An invisible graphic that
        /// exists only to receive a raycast, or a marker turned off. Named so
        /// the palette sweep can tell it apart from a stray literal.</summary>
        public static readonly Color Invisible = new(0f, 0f, 0f, 0f);

        // Selectable.colors multipliers, not palette entries. Unity multiplies
        // the target graphic by these, so 1.0 means "leave it alone" — a press
        // darkens, a hover lifts, and the disabled state is left at full so a
        // finished board keeps the colours it ended on rather than fading.
        public static readonly Color TintNormal = new(1f, 1f, 1f, 1f);
        public static readonly Color TintHighlighted = new(1.1f, 1.1f, 1.1f, 1f);
        public static readonly Color TintPressed = new(0.85f, 0.85f, 0.85f, 1f);
        public static readonly Color TintDisabled = new(1f, 1f, 1f, 0.45f);

        /// <summary>Every font size in the game is a whole multiple of the 5x7
        /// face's 9px glyph box. The sweep fails the build on any size that is
        /// not, so sizes are rounded to this grid rather than trusted.</summary>
        public const int GlyphBox = 9;

        public sealed class Style
        {
            /// <summary>Godot's default_font_size and Label/colors/font_color:
            /// what a control with no theme_type_variation gets.</summary>
            public Color Text = Ivory;
            public int FontSize = 27;
            public Color? Background;
            public Color? Border;
        }

        /// <summary>
        /// The theme_type_variation names the .tscn files use, mapped to what
        /// they mean. Anything unnamed falls back to body text.
        ///
        /// Transcribed entry by entry from ui/theme/main_theme.tres rather than
        /// inferred from the names — an earlier pass guessed, and guessed wrong
        /// on six of the twelve. HeaderLabel is Bone at 18, not Ash at 27;
        /// DangerButton is crimson text on void, not ivory on crimson; the
        /// badge is Blood, not Crimson. Every size here is a multiple of the
        /// 9px glyph box because every size in the theme already was.
        /// </summary>
        static readonly Dictionary<string, Style> Styles = new()
        {
            { "TitleLabel", new Style { Text = Ivory, FontSize = 54 } },
            { "PanelTitle", new Style { Text = Ivory, FontSize = 27 } },
            { "HeaderLabel", new Style { Text = Bone, FontSize = 18 } },
            { "AccentHeaderLabel", new Style { Text = Crimson, FontSize = 18 } },
            { "AccentLabel", new Style { Text = Crimson, FontSize = 27 } },
            { "MutedLabel", new Style { Text = Bone, FontSize = 27 } },
            { "PrimaryButton", new Style { Text = Ivory, FontSize = 27, Background = Blood } },
            // Crimson ON void, bordered in blood — the destructive action reads
            // as an outline, not as a filled button competing with the primary.
            { "DangerButton", new Style { Text = Crimson, FontSize = 27,
                                          Background = Void, Border = Blood } },
            { "BadgePanel", new Style { Text = Ivory, FontSize = 18, Background = Blood } },
            { "OverlayPanel", new Style { Text = Ivory,
                                          Background = Fade(Abyss, 0.94f), Border = Iron } },
            { "ModalCard", new Style { Text = Ivory,
                                       Background = Fade(Abyss, 0.97f), Border = Iron } },
            { "CelebrationToast", new Style { Text = Ivory,
                                              Background = Abyss, Border = Blood } },
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
