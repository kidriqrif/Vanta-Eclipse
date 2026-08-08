using System.Collections.Generic;
using UnityEngine;
using VantaEclipse.Managers;

namespace VantaEclipse.Core
{
    /// <summary>
    /// The service locator that replaces Godot's autoload block.
    ///
    /// In Godot, `project.godot`'s [autoload] section named 21 singletons and
    /// the engine guaranteed their construction order. Unity has no equivalent,
    /// so that order is written out explicitly in Boot() below — and it is the
    /// same order, because the Godot list was already a correct topological
    /// sort of the dependencies.
    ///
    /// The managers are plain C# objects rather than MonoBehaviours on a
    /// bootstrap prefab. Only the two that genuinely need engine callbacks
    /// (AudioManager for AudioSources, SceneManager for coroutines) will get a
    /// MonoBehaviour host. Everything else is testable without entering play
    /// mode, which is what turns the old sweep's 90 runtime checks into
    /// ordinary edit-mode tests.
    /// </summary>
    public static class Game
    {
        public static EventBus Events { get; private set; }
        public static CurrencyManager Currency { get; private set; }
        public static UpgradeManager Upgrades { get; private set; }

        // Remaining autoloads, in the order project.godot declared them:
        //   SettingsManager, SaveManager, GameManager, EquipmentManager,
        //   RelicManager, PetManager, SkillTreeManager, PlayerStats,
        //   SceneManager, WorldManager, CombatManager, IdleManager,
        //   MinigameManager, PrestigeManager, QuestManager, CardManager,
        //   AudioManager, MonetizationManager

        public static bool IsBooted { get; private set; }

        /// <summary>
        /// Build the manager graph. Called once from a
        /// [RuntimeInitializeOnLoadMethod] before the first scene loads, which
        /// is the closest Unity gets to an autoload — it runs whichever scene
        /// the editor starts in, so entering play mode on any screen works the
        /// way it did in Godot.
        /// </summary>
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        public static void Boot()
        {
            if (IsBooted) return;

            Events = new EventBus();
            Currency = new CurrencyManager();
            Upgrades = new UpgradeManager();

            IsBooted = true;
        }

        /// <summary>Every manager that owns save state, in the order it should
        /// be written and restored. SaveManager walks this instead of keeping
        /// the registry the Godot version built by having each manager call
        /// register_saveable() from _ready().</summary>
        public static IEnumerable<ISaveable> Saveables()
        {
            yield return Currency;
            yield return Upgrades;
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
