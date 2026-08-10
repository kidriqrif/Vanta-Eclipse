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
    /// The Journal — quests, dailies and achievements behind one segmented
    /// control. A full screen, so it holds any boss gate through the existing
    /// scene-transition test. Reads QuestManager and asks it to claim; it never
    /// grants anything itself.
    ///
    /// Reward text used to be tinted per currency — violet, lime, teal — which
    /// put three accents in a list whose own words already say what the reward
    /// is. They are one muted register now, except Astral Shards: those are the
    /// scarcest thing the Journal hands out, so they get the accent and nothing
    /// else does.
    /// </summary>
    public sealed class Journal : UIScreen
    {
        /// <summary>How long a claim refusal borrows the reset label before the
        /// normal "Resets in …" text is allowed back.</summary>
        public const float RefusalHoldSeconds = 4f;
        public const float ResetTickSeconds = 30f;

        QuestDefinition.Kind _tab = QuestDefinition.Kind.QUEST;

        /// <summary>Unscaled-time deadline while a refusal owns the reset label
        /// (0 = nobody has it). The 30s tick and SetTab both honour it, so the
        /// explanation can neither be overwritten mid-read nor stranded on a tab
        /// that has no reset time.</summary>
        float _refusalUntil;

        /// <summary>id -> the row that renders it, so a completion or claim
        /// re-dresses that row in place instead of rebuilding the list under the
        /// player's thumb.</summary>
        readonly Dictionary<string, GameObject> _rows = new();

        GameObject _readyPill;
        Text _readyLabel;
        Button _questsTab;
        Button _dailyTab;
        Button _achievementsTab;
        Text _resetLabel;
        Transform _goalList;

        void Start()
        {
            _readyPill = FindObject("ReadyPill");
            _readyLabel = Find<Text>("ReadyLabel");
            _questsTab = Find<Button>("QuestsTab");
            _dailyTab = Find<Button>("DailyTab");
            _achievementsTab = Find<Button>("AchievementsTab");
            _resetLabel = Find<Text>("ResetLabel");
            _goalList = FindObject("GoalList")?.transform;

            Bind("BackButton", () => Game.Flow.ChangeScene(Scenes.Gameplay));
            _questsTab?.onClick.AddListener(() => SetTab(QuestDefinition.Kind.QUEST));
            _dailyTab?.onClick.AddListener(() => SetTab(QuestDefinition.Kind.DAILY));
            _achievementsTab?.onClick.AddListener(
                () => SetTab(QuestDefinition.Kind.ACHIEVEMENT));

            Game.Events.GoalCompleted += OnGoalChanged;
            Game.Events.GoalClaimed += OnGoalClaimed;
            Game.Events.DailiesRerolled += OnDailiesRerolled;

            // Opening the Journal is one of the two moments dailies can roll
            // over, and it re-latches anything completed while it was closed.
            Game.Journal.RefreshDailies();
            Game.Journal.Evaluate();

            StartCoroutine(TickResetLabel());
            SetTab(QuestDefinition.Kind.QUEST);
        }

        void OnDestroy()
        {
            if (!Game.IsBooted) return;
            Game.Events.GoalCompleted -= OnGoalChanged;
            Game.Events.GoalClaimed -= OnGoalClaimed;
            Game.Events.DailiesRerolled -= OnDailiesRerolled;
        }

        // --- Tabs ---------------------------------------------------------------

        void SetTab(QuestDefinition.Kind kind)
        {
            _tab = kind;
            // Changing tabs answers the refusal — drop it so the label below is
            // governed purely by the new tab.
            _refusalUntil = 0f;
            StyleTab(_questsTab, kind == QuestDefinition.Kind.QUEST);
            StyleTab(_dailyTab, kind == QuestDefinition.Kind.DAILY);
            StyleTab(_achievementsTab, kind == QuestDefinition.Kind.ACHIEVEMENT);
            if (_resetLabel != null)
                _resetLabel.gameObject.SetActive(kind == QuestDefinition.Kind.DAILY);
            RefreshResetLabel();
            Rebuild();
        }

        IEnumerator TickResetLabel()
        {
            while (true)
            {
                yield return new WaitForSecondsRealtime(ResetTickSeconds);
                RefreshResetLabel();
            }
        }

        void RefreshResetLabel()
        {
            // A refusal is borrowing the label; do not overwrite it with a reset
            // time the player never asked about (and which is wrong outside
            // DAILY).
            if (Time.unscaledTime < _refusalUntil) return;
            if (_resetLabel == null || !_resetLabel.gameObject.activeSelf) return;
            _resetLabel.text = $"Resets in {FormatReset(Game.Journal.SecondsUntilDailyReset())}";
        }

        /// <summary>Borrow the reset label to explain a refused claim. The label
        /// is DAILY-only furniture, so this has to hand it back afterwards —
        /// claiming from ACHIEVEMENTS otherwise leaves a stray "Resets in 7h" on
        /// a tab that has no reset at all.</summary>
        void ShowRefusal(string text)
        {
            if (_resetLabel == null) return;
            _refusalUntil = Time.unscaledTime + RefusalHoldSeconds;
            _resetLabel.gameObject.SetActive(true);
            _resetLabel.text = text;
            Scheduler.After(RefusalHoldSeconds, EndRefusal);
        }

        void EndRefusal()
        {
            if (this == null || _resetLabel == null) return;
            // A tab change (or a second refusal) may have moved on already.
            if (Time.unscaledTime < _refusalUntil) return;
            _refusalUntil = 0f;
            _resetLabel.gameObject.SetActive(_tab == QuestDefinition.Kind.DAILY);
            RefreshResetLabel();
        }

        static void StyleTab(Button button, bool active)
        {
            if (button == null) return;

            var fill = button.GetComponent<Image>();
            if (fill != null)
                fill.color = active ? VantaTheme.Raised : VantaTheme.Fade(VantaTheme.Surface, 0.6f);

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
                go.AddComponent<Image>().raycastTarget = false;
                underline = go.transform;
            }
            var underlineImage = underline.GetComponent<Image>();
            if (underlineImage != null)
                underlineImage.color = active ? VantaTheme.Ink : VantaTheme.Invisible;

            var label = button.GetComponentInChildren<Text>(true);
            if (label != null) label.color = active ? VantaTheme.Ink : VantaTheme.Muted;
        }

        static string FormatReset(int seconds)
        {
            int hours = seconds / 3600;
            if (hours >= 1) return $"{hours}h";
            return $"{Mathf.Max(1, seconds / 60)}m";
        }

        // --- List -----------------------------------------------------------------

        void Rebuild()
        {
            if (_goalList == null) return;
            UIBuild.Clear(_goalList);
            _rows.Clear();

            var goals = Game.Journal.GetGoals(_tab);
            if (goals.Count == 0)
                UIBuild.Label(_goalList, "Nothing here yet.", 18, VantaTheme.Muted);

            foreach (var definition in goals)
                _rows[definition.id] = MakeRow(definition);

            RefreshReadyPill();
        }

        GameObject MakeRow(QuestDefinition definition)
        {
            bool claimed = Game.Journal.IsClaimed(definition);
            bool claimable = Game.Journal.IsClaimable(definition);

            // A claimed card recedes by dimming its GROUND, never the whole
            // card: dimming the card would take the text with it.
            var card = UIBuild.Frame(_goalList,
                claimed ? VantaTheme.Fade(VantaTheme.Surface, 0.5f) : VantaTheme.Surface,
                VantaTheme.Line, borderWidth: 0f, padding: 16f, name: $"Goal_{definition.id}");

            // The spine brightens when a goal is claimable, so a reward waiting
            // to be collected is scannable down the left edge before reading a
            // word.
            var spine = UIBuild.Overlay(UIBuild.Bar(card.Root.transform,
                claimable ? VantaTheme.Ink : VantaTheme.Fade(VantaTheme.Ink, 0.35f), width: 4f));
            var spineRect = (RectTransform)spine.transform;
            spineRect.anchorMin = Vector2.zero;
            spineRect.anchorMax = new Vector2(0f, 1f);
            spineRect.pivot = new Vector2(0f, 0.5f);
            spineRect.sizeDelta = new Vector2(4f, 0f);
            spineRect.anchoredPosition = Vector2.zero;

            var column = UIBuild.Column(card.Content, spacing: 8f, align: TextAnchor.UpperLeft);
            UIBuild.Stretch((RectTransform)column.transform);

            // Row 1: name + reward, the reward in its own family's colour.
            var top = UIBuild.Row(column.transform, spacing: 12f);
            UIBuild.Expand(UIBuild.Label(top.transform, definition.displayName, 27,
                VantaTheme.Ink, TextAnchor.MiddleLeft));
            UIBuild.Label(top.transform, definition.FormatReward(), 18,
                RewardInk(definition), TextAnchor.MiddleRight, wrap: false);

            // Row 2: description.
            UIBuild.Label(column.transform, definition.description, 18, VantaTheme.Muted,
                TextAnchor.MiddleLeft);

            // Row 3: progress bar + the numeric, which is never omitted.
            var progressRow = UIBuild.Row(column.transform, spacing: 12f);
            MakeProgressBar(progressRow.transform, definition);
            UIBuild.Label(progressRow.transform, ProgressText(definition), 18,
                VantaTheme.Muted, TextAnchor.MiddleRight, wrap: false);

            // Row 4: the action, when there is one.
            MakeAction(column.transform, definition, claimed, claimable);
            return card.Root;
        }

        static void MakeProgressBar(Transform parent, QuestDefinition definition)
        {
            float fraction = Mathf.Clamp01(
                Game.Journal.GetProgress(definition) / Mathf.Max(1f, definition.target));

            var track = UIBuild.Frame(parent, VantaTheme.Raised, VantaTheme.Line,
                borderWidth: 0f, padding: 0f, name: "ProgressTrack");
            UIBuild.Expand(track.Root.transform);
            UIBuild.MinHeight(track.Root.transform, 28f);

            var fill = UIBuild.Overlay(UIBuild.Node("Fill", track.Root.transform));
            var rect = (RectTransform)fill.transform;
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = new Vector2(fraction, 1f);
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
            var image = fill.AddComponent<Image>();
            image.color = VantaTheme.Ink;
            image.raycastTarget = false;
        }

        void MakeAction(Transform parent, QuestDefinition definition, bool claimed, bool claimable)
        {
            if (claimable)
            {
                var (button, panel) = UIBuild.Tile(parent, VantaTheme.AccentDeep, VantaTheme.Accent,
                    borderWidth: 2f, padding: 8f, name: $"Claim_{definition.id}");
                UIBuild.SizeTo(panel.Root, new Vector2(220f, 96f));
                var column = UIBuild.Column(panel.Content);
                UIBuild.Stretch((RectTransform)column.transform);
                UIBuild.Label(column.transform, "CLAIM", 27, VantaTheme.Ivory, wrap: false);

                string id = definition.id;
                button.onClick.AddListener(() => OnClaimPressed(id));
                return;
            }
            if (claimed)
            {
                UIBuild.Label(parent, "● CLAIMED", 18, VantaTheme.Muted, TextAnchor.MiddleRight);
                return;
            }
            // Incomplete: the numeric above already carries the state, so this
            // row stays empty rather than repeating it.
        }

        static string ProgressText(QuestDefinition definition)
            => $"{NumberFormat.FormatExact(Game.Journal.GetProgress(definition))} / " +
               $"{NumberFormat.FormatExact(definition.target)}";

        static Color RewardInk(QuestDefinition definition)
            => definition.rewardKind == QuestDefinition.RewardKind.ASTRAL_SHARDS
                ? VantaTheme.Accent : VantaTheme.Muted;

        void RefreshReadyPill()
        {
            int count = Game.Journal.GetUnclaimedCount();
            if (_readyPill != null) _readyPill.SetActive(count > 0);
            if (_readyLabel != null) _readyLabel.text = $"{count} READY";
        }

        // --- Signals ---------------------------------------------------------------

        void OnClaimPressed(string id)
        {
            string text = Game.Journal.Claim(id);
            if (string.IsNullOrEmpty(text))
            {
                // Refused: already claimed (a safe double-tap), or a token reward
                // with no room in the meter — say so rather than looking broken.
                var definition = Game.Journal.GetDefinition(id);
                if (definition != null && Game.Journal.IsClaimable(definition))
                    ShowRefusal("Arcade token meter is full — spend one first.");
                return;
            }
            Game.Settings.Vibrate(30);
        }

        void OnGoalChanged(string id) => Redress(id);

        void OnGoalClaimed(string id, string rewardText)
        {
            // Re-dress first — that swaps in the row which shows "● CLAIMED" —
            // and let Redress pop the REPLACEMENT. Popping the outgoing row
            // would animate an object being destroyed in the same frame, which
            // is no animation at all.
            Redress(id, pop: true);
            // A claimed quest reveals the next link. Append it rather than
            // rebuilding: a rebuild would reset the scroll position under the
            // player's thumb.
            if (_tab == QuestDefinition.Kind.QUEST) AppendNewGoals();
        }

        /// <summary>Add any goal now visible in this tab that has no row yet,
        /// preserving scroll.</summary>
        void AppendNewGoals()
        {
            foreach (var definition in Game.Journal.GetGoals(_tab))
            {
                if (_rows.ContainsKey(definition.id)) continue;
                _rows[definition.id] = MakeRow(definition);
            }
            RefreshReadyPill();
        }

        void OnDailiesRerolled()
        {
            if (_tab == QuestDefinition.Kind.DAILY) Rebuild();
        }

        /// <summary>Replace one row in place, keeping the player's scroll
        /// position.</summary>
        void Redress(string id, bool pop = false)
        {
            if (!_rows.TryGetValue(id, out var row) || row == null)
            {
                RefreshReadyPill();
                return;
            }
            var definition = Game.Journal.GetDefinition(id);
            if (definition == null)
            {
                RefreshReadyPill();
                return;
            }

            int index = row.transform.GetSiblingIndex();
            var replacement = MakeRow(definition);
            replacement.transform.SetSiblingIndex(index);
            _rows[id] = replacement;

            row.transform.SetParent(null, false);
            Destroy(row);

            if (pop) StartCoroutine(Pop((RectTransform)replacement.transform));
            RefreshReadyPill();
        }

        static IEnumerator Pop(RectTransform rect)
        {
            const float seconds = 0.2f;
            const float from = 1.03f;
            float elapsed = 0f;
            rect.localScale = Vector3.one * from;
            while (elapsed < seconds)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / seconds);
                float inv = t - 1f;
                float eased = 1f + 2.70158f * inv * inv * inv + 1.70158f * inv * inv;
                rect.localScale = Vector3.one * Mathf.LerpUnclamped(from, 1f, eased);
                yield return null;
            }
            rect.localScale = Vector3.one;
        }
    }
}
