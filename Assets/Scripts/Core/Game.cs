using System.Collections.Generic;
using UnityEngine;
using VantaEclipse.Managers;

namespace VantaEclipse.Core
{
    /// <summary>
    /// The service locator that replaces Godot's autoload block.
    ///
    /// In Godot, project.godot's [autoload] section named 21 singletons and the
    /// engine guaranteed their construction order. Unity has no equivalent, so
    /// that order is written out explicitly in Boot() — and it is the same
    /// order, because the Godot list was already a correct topological sort of
    /// the dependencies.
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

        /// <summary>Scene transitions. A MonoBehaviour, because fading and
        /// async loading are coroutines. Null outside play mode.</summary>
        public static SceneFlow Flow { get; private set; }

        // Remaining autoloads still to port, in project.godot's order:
        //   MinigameManager, QuestManager, CardManager, AudioManager,
        //   MonetizationManager

        public static bool IsBooted { get; private set; }

        /// <summary>
        /// Build the manager graph. Called from a
        /// [RuntimeInitializeOnLoadMethod] before the first scene loads, which
        /// is the closest Unity gets to an autoload — it runs whichever scene
        /// the editor starts in, so entering play mode on any screen works the
        /// way it did in Godot.
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

            IsBooted = true;

            // Read the save only once every manager exists and has subscribed.
            // The Godot version deferred _initial_load a frame for exactly this
            // reason; here the ordering is just... the order.
            Save.InitialLoad();

            if (Application.isPlaying)
            {
                GameRuntime.Spawn();
                Flow = SceneFlow.Spawn();
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
