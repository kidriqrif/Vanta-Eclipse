// Ported from scripts/minigames/lights_out.gd
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

// Namespace VantaEclipse.UI, not .Minigames: SceneBuilder attaches a ported
// behaviour by looking up "VantaEclipse.UI.<PascalName>", so a board in a
// nested namespace builds a prefab with no script on it — silently, because a
// missing behaviour is a warning there and not an error.
namespace VantaEclipse.UI
{
    /// <summary>
    /// Lights Out — a 4x4 grid where every tap flips a plus-shape. Clear the
    /// board.
    ///
    /// The board is scrambled by PLAYING it, never by randomising cells
    /// directly: a random 4x4 arrangement is only solvable about one time in
    /// sixteen, and a player cannot tell an unsolvable board from a hard one.
    /// Scrambling with real taps from the solved state guarantees a solution
    /// exists and puts a ceiling on how long it is.
    /// </summary>
    public sealed class LightsOut : Minigame
    {
        public const int Size = 4;
        /// <summary>Taps used to scramble. Also the par the score is measured
        /// against, since a board built in N taps is always solvable in at most
        /// N.</summary>
        public const int ScrambleTaps = 6;
        /// <summary>Slack over par before a run is a loss. Generous: this is a
        /// puzzle, and the payout already scales with efficiency.</summary>
        public const int MoveLimit = 24;
        public const float CellSize = 110f;

        readonly List<bool> _lit = new();
        readonly List<Cell> _cells = new();
        int _moves;

        Text _movesLabel;
        Text _stateLabel;

        void Start()
        {
            _movesLabel = Find<Text>("MovesLabel");
            _stateLabel = Find<Text>("StateLabel");

            BuildBoard();
            Scramble();
            Redraw();
        }

        void BuildBoard()
        {
            var grid = FindObject("Grid");
            ConfigureGrid(grid, Size, CellSize);
            for (int index = 0; index < Size * Size; index++)
            {
                _lit.Add(false);
                int captured = index;
                var cell = MakeCell(grid != null ? grid.transform : transform, CellSize,
                    $"Cell{index}");
                cell.Button.onClick.AddListener(() => OnCellPressed(captured));
                _cells.Add(cell);
            }
        }

        void Scramble()
        {
            // A scramble that happens to solve the board would hand the player a
            // win before they touched it, so keep going until at least one pane
            // is lit.
            while (!_lit.Contains(true))
                for (int i = 0; i < ScrambleTaps; i++)
                    TogglePlus(UnityEngine.Random.Range(0, Size * Size));
        }

        void TogglePlus(int index)
        {
            int row = index / Size;
            int column = index % Size;
            (int dr, int dc)[] offsets = { (0, 0), (0, 1), (0, -1), (1, 0), (-1, 0) };
            foreach (var (dr, dc) in offsets)
            {
                int r = row + dr;
                int c = column + dc;
                if (r < 0 || r >= Size || c < 0 || c >= Size) continue;
                int target = r * Size + c;
                _lit[target] = !_lit[target];
            }
        }

        void OnCellPressed(int index)
        {
            _moves++;
            TogglePlus(index);
            Redraw();
            if (!_lit.Contains(true)) EndRun(true);
            else if (_moves >= MoveLimit) EndRun(false);
        }

        void Redraw()
        {
            // Lit and dark differ in FILL and BORDER WIDTH, not hue alone, so
            // the board stays readable without colour (UX §7).
            int remaining = 0;
            for (int index = 0; index < _cells.Count; index++)
            {
                if (_lit[index])
                {
                    _cells[index].Paint(VantaTheme.Accent, VantaTheme.Ink, 4f);
                    remaining++;
                }
                else
                {
                    _cells[index].Paint(VantaTheme.Surface, VantaTheme.Line, 2f);
                }
            }
            if (_movesLabel != null)
                _movesLabel.text = $"Moves {_moves} of {MoveLimit} · {remaining} lit";
        }

        void EndRun(bool won)
        {
            foreach (var cell in _cells) cell.Button.interactable = false;

            // Par is the scramble length; finishing at or under it is a perfect
            // score, and it decays from there rather than stepping, so one extra
            // tap costs a little instead of a grade.
            float performance = won
                ? Mathf.Clamp01(ScrambleTaps / (float)Mathf.Max(_moves, ScrambleTaps))
                : 0f;

            if (_stateLabel != null)
            {
                _stateLabel.text = won ? "CLEARED" : "OUT OF MOVES";
                _stateLabel.color = won ? VantaTheme.Ink : VantaTheme.Muted;
            }
            Finish(won ? Outcome.WIN : Outcome.LOSS, performance,
                Mathf.Max(0, MoveLimit - _moves), $"{_moves} moves");
        }
    }
}
