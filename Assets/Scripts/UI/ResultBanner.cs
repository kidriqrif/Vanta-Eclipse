// Ported from scripts/ui/result_banner.gd
using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace VantaEclipse.UI
{
    /// <summary>
    /// A layer-50 transient: icon, headline, one line of body. Slides in,
    /// holds, slides out, destroys itself.
    ///
    /// Non-blocking by construction — it never takes input, so the combat area
    /// underneath stays tappable for its whole life. Gameplay queues these so
    /// they play back to back rather than stacking.
    /// </summary>
    public sealed class ResultBanner : MonoBehaviour
    {
        public const float SlideSeconds = 0.28f;
        public const float HoldSeconds = 1.6f;

        /// <summary>Raised when the banner has left the screen. Gameplay's
        /// queue advances on this — the Unity equivalent of Godot's
        /// tree_exited, which fired for the same purpose.</summary>
        public event Action Finished;

        Sprite _icon;
        string _headline = "";
        string _body = "";
        bool _positive = true;

        public void Setup(Sprite icon, string headline, string body, bool positive)
        {
            _icon = icon;
            _headline = headline;
            _body = body;
            _positive = positive;
        }

        void Start()
        {
            var group = GetComponent<CanvasGroup>() ?? gameObject.AddComponent<CanvasGroup>();
            // Never blocks: the player must be able to keep tapping through a
            // celebration.
            group.blocksRaycasts = false;
            group.interactable = false;

            var headline = transform.Find("Headline")?.GetComponent<Text>();
            if (headline != null)
            {
                headline.text = _headline;
                // Positive moments wear the accent; a setback wears muted text.
                // The icon and the words carry the meaning either way — colour
                // is the redundant channel, never the only one.
                headline.color = _positive ? VantaTheme.Crimson : VantaTheme.Ash;
            }

            var body = transform.Find("Body")?.GetComponent<Text>();
            if (body != null) body.text = _body;

            var image = transform.Find("Icon")?.GetComponent<Image>();
            if (image != null && _icon != null)
            {
                image.sprite = _icon;
                image.color = Color.white;
            }

            StartCoroutine(Play(group));
        }

        IEnumerator Play(CanvasGroup group)
        {
            yield return Fade(group, 0f, 1f, SlideSeconds);
            yield return new WaitForSecondsRealtime(HoldSeconds);
            yield return Fade(group, 1f, 0f, SlideSeconds);

            // Fire before Destroy: a listener that advances a queue must run
            // while this object is still valid.
            Finished?.Invoke();
            Destroy(gameObject);
        }

        static IEnumerator Fade(CanvasGroup group, float from, float to, float seconds)
        {
            float elapsed = 0f;
            group.alpha = from;
            while (elapsed < seconds)
            {
                elapsed += Time.unscaledDeltaTime;
                group.alpha = Mathf.Lerp(from, to, Mathf.Clamp01(elapsed / seconds));
                yield return null;
            }
            group.alpha = to;
        }

        /// <summary>Destroy a banner that was built but never shown. Gameplay's
        /// queue drops overflow, and in Godot those were orphan nodes that
        /// leaked for the process lifetime unless freed explicitly — the same
        /// hazard exists here for an instantiated-but-unparented object.</summary>
        public void DiscardUnshown() => Destroy(gameObject);
    }
}
