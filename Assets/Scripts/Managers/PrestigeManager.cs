// Ported from scripts/managers/prestige_manager.gd
using System.Collections.Generic;
using UnityEngine;
using VantaEclipse.Core;
using VantaEclipse.Data;

namespace VantaEclipse.Managers
{
    /// <summary>
    /// Owns the Eclipse (prestige) loop. Built last.
    ///
    /// Tracks the run's peak level, computes the Void Crystal payout, and
    /// performs the Eclipse by resetting the run-scoped managers (essence,
    /// upgrades, world climb, combat, idle) in a fixed order while the RPG
    /// collection (equipment, relics, pets) and every Ascendant Power are kept.
    /// It is the sole orchestrator of the reset — no other manager calls
    /// upward.
    /// </summary>
    public sealed class PrestigeManager : ISaveable
    {
        /// <summary>Run peak that unlocks the Eclipse and anchors the reward
        /// curve (one world).</summary>
        public const int EclipseUnlockLevel = 50;

        // Reward curve, locked by scratchpad/prestige_sim.py:
        //   crystals = max(1, floor(BASE * (peak / GATE)^EXP * (1 + crystal_gain)))
        public const float BaseCrystals = 4f;
        public const float RewardGate = 50f;
        public const float RewardExp = 2.6f;

        public int PrestigeCount;

        /// <summary>Highest enemy level reached in the CURRENT run (the
        /// high-water mark — it does not fall when a boss wall knocks the
        /// player back to farming).</summary>
        public int RunPeakLevel = 1;

        /// <summary>Highest level ever reached across all runs (drives
        /// IsUnlocked / the button).</summary>
        public int LifetimePeakLevel = 1;

        /// <summary>Whether the one-time "the Eclipse awaits" banner has
        /// already been shown.</summary>
        bool _unlockAnnounced;

        public string SaveKey => "prestige";

        public PrestigeManager()
        {
            // Only GameLoaded here. EnemySpawned is subscribed later, inside
            // OnGameLoaded, so CombatManager's load-time spawn (which fires
            // earlier in the GameLoaded chain) is never seen as a live
            // crossing — the same no-celebration-on-load discipline
            // IdleManager uses for auto-attack.
            Game.Events.GameLoaded += OnGameLoaded;
        }

        // --- Save contract -------------------------------------------------

        public Dictionary<string, object> GetSaveData() => new()
        {
            { "prestige_count", PrestigeCount },
            { "run_peak_level", RunPeakLevel },
            { "lifetime_peak_level", LifetimePeakLevel },
            { "unlock_announced", _unlockAnnounced },
        };

        public void LoadSaveData(Dictionary<string, object> data)
        {
            PrestigeCount = Mathf.Max(0, SaveRead.Int(data, "prestige_count"));
            RunPeakLevel = Mathf.Max(1, SaveRead.Int(data, "run_peak_level", 1));
            LifetimePeakLevel = Mathf.Max(1, SaveRead.Int(data, "lifetime_peak_level", 1));
            _unlockAnnounced = SaveRead.Bool(data, "unlock_announced");
        }

        // --- Public reads --------------------------------------------------

        /// <summary>The Eclipse door is visible once the player has ever
        /// reached the gate.</summary>
        public bool IsUnlocked() => LifetimePeakLevel >= EclipseUnlockLevel;

        /// <summary>Whether the CURRENT run has climbed far enough to
        /// collapse.</summary>
        public bool CanEclipse() => RunPeakLevel >= EclipseUnlockLevel;

        /// <summary>Void Crystals the current run would pay right now (0 below
        /// the gate).</summary>
        public int CrystalReward()
        {
            if (RunPeakLevel < EclipseUnlockLevel) return 0;
            float raw = BaseCrystals * Mathf.Pow(RunPeakLevel / RewardGate, RewardExp);
            raw *= 1f + Game.Skills.GetStatAdditive("crystal_gain");
            return Mathf.Max(1, Mathf.FloorToInt(raw));
        }

        // --- The Eclipse ---------------------------------------------------

        /// <summary>Collapse the current run into the Eclipse. Returns the
        /// crystals granted, or 0 if the run has not reached the gate (the UI
        /// gates this too).</summary>
        public int PerformEclipse()
        {
            if (!CanEclipse()) return 0;
            int reward = CrystalReward();

            // 1. Pay out first, then reset the run economy in dependency order.
            Game.Currency.Add(CurrencyManager.VoidCrystals, reward);
            Game.Currency.ResetRunCurrency();
            Game.Upgrades.ResetForPrestige();
            Game.Worlds.ResetForPrestige();
            Game.Combat.ResetForPrestige();
            Game.Idle.ResetForPrestige();

            // 2. The new run starts at the freshly-spawned level.
            RunPeakLevel = Game.Combat.EnemyLevel;
            PrestigeCount += 1;

            // 3. Permanent the moment it happens — a force-kill can't replay
            //    or lose it.
            Game.Save.SaveGame();
            Game.Events.RaiseEclipsePerformed(reward, PrestigeCount);
            return reward;
        }

        // --- Internals -----------------------------------------------------

        void OnGameLoaded(bool isNewGame)
        {
            // Seed the peaks silently from the level the save loaded into
            // (CombatManager already spawned it earlier in this same GameLoaded
            // chain), so a returning run keeps its high-water mark without a
            // banner.
            NoteFrontier(silent: true);

            // A save already past the gate is grandfathered: the door shows
            // with no banner. The banner only ever plays on a live crossing
            // after this point.
            if (LifetimePeakLevel >= EclipseUnlockLevel) _unlockAnnounced = true;

            Game.Events.EnemySpawned += OnEnemySpawned;
        }

        void OnEnemySpawned(EnemyDefinition definition, int level, float maxHp)
            => NoteFrontier(silent: false);

        /// <summary>Raise the peaks to the current combat frontier (the level
        /// being fought, not the possibly-lower farm spawn). When silent, never
        /// announces the unlock.</summary>
        void NoteFrontier(bool silent)
        {
            int frontier = Game.Combat.EnemyLevel;
            RunPeakLevel = Mathf.Max(RunPeakLevel, frontier);
            LifetimePeakLevel = Mathf.Max(LifetimePeakLevel, frontier);
            if (silent) return;

            if (!_unlockAnnounced && LifetimePeakLevel >= EclipseUnlockLevel)
            {
                _unlockAnnounced = true;
                Game.Save.SaveGame();
                Game.Events.RaiseEclipseAvailable();
            }
        }
    }
}
