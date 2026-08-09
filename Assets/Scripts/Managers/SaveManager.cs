using System;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;
using VantaEclipse.Core;

namespace VantaEclipse.Managers
{
    /// <summary>
    /// The game's single source of truth for saving and loading.
    ///
    /// Design (built for years of updates):
    ///   * Any system that owns persistent data implements ISaveable and is
    ///     listed in Game.Saveables(). New systems plug in without touching
    ///     this file. The list lives in Game rather than being self-registered
    ///     by each manager, because the order should be explicit and readable
    ///     in one place.
    ///   * The whole save is one versioned JSON document, so old saves can be
    ///     migrated forward in Migrate() when the format changes.
    ///   * Writes are atomic (temp file, keep a backup, then swap), so a crash
    ///     or battery-death mid-save can never corrupt the player's progress.
    ///   * Cloud-save ready: GetFullSaveText() returns the exact document a
    ///     cloud provider would upload, and the on-disk format is plain JSON.
    ///
    /// Saving happens automatically every 60s (driven by GameRuntime), when the
    /// app is closed or backgrounded, and whenever SaveGame() is called.
    /// </summary>
    public sealed class SaveManager
    {
        public const int SaveVersion = 1;

        static string Dir => Application.persistentDataPath;
        static string SavePath => Path.Combine(Dir, "savegame.json");
        static string BackupPath => Path.Combine(Dir, "savegame.backup.json");
        static string TempPath => Path.Combine(Dir, "savegame.tmp");

        /// <summary>Unix timestamp of the most recent successful save
        /// (0 = never this session). IdleManager reads it to price offline
        /// progression.</summary>
        public long LastSaveUnix { get; private set; }

        static long NowUnix => DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        // --- Public API ----------------------------------------------------

        /// <summary>Save the entire game. Returns true on success.</summary>
        public bool SaveGame()
        {
            bool success = WriteAtomically(GetFullSaveText());
            if (success) LastSaveUnix = NowUnix;
            else Debug.LogError("SaveManager: save failed!");
            Game.Events.RaiseGameSaved(success);
            return success;
        }

        /// <summary>Build the complete save document as JSON text. This is also
        /// exactly what a cloud-save provider would upload.
        /// TODO(post-release): wire into Play Games cloud saves.</summary>
        public string GetFullSaveText()
        {
            var sections = new Dictionary<string, object>();
            foreach (var saveable in Game.Saveables())
                sections[saveable.SaveKey] = saveable.GetSaveData();

            var document = new Dictionary<string, object>
            {
                { "save_version", SaveVersion },
                { "game_version", GameManager.GameVersion },
                { "saved_at_unix", NowUnix },
                { "sections", sections },
            };
            return JsonConvert.SerializeObject(document, Formatting.Indented);
        }

        /// <summary>Permanently delete all saved progress (main file and
        /// backup). The Eclipse deliberately does NOT use this — prestige
        /// resets run state through each manager's ResetForPrestige(), never by
        /// destroying the save.</summary>
        public void DeleteSave()
        {
            TryDelete(SavePath);
            TryDelete(BackupPath);
            LastSaveUnix = 0;
        }

        /// <summary>Read the save and distribute it. Called once at boot, after
        /// every manager exists and has subscribed.</summary>
        public void InitialLoad()
        {
            bool loaded = TryLoadFrom(SavePath);
            if (!loaded && File.Exists(BackupPath))
            {
                Debug.LogWarning("SaveManager: main save unreadable, restoring from backup.");
                loaded = TryLoadFrom(BackupPath);
            }
            Game.Events.RaiseGameLoaded(!loaded);
        }

        // --- Internals -----------------------------------------------------

