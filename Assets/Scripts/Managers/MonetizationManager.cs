using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using VantaEclipse.Core;
using VantaEclipse.Data;
using VantaEclipse.Monetization;

namespace VantaEclipse.Managers
{
    /// <summary>
    /// Opt-in ad offers, purchases, entitlements and cosmetics.
    ///
    /// THE STANCE (GDD, non-negotiable): no mechanic is ever pay-gated. Every
    /// ad is offered and opt-in, never interstitial; every ad reward is a bonus
    /// on top of something already earned, never a gate on receiving it;
    /// declining is never punished. Offers are capped per day so "grind ads" is
    /// never optimal.
    ///
    /// DEVELOPMENT BUILD: while UseStubProviders is true, nothing is charged
    /// and no real ad is shown. Real providers, receipt validation, and
    /// flipping the flag are blocking release work.
    /// </summary>
    public sealed class MonetizationManager : ISaveable
    {
        /// <summary>TODO(pre-release, BLOCKING): set false once UnityAdProvider
        /// and UnityBillingProvider are implemented. The Shop shows a
        /// development banner while this is true.</summary>
        public const bool UseStubProviders = true;

        /// <summary>
        /// Whether any surface that takes real money — or claims to show an
        /// ad — may be put in front of a player.
        ///
        /// False while the providers are stubs, and that is a shipping
        /// safeguard, not a debug convenience: StubBillingProvider.Purchase()
        /// returns true without charging anything, so a released stub build
        /// would hand out remove_ads and shard packs for free to anyone who
        /// tapped BUY. StubAdProvider is a three-second timer, so its "watch an
        /// ad" button is a button that lies.
        ///
        /// This makes a monetization-free v1 shippable from the same codebase:
        /// nothing is deleted, and the Shop's offers, the arcade token offer
        /// and the offline doubler all reappear the moment real providers land.
        ///
        /// Note the consequence while it is false: Astral Shards can only be
        /// earned (420 from the collection trophies), never bought, so the two
        /// most expensive trails stay out of reach until monetization ships.
        /// </summary>
        public const bool PaidSurfacesAvailable = !UseStubProviders;

        public const int SecondsPerDay = 86400;
        public const string DefaultCosmetic = "trail_void";

        /// <summary>Placement id -> offers used today; keyed to the UTC day
        /// like the Journal's dailies, and reset only when the day strictly
        /// advances.</summary>
        readonly Dictionary<string, int> _adUses = new();
        long _adDay;
        /// <summary>Product id -> true, for non-consumables.</summary>
        readonly HashSet<string> _entitlements = new();
        readonly HashSet<string> _ownedCosmetics = new();
        string _equippedCosmetic = DefaultCosmetic;
        /// <summary>True while an offer or purchase is in flight, so a
        /// double-tap cannot run two.</summary>
        bool _busy;

        readonly IAdProvider _ads;
        readonly IBillingProvider _billing;

        public string SaveKey => "shop";

        public MonetizationManager()
        {
            _ads = UseStubProviders ? new StubAdProvider() : (IAdProvider)new UnityAdProvider();
            _billing = UseStubProviders
                ? new StubBillingProvider()
                : (IBillingProvider)new UnityBillingProvider();
            Game.Events.GameLoaded += OnGameLoaded;
        }

        IReadOnlyList<AdPlacementDefinition> Placements
            => DefinitionRegistry.All<AdPlacementDefinition>();
        IReadOnlyList<ShopProductDefinition> Products
            => DefinitionRegistry.All<ShopProductDefinition>();
        IReadOnlyList<CosmeticDefinition> Cosmetics
            => DefinitionRegistry.All<CosmeticDefinition>();

        // --- Save contract -------------------------------------------------

        public Dictionary<string, object> GetSaveData()
        {
            var uses = new Dictionary<string, object>();
            foreach (var pair in _adUses) uses[pair.Key] = pair.Value;

            return new Dictionary<string, object>
            {
                { "ad_uses", uses },
                { "ad_day", _adDay },
                { "entitlements", new List<object>(_entitlements) },
                { "owned_cosmetics", new List<object>(_ownedCosmetics) },
                { "equipped_cosmetic", _equippedCosmetic },
            };
        }

        public void LoadSaveData(Dictionary<string, object> data)
        {
            _adUses.Clear();
            var uses = SaveRead.Section(data, "ad_uses");
            foreach (var key in uses.Keys) _adUses[key] = SaveRead.Int(uses, key);
            _adDay = Math.Max(0, SaveRead.Long(data, "ad_day"));

            _entitlements.Clear();
            foreach (var raw in SaveRead.Array(data, "entitlements"))
            {
                // Deliberately NOT filtered against the loaded definitions: a
                // product asset that failed to load must never silently erase
                // something the player paid for. An unknown entitlement is
                // inert but preserved.
                string id = raw as string ?? raw?.ToString() ?? "";
                if (!string.IsNullOrEmpty(id)) _entitlements.Add(id);
            }

            _ownedCosmetics.Clear();
            foreach (var raw in SaveRead.Array(data, "owned_cosmetics"))
            {
                string id = raw as string ?? raw?.ToString() ?? "";
                if (DefinitionRegistry.Has<CosmeticDefinition>(id)) _ownedCosmetics.Add(id);
            }

            string equipped = SaveRead.Str(data, "equipped_cosmetic");
            _equippedCosmetic = DefinitionRegistry.Has<CosmeticDefinition>(equipped)
                ? equipped
                : DefaultCosmetic;
        }

