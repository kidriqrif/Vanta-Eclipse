// Ported from scripts/managers/world_manager.gd
using System.Collections.Generic;
using UnityEngine;
using VantaEclipse.Core;
using VantaEclipse.Data;

namespace VantaEclipse.Managers
{
    /// <summary>
    /// Owns the world list, unlock progression, and palettes. Never touches
    /// scenes; never calls upward (CombatManager queries IT for rosters and
    /// multipliers, and reports the loaded level for migration via
    /// RaiseUnlockedFloor()).
    /// </summary>
    public sealed class WorldManager : ISaveable
    {
        public const int LevelsPerWorld = 50;

        /// <summary>Highest world index ever unlocked (0 = Dark Forest). Never
        /// decreases.</summary>
        public int HighestUnlockedIndex;

        /// <summary>World id whose unlock celebration hasn't been acknowledged
        /// yet ("" = none).</summary>
        public string UnlockCelebrationPending = "";

        /// <summary>The payout shown by the celebration — persisted so a killed
        /// app can re-present the modal with the true number.</summary>
        public float UnlockCelebrationPayout;

        public string SaveKey => "world";

        public WorldManager() => Game.Events.BossFightWon += OnBossFightWon;

        /// <summary>Worlds in ascending firstLevel order. DefinitionRegistry
        /// sorts by sortOrder then id, which WorldDefinition does not carry, so
        /// the ordering that actually matters is imposed here.</summary>
        IReadOnlyList<WorldDefinition> Worlds
        {
            get
            {
                if (_worlds != null) return _worlds;
                var all = new List<WorldDefinition>(DefinitionRegistry.All<WorldDefinition>());
                all.Sort((a, b) => a.firstLevel.CompareTo(b.firstLevel));
                _worlds = all;
                return _worlds;
            }
        }
        List<WorldDefinition> _worlds;

        // --- Save contract -------------------------------------------------

        public Dictionary<string, object> GetSaveData() => new()
        {
            { "highest_unlocked_index", HighestUnlockedIndex },
            { "unlock_celebration_pending", UnlockCelebrationPending },
            { "unlock_celebration_payout", UnlockCelebrationPayout },
        };

        public void LoadSaveData(Dictionary<string, object> data)
        {
            HighestUnlockedIndex = Mathf.Max(0, SaveRead.Int(data, "highest_unlocked_index"));
            UnlockCelebrationPending = SaveRead.Str(data, "unlock_celebration_pending");
            UnlockCelebrationPayout = Mathf.Max(0f, SaveRead.Float(data, "unlock_celebration_payout"));
        }

        // --- Public API ----------------------------------------------------

        public int WorldIndexForLevel(int level)
        {
            int index = (Mathf.Max(1, level) - 1) / LevelsPerWorld;
            return Mathf.Clamp(index, 0, Worlds.Count - 1);
        }

        public WorldDefinition GetWorldForLevel(int level) => Worlds[WorldIndexForLevel(level)];

        public float GetEssenceMultiplierForLevel(int level)
            => GetWorldForLevel(level).essenceMultiplier;

        public bool IsGateLevel(int level) => level % 10 == 0;

        public bool IsWorldBossGate(int level) => level % LevelsPerWorld == 0;

        /// <summary>
        /// The boss enemy id guarding a gate level.
        ///
        /// Past the last authored gate (110+ while only two worlds ship) the
        /// final world boss repeats rather than erroring. Its HP scales off
        /// enemy level, so the climb stays meaningful until a content drop adds
        /// World 3 — the alternative is farming 109 forever behind a CHALLENGE
        /// BOSS button that errors on every tap. Reusing a boss definition is
        /// already the norm here: both shipped worlds repeat one at index 3.
        /// </summary>
        public string GetBossIdForGate(int gateLevel)
        {
            var world = GetWorldForLevel(gateLevel);
            if (world.bossDefinitionPaths.Length == 0)
            {
                Debug.LogError($"WorldManager: world '{world.id}' defines no bosses");
                return "";
            }
            int index = (gateLevel - (world.firstLevel - 1)) / 10 - 1;
            return world.bossDefinitionPaths[
                Mathf.Clamp(index, 0, world.bossDefinitionPaths.Length - 1)];
        }

        /// <summary>Silent migration (grandfather rule): called by
        /// CombatManager on load with the world index its saved level implies.
        /// Raises the unlock floor with no celebration — celebrations are for
        /// live crossings only.</summary>
        public void RaiseUnlockedFloor(int worldIndex)
            => HighestUnlockedIndex = Mathf.Max(HighestUnlockedIndex, worldIndex);

        public bool HasPendingUnlockCelebration() => UnlockCelebrationPending != "";

        public WorldDefinition GetPendingUnlockWorld()
        {
            foreach (var world in Worlds)
                if (world.id == UnlockCelebrationPending) return world;
            return null;
        }

        /// <summary>Re-lock world progression on an Eclipse: the player
        /// re-climbs the worlds each run. Called by PrestigeManager only.</summary>
        public void ResetForPrestige()
        {
            HighestUnlockedIndex = 0;
            UnlockCelebrationPending = "";
            UnlockCelebrationPayout = 0f;
        }

        /// <summary>Called by the UI when the World Unlock modal's ENTER is
        /// tapped.</summary>
        public void AcknowledgeUnlockCelebration()
        {
            UnlockCelebrationPending = "";
            UnlockCelebrationPayout = 0f;
            // Persist immediately so a force-kill can't replay the ceremony.
            Game.Save.SaveGame();
        }

        // --- Internals -----------------------------------------------------

        void OnBossFightWon(int level, float payout, bool isWorldBoss)
        {
            if (!isWorldBoss) return;

            int nextIndex = WorldIndexForLevel(level) + 1;
            // Final world's boss: nothing further to unlock yet.
            // TODO(content): World 3 "Molten Core" arrives as a data drop.
            if (nextIndex >= Worlds.Count) return;
            if (nextIndex <= HighestUnlockedIndex) return;

            HighestUnlockedIndex = nextIndex;
            UnlockCelebrationPending = Worlds[nextIndex].id;
            UnlockCelebrationPayout = payout;
            // Permanent the moment it happens — no crash can take it back.
            Game.Save.SaveGame();
            Game.Events.RaiseWorldUnlocked(Worlds[nextIndex]);
        }
    }
}
