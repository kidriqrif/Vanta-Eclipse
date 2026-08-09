// Ported from scripts/ui/pets.gd
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;
using VantaEclipse.Data;

namespace VantaEclipse.UI
{
    /// <summary>
    /// The Pets screen — the active companion showcase (sprite, level, XP,
    /// evolution, passive bonus) and the owned roster. A full screen, so it
    /// holds any boss gate through the existing scene-transition test. Never
    /// required to progress.
    /// </summary>
    public sealed class Pets : UIScreen
    {
        /// <summary>The single companion-class colour (visual §2.5/§5). Pets
        /// never borrow the boss-ember threat accent or any per-species tint —
        /// growth wears one colour.</summary>
        public static Color Accent => VantaTheme.Accent;

        public const float RosterRowHeight = 140f;

        static readonly Dictionary<string, string> StatNames = new()
        {
            { "essence", "Essence Gain" },
            { "tap_pct", "Tap Damage" },
            { "crit_chance", "Crit Chance" },
            { "crit_damage", "Crit Damage" },
            { "boss", "Boss Damage" },
            { "tap_flat", "Tap Damage" },
        };

        Transform _showcase;
        Transform _roster;
        GameObject _emptyLabel;
        Text _companionsHeader;

        void Start()
        {
            _showcase = FindObject("ShowcaseBox")?.transform;
            _roster = FindObject("RosterList")?.transform;
            _emptyLabel = FindObject("EmptyLabel");
            _companionsHeader = Find<Text>("CompanionsHeader");

            Bind("BackButton", OnBackPressed);
            Bind("CardsButton", OnCardsPressed);

            Game.Events.ActivePetChanged += OnChanged;
            Game.Events.PetUnlocked += OnChanged;
            Game.Events.PetLeveled += OnChangedWithLevel;
            Game.Events.PetEvolved += OnChangedWithLevel;

            Refresh();
        }

        void OnDestroy()
        {
            if (!Game.IsBooted) return;
            Game.Events.ActivePetChanged -= OnChanged;
            Game.Events.PetUnlocked -= OnChanged;
            Game.Events.PetLeveled -= OnChangedWithLevel;
            Game.Events.PetEvolved -= OnChangedWithLevel;
        }

        void Refresh()
        {
            BuildShowcase();
            BuildRoster();
        }

        // --- Showcase -----------------------------------------------------------

        void BuildShowcase()
        {
            if (_showcase == null) return;
            UIBuild.Clear(_showcase);

            string active = Game.Pets.GetActiveId();
            if (string.IsNullOrEmpty(active))
            {
                UIBuild.Label(_showcase, "No active companion.", 18, VantaTheme.Muted);
                return;
            }

            var definition = Game.Pets.GetDefinition(active);
            if (definition == null) return;

            int stage = Mathf.Clamp(Game.Pets.GetStage(active), 0,
                Mathf.Max(0, definition.stageSprites.Length - 1));
            int level = Game.Pets.GetLevel(active);

            var sprite = UIBuild.Icon(_showcase,
                definition.stageSprites.Length > 0 ? definition.stageSprites[stage] : null, 300f);
            UIBuild.Expand(sprite);

            UIBuild.Label(_showcase,
                $"{definition.stageNames[stage]} · Stage {stage + 1} of {definition.stageNames.Length}",
                36, VantaTheme.Ink);

            var (into, needed) = Game.Pets.GetLevelProgress(active);
            MakeXpBar(_showcase, into / Mathf.Max(1f, needed));

            UIBuild.Label(_showcase,
                level >= definition.maxLevel
                    ? $"Lv. {level} · MAX"
                    : $"Lv. {level} · {NumberFormat.FormatExact(into)} / " +
                      $"{NumberFormat.FormatExact(needed)} XP",
                18, VantaTheme.Ink);

            UIBuild.Label(_showcase, BonusText(definition, level), 18, VantaTheme.Ink);

            if (stage < definition.evolutionLevels.Length)
                UIBuild.Label(_showcase, $"Evolves at Lv. {definition.evolutionLevels[stage]}",
                    18, VantaTheme.Muted);
        }

        static void MakeXpBar(Transform parent, float fraction)
        {
            var track = UIBuild.Frame(parent, VantaTheme.Raised, VantaTheme.Line,
                borderWidth: 0f, padding: 0f, name: "XpBar");
            UIBuild.MinHeight(track.Root.transform, 46f);

            var fill = UIBuild.Node("Fill", track.Root.transform);
            var rect = (RectTransform)fill.transform;
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = new Vector2(Mathf.Clamp01(fraction), 1f);
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
            var image = fill.AddComponent<Image>();
            image.color = Accent;
            image.raycastTarget = false;
        }

