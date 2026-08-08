// Ported from scripts/managers/game_manager.gd
using System;
using System.Collections.Generic;
using VantaEclipse.Core;

namespace VantaEclipse.Managers
{
    /// <summary>
    /// Central game state and version info.
    ///
    /// Scope: game version, play-time tracking, session counting. Later systems
    /// do NOT pile in here — each big system (currencies, combat, equipment,
    /// ...) gets its own manager and its own save section. GameManager stays
    /// small on purpose.
    /// </summary>
    public sealed class GameManager : ISaveable
    {
        /// <summary>Displayed in the UI and stamped into every save file. Bump
        /// for every release build.</summary>
        public const string GameVersion = "0.1.0";

        /// <summary>Total seconds the player has spent in the game, across all
        /// sessions.</summary>
        public float TotalPlayTime;

        /// <summary>How many times the game has been launched (1 = first ever
        /// session).</summary>
        public int LaunchCount;

        /// <summary>Unix timestamp of the very first launch.</summary>
        public long CreatedAtUnix;

        public string SaveKey => "game";

        public GameManager() => Game.Events.GameLoaded += OnGameLoaded;

        /// <summary>Driven by GameRuntime on unscaled time, so a paused game
        /// still accrues play time — what process_mode ALWAYS bought in
        /// Godot.</summary>
        public void Tick(float unscaledDeltaTime)
        {
            TotalPlayTime += unscaledDeltaTime;
            Game.Settings.Tick(unscaledDeltaTime);
        }

        // --- Save contract -------------------------------------------------

        public Dictionary<string, object> GetSaveData() => new()
        {
            { "total_play_time", TotalPlayTime },
            { "launch_count", LaunchCount },
            { "created_at_unix", CreatedAtUnix },
        };

        public void LoadSaveData(Dictionary<string, object> data)
        {
            TotalPlayTime = SaveRead.Float(data, "total_play_time");
            LaunchCount = SaveRead.Int(data, "launch_count");
            CreatedAtUnix = SaveRead.Long(data, "created_at_unix");
        }

        // --- Public helpers ------------------------------------------------

        /// <summary>Coarse duration for "you were away" copy, deliberately
        /// without seconds (design/ux/milestone-4-idle-offline.md §4C):
        /// 42m · 3h 42m · 2d 5h.</summary>
        public static string FormatDurationRough(int seconds)
        {
            int minutes = seconds / 60;
            if (minutes < 1) return "moments";
            if (minutes < 60) return $"{minutes}m";
            int hours = minutes / 60;
            if (hours < 24) return $"{hours}h {minutes % 60}m";
            return $"{hours / 24}d {hours % 24}h";
        }

        /// <summary>Format a duration in seconds as a short human-readable
        /// string, e.g. 4325.0 -> "1h 12m 05s".</summary>
        public static string FormatTime(float seconds)
        {
            int total = (int)seconds;
            int hours = total / 3600;
            int minutes = (total % 3600) / 60;
            int secs = total % 60;
            if (hours > 0) return $"{hours}h {minutes:D2}m {secs:D2}s";
            return $"{minutes}m {secs:D2}s";
        }

        // --- Internals -----------------------------------------------------

        void OnGameLoaded(bool isNewGame)
        {
            // Runs exactly once per app start, after the save (if any) applied.
            LaunchCount += 1;
            if (CreatedAtUnix == 0) CreatedAtUnix = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        }
    }
}
