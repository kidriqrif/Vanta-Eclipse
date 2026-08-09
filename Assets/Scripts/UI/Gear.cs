using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;
using VantaEclipse.Data;
using VantaEclipse.Managers;

namespace VantaEclipse.UI
{
    /// <summary>
    /// The Gear screen — 7 equipment slots, scrolling inventory, Void Scraps,
    /// and the Forge.
    ///
    /// A full screen rather than an overlay: entering it fires
    /// SceneTransitionStarted (which holds any boss gate) and BACK re-enters
    /// gameplay, re-checking the held gate — no ui_overlay plumbing needed.
    /// </summary>
    public sealed class Gear : UIScreen
    {
        public static readonly Vector2 SlotTileSize = new(236f, 250f);
        /// <summary>Breathing room between a tile's border and its text.</summary>
        public const float TilePad = 14f;
        /// <summary>Extra bottom inset on a sealed tile, so its flavour line
        /// clears the lock glyph pinned in the bottom-right corner instead of
        /// running under it.</summary>
        public const float TileLockClearance = 58f;
        public const float RowHeight = 140f;
        public const float ArmSeconds = 2.5f;

        bool _commonsArmed;

        Transform _slotGrid;
        Transform _inventoryList;
        GameObject _emptyLabel;
        Text _scrapsLabel;
        Button _salvageCommonsButton;
        Text _salvageCommonsLabel;
        ForgePanel _forgePanel;
        RelicCollectionPanel _relicPanel;

        void Start()
        {
            _slotGrid = FindObject("SlotGrid")?.transform;
            _inventoryList = FindObject("InventoryList")?.transform;
            _emptyLabel = FindObject("EmptyLabel");
            _scrapsLabel = Find<Text>("ScrapsLabel");
            _salvageCommonsButton = Find<Button>("SalvageCommonsButton");
            _salvageCommonsLabel = _salvageCommonsButton != null
                ? _salvageCommonsButton.GetComponentInChildren<Text>(true) : null;
            _forgePanel = FindObject("ForgePanel")?.GetComponent<ForgePanel>();
            _relicPanel = FindObject("RelicCollectionPanel")?.GetComponent<RelicCollectionPanel>();

            Bind("BackButton", OnBackPressed);
            Bind("ForgeButton", () => _forgePanel?.Toggle());
            _salvageCommonsButton?.onClick.AddListener(OnSalvageCommons);
            if (_forgePanel != null) _forgePanel.ItemForged += OnItemForged;

            Game.Events.InventoryChanged += Refresh;
            Game.Events.ItemEquipped += OnItemEquipped;
            Game.Events.CurrencyChanged += OnCurrencyChanged;
            Game.Events.RelicsAwakened += Refresh;
            Game.Events.RelicDropped += OnRelicChanged;
            Game.Events.ActiveRelicChanged += OnRelicChanged;

            Refresh();
        }

        void OnDestroy()
        {
            if (_forgePanel != null) _forgePanel.ItemForged -= OnItemForged;
            if (!Game.IsBooted) return;
            Game.Events.InventoryChanged -= Refresh;
            Game.Events.ItemEquipped -= OnItemEquipped;
            Game.Events.CurrencyChanged -= OnCurrencyChanged;
            Game.Events.RelicsAwakened -= Refresh;
            Game.Events.RelicDropped -= OnRelicChanged;
            Game.Events.ActiveRelicChanged -= OnRelicChanged;
        }

        void Refresh()
        {
            if (_scrapsLabel != null)
                _scrapsLabel.text = NumberFormat.Format(
                    Game.Currency.GetBalance(CurrencyManager.VoidScraps));
            RebuildSlots();
            RebuildInventory();
            RefreshCommonsButton();
        }

        void RefreshCommonsButton()
        {
            int count = Game.Equipment.GetCommonsCount();
            if (_salvageCommonsButton != null) _salvageCommonsButton.interactable = count > 0;
            if (_salvageCommonsLabel == null) return;

            if (_commonsArmed && count > 0)
            {
                int each = Game.Equipment.GetSalvageYield((int)EquipmentManager.Rarity.COMMON);
                _salvageCommonsLabel.text = $"TAP AGAIN: {count} FOR +{count * each}";
            }
            else
            {
                _commonsArmed = false;
                _salvageCommonsLabel.text = $"Salvage Commons ({count})";
            }
        }

        // --- Slots --------------------------------------------------------------

        void RebuildSlots()
        {
            if (_slotGrid == null) return;
            UIBuild.Clear(_slotGrid);

            foreach (var slot in Game.Equipment.GetSlots())
            {
                if (slot.id == "relic" && Game.Relics.IsAwakened()) MakeRelicTile();
                else MakeSlotTile(slot);
            }
        }

