using UnityEngine;

namespace VantaEclipse.Core
{
    /// <summary>
    /// The one MonoBehaviour the manager layer needs.
    ///
    /// Godot autoloads are Nodes, so any of them could take _process() and
    /// _notification() straight from the engine. The C# managers are plain
    /// objects, so the three things that genuinely require engine callbacks —
    /// a per-frame tick, the autosave interval, and the app-pause/quit moment —
    /// are funnelled through here and pushed into the managers.
    ///
    /// PROCESS_MODE_ALWAYS in the Godot originals has no equivalent to port:
    /// Unity's Time.unscaledDeltaTime is read directly below, so a paused
    /// game (timeScale 0) still accrues play time and still autosaves, which
    /// is what those managers set process_mode for.
    /// </summary>
    [DefaultExecutionOrder(-1000)]
    public sealed class GameRuntime : MonoBehaviour
    {
        float _autosaveAccumulator;

        internal static GameRuntime Spawn()
        {
            var go = new GameObject("[GameRuntime]");
            DontDestroyOnLoad(go);
            go.hideFlags = HideFlags.HideInHierarchy;
            return go.AddComponent<GameRuntime>();
        }

        void Update()
        {
            // Two clocks, and which one a system gets is a design decision the
            // Godot originals expressed as process_mode:
            //   ALWAYS   -> unscaled: play time and autosave keep running while
            //               the game is paused, so a pause menu cannot stall a
            //               save or freeze the session counter.
            //   PAUSABLE -> scaled: the boss countdown and auto-attack are live
            //               gameplay and must stop dead at timeScale 0.
            float unscaled = Time.unscaledDeltaTime;
            float scaled = Time.deltaTime;

            Game.State.Tick(unscaled);

            Scheduler.Tick(scaled);
            Game.Combat.Tick(scaled);
            Game.Idle.Tick(scaled);
            // Unscaled: the UTC-day rollover is wall-clock, and a paused game
            // must still cross midnight.
            Game.Journal.Tick(unscaled);

            _autosaveAccumulator += unscaled;
            if (_autosaveAccumulator >= SaveManagerConstants.AutosaveInterval)
            {
                _autosaveAccumulator = 0f;
                Game.Save.SaveGame();
            }
        }

        // Android sends the app to the background here, and it is the moment a
        // mobile game is most likely to be killed by the OS. OnApplicationQuit
        // is not reliably delivered on Android at all, so this is the important
        // one of the two.
        void OnApplicationPause(bool paused)
        {
            if (!paused)
            {
                // Foreground return — the offline-rewards path on mobile.
                Game.Idle.OnApplicationResumed();
                return;
            }
            Game.Settings.FlushPendingWrite();
            Game.Save.SaveGame();
        }

        void OnApplicationQuit()
        {
            Game.Settings.FlushPendingWrite();
            Game.Save.SaveGame();
        }
    }

    /// <summary>Pulled out so GameRuntime can read the interval without a
    /// circular reference through the Managers namespace.</summary>
    public static class SaveManagerConstants
    {
        public const float AutosaveInterval = 60f;
    }
}