        // --- Roster --------------------------------------------------------------

        void BuildRoster()
        {
            if (_roster == null) return;
            UIBuild.Clear(_roster, _emptyLabel);

            var owned = new List<string>(Game.Pets.GetOwnedIds());
            if (_emptyLabel != null) _emptyLabel.SetActive(owned.Count == 0);
            if (_companionsHeader != null)
                _companionsHeader.text = $"COMPANIONS ({owned.Count})";

            string active = Game.Pets.GetActiveId();
            foreach (var id in owned) MakeRosterRow(id, id == active);
        }

        void MakeRosterRow(string id, bool isActive)
        {
            var definition = Game.Pets.GetDefinition(id);
            if (definition == null) return;
            int stage = Mathf.Clamp(Game.Pets.GetStage(id), 0,
                Mathf.Max(0, definition.stageSprites.Length - 1));

            // Every companion wears the same spine — "one class" (visual §2.5).
            // The active row raises the other three edges to a full border in
            // the same colour; nothing borrows a second accent.
            var (button, panel) = UIBuild.Tile(_roster,
                VantaTheme.Fade(VantaTheme.Surface, 0.9f), Accent,
                borderWidth: isActive ? 2f : 0f, padding: 16f, name: $"Pet_{id}");
            UIBuild.MinHeight(panel.Root.transform, RosterRowHeight);

            var spine = UIBuild.Bar(panel.Root.transform, Accent, width: 6f);
            var spineRect = (RectTransform)spine.transform;
            spineRect.anchorMin = Vector2.zero;
            spineRect.anchorMax = new Vector2(0f, 1f);
            spineRect.pivot = new Vector2(0f, 0.5f);
            spineRect.sizeDelta = new Vector2(6f, 0f);
            spineRect.anchoredPosition = Vector2.zero;

            var row = UIBuild.Row(panel.Content, spacing: 16f);
            UIBuild.Stretch((RectTransform)row.transform);

            UIBuild.Icon(row.transform,
                definition.stageSprites.Length > 0 ? definition.stageSprites[stage] : null, 96f);

            var info = UIBuild.Expand(UIBuild.Column(row.transform, spacing: 4f,
                align: TextAnchor.MiddleLeft));

            var nameRow = UIBuild.Row(info.transform, spacing: 12f);
            UIBuild.Label(nameRow.transform,
                $"{definition.stageNames[stage]} · Lv. {Game.Pets.GetLevel(id)}", 27,
                VantaTheme.Ink, TextAnchor.MiddleLeft, wrap: false);
            if (isActive)
                UIBuild.Label(nameRow.transform, "● ACTIVE", 18, Accent,
                    TextAnchor.MiddleLeft, wrap: false);
            else if (Game.Pets.IsUnseen(id))
                UIBuild.Label(nameRow.transform, "NEW", 18, Accent,
                    TextAnchor.MiddleLeft, wrap: false);

            UIBuild.Label(info.transform, BonusText(definition, Game.Pets.GetLevel(id)), 18,
                VantaTheme.Muted, TextAnchor.MiddleLeft);

            if (!isActive) button.onClick.AddListener(() => Game.Pets.SetActive(id));
            else button.interactable = false;
        }

        // --- Helpers --------------------------------------------------------------

        static string BonusText(PetDefinition definition, int level)
        {
            string percent = NumberFormat.FormatPercent(definition.bonusPerLevel * level);
            if (!StatNames.TryGetValue(definition.bonusStat, out string statName))
                statName = definition.bonusStat;
            return $"{statName} +{percent}";
        }

        void OnChanged(string id) => Refresh();

        void OnChangedWithLevel(string id, int value) => Refresh();

        /// <summary>Cards live one step behind Pets rather than on the main
        /// navigation: a card's only use is feeding the companion, so the screen
        /// that chooses the companion is the one place the trip makes
        /// sense.</summary>
        void OnCardsPressed()
        {
            Game.Pets.MarkAllSeen();
            Game.Save.SaveGame();
            Game.Flow.ChangeScene(Scenes.Cards);
        }

        void OnBackPressed()
        {
            Game.Pets.MarkAllSeen();
            Game.Save.SaveGame();
            Game.Flow.ChangeScene(Scenes.Gameplay);
        }
    }
}
