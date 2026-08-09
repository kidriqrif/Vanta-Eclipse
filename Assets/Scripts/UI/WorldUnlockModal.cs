using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;
using VantaEclipse.Data;
using VantaEclipse.Managers;

namespace VantaEclipse.UI
{
    /// <summary>
    /// The World Unlock celebration (M5 UX spec §3D) — the game's biggest
    /// must-acknowledge moment. Pure ceremony: the unlock and payout were
    /// granted and saved at the kill. ENTER is acknowledgment.
    /// </summary>
    public sealed class WorldUnlockModal : CenteredModalDialog
    {
        public const float RevealDelay = 0.5f;
        public const float RevealSeconds = 0.3f;

        WorldDefinition _world;
        float _payout;
        Text _amountLabel;

        /// <summary>Call before the first frame.</summary>
        public void Setup(WorldDefinition world, float payout)
        {
            _world = world;
            _payout = payout;
        }

        protected override void Start()
        {
            base.Start();
            if (_world == null) return;

            SetText("WorldNameLabel", _world.displayName.ToUpperInvariant());
            SetText("LevelsLabel",
                $"Levels {_world.firstLevel} – {_world.firstLevel + WorldManager.LevelsPerWorld - 1}");
            // The world essence multiplier is deliberately NOT surfaced here —
            // the approved spec (§4C/§8) keeps it invisible until the future
            // world-select screen, its natural home.

            _amountLabel = Find<Text>("AmountLabel");
            BindHoldToReveal("AmountLabel", SetExactShown);

            var nameRow = FindObject("NameRow");
            if (nameRow != null) StartCoroutine(StageNameReveal(nameRow));
        }

        /// <summary>The name reveal is the headline act: it pops in ~0.5s after
        /// the card, and never gates ENTER (which is live from frame one, per
        /// the pattern contract).</summary>
        IEnumerator StageNameReveal(GameObject nameRow)
        {
            var group = nameRow.GetComponent<CanvasGroup>() ?? nameRow.AddComponent<CanvasGroup>();
            var rect = nameRow.transform as RectTransform;
            group.alpha = 0f;
            rect.localScale = Vector3.one * 0.6f;

            yield return new WaitForSecondsRealtime(RevealDelay);

            float elapsed = 0f;
            while (elapsed < RevealSeconds)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / RevealSeconds);
                // The fade is quicker than the scale on purpose: the
                // words arrive first and the pop settles under them.
                group.alpha = Mathf.Clamp01(elapsed / 0.12f);
                rect.localScale = Vector3.one * Mathf.Lerp(0.6f, 1f, BackOut(t));
                yield return null;
            }
            group.alpha = 1f;
            rect.localScale = Vector3.one;
        }

        void SetExactShown(bool exact)
        {
            if (_amountLabel == null) return;
            _amountLabel.text = exact
                ? $"+{NumberFormat.FormatExact(_payout)} Essence"
                : $"+{NumberFormat.Format(_payout)} Essence";
        }
    }
}
