// Ported from scripts/managers/minigame_manager.gd
using System;
using System.Collections.Generic;
using UnityEngine;
using VantaEclipse.Core;
using VantaEclipse.Data;

namespace VantaEclipse.Managers
{
    /// <summary>
    /// Owns the Arcade: minigame definitions, the Arcade Token meter, per-game
    /// records, and payout pricing. Built after IdleManager, whose live essence
    /// rate prices every reward.
    ///
    /// Tokens and records are META: kept across an Eclipse, like Void Crystals.
    /// Nothing here ever gates progression — the Arcade is a side door.
    /// </summary>
    public sealed class MinigameManager : ISaveable
    {
        public const int TokenCap = 5;
        /// <summary>Real seconds per regenerated token (2.5h to refill a spent
        /// meter).</summary>
        public const int TokenRegenSeconds = 1800;
        /// <summary>Chance a boss win also yields a token, so active play feeds
        /// the Arcade.</summary>
        public const float BossTokenChance = 0.10f;
        /// <summary>Fraction of the scaled reward a LOSS/QUIT still pays —
        /// attempting is never punished, it is just worth less than
        /// winning.</summary>
        public const float LossFloor = 0.25f;
        public const int ArcadeUnlockLevel = 20;

        /// <summary>Which minigame the host should load. The hub sets it
        /// immediately before changing scenes, and the host clears it on
        /// read.</summary>
        public string PendingId = "";

        public int Tokens = TokenCap;

        /// <summary>Minigame id -> best score.</summary>
        readonly Dictionary<string, float> _best = new();
        /// <summary>Unix time the current partial token started accruing
        /// from.</summary>
        long _regenAnchorUnix;
        bool _unlockAnnounced;

        public string SaveKey => "arcade";

        public MinigameManager()
        {
            Game.Events.GameLoaded += OnGameLoaded;
            Game.Events.BossFightWon += OnBossFightWon;
        }

        static long NowUnix => DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        // --- Save contract -------------------------------------------------

        public Dictionary<string, object> GetSaveData()
        {
            var best = new Dictionary<string, object>();
            foreach (var pair in _best) best[pair.Key] = pair.Value;
            return new Dictionary<string, object>
            {
                { "tokens", Tokens },
                { "regen_anchor_unix", _regenAnchorUnix },
                { "unlock_announced", _unlockAnnounced },
                { "best", best },
            };
        }

        public void LoadSaveData(Dictionary<string, object> data)
        {
            // An absent section never reaches here, so a pre-Arcade save keeps
            // the full meter it was initialised with — the update's welcome
            // gift.
            Tokens = Mathf.Clamp(SaveRead.Int(data, "tokens", TokenCap), 0, TokenCap);
            _regenAnchorUnix = Math.Max(0, SaveRead.Long(data, "regen_anchor_unix"));
            _unlockAnnounced = SaveRead.Bool(data, "unlock_announced");

            _best.Clear();
            var rawBest = SaveRead.Section(data, "best");
            foreach (var key in rawBest.Keys)
                if (DefinitionRegistry.Has<MinigameDefinition>(key))
                    _best[key] = SaveRead.Float(rawBest, key);
        }

        // --- Definitions ---------------------------------------------------

        public IReadOnlyList<MinigameDefinition> GetDefinitions()
            => DefinitionRegistry.All<MinigameDefinition>();

        public MinigameDefinition GetDefinition(string id)
            => DefinitionRegistry.Has<MinigameDefinition>(id)
                ? DefinitionRegistry.Get<MinigameDefinition>(id)
                : null;

        public bool IsUnlocked(MinigameDefinition definition)
            => Game.Combat.EnemyLevel >= definition.unlockLevel;

        public bool IsArcadeUnlocked()
            => _unlockAnnounced || Game.Combat.EnemyLevel >= ArcadeUnlockLevel;

        // --- Tokens --------------------------------------------------------

        /// <summary>Bring the meter up to date with wall-clock time. Safe to
        /// call often.</summary>
        public void AccrueTokens()
        {
            long now = NowUnix;
            if (Tokens >= TokenCap)
            {
                // A full meter never banks time: idling at cap for a day must
                // not hand out instant tokens the moment one is spent.
                _regenAnchorUnix = now;
                return;
            }
            if (_regenAnchorUnix <= 0)
            {
                _regenAnchorUnix = now;
                return;
            }

            // Clamped at zero so a backwards-set clock can never grant or go
            // negative.
            long elapsed = Math.Max(0, now - _regenAnchorUnix);
            long gained = elapsed / TokenRegenSeconds;
            if (gained <= 0) return;

            int before = Tokens;
            Tokens = (int)Math.Min(TokenCap, Tokens + gained);

            // Advance by exactly what was consumed so the remainder carries;
            // snap to now if the cap absorbed the rest.
            if (Tokens >= TokenCap) _regenAnchorUnix = now;
            else _regenAnchorUnix += gained * TokenRegenSeconds;

            if (Tokens != before) Game.Events.RaiseArcadeTokensChanged(Tokens);
        }

