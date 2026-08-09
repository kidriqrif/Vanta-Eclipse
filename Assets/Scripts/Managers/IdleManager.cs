using System;
using System.Collections.Generic;
using UnityEngine;
using VantaEclipse.Core;
using VantaEclipse.Data;

namespace VantaEclipse.Managers
{
    /// <summary>
    /// Auto-attack unlock/ticking and offline progression.
    ///
    /// Owns, per design/ux/milestone-4-idle-offline.md §4D: the persisted
    /// autoAttackUnlocked flag (its own "idle" save section), the attack tick,
    /// offline-reward eligibility, the pending-popup state, and the app-resume
    /// hook. It never touches scenes — UI listens to the EventBus and pulls
    /// pending state from here.
    /// </summary>
    public sealed class IdleManager : ISaveable
    {
        public const int AutoAttackUnlockLevel = 15;
        public const float AutoAttackInterval = 1f;

        /// <summary>Away periods shorter than this never trigger the offline
        /// flow — it exists to swallow rapid app-switching.</summary>
        public const int MinOfflineSeconds = 60;

        /// <summary>Longest away period that earns essence. Stated plainly in
        /// the popup whenever it actually reduced the reward. The Long Slumber
        /// power extends it — see GetOfflineCapSeconds().</summary>
        public const int OfflineCapSeconds = 8 * 3600;

        public sealed class OfflineReward
        {
            public float Amount;
            public int SecondsAway;
            public bool WasCapped;
        }

        public bool AutoAttackUnlocked;

        float _attackAccumulator;
        /// <summary>Granted-but-not-yet-presented offline reward.</summary>
        OfflineReward _pendingOfflineRewards;
        /// <summary>Guards the resume check, which some Android versions also
        /// fire during app startup, before the save has loaded.</summary>
        bool _coldLaunchCheckDone;

        public string SaveKey => "idle";

        public IdleManager()
        {
            Game.Events.GameLoaded += OnGameLoaded;
            Game.Events.SceneTransitionFinished += OnSceneTransitionFinished;
            // Deliberately NOT subscribing to EnemySpawned here — see
            // OnGameLoaded.
        }

        /// <summary>
        /// Driven by GameRuntime on SCALED time.
        ///
        /// Auto-attack is live gameplay, not an offline system: a future pause
        /// menu must genuinely stop it, and absence is compensated by offline
        /// pay instead. That is what the scaled clock buys.
        ///
        /// The accumulator re-reads the interval every tick rather than caching
        /// it. A timer object would have to be rewritten whenever Twin Fang or
        /// Swift Hunt changed the cadence, because it keeps its old period
        /// until something writes it — that is two extra event subscriptions
        /// and a live bug when either
        /// was missed. Reading the value at use removes the whole category.
        /// </summary>
        public void Tick(float deltaTime)
        {
            if (!AutoAttackUnlocked) return;
            _attackAccumulator += deltaTime;
            float interval = GetEffectiveAttackInterval();
            if (_attackAccumulator < interval) return;
            _attackAccumulator -= interval;
            if (Game.Combat.IsEnemyAlive()) Game.Combat.AutoAttack();
        }

        /// <summary>Android/iOS foreground-return. Never fires on desktop —
        /// there the game keeps running unfocused, so cold launch is the only
        /// offline path, by design.</summary>
        public void OnApplicationResumed()
        {
            if (_coldLaunchCheckDone) CheckOfflineRewards();
        }

        // --- Save contract -------------------------------------------------

        public Dictionary<string, object> GetSaveData()
            => new() { { "auto_attack_unlocked", AutoAttackUnlocked } };

        public void LoadSaveData(Dictionary<string, object> data)
            => AutoAttackUnlocked = SaveRead.Bool(data, "auto_attack_unlocked");

        // --- Public API ----------------------------------------------------

        public bool HasPendingOfflineRewards() => _pendingOfflineRewards != null;

        /// <summary>Hand the pending reward presentation to the UI exactly
        /// once. The essence itself was already granted at eligibility
        /// time.</summary>
        public OfflineReward ConsumePendingOfflineRewards()
        {
            var pending = _pendingOfflineRewards;
            _pendingOfflineRewards = null;
            return pending;
        }

        /// <summary>Effective seconds between auto-attacks after cadence
        /// bonuses. The single source both the live tick and the offline maths
        /// read, so a faster-auto-attack relic doubles offline earning exactly
        /// as it does live.</summary>
        public float GetEffectiveAttackInterval()
        {
            // Twin Fang (relic) and Swift Hunt (Ascendant Power) both quicken
            // the tick; they multiply.
            float speed = Game.Relics.GetAttackSpeedMult() * Game.Skills.GetAttackSpeedMult();
            return AutoAttackInterval / Mathf.Max(0.0001f, speed);
        }

        /// <summary>Away-time cap, extended by the Long Slumber power.</summary>
        public int GetOfflineCapSeconds()
        {
            int bonusHours = (int)Game.Skills.GetStatAdditive("offline_cap_hours");
            return OfflineCapSeconds + bonusHours * 3600;
        }

