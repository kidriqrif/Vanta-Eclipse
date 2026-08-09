using System.Collections.Generic;
using UnityEngine;
using VantaEclipse.Core;
using VantaEclipse.Data;

namespace VantaEclipse.Managers
{
    /// <summary>
    /// Owns all combat state and rules.
    ///
    /// A three-state machine (normal / boss fight / farm mode). A boss guards
    /// every 10th level; the fight is timed; failing drops to farming level-1
    /// below the gate with a free retry. Bosses flow through the same
    /// spawn/damage internals, so taps, auto-attack, crits, and every existing
    /// event work unmodified.
    ///
    /// The gameplay scene is only a window into this manager: it sends taps and
    /// the CHALLENGE BOSS request in, and renders the events that come out.
    /// Boss entry defers until the screen is unobstructed — overlays announce
    /// themselves on the EventBus and scene transitions are tracked from the
    /// existing events.
    /// </summary>
    public sealed class CombatManager : ISaveable
    {
        public enum State { NORMAL, BOSS_FIGHT, FARM_MODE }

        public const float RespawnDelay = 0.45f;
        /// <summary>One extra breath after a boss falls before the next enemy
        /// appears.</summary>
        public const float BossWinRespawnDelay = 1f;
        /// <summary>The withdraw micro-state's length (boss endures / farm
        /// enemy steps aside).</summary>
        public const float WithdrawDelay = 0.4f;

        // Baseline enemy health curve (docs/ARCHITECTURE.md Balancing).
        public const float EnemyBaseHp = 5f;
        public const float EnemyHpGrowth = 1.15f;
        public const float EssenceBaseReward = 2f;
        public const float EssenceRewardGrowth = 1.09f;

        // Boss tuning — locked by simulation (scratchpad boss_sim.py): 3x HP
        // keeps gates 10-40 beatable on arrival while the level-50 world boss
        // is a real ~6-minute wall that upgrades break.
        public const float BossHpMultiplier = 3f;
        public const float BossTimerDuration = 30f;
        public const float BossRewardMultiplier = 10f;
        /// <summary>The countdown only starts once the entrance settles — the
        /// entrance can only ever GIVE time, never cost it.</summary>
        public const float BossEntranceGrace = 1.1f;

        public State CurrentState = State.NORMAL;
        public int EnemyLevel = 1;
        public int TotalKills;
        public float EnemyHp;
        public float EnemyMaxHp;

        EnemyDefinition _currentDefinition;
        bool _alive;
        float _bossTimeRemaining;
        bool _bossTimerRunning;
        bool _bossEntryHeld;
        int _overlayCount;
        bool _gameplayCurrent;
        readonly Dictionary<string, List<EnemyDefinition>> _rosterCache = new();

        public string SaveKey => "combat";

        public CombatManager()
        {
            Game.Events.GameLoaded += OnGameLoaded;
            Game.Events.UiOverlayOpened += OnOverlayOpened;
            Game.Events.UiOverlayClosed += OnOverlayClosed;
            Game.Events.SceneTransitionStarted += OnSceneTransitionStarted;
            Game.Events.SceneTransitionFinished += OnSceneTransitionFinished;
        }

        /// <summary>Driven by GameRuntime on SCALED time, so a paused tree
        /// freezes the countdown — a notification can never drain the
        /// timer.</summary>
        public void Tick(float deltaTime)
        {
            if (CurrentState != State.BOSS_FIGHT || !_bossTimerRunning || !_alive) return;
            _bossTimeRemaining -= deltaTime;
            if (_bossTimeRemaining <= 0f) OnBossTimerExpired();
        }

        // --- Save contract -------------------------------------------------

        public Dictionary<string, object> GetSaveData() => new()
        {
            { "enemy_level", EnemyLevel },
            { "total_kills", TotalKills },
            // Mid-fight state is deliberately never saved: a killed app
            // re-enters the gate fresh.
            { "farm_mode", CurrentState == State.FARM_MODE },
        };