        public int SecondsUntilNextToken()
        {
            AccrueTokens();
            if (Tokens >= TokenCap) return 0;
            long elapsed = Math.Max(0, NowUnix - _regenAnchorUnix);
            return (int)Math.Max(0, TokenRegenSeconds - elapsed);
        }

        public bool HasToken(int cost = 1)
        {
            AccrueTokens();
            return Tokens >= cost;
        }

        /// <summary>Spend entry cost. Returns false (changing nothing) when
        /// short.</summary>
        public bool TrySpendToken(int cost = 1)
        {
            AccrueTokens();
            if (Tokens < cost) return false;

            // Starting the anchor here means the next token begins accruing
            // from the moment the meter left full, not from a stale timestamp.
            if (Tokens >= TokenCap) _regenAnchorUnix = NowUnix;

            Tokens -= cost;
            Game.Events.RaiseArcadeTokensChanged(Tokens);
            Game.Save.SaveGame();
            return true;
        }

        /// <summary>Whether a grant of this size would actually land rather
        /// than hit the cap.</summary>
        public bool HasTokenRoom(int count = 1)
        {
            AccrueTokens();
            return Tokens + count <= TokenCap;
        }

        public void GrantToken(int count = 1)
        {
            AccrueTokens();
            int before = Tokens;
            Tokens = Mathf.Min(TokenCap, Tokens + count);
            if (Tokens == before) return;  // at cap: absorbed silently

            Game.Events.RaiseArcadeTokensChanged(Tokens);
            // Persist the grant itself. WorldManager saves earlier in the
            // boss-win chain, so without this the token would be lost to a
            // force-kill.
            Game.Save.SaveGame();
        }

        // --- Payout & records ----------------------------------------------

        /// <summary>Essence a run pays: seconds-of-current-rate scaled by
        /// performance. Read live, so a win is worth "about N minutes of
        /// progress" at any power level.</summary>
        public float ComputePayout(MinigameDefinition definition, float performance)
        {
            float rate = Game.Idle.GetLiveEssenceRate();
            float seconds = definition.rewardSeconds * Mathf.Clamp01(performance);
            return Mathf.Max(1f, Mathf.Floor(rate * seconds));
        }

        public float GetBest(string id) => _best.TryGetValue(id, out var best) ? best : 0f;
        public bool HasBest(string id) => _best.ContainsKey(id);

        /// <summary>Record a run's score. Returns true when it beat the
        /// previous best. A first run only sets a record if it actually
        /// scored — otherwise a forfeit would write "Best: 0" permanently and
        /// claim a new record doing it.</summary>
        public bool RecordResult(string id, float score)
        {
            var definition = GetDefinition(id);
            if (definition == null) return false;

            if (!_best.TryGetValue(id, out var previous))
            {
                if (score <= 0f) return false;
                _best[id] = score;
                return true;
            }

            bool beaten = definition.lowerIsBetter ? score < previous : score > previous;
            if (!beaten) return false;
            _best[id] = score;
            return true;
        }

        /// <summary>The Arcade is meta — an Eclipse never takes tokens or
        /// records away.</summary>
        public void ResetForPrestige() { }

        // --- Internals -----------------------------------------------------

        void OnGameLoaded(bool isNewGame)
        {
            if (_regenAnchorUnix <= 0) _regenAnchorUnix = NowUnix;
            AccrueTokens();

            // A save already past the gate is grandfathered silently; the
            // banner only ever plays on a live crossing. Subscribed here (not
            // in the constructor) so CombatManager's load-time spawn is never
            // read as one.
            if (Game.Combat.EnemyLevel >= ArcadeUnlockLevel) _unlockAnnounced = true;
            Game.Events.EnemySpawned += OnEnemySpawned;
        }

        void OnEnemySpawned(EnemyDefinition definition, int level, float maxHp)
        {
            if (_unlockAnnounced || Game.Combat.EnemyLevel < ArcadeUnlockLevel) return;
            _unlockAnnounced = true;
            Game.Save.SaveGame();
            Game.Events.RaiseArcadeUnlocked();
        }

        void OnBossFightWon(int level, float payout, bool isWorldBoss)
        {
            if (UnityEngine.Random.value < BossTokenChance) GrantToken();
        }
    }
}
