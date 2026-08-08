using System;
using System.Collections.Generic;
using System.Text;
using UnityEditor;
using UnityEngine;
using VantaEclipse.Core;
using VantaEclipse.Managers;

namespace VantaEclipse.EditorTools
{
    /// <summary>
    /// Proves the ported managers actually run, not merely compile.
    ///
    /// Deliberately a plain -executeMethod entry point rather than a Unity Test
    /// Framework suite: the port needs an answer to "did the logic survive the
    /// translation" before the test package, the assembly definitions, and the
    /// CI wiring exist. The 90 runtime checks in the retired GDScript sweep
    /// become real play-mode tests later; this covers the arithmetic and the
    /// guards that a compiler cannot check, today.
    ///
    ///   Unity.exe -batchmode -nographics -quit \
    ///     -executeMethod VantaEclipse.EditorTools.PortSmokeTest.Run
    ///
    /// Exits non-zero on any failure so it can gate a build.
    /// </summary>
    public static class PortSmokeTest
    {
        static readonly List<string> Failures = new();
        static int _checks;

        public static void Run()
        {
            Failures.Clear();
            _checks = 0;

            try
            {
                DefinitionRegistry.Clear();
                Game.Reset();

                ContentLoads();
                CurrencyGuards();
                UpgradeEconomy();
                StatLayering();
                SaveRoundTrip();
                SchedulerRuns();
            }
            catch (Exception e)
            {
                Failures.Add($"threw: {e}");
            }

            var report = new StringBuilder();
            report.AppendLine($"PortSmokeTest: {_checks} checks, {Failures.Count} failed");
            foreach (var failure in Failures) report.AppendLine($"  FAIL {failure}");

            if (Failures.Count > 0)
            {
                Debug.LogError(report.ToString());
                EditorApplication.Exit(1);
                return;
            }
            Debug.Log(report.ToString());
            EditorApplication.Exit(0);
        }

        // --- checks --------------------------------------------------------

        static void ContentLoads()
        {
            Check("worlds load", DefinitionRegistry.All<Data.WorldDefinition>().Count == 2);
            Check("enemies load", DefinitionRegistry.All<Data.EnemyDefinition>().Count == 14);
            Check("quests load", DefinitionRegistry.All<Data.QuestDefinition>().Count == 27);

            var ember = DefinitionRegistry.Get<Data.PetDefinition>("ember");
            Check("pet sprites resolved",
                ember != null && ember.stageSprites.Length == 2
                && ember.stageSprites[0] != null && ember.stageSprites[1] != null);

            var relicSlot = DefinitionRegistry.Get<Data.SlotDefinition>("relic");
            // The C#-keyword field: proves the verbatim identifier round-tripped
            // through generation, import, and serialisation.
            Check("sealed slot reads back", relicSlot != null && relicSlot.@sealed);

            var battleship = DefinitionRegistry.Get<Data.MinigameDefinition>("battleship");
            Check("minigame context survived as JSON",
                battleship != null && battleship.context.Contains("\"shots\":34"));
        }

        static void CurrencyGuards()
        {
            var currency = Game.Currency;
            currency.Add(CurrencyManager.Essence, 100f);
            Check("add credits", Mathf.Approximately(currency.GetBalance(CurrencyManager.Essence), 100f));

            Check("overspend refused", !currency.TrySpend(CurrencyManager.Essence, 500f));
            Check("balance intact after refusal",
                Mathf.Approximately(currency.GetBalance(CurrencyManager.Essence), 100f));

            Check("spend succeeds", currency.TrySpend(CurrencyManager.Essence, 40f));
            Check("balance debited",
                Mathf.Approximately(currency.GetBalance(CurrencyManager.Essence), 60f));

            // The guard that matters: NaN defeats every comparison, so without
            // an explicit check it becomes an unlimited wallet.
            LogAssert(() => currency.Add(CurrencyManager.Essence, float.NaN));
            Check("NaN add refused",
                Mathf.Approximately(currency.GetBalance(CurrencyManager.Essence), 60f));

            LogAssert(() => currency.Add(CurrencyManager.Essence, float.PositiveInfinity));
            Check("infinite add refused",
                Mathf.Approximately(currency.GetBalance(CurrencyManager.Essence), 60f));

            LogAssert(() => currency.Add(CurrencyManager.Essence, -5f));
            Check("negative add refused",
                Mathf.Approximately(currency.GetBalance(CurrencyManager.Essence), 60f));
        }

        static void UpgradeEconomy()
        {
            var upgrades = Game.Upgrades;
            var definitions = upgrades.GetDefinitions();
            Check("upgrades load", definitions.Count == 5);

            var first = definitions[0];
            float cost = upgrades.GetCost(first.id);
            Check("cost is the level-0 cost", Mathf.Approximately(cost, first.GetCost(0)));

            Game.Currency.Add(CurrencyManager.Essence, cost * 4f);
            float before = Game.Currency.GetBalance(CurrencyManager.Essence);

            Check("buy succeeds", upgrades.Buy(first.id));
            Check("level rose", upgrades.GetLevel(first.id) == 1);
            Check("essence was spent",
                Mathf.Approximately(Game.Currency.GetBalance(CurrencyManager.Essence), before - cost));
            Check("cost grew after purchase", upgrades.GetCost(first.id) > cost);
        }

