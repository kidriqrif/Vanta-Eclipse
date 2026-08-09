// Ported from scripts/ui/auto_attack_toast.gd
using System.Collections;
using UnityEngine;

namespace VantaEclipse.UI
{
    /// <summary>
    /// One-shot Auto-Attack unlock celebration.
    ///
    /// Spawned by the gameplay screen on AutoAttackUnlocked, plays its
    /// choreography, and destroys itself — the DamageNumber idiom, so a scene
    /// change mid-animation can never orphan the animation.
    ///
    /// Sorting registry: scene UI = 0, toast = 50, modal = 60, scene fade =
    /// 32000. Fully non-blocking: nothing here raycasts, so taps land on the
    /// combat area beneath from frame one.
    /// </summary>
    public sealed class AutoAttackToast : UIScreen
    {
        public const float PopSeconds = 0.3f;
        public const float HoldSeconds = 1.4f;
        public const float FadeSeconds = 0.3f;
        /// <summary>TRANS_BACK in Godot overshoots by about this much — the
        /// spec's pop-in.</summary>
        public const float Overshoot = 1.05f;

        protected override void Awake()
        {
            base.Awake();
            UILayers.Apply(gameObject, UILayers.Toast);
        }

        void Start()
        {
            var panel = FindObject("ToastPanel");
            if (panel == null)
            {
                Destroy(gameObject);
                return;
            }

            var group = panel.GetComponent<CanvasGroup>() ?? panel.AddComponent<CanvasGroup>();
            // Nothing in a toast is interactive; taps must reach the combat
            // area underneath.
            group.blocksRaycasts = false;
            group.interactable = false;

            StartCoroutine(Play(panel.transform as RectTransform, group));
        }

        IEnumerator Play(RectTransform rect, CanvasGroup group)
        {
            rect.localScale = Vector3.zero;
            group.alpha = 0f;

            // Pop in with an overshoot, fading up in parallel.
            float elapsed = 0f;
            while (elapsed < PopSeconds)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / PopSeconds);
                float eased = BackOut(t);
                rect.localScale = Vector3.one * eased;
                group.alpha = t;
                yield return null;
            }
            rect.localScale = Vector3.one;
            group.alpha = 1f;

            yield return new WaitForSecondsRealtime(HoldSeconds);

            elapsed = 0f;
            while (elapsed < FadeSeconds)
            {
                elapsed += Time.unscaledDeltaTime;
                group.alpha = 1f - Mathf.Clamp01(elapsed / FadeSeconds);
                yield return null;
            }

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
    }
}
