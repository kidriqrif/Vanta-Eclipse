// Ported from scripts/managers/currency_manager.gd
using System.Collections.Generic;
using UnityEngine;
using VantaEclipse.Core;

namespace VantaEclipse.Managers
{
    /// <summary>
    /// Single source of truth for every currency balance.
    ///
    /// All four game currencies live here from day one so later systems slot
    /// in without refactoring. Balances are floats: incremental-game numbers
    /// eventually outgrow 64-bit integers, and all display goes through
    /// NumberFormat anyway.
    ///
    /// Nothing outside this manager may change a balance. Earning goes through
    /// Add(), spending through TrySpend() — which refuses cleanly instead of
    /// going negative.
    /// </summary>
    public sealed class CurrencyManager : ISaveable
    {
        /// <summary>Main currency, earned from kills (Milestone 3+).</summary>
        public const string Essence = "essence";

        /// <summary>Prestige currency, earned by collapsing a run into the
        /// Eclipse (M8).</summary>
        public const string VoidCrystals = "void_crystals";

        /// <summary>Premium currency, bought in the Shop and spent on
        /// cosmetics (M14).</summary>
        public const string AstralShards = "astral_shards";

        /// <summary>Crafting material from salvaging gear (M6). Spent at the
        /// Forge.</summary>
        public const string VoidScraps = "void_scraps";

        readonly Dictionary<string, float> _balances = new()
        {
            { Essence, 0f },
            { VoidCrystals, 0f },
            { AstralShards, 0f },
            { VoidScraps, 0f },
        };

        public string SaveKey => "currencies";

        // --- Save contract -------------------------------------------------

        // The currency constants are themselves the save-file keys, so the
        // document and the balance table cannot drift apart.
        public Dictionary<string, object> GetSaveData() => new()
        {
            { Essence, _balances[Essence] },
            { VoidCrystals, _balances[VoidCrystals] },
            { AstralShards, _balances[AstralShards] },
            { VoidScraps, _balances[VoidScraps] },
        };

        public void LoadSaveData(Dictionary<string, object> data)
        {
            // SaveRead rejects NaN and infinity; the Max(0) is the balance-only
            // rule on top. Both halves matter, and neither is redundant:
            //
            // Clamping alone is not enough. JSON has no literal for infinity,
            // but a double that overflows parses to one, and Max(0, inf) is inf
            // while Max(0, NaN) is NaN — both sail straight through. The poison
            // is self-perpetuating: infinity round-trips through the save as a
            // huge literal and parses back to infinity on the next load, so a
            // single bad value survives every save from then on. A NaN balance
            // is worse than a large one: every comparison against NaN is false,
            // so the balance check in TrySpend() never refuses and the
            // subtraction leaves NaN behind — an unlimited wallet that also
            // never visibly changes.
            //
            // Reachable without a hex editor: this is an incremental game whose
            // numbers grow exponentially, so a long enough run can overflow a
            // float on its own.
            foreach (var currency in new[] { Essence, VoidCrystals, AstralShards, VoidScraps })
                _balances[currency] = Mathf.Max(0f, SaveRead.Float(data, currency));

            foreach (var pair in _balances)
                Game.Events.RaiseCurrencyChanged(pair.Key, pair.Value);
        }

        // --- Public API ----------------------------------------------------

        public float GetBalance(string currency)
        {
            if (!_balances.TryGetValue(currency, out var balance))
            {
                Debug.LogError($"CurrencyManager: unknown currency: {currency}");
                return 0f;
            }
            return balance;
        }

        public bool CanAfford(string currency, float amount) => GetBalance(currency) >= amount;

        /// <summary>Grant currency. Amount must be positive — spending goes
        /// through TrySpend().</summary>
        public void Add(string currency, float amount)
        {
            if (!_balances.ContainsKey(currency))
            {
                Debug.LogError($"CurrencyManager: unknown currency: {currency}");
                return;
            }
            // The finite check is load-bearing: every comparison against NaN is
            // false, so `amount < 0` alone waved NaN through and poisoned the
            // balance permanently. Infinity is refused here too — it only ever
            // arrives from a multiplier chain that has already overflowed,
            // which is the real bug.
            if (float.IsNaN(amount) || float.IsInfinity(amount) || amount < 0f)
            {
                Debug.LogError($"CurrencyManager: Add() amount must be a positive number, got {amount}");
                return;
            }
            _balances[currency] += amount;
            Game.Events.RaiseCurrencyChanged(currency, _balances[currency]);
        }

        /// <summary>Wipe the run currency on an Eclipse (M8). Only Eclipse
        /// Essence is run-scoped; Void Crystals, Astral Shards, and Void Scraps
        /// are all kept across prestige. Called by PrestigeManager only.</summary>
        public void ResetRunCurrency()
        {
            _balances[Essence] = 0f;
            Game.Events.RaiseCurrencyChanged(Essence, 0f);
        }

        /// <summary>Attempt to spend. Returns false (and changes nothing) if
        /// the balance is too low — callers decide how to present that.</summary>
        public bool TrySpend(string currency, float amount)
        {
            if (!_balances.TryGetValue(currency, out var balance))
            {
                Debug.LogError($"CurrencyManager: unknown currency: {currency}");
                return false;
            }
            if (float.IsNaN(amount) || float.IsInfinity(amount) || amount < 0f)
            {
                Debug.LogError($"CurrencyManager: TrySpend() amount must be a positive number, got {amount}");
                return false;
            }
            // A non-finite BALANCE is the dangerous direction: `NaN < amount`
            // is false, so without this the affordability test passes and every
            // price in the game becomes free. Refuse rather than repair, so the
            // error stays visible.
            if (float.IsNaN(balance) || float.IsInfinity(balance))
            {
                Debug.LogError($"CurrencyManager: {currency} balance is {balance} — refusing to spend.");
                return false;
            }
            if (balance < amount) return false;

            _balances[currency] = balance - amount;
            Game.Events.RaiseCurrencyChanged(currency, _balances[currency]);
            return true;
        }
    }
}
