using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Centered Modal Dialog (Blocking) — the reusable half of the pattern in
    /// design/ux/milestone-4-idle-offline.md §7. A full-screen scrim swallows
    /// all input behind it; a centred card holds content and exactly ONE
    /// dismiss action, live from the first rendered frame.
    ///
    /// This class is the reusable artifact; each concrete dialog is its own
    /// prefab whose root uses (or extends) it and provides Scrim, Card, and
    /// ConfirmButton.
    /// </summary>
    public abstract class CenteredModalDialog : UIScreen
    {
        /// <summary>Raised when the player activates the dismiss action, before
        /// the exit animation plays.</summary>
        public event Action Confirmed;

        /// <summary>Raised once the scrim is truly gone and the object is about
        /// to be destroyed. Gameplay's modal queue advances on this.</summary>
        public event Action Closed;

        public const float ScrimFadeIn = 0.2f;
        public const float CardRiseIn = 0.25f;
        public const float ExitSeconds = 0.2f;

        bool _closing;

        protected CanvasGroup ScrimGroup { get; private set; }
        protected CanvasGroup CardGroup { get; private set; }
        protected RectTransform Card { get; private set; }

        protected override void Awake()
        {
            base.Awake();
            UILayers.Apply(gameObject, UILayers.Modal);
        }

        protected virtual void Start()
        {
            var scrim = FindObject("Scrim");
            var card = FindObject("Card");
            if (scrim == null || card == null)
            {
                Debug.LogError($"{GetType().Name}: modal needs both Scrim and Card.");
                Destroy(gameObject);
                return;
            }

            // The scrim is what makes this blocking: a full-bleed graphic that
            // takes every raycast, so nothing behind it can be tapped.
            var scrimImage = scrim.GetComponent<Image>() ?? scrim.AddComponent<Image>();
            scrimImage.raycastTarget = true;

            ScrimGroup = scrim.GetComponent<CanvasGroup>() ?? scrim.AddComponent<CanvasGroup>();
            CardGroup = card.GetComponent<CanvasGroup>() ?? card.AddComponent<CanvasGroup>();
            Card = card.transform as RectTransform;

            // Announce the blocking overlay so managers can defer moments that
            // need an unobstructed screen (M5 spec §4E). Closed is raised only
            // when the scrim is truly gone.
            Game.Events.RaiseUiOverlayOpened();

            // Wired before the entrance animation starts: the button is usable
            // immediately and the animation never gates the dismiss.
            Bind("ConfirmButton", OnConfirmPressed);

            StartCoroutine(PlayEntrance());
        }

        IEnumerator PlayEntrance()
        {
            ScrimGroup.alpha = 0f;
            CardGroup.alpha = 0f;
            Card.localScale = Vector3.one * 0.85f;

            float elapsed = 0f;
            while (elapsed < CardRiseIn)
            {
                elapsed += Time.unscaledDeltaTime;
                ScrimGroup.alpha = Mathf.Clamp01(elapsed / ScrimFadeIn);
                float t = Mathf.Clamp01(elapsed / CardRiseIn);
                CardGroup.alpha = t;
                Card.localScale = Vector3.one * Mathf.Lerp(0.85f, 1f, BackOut(t));
                yield return null;
            }
            ScrimGroup.alpha = 1f;
            CardGroup.alpha = 1f;
            Card.localScale = Vector3.one;
        }

        void OnConfirmPressed()
        {
            if (_closing) return;
            _closing = true;
            Confirmed?.Invoke();
            StartCoroutine(PlayExit());
        }

        IEnumerator PlayExit()
        {
            float startScale = Card.localScale.x;
            float elapsed = 0f;
            while (elapsed < ExitSeconds)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / ExitSeconds);
                CardGroup.alpha = 1f - t;
                ScrimGroup.alpha = 1f - t;
                Card.localScale = Vector3.one * Mathf.Lerp(startScale, 0.9f, t);
                yield return null;
            }

            Game.Events.RaiseUiOverlayClosed();
            // Raised before Destroy: a listener that advances a queue has to run
            // while this object is still valid.
            Closed?.Invoke();
            Destroy(gameObject);
        }

        /// <summary>A Back ease-out.</summary>
        protected static float BackOut(float t)
        {
            const float c1 = 1.70158f;
            const float c3 = c1 + 1f;
            float inv = t - 1f;
            return 1f + c3 * inv * inv * inv + c1 * inv * inv;
        }

        /// <summary>
        /// Hold-to-reveal on a label: press shows the exact figure, release goes
        /// back to the abbreviated one (the Enhanced tier's "Readable numbers").
        /// Both modals do this to their amount label, so the wiring lives here.
        /// </summary>
        protected void BindHoldToReveal(string labelName, Action<bool> onExactShown)
        {
            var label = Find<Text>(labelName);
            if (label == null) return;

            // A Text does not receive pointer events unless it is a raycast
            // target — it is one by default, but a converted label that had its
            // raycasting turned off would fail silently here.
            label.raycastTarget = true;

            var trigger = label.gameObject.GetComponent<PressHold>()
                          ?? label.gameObject.AddComponent<PressHold>();
            trigger.Held = onExactShown;
            onExactShown(false);
        }
    }
}