        public void LoadSaveData(Dictionary<string, object> data)
        {
            EnemyLevel = Mathf.Max(1, SaveRead.Int(data, "enemy_level", 1));
            TotalKills = Mathf.Max(0, SaveRead.Int(data, "total_kills"));
            CurrentState = SaveRead.Bool(data, "farm_mode") ? State.FARM_MODE : State.NORMAL;
        }

        // --- Public API ----------------------------------------------------

        public bool IsEnemyAlive() => _alive;
        public EnemyDefinition GetEnemyDefinition() => _currentDefinition;
        public float GetBossTimeRemaining() => Mathf.Max(0f, _bossTimeRemaining);

        /// <summary>The level whose enemies are actually being killed right
        /// now — used by IdleManager to price offline progression honestly at a
        /// boss wall.</summary>
        public int GetEffectiveKillLevel()
            => CurrentState == State.NORMAL ? EnemyLevel : Mathf.Max(1, EnemyLevel - 1);

        /// <summary>Essence for killing a normal enemy of this level, after the
        /// player's essence multiplier and the level's world multiplier. Always
        /// >= 1.</summary>
        public float GetEssenceReward(int level)
        {
            float reward = EssenceBaseReward * Mathf.Pow(EssenceRewardGrowth, level - 1);
            reward *= Game.Stats.GetEssenceGainMultiplier();
            reward *= Game.Worlds.GetEssenceMultiplierForLevel(level);
            return Mathf.Max(1f, Mathf.Round(reward));
        }

        public void PlayerTapAttack()
        {
            if (!_alive) return;
            var roll = Game.Stats.RollTapDamage();
            ApplyDamage(roll.Amount, roll.IsCrit);
        }

        /// <summary>Called by IdleManager's tick. Identical rules to a tap.</summary>
        public void AutoAttack()
        {
            if (!_alive) return;
            var roll = Game.Stats.RollTapDamage();
            ApplyDamage(roll.Amount, roll.IsCrit);
        }

        /// <summary>Average seconds one kill takes for an auto-attacker at
        /// current stats, against the baseline enemy of the given level
        /// (offline pricing).</summary>
        public float GetExpectedSecondsPerKill(int level, float attackInterval)
        {
            float hp = BaselineHp(level);
            float hits = hp / Mathf.Max(0.0001f, Game.Stats.GetAverageDamagePerHit());
            return hits * attackInterval + RespawnDelay;
        }

        /// <summary>Called by the UI after the World Unlock modal's ENTER: the
        /// new world's first enemy spawns only now.</summary>
        public void ResumeSpawning()
        {
            if (!_alive) DoRespawn();
        }

        /// <summary>Drop the run back to Dark Forest level 1 on an Eclipse and
        /// spawn a fresh enemy. TotalKills is a lifetime stat and is kept. Any
        /// boss fight in progress is voided cleanly. PrestigeManager only.</summary>
        public void ResetForPrestige()
        {
            _alive = false;
            _bossTimerRunning = false;
            _bossTimeRemaining = 0f;
            _bossEntryHeld = false;
            CurrentState = State.NORMAL;
            EnemyLevel = 1;
            SpawnEnemyAt(1);
        }

        /// <summary>Called by the UI when the CHALLENGE BOSS button is tapped.</summary>
        public void RequestBossChallenge()
        {
            if (CurrentState != State.FARM_MODE) return;
            CurrentState = State.BOSS_FIGHT;
            if (_alive)
            {
                _alive = false;
                Game.Events.RaiseEnemyWithdrawn();
                Scheduler.After(WithdrawDelay, RequestBossEntry);
            }
            else
            {
                RequestBossEntry();
            }
        }

        // --- Internals: flow -------------------------------------------------

        void OnGameLoaded(bool isNewGame)
        {
            // Grandfather rule: a save whose level outruns the unlock floor
            // silently raises it — progress is never taken away.
            Game.Worlds.RaiseUnlockedFloor(Game.Worlds.WorldIndexForLevel(EnemyLevel));

            if (Game.Worlds.IsGateLevel(EnemyLevel))
            {
                if (CurrentState == State.FARM_MODE) SpawnEnemyAt(GetEffectiveKillLevel());
                // Saved at the gate (or killed mid-attempt): fresh auto-enter.
                else RequestBossEntry();
            }
            else
            {
                CurrentState = State.NORMAL;
                SpawnEnemyAt(EnemyLevel);
            }
        }