        /// <summary>The awakened relic tile — opens the Relic Collection.</summary>
        void MakeRelicTile()
        {
            var (button, panel) = UIBuild.Tile(_slotGrid, VantaTheme.Raised, VantaTheme.Ink,
                borderWidth: 3f, padding: TilePad, name: "Slot_relic");
            UIBuild.SizeTo(panel.Root, SlotTileSize);

            var column = UIBuild.Column(panel.Content, spacing: 6f);
            UIBuild.Stretch((RectTransform)column.transform);
            UIBuild.Label(column.transform, "RELIC", 18, VantaTheme.Ink);

            string active = Game.Relics.GetActiveId();
            if (!string.IsNullOrEmpty(active))
            {
                var definition = Game.Relics.GetDefinition(active);
                UIBuild.Icon(column.transform, definition?.sigil, 88f);
                UIBuild.Label(column.transform, definition?.displayName ?? "", 18, VantaTheme.Ink);
            }
            else
            {
                // Empty slot: the sigil is a faint prompt, not a lit relic — it
                // is dimmed so it never reads as attuned (visual §1.3).
                UIBuild.Icon(column.transform, UISprites.SlotRelic, 88f,
                    VantaTheme.Fade(VantaTheme.Muted, 0.35f));
                UIBuild.Label(column.transform, "Tap to attune", 18, VantaTheme.Muted);
            }
            button.onClick.AddListener(() => _relicPanel?.Toggle());
        }

        void MakeSlotTile(SlotDefinition slot)
        {
            var equipped = Game.Equipment.GetEquipped(slot.id);

            Color fill, border;
            float borderWidth;
            if (slot.@sealed)
            {
                fill = VantaTheme.Fade(VantaTheme.Surface, 0.85f);
                border = VantaTheme.Fade(VantaTheme.Line, 0.7f);
                borderWidth = 2f;
            }
            else if (equipped != null)
            {
                fill = VantaTheme.Raised;
                // Rarity reads off the hard border alone. This also carried a
                // soft coloured glow, which said nothing the border did not
                // already say and said it with an 8px blur.
                border = RarityStyle.Color(equipped.Rarity);
                borderWidth = 3f;
            }
            else
            {
                fill = VantaTheme.Surface;
                border = VantaTheme.Line;
                borderWidth = 2f;
            }

            var (button, panel) = UIBuild.Tile(_slotGrid, fill, border, borderWidth,
                padding: TilePad, name: $"Slot_{slot.id}");
            UIBuild.SizeTo(panel.Root, SlotTileSize);

            var column = UIBuild.Column(panel.Content, spacing: 6f);
            var columnRect = UIBuild.Stretch((RectTransform)column.transform);
            if (slot.@sealed)
                columnRect.offsetMin = new Vector2(columnRect.offsetMin.x, TileLockClearance);

            // A sealed tile carries three things the others do not have room for
            // at once — icon, name AND a wrapped sentence — in the same
            // 236x250. The icon yields, since the lock glyph already says
            // "sealed".
            UIBuild.Icon(column.transform, slot.icon, slot.@sealed ? 62f : 88f,
                slot.@sealed ? VantaTheme.Muted : (Color?)null);
            UIBuild.Label(column.transform, slot.displayName, 18, VantaTheme.Ink);

            if (slot.@sealed)
            {
                UIBuild.Label(column.transform, slot.sealedFlavor, 18, VantaTheme.Muted);
                // A lock glyph bottom-right marks the slot sealed beyond the tint.
                var lockIcon = UIBuild.Icon(panel.Root.transform, UISprites.LockGlyph, 40f);
                var lockRect = (RectTransform)lockIcon.transform;
                lockRect.anchorMin = new Vector2(1f, 0f);
                lockRect.anchorMax = new Vector2(1f, 0f);
                lockRect.pivot = new Vector2(1f, 0f);
                lockRect.anchoredPosition = new Vector2(-12f, 12f);
                button.onClick.AddListener(() => OpenSealedCard(slot));
            }
            else if (equipped != null)
            {
                var pips = RarityStyle.MakePipRow(equipped.Rarity);
                pips.transform.SetParent(column.transform, false);
                // The longest affix names ("Boss Damage +29%") fill the tile
                // exactly, and the next one along would simply run off it.
                UIBuild.Label(column.transform, RarityStyle.KeyStatLine(equipped), 18,
                    VantaTheme.Muted);
                button.onClick.AddListener(() => OpenCard(equipped, isEquipped: true));
            }
            else
            {
                UIBuild.Label(column.transform, "Empty", 18, VantaTheme.Muted);
                button.onClick.AddListener(() => OpenEmptyCard(slot));
            }
        }

        // --- Inventory ------------------------------------------------------------

