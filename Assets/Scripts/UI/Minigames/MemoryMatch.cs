// Ported from scripts/minigames/memory_match.gd
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Memory Match — find every pair inside an attempt budget.
    ///
    /// Built as prefab + definition only: it adds nothing to the framework and
    /// overrides nothing but Setup. Board size and budget arrive as data,
    /// timing uses managed coroutines (so the inherited Teardown can stop them),
    /// and the run ends through Finish exactly once.
    ///
    /// Score is ATTEMPTS, and the definition sets lowerIsBetter — fewer is a
    /// better record.
    /// </summary>
    public sealed class MemoryMatch : Minigame
    {
        public const int DefaultPairs = 6;
        public const int DefaultBudget = 12;
        public const int Columns = 3;
        public const float CardSize = 200f;
        /// <summary>How long a mismatched pair stays visible before flipping
        /// back.</summary>
        public const float MismatchHold = 0.75f;
        public const float FlipTime = 0.12f;

        static readonly Color CardBackground = new(0.09f, 0.09f, 0.133f, 0.9f);
        static readonly Color CardEdge = new(0.173f, 0.173f, 0.235f, 0.6f);
        static readonly Color MatchedBackground = new(0.173f, 0.173f, 0.235f, 0.55f);

        int _pairs = DefaultPairs;
        int _budget = DefaultBudget;
        int _attempts;
        int _matched;

        readonly List<Cell> _cards = new();
        readonly List<int> _faces = new();
        readonly List<bool> _matchedFlags = new();
        readonly List<int> _revealed = new();
        bool _busy;

        Text _statusLabel;
        Text _attemptsLabel;

        /// <summary>Board size and budget are data on the definition, never
        /// constants here.</summary>
        public override void Setup(Dictionary<string, object> context)
        {
            _pairs = Mathf.Clamp(ReadInt(context, "pairs", DefaultPairs), 2,
                UISprites.FaceNames.Length);
            _budget = Mathf.Max(_pairs, ReadInt(context, "attempt_budget", DefaultBudget));
        }

        void Start()
        {
            _statusLabel = Find<Text>("StatusLabel");
            _attemptsLabel = Find<Text>("AttemptsLabel");
            BuildBoard();
            RefreshLabels();
        }

        // --- Board ---------------------------------------------------------------

        void BuildBoard()
        {
            var grid = FindObject("CardGrid");
            ConfigureGrid(grid, Columns, CardSize, spacing: 12f);

            var deck = new List<int>();
            for (int face = 0; face < _pairs; face++) { deck.Add(face); deck.Add(face); }
            Shuffle(deck);
            _faces.AddRange(deck);

            for (int index = 0; index < deck.Count; index++)
            {
                _matchedFlags.Add(false);
                int captured = index;
                var card = MakeCell(grid != null ? grid.transform : transform, CardSize,
                    $"Card{index}", withGlyph: true);
                card.Paint(CardBackground, CardEdge, 2f);
                card.SetGlyph(UISprites.CardBack);
                card.Button.onClick.AddListener(() => OnCardPressed(captured));
                _cards.Add(card);
            }
        }

        /// <summary>Fisher-Yates through Unity's RNG, so a seeded run is
        /// reproducible the same way every other board's randomness is.</summary>
        static void Shuffle(List<int> deck)
        {
            for (int i = deck.Count - 1; i > 0; i--)
            {
                int j = Random.Range(0, i + 1);
                (deck[i], deck[j]) = (deck[j], deck[i]);
            }
        }

        /// <summary>The flip reads as a horizontal squash-and-swap: the glyph
        /// changes at the midpoint, so the card turns rather than blinking.
        /// One-shot, 0.24s total.</summary>
        IEnumerator FlipCard(int index, bool faceUp)
        {
            var rect = (RectTransform)_cards[index].Panel.Root.transform;

            float elapsed = 0f;
            while (elapsed < FlipTime)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / FlipTime);
                rect.localScale = new Vector3(Mathf.Lerp(1f, 0.05f, t), 1f, 1f);
                yield return null;
            }

            _cards[index].SetGlyph(faceUp
                ? UISprites.Face(_faces[index]) : UISprites.CardBack);

            elapsed = 0f;
            while (elapsed < FlipTime)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / FlipTime);
                rect.localScale = new Vector3(Mathf.Lerp(0.05f, 1f, t), 1f, 1f);
                yield return null;
            }
            rect.localScale = Vector3.one;
        }

        void OnCardPressed(int index)
        {
            if (_busy || _matchedFlags[index] || _revealed.Contains(index)) return;

            Run(FlipCard(index, faceUp: true));
            _revealed.Add(index);
            if (_revealed.Count < 2) return;

            _attempts++;
            _busy = true;
            int a = _revealed[0];
            int b = _revealed[1];
            if (_faces[a] == _faces[b])
            {
                ResolveMatch(a, b);
            }
            else
            {
                SetStatus("NO MATCH", VantaTheme.Muted);
                Run(HoldThenFlipBack());
            }
            RefreshLabels();
        }

        void ResolveMatch(int a, int b)
        {
            _matchedFlags[a] = true;
            _matchedFlags[b] = true;
            _matched++;
            _revealed.Clear();
            _busy = false;

            foreach (int index in new[] { a, b })
            {
                // Matched cards stay face-up, stop responding, and gain an accent
                // border — state carried by shape and interactivity, not colour
                // alone. The glyph stays full-strength: PaintCell keeps the
                // disabled tint at white precisely so a matched pair locks in
                // rather than fading out.
                _cards[index].Paint(MatchedBackground, VantaTheme.Ink, 3f);
                _cards[index].Button.interactable = false;
            }
            SetStatus("MATCH!", VantaTheme.Ink);

            if (_matched >= _pairs) EndRun(true);
            // The budget can also run out on a successful match that does not
            // clear the board — the run has to end here too, not wait for a
            // mismatch.
            else if (_attempts >= _budget) EndRun(false);
        }

        IEnumerator HoldThenFlipBack()
        {
            yield return new WaitForSecondsRealtime(MismatchHold);
            foreach (int index in _revealed) Run(FlipCard(index, faceUp: false));
            _revealed.Clear();
            _busy = false;
            SetStatus("", VantaTheme.Muted);
            if (_attempts >= _budget) EndRun(false);
        }

        void RefreshLabels()
        {
            if (_attemptsLabel != null)
                _attemptsLabel.text =
                    $"Attempt {Mathf.Min(_attempts, _budget)} of {_budget} · " +
                    $"{_matched} of {_pairs} pairs";
        }

        void SetStatus(string text, Color color)
        {
            if (_statusLabel == null) return;
            _statusLabel.text = text;
            _statusLabel.color = color;
        }

        // --- Reporting -------------------------------------------------------------

        void EndRun(bool won)
        {
            foreach (var card in _cards) card.Button.interactable = false;

            // Win: efficiency, since perfect play clears N pairs in N attempts.
            // Loss: credit the pairs actually found, so the host's loss floor has
            // something to scale. Reporting 0 would make the floor a no-op and
            // pay a near-miss exactly what it pays someone who found nothing.
            float performance = won
                ? _pairs / (float)Mathf.Max(1, _attempts)
                : _matched / (float)_pairs;
            string detail = won
                ? $"{_matched} pairs in {_attempts} attempts"
                : $"{_matched} of {_pairs} pairs";

            SetStatus(won ? "CLEARED" : "OUT OF ATTEMPTS",
                won ? VantaTheme.Ink : VantaTheme.Muted);
            Finish(won ? Outcome.WIN : Outcome.LOSS, performance, _attempts, detail);
        }
    }
}
