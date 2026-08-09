// Ported from scripts/ui/shop.gd
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;
using VantaEclipse.Data;
using VantaEclipse.Managers;
using VantaEclipse.Monetization;

namespace VantaEclipse.UI
{
    /// <summary>
    /// The Shop — opt-in bonus offers, purchases, and tap-trail cosmetics.
    ///
    /// Nothing here gates a mechanic. Offers are bonuses the player may decline
    /// freely; cosmetics change nothing but the look of a tap.
    /// </summary>
    public sealed class Shop : UIScreen
    {
        public static readonly Vector2 ActionButtonSize = new(240f, 96f);

        bool _offersTabActive = true;

        Text _shardLabel;
        GameObject _devBanner;
        Button _offersTab;
        Button _cosmeticsTab;
        Transform _itemList;

        void Start()
        {
            _shardLabel = Find<Text>("ShardLabel");
            _devBanner = FindObject("DevBanner");
            _offersTab = Find<Button>("OffersTab");
            _cosmeticsTab = Find<Button>("CosmeticsTab");
            _itemList = FindObject("ItemList")?.transform;

            // The banner warns whoever is BUILDING the game, so it is gated on a
            // debug build, not on the stub flag alone. Keyed only to
            // UseStubProviders it would have shipped "DEVELOPMENT BUILD" to
            // players in any release that still had the stubs in it — which is
            // exactly the release this guard exists to make safe.
            if (_devBanner != null)
                _devBanner.SetActive(MonetizationManager.UseStubProviders && Debug.isDebugBuild);

            // With no real billing there is nothing honest to put on the OFFERS
            // tab, so the Shop becomes a single-tab cosmetics screen rather than
            // a tab bar with one dead half.
            bool paid = MonetizationManager.PaidSurfacesAvailable;
            if (_offersTab != null) _offersTab.gameObject.SetActive(paid);
            if (_cosmeticsTab != null) _cosmeticsTab.gameObject.SetActive(paid);

            Bind("BackButton", () => Game.Flow.ChangeScene(Scenes.Gameplay));
            _offersTab?.onClick.AddListener(() => SetTab(true));
            _cosmeticsTab?.onClick.AddListener(() => SetTab(false));

            Game.Events.CurrencyChanged += OnCurrencyChanged;
            Game.Events.PurchaseCompleted += OnPurchaseCompleted;
            Game.Events.CosmeticEquipped += OnCosmeticEquipped;
            // Watching an ad burns one of that placement's daily offers, so the
            // "N left" line every offer row renders goes stale the moment a
            // reward is granted.
            Game.Events.AdRewardGranted += OnAdRewardGranted;

            RefreshShards();
            SetTab(MonetizationManager.PaidSurfacesAvailable);
        }

        void OnDestroy()
        {
            if (!Game.IsBooted) return;
            Game.Events.CurrencyChanged -= OnCurrencyChanged;
            Game.Events.PurchaseCompleted -= OnPurchaseCompleted;
            Game.Events.CosmeticEquipped -= OnCosmeticEquipped;
            Game.Events.AdRewardGranted -= OnAdRewardGranted;
        }

        void SetTab(bool offers)
        {
            _offersTabActive = offers;
            StyleTab(_offersTab, offers);
            StyleTab(_cosmeticsTab, !offers);
            Rebuild();
        }

        static void StyleTab(Button button, bool active)
        {
            if (button == null) return;
            var fill = button.GetComponent<Image>();
            if (fill != null)
                fill.color = active ? VantaTheme.Raised : VantaTheme.Fade(VantaTheme.Surface, 0.6f);
            var label = button.GetComponentInChildren<Text>(true);
            if (label != null) label.color = active ? VantaTheme.Ink : VantaTheme.Muted;
        }

        void RefreshShards()
        {
            if (_shardLabel != null)
                _shardLabel.text =
                    $"{NumberFormat.Format(Game.Currency.GetBalance(CurrencyManager.AstralShards))} Shards";
        }

        void OnCurrencyChanged(string currency, float balance)
        {
            if (currency != CurrencyManager.AstralShards) return;
            RefreshShards();
            if (!_offersTabActive) Rebuild();
        }

        void OnPurchaseCompleted(string id) => Rebuild();
        void OnCosmeticEquipped(string id) => Rebuild();
        void OnAdRewardGranted(string id, float amount) => Rebuild();

        // --- List -----------------------------------------------------------------

