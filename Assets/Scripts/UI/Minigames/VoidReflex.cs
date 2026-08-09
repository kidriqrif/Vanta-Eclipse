// Ported from scripts/minigames/void_reflex.gd
using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Void Reflex — the reference minigame that proves the framework contract.
    ///
    /// Five rounds. Each round the sigil waits a random 0.8–2.2s, then flares;
    /// the player taps. Tapping after the flare scores by reaction time, tapping
    /// before it misses that round. Win at 3+ hits. Nothing ends the run early
    /// and a loss still pays, so the game is a pleasant 15 seconds either way.
    /// </summary>
    public sealed class VoidReflex : Minigame
    {
        public const int Rounds = 5;
        public const int WinHits = 3;
        public const float WaitMin = 0.8f;
        public const float WaitMax = 2.2f;
        /// <summary>Reaction scoring window: ≤250ms scores 1.0, ≥900ms scores
        /// 0.0.</summary>
        public const float ReactionBest = 0.25f;
        public const float ReactionWorst = 0.9f;
        /// <summary>A flare that is never tapped auto-misses, so an interrupted
        /// run always ends instead of waiting forever for a tap that is not
        /// coming.</summary>
        public const float FlareWindow = 2.5f;
        public const float RoundGap = 0.45f;
        public const float FlareTween = 0.15f;

        int _round;
        int _hits;
        float _scoreSum;
        float _reactionSum;
        bool _flared;
        float _flaredAt;
        bool _roundOpen;

        Text _roundLabel;
        Button _sigilButton;
        RectTransform _sigilIcon;
        Image _sigilImage;
        GameObject _sigilRing;
        Text _stateLabel;
        Text _resultLabel;

        void Start()
        {
            _roundLabel = Find<Text>("RoundLabel");
            _sigilButton = Find<Button>("SigilButton");
            var icon = FindObject("SigilIcon");
            _sigilIcon = icon != null ? icon.transform as RectTransform : null;
            _sigilImage = icon != null ? icon.GetComponent<Image>() : null;
            _sigilRing = FindObject("SigilRing");
            _stateLabel = Find<Text>("StateLabel");
            _resultLabel = Find<Text>("ResultLabel");

            // Unity's Button fires on release. Billing a slow finger-lift as
            // reaction time would penalise players with motor impairments for no
            // design reason, so the press is taken directly instead.
            if (_sigilButton != null)
            {
                var surface = _sigilButton.GetComponent<TapSurface>()
                              ?? _sigilButton.gameObject.AddComponent<TapSurface>();
                surface.Tapped += _ => OnSigilPressed();
            }

            StyleRing();
            Run(PlayRounds());
        }

        void StyleRing()
        {
            if (_sigilRing == null) return;
            var image = _sigilRing.GetComponent<Image>() ?? _sigilRing.AddComponent<Image>();
            image.color = VantaTheme.Ink;
            image.raycastTarget = false;
            _sigilRing.SetActive(false);
        }

        // --- Round flow -----------------------------------------------------------

        IEnumerator PlayRounds()
        {
            for (_round = 1; _round <= Rounds; _round++)
            {
                _flared = false;
                _roundOpen = true;
                if (_roundLabel != null) _roundLabel.text = $"Round {_round} of {Rounds}";
                SetResting();

                float wait = Random.Range(WaitMin, WaitMax);
                float elapsed = 0f;
                while (elapsed < wait && _roundOpen)
                {
                    elapsed += Time.unscaledDeltaTime;
                    yield return null;
                }
                if (!_roundOpen) { yield return Gap(); continue; }

                yield return Flare();
                yield return Gap();
            }
            EndRun();
        }

        IEnumerator Gap()
        {
            _flared = false;
            SetResting();
            yield return new WaitForSecondsRealtime(RoundGap);
        }

        IEnumerator Flare()
        {
            _flared = true;
            _flaredAt = Time.unscaledTime;
            if (_sigilImage != null) _sigilImage.color = VantaTheme.Ink;
            if (_sigilRing != null) _sigilRing.SetActive(true);
            SetState("TAP!", VantaTheme.Ink);

            // Pop to 1.25 with Godot's TRANS_BACK/EASE_OUT, then hold open for
            // the rest of the window.
            float elapsed = 0f;
            while (elapsed < FlareTween && _flared)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / FlareTween);
                float inv = t - 1f;
                float eased = 1f + 2.70158f * inv * inv * inv + 1.70158f * inv * inv;
                if (_sigilIcon != null)
                    _sigilIcon.localScale = Vector3.one * Mathf.LerpUnclamped(1f, 1.25f, eased);
                yield return null;
            }

            float window = FlareTween;
            while (window < FlareWindow && _flared)
            {
                window += Time.unscaledDeltaTime;
                yield return null;
            }

            // The flare timed out unanswered — score the round a miss.
            if (_flared) SetResult("Missed", VantaTheme.Muted);
            _flared = false;
        }

        /// <summary>At rest the sigil is small, dim, ringless, and says WAIT. The
        /// flare differs by SIZE, SHAPE (the ring) and WORD, so the state is
        /// fully readable with no colour at all (UX §7).</summary>
        void SetResting()
        {
            if (_sigilImage != null)
                _sigilImage.color = VantaTheme.Fade(VantaTheme.Ivory, 0.45f);
            if (_sigilIcon != null) _sigilIcon.localScale = Vector3.one;
            if (_sigilRing != null) _sigilRing.SetActive(false);
            SetState("WAIT", VantaTheme.Muted);
        }

        void OnSigilPressed()
        {
            if (!_roundOpen) return;   // between rounds — ignore stray taps

            if (!_flared)
            {
                // Jumped the gun: this round is a miss, but the run continues.
                _roundOpen = false;
                SetResult("Too early!", VantaTheme.Muted);
                return;
            }

            float reaction = Time.unscaledTime - _flaredAt;
            _hits++;
            _reactionSum += reaction;
            _scoreSum += NormalizeReaction(reaction);
            SetResult($"{(int)(reaction * 1000f)} ms", VantaTheme.Ink);
            // Ends the flare loop, which falls through to the gap.
            _flared = false;
            _roundOpen = false;
        }

        static float NormalizeReaction(float reaction)
            => Mathf.Clamp01((ReactionWorst - reaction) / (ReactionWorst - ReactionBest));

        void SetState(string text, Color color)
        {
            if (_stateLabel == null) return;
            _stateLabel.text = text;
            _stateLabel.color = color;
        }

        void SetResult(string text, Color color)
        {
            if (_resultLabel == null) return;
            _resultLabel.text = text;
            _resultLabel.color = color;
        }

        // --- Reporting -------------------------------------------------------------

        void EndRun()
        {
            if (_sigilButton != null) _sigilButton.interactable = false;
            bool won = _hits >= WinHits;
            float performance = _hits > 0 ? _scoreSum / _hits : 0f;
            string detail = $"{_hits} of {Rounds}";
            if (_hits > 0)
                detail += $" · avg {(int)(_reactionSum / _hits * 1000f)}ms";

            SetState("COMPLETE", won ? VantaTheme.Ink : VantaTheme.Muted);
            Finish(won ? Outcome.WIN : Outcome.LOSS, performance, _hits, detail);
        }
    }
}