        // --- Reads ---------------------------------------------------------

        /// <summary>Placements the Shop may list — contextual ones are surfaced
        /// by the moment they belong to (the offline modal), where they have
        /// something to act on.</summary>
        public List<AdPlacementDefinition> GetShopPlacements()
        {
            var output = new List<AdPlacementDefinition>();
            foreach (var placement in Placements)
                if (!placement.contextual) output.Add(placement);
            return output;
        }

        public IReadOnlyList<ShopProductDefinition> GetProducts() => Products;
        public IReadOnlyList<CosmeticDefinition> GetCosmetics() => Cosmetics;

        public bool OwnsCosmetic(string id)
            => id == DefaultCosmetic || _ownedCosmetics.Contains(id);

        public CosmeticDefinition GetEquippedCosmetic()
        {
            if (DefinitionRegistry.Has<CosmeticDefinition>(_equippedCosmetic))
                return DefinitionRegistry.Get<CosmeticDefinition>(_equippedCosmetic);
            return DefinitionRegistry.Has<CosmeticDefinition>(DefaultCosmetic)
                ? DefinitionRegistry.Get<CosmeticDefinition>(DefaultCosmetic)
                : null;
        }

        public string GetEquippedCosmeticId() => _equippedCosmetic;

        public bool HasEntitlement(string id) => _entitlements.Contains(id);

        /// <summary>Non-consumables (entitlements and one-time bundles) already
        /// owned. Shard packs are consumable and always re-purchasable.</summary>
        public bool IsOneTimeOwned(ShopProductDefinition product)
            => product.kind != ShopProductDefinition.Kind.SHARDS
               && _entitlements.Contains(product.id);

        /// <summary>Owning remove_ads turns every offer into a free, instant
        /// one-tap bonus. It removes the chore, never the benefit — and the
        /// daily caps still apply, so it cannot break the economy.</summary>
        public bool AdsRemoved() => HasEntitlement("remove_ads");

        public int OffersLeft(string id)
        {
            RollAdDay();
            if (!DefinitionRegistry.Has<AdPlacementDefinition>(id)) return 0;
            var placement = DefinitionRegistry.Get<AdPlacementDefinition>(id);
            int used = _adUses.TryGetValue(id, out var u) ? u : 0;
            return Mathf.Max(0, placement.dailyCap - used);
        }

        /// <summary>Every ad surface already asks this before showing a button,
        /// and RunOffer re-checks it before granting — so gating it here closes
        /// the Arcade's token offer, the offline doubler, the Shop's offer
        /// cards and any future placement in one place.</summary>
        public bool CanOffer(string id)
            => PaidSurfacesAvailable && !_busy && OffersLeft(id) > 0;

        public bool IsBusy() => _busy;

        // --- Offers --------------------------------------------------------

        /// <summary>
        /// Run an opt-in offer. pendingAmount is only used by MULTIPLY_PENDING
        /// (the offline doubler). The callback receives the amount granted, or
        /// 0 if declined/unavailable.
        ///
        /// The caller must already have granted the base reward: an offer is
        /// always a bonus on top, never a gate on receiving it.
        ///
        /// A coroutine, so the caller drives it from a MonoBehaviour:
        /// StartCoroutine(Game.Shop.RunOffer(id, 0, granted => ...)).
        /// </summary>
        public IEnumerator RunOffer(string id, float pendingAmount, Action<float> onComplete)
        {
            if (!CanOffer(id) || !DefinitionRegistry.Has<AdPlacementDefinition>(id))
            {
                onComplete?.Invoke(0f);
                yield break;
            }
            var placement = DefinitionRegistry.Get<AdPlacementDefinition>(id);

            _busy = true;

            // remove_ads skips the watch entirely; everyone else watches.
            bool watched = true;
            if (!AdsRemoved())
                yield return _ads.RequestRewarded(id, result => watched = result);

            if (!watched)
            {
                _busy = false;
                onComplete?.Invoke(0f);
                yield break;
            }

            float granted = Grant(placement, pendingAmount);
            if (granted <= 0f)
            {
                // A watch that yielded nothing must not cost the player an
                // offer. Reachable when a contextual placement is run without
                // its context.
                _busy = false;
                onComplete?.Invoke(0f);
                yield break;
            }

            // Count the use only on a completed watch that actually paid, so a
            // failed, dismissed, or empty offer never burns one of the dailies.
            _adUses[id] = (_adUses.TryGetValue(id, out var used) ? used : 0) + 1;
            Game.Save.SaveGame();
            _busy = false;
            Game.Events.RaiseAdRewardGranted(id, granted);
            onComplete?.Invoke(granted);
        }

