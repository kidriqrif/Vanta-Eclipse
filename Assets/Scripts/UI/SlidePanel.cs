using System.Collections;
using UnityEngine;
using VantaEclipse.Core;

namespace VantaEclipse.UI
{
    /// <summary>
    /// A panel that slides up over the bottom of the screen it lives in, so the
    /// screen underneath stays visible and — on the gameplay screen — stays
    /// tappable.
    ///
    /// Three panels use this shape and each carried its own copy of the four
    /// offsets, the animation, and the open/close/toggle triple: the
    /// upgrade shop, the Forge, and the Relic Collection. They agreed on every
    /// number, which is the tell that it was one behaviour written three times
    /// rather than three behaviours that happen to look alike.
    ///
    /// The offsets are measured from the parent's BOTTOM edge in Unity's Y-up
    /// convention: 0/1010 open and -1050/-40 closed.
    /// </summary>
    public abstract class SlidePanel : UIScreen
    {
        public const float OpenTop = 1010f;
        public const float OpenBottom = 0f;
        public const float ClosedTop = -40f;
        public const float ClosedBottom = -1050f;
        public const float SlideTime = 0.28f;

        public bool IsOpen { get; private set; }

        /// <summary>The name of the panel's own dismiss button. Each panel
        /// carries a differently-named one, which is why this is not just
        /// "CloseButton".</summary>
        protected abstract string CloseButtonName { get; }

        /// <summary>
        /// Whether opening this panel announces a blocking overlay. Only the
        /// gameplay upgrade shop does: a boss gate can fire while it is open, so
        /// managers need to know to hold the moment. The Gear panels live on a
        /// screen where no gate can occur, so announcing there would suppress
        /// nothing and mis-report the state.
        /// </summary>
        protected virtual bool AnnouncesOverlay => false;

        RectTransform _rect;
        Coroutine _slide;

        protected override void Awake()
        {
            base.Awake();
            _rect = (RectTransform)transform;
            // Anchor both edges to the parent's bottom so the offsets mean what
            // they say regardless of screen height.
            _rect.anchorMin = new Vector2(0f, 0f);
            _rect.anchorMax = new Vector2(1f, 0f);
        }

        protected virtual void Start()
        {
            SetEdges(ClosedTop, ClosedBottom);
            Bind(CloseButtonName, Close);
            OnFirstShow();
            gameObject.SetActive(false);
        }

        /// <summary>Build whatever the panel shows once, at load. Runs while the
        /// object is still active — a coroutine or a layout pass started from a
        /// disabled object does not run.</summary>
        protected virtual void OnFirstShow() { }

        /// <summary>Refresh contents each time the panel is opened.</summary>
        protected virtual void OnOpening() { }

        public void Toggle()
        {
            if (IsOpen) Close();
            else Open();
        }

        public void Open()
        {
            if (IsOpen) return;
            IsOpen = true;
            gameObject.SetActive(true);
            OnOpening();
            if (AnnouncesOverlay) Game.Events.RaiseUiOverlayOpened();
            AnimateTo(OpenTop, OpenBottom, hideWhenDone: false);
        }

        public void Close()
        {
            if (!IsOpen) return;
            IsOpen = false;
            if (AnnouncesOverlay) Game.Events.RaiseUiOverlayClosed();
            AnimateTo(ClosedTop, ClosedBottom, hideWhenDone: true);
        }

        void AnimateTo(float targetTop, float targetBottom, bool hideWhenDone)
        {
            if (_slide != null) StopCoroutine(_slide);
            // StartCoroutine on a disabled object throws rather than no-opping,
            // so a panel closed before it was ever shown settles directly.
            if (!gameObject.activeInHierarchy)
            {
                SetEdges(targetTop, targetBottom);
                return;
            }
            _slide = StartCoroutine(Slide(targetTop, targetBottom, hideWhenDone));
        }

        IEnumerator Slide(float targetTop, float targetBottom, bool hideWhenDone)
        {
            float startTop = _rect.offsetMax.y;
            float startBottom = _rect.offsetMin.y;
            float elapsed = 0f;

            while (elapsed < SlideTime)
            {
                // Unscaled: the shop opens over live combat and the player is
                // still tapping, so this must not be affected by any timescale
                // change a future pause introduces.
                elapsed += Time.unscaledDeltaTime;
                float t = CubicOut(Mathf.Clamp01(elapsed / SlideTime));
                SetEdges(Mathf.Lerp(startTop, targetTop, t),
                         Mathf.Lerp(startBottom, targetBottom, t));
                yield return null;
            }
            SetEdges(targetTop, targetBottom);
            _slide = null;
            if (hideWhenDone) gameObject.SetActive(false);
        }

        void SetEdges(float top, float bottom)
        {
            _rect.offsetMax = new Vector2(_rect.offsetMax.x, top);
            _rect.offsetMin = new Vector2(_rect.offsetMin.x, bottom);
        }

        /// <summary>A Cubic ease-out.</summary>
        static float CubicOut(float t)
        {
            float inv = 1f - t;
            return 1f - inv * inv * inv;
        }
    }
}
