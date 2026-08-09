// Ported from scripts/ui/rarity_style.gd
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Shared rarity presentation: colours, names, and the affix-count pip row
    /// that carries rarity colour-free. Used by slot tiles, inventory rows, the
    /// Inspector Card, and Loot Toasts, so the system is defined once.
    ///
    /// A HUE ladder, one entry per tier, all five from the 16-colour palette.
    /// It used to be a value ladder — five greys climbing in brightness, only
    /// Mythic allowed any chroma — because the old scheme was a single red
    /// accent on neutrals and five competing hues would have fought it. A
    /// sixteen-colour palette has room for the hues and, more to the point, not
    /// enough room for the greys: snapping the old ramp onto it landed Rare and
    /// Epic on the SAME neutral. Two adjacent tiers rendering identically is a
    /// worse outcome than any amount of colour.
    ///
    /// Still colour-blind safe, for the same reason it always was:
    /// <see cref="MakePipRow"/> draws (rarity + 1) pips, so the tier is carried
    /// by COUNT and the hue is reinforcement.
    /// </summary>
    public static class RarityStyle
    {
        /// <summary>Tier count, so callers clamp without indexing a colour
        /// table.</summary>
        public const int Tiers = 5;

        static readonly string[] Names = { "Common", "Rare", "Epic", "Legendary", "Mythic" };

        const float PipSize = 13f;
        const float PipCell = 20f;
        const float PipSeparation = 4f;
        static readonly Color PipOutline = new(0.031f, 0.031f, 0.047f, 0.4f);

        public static string Name(int rarity)
            => Names[Mathf.Clamp(rarity, 0, Names.Length - 1)];

        /// <summary>
        /// Common and Mythic BORROW their colours from the theme rather than
        /// restating them: they are the muted register and the accent, and a
        /// rarity ladder that drifts from the chrome it sits inside looks broken
        /// rather than deliberate. The middle three are palette hues the UI
        /// chrome never uses, so there is nothing to borrow.
        /// </summary>
        public static Color Color(int rarity) => Mathf.Clamp(rarity, 0, Tiers - 1) switch
        {
            1 => VantaTheme.Frost,       // Rare
            2 => VantaTheme.Violet,      // Epic
            3 => VantaTheme.Gold,        // Legendary
            4 => VantaTheme.Accent,      // Mythic
            _ => VantaTheme.Muted,       // Common — recedes
        };

        /// <summary>
        /// Build a row of (rarity + 1) diamond pips — the colour-independent
        /// rarity signal (pip count == affix count == tier). Each pip carries a
        /// dark outline so light-coloured pips (Common/Legendary) stay legible
        /// on light background patches. The caller parents it.
        /// </summary>
        public static GameObject MakePipRow(int rarity)
        {
            var row = new GameObject("PipRow", typeof(RectTransform));
            var layout = row.AddComponent<HorizontalLayoutGroup>();
            layout.spacing = PipSeparation;
            layout.childForceExpandWidth = false;
            layout.childForceExpandHeight = false;
            layout.childAlignment = TextAnchor.MiddleLeft;
            // A pip row is decoration on top of something tappable; it must not
            // eat the tap. Godot said MOUSE_FILTER_IGNORE on every node here.
            row.AddComponent<CanvasGroup>().blocksRaycasts = false;

            var fitter = row.AddComponent<ContentSizeFitter>();
            fitter.horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            var color = Color(rarity);
            int count = Mathf.Clamp(rarity, 0, Tiers - 1) + 1;
            for (int i = 0; i < count; i++)
            {
                // A fixed cell keeps the row's layout stable while the inner
                // pip is rotated 45 degrees into a diamond — a rotated element
                // reports its unrotated size to the layout system, so without
                // the cell the spacing would drift with the rotation.
                var cell = new GameObject($"Pip{i}", typeof(RectTransform));
                cell.transform.SetParent(row.transform, false);
                var cellRect = cell.GetComponent<RectTransform>();
                cellRect.sizeDelta = new Vector2(PipCell, PipCell);
                var element = cell.AddComponent<LayoutElement>();
                element.minWidth = PipCell;
                element.minHeight = PipCell;
                element.preferredWidth = PipCell;
                element.preferredHeight = PipCell;

                var pip = new GameObject("Diamond", typeof(RectTransform));
                pip.transform.SetParent(cell.transform, false);
                var pipRect = pip.GetComponent<RectTransform>();
                pipRect.sizeDelta = new Vector2(PipSize, PipSize);
                pipRect.anchoredPosition = Vector2.zero;
                pipRect.localRotation = Quaternion.Euler(0f, 0f, 45f);

                var outline = pip.AddComponent<Image>();
                outline.color = PipOutline;
                outline.raycastTarget = false;

                // The 1px border in Godot was a stylebox property. Here it is a
                // slightly smaller fill inside a slightly larger outline quad,
                // which is the same two rectangles without a second material.
                var fill = new GameObject("Fill", typeof(RectTransform));
                fill.transform.SetParent(pip.transform, false);
                var fillRect = fill.GetComponent<RectTransform>();
                fillRect.anchorMin = Vector2.zero;
                fillRect.anchorMax = Vector2.one;
                fillRect.offsetMin = new Vector2(1f, 1f);
                fillRect.offsetMax = new Vector2(-1f, -1f);
                var fillImage = fill.AddComponent<Image>();
                fillImage.color = color;
                fillImage.raycastTarget = false;
            }
            return row;
        }

        /// <summary>The item's headline stat line, e.g. "Tap Damage +12" for
        /// its biggest affix — a glanceable "what does it do" for tiles and
        /// rows.</summary>
        public static string KeyStatLine(Item item)
        {
            if (item == null || item.Affixes.Count == 0) return "";
            foreach (var pair in item.Affixes)
                return Game.Equipment.FormatAffix(pair.Key, pair.Value);
            return "";
        }
    }
}
