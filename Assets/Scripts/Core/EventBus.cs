using System;
using System.Collections.Generic;
using VantaEclipse.Data;

namespace VantaEclipse.Core
{
    /// <summary>
    /// The game's global signal hub.
    ///
    /// Systems never talk to each other directly. Instead they raise events
    /// here, and any other system that cares subscribes. This keeps gameplay
    /// logic, UI, and managers fully decoupled, which is what lets the project
    /// carry many systems (combat, pets, minigames, ...) without spaghetti
    /// dependencies.
    ///
    /// Raise with:     Game.Events.RaiseGameSaved(true);
    /// Listen with:    Game.Events.GameSaved += OnGameSaved;
    ///
    /// The Raise* methods exist because C# only lets the declaring type invoke
    /// an event, so the managers that own each signal call the matching Raise*
    /// instead of emitting directly. They are grouped
    /// with their events rather than in a block at the bottom so a new signal
    /// is one edit in one place.
    /// </summary>
    public sealed class EventBus
    {
        // --- Save system (Milestone 1) ---

        /// <summary>Raised once at startup after SaveManager finished its
        /// initial load attempt. isNewGame is true when no readable save file
        /// existed.</summary>
        public event Action<bool> GameLoaded;
        public void RaiseGameLoaded(bool isNewGame) => GameLoaded?.Invoke(isNewGame);

        /// <summary>Raised every time a save finishes (autosave, manual save,
        /// or save-on-exit).</summary>
        public event Action<bool> GameSaved;
        public void RaiseGameSaved(bool success) => GameSaved?.Invoke(success);

        // --- Scene flow (Milestone 1) ---

        public event Action<string> SceneTransitionStarted;
        public void RaiseSceneTransitionStarted(string scene) => SceneTransitionStarted?.Invoke(scene);

        public event Action<string> SceneTransitionFinished;
        public void RaiseSceneTransitionFinished(string scene) => SceneTransitionFinished?.Invoke(scene);

        // --- Combat (Milestone 2) ---

        /// <summary>Raised when a new enemy appears.</summary>
        public event Action<EnemyDefinition, int, float> EnemySpawned;
        public void RaiseEnemySpawned(EnemyDefinition d, int level, float maxHp)
            => EnemySpawned?.Invoke(d, level, maxHp);

        /// <summary>Raised for every hit that lands on the enemy.</summary>
        public event Action<float, bool, float, float> EnemyDamaged;
        public void RaiseEnemyDamaged(float amount, bool isCrit, float hpRemaining, float maxHp)
            => EnemyDamaged?.Invoke(amount, isCrit, hpRemaining, maxHp);

        /// <summary>Raised the moment an enemy's health reaches zero.</summary>
        public event Action<int, int> EnemyDied;
        public void RaiseEnemyDied(int level, int totalKills) => EnemyDied?.Invoke(level, totalKills);

        /// <summary>Raised when an enemy leaves without dying (boss endures /
        /// farm enemy steps aside for a retry).</summary>
        public event Action EnemyWithdrawn;
        public void RaiseEnemyWithdrawn() => EnemyWithdrawn?.Invoke();

        // --- Economy (Milestone 3) ---

        /// <summary>Raised whenever any currency balance changes. UI reads the
        /// new balance straight from the event instead of polling.</summary>
        public event Action<string, float> CurrencyChanged;
        public void RaiseCurrencyChanged(string currency, float balance)
            => CurrencyChanged?.Invoke(currency, balance);

        /// <summary>Raised when essence is earned, with where it came from
        /// ("combat", "offline", "minigame", "ad_bonus").</summary>
        public event Action<float, string> EssenceEarned;
        public void RaiseEssenceEarned(float amount, string source)
            => EssenceEarned?.Invoke(amount, source);

        public event Action<string, int> UpgradePurchased;
        public void RaiseUpgradePurchased(string id, int newLevel)
            => UpgradePurchased?.Invoke(id, newLevel);

        // --- Idle & offline (Milestone 4) ---

        /// <summary>Raised exactly once per save file, at the moment
        /// auto-attack unlocks during live play.</summary>
        public event Action AutoAttackUnlocked;
        public void RaiseAutoAttackUnlocked() => AutoAttackUnlocked?.Invoke();

        /// <summary>Raised when an offline reward has been granted and is
        /// waiting to be presented (the essence is already banked).</summary>
        public event Action<float, int, bool> OfflineRewardsReady;
        public void RaiseOfflineRewardsReady(float amount, int secondsAway, bool wasCapped)
            => OfflineRewardsReady?.Invoke(amount, secondsAway, wasCapped);

        /// <summary>Raised at offline-reward grant time with the estimated
        /// kills, so pet XP comes from the same estimate, never re-derived.</summary>
        public event Action<int> OfflineKillsEstimated;
        public void RaiseOfflineKillsEstimated(int kills) => OfflineKillsEstimated?.Invoke(kills);

        // --- Bosses & worlds (Milestone 5) ---

        public event Action<EnemyDefinition, int, float, float> BossFightStarted;
        public void RaiseBossFightStarted(EnemyDefinition d, int level, float maxHp, float duration)
            => BossFightStarted?.Invoke(d, level, maxHp, duration);

        /// <summary>Raised at the moment of a boss kill. The payout is already
        /// granted.</summary>
        public event Action<int, float, bool> BossFightWon;
        public void RaiseBossFightWon(int level, float payout, bool isWorldBoss)
            => BossFightWon?.Invoke(level, payout, isWorldBoss);

