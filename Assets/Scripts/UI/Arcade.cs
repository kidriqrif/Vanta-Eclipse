using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;
using VantaEclipse.Data;
using VantaEclipse.Managers;

namespace VantaEclipse.UI
{
    /// <summary>
    /// The Arcade hub — the token meter and one card per minigame definition.
    /// Data-driven, so a new game adds itself by dropping in a definition. A
    /// full screen, so it holds any boss gate through the existing
    /// scene-transition test. Never required to progress.
    /// </summary>
    public sealed class Arcade : UIScreen
    {
        /// <summary>How often the "next token in" line and the PLAY buttons
        /// re-read the meter.</summary>
        public const float TickSeconds = 1f;

        /// <summary>The opt-in offer surfaced when the meter runs dry (M14 §2).</summary>
        public const string OfferId = "arcade_token";

        /// <summary>The Arcade lime is retired with the other door accent; the
        /// screen now uses the one accent and is told apart by its icons and its
        /// token meter.</summary>
        public static Color ArcadeAccent => VantaTheme.Accent;

        /// <summary>id -> the card's PLAY button and its parts, so the tick can
        /// re-dress them without rebuilding the list (which would fight the
        /// scroll view).</summary>
        readonly Dictionary<string, (Button Button, Text Label, Image Fill, Image Border)>
            _playButtons = new();

        /// <summary>Ids that were locked when the list was built. Auto-attack
        /// keeps killing while this screen is open, so a card can cross its
        /// unlock level in place.</summary>
        readonly List<string> _lockedIds = new();

        /// <summary>AccrueTokens can raise ArcadeTokensChanged, which re-enters
        /// this refresh; the guard keeps that to a single pass.</summary>
        bool _refreshing;

        Text _tokenLabel;
        Text _nextTokenLabel;
        Transform _cardList;
        Button _offerButton;
        Text _offerLabel;

        void Start()
        {
            _tokenLabel = Find<Text>("TokenLabel");
            _nextTokenLabel = Find<Text>("NextTokenLabel");
            _cardList = FindObject("CardList")?.transform;
            _offerButton = Find<Button>("OfferButton");
            _offerLabel = _offerButton != null
                ? _offerButton.GetComponentInChildren<Text>(true) : null;

            Bind("BackButton", () => Game.Flow.ChangeScene(Scenes.Gameplay));
            _offerButton?.onClick.AddListener(OnOfferPressed);
            Game.Events.ArcadeTokensChanged += OnTokensChanged;

            StartCoroutine(Tick());
            BuildCards();
            RefreshMeter();
        }

        void OnDestroy()
        {
            if (Game.IsBooted) Game.Events.ArcadeTokensChanged -= OnTokensChanged;
        }

        IEnumerator Tick()
        {
            while (true)
            {
                yield return new WaitForSecondsRealtime(TickSeconds);
                RefreshMeter();
            }
        }

        // --- Meter ---------------------------------------------------------------

        void RefreshMeter()
        {
            if (_refreshing) return;
            _refreshing = true;

            Game.Arcade.AccrueTokens();
            int tokens = Game.Arcade.Tokens;
            if (_tokenLabel != null)
                _tokenLabel.text = $"{tokens} / {MinigameManager.TokenCap}";

            int remaining = Game.Arcade.SecondsUntilNextToken();
            if (_nextTokenLabel != null)
            {
                _nextTokenLabel.gameObject.SetActive(remaining > 0);
                if (remaining > 0)
                    _nextTokenLabel.text = $"Next token in {FormatWait(remaining)}";
            }

            // Re-dress the PLAY buttons in place: a token landing must re-enable
            // play without rebuilding the list under the player's thumb.
            foreach (var pair in _playButtons)
                if (pair.Value.Button != null)
                    DressPlayButton(pair.Value, Game.Arcade.GetDefinition(pair.Key));

            _refreshing = false;
            RefreshOffer();

            // Auto-attack keeps killing while this screen is open, so a locked
            // card can cross its unlock level in place. Only then is a full
            // rebuild warranted.
            if (HasNewlyUnlocked()) BuildCards();
        }

        /// <summary>The opt-in token offer appears only when the meter is
        /// actually empty — the moment it helps. It is a bonus, never a gate:
        /// tokens still regenerate on their own timer whether or not the player
        /// ever taps it.</summary>
        void RefreshOffer()
        {
            if (_offerButton == null) return;
            bool show = Game.Arcade.Tokens <= 0 && Game.Shop.CanOffer(OfferId);
            _offerButton.gameObject.SetActive(show);
            if (show && _offerLabel != null)
                _offerLabel.text = Game.Shop.AdsRemoved()
                    ? "CLAIM A TOKEN · FREE" : "WATCH FOR A TOKEN";
        }

        void OnOfferPressed()
        {
            if (Game.Shop.IsBusy()) return;
            _offerButton.interactable = false;
            if (_offerLabel != null) _offerLabel.text = "WATCHING…";
            StartCoroutine(Game.Shop.RunOffer(OfferId, 0f, granted =>
            {
                if (this == null || _offerButton == null) return;
                _offerButton.interactable = true;
                if (granted > 0f) Game.Settings.Vibrate(30);
                RefreshMeter();
            }));
        }

        bool HasNewlyUnlocked()
        {
            foreach (var id in _lockedIds)
            {
                var definition = Game.Arcade.GetDefinition(id);
                if (definition != null && Game.Arcade.IsUnlocked(definition)) return true;
            }
            return false;
        }