        bool TryLoadFrom(string path)
        {
            if (!File.Exists(path)) return false;

            string text;
            try { text = File.ReadAllText(path); }
            catch (Exception e)
            {
                Debug.LogError($"SaveManager: cannot read {path} ({e.Message})");
                return false;
            }

            JObject document;
            try { document = JObject.Parse(text); }
            catch (Exception)
            {
                Debug.LogError($"SaveManager: {path} is not valid save JSON.");
                return false;
            }

            if (document["sections"] is not JObject sections)
            {
                Debug.LogError($"SaveManager: {path} is missing its 'sections' block.");
                return false;
            }

            int version = (int?)document["save_version"] ?? SaveVersion;
            if (version > SaveVersion)
            {
                // A save written by a NEWER build. This one cannot understand
                // it, and the damage of trying is not the failed load — it is
                // that Migrate() would stamp save_version back DOWN. That
                // relabels new-format data as old-format, so when the player
                // updates again the migration chain runs over data that has
                // already been migrated and destroys the run. Silently, and
                // with no way back.
                //
                // Happens for real: a Play Store staged rollback, an
                // internal-test build followed by the public one, or a device
                // restore.
                Debug.LogError($"SaveManager: {path} was written by save v{version}, " +
                               $"newer than v{SaveVersion} — refusing to load it.");
                Quarantine(path, version);
                return false;
            }

            document = Migrate(document);
            sections = (JObject)document["sections"];

            foreach (var saveable in Game.Saveables())
            {
                if (sections[saveable.SaveKey] is JObject section)
                    saveable.LoadSaveData(section.ToObject<Dictionary<string, object>>());
            }

            LastSaveUnix = (long?)document["saved_at_unix"] ?? 0L;
            return true;
        }

        /// <summary>
        /// Upgrade an old save document to the current SaveVersion, one step at
        /// a time. When the format changes, bump SaveVersion and add a case:
        ///
        ///     case 1: // 1 -> 2: renamed "gold" to "eclipse_essence"
        ///         sections["currency"]["eclipse_essence"] = sections["currency"]["gold"];
        ///         break;
        ///
        /// Chaining single steps means a save from ANY old version always
        /// upgrades cleanly. Saves from a NEWER version never reach here —
        /// TryLoadFrom refuses them, because there is no such thing as
        /// migrating backwards.
        /// </summary>
        JObject Migrate(JObject document)
        {
            int version = (int?)document["save_version"] ?? 1;
            while (version < SaveVersion)
            {
                switch (version)
                {
                    default:
                        Debug.LogWarning($"SaveManager: no migration defined from version {version}.");
                        break;
                }
                version++;
            }
            document["save_version"] = SaveVersion;
            return document;
        }

        /// <summary>
        /// Keep a copy of a save this build is too old to read.
        ///
        /// Refusing to load it is not enough on its own: the game carries on
        /// into a fresh run and the 60-second autosave overwrites the very file
        /// we refused, so declining to read the player's progress would be what
        /// deletes it. With a copy aside, updating again recovers everything.
        /// </summary>
        void Quarantine(string path, int version)
        {
            string kept = Path.Combine(Dir, $"savegame.from_v{version}.json");
            // An earlier launch already preserved this. Keep the first copy: it
            // is the one written before any of this build's autosaves ran.
            if (File.Exists(kept)) return;
            try
            {
                File.Copy(path, kept);
                Debug.LogWarning($"SaveManager: the newer save was kept at {kept} — " +
                                 "reinstall the newer build to use it.");
            }
            catch (Exception e)
            {
                Debug.LogError($"SaveManager: could not preserve the newer save at {kept} ({e.Message})");
            }
        }

        /// <summary>
        /// Write the save so that a crash at ANY point leaves a readable file:
        ///   1. write everything to a temp file
        ///   2. copy the current save to the backup slot
        ///   3. move the temp file over the real save
        /// </summary>
        static bool WriteAtomically(string text)
        {
            try
            {
                File.WriteAllText(TempPath, text);

                if (File.Exists(SavePath))
                    File.Copy(SavePath, BackupPath, overwrite: true);

                // File.Move refuses an existing destination on the .NET profile
                // Unity ships for Android, so the old file goes first. The
                // backup written a line earlier is what covers a crash landing
                // in this gap.
                if (File.Exists(SavePath)) File.Delete(SavePath);
                File.Move(TempPath, SavePath);
                return true;
            }
            catch (Exception e)
            {
                Debug.LogError($"SaveManager: atomic write failed ({e.Message})");
                return false;
            }
        }

        static void TryDelete(string path)
        {
            try { if (File.Exists(path)) File.Delete(path); }
            catch (Exception e) { Debug.LogError($"SaveManager: cannot delete {path} ({e.Message})"); }
        }
    }
}
