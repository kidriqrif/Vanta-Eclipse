// Ported from scripts/ui/eclipse.gd
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;
using VantaEclipse.Data;
using VantaEclipse.Managers;

namespace VantaEclipse.UI
{
    /// <summary>
    /// The Eclipse screen — the prestige ritual (ASCEND) and the Ascendant
    /// Powers tree (POWERS), switched by a segmented control that shares one
    /// Void-Crystal header.
    ///
    /// A full screen, so it holds any boss gate through the existing
    /// scene-transition test and needs no ui_overlay plumbing. Never required to
    /// progress. Reads PrestigeManager / SkillTreeManager and asks them to act.
    /// </summary>
    public sealed class Eclipse : UIScreen
    {
        /// <summary>How long the armed COLLAPSE confirm stays hot before
        /// disarming (§3A).</summary>
        public const float ArmSeconds = 2.5f;

        /// <summary>Per-stat suffix for the effect line, so a bonus always names
        /// what it feeds.</summary>
        static readonly Dictionary<string, string> StatSuffix = new()
        {
            { "tap_pct", "tap damage" },
            { "crit_damage", "crit damage" },
            { "essence", "essence gain" },
            { "offline_efficiency", "offline rate" },
            { "offline_cap_hours", "offline cap (h)" },
            { "crystal_gain", "crystal gain" },
            { "boss", "boss damage" },
            { "attack_speed", "attack speed" },
        };

        /// <summary>Eclipse used to carry its own teal. One accent now, so the
        /// prestige screen reads in the same red as everything else and is told
        /// apart by its content.</summary>
        public static Color Crystal => VantaTheme.Accent;
        public static Color CrystalCore => Color.white;
        public static Color CrystalDeep => VantaTheme.AccentDeep;

        bool _collapseArmed;
        Button _collapseButton;
        Text _collapseLabel;
        Image _collapseFill;
        Image _collapseBorder;

        Text _crystalLabel;
        Button _ascendTab;
        Button _powersTab;
        GameObject _ascendScroll;
        GameObject _powersScroll;
        Transform _ascendBox;
        Transform _powersList;

        void Start()
        {
            _crystalLabel = Find<Text>("CrystalLabel");
            _ascendTab = Find<Button>("AscendTab");
            _powersTab = Find<Button>("PowersTab");
            _ascendScroll = FindObject("AscendScroll");
            _powersScroll = FindObject("PowersScroll");
            _ascendBox = FindObject("AscendBox")?.transform;
            _powersList = FindObject("PowersList")?.transform;

            Bind("BackButton", OnBackPressed);
            _ascendTab?.onClick.AddListener(() => SetActiveTab(true));
            _powersTab?.onClick.AddListener(() => SetActiveTab(false));

            Game.Events.CurrencyChanged += OnCurrencyChanged;
            Game.Events.SkillPurchased += OnSkillPurchased;

            UpdateCrystalLabel();
            BuildAscend();
            BuildPowers();
            SetActiveTab(true);
        }

        void OnDestroy()
        {
            if (!Game.IsBooted) return;
            Game.Events.CurrencyChanged -= OnCurrencyChanged;
            Game.Events.SkillPurchased -= OnSkillPurchased;
        }

        // --- Header / tabs -----------------------------------------------------

        void UpdateCrystalLabel()
        {
            if (_crystalLabel != null)
                _crystalLabel.text = NumberFormat.Format(
                    Game.Currency.GetBalance(CurrencyManager.VoidCrystals));
        }

        void SetActiveTab(bool ascend)
        {
            if (_ascendScroll != null) _ascendScroll.SetActive(ascend);
            if (_powersScroll != null) _powersScroll.SetActive(!ascend);
            StyleTab(_ascendTab, ascend);
            StyleTab(_powersTab, !ascend);
        }