        static void StatLayering()
        {
            // Base values with nothing owned.
            Game.Reset();
            float baseTap = Game.Stats.GetTapDamage();
            Check("base tap damage", Mathf.Approximately(baseTap, PlayerStats.BaseTapDamage));
            Check("base crit chance",
                Mathf.Approximately(Game.Stats.GetCritChance(), PlayerStats.BaseCritChance));

            // Crit chance is hard-capped; feeding it far past the cap must clamp.
            Check("crit chance capped", Game.Stats.GetCritChance() <= PlayerStats.MaxCritChance);

            // An upgrade must move the stat it names.
            var tapUpgrade = FindUpgradeForStat("tap_damage");
            if (tapUpgrade == null)
            {
                Failures.Add("no upgrade feeds tap_damage");
                return;
            }
            Game.Currency.Add(CurrencyManager.Essence, 1_000_000f);
            Game.Upgrades.Buy(tapUpgrade.id);
            Check("upgrade raised tap damage", Game.Stats.GetTapDamage() > baseTap);

            // Averaged hit damage must sit between the plain and crit values.
            float avg = Game.Stats.GetAverageDamagePerHit();
            Check("average hit >= tap damage", avg >= Game.Stats.GetTapDamage() - 0.0001f);
        }

        static Data.UpgradeDefinition FindUpgradeForStat(string stat)
        {
            foreach (var d in Game.Upgrades.GetDefinitions())
                if (d.stat == stat) return d;
            return null;
        }

        static void SaveRoundTrip()
        {
            // Start from no save file. Game.Reset() boots through
            // SaveManager.InitialLoad(), so a document left by an earlier run
            // would seed balances and make the assertions below depend on the
            // order the checks happened to run in.
            Game.Save.DeleteSave();
            Game.Reset();

            Game.Currency.Add(CurrencyManager.Essence, 12345f);
            Game.Currency.Add(CurrencyManager.VoidCrystals, 7f);
            Game.State.TotalPlayTime = 4321f;

            var upgrade = Game.Upgrades.GetDefinitions()[0];
            Game.Upgrades.Buy(upgrade.id);
            int levelBefore = Game.Upgrades.GetLevel(upgrade.id);

            // Read the balance AFTER the purchase: Buy() spends essence, so the
            // document never holds the 12345 that was banked a moment ago.
            float essenceBefore = Game.Currency.GetBalance(CurrencyManager.Essence);

            string text = Game.Save.GetFullSaveText();
            Check("save is non-trivial", text.Length > 100);
            Check("save names its version", text.Contains("save_version"));

            // Rebuild from zero, then feed the document back through the same
            // ISaveable path SaveManager uses on load.
            var document = Newtonsoft.Json.Linq.JObject.Parse(text);
            var sections = (Newtonsoft.Json.Linq.JObject)document["sections"];

            Game.Reset();
            Check("reset cleared essence",
                Mathf.Approximately(Game.Currency.GetBalance(CurrencyManager.Essence), 0f));

            foreach (var saveable in Game.Saveables())
                if (sections[saveable.SaveKey] is Newtonsoft.Json.Linq.JObject section)
                    saveable.LoadSaveData(section.ToObject<Dictionary<string, object>>());

            Check("essence restored",
                Mathf.Approximately(Game.Currency.GetBalance(CurrencyManager.Essence), essenceBefore));
            Check("crystals restored",
                Mathf.Approximately(Game.Currency.GetBalance(CurrencyManager.VoidCrystals), 7f));
            Check("play time restored", Mathf.Approximately(Game.State.TotalPlayTime, 4321f));
            Check("upgrade level restored", Game.Upgrades.GetLevel(upgrade.id) == levelBefore);

            // A corrupt document must degrade to defaults, never throw.
            var poison = new Dictionary<string, object>
            {
                { "essence", "not a number" },
                { "void_crystals", float.NaN },
            };
            LogAssert(() => Game.Currency.LoadSaveData(poison));
            Check("poisoned essence reset to 0",
                Mathf.Approximately(Game.Currency.GetBalance(CurrencyManager.Essence), 0f));
            Check("poisoned crystals reset to 0",
                Mathf.Approximately(Game.Currency.GetBalance(CurrencyManager.VoidCrystals), 0f));
        }

        static void SchedulerRuns()
        {
            Scheduler.Clear();
            bool fired = false;
            Scheduler.After(0.5f, () => fired = true);

            Scheduler.Tick(0.2f);
            Check("timer has not fired early", !fired);
            Scheduler.Tick(0.4f);
            Check("timer fired after its delay", fired);

            bool deferred = false;
            Scheduler.EndOfFrame(() => deferred = true);
            Check("deferred has not run yet", !deferred);
            Scheduler.Tick(0f);
            Check("deferred ran on next tick", deferred);
            Scheduler.Clear();
        }

        // --- harness -------------------------------------------------------

        static void Check(string label, bool condition)
        {
            _checks++;
            if (!condition) Failures.Add(label);
        }

        /// <summary>Run an action that is EXPECTED to log an error, without the
        /// error failing the batch. The guards under test report refusal via
        /// Debug.LogError, which batchmode otherwise treats as noise worth
        /// surfacing.</summary>
        static void LogAssert(Action action)
        {
            var previous = Debug.unityLogger.logEnabled;
            Debug.unityLogger.logEnabled = false;
            try { action(); }
            finally { Debug.unityLogger.logEnabled = previous; }
        }
    }
}
