// Ported from scripts/ui/damage_number.gd
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;

namespace VantaEclipse.UI
{
    /// <summary>
    /// One floating damage number. Spawned on every hit, pops in, drifts
    /// upward, fades out, and destroys itself — nothing tracks it, so a scene
    /// change mid-flight cannot orphan an animation.
    ///
    /// TODO(post-release): pool these instead of spawn/destroy IF profiling on a
    /// real device shows pressure at very high attack speeds. Measured, not
    /// assumed — the M15 pass found this cost negligible by inspection.
    /// </summary>
    public sealed class DamageNumber : MonoBehaviour
    {
        /// <summary>The layout's own size. A crit doubles it — size is the
        /// redundant channel, because colour alone fails for the ~8% of players
        /// with a red/green deficiency and the crit colour is the accent.</summary>
        public const int NormalFontSize = 27;
        public const int CritFontSize = 54;

        public const float PopUpSeconds = 0.11f;
        public const float PopSettleSeconds = 0.08f;
        public const float PopScale = 1.15f;
        public const float DriftSeconds = 0.75f;
        public const float DriftRise = 130f;
        public const float DriftSpread = 42f;
        public const float FadeDelay = 0.35f;
        public const float FadeSeconds = 0.4f;

        Text _text;
        CanvasGroup _group;

        /// <summary>Call immediately after spawning, before the first frame.</summary>
        public void Setup(float amount, bool isCrit)
        {
            _text = GetComponent<Text>() ?? gameObject.AddComponent<Text>();
            _text.font = Fonts.Body;
            _text.alignment = TextAnchor.MiddleCenter;
            _text.horizontalOverflow = HorizontalWrapMode.Overflow;
            _text.verticalOverflow = VerticalWrapMode.Overflow;
            _text.raycastTarget = false;
            _text.text = NumberFormat.Format(amount);

            if (isCrit)
            {
                _text.fontSize = VantaTheme.SnapFontSize(CritFontSize);
                _text.color = VantaTheme.Crimson;
                // The dark outline is what keeps a crimson number legible when it
                // rises over a lit sprite rather than over the void backdrop.
                var outline = GetComponent<Outline>() ?? gameObject.AddComponent<Outline>();
                outline.effectColor = VantaTheme.Void;
                outline.effectDistance = new Vector2(3f, -3f);
            }
            else
            {
                // The equipped cosmetic tints ordinary hits. Crits keep their own
                // colour: that one IS state (it reads "this hit was special"),
                // and a cosmetic must never overwrite a state signal.
                var cosmetic = Game.Shop?.GetEquippedCosmetic();
                _text.fontSize = VantaTheme.SnapFontSize(NormalFontSize);
                _text.color = cosmetic != null
                    ? VantaTheme.Fade(cosmetic.numberColor, 1f)
                    : VantaTheme.Ivory;
            }

            _group = GetComponent<CanvasGroup>() ?? gameObject.AddComponent<CanvasGroup>();
            _group.blocksRaycasts = false;
            _group.interactable = false;

            StartCoroutine(Pop());
            StartCoroutine(Drift());
        }

        IEnumerator Pop()
        {
            var rect = (RectTransform)transform;
            rect.localScale = Vector3.one * 0.4f;

            float elapsed = 0f;
            while (elapsed < PopUpSeconds)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / PopUpSeconds);
                rect.localScale = Vector3.one * Mathf.LerpUnclamped(0.4f, PopScale, BackOut(t));
                yield return null;
            }

            elapsed = 0f;
            while (elapsed < PopSettleSeconds)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / PopSettleSeconds);
                rect.localScale = Vector3.one * Mathf.Lerp(PopScale, 1f, t);
                yield return null;
            }
            rect.localScale = Vector3.one;
        }

        IEnumerator Drift()
        {
            var rect = (RectTransform)transform;
            // The drift is applied on top of whatever position the caller
            // assigned right after spawning, which is why it is captured here
            // rather than written absolutely.
            Vector2 start = rect.anchoredPosition;
            Vector2 drift = new(Random.Range(-DriftSpread, DriftSpread), DriftRise);

            float elapsed = 0f;
            while (elapsed < DriftSeconds)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / DriftSeconds);
                // TRANS_CUBIC / EASE_OUT.
                float inv = 1f - t;
                rect.anchoredPosition = start + drift * (1f - inv * inv * inv);
                // Hold opacity for the first 0.35s: a number that starts fading
                // immediately is unreadable at the exact moment it matters.
                _group.alpha = elapsed < FadeDelay
                    ? 1f
                    : 1f - Mathf.Clamp01((elapsed - FadeDelay) / FadeSeconds);
                yield return null;
            }
            Destroy(gameObject);
        }

        /// <summary>Godot's TRANS_BACK/EASE_OUT.</summary>
        static float BackOut(float t)
        {
            const float c1 = 1.70158f;
            const float c3 = c1 + 1f;
            float inv = t - 1f;
            return 1f + c3 * inv * inv * inv + c1 * inv * inv;
        }
    }
}
