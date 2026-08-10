using UnityEngine;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Keeps a fixed-size component inside the box it was dropped into.
    ///
    /// A component authored at a fixed size — enemy_view is a 500x500 square —
    /// is correct in isolation and wrong the moment its container is smaller
    /// than that. It has no opinion about the container and the container has
    /// no control over it, so it simply hangs out of both ends.
    ///
    /// That is not hypothetical: the CanvasScaler matches on HEIGHT against a
    /// 1080x1920 reference, so a taller display makes the canvas NARROWER in
    /// reference units — 864 units at 20:9 against 1080 at 9:16. Labels wrap to
    /// more lines, the vertical stack above the combat area grows, the combat
    /// area is squeezed, and the 500px creature inside it hung up to 68px off
    /// the bottom of the screen on the four tallest shapes in the matrix.
    ///
    /// The aspect ratio is preserved and the scale only ever goes DOWN, so this
    /// cannot stretch anything. Pixel art shrunk by a fractional factor is
    /// softer than the authored art — that is the accepted cost, and it is the
    /// same cost the fractional canvas scale already imposes everywhere except
    /// the two 1920-high shapes.
    /// </summary>
    // Deliberately NOT [ExecuteAlways]: this writes localScale, which is a
    // serialized value, so running in the editor bakes a scale into whatever
    // scene or prefab is open at the time. An earlier revision of this file did
    // exactly that and left a 480 in a 500-unit prefab.
    [RequireComponent(typeof(RectTransform))]
    public sealed class ClampToParent : MonoBehaviour
    {
        RectTransform _rect;
        Vector2 _authored;

        void Awake()
        {
            _rect = (RectTransform)transform;
            _authored = _rect.sizeDelta;
        }

        void OnEnable()
        {
            if (_rect == null) Awake();
            Clamp();
        }

        void OnRectTransformDimensionsChange() => Clamp();

        /// <summary>
        /// The parent can change size without this rect changing — this rect is
        /// fixed, which is the whole problem — so the callback above never
        /// fires on the frame that matters. One rect comparison per frame.
        /// </summary>
        void Update() => Clamp();

        void Clamp()
        {
            if (_rect == null) return;
            if (transform.parent is not RectTransform parent) return;

            var room = parent.rect.size;
            if (room.x <= 0f || room.y <= 0f) return;
            if (_authored.x <= 0f || _authored.y <= 0f) return;

            // localScale, NOT sizeDelta. Resizing this rect leaves every child
            // at its own authored size, so a 500px sprite inside a 420px view
            // is still 500px and still hanging out of the frame — shrinking the
            // root moved the problem down one level rather than solving it.
            // Scale carries the whole subtree.
            float scale = Mathf.Min(1f, room.x / _authored.x, room.y / _authored.y);
            if (!Mathf.Approximately(transform.localScale.x, scale))
                transform.localScale = new Vector3(scale, scale, 1f);
        }
    }
}
