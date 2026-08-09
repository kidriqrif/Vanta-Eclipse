using UnityEngine.UI;
using VantaEclipse.Core;
using VantaEclipse.Data;
using VantaEclipse.Managers;

namespace VantaEclipse.UI
{
    /// <summary>
    /// One row in the upgrade shop: name, effect, current level, and a buy
    /// button. The shop panel creates one row per UpgradeDefinition — this
    /// script never needs to know which upgrades exist.
    /// </summary>
    public sealed class UpgradeRow : UIScreen
    {
        UpgradeDefinition _definition;
        Text _levelLabel;
        Button _buyButton;
        Text _buyLabel;

        /// <summary>Called by the shop panel immediately after spawning this
        /// row, before its first frame.</summary>
        public void Setup(UpgradeDefinition definition) => _definition = definition;

        void Start()
        {
            if (_definition == null) return;

            SetText("NameLabel", _definition.displayName);
            SetText("DescLabel", _definition.description);
            _levelLabel = Find<Text>("LevelLabel");
            _buyButton = Find<Button>("BuyButton");
            _buyLabel = _buyButton != null ? _buyButton.GetComponentInChildren<Text>(true) : null;
            _buyButton?.onClick.AddListener(OnBuyPressed);

            // Affordability changes whenever essence changes; level changes on buy.
            Game.Events.CurrencyChanged += OnCurrencyChanged;
            Game.Events.UpgradePurchased += OnUpgradePurchased;
            Refresh();
        }

        void OnDestroy()
        {
            if (!Game.IsBooted) return;
            Game.Events.CurrencyChanged -= OnCurrencyChanged;
            Game.Events.UpgradePurchased -= OnUpgradePurchased;
        }

        void OnBuyPressed()
        {
            if (Game.Upgrades.Buy(_definition.id)) Game.Settings.Vibrate(15);
        }

        void OnCurrencyChanged(string currency, float balance)
        {
            if (currency == CurrencyManager.Essence) Refresh();
        }

        void OnUpgradePurchased(string id, int newLevel)
        {
            if (id == _definition.id) Refresh();
        }

        void Refresh()
        {
            int level = Game.Upgrades.GetLevel(_definition.id);
            string levelText = $"Lv. {level}";
            if (level > 0) levelText += $"  —  {_definition.FormatEffect(level)}";
            if (_definition.maxLevel > 0) levelText += $"  (max {_definition.maxLevel})";
            if (_levelLabel != null) _levelLabel.text = levelText;

            if (_buyButton == null) return;

            if (Game.Upgrades.IsMaxed(_definition.id))
            {
                if (_buyLabel != null) _buyLabel.text = "MAX";
                _buyButton.interactable = false;
                return;
            }
            if (_buyLabel != null)
                _buyLabel.text = NumberFormat.Format(Game.Upgrades.GetCost(_definition.id));
            _buyButton.interactable = Game.Upgrades.CanBuy(_definition.id);
        }
    }
}