        void ApplyDamage(float amount, bool isCrit)
        {
            // Boss-damage equipment affixes apply to boss hits only. The crit
            // roll happens in PlayerStats (no boss context there); the boss
            // multiplier is applied here, where the target's boss-ness is known.
            if (CurrentState == State.BOSS_FIGHT) amount *= Game.Stats.GetBossDamageMultiplier();

            EnemyHp = Mathf.Max(0f, EnemyHp - amount);
            Game.Events.RaiseEnemyDamaged(amount, isCrit, EnemyHp, EnemyMaxHp);
            if (EnemyHp <= 0f && _alive) OnEnemyKilled();
        }

        void OnEnemyKilled()
        {
            _alive = false;
            TotalKills += 1;
            Game.Events.RaiseEnemyDied(EnemyLevel, TotalKills);

            if (CurrentState == State.BOSS_FIGHT)
            {
                _bossTimerRunning = false;
                int gateLevel = EnemyLevel;
                float payout = GetEssenceReward(gateLevel) * BossRewardMultiplier;
                Game.Currency.Add(CurrencyManager.Essence, payout);
                Game.Events.RaiseEssenceEarned(payout, "boss");

                bool isWorldBoss = Game.Worlds.IsWorldBossGate(gateLevel);
                // Advance PAST the gate before announcing: WorldManager saves
                // at the kill, and that save must capture the post-win state so
                // a crash under the modal reloads into the new world, not the
                // gate.
                CurrentState = State.NORMAL;
                EnemyLevel += 1;
                Game.Events.RaiseBossFightWon(gateLevel, payout, isWorldBoss);

                // The new world's first enemy spawns on ENTER; gameplay calls
                // ResumeSpawning() on acknowledgment.
                if (isWorldBoss && Game.Worlds.HasPendingUnlockCelebration()) return;

                ScheduleRespawn(BossWinRespawnDelay);
                return;
            }

            float reward = GetEssenceReward(
                CurrentState == State.NORMAL ? EnemyLevel : GetEffectiveKillLevel());
            Game.Currency.Add(CurrencyManager.Essence, reward);
            Game.Events.RaiseEssenceEarned(reward, "combat");
            if (CurrentState == State.NORMAL) EnemyLevel += 1;
            ScheduleRespawn(RespawnDelay);
        }

        void ScheduleRespawn(float delay) => Scheduler.After(delay, DoRespawn);

        void DoRespawn()
        {
            if (_alive) return;
            switch (CurrentState)
            {
                case State.NORMAL:
                    if (Game.Worlds.IsGateLevel(EnemyLevel)) RequestBossEntry();
                    else SpawnEnemyAt(EnemyLevel);
                    break;
                case State.FARM_MODE:
                    SpawnEnemyAt(GetEffectiveKillLevel());
                    break;
                case State.BOSS_FIGHT:
                    break;  // the boss entry flow owns spawning in this state
            }
        }

        void RequestBossEntry()
        {
            CurrentState = State.BOSS_FIGHT;
            if (_overlayCount == 0 && _gameplayCurrent) EnterBossFight();
            // A countdown must never tick behind a scrim, an open shop, or a
            // scene that isn't the gameplay screen.
            else _bossEntryHeld = true;
        }

        void EnterBossFight()
        {
            string bossId = Game.Worlds.GetBossIdForGate(EnemyLevel);
            var definition = string.IsNullOrEmpty(bossId)
                ? null
                : DefinitionRegistry.Get<EnemyDefinition>(bossId);

            if (definition == null)
            {
                Debug.LogError($"CombatManager: missing boss for gate {EnemyLevel} — farming instead.");
                CurrentState = State.FARM_MODE;
                SpawnEnemyAt(GetEffectiveKillLevel());
                return;
            }

            _currentDefinition = definition;
            EnemyMaxHp = BaselineHp(EnemyLevel) * BossHpMultiplier * definition.hpMultiplier;
            EnemyHp = EnemyMaxHp;
            _alive = true;
            _bossTimeRemaining = BossTimerDuration;
            _bossTimerRunning = false;

            Game.Events.RaiseEnemySpawned(definition, EnemyLevel, EnemyMaxHp);
            Game.Events.RaiseBossFightStarted(definition, EnemyLevel, EnemyMaxHp, BossTimerDuration);
            Scheduler.After(BossEntranceGrace, OnEntranceSettled);
        }

