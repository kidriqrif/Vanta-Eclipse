using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;
using VantaEclipse.Managers;

namespace VantaEclipse.UI
{
    /// <summary>
    /// The Forge — a slide-up panel inside the Gear screen. Pick a slot, pay 20
    /// Void Scraps, get a random item at the current level.
    /// </summary>
    public sealed class ForgePanel : SlidePanel
    {
        public static readonly Vector2 SlotTileSize = new(236f, 250f);

        public event Action<Item> ItemForged;

        protected override string CloseButtonName => "ForgeCloseButton";

        string _selectedSlot = "";
        readonly Dictionary<string, Image> _slotBorders = new();

        Text _costLabel;
        Button _forgeButton;
        Text _forgeButtonLabel;

        protected override void OnFirstShow()
        {
            _costLabel = Find<Text>("CostLabel");
            _forgeButton = Find<Button>("ForgeButton");
            _forgeButtonLabel = _forgeButton != null
                ? _forgeButton.GetComponentInChildren<Text>(true) : null;
            _forgeButton?.onClick.AddListener(OnForgePressed);

            Game.Events.CurrencyChanged += OnCurrencyChanged;
            BuildSlotPickers();
            Refresh();
        }

        void OnDestroy()
        {
            if (Game.IsBooted) Game.Events.CurrencyChanged -= OnCurrencyChanged;
        }

        protected override void OnOpening() => Refresh();

        // --- Internals ---------------------------------------------------------

        void BuildSlotPickers()
        {
            var row = FindObject("SlotRow");
            if (row == null) return;

            foreach (var slot in Game.Equipment.GetSlots())
            {
                // A sealed slot cannot hold an item, so it cannot be forged for.
                if (slot.@sealed) continue;

                var (button, panel) = UIBuild.Tile(row.transform,
                    VantaTheme.Surface, VantaTheme.Line, borderWidth: 2f, padding: 12f,
                    name: $"Slot_{slot.id}");
                UIBuild.SizeTo(panel.Root, SlotTileSize);

                var column = UIBuild.Column(panel.Content, spacing: 6f);
                UIBuild.Stretch((RectTransform)column.transform);
                UIBuild.Icon(column.transform, slot.icon, 88f);
                UIBuild.Label(column.transform, slot.displayName, 18, VantaTheme.Ink);

                string id = slot.id;
                button.onClick.AddListener(() => OnSlotSelected(id));
                _slotBorders[id] = panel.Border;
            }
        }

        /// <summary>Not a Toggle: that needs a ToggleGroup and a graphic per
        /// state, and recolouring the
        /// border the tile already has says the same thing with nothing
        /// added.</summary>
        void OnSlotSelected(string slot)
        {
            _selectedSlot = slot;
            foreach (var pair in _slotBorders)
                if (pair.Value != null)
                    pair.Value.color = pair.Key == slot ? VantaTheme.Accent : VantaTheme.Line;
            Refresh();
        }

        void OnCurrencyChanged(string currency, float balance)
        {
            if (currency == CurrencyManager.VoidScraps) Refresh();
        }

        void Refresh()
        {
            float cost = EquipmentManager.ForgeCost;
            float balance = Game.Currency.GetBalance(CurrencyManager.VoidScraps);
            bool affordable = balance >= cost;

            string costText =
                $"{NumberFormat.Format(balance)} / {NumberFormat.Format(cost)} Void Scraps";
            if (!affordable)
                costText += $"  ·  Need {NumberFormat.Format(cost - balance)} more";
            if (_costLabel != null)
            {
                _costLabel.text = costText;
                // The deny state is stated in words as well as colour — "Need N
                // more" is the part that survives a colour-blind read.
                _costLabel.color = affordable ? VantaTheme.Ink : VantaTheme.Accent;
            }

            if (_forgeButtonLabel != null)
                _forgeButtonLabel.text = $"FORGE  ·  Item Lv. {Game.Combat.EnemyLevel}";
            if (_forgeButton != null)
                _forgeButton.interactable = affordable && _selectedSlot != "";
        }

        void OnForgePressed()
        {
            if (_selectedSlot == "") return;
            var item = Game.Equipment.Forge(_selectedSlot, Game.Combat.EnemyLevel);
            if (item == null) return;
            Game.Settings.Vibrate(20);
            ItemForged?.Invoke(item);
        }
    }
}
