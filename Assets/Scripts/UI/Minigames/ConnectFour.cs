// Ported from scripts/minigames/connect_four.gd
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Connect Four — four in a row against an AI opponent.
    ///
    /// Prefab + definition only. The AI's think-delay and the drop are both
    /// managed coroutines, so the inherited Teardown stops both: forfeit
    /// mid-drop and the board goes quiet instead of playing on under the banner.
    ///
    /// Score is MOVES TO WIN with lowerIsBetter — a faster win is a better
    /// record.
    /// </summary>
    public sealed class ConnectFour : Minigame
    {
        const int Empty = 0;
        const int Player = 1;
        const int Ai = 2;
        const int Connect = 4;

        public const int DefaultColumns = 7;
        public const int DefaultRows = 6;
        /// <summary>How long the AI "thinks" before dropping, so its turn is
        /// legible.</summary>
        public const float AiThink = 0.55f;
        public const float DropTime = 0.22f;
        public const float CellSize = 96f;
        /// <summary>Chance the AI plays a loose move INSTEAD OF its strategic
        /// one. It still always takes a win and always blocks; this only relaxes
        /// the positional play, which is the dial that makes it beatable without
        /// making it look broken.</summary>
        public const float AiBlunderChance = 0.6f;

        static readonly Color BoardBackground = new(0.09f, 0.09f, 0.133f, 0.9f);

        int _columns = DefaultColumns;
        int _rows = DefaultRows;
        float _blunder = AiBlunderChance;

        /// <summary>Board cells, row 0 = top. index = row * columns + column.</summary>
        int[] _board;
        /// <summary>Appended column-major; CellAt re-maps.</summary>
        readonly List<Image> _discs = new();
        readonly List<Button> _columnButtons = new();
        readonly List<UIBuild.Panel> _columnPanels = new();
        int _playerMoves;
        bool _busy;

        Text _statusLabel;

        /// <summary>Board shape and AI difficulty are data on the definition.</summary>
        public override void Setup(Dictionary<string, object> context)
        {
            // Ceiling of 7: at the 120px column minimum, more than seven columns
            // cannot fit the 1000px body and the row would push them off-screen.
            _columns = Mathf.Clamp(ReadInt(context, "columns", DefaultColumns), 4, 7);
            _rows = Mathf.Clamp(ReadInt(context, "rows", DefaultRows), 4, 8);
            _blunder = Mathf.Clamp01(ReadFloat(context, "ai_blunder", AiBlunderChance));
        }

        void Start()
        {
            _statusLabel = Find<Text>("StatusLabel");
            _board = new int[_columns * _rows];
            BuildBoard();
            SetStatus("YOUR TURN", VantaTheme.Ink);
        }

        // --- Board -----------------------------------------------------------------

        void BuildBoard()
        {
            var boardRow = FindObject("BoardRow");
            var parent = boardRow != null ? boardRow.transform : transform;

            var layout = boardRow != null
                ? boardRow.GetComponent<HorizontalLayoutGroup>()
                  ?? boardRow.AddComponent<HorizontalLayoutGroup>()
                : null;
            if (layout != null)
            {
                layout.spacing = 8f;
                layout.childAlignment = TextAnchor.MiddleCenter;
                layout.childForceExpandWidth = true;
                layout.childForceExpandHeight = true;
                layout.childControlWidth = true;
                layout.childControlHeight = true;
            }

            for (int column = 0; column < _columns; column++)
            {
                // The whole column is the touch target: a full-height strip is
                // far easier to hit than an individual cell.
                var (button, panel) = UIBuild.Tile(parent, BoardBackground,
                    VantaTheme.Fade(VantaTheme.Ink, 0.35f),
                    borderWidth: 2f, padding: 6f, name: $"Column{column}");
                UIBuild.Expand(panel.Root.transform);
                var element = panel.Root.GetComponent<LayoutElement>();
                element.minWidth = 120f;
                element.preferredWidth = 120f;
                element.flexibleHeight = 1f;

                int captured = column;
                button.onClick.AddListener(() => OnColumnPressed(captured));
                _columnButtons.Add(button);
                _columnPanels.Add(panel);

                var stack = UIBuild.Column(panel.Content, spacing: 8f);
                UIBuild.Stretch((RectTransform)stack.transform);
                for (int row = 0; row < _rows; row++)
                    _discs.Add(UIBuild.Icon(stack.transform, UISprites.CellEmpty, CellSize));
            }
        }

        /// <summary>Cells are built column-major but addressed row-major.</summary>
        Image DiscAt(int row, int column) => _discs[column * _rows + row];

        int At(int row, int column) => _board[row * _columns + column];

        void SetAt(int row, int column, int value) => _board[row * _columns + column] = value;

        /// <summary>Lowest empty row in a column, or -1 when the column is
        /// full.</summary>
        int LandingRow(int column)
        {
            for (int row = _rows - 1; row >= 0; row--)
                if (At(row, column) == Empty) return row;
            return -1;
        }

        List<int> ValidColumns()
        {
            var valid = new List<int>();
            for (int column = 0; column < _columns; column++)
                if (LandingRow(column) >= 0) valid.Add(column);
            return valid;
        }

        // --- Turns -------------------------------------------------------------------

        void OnColumnPressed(int column)
        {
            if (_busy) return;
            int row = LandingRow(column);
            if (row < 0) return;   // full column — the disabled state normally prevents this

            _busy = true;
            _playerMoves++;
            Place(row, column, Player);
            if (CheckWin(row, column, Player))
            {
                EndRun(true, $"won in {_playerMoves} moves");
                return;
            }
            if (ValidColumns().Count == 0)
            {
                EndDraw();
                return;
            }
            SetStatus("OPPONENT THINKING", VantaTheme.Muted);
            RefreshColumns();
            Run(AiTurn());
        }

        IEnumerator AiTurn()
        {
            yield return new WaitForSecondsRealtime(AiThink);

            int column = ChooseColumn();
            if (column < 0)
            {
                EndDraw();
                yield break;
            }
            int row = LandingRow(column);
            Place(row, column, Ai);
            if (CheckWin(row, column, Ai))
            {
                EndRun(false, "opponent connected four");
                yield break;
            }
            if (ValidColumns().Count == 0)
            {
                EndDraw();
                yield break;
            }
            _busy = false;
            SetStatus("YOUR TURN", VantaTheme.Ink);
            RefreshColumns();
        }

        void Place(int row, int column, int who)
        {
            SetAt(row, column, who);
            var disc = DiscAt(row, column);
            disc.sprite = who == Player ? UISprites.DiscPlayer : UISprites.DiscAi;
            disc.enabled = true;
            // The disc drops in: managed so a forfeit mid-animation stops it.
            Run(DropDisc((RectTransform)disc.transform));
        }

        static IEnumerator DropDisc(RectTransform rect)
        {
            float elapsed = 0f;
            rect.localScale = Vector3.one * 0.4f;
            while (elapsed < DropTime)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / DropTime);
                rect.localScale = Vector3.one * Mathf.Lerp(0.4f, 1f, BounceOut(t));
                yield return null;
            }
            rect.localScale = Vector3.one;
        }

        /// <summary>Godot's TRANS_BOUNCE/EASE_OUT.</summary>
        static float BounceOut(float t)
        {
            const float n1 = 7.5625f;
            const float d1 = 2.75f;
            if (t < 1f / d1) return n1 * t * t;
            if (t < 2f / d1) { t -= 1.5f / d1; return n1 * t * t + 0.75f; }
            if (t < 2.5f / d1) { t -= 2.25f / d1; return n1 * t * t + 0.9375f; }
            t -= 2.625f / d1;
            return n1 * t * t + 0.984375f;
        }

        void RefreshColumns()
        {
            for (int column = 0; column < _columns; column++)
            {
                bool full = LandingRow(column) < 0;
                _columnButtons[column].interactable = !_busy && !full;
                // A full column reads as closed: dimmer ground, no accent edge.
                if (_columnPanels[column].Fill != null)
                    _columnPanels[column].Fill.color = full
                        ? VantaTheme.Fade(BoardBackground, BoardBackground.a * 0.5f)
                        : BoardBackground;
                if (_columnPanels[column].Border != null)
                    _columnPanels[column].Border.color = full
                        ? VantaTheme.Fade(VantaTheme.Slate, 0.5f)
                        : VantaTheme.Fade(VantaTheme.Ink, 0.35f);
            }
        }

        void SetStatus(string text, Color color)
        {
            if (_statusLabel == null) return;
            _statusLabel.text = text;
            _statusLabel.color = color;
        }

        // --- Win detection --------------------------------------------------------

        /// <summary>Does the disc just placed at (row, column) complete a line
        /// for <paramref name="who"/>?</summary>
        bool CheckWin(int row, int column, int who)
        {
            (int dr, int dc)[] directions = { (0, 1), (1, 0), (1, 1), (1, -1) };
            foreach (var (dr, dc) in directions)
            {
                int run = 1 + RunLength(row, column, dr, dc, who)
                            + RunLength(row, column, -dr, -dc, who);
                if (run >= Connect) return true;
            }
            return false;
        }

        int RunLength(int row, int column, int dRow, int dColumn, int who)
        {
            int count = 0;
            int r = row + dRow;
            int c = column + dColumn;
            while (r >= 0 && r < _rows && c >= 0 && c < _columns && At(r, c) == who)
            {
                count++;
                r += dRow;
                c += dColumn;
            }
            return count;
        }

        /// <summary>Longest line the player achieved — used to credit a loss
        /// honestly.</summary>
        int LongestRun(int who)
        {
            int best = 0;
            (int dr, int dc)[] directions = { (0, 1), (1, 0), (1, 1), (1, -1) };
            for (int row = 0; row < _rows; row++)
            for (int column = 0; column < _columns; column++)
            {
                if (At(row, column) != who) continue;
                foreach (var (dr, dc) in directions)
                    best = Mathf.Max(best, 1 + RunLength(row, column, dr, dc, who));
            }
            return best;
        }

        // --- AI ---------------------------------------------------------------------

        /// <summary>
        /// Win, else block, else avoid handing over a win, else favour the
        /// centre.
        ///
        /// The opponent NEVER misses a win or a block — an AI that overlooks
        /// those reads as broken rather than beatable. Only the strategic layer
        /// is loosened, which keeps it competent while leaving the player room to
        /// build a threat.
        /// </summary>
        int ChooseColumn()
        {
            var valid = ValidColumns();
            if (valid.Count == 0) return -1;

            foreach (int column in valid) if (WinsWith(column, Ai)) return column;
            foreach (int column in valid) if (WinsWith(column, Player)) return column;

            if (Random.value < _blunder) return valid[Random.Range(0, valid.Count)];

            var safe = new List<int>();
            foreach (int column in valid) if (!HandsOverWin(column)) safe.Add(column);
            return WeightedCentre(safe.Count > 0 ? safe : valid);
        }

        bool WinsWith(int column, int who)
        {
            int row = LandingRow(column);
            if (row < 0) return false;
            SetAt(row, column, who);
            bool won = CheckWin(row, column, who);
            SetAt(row, column, Empty);
            return won;
        }

        /// <summary>Would dropping here stack the player's winning square right
        /// on top?</summary>
        bool HandsOverWin(int column)
        {
            int row = LandingRow(column);
            if (row <= 0) return false;   // lands in the top row, so nothing can sit above it
            SetAt(row, column, Ai);
            SetAt(row - 1, column, Player);
            bool opens = CheckWin(row - 1, column, Player);
            SetAt(row - 1, column, Empty);
            SetAt(row, column, Empty);
            return opens;
        }

        /// <summary>Centre columns are worth more in Connect Four; pick among
        /// the best few.</summary>
        int WeightedCentre(List<int> options)
        {
            float centre = (_columns - 1) / 2f;
            var best = new List<int>();
            float bestScore = -1f;
            foreach (int column in options)
            {
                float score = centre - Mathf.Abs(column - centre);
                if (score > bestScore)
                {
                    bestScore = score;
                    best.Clear();
                    best.Add(column);
                }
                else if (Mathf.Approximately(score, bestScore))
                {
                    best.Add(column);
                }
            }
            return best[Random.Range(0, best.Count)];
        }

        // --- Reporting ----------------------------------------------------------------

        /// <summary>A filled board is a tie. The framework's Outcome has no DRAW
        /// — a draw is not a win, so it pays the loss floor — but the copy must
        /// never call a tie a defeat, and the longest-line credit already pays it
        /// honestly.</summary>
        void EndDraw() => EndRun(false, "a draw — board full", drawn: true);

        void EndRun(bool won, string detail, bool drawn = false)
        {
            _busy = true;
            foreach (var button in _columnButtons) button.interactable = false;

            // In-flight drops are settled by the base Teardown, which the host
            // calls on every terminal path — including a forfeit, which never
            // reaches here.
            // Win: a faster win is worth more (8 moves pays full, 16 pays the
            // floor). Loss: credit the longest line actually built, so a
            // near-miss beats a rout once the host applies its loss floor.
            float performance = won
                ? Mathf.Clamp(8f / Mathf.Max(1, _playerMoves), 0.5f, 1f)
                : Mathf.Clamp01((LongestRun(Player) - 1f) / (Connect - 1f));

            string headline = won ? "YOU WIN" : drawn ? "DRAW" : "DEFEATED";
            SetStatus(headline, won ? VantaTheme.Ink : VantaTheme.Muted);
            Finish(won ? Outcome.WIN : Outcome.LOSS, performance, _playerMoves, detail);
        }
    }
}
