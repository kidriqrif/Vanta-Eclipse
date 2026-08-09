using System;
using System.Collections.Generic;
using UnityEngine;
using VantaEclipse.Core;
using VantaEclipse.Data;

namespace VantaEclipse.Managers
{
    /// <summary>
    /// The Journal: the quest chain, the daily set, and achievements. Built
    /// after MinigameManager, whose token grant it pays with, and reads the
    /// live essence rate for essence rewards.
    ///
    /// Everything here is a LIFETIME record: an Eclipse never takes a counter,
    /// a completion, or a claim away. Nothing here is ever required to
    /// progress — the Journal tells the player what to do next and pays them
    /// for it, and that is all it does.
    /// </summary>
    public sealed class QuestManager : ISaveable
    {
        public const int DailyCount = 3;
        public const int SecondsPerDay = 86400;
        /// <summary>Bound on Evaluate()'s fast-forward loop.</summary>
        public const int EvaluatePasses = 32;
        /// <summary>How often the UTC day is re-checked. Load and Journal-open
        /// were the only two rollover moments, so a session left running across
        /// UTC midnight kept serving yesterday's goals — claims included.
        /// RefreshDailies() returns on its first comparison when the day has
        /// not moved, so this costs nothing.</summary>
        public const float DailyRolloverPollSeconds = 60f;

        /// <summary>Metric -> value. Cumulative metrics only; snapshots are
        /// queried.</summary>
        readonly Dictionary<string, float> _counters = new();
        /// <summary>Both latched: a completion never un-completes (a snapshot
        /// metric can fall back below target when a balance is spent) and a
        /// claim is final.</summary>
        readonly HashSet<string> _completed = new();
        readonly HashSet<string> _claimed = new();

        /// <summary>Today's daily ids, the UTC day they were drawn for, and the
        /// counter values they started from (lifetime counters must be measured
        /// from the day's start).</summary>
        readonly List<string> _dailyIds = new();
        long _dailyDay;
        readonly Dictionary<string, float> _dailyBaseline = new();

        /// <summary>Last seen token count, so a decrease reads as a spend.</summary>
        int _lastTokenCount;
        float _rolloverTimer;

        public string SaveKey => "journal";

        public QuestManager()
        {
            Game.Events.GameLoaded += OnGameLoaded;
            Game.Events.EnemyDied += (level, kills) => Bump("kills");
            Game.Events.BossFightWon += (level, payout, world) => Bump("boss_wins");
            Game.Events.EssenceEarned += OnEssenceEarned;
            Game.Events.ItemDropped += item => Bump("items_dropped");
            Game.Events.MinigameFinished += OnMinigameFinished;
            Game.Events.EclipsePerformed += (reward, count) => Bump("eclipses");
            Game.Events.UpgradePurchased += (id, level) => Bump("upgrades_bought");
            Game.Events.ArcadeTokensChanged += OnArcadeTokensChanged;
        }

        IReadOnlyList<QuestDefinition> Definitions
        {
            get
            {
                if (_sorted != null) return _sorted;
                var all = new List<QuestDefinition>(DefinitionRegistry.All<QuestDefinition>());
                // Kind first, then sortOrder — the display grouping the Journal
                // relies on. DefinitionRegistry sorts by sortOrder alone, which
                // would interleave the three kinds.
                all.Sort((a, b) => a.kind != b.kind
                    ? a.kind.CompareTo(b.kind)
                    : a.sortOrder.CompareTo(b.sortOrder));
                _sorted = all;
                return _sorted;
            }
        }
        List<QuestDefinition> _sorted;

        /// <summary>Driven by GameRuntime; this is the daily rollover
        /// clock.</summary>
        public void Tick(float deltaTime)
        {
            _rolloverTimer += deltaTime;
            if (_rolloverTimer < DailyRolloverPollSeconds) return;
            _rolloverTimer = 0f;
            RefreshDailies();
        }