        void OnEntranceSettled()
        {
            if (CurrentState == State.BOSS_FIGHT && _alive) _bossTimerRunning = true;
        }

        void OnBossTimerExpired()
        {
            _bossTimerRunning = false;
            _alive = false;
            CurrentState = State.FARM_MODE;
            Game.Events.RaiseBossFightFailed(EnemyLevel);
            Game.Events.RaiseEnemyWithdrawn();
            // Farm mode is persistent state — record it now.
            Game.Save.SaveGame();
            ScheduleRespawn(RespawnDelay);
        }

        void SpawnEnemyAt(int level)
        {
            var roster = GetRoster(level);
            if (roster.Count == 0)
            {
                Debug.LogError($"CombatManager: empty roster for level {level} — cannot spawn.");
                return;
            }
            _currentDefinition = roster[Random.Range(0, roster.Count)];
            EnemyMaxHp = BaselineHp(level) * _currentDefinition.hpMultiplier;
            EnemyHp = EnemyMaxHp;
            _alive = true;
            Game.Events.RaiseEnemySpawned(_currentDefinition, level, EnemyMaxHp);
        }

        static float BaselineHp(int level) => EnemyBaseHp * Mathf.Pow(EnemyHpGrowth, level - 1);

        List<EnemyDefinition> GetRoster(int level)
        {
            var world = Game.Worlds.GetWorldForLevel(level);
            if (_rosterCache.TryGetValue(world.id, out var cached)) return cached;

            var roster = new List<EnemyDefinition>();
            foreach (string enemyId in world.enemyDefinitionPaths)
            {
                var definition = DefinitionRegistry.Get<EnemyDefinition>(enemyId);
                if (definition == null)
                {
                    Debug.LogError($"CombatManager: could not load enemy definition: {enemyId}");
                    continue;
                }
                roster.Add(definition);
            }
            _rosterCache[world.id] = roster;
            return roster;
        }

        // --- Internals: obstruction tracking ---------------------------------

        void OnOverlayOpened() => _overlayCount += 1;

        void OnOverlayClosed()
        {
            _overlayCount = Mathf.Max(0, _overlayCount - 1);
            // Deferred: the modal queue may present its NEXT dialog during this
            // same emission chain — checking at end of frame sees the true final
            // overlay state, so a countdown can never start under a scrim.
            Scheduler.EndOfFrame(CheckHeldEntry);
        }

        void OnSceneTransitionStarted(string scenePath)
        {
            _gameplayCurrent = false;
            // Overlays die with their scene; the count rebuilds per-scene.
            _overlayCount = 0;
            if (CurrentState == State.BOSS_FIGHT && _alive)
            {
                // Leaving mid-fight voids the attempt silently; the gate
                // auto-enters fresh on return.
                _alive = false;
                _bossTimerRunning = false;
                _bossEntryHeld = true;
            }
        }

        void OnSceneTransitionFinished(string scenePath)
        {
            if (scenePath != Scenes.Gameplay) return;
            _gameplayCurrent = true;
            // Deferred: pending offline/unlock modals are enqueued later in this
            // same emission (IdleManager re-raise, gameplay handler runs after
            // this one). End-of-frame, their UiOverlayOpened has landed and the
            // held entry correctly stays held.
            Scheduler.EndOfFrame(CheckHeldEntry);
        }

        void CheckHeldEntry()
        {
            if (_bossEntryHeld && _overlayCount == 0 && _gameplayCurrent)
            {
                _bossEntryHeld = false;
                EnterBossFight();
            }
        }
    }
}
