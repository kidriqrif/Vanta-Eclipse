using System.Collections.Generic;
using UnityEngine;
using VantaEclipse.Managers;

namespace VantaEclipse.Core
{
    /// <summary>
    /// The service locator that owns the 21 long-lived managers.
    ///
    /// Nothing in Unity guarantees the construction order of a set of
    /// singletons, so that order is written out explicitly in Boot(). It is a
    /// topological sort of the dependencies and it is load-bearing: a manager
    /// built before something it reads gets a half-initialised one.
    ///
    /// The managers are plain C# objects, not MonoBehaviours. Only the engine
    /// callbacks they actually need (a tick, the autosave interval, app pause)
    /// are MonoBehaviour-shaped, and those live in the single GameRuntime host.
    /// Everything else is testable without entering play mode, which is what
    /// turns the old sweep's 90 runtime checks into ordinary tests.
    /// </summary>
    public static class Game
    {
        public static EventBus Events { get; private set; }
        public static SettingsManager Settings { get; private set; }
        public static SaveManager Save { get; private set; }
        public static GameManager State { get; private set; }
        public static CurrencyManager Currency { get; private set; }
        public static UpgradeManager Upgrades { get; private set; }
        public static EquipmentManager Equipment { get; private set; }
        public static RelicManager Relics { get; private set; }
        public static PetManager Pets { get; private set; }
        public static SkillTreeManager Skills { get; private set; }
        public static PlayerStats Stats { get; private set; }
        public static WorldManager Worlds { get; private set; }
        public static CombatManager Combat { get; private set; }
        public static IdleManager Idle { get; private set; }
        public static PrestigeManager Prestige { get; private set; }

        public static CardManager Cards { get; private set; }
        public static MinigameManager Arcade { get; private set; }
        public static QuestManager Journal { get; private set; }
        public static MonetizationManager Shop { get; private set; }

        /// <summary>Scene transitions and sound. MonoBehaviours, because
        /// fading, async loading, and AudioSources need engine callbacks. Both
        /// are null outside play mode.</summary>
        public static SceneFlow Flow { get; private set; }
        public static AudioManager Audio { get; private set; }

        // All 21 autoloads are ported.

        public static bool IsBooted { get; private set; }

        /// <summary>
        /// Build the manager graph. Called from a
        /// [RuntimeInitializeOnLoadMethod] before the first scene loads, which
        /// is the closest Unity gets to an autoload — it runs whichever scene
        /// the editor starts in, so entering play mode on any screen works the
        /// way starting from the main menu does.
        /// </summary>
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        public static void Boot()
        {
            if (IsBooted) return;

            // Order matters and mirrors the autoload block. Events first —
            // GameManager subscribes to GameLoaded in its constructor.
            Events = new EventBus();
            Settings = new SettingsManager();
            Save = new SaveManager();
            State = new GameManager();
            Currency = new CurrencyManager();
            Upgrades = new UpgradeManager();
            Equipment = new EquipmentManager();
            Relics = new RelicManager();
            Pets = new PetManager();
            Skills = new SkillTreeManager();
            Stats = new PlayerStats();
            Worlds = new WorldManager();
            Combat = new CombatManager();
            Idle = new IdleManager();
            Prestige = new PrestigeManager();
            // Arcade before Journal: QuestManager pays token rewards through it
            // and reads its count at load. Shop last, as in the autoload block.
            Arcade = new MinigameManager();
            Journal = new QuestManager();
            Cards = new CardManager();
            Shop = new MonetizationManager();

            IsBooted = true;

            // Read the save only once every manager exists and has subscribed.
            // Nothing is deferred here: the ordering above is the guarantee.
            Save.InitialLoad();

            if (Application.isPlaying)
            {
                GameRuntime.Spawn();
                Flow = SceneFlow.Spawn();
                Audio = AudioManager.Spawn();
            }
        }

        /// <summary>Every manager that owns save state, in the order it should
        /// be written and restored.</summary>
        public static IEnumerable<ISaveable> Saveables()
        {
            yield return State;
            yield return Currency;
            yield return Upgrades;
            yield return Equipment;
            yield return Relics;
            yield return Pets;
            yield return Skills;
            yield return Worlds;
            yield return Combat;
            yield return Idle;
            yield return Prestige;
            yield return Arcade;
            yield return Journal;
            yield return Cards;
            yield return Shop;
        }

        /// <summary>Tear down and rebuild. Tests call this between cases; the
        /// running game never does.</summary>
        public static void Reset()
        {
            IsBooted = false;
            DefinitionRegistry.Clear();
            Boot();
        }
    }
}