        // --- Save contract -------------------------------------------------

        public Dictionary<string, object> GetSaveData()
        {
            var counters = new Dictionary<string, object>();
            foreach (var pair in _counters) counters[pair.Key] = pair.Value;
            var baseline = new Dictionary<string, object>();
            foreach (var pair in _dailyBaseline) baseline[pair.Key] = pair.Value;

            var completed = new Dictionary<string, object>();
            foreach (var id in _completed) completed[id] = true;
            var claimed = new Dictionary<string, object>();
            foreach (var id in _claimed) claimed[id] = true;

            return new Dictionary<string, object>
            {
                { "counters", counters },
                { "completed", completed },
                { "claimed", claimed },
                { "daily_ids", new List<object>(_dailyIds) },
                { "daily_day", _dailyDay },
                { "daily_baseline", baseline },
            };
        }

        public void LoadSaveData(Dictionary<string, object> data)
        {
            _counters.Clear();
            var counters = SaveRead.Section(data, "counters");
            foreach (var key in counters.Keys) _counters[key] = SaveRead.Float(counters, key);

            _dailyBaseline.Clear();
            var baseline = SaveRead.Section(data, "daily_baseline");
            foreach (var key in baseline.Keys) _dailyBaseline[key] = SaveRead.Float(baseline, key);

            _completed.Clear();
            foreach (var key in SaveRead.Section(data, "completed").Keys)
                if (DefinitionRegistry.Has<QuestDefinition>(key)) _completed.Add(key);

            _claimed.Clear();
            foreach (var key in SaveRead.Section(data, "claimed").Keys)
                if (DefinitionRegistry.Has<QuestDefinition>(key)) _claimed.Add(key);

            _dailyIds.Clear();
            foreach (var raw in SaveRead.Array(data, "daily_ids"))
            {
                string id = raw as string ?? raw?.ToString() ?? "";
                if (DefinitionRegistry.Has<QuestDefinition>(id)) _dailyIds.Add(id);
            }

            _dailyDay = Math.Max(0, SaveRead.Long(data, "daily_day"));
        }

        // --- Reads ---------------------------------------------------------

        public QuestDefinition GetDefinition(string id)
            => DefinitionRegistry.Has<QuestDefinition>(id)
                ? DefinitionRegistry.Get<QuestDefinition>(id)
                : null;

        /// <summary>Goals of one kind, in display order. QUEST returns the
        /// chain up to and including the active link — locked links are never
        /// shown, so the chain reads as a path rather than a wall.</summary>
        public List<QuestDefinition> GetGoals(QuestDefinition.Kind kind)
        {
            var output = new List<QuestDefinition>();

            if (kind == QuestDefinition.Kind.DAILY)
            {
                foreach (var id in _dailyIds)
                {
                    var daily = GetDefinition(id);
                    if (daily != null) output.Add(daily);
                }
                return output;
            }

            foreach (var definition in Definitions)
            {
                if (definition.kind != kind) continue;
                if (kind == QuestDefinition.Kind.QUEST
                    && !_claimed.Contains(definition.id)
                    && !_completed.Contains(definition.id))
                {
                    // Everything done or awaiting a claim is shown; the first
                    // link that is neither is the active one, and the chain
                    // stops after it.
                    output.Add(definition);
                    return output;
                }
                output.Add(definition);
            }
            return output;
        }

        /// <summary>Progress toward a goal's target, already clamped at the
        /// target.</summary>
        public float GetProgress(QuestDefinition definition)
        {
            float raw;
            if (definition.metricShape == QuestDefinition.MetricShape.SNAPSHOT)
            {
                raw = Snapshot(definition.metric);
            }
            else
            {
                raw = _counters.TryGetValue(definition.metric, out var v) ? v : 0f;
                if (definition.kind == QuestDefinition.Kind.DAILY)
                {
                    // Lifetime counters must be measured from the day's start,
                    // or a player with 50,000 kills completes every kill-daily
                    // instantly.
                    raw -= _dailyBaseline.TryGetValue(definition.metric, out var b) ? b : 0f;
                }
            }
            return Mathf.Clamp(raw, 0f, definition.target);
        }