        void RebuildInventory()
        {
            if (_inventoryList == null) return;
            UIBuild.Clear(_inventoryList, _emptyLabel);

            var inventory = Game.Equipment.GetInventory();
            if (_emptyLabel != null) _emptyLabel.SetActive(inventory.Count == 0);
            foreach (var item in inventory) MakeInventoryRow(item);
        }

        void MakeInventoryRow(Item item)
        {
            int rarity = item.Rarity;
            var (button, panel) = UIBuild.Tile(_inventoryList,
                VantaTheme.Fade(VantaTheme.Surface, 0.9f), VantaTheme.Line,
                borderWidth: 0f, padding: 14f, name: $"Item_{item.Id}");
            UIBuild.MinHeight(panel.Root.transform, RowHeight);

            var row = UIBuild.Row(panel.Content, spacing: 16f);
            UIBuild.Stretch((RectTransform)row.transform);

            UIBuild.Bar(row.transform, RarityStyle.Color(rarity), 6f);

            var slot = Game.Equipment.GetSlotDefinition(item.Slot);
            UIBuild.Icon(row.transform, slot?.icon, 64f);

            var info = UIBuild.Expand(UIBuild.Column(row.transform, spacing: 4f,
                align: TextAnchor.MiddleLeft));

            var pips = RarityStyle.MakePipRow(rarity);
            pips.transform.SetParent(info.transform, false);

            string slotName = slot != null ? slot.displayName : item.Slot;
            UIBuild.Label(info.transform, $"{RarityStyle.Name(rarity)} {slotName}", 27,
                RarityStyle.Color(rarity), TextAnchor.MiddleLeft);
            UIBuild.Label(info.transform, RarityStyle.KeyStatLine(item), 18,
                VantaTheme.Muted, TextAnchor.MiddleLeft);

            // Durable NEW tag for items not yet seen on the Gear screen.
            if (Game.Equipment.IsItemUnseen(item))
                UIBuild.Label(row.transform, "NEW", 18, VantaTheme.Ivory,
                    TextAnchor.MiddleRight, wrap: false);

            button.onClick.AddListener(() => OpenCard(item, isEquipped: false));
        }

        // --- Actions ----------------------------------------------------------------

        void OpenCard(Item item, bool isEquipped)
        {
            var card = UIPrefabs.Spawn<InspectorCard>(transform);
            if (card == null) return;
            card.Setup(item, isEquipped);
            card.EquipRequested += OnEquipRequested;
            card.UnequipRequested += OnUnequipRequested;
            card.SalvageRequested += OnSalvageRequested;
        }

        void OpenEmptyCard(SlotDefinition slot)
        {
            var card = UIPrefabs.Spawn<InspectorCard>(transform);
            card?.SetupInfo($"Empty {slot.displayName}", "",
                $"Defeat enemies to find {slot.displayName.ToLowerInvariant()} gear, " +
                "then equip it here.");
        }

        void OpenSealedCard(SlotDefinition slot)
        {
            var card = UIPrefabs.Spawn<InspectorCard>(transform);
            card?.SetupInfo($"{slot.displayName} — Sealed", slot.sealedFlavor,
                "This slot awakens in a later world.");
        }

        void OnEquipRequested(int itemId)
        {
            Game.Equipment.Equip(itemId);
            Game.Settings.Vibrate(15);
        }

        void OnUnequipRequested(string slot) => Game.Equipment.Unequip(slot);

        void OnSalvageRequested(int itemId) => Game.Equipment.Salvage(itemId);

        void OnSalvageCommons()
        {
            if (Game.Equipment.GetCommonsCount() == 0) return;
            // Bulk salvage is always armed — one tap to arm, a second to commit.
            if (!_commonsArmed)
            {
                _commonsArmed = true;
                RefreshCommonsButton();
                Scheduler.After(ArmSeconds, DisarmCommons);
                return;
            }
            _commonsArmed = false;
            Game.Equipment.SalvageAllCommons();
        }

        void DisarmCommons()
        {
            if (this == null || !_commonsArmed) return;
            _commonsArmed = false;
            RefreshCommonsButton();
        }

        void OnItemForged(Item item)
        {
            _forgePanel?.Close();
            OpenCard(item, isEquipped: false);
        }

        void OnItemEquipped(string slot) => Refresh();

        void OnRelicChanged(string id) => Refresh();

        void OnCurrencyChanged(string currency, float balance)
        {
            if (currency == CurrencyManager.VoidScraps && _scrapsLabel != null)
                _scrapsLabel.text = NumberFormat.Format(balance);
        }

        void OnBackPressed()
        {
            // Everything viewed this visit is now seen — clears the GEAR pill
            // and the NEW tags. Durable: the flags persist through the save.
            Game.Equipment.MarkAllSeen();
            Game.Save.SaveGame();
            Game.Flow.ChangeScene(Scenes.Gameplay);
        }
    }
}
