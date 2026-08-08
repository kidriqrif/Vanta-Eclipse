// Ported from the safe-area half of scripts/managers/scene_manager.gd
using UnityEngine;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Insets a screen's content root for the display cutout and gesture bar,
    /// and caps it to the width the layout was drawn for.
    ///
    /// Android hands the app the WHOLE screen, including the strip behind a
    /// notch or punch-hole camera and the strip under the gesture bar. Nothing
    /// read that in the original build, so on any modern phone the top row
    /// (world name, SHOP, MENU) sat under the cutout and the bottom row (GEAR,
    /// UPGRADES, the doors) sat under the gesture bar — on exactly the tall
    /// devices that dominate the install base.
    ///
    /// Put this on the screen's content root, NOT on its background: the
    /// background should still fill the display edge to edge, and only the
    /// controls move in.
    ///
    /// In Godot this lived in the SceneManager autoload, because a per-scene
    /// script writing the same margins did not compose with it — it replaced
    /// it, and silently dropped the cutout inset on the phones that need it.
    /// Unity has no such conflict: anchors are per-RectTransform, so the logic
    /// belongs on the object it insets. The width cap stays fused to the safe
    /// area for the original reason though — they are two terms of one inset,
    /// and splitting them into two components reintroduces exactly the
    /// last-writer-wins bug.
    /// </summary>
    [DisallowMultipleComponent]
    [RequireComponent(typeof(RectTransform))]
    public sealed class SafeAreaFitter : MonoBehaviour
    {
        /// <summary>The width the layout was designed against. Content never
        /// exceeds it.</summary>
        public const float MaxContentWidth = 1080f;

        RectTransform _rect;
        Rect _lastSafeArea;
        Vector2Int _lastScreen;

        void Awake()
        {
            _rect = GetComponent<RectTransform>();
            Apply();
        }

        // Cheap, and the alternatives are worse: Unity raises no event for a
        // safe-area change, and it genuinely moves at runtime on a fold or a
        // rotation.
        void Update()
        {
            if (Screen.safeArea == _lastSafeArea
                && Screen.width == _lastScreen.x
                && Screen.height == _lastScreen.y) return;
            Apply();
        }

        void Apply()
        {
            _lastSafeArea = Screen.safeArea;
            _lastScreen = new Vector2Int(Screen.width, Screen.height);

            if (Screen.width <= 0 || Screen.height <= 0) return;

            var safe = Screen.safeArea;

            // Anchor-space (0..1) inset, so it is resolution-independent and
            // composes with whatever CanvasScaler is doing.
            var min = safe.position;
            var max = safe.position + safe.size;
            min.x /= Screen.width;
            min.y /= Screen.height;
            max.x /= Screen.width;
            max.y /= Screen.height;

            // The width cap, as a second inset term on the same edges.
            //
            // The layout is drawn for a 1080-wide portrait viewport, and a
            // taller phone should get extra height rather than cropping. That
            // is right up to a point and wrong past it — on a 16:10 tablet in
            // landscape a bottom bar built for 1080 stretches to three times
            // its width and the content it framed is a ribbon in an empty
            // field. A layout audit passes throughout, because stranding is
            // not overflow.
            //
            // This stopped being hypothetical at targetSdk 36: Android 16
            // ignores android:screenOrientation on displays 600dp and wider, so
            // a portrait-locked game gets shown in landscape whether it asks to
            // or not.
            float capPixels = Mathf.Max(0f, safe.size.x - MaxContentWidth) * 0.5f;
            if (capPixels > 0f)
            {
                float capFraction = capPixels / Screen.width;
                min.x += capFraction;
                max.x -= capFraction;
            }

            _rect.anchorMin = min;
            _rect.anchorMax = max;
            _rect.offsetMin = Vector2.zero;
            _rect.offsetMax = Vector2.zero;
        }
    }
}