        public bool IsClaimed(QuestDefinition definition) => _claimed.Contains(definition.id);

        public bool IsClaimable(QuestDefinition definition)
            => _completed.Contains(definition.id) && !_claimed.Contains(definition.id);

        public int GetUnclaimedCount()
        {
            int count = 0;
            foreach (QuestDefinition.Kind kind in Enum.GetValues(typeof(QuestDefinition.Kind)))
                foreach (var definition in GetGoals(kind))
                    if (IsClaimable(definition)) count++;
            return count;
        }

        public int SecondsUntilDailyReset()
        {
            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            long dayStart = (now / SecondsPerDay) * SecondsPerDay;
            return (int)Math.Max(0, dayStart + SecondsPerDay - now);
        }

        // --- Claiming ------------------------------------------------------

        /// <summary>Pay out a completed goal. Returns the reward text, or "" if
        /// refused — refusing an already-claimed goal is what makes a
        /// double-tap safe.</summary>
        public string Claim(string id)
        {
            var definition = GetDefinition(id);
            if (definition == null || !IsClaimable(definition)) return "";

            if (definition.rewardKind == QuestDefinition.RewardKind.ARCADE_TOKENS
                && !Game.Arcade.HasTokenRoom((int)definition.rewardAmount))
            {
                // Paying into a full meter would silently discard the reward.
                // Refuse, so it stays claimable until there is room; the UI
                // says why.
                return "";
            }

            _claimed.Add(id);
            switch (definition.rewardKind)
            {
                case QuestDefinition.RewardKind.ARCADE_TOKENS:
                    Game.Arcade.GrantToken((int)definition.rewardAmount);
                    break;
                case QuestDefinition.RewardKind.VOID_CRYSTALS:
                    Game.Currency.Add(CurrencyManager.VoidCrystals, definition.rewardAmount);
                    break;
                case QuestDefinition.RewardKind.ASTRAL_SHARDS:
                    Game.Currency.Add(CurrencyManager.AstralShards, definition.rewardAmount);
                    break;
                default:
                {
                    float amount = Mathf.Max(1f, Mathf.Floor(
                        Game.Idle.GetLiveEssenceRate() * definition.rewardAmount));
                    Game.Currency.Add(CurrencyManager.Essence, amount);
                    Game.Events.RaiseEssenceEarned(amount, "quest");
                    break;
                }
            }

            Game.Save.SaveGame();
            string text = definition.FormatReward();
            Game.Events.RaiseGoalClaimed(id, text);
            // Claiming a chain link reveals the next one, which an advanced
            // save may already satisfy — latch it now rather than waiting for
            // the next kill.
            Evaluate();
            return text;
        }

        /// <summary>Lifetime records — an Eclipse never takes them away.</summary>
        public void ResetForPrestige() { }

        // --- Internals -----------------------------------------------------

        float Snapshot(string metric)
        {
            switch (metric)
            {
                case "enemy_level": return Game.Prestige.LifetimePeakLevel;
                case "relics_owned": return Game.Relics.GetOwned().Count;
                case "pets_owned":
                {
                    int count = 0;
                    foreach (var _ in Game.Pets.GetOwnedIds()) count++;
                    return count;
                }
                case "crystals": return Game.Currency.GetBalance(CurrencyManager.VoidCrystals);
                case "skill_levels":
                {
                    float total = 0f;
                    foreach (var skill in Game.Skills.GetDefinitions())
                        total += Game.Skills.GetLevel(skill.id);
                    return total;
                }
            }
            return 0f;
        }

        void Bump(string metric, float amount = 1f)
        {
            _counters[metric] = (_counters.TryGetValue(metric, out var v) ? v : 0f) + amount;
            Evaluate();
        }