        static void StyleTab(Button button, bool active)
        {
            if (button == null) return;

            var fill = button.GetComponent<Image>();
            if (fill != null)
                fill.color = active ? CrystalDeep : VantaTheme.Fade(VantaTheme.Surface, 0.6f);

            // The active tab is underlined as well as filled. Two channels, so
            // the selection survives both a colour-blind read and a dim screen.
            var underline = button.transform.Find("Underline");
            if (underline == null)
            {
                var go = UIBuild.Node("Underline", button.transform);
                var rect = (RectTransform)go.transform;
                rect.anchorMin = new Vector2(0f, 0f);
                rect.anchorMax = new Vector2(1f, 0f);
                rect.pivot = new Vector2(0.5f, 0f);
                rect.sizeDelta = new Vector2(0f, 4f);
                rect.anchoredPosition = Vector2.zero;
                var image = go.AddComponent<Image>();
                image.raycastTarget = false;
                underline = go.transform;
            }
            var underlineImage = underline.GetComponent<Image>();
            if (underlineImage != null)
                underlineImage.color = active ? Crystal : VantaTheme.Invisible;

            var label = button.GetComponentInChildren<Text>(true);
            if (label != null) label.color = active ? CrystalCore : VantaTheme.Muted;
        }

        // --- ASCEND panel --------------------------------------------------------

        void BuildAscend()
        {
            if (_ascendBox == null) return;
            UIBuild.Clear(_ascendBox);

            var icon = UIBuild.Icon(_ascendBox, UISprites.Eclipse, 150f);
            UIBuild.Expand(icon);

            bool can = Game.Prestige.CanEclipse();
            int reward = Game.Prestige.CrystalReward();

            UIBuild.Label(_ascendBox,
                can ? "Collapsing this run yields" : "Not ready to collapse",
                18, VantaTheme.Muted);

            UIBuild.Label(_ascendBox,
                can ? $"◆ {NumberFormat.Format(reward)} Void Crystals"
                    : $"Reach Lv. {PrestigeManager.EclipseUnlockLevel} this run",
                36, Crystal);

            UIBuild.Label(_ascendBox, $"Run peak: Lv. {Game.Prestige.RunPeakLevel}",
                18, VantaTheme.Muted);

            var columns = UIBuild.Row(_ascendBox, spacing: 16f, align: TextAnchor.UpperCenter);
            MakeSummaryColumn(columns.transform, "RESETS", VantaTheme.Muted,
                "Eclipse Essence", "All upgrades", "World progress", "Auto-Attack*");
            MakeSummaryColumn(columns.transform, "KEPT", Crystal,
                "Void Crystals", "Ascendant Powers", "Equipment", "Relics", "Pets");

            UIBuild.Label(_ascendBox,
                "*Auto-Attack is re-earned at Lv. 15 — unless Eternal Reflex is owned.",
                18, VantaTheme.Muted, TextAnchor.MiddleLeft);

            _collapseArmed = false;
            var (button, panel) = UIBuild.Tile(_ascendBox, CrystalDeep, Crystal,
                borderWidth: 0f, padding: 14f, name: "CollapseButton");
            UIBuild.MinHeight(panel.Root.transform, 120f);
            var column = UIBuild.Column(panel.Content);
            UIBuild.Stretch((RectTransform)column.transform);
            _collapseLabel = UIBuild.Label(column.transform,
                can ? "COLLAPSE INTO ECLIPSE"
                    : $"REACH LV. {PrestigeManager.EclipseUnlockLevel} TO COLLAPSE",
                27, CrystalCore);
            _collapseButton = button;
            _collapseFill = panel.Fill;
            _collapseBorder = panel.Border;
            button.interactable = can;
            button.onClick.AddListener(OnCollapsePressed);
        }

        void MakeSummaryColumn(Transform parent, string title, Color accent, params string[] items)
        {
            var panel = UIBuild.Frame(parent, VantaTheme.Surface, VantaTheme.Line,
                borderWidth: 0f, padding: 16f, name: $"Column_{title}");
            UIBuild.Expand(panel.Root.transform);

            var column = UIBuild.Column(panel.Content, spacing: 8f,
                align: TextAnchor.UpperLeft);
            UIBuild.Stretch((RectTransform)column.transform);
            UIBuild.Label(column.transform, title, 18, accent, TextAnchor.MiddleLeft);
            foreach (var item in items)
                UIBuild.Label(column.transform, $"· {item}", 18, VantaTheme.Ink,
                    TextAnchor.MiddleLeft);
        }

