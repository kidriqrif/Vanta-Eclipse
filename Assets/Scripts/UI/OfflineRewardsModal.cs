// Ported from scripts/ui/offline_rewards_modal.gd
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;
using VantaEclipse.Managers;

namespace VantaEclipse.UI
{
    /// <summary>
    /// The WELCOME BACK offline-rewards dialog (UX spec §3D/§3E).
    ///
    /// Pure presentation: the essence was already granted by IdleManager at
    /// eligibility time — COLLECT is acknowledgment, not a claim action.
    ///
    /// Usage (gameplay screen):
    ///   var modal = UIPrefabs.Spawn&lt;OfflineRewardsModal&gt;(transform);
    ///   modal.Setup(amount, secondsAway, wasCapped);
    /// </summary>
    public sealed class OfflineRewardsModal : CenteredModalDialog
    {
        /// <summary>The placement this modal offers. Data lives in the
        /// AdPlacementDefinition content folder.</summary>
        public const string OfferId = "offline_double";

        float _amount;
        int _secondsAway;
        bool _wasCapped;

        Text _amountLabel;
        Button _doubleButton;
        Text _doubleButtonLabel;

        /// <summary>Call before the first frame — Spawn returns the behaviour
        /// with Start still pending, so setting fields here is safe.</summary>
        public void Setup(float amount, int secondsAway, bool wasCapped)
        {
            _amount = amount;
            _secondsAway = secondsAway;
            _wasCapped = wasCapped;
        }

        protected override void Start()
        {
            base.Start();

            _amountLabel = Find<Text>("AmountLabel");
            SetText("DurationLabel", $"Away for {GameManager.FormatDurationRough(_secondsAway)}");

            int capHours = Mathf.RoundToInt(Game.Idle.GetOfflineCapSeconds() / 3600f);
            SetText("CapLabel", $"(offline earnings cap at {capHours}h)");
            // The cap line only appears when the cap actually reduced the reward
            // — and then always plainly, never as a silently shortened time (§6).
            SetVisible("CapLabel", _wasCapped);

            BindHoldToReveal("AmountLabel", SetExactShown);

            // The offer sits ABOVE COLLECT and is purely additive: the essence is
            // already granted and already stated, dismissal is still one tap, and
            // declining costs nothing (M14 §2).
            _doubleButton = Find<Button>("DoubleButton");
            if (_doubleButton != null)
            {
                bool available = _amount > 0f && Game.Shop.CanOffer(OfferId);
                _doubleButton.gameObject.SetActive(available);
                if (available)
                {
                    _doubleButtonLabel = _doubleButton.GetComponentInChildren<Text>(true);
                    SetDoubleButtonText(Game.Shop.AdsRemoved()
                        ? "CLAIM · DOUBLE IT" : "WATCH · DOUBLE IT");
                    _doubleButton.onClick.AddListener(OnDoublePressed);
                }
            }
        }

        void SetExactShown(bool exact)
        {
            if (_amountLabel == null) return;
            _amountLabel.text = exact
                ? $"+{NumberFormat.FormatExact(_amount)} Essence"
                : $"+{NumberFormat.Format(_amount)} Essence";
        }

        void SetDoubleButtonText(string value)
        {
            if (_doubleButtonLabel != null) _doubleButtonLabel.text = value;
        }

        // --- Opt-in doubler (M14) --------------------------------------------

        void OnDoublePressed()
        {
            if (Game.Shop.IsBusy()) return;
            _doubleButton.interactable = false;
            SetDoubleButtonText("WATCHING…");
            StartCoroutine(Game.Shop.RunOffer(OfferId, _amount, OnOfferResolved));
        }

        void OnOfferResolved(float bonus)
        {
            // COLLECT stays live throughout the watch (one-tap dismiss is
            // required), so this modal may already be gone when the offer
            // resolves. The coroutine dies with the object, but the callback is
            // held by MonetizationManager and can outlive it.
            if (this == null || _doubleButton == null) return;

            if (bonus <= 0f)
            {
                // Declined, no fill, or an error: the base reward is untouched,
                // so the modal simply drops the offer rather than reporting a
                // failure.
                _doubleButton.gameObject.SetActive(false);
                return;
            }

            _amount += bonus;
            Game.Settings.Vibrate(35);
            _doubleButton.gameObject.SetActive(false);
            SetExactShown(false);
        }
    }
}