        float Grant(AdPlacementDefinition placement, float pendingAmount)
        {
            switch (placement.rewardKind)
            {
                case AdPlacementDefinition.RewardKind.ARCADE_TOKENS:
                    Game.Arcade.GrantToken((int)placement.rewardAmount);
                    return placement.rewardAmount;

                case AdPlacementDefinition.RewardKind.MULTIPLY_PENDING:
                {
                    float bonus = Mathf.Floor(Mathf.Max(0f, pendingAmount) * placement.rewardAmount);
                    if (bonus <= 0f) return 0f;
                    Game.Currency.Add(CurrencyManager.Essence, bonus);
                    Game.Events.RaiseEssenceEarned(bonus, "ad_bonus");
                    return bonus;
                }

                default:
                {
                    float amount = Mathf.Max(1f, Mathf.Floor(
                        Game.Idle.GetLiveEssenceRate() * placement.rewardAmount));
                    Game.Currency.Add(CurrencyManager.Essence, amount);
                    Game.Events.RaiseEssenceEarned(amount, "ad_bonus");
                    return amount;
                }
            }
        }

        // --- Purchases -----------------------------------------------------

        /// <summary>Buy a product. Refuses re-buying an entitlement, so a
        /// double-tap is safe.</summary>
        public IEnumerator Purchase(string id, Action<bool> onComplete)
        {
            if (!DefinitionRegistry.Has<ShopProductDefinition>(id)
                || _busy || !PaidSurfacesAvailable)
            {
                onComplete?.Invoke(false);
                yield break;
            }
            var product = DefinitionRegistry.Get<ShopProductDefinition>(id);
            if (IsOneTimeOwned(product))
            {
                onComplete?.Invoke(false);
                yield break;
            }

            _busy = true;
            bool bought = false;
            yield return _billing.Purchase(id, result => bought = result);

            if (!bought)
            {
                _busy = false;
                onComplete?.Invoke(false);
                yield break;
            }

            if (product.kind != ShopProductDefinition.Kind.SHARDS)
            {
                // Entitlements AND one-time bundles are both non-consumable:
                // without a record, a bundle could be bought forever and a
                // restore could never give it back.
                _entitlements.Add(id);
            }
            if (product.crystals > 0f)
                Game.Currency.Add(CurrencyManager.VoidCrystals, product.crystals);
            if (product.shards > 0f)
                Game.Currency.Add(CurrencyManager.AstralShards, product.shards);
            if (product.tokens > 0) Game.Arcade.GrantToken(product.tokens);
            if (!string.IsNullOrEmpty(product.cosmeticId)
                && DefinitionRegistry.Has<CosmeticDefinition>(product.cosmeticId))
                _ownedCosmetics.Add(product.cosmeticId);

            Game.Save.SaveGame();
            _busy = false;
            Game.Events.RaisePurchaseCompleted(id);
            onComplete?.Invoke(true);
        }

        // --- Cosmetics -----------------------------------------------------

        /// <summary>Buy a cosmetic with Astral Shards. Returns true on
        /// success.</summary>
        public bool BuyCosmetic(string id)
        {
            if (!DefinitionRegistry.Has<CosmeticDefinition>(id) || OwnsCosmetic(id)) return false;
            var cosmetic = DefinitionRegistry.Get<CosmeticDefinition>(id);
            if (!Game.Currency.TrySpend(CurrencyManager.AstralShards, cosmetic.shardPrice))
                return false;
            _ownedCosmetics.Add(id);
            Game.Save.SaveGame();
            return true;
        }

        public void EquipCosmetic(string id)
        {
            if (!OwnsCosmetic(id)) return;
            _equippedCosmetic = id;
            Game.Save.SaveGame();
            Game.Events.RaiseCosmeticEquipped(id);
        }

        /// <summary>Re-grant non-consumables the store says this account owns.
        /// Both platforms require a restore path; the stub owns nothing, so
        /// this is a no-op until real billing lands.</summary>
        public IEnumerator RestorePurchases(Action<int> onComplete)
        {
            if (_busy)
            {
                onComplete?.Invoke(0);
                yield break;
            }
            _busy = true;

            List<string> owned = null;
            yield return _billing.RestorePurchases(result => owned = result);

            int restored = 0;
            if (owned != null)
                foreach (var id in owned)
                    if (_entitlements.Add(id)) restored++;

            if (restored > 0) Game.Save.SaveGame();
            _busy = false;
            onComplete?.Invoke(restored);
        }

        /// <summary>Purchases and cosmetics are account-level, never
        /// run-level.</summary>
        public void ResetForPrestige() { }

        // --- Internals -----------------------------------------------------

        /// <summary>Reset the daily offer counts when the UTC day strictly
        /// advances — the same rule the Journal's dailies use, so a backwards
        /// clock cannot mint offers.</summary>
        void RollAdDay()
        {
            long today = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / SecondsPerDay;
            if (today <= _adDay) return;
            _adUses.Clear();
            _adDay = today;
        }

        void OnGameLoaded(bool isNewGame)
        {
            RollAdDay();
            _ownedCosmetics.Add(DefaultCosmetic);
        }
    }
}