        /// <summary>Latch any newly-complete goal in the ACTIVE set. Driven by
        /// events and by opening the Journal — walking every definition every
        /// frame would be wasted work for a screen visited occasionally.</summary>
        public void Evaluate()
        {
            // Repeat while anything latches: completing a chain link reveals
            // the next, which may already be satisfied on an advanced save.
            // Bounded so a data error can never spin here.
            for (int pass = 0; pass < EvaluatePasses; pass++)
                if (!EvaluateOnce()) return;
        }

        bool EvaluateOnce()
        {
            bool latched = false;
            foreach (QuestDefinition.Kind kind in Enum.GetValues(typeof(QuestDefinition.Kind)))
            {
                foreach (var definition in GetGoals(kind))
                {
                    if (_completed.Contains(definition.id)) continue;
                    if (GetProgress(definition) >= definition.target)
                    {
                        _completed.Add(definition.id);
                        latched = true;
                        Game.Events.RaiseGoalCompleted(definition.id);
                    }
                }
            }
            return latched;
        }

        /// <summary>Draw a fresh daily set when the UTC day advances.</summary>
        public void RefreshDailies()
        {
            long today = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / SecondsPerDay;
            // STRICTLY greater: a backwards-set clock must never reroll into a
            // fresh set of goals.
            if (today <= _dailyDay && _dailyIds.Count > 0) return;

            var pool = new List<QuestDefinition>();
            foreach (var definition in Definitions)
                if (definition.kind == QuestDefinition.Kind.DAILY) pool.Add(definition);
            Shuffle(pool);

            // Yesterday's state goes with yesterday's goals, including anything
            // left unclaimed — the UI states the reset time so this is never a
            // surprise.
            foreach (var id in _dailyIds)
            {
                _completed.Remove(id);
                _claimed.Remove(id);
            }
            _dailyIds.Clear();
            _dailyBaseline.Clear();

            int take = Mathf.Min(DailyCount, pool.Count);
            for (int i = 0; i < take; i++)
            {
                var definition = pool[i];
                _dailyIds.Add(definition.id);
                _completed.Remove(definition.id);
                _claimed.Remove(definition.id);
                if (definition.metricShape == QuestDefinition.MetricShape.CUMULATIVE)
                    _dailyBaseline[definition.metric] =
                        _counters.TryGetValue(definition.metric, out var v) ? v : 0f;
            }

            _dailyDay = today;
            Game.Events.RaiseDailiesRerolled();
        }

        static void Shuffle<T>(IList<T> list)
        {
            for (int i = list.Count - 1; i > 0; i--)
            {
                int j = UnityEngine.Random.Range(0, i + 1);
                (list[i], list[j]) = (list[j], list[i]);
            }
        }

        void OnGameLoaded(bool isNewGame)
        {
            _lastTokenCount = Game.Arcade.Tokens;
            RefreshDailies();
            // Latch everything an existing save already satisfies, so an
            // advanced player is not walked back through the tutorial chain.
            Evaluate();
        }

        void OnEssenceEarned(float amount, string source)
        {
            // Quest payouts are excluded: crediting them would let an essence
            // reward feed the very counter that pays it.
            if (source != "quest") Bump("essence_earned", amount);
        }

        void OnMinigameFinished(string id, int outcome, float payout)
        {
            // A forfeit is not a game played — it would otherwise let a player
            // farm the "play N games" daily by entering and quitting.
            if (outcome == (int)MinigameOutcome.Quit) return;
            Bump("minigames_played");
            if (outcome == (int)MinigameOutcome.Win) Bump("minigames_won");
        }

        /// <summary>Tokens only ever leave the meter by being spent on a game.</summary>
        void OnArcadeTokensChanged(int count)
        {
            if (count < _lastTokenCount) Bump("tokens_spent", _lastTokenCount - count);
            _lastTokenCount = count;
        }
    }
}