        void StyleCollapse(bool armed)
        {
            if (_collapseFill != null) _collapseFill.color = armed ? Crystal : CrystalDeep;
            if (_collapseBorder != null) _collapseBorder.color = Crystal;
            // Armed inverts to black-on-accent. The words change too — "TAP
            // AGAIN" is what actually communicates the state.
            if (_collapseLabel != null) _collapseLabel.color = armed ? Color.black : CrystalCore;
        }

        void OnCollapsePressed()
        {
            if (!Game.Prestige.CanEclipse()) return;

            if (!_collapseArmed)
            {
                _collapseArmed = true;
                if (_collapseLabel != null)
                    _collapseLabel.text =
                        $"TAP AGAIN · +{Game.Prestige.CrystalReward()} CRYSTALS · RESETS RUN";
                StyleCollapse(true);
                Scheduler.After(ArmSeconds, DisarmCollapse);
                return;
            }

            Game.Settings.Vibrate(60);
            int reward = Game.Prestige.PerformEclipse();
            CelebrateAndReturn(reward);
        }

        void DisarmCollapse()
        {
            if (this == null || _collapseButton == null || !_collapseArmed) return;
            _collapseArmed = false;
            if (_collapseLabel != null) _collapseLabel.text = "COLLAPSE INTO ECLIPSE";
            StyleCollapse(false);
        }

        void CelebrateAndReturn(int reward)
        {
            if (_collapseButton != null) _collapseButton.interactable = false;
            var banner = UIPrefabs.Spawn<ResultBanner>(transform);
            if (banner == null)
            {
                Game.Flow.ChangeScene(Scenes.Gameplay);
                return;
            }
            banner.Setup(UISprites.Eclipse, "ECLIPSE", $"+{reward} Void Crystals", true);
            banner.Finished += () => Game.Flow.ChangeScene(Scenes.Gameplay);
            banner.Play();
        }

        // --- POWERS panel ---------------------------------------------------------

        void BuildPowers()
        {
            if (_powersList == null) return;
            UIBuild.Clear(_powersList);

            string currentBranch = "";
            foreach (var definition in Game.Skills.GetDefinitions())
            {
                if (definition.branch != currentBranch)
                {
                    currentBranch = definition.branch;
                    MakeBranchHeader(currentBranch);
                }
                MakeNodeCard(definition);
            }
        }

        /// <summary>Branch heading plus the hairline rule that separates the
        /// tree's sections (visual §3B).</summary>
        void MakeBranchHeader(string title)
        {
            var column = UIBuild.Column(_powersList, spacing: 6f, align: TextAnchor.UpperLeft);
            UIBuild.Label(column.transform, title.ToUpperInvariant(), 27, VantaTheme.Muted,
                TextAnchor.MiddleLeft);
            var rule = UIBuild.Bar(column.transform, VantaTheme.Fade(Crystal, 0.35f),
                width: 0f, height: 2f);
            UIBuild.Expand(rule);
        }

        void MakeNodeCard(SkillNodeDefinition definition)
        {
            int level = Game.Skills.GetLevel(definition.id);
            bool maxed = Game.Skills.IsMaxed(definition.id);
            bool locked = !Game.Skills.PrereqMet(definition.id);

            // A locked node recedes by dimming its BACKGROUND, never the text:
            // dimming the whole card would drag the effect line under the
            // contrast floor. The state is carried by the "REQUIRES …" word
            // regardless.
            var card = UIBuild.Frame(_powersList,
                locked ? VantaTheme.Fade(VantaTheme.Surface, 0.5f) : VantaTheme.Surface,
                locked ? VantaTheme.Line : Crystal,
                borderWidth: 0f, padding: 16f, name: $"Power_{definition.id}");

            // The prestige "one class" spine down the left edge of every card.
            var spine = UIBuild.Bar(card.Root.transform,
                locked ? VantaTheme.Line : Crystal, width: 4f);
            var spineRect = (RectTransform)spine.transform;
            spineRect.anchorMin = Vector2.zero;
            spineRect.anchorMax = new Vector2(0f, 1f);
            spineRect.pivot = new Vector2(0f, 0.5f);
            spineRect.sizeDelta = new Vector2(4f, 0f);
            spineRect.anchoredPosition = Vector2.zero;

            var column = UIBuild.Column(card.Content, spacing: 6f, align: TextAnchor.UpperLeft);
            UIBuild.Stretch((RectTransform)column.transform);

            // Row 1: name + state marker.
            var nameRow = UIBuild.Row(column.transform, spacing: 12f);
            UIBuild.Expand(UIBuild.Label(nameRow.transform, definition.displayName, 27,
                VantaTheme.Ink, TextAnchor.MiddleLeft));
            UIBuild.Label(nameRow.transform,
                maxed ? "● MAXED" : $"● Lv. {level} / {definition.maxLevel}",
                18, maxed ? CrystalCore : Crystal, TextAnchor.MiddleRight, wrap: false);

            // Row 2: effect line.
            UIBuild.Label(column.transform, EffectLine(definition, level), 18,
                VantaTheme.Muted, TextAnchor.MiddleLeft);

            // Row 3: action.
            MakeAction(column.transform, definition, maxed, locked);
        }