        void Rebuild()
        {
            if (_itemList == null) return;
            UIBuild.Clear(_itemList);

            // Guarded as well as hidden: SetTab(true) from anywhere — a future
            // caller, a restored tab state — must not be able to build a card
            // that spends money the build cannot take.
            if (_offersTabActive && MonetizationManager.PaidSurfacesAvailable)
            {
                foreach (var placement in Game.Shop.GetShopPlacements()) MakeOfferCard(placement);
                foreach (var product in Game.Shop.GetProducts()) MakeProductCard(product);
                MakeRestoreCard();
            }
            else
            {
                foreach (var cosmetic in Game.Shop.GetCosmetics()) MakeCosmeticCard(cosmetic);
            }
        }

        (UIBuild.Panel Card, Transform Body) Card(string name)
        {
            var card = UIBuild.Frame(_itemList, VantaTheme.Surface, VantaTheme.Line,
                borderWidth: 0f, padding: 16f, name: name);

            var spine = UIBuild.Bar(card.Root.transform,
                VantaTheme.Fade(VantaTheme.Ink, 0.35f), width: 4f);
            var spineRect = (RectTransform)spine.transform;
            spineRect.anchorMin = Vector2.zero;
            spineRect.anchorMax = new Vector2(0f, 1f);
            spineRect.pivot = new Vector2(0f, 0.5f);
            spineRect.sizeDelta = new Vector2(4f, 0f);
            spineRect.anchoredPosition = Vector2.zero;

            var column = UIBuild.Column(card.Content, spacing: 8f, align: TextAnchor.UpperLeft);
            UIBuild.Stretch((RectTransform)column.transform);
            return (card, column.transform);
        }

        static void TitleRow(Transform body, string title, string right, Color rightInk)
        {
            var row = UIBuild.Row(body, spacing: 12f);
            UIBuild.Expand(UIBuild.Label(row.transform, title, 27, VantaTheme.Ink,
                TextAnchor.MiddleLeft));
            if (right == "") return;
            UIBuild.Label(row.transform, right, 18, rightInk, TextAnchor.MiddleRight, wrap: false);
        }

        static void Description(Transform body, string text)
            => UIBuild.Label(body, text, 18, VantaTheme.Muted, TextAnchor.MiddleLeft);

        static (Button Button, Text Label) ActionButton(Transform body, string text, bool enabled)
        {
            var (button, panel) = UIBuild.Tile(body,
                enabled ? VantaTheme.AccentDeep : VantaTheme.Surface,
                enabled ? VantaTheme.Accent : VantaTheme.Line,
                borderWidth: 2f, padding: 8f, name: "Action");
            UIBuild.SizeTo(panel.Root, ActionButtonSize);
            var column = UIBuild.Column(panel.Content);
            UIBuild.Stretch((RectTransform)column.transform);
            var label = UIBuild.Label(column.transform, text, 27,
                enabled ? VantaTheme.Ivory : VantaTheme.Muted, wrap: false);
            button.interactable = enabled;
            return (button, label);
        }

        void MakeOfferCard(AdPlacementDefinition placement)
        {
            var (_, body) = Card($"Offer_{placement.id}");
            int left = Game.Shop.OffersLeft(placement.id);
            TitleRow(body, placement.displayName, $"{left} LEFT TODAY", VantaTheme.Muted);
            Description(body, placement.description);

            // Owning remove_ads turns the watch into a one-tap grant — the word
            // on the button changes so the state is never carried by colour
            // alone.
            bool free = Game.Shop.AdsRemoved();
            string text = left > 0 ? (free ? "CLAIM · FREE" : "WATCH") : "NONE LEFT TODAY";
            var (button, label) = ActionButton(body, text, left > 0);
            if (left > 0)
            {
                string id = placement.id;
                button.onClick.AddListener(() => OnOfferPressed(id, button, label));
            }
        }

        void MakeProductCard(ShopProductDefinition product)
        {
            var (_, body) = Card($"Product_{product.id}");
            bool owned = Game.Shop.IsOneTimeOwned(product);
            TitleRow(body, product.displayName, owned ? "" : product.priceText, VantaTheme.Ink);
            Description(body, product.description);

            if (owned)
            {
                UIBuild.Label(body, "● OWNED", 18, VantaTheme.Muted, TextAnchor.MiddleRight);
                return;
            }
            var (button, label) = ActionButton(body, "BUY", true);
            string id = product.id;
            button.onClick.AddListener(() => OnPurchasePressed(id, button, label));
        }