        /// <summary>Compact and register-neutral: this reads inside a sentence
        /// ("Next token in &lt;1m") AND inside an all-caps button face ("NEXT
        /// TOKEN &lt;1m").</summary>
        static string FormatWait(int seconds)
        {
            int minutes = seconds / 60;
            return minutes < 1 ? "<1m" : $"{minutes}m";
        }

        void OnTokensChanged(int count) => RefreshMeter();

        // --- Cards ---------------------------------------------------------------

        void BuildCards()
        {
            if (_cardList == null) return;
            UIBuild.Clear(_cardList);
            _playButtons.Clear();
            _lockedIds.Clear();

            foreach (var definition in Game.Arcade.GetDefinitions())
            {
                if (!Game.Arcade.IsUnlocked(definition)) _lockedIds.Add(definition.id);
                MakeCard(definition);
            }
        }

        void MakeCard(MinigameDefinition definition)
        {
            bool unlocked = Game.Arcade.IsUnlocked(definition);

            // A locked card recedes by dimming its BACKGROUND, never the whole
            // card: dimming would drag the description under the contrast floor.
            var card = UIBuild.Frame(_cardList,
                unlocked ? VantaTheme.Surface : VantaTheme.Fade(VantaTheme.Surface, 0.5f),
                VantaTheme.Line, borderWidth: 0f, padding: 16f, name: $"Game_{definition.id}");

            // The arcade "one class" spine on every card.
            var spine = UIBuild.Bar(card.Root.transform,
                unlocked ? ArcadeAccent : VantaTheme.Line, width: 4f);
            var spineRect = (RectTransform)spine.transform;
            spineRect.anchorMin = Vector2.zero;
            spineRect.anchorMax = new Vector2(0f, 1f);
            spineRect.pivot = new Vector2(0f, 0.5f);
            spineRect.sizeDelta = new Vector2(4f, 0f);
            spineRect.anchoredPosition = Vector2.zero;

            var column = UIBuild.Column(card.Content, spacing: 8f, align: TextAnchor.UpperLeft);
            UIBuild.Stretch((RectTransform)column.transform);

            // Row 1: icon + name + best.
            var top = UIBuild.Row(column.transform, spacing: 16f);
            UIBuild.Icon(top.transform, definition.icon, 96f);
            UIBuild.Expand(UIBuild.Label(top.transform, definition.displayName, 27,
                VantaTheme.Ink, TextAnchor.MiddleLeft));
            if (Game.Arcade.HasBest(definition.id))
                UIBuild.Label(top.transform,
                    $"Best: {NumberFormat.Format(Game.Arcade.GetBest(definition.id))}",
                    18, ArcadeAccent, TextAnchor.MiddleRight, wrap: false);

            // Row 2: description.
            UIBuild.Label(column.transform, definition.description, 18, VantaTheme.Muted,
                TextAnchor.MiddleLeft);

            // Row 3: action.
            if (!unlocked)
            {
                UIBuild.Label(column.transform, $"REACHES Lv. {definition.unlockLevel}", 18,
                    VantaTheme.Muted, TextAnchor.MiddleLeft);
                return;
            }

            var (button, panel) = UIBuild.Tile(column.transform,
                VantaTheme.AccentDeep, ArcadeAccent,
                borderWidth: 2f, padding: 8f, name: $"Play_{definition.id}");
            UIBuild.SizeTo(panel.Root, new Vector2(220f, 96f));
            var buttonColumn = UIBuild.Column(panel.Content);
            UIBuild.Stretch((RectTransform)buttonColumn.transform);
            var label = UIBuild.Label(buttonColumn.transform, "PLAY", 27, Color.white,
                wrap: false);

            var parts = (button, label, panel.Fill, panel.Border);
            button.onClick.AddListener(() => OnPlayPressed(definition));
            DressPlayButton(parts, definition);
            _playButtons[definition.id] = parts;
        }

        /// <summary>Set a PLAY button's affordability state. Every state carries
        /// a WORD, so it never depends on colour or on the disabled tint
        /// alone.</summary>
        static void DressPlayButton(
            (Button Button, Text Label, Image Fill, Image Border) parts,
            MinigameDefinition definition)
        {
            if (definition == null || parts.Button == null) return;

            if (Game.Arcade.HasToken(definition.tokenCost))
            {
                parts.Button.interactable = true;
                if (parts.Fill != null) parts.Fill.color = VantaTheme.AccentDeep;
                if (parts.Border != null) parts.Border.color = ArcadeAccent;
                if (parts.Label != null)
                {
                    parts.Label.color = Color.white;
                    parts.Label.text = $"PLAY · {definition.tokenCost} TOKEN";
                }
                return;
            }

            parts.Button.interactable = false;
            if (parts.Fill != null) parts.Fill.color = VantaTheme.Surface;
            if (parts.Border != null) parts.Border.color = VantaTheme.Line;
            if (parts.Label == null) return;
            parts.Label.color = VantaTheme.Muted;
            int remaining = Game.Arcade.SecondsUntilNextToken();
            parts.Label.text = remaining > 0
                ? $"NEXT TOKEN {FormatWait(remaining)}" : "NO TOKENS";
        }

        void OnPlayPressed(MinigameDefinition definition)
        {
            // Spend on entry, before the game loads: a crash mid-game costs the
            // token but can never double-spend it (UX §9).
            if (!Game.Arcade.TrySpendToken(definition.tokenCost))
            {
                RefreshMeter();
                return;
            }
            Game.Settings.Vibrate(20);
            Game.Arcade.PendingId = definition.id;
            Game.Flow.ChangeScene(Scenes.MinigameHost);
        }
    }
}
