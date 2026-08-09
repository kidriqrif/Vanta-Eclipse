using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;
using VantaEclipse.Data;
using VantaEclipse.Managers;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Countdown Timer Bar (pattern library §7.1 of the M5 spec).
    ///
    /// Self-contained: shows itself on BossFightStarted, polls
    /// CombatManager.GetBossTimeRemaining() per frame, enters the urgency state
    /// in the final stretch, and hides after the fight resolves. The bar never
    /// owns the countdown — CombatManager does.
    /// </summary>
    public sealed class CountdownTimerBar : UIScreen
    {
        public const float UrgentSecondsCap = 10f;
        public const float HideDelay = 0.6f;
        public const float FadeSeconds = 0.25f;

        Slider _bar;
        Image _fill;
        CanvasGroup _group;
        Text _timeLabel;

        float _urgentThreshold = 10f;
        bool _running;
        bool _urgent;
        int _displayedSecond = -1;
        Coroutine _pulse;
        Coroutine _finish;

        void Start()
        {
            _bar = GetComponent<Slider>() ?? GetComponentInChildren<Slider>(true);
            _fill = _bar != null && _bar.fillRect != null
                ? _bar.fillRect.GetComponent<Image>() : null;
            _group = GetComponent<CanvasGroup>() ?? gameObject.AddComponent<CanvasGroup>();
            _timeLabel = Find<Text>("TimeLabel");

            gameObject.SetActive(false);
            Game.Events.BossFightStarted += OnBossFightStarted;
            Game.Events.BossFightWon += OnBossFightWon;
            Game.Events.BossFightFailed += OnBossFightFailed;
            SyncWithCombat();
        }

        void OnDestroy()
        {
            if (!Game.IsBooted) return;
            Game.Events.BossFightStarted -= OnBossFightStarted;
            Game.Events.BossFightWon -= OnBossFightWon;
            Game.Events.BossFightFailed -= OnBossFightFailed;
        }

        void Update()
        {
            if (!_running) return;

            float remaining = Game.Combat.GetBossTimeRemaining();
            if (_bar != null) _bar.value = remaining;

            // Only touch the label when the displayed second changes — the same
            // guard Gameplay's play-time readout uses, for the same reason.
            int second = Mathf.CeilToInt(remaining);
            if (second != _displayedSecond)
            {
                _displayedSecond = second;
                if (_timeLabel != null) _timeLabel.text = $"{second / 60}:{second % 60:00}";
            }

            if (!_urgent && remaining <= _urgentThreshold && remaining > 0f) EnterUrgency();
        }

        /// <summary>Re-render mid-fight state when the gameplay screen is
        /// (re)entered.</summary>
        public void SyncWithCombat()
        {
            if (Game.Combat.CurrentState == CombatManager.State.BOSS_FIGHT
                && Game.Combat.IsEnemyAlive())
                Begin(CombatManager.BossTimerDuration);
        }

        // --- Internals ---------------------------------------------------------

        void OnBossFightStarted(EnemyDefinition definition, int level, float maxHp, float duration)
            => Begin(duration);

        void Begin(float duration)
        {
            if (_bar != null)
            {
                _bar.maxValue = duration;
                _bar.value = Game.Combat.GetBossTimeRemaining();
            }
            _urgentThreshold = Mathf.Min(UrgentSecondsCap, duration / 3f);
            _urgent = false;
            _displayedSecond = -1;
            StopPulse();
            if (_finish != null) { StopCoroutine(_finish); _finish = null; }
            if (_fill != null) _fill.color = VantaTheme.Blood;

            _group.alpha = 0f;
            gameObject.SetActive(true);
            _running = true;
            StartCoroutine(FadeTo(1f, FadeSeconds));
        }

        void EnterUrgency()
        {
            _urgent = true;
            if (_fill != null) _fill.color = VantaTheme.Crimson;
            // Decorative pulse — the draining bar and the numerals carry the
            // urgency with this switched off (Enhanced tier).
            _pulse = StartCoroutine(Pulse());
        }

        IEnumerator Pulse()
        {
            while (true)
            {
                yield return FadeTo(0.75f, 0.3f);
                yield return FadeTo(1f, 0.3f);
            }
        }

        void OnBossFightWon(int level, float payout, bool isWorldBoss) => Finish();

        void OnBossFightFailed(int level)
        {
            // An expiry freezes at a true zero, never at "0:01".
            if (_bar != null) _bar.value = 0f;
            if (_timeLabel != null) _timeLabel.text = "0:00";
            Finish();
        }

        void Finish()
        {
            _running = false;
            StopPulse();
            if (!gameObject.activeInHierarchy) return;
            _finish = StartCoroutine(FinishAndHide());
        }

        IEnumerator FinishAndHide()
        {
            yield return new WaitForSecondsRealtime(HideDelay);
            yield return FadeTo(0f, FadeSeconds);
            gameObject.SetActive(false);
            _finish = null;
        }

        void StopPulse()
        {
            if (_pulse != null) { StopCoroutine(_pulse); _pulse = null; }
            _group.alpha = 1f;
        }

        IEnumerator FadeTo(float target, float seconds)
        {
            float from = _group.alpha;
            float elapsed = 0f;
            while (elapsed < seconds)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / seconds);
                // TRANS_SINE / EASE_IN_OUT for the pulse; a plain fade reads the
                // same over 0.25s, so one curve covers both uses.
                _group.alpha = Mathf.Lerp(from, target, 0.5f - 0.5f * Mathf.Cos(t * Mathf.PI));
                yield return null;
            }
            _group.alpha = target;
        }
    }
}