        void MakeAction(Transform parent, SkillNodeDefinition definition, bool maxed, bool locked)
        {
            if (maxed)
            {
                UIBuild.Label(parent, "● MAXED", 18, CrystalCore, TextAnchor.MiddleLeft);
                return;
            }
            if (locked)
            {
                var prereq = Game.Skills.GetDefinition(definition.prereqId);
                string prereqName = prereq != null ? prereq.displayName : definition.prereqId;
                UIBuild.Label(parent,
                    $"REQUIRES {prereqName} Lv. {definition.prereqLevel}",
                    18, VantaTheme.Muted, TextAnchor.MiddleLeft);
                return;
            }

            int cost = (int)Game.Skills.GetCost(definition.id);
            bool affordable = Game.Skills.CanBuy(definition.id);

            var (button, panel) = UIBuild.Tile(parent,
                affordable ? CrystalDeep : VantaTheme.Surface,
                affordable ? Crystal : VantaTheme.Line,
                borderWidth: 2f, padding: 8f, name: $"Buy_{definition.id}");
            UIBuild.SizeTo(panel.Root, new Vector2(220f, 96f));
            var column = UIBuild.Column(panel.Content);
            UIBuild.Stretch((RectTransform)column.transform);

            if (affordable)
            {
                UIBuild.Label(column.transform, $"BUY · {cost}", 27, CrystalCore, wrap: false);
                string id = definition.id;
                button.onClick.AddListener(() => Game.Skills.Buy(id));
            }
            else
            {
                button.interactable = false;
                // Maxed and locked returned above, so the only way CanBuy is
                // false here is affordability — state the shortfall, not the
                // sticker price.
                int owned = (int)Game.Currency.GetBalance(CurrencyManager.VoidCrystals);
                UIBuild.Label(column.transform, $"NEED {Mathf.Max(1, cost - owned)} MORE", 18,
                    VantaTheme.Muted, wrap: false);
            }
        }

        string EffectLine(SkillNodeDefinition definition, int level)
        {
            if (definition.effectKind == SkillNodeDefinition.EffectKind.FLAG)
                return definition.description;

            StatSuffix.TryGetValue(definition.effectStat, out string suffix);
            suffix ??= "";

            if (level >= definition.maxLevel)
                return $"{definition.FormatTotal(level)} {suffix} (max)";
            if (level <= 0)
                return $"Next: {definition.FormatTotal(1)} {suffix}";
            return $"{definition.FormatTotal(level)} {suffix}  →  " +
                   $"{definition.FormatTotal(level + 1)} {suffix}";
        }

        // --- Signals ---------------------------------------------------------------

        void OnCurrencyChanged(string currency, float balance)
        {
            if (currency == CurrencyManager.VoidCrystals) UpdateCrystalLabel();
        }

        void OnSkillPurchased(string id, int newLevel)
        {
            Game.Settings.Vibrate(20);
            BuildPowers();
        }

        void OnBackPressed()
        {
            Game.Save.SaveGame();
            Game.Flow.ChangeScene(Scenes.Gameplay);
        }
    }
}
