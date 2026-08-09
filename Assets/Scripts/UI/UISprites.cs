using System.Collections.Generic;
using UnityEngine;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Named access to the sprites the UI scripts reference from code.
    ///
    /// There is no way to hold a hard asset reference in a plain static field
    /// on a non-MonoBehaviour: a Sprite reachable only from code must either be
    /// serialized on an object
    /// somebody wired by hand, or live under a Resources folder and be loaded
    /// by path. The art tree moved under Assets/Resources/Art for exactly this
    /// reason — the alternative was 20 inspector slots per screen that
    /// SceneBuilder would clear on every regeneration.
    ///
    /// Loads are cached, so the repeated lookups inside a per-frame path (the
    /// minigame boards ask for their face sprites while laying out a grid) cost
    /// one dictionary hit rather than one AssetDatabase walk.
    ///
    /// A missing sprite logs and returns null rather than throwing. Every call
    /// site here is decorating something that also carries text, so a null icon
    /// is a cosmetic gap, not a reason to lose the screen — the same rule
    /// UIScreen.Find follows.
    /// </summary>
    public static class UISprites
    {
        /// <summary>Path under Assets/Resources/. Resources.Load takes no file
        /// extension, so these are stems.</summary>
        const string Root = "Art/";

        static readonly Dictionary<string, Sprite> Cache = new();

        public static Sprite Get(string relativePath)
        {
            if (Cache.TryGetValue(relativePath, out var cached)) return cached;

            var sprite = Resources.Load<Sprite>(Root + relativePath);
            if (sprite == null)
                Debug.LogWarning($"UISprites: no sprite at Resources/{Root}{relativePath}.");
            // Cache the miss too. A name that is wrong is wrong for the whole
            // session, and re-attempting it every frame turns one warning into
            // a flooded console.
            Cache[relativePath] = sprite;
            return sprite;
        }

        // --- UI icons ---------------------------------------------------------

        public static Sprite BossSkull => Get("ui/boss_skull_icon");
        public static Sprite Eclipse => Get("ui/eclipse_icon");
        public static Sprite ArcadeToken => Get("ui/arcade_token_icon");
        public static Sprite Journal => Get("ui/journal_icon");
        public static Sprite CardFrame => Get("ui/card_frame_icon");
        public static Sprite LockGlyph => Get("ui/lock_glyph");
        public static Sprite SlotRelic => Get("ui/slot_relic");

        // --- Minigame pieces --------------------------------------------------

        public static Sprite CardBack => Get("minigames/card_back");
        public static Sprite CellEmpty => Get("minigames/cell_empty");
        public static Sprite DiscPlayer => Get("minigames/disc_player");
        public static Sprite DiscAi => Get("minigames/disc_ai");
        public static Sprite ShotHit => Get("minigames/shot_hit");
        public static Sprite ShotMiss => Get("minigames/shot_miss");
        public static Sprite ShotSunk => Get("minigames/shot_sunk");

        /// <summary>The six memory-match faces. The pairing logic indexes this
        /// array, so the order is
        /// load-bearing rather than cosmetic.</summary>
        public static readonly string[] FaceNames =
        {
            "minigames/face_circle",
            "minigames/face_cross",
            "minigames/face_diamond",
            "minigames/face_hexagon",
            "minigames/face_square",
            "minigames/face_triangle",
        };

        public static Sprite Face(int index) => Get(FaceNames[Mathf.Abs(index) % FaceNames.Length]);
    }
}
