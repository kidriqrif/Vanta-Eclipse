using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;
using VantaEclipse.Managers;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Inspector Card (pattern §7.1) — a player-summoned, multi-action item
    /// detail surface.
    ///
    /// Unlike the Centered Modal Dialog it has several actions (EQUIP /
    /// SALVAGE) and closes by CLOSE *or* scrim-tap — a deliberately different
    /// contract, so it is its own pattern rather than a modal consumer. It never
    /// fires the ui_overlay signals for the same reason the Gear panels do not:
    /// no boss gate can occur on the Gear screen.
    /// </summary>
    public sealed class InspectorCard : UIScreen
    {
        public const float ArmSeconds = 2.5f;
        public const float EnterSeconds = 0.22f;
        public const float ExitSeconds = 0.18f;

        /// <summary>An improvement reads ivory, a regression reads accent. The
        /// arrow and the sign carry it too — colour is never alone.</summary>
        public static Color UpColor => VantaTheme.Ivory;
        public static Color DownColor => VantaTheme.Accent;

        public event Action<int> EquipRequested;
        public event Action<string> UnequipRequested;
        public event Action<int> SalvageRequested;

        Item _item;
        bool _isEquipped;
        bool _salvageArmed;
        bool _closing;

        // Info mode: a card for an empty or sealed slot (no item, CLOSE only).
        bool _infoMode;
        string _infoTitle = "";
        string _infoSubtitle = "";
        string _infoBody = "";

        CanvasGroup _scrimGroup;
        CanvasGroup _cardGroup;
        RectTransform _card;
        Transform _body;
        Button _salvageButton;
        Text _salvageLabel;
        Button _equipButton;
        Text _equipLabel;

        protected override void Awake()
        {
            base.Awake();
            UILayers.Apply(gameObject, UILayers.Modal);
        }

        /// <summary>Call before the first frame. <paramref name="isEquipped"/>
        /// means the shown item currently sits in its slot: offer UNEQUIP and
        /// hide SALVAGE, because an equipped item is never salvaged.</summary>
        public void Setup(Item item, bool isEquipped)
        {
            _item = item;
            _isEquipped = isEquipped;
        }

        /// <summary>Build an info-only card (empty slot / sealed relic): one
        /// message, CLOSE.</summary>
        public void SetupInfo(string title, string subtitle, string body)
        {
            _infoMode = true;
            _infoTitle = title;
            _infoSubtitle = subtitle;
            _infoBody = body;
        }

        void Start()
        {
            var scrim = FindObject("Scrim");
            var card = FindObject("Card");
            if (scrim == null || card == null)
            {
                Debug.LogError("InspectorCard: needs both Scrim and Card.");
                Destroy(gameObject);
                return;
            }

            _body = FindObject("CardBody")?.transform ?? card.transform;
            _card = (RectTransform)card.transform;
            _cardGroup = card.GetComponent<CanvasGroup>() ?? card.AddComponent<CanvasGroup>();
            _scrimGroup = scrim.GetComponent<CanvasGroup>() ?? scrim.AddComponent<CanvasGroup>();

            _salvageButton = Find<Button>("SalvageButton");
            _salvageLabel = _salvageButton != null
                ? _salvageButton.GetComponentInChildren<Text>(true) : null;
            _equipButton = Find<Button>("EquipButton");
            _equipLabel = _equipButton != null
                ? _equipButton.GetComponentInChildren<Text>(true) : null;

            if (_infoMode) BuildInfo();
            else BuildItem();

            Bind("CloseButton", Close);

            // Scrim-tap dismissal is half of this pattern's contract, and it is
            // the half a Button on the scrim would get wrong: a Button would
            // also swallow the tap that started on the card and ended outside it.
            var scrimImage = scrim.GetComponent<Image>() ?? scrim.AddComponent<Image>();
            scrimImage.raycastTarget = true;
            var tap = scrim.GetComponent<TapSurface>() ?? scrim.AddComponent<TapSurface>();
            tap.Tapped += _ => Close();

            StartCoroutine(PlayEnter());
        }

        public void Close()
        {
            if (_closing) return;
            _closing = true;
            StartCoroutine(PlayExit());
        }

        // --- Build ------------------------------------------------------------

        void BuildItem()
        {
            int rarity = _item.Rarity;

            // The card's border wears the item's rarity colour, softened.
            var border = FindObject("Card")?.GetComponent<Image>();
            if (border != null)
            {
                var color = RarityStyle.Color(rarity);
                color.a = 0.8f;
                border.color = color;
            }

            BuildHeader(rarity);
            BuildAffixList();
            BuildCompare();

            if (_equipLabel != null) _equipLabel.text = _isEquipped ? "UNEQUIP" : "EQUIP";
            _equipButton?.onClick.AddListener(OnEquipPressed);

            if (_salvageButton != null)
            {
                _salvageButton.gameObject.SetActive(!_isEquipped);
                SetSalvageLabel($"SALVAGE  +{Game.Equipment.GetSalvageYield(rarity)}");
                _salvageButton.onClick.AddListener(OnSalvagePressed);
            }
        }

        void BuildInfo()
        {
            if (_equipButton != null) _equipButton.gameObject.SetActive(false);
            if (_salvageButton != null) _salvageButton.gameObject.SetActive(false);

            UIBuild.Label(_body, _infoTitle, 36, VantaTheme.Ink);
            if (_infoSubtitle != "")
                UIBuild.Label(_body, _infoSubtitle, 18, VantaTheme.Muted);
            UIBuild.MinHeight(UIBuild.Node("Spacer", _body).transform, 20f);
            UIBuild.Label(_body, _infoBody, 18, VantaTheme.Ink);
        }

        void BuildHeader(int rarity)
        {
            var pips = RarityStyle.MakePipRow(rarity);
            pips.transform.SetParent(_body, false);

            var slot = Game.Equipment.GetSlotDefinition(_item.Slot);
            string slotName = slot != null ? slot.displayName : _item.Slot;
            UIBuild.Label(_body, $"{RarityStyle.Name(rarity)} {slotName}", 36,
                RarityStyle.Color(rarity));
            UIBuild.Label(_body, $"Item Level {_item.ItemLevel}", 18, VantaTheme.Muted);
        }

        void BuildAffixList()
        {
            foreach (var pair in _item.Affixes)
                UIBuild.Label(_body, Game.Equipment.FormatAffix(pair.Key, pair.Value), 27,
                    VantaTheme.Ink);
        }

        /// <summary>When a different item is equipped in this slot, show the
        /// per-affix delta with arrow + sign + colour — never colour
        /// alone.</summary>
        void BuildCompare()
        {
            if (_isEquipped) return;
            var equipped = Game.Equipment.GetEquipped(_item.Slot);
            if (equipped == null) return;

            UIBuild.Label(_body, "vs equipped:", 18, VantaTheme.Muted);

            var stats = new HashSet<string>();
            foreach (var pair in _item.Affixes) stats.Add(pair.Key);
            foreach (var pair in equipped.Affixes) stats.Add(pair.Key);

            foreach (var id in stats)
            {
                _item.Affixes.TryGetValue(id, out float newValue);
                equipped.Affixes.TryGetValue(id, out float oldValue);
                float delta = newValue - oldValue;
                if (Mathf.Approximately(delta, 0f)) continue;

                bool up = delta > 0f;
                string arrow = up ? "▲" : "▼";
                string sign = up ? "+" : "−";
                var affix = Game.Equipment.GetAffixDefinition(id);
                string shown = affix != null && affix.isPercent
                    ? NumberFormat.FormatPercent(Mathf.Abs(delta))
                    : NumberFormat.Format(Mathf.Abs(delta));

                UIBuild.Label(_body, $"{arrow} {AffixLabel(id)} {sign}{shown}", 18,
                    up ? UpColor : DownColor);
            }
        }

        string AffixLabel(string id)
        {
            var affix = Game.Equipment.GetAffixDefinition(id);
            if (affix == null) return id;
            return affix.displayTemplate.Replace(" +{value}", "").Replace("{value}", "");
        }

        // --- Actions ----------------------------------------------------------

        void OnEquipPressed()
        {
            if (_isEquipped) UnequipRequested?.Invoke(_item.Slot);
            else EquipRequested?.Invoke(_item.Id);
            Close();
        }

        void OnSalvagePressed()
        {
            // Two-Tap Arm for Epic+; Common/Rare salvage on the first tap.
            // Either way the yield is on the button face before the player
            // commits.
            int yield = Game.Equipment.GetSalvageYield(_item.Rarity);
            if (_item.Rarity >= (int)EquipmentManager.Rarity.EPIC && !_salvageArmed)
            {
                _salvageArmed = true;
                SetSalvageLabel($"TAP AGAIN:  +{yield} SCRAPS");
                Scheduler.After(ArmSeconds, DisarmSalvage);
                return;
            }
            SalvageRequested?.Invoke(_item.Id);
            Close();
        }

        void DisarmSalvage()
        {
            if (this == null || _salvageButton == null || !_salvageArmed) return;
            _salvageArmed = false;
            SetSalvageLabel($"SALVAGE  +{Game.Equipment.GetSalvageYield(_item.Rarity)}");
        }

        void SetSalvageLabel(string value)
        {
            if (_salvageLabel != null) _salvageLabel.text = value;
        }

        // --- Choreography ------------------------------------------------------

        IEnumerator PlayEnter()
        {
            _scrimGroup.alpha = 0f;
            _cardGroup.alpha = 0f;
            _card.localScale = Vector3.one * 0.9f;

            float elapsed = 0f;
            while (elapsed < EnterSeconds)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / EnterSeconds);
                _scrimGroup.alpha = Mathf.Clamp01(elapsed / 0.18f);
                _cardGroup.alpha = t;
                _card.localScale = Vector3.one * Mathf.LerpUnclamped(0.9f, 1f, BackOut(t));
                yield return null;
            }
            _scrimGroup.alpha = 1f;
            _cardGroup.alpha = 1f;
            _card.localScale = Vector3.one;
        }

        IEnumerator PlayExit()
        {
            float from = _card.localScale.x;
            float elapsed = 0f;
            while (elapsed < ExitSeconds)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / ExitSeconds);
                _cardGroup.alpha = 1f - t;
                _scrimGroup.alpha = 1f - t;
                _card.localScale = Vector3.one * Mathf.Lerp(from, 0.92f, t);
                yield return null;
            }
            Destroy(gameObject);
        }

        static float BackOut(float t)
        {
            const float c1 = 1.70158f;
            const float c3 = c1 + 1f;
            float inv = t - 1f;
            return 1f + c3 * inv * inv * inv + c1 * inv * inv;
        }
    }
}