        /// <summary>Both stores require a restore path for non-consumables.</summary>
        void MakeRestoreCard()
        {
            var (_, body) = Card("Restore");
            TitleRow(body, "Restore Purchases", "", VantaTheme.Muted);
            Description(body, "Re-apply anything this account already owns.");
            var (button, label) = ActionButton(body, "RESTORE", true);
            button.onClick.AddListener(() =>
            {
                button.interactable = false;
                label.text = "RESTORING…";
                StartCoroutine(Game.Shop.RestorePurchases(restored =>
                {
                    if (this == null || label == null) return;
                    if (restored > 0) Rebuild();
                    else label.text = "NOTHING TO RESTORE";
                }));
            });
        }

        void MakeCosmeticCard(CosmeticDefinition cosmetic)
        {
            var (_, body) = Card($"Cosmetic_{cosmetic.id}");
            bool owned = Game.Shop.OwnsCosmetic(cosmetic.id);
            bool equipped = Game.Shop.GetEquippedCosmeticId() == cosmetic.id;
            string price = owned ? "" : $"{NumberFormat.Format(cosmetic.shardPrice)} Shards";
            TitleRow(body, cosmetic.displayName, price, VantaTheme.Ink);

            // A live swatch of the actual trail and damage-number colours.
            var swatches = UIBuild.Row(body, spacing: 10f);
            foreach (var color in new[] { cosmetic.trailColor, cosmetic.numberColor })
            {
                var swatch = UIBuild.Frame(swatches.transform, color, color,
                    borderWidth: 0f, padding: 0f, name: "Swatch");
                UIBuild.SizeTo(swatch.Root, new Vector2(64f, 32f));
            }
            UIBuild.Label(swatches.transform, "trail · numbers", 18, VantaTheme.Muted,
                TextAnchor.MiddleLeft, wrap: false);

            if (equipped)
            {
                UIBuild.Label(body, "● EQUIPPED", 18, VantaTheme.Ink, TextAnchor.MiddleRight);
                return;
            }

            string id = cosmetic.id;
            if (owned)
            {
                var (equipButton, _) = ActionButton(body, "EQUIP", true);
                equipButton.onClick.AddListener(() => Game.Shop.EquipCosmetic(id));
                return;
            }

            bool affordable = Game.Currency.CanAfford(
                CurrencyManager.AstralShards, cosmetic.shardPrice);
            var (buyButton, _) = ActionButton(body,
                affordable ? "BUY" : "NEED MORE SHARDS", affordable);
            if (!affordable) return;

            buyButton.onClick.AddListener(() =>
            {
                // EquipCosmetic raises CosmeticEquipped, which rebuilds; a buy
                // that does not equip still needs one, so only that branch asks.
                if (Game.Shop.BuyCosmetic(id)) Game.Shop.EquipCosmetic(id);
                else Rebuild();
            });
        }

        // --- Actions ------------------------------------------------------------

        void OnOfferPressed(string id, Button button, Text label)
        {
            if (Game.Shop.IsBusy()) return;
            button.interactable = false;
            StartCoroutine(RunCountdown(label));
            StartCoroutine(Game.Shop.RunOffer(id, 0f, granted =>
            {
                // BACK is deliberately live during a watch, so this screen may
                // already be gone. Touching its objects (or buzzing on the next
                // screen) after that would be a bug the player sees.
                if (this == null) return;
                if (granted > 0f) Game.Settings.Vibrate(30);
                Rebuild();
            }));
        }

        /// <summary>Tick a visible numeric countdown on the button for the length
        /// of the watch. A bare spinner would leave the player with no idea how
        /// long this takes.</summary>
        IEnumerator RunCountdown(Text label)
        {
            int remaining = MonetizationManager.UseStubProviders
                ? Mathf.CeilToInt(StubAdProvider.FakeWatchSeconds) : 0;
            if (Game.Shop.AdsRemoved() || remaining <= 0)
            {
                if (label != null) label.text = "CLAIMING…";
                yield break;
            }
            while (remaining > 0 && label != null)
            {
                label.text = $"WATCHING · {remaining}s";
                yield return new WaitForSecondsRealtime(1f);
                remaining--;
            }
        }

        void OnPurchasePressed(string id, Button button, Text label)
        {
            if (Game.Shop.IsBusy()) return;
            button.interactable = false;
            label.text = "PURCHASING…";
            StartCoroutine(Game.Shop.Purchase(id, bought =>
            {
                if (this == null) return;
                if (bought) Game.Settings.Vibrate(40);
                Rebuild();
            }));
        }
    }
}