        /// <summary>Essence per second the auto-attacker earns at current
        /// stats, before the offline multiplier is applied. Rewards across the
        /// game are priced in SECONDS of this rate, so they never go stale as
        /// the player grows.</summary>
        public float GetLiveEssenceRate()
        {
            // Priced at the EFFECTIVE kill level: at a boss wall the
            // auto-attacker is really killing gate-1 enemies, and offline pay
            // must mirror that honestly. The interval is the effective one, so
            // Twin Fang's doubled cadence flows into offline pay.
            int level = Game.Combat.GetEffectiveKillLevel();
            float secondsPerKill = Game.Combat.GetExpectedSecondsPerKill(
                level, GetEffectiveAttackInterval());
            float essencePerKill = Game.Combat.GetEssenceReward(level);
            return essencePerKill / Mathf.Max(0.0001f, secondsPerKill);
        }

        /// <summary>Re-base auto-attack on an Eclipse: a new run re-earns the
        /// level-15 unlock, UNLESS the Eternal Reflex power keeps it on from the
        /// start. Pending offline state is dropped with the reset.
        /// PrestigeManager only.</summary>
        public void ResetForPrestige()
        {
            AutoAttackUnlocked = Game.Skills.HasFlag("auto_attack_start");
            _pendingOfflineRewards = null;
            _attackAccumulator = 0f;
        }

        // --- Internals -----------------------------------------------------

        void OnGameLoaded(bool isNewGame)
        {
            // A save already past the threshold unlocks silently — the
            // celebration only ever plays on a live crossing. This also
            // silently migrates saves with no "idle" section at all. Design
            // intent: a migrated save IS paid offline rewards for this very
            // launch — "your hero fought while you were away" is the update's
            // own welcome gift, and it can only happen once.
            if (!AutoAttackUnlocked && Game.Combat.EnemyLevel >= AutoAttackUnlockLevel)
                AutoAttackUnlocked = true;

            // Subscribed only now: CombatManager's load-time EnemySpawned fires
            // earlier in the GameLoaded chain, so the first spawn this handler
            // sees is a genuine live one. Reordering Game.Boot() or moving this
            // subscription silently breaks the no-celebration-on-load rule.
            Game.Events.EnemySpawned += OnEnemySpawned;

            if (!isNewGame) CheckOfflineRewards();
            _coldLaunchCheckDone = true;
        }

        void OnSceneTransitionFinished(string scenePath)
        {
            // Deferred-presentation path: a reward granted while no gameplay
            // screen was there to show it is re-announced the moment the
            // gameplay scene finishes fading in.
            if (scenePath == Scenes.Gameplay && HasPendingOfflineRewards())
                Game.Events.RaiseOfflineRewardsReady(
                    _pendingOfflineRewards.Amount,
                    _pendingOfflineRewards.SecondsAway,
                    _pendingOfflineRewards.WasCapped);
        }

        void OnEnemySpawned(EnemyDefinition definition, int level, float maxHp)
        {
            if (AutoAttackUnlocked || level < AutoAttackUnlockLevel) return;
            AutoAttackUnlocked = true;
            Game.Events.RaiseAutoAttackUnlocked();
            // Persist immediately so a crash can't replay the celebration.
            Game.Save.SaveGame();
        }

        void CheckOfflineRewards()
        {
            if (!AutoAttackUnlocked) return;
            long lastSave = Game.Save.LastSaveUnix;
            if (lastSave <= 0) return;

            // Wall-clock time (user-adjustable): clamp so a backwards-set clock
            // can never go negative. Clock-forward cheating is bounded by the
            // cap.
            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            int elapsed = (int)Math.Max(0, now - lastSave);
            if (elapsed < MinOfflineSeconds) return;

            int capSeconds = GetOfflineCapSeconds();
            bool wasCapped = elapsed > capSeconds;
            int rewardedSeconds = Mathf.Min(elapsed, capSeconds);
            float amount = Mathf.Floor(
                GetLiveEssenceRate() * rewardedSeconds * Game.Stats.GetOfflineMultiplier());
            if (amount < 1f) return;

            Game.Currency.Add(CurrencyManager.Essence, amount);
            Game.Events.RaiseEssenceEarned(amount, "offline");

            // Hand PetManager the same capped kill estimate (never re-derived,
            // never on the deferred re-raise) so offline pet XP stays
            // consistent.
            float secondsPerKill = Game.Combat.GetExpectedSecondsPerKill(
                Game.Combat.GetEffectiveKillLevel(), GetEffectiveAttackInterval());
            int kills = Mathf.FloorToInt(rewardedSeconds / Mathf.Max(0.0001f, secondsPerKill));
            if (kills > 0) Game.Events.RaiseOfflineKillsEstimated(kills);

            // Advance LastSaveUnix right away so a crash after the grant cannot
            // re-run the same eligibility window and double-grant.
            Game.Save.SaveGame();

            _pendingOfflineRewards = new OfflineReward
            {
                Amount = amount,
                SecondsAway = elapsed,
                WasCapped = wasCapped,
            };
            Game.Events.RaiseOfflineRewardsReady(amount, elapsed, wasCapped);
        }
    }
}