        public event Action<int> BossFightFailed;
        public void RaiseBossFightFailed(int level) => BossFightFailed?.Invoke(level);

        public event Action<WorldDefinition> WorldUnlocked;
        public void RaiseWorldUnlocked(WorldDefinition world) => WorldUnlocked?.Invoke(world);

        // --- Equipment & loot (Milestone 6) ---

        public event Action<Item> ItemDropped;
        public void RaiseItemDropped(Item item) => ItemDropped?.Invoke(item);

        public event Action InventoryChanged;
        public void RaiseInventoryChanged() => InventoryChanged?.Invoke();

        public event Action<string> ItemEquipped;
        public void RaiseItemEquipped(string slot) => ItemEquipped?.Invoke(slot);

        // --- Relics & Pets (Milestone 7) ---

        public event Action<string> RelicDropped;
        public void RaiseRelicDropped(string id) => RelicDropped?.Invoke(id);

        public event Action<string> ActiveRelicChanged;
        public void RaiseActiveRelicChanged(string id) => ActiveRelicChanged?.Invoke(id);

        /// <summary>Raised once when the relic system awakens (first world
        /// unlock).</summary>
        public event Action RelicsAwakened;
        public void RaiseRelicsAwakened() => RelicsAwakened?.Invoke();

        public event Action<string> PetUnlocked;
        public void RaisePetUnlocked(string id) => PetUnlocked?.Invoke(id);

        public event Action<string, int> PetLeveled;
        public void RaisePetLeveled(string id, int level) => PetLeveled?.Invoke(id, level);

        public event Action<string, int> PetEvolved;
        public void RaisePetEvolved(string id, int stage) => PetEvolved?.Invoke(id, stage);

        public event Action<string> ActivePetChanged;
        public void RaiseActivePetChanged(string id) => ActivePetChanged?.Invoke(id);

        // --- Prestige & Ascendant Powers (Milestone 8) ---

        /// <summary>Raised once, on the first live crossing of the Eclipse
        /// unlock level, so the gameplay screen can reveal the ECLIPSE door.</summary>
        public event Action EclipseAvailable;
        public void RaiseEclipseAvailable() => EclipseAvailable?.Invoke();

        /// <summary>Raised after an Eclipse completes. The crystals are already
        /// granted and the run is already reset.</summary>
        public event Action<float, int> EclipsePerformed;
        public void RaiseEclipsePerformed(float reward, int prestigeCount)
            => EclipsePerformed?.Invoke(reward, prestigeCount);

        public event Action<string, int> SkillPurchased;
        public void RaiseSkillPurchased(string id, int newLevel) => SkillPurchased?.Invoke(id, newLevel);

        // --- The Arcade (Milestone 9) ---

        public event Action<int> ArcadeTokensChanged;
        public void RaiseArcadeTokensChanged(int count) => ArcadeTokensChanged?.Invoke(count);

        public event Action ArcadeUnlocked;
        public void RaiseArcadeUnlocked() => ArcadeUnlocked?.Invoke();

        public event Action<string, int, float> MinigameFinished;
        public void RaiseMinigameFinished(string id, int outcome, float payout)
            => MinigameFinished?.Invoke(id, outcome, payout);

        // --- The Journal (Milestone 13) ---

        /// <summary>Raised the first time a goal's progress reaches its target.
        /// The reward is NOT granted here — it waits to be claimed.</summary>
        public event Action<string> GoalCompleted;
        public void RaiseGoalCompleted(string id) => GoalCompleted?.Invoke(id);

        public event Action<string, string> GoalClaimed;
        public void RaiseGoalClaimed(string id, string rewardText) => GoalClaimed?.Invoke(id, rewardText);

        public event Action DailiesRerolled;
        public void RaiseDailiesRerolled() => DailiesRerolled?.Invoke();

        // --- Monetization (Milestone 14) ---

        public event Action<string, float> AdRewardGranted;
        public void RaiseAdRewardGranted(string placementId, float amount)
            => AdRewardGranted?.Invoke(placementId, amount);

        public event Action<string> PurchaseCompleted;
        public void RaisePurchaseCompleted(string productId) => PurchaseCompleted?.Invoke(productId);

        public event Action<string> CosmeticEquipped;
        public void RaiseCosmeticEquipped(string id) => CosmeticEquipped?.Invoke(id);

        // --- Boss cards ---

        /// <summary>Raised when a defeated boss leaves a trophy card. Carries
        /// the whole rolled card, because every listener wants a different
        /// field of it and re-reading the collection to find "the newest one"
        /// is a race with the next boss.</summary>
        public event Action<Card> CardCollected;
        public void RaiseCardCollected(Card card) => CardCollected?.Invoke(card);

        public event Action<string, float, float> CardAbsorbed;
        public void RaiseCardAbsorbed(string petId, float xp, float bonus)
            => CardAbsorbed?.Invoke(petId, xp, bonus);

        // --- UI presentation facts (Milestone 5) ---
        // Raised by overlays (shop panel, blocking modals) so managers can
        // defer moments that need an unobstructed screen. Presentation facts,
        // not state.

        public event Action UiOverlayOpened;
        public void RaiseUiOverlayOpened() => UiOverlayOpened?.Invoke();

        public event Action UiOverlayClosed;
        public void RaiseUiOverlayClosed() => UiOverlayClosed?.Invoke();
    }
}
