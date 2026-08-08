// Ported from scripts/ui/damage_number.gd
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;

namespace VantaEclipse.UI
{
    /// <summary>
    /// A single floating damage figure. Spawned per hit, animates, and destroys
    /// itself — nothing tracks it, so a scene change mid-flight cannot orphan
    /// an animation.
    /// </summary>
    public sealed class DamageNumber : MonoBehaviour
    {
        public const float RiseDistance = 120f;
        public const float LifeSeconds = 0.8f;
        /// <summary>Crits are bigger as well as differently coloured. Size is
        /// the redundant channel: colour alone fails for the ~8% of players
        /// with a red/green deficiency, and the crit colour is the accent.</summary>
        public const float CritScale = 1.45f;

        Text _text;

        public void Setup(float amount, bool isCrit)
        {
            _text = GetComponent<Text>() ?? gameObject.AddComponent<Text>();
            _text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            _text.alignment = TextAnchor.MiddleCenter;
            _text.horizontalOverflow = HorizontalWrapMode.Overflow;
            _text.verticalOverflow = VerticalWrapMode.Overflow;
            _text.text = NumberFormat.Format(amount);

            var cosmetic = Game.Shop?.GetEquippedCosmetic();
            if (isCrit)
            {
                _text.color = VantaTheme.Crimson;
                _text.fontSize = VantaTheme.SnapFontSize(45);
            }
            else
            {
                // The cosmetic's number colour, when one is equipped — this is
                // half of what the shop's trail products actually sell.
                _text.color = cosmetic != null
                    ? new Color(cosmetic.numberColor.r, cosmetic.numberColor.g,
                                cosmetic.numberColor.b, 1f)
                    : VantaTheme.Ivory;
                _text.fontSize = VantaTheme.SnapFontSize(36);
            }
            transform.localScale = Vector3.one * (isCrit ? CritScale : 1f);

            StartCoroutine(Float());
        }

        IEnumerator Float()
        {
            var rect = (RectTransform)transform;
            Vector2 start = rect.anchoredPosition;
            float elapsed = 0f;

            while (elapsed < LifeSeconds)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / LifeSeconds);
                rect.anchoredPosition = start + new Vector2(0f, RiseDistance * t);
                // Hold opacity for the first third: a number that starts fading
                // immediately is unreadable at the exact moment it matters.
                var color = _text.color;
                color.a = t < 0.33f ? 1f : 1f - (t - 0.33f) / 0.67f;
                _text.color = color;
                yield return null;
            }
            Destroy(gameObject);
        }
    }
}
