// Ported from scripts/ui/result_banner.gd
using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Transient Result Banner (pattern library §7.2) — a repeatable,
    /// parameterized, non-blocking two-second flourish: icon, headline, one line
    /// of body. Pops in, holds, fades out, destroys itself.
    ///
    /// Non-blocking by construction — it never takes input, so the combat area
    /// underneath stays tappable for its whole life. Gameplay owns a depth-3
    /// queue so banners never stack on layer 50, which is why the animation
    /// starts on an explicit <see cref="Play"/> rather than on Start: a banner
    /// waiting its turn has already been built and must sit still until the one
    /// ahead of it has left.
    /// </summary>
    public sealed class ResultBanner : UIScreen
    {
        public const float PopSeconds = 0.3f;
        public const float HoldSeconds = 1.6f;
        public const float FadeSeconds = 0.3f;

        /// <summary>Win and loss are told apart by the panel's border colour. An
        /// 18px blurred halo behind it was the old style's way of saying "this
        /// one matters".</summary>
        public static readonly Color WinBorder = new(1f, 0.227f, 0.275f, 0.9f);
        public static readonly Color NeutralBorder = new(0.173f, 0.173f, 0.235f, 0.8f);
        public static readonly Color WinHeadlineOutline = new(0.69f, 0.071f, 0.157f, 0.55f);

        /// <summary>Raised when the banner has left the screen. Gameplay's queue
        /// advances on this — the Unity equivalent of Godot's tree_exited, which
        /// fired for the same purpose.</summary>
        public event Action Finished;

        Sprite _icon;
        string _headline = "";
        string _body = "";
        bool _isWin = true;
        bool _played;

        CanvasGroup _group;
        RectTransform _panel;

        protected override void Awake()
        {
            base.Awake();
            UILayers.Apply(gameObject, UILayers.Toast);

            // Never blocks: the player must be able to keep tapping through a
            // celebration.
            var group = GetComponent<CanvasGroup>() ?? gameObject.AddComponent<CanvasGroup>();
            group.blocksRaycasts = false;
            group.interactable = false;
        }

        public void Setup(Sprite icon, string headline, string body, bool isWin)
        {
            _icon = icon;
            _headline = headline;
            _body = body;
            _isWin = isWin;
        }

        /// <summary>Park this banner until its turn comes. A queued banner is
        /// left inactive rather than merely transparent, so its coroutines and
        /// layout cost nothing while it waits.</summary>
        public void HoldUnshown() => gameObject.SetActive(false);

        /// <summary>Render the content and start the animation.</summary>
        public void Play()
        {
            if (_played) return;
            _played = true;
            gameObject.SetActive(true);

            var panel = FindObject("BannerPanel");
            if (panel == null)
            {
                Debug.LogError("ResultBanner: no BannerPanel.");
                Finished?.Invoke();
                Destroy(gameObject);
                return;
            }
            _panel = (RectTransform)panel.transform;
            _group = panel.GetComponent<CanvasGroup>() ?? panel.AddComponent<CanvasGroup>();

            // The frame's border is its outermost Image; the CelebrationToast
            // style gives it one, and this recolours it per outcome.
            var border = panel.GetComponent<Image>();
            if (border != null) border.color = _isWin ? WinBorder : NeutralBorder;

            var headline = Find<Text>("BannerHeadline");
            if (headline != null)
            {
                headline.text = _headline;
                // Both outcomes read in the brightest ink — failure copy
                // redirects, it never scolds (UX spec §3C), so the headline is
                // never dimmed. The win is marked by an outline and by the
                // border, and the icon and the words carry the meaning either
                // way: colour is the redundant channel, never the only one.
                headline.color = VantaTheme.Ivory;
                var outline = headline.GetComponent<Outline>();
                if (_isWin)
                {
                    outline ??= headline.gameObject.AddComponent<Outline>();
                    outline.effectColor = WinHeadlineOutline;
                    outline.effectDistance = new Vector2(6f, -6f);
                }
                else if (outline != null)
                {
                    outline.enabled = false;
                }
            }

            SetText("BannerBody", _body);

            var image = Find<Image>("BannerIcon");
            if (image != null && _icon != null)
            {
                image.sprite = _icon;
                image.enabled = true;
                image.color = Color.white;
            }

            StartCoroutine(Choreography());
        }

        IEnumerator Choreography()
        {
            _panel.localScale = Vector3.zero;
            _group.alpha = 0f;

            float elapsed = 0f;
            while (elapsed < PopSeconds)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / PopSeconds);
                _panel.localScale = Vector3.one * BackOut(t);
                _group.alpha = t;
                yield return null;
            }
            _panel.localScale = Vector3.one;
            _group.alpha = 1f;

            yield return new WaitForSecondsRealtime(HoldSeconds);

            elapsed = 0f;
            while (elapsed < FadeSeconds)
            {
                elapsed += Time.unscaledDeltaTime;
                _group.alpha = 1f - Mathf.Clamp01(elapsed / FadeSeconds);
                yield return null;
            }

            // Raised before Destroy: a listener that advances a queue has to run
            // while this object is still valid.
            Finished?.Invoke();
            Destroy(gameObject);
        }

        /// <summary>Godot's TRANS_BACK/EASE_OUT: overshoots the target and
        /// settles back.</summary>
        static float BackOut(float t)
        {
            const float c1 = 1.70158f;
            const float c3 = c1 + 1f;
            float inv = t - 1f;
            return 1f + c3 * inv * inv * inv + c1 * inv * inv;
        }

        /// <summary>Destroy a banner that was built but never shown. Gameplay's
        /// queue drops overflow, and in Godot those were orphan nodes that leaked
        /// for the process lifetime unless freed explicitly — the same hazard
        /// exists here for a parked, inactive object nothing else
        /// references.</summary>
        public void DiscardUnshown() => Destroy(gameObject);
    }
}
