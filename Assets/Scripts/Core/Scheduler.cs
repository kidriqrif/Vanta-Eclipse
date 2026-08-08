using System;
using System.Collections.Generic;

namespace VantaEclipse.Core
{
    /// <summary>
    /// Delayed and end-of-frame callbacks, driven by GameRuntime.
    ///
    /// Replaces two Godot idioms the managers lean on heavily:
    ///   get_tree().create_timer(d).timeout.connect(f)  ->  Scheduler.After(d, f)
    ///   f.call_deferred()                              ->  Scheduler.EndOfFrame(f)
    ///
    /// After() runs on SCALED time on purpose. The Godot managers left
    /// CombatManager on the default PAUSABLE process mode so a boss countdown
    /// freezes with a paused tree and with Android suspension — a notification
    /// can never drain the timer. Unity's equivalent of that pause is
    /// timeScale = 0, so a scaled clock reproduces the behaviour exactly.
    /// Anything that must keep running while paused (autosave, play time) is
    /// driven from GameRuntime's unscaled path instead, never from here.
    /// </summary>
    public static class Scheduler
    {
        struct Pending
        {
            public float Remaining;
            public Action Callback;
        }

        static readonly List<Pending> Timers = new();
        static readonly List<Action> EndOfFrameQueue = new();
        static readonly List<Action> EndOfFrameRunning = new();

        /// <summary>Run <paramref name="callback"/> after a delay in scaled
        /// seconds.</summary>
        public static void After(float seconds, Action callback)
        {
            if (callback == null) return;
            if (seconds <= 0f) { EndOfFrame(callback); return; }
            Timers.Add(new Pending { Remaining = seconds, Callback = callback });
        }

        /// <summary>Run <paramref name="callback"/> at the end of this frame —
        /// Godot's call_deferred. The managers use it where a signal chain is
        /// still unwinding and the final state is only correct once every
        /// handler in the current emission has run.</summary>
        public static void EndOfFrame(Action callback)
        {
            if (callback != null) EndOfFrameQueue.Add(callback);
        }

        /// <summary>Called once per frame by GameRuntime, with scaled delta.
        /// Public rather than internal so tests can drive the clock directly —
        /// Unity compiles editor and test code into separate assemblies, where
        /// `internal` is not visible.</summary>
        public static void Tick(float deltaTime)
        {
            // Walk backwards so a callback that schedules another timer does not
            // disturb the iteration, and so removal is O(1).
            for (int i = Timers.Count - 1; i >= 0; i--)
            {
                var pending = Timers[i];
                pending.Remaining -= deltaTime;
                if (pending.Remaining > 0f)
                {
                    Timers[i] = pending;
                    continue;
                }
                Timers.RemoveAt(i);
                pending.Callback?.Invoke();
            }

            if (EndOfFrameQueue.Count == 0) return;

            // Swap into a second list first: a deferred callback may itself
            // defer, and those must land NEXT frame rather than extending this
            // drain into an unbounded loop.
            EndOfFrameRunning.AddRange(EndOfFrameQueue);
            EndOfFrameQueue.Clear();
            foreach (var callback in EndOfFrameRunning) callback?.Invoke();
            EndOfFrameRunning.Clear();
        }

        /// <summary>Drop every pending callback. Tests call this between cases;
        /// the running game never does.</summary>
        public static void Clear()
        {
            Timers.Clear();
            EndOfFrameQueue.Clear();
            EndOfFrameRunning.Clear();
        }
    }
}
