// Ported from scripts/minigames/rune_sweeper.gd
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Rune Sweeper — a 5x5 field with five buried runes. Uncover every safe
    /// cell.
    ///
    /// No flagging. Marking suspected mines is the half of Minesweeper that
    /// needs a second input, and a phone only has one — every mobile port that
    /// keeps it ends up with a long-press or a mode toggle, both of which cost
    /// more than they buy in a 25-cell field. Uncovering is the whole game here.
    ///
    /// The first tap is always safe: the field is laid AFTER it, with that cell
    /// and its neighbours excluded. Losing on move one to a coin flip is not
    /// difficulty.
    /// </summary>
    public sealed class RuneSweeper : Minigame
    {
        public const int Size = 5;
        public const int Runes = 5;
        public const float CellSize = 88f;

        readonly List<bool> _mine = new();
        readonly List<bool> _revealed = new();
        readonly List<Cell> _cells = new();
        bool _laid;
        int _safeTotal = Size * Size - Runes;
        int _safeFound;

        Text _statusLabel;
        Text _stateLabel;

        void Start()
        {
            _statusLabel = Find<Text>("StatusLabel");
            _stateLabel = Find<Text>("StateLabel");

            var grid = FindObject("Grid");
            ConfigureGrid(grid, Size, CellSize, spacing: 6f);
            for (int index = 0; index < Size * Size; index++)
            {
                _mine.Add(false);
                _revealed.Add(false);
                int captured = index;
                var cell = MakeCell(grid != null ? grid.transform : transform, CellSize,
                    $"Cell{index}", withLabel: true);
                cell.Button.onClick.AddListener(() => OnCellPressed(captured));
                cell.Paint(VantaTheme.Raised, VantaTheme.Line, 2f);
                _cells.Add(cell);
            }
            UpdateStatus();
        }

        void StyleRevealed(Cell cell, bool danger)
        {
            if (danger) cell.Paint(VantaTheme.Surface, VantaTheme.Accent, 4f);
            else cell.Paint(VantaTheme.Surface, VantaTheme.Line, 1f);
        }

        // --- Field -----------------------------------------------------------------

        /// <summary>Lay the runes, keeping <paramref name="safeIndex"/> and
        /// everything touching it clear so the opening tap always opens a pocket
        /// rather than a single number.</summary>
        void LayField(int safeIndex)
        {
            var forbidden = new HashSet<int> { safeIndex };
            foreach (int neighbour in Neighbours(safeIndex)) forbidden.Add(neighbour);

            var candidates = new List<int>();
            for (int index = 0; index < Size * Size; index++)
                if (!forbidden.Contains(index)) candidates.Add(index);

            for (int i = candidates.Count - 1; i > 0; i--)
            {
                int j = Random.Range(0, i + 1);
                (candidates[i], candidates[j]) = (candidates[j], candidates[i]);
            }

            // A 5x5 field minus a 3x3 opening leaves 16 cells for 5 runes, so
            // this cannot run short — but take the minimum anyway rather than
            // trusting the arithmetic to survive someone retuning Size.
            int placed = Mathf.Min(Runes, candidates.Count);
            for (int i = 0; i < placed; i++) _mine[candidates[i]] = true;

            _safeTotal = Size * Size - placed;
            _laid = true;
        }

        static IEnumerable<int> Neighbours(int index)
        {
            int row = index / Size;
            int column = index % Size;
            for (int dr = -1; dr <= 1; dr++)
            for (int dc = -1; dc <= 1; dc++)
            {
                if (dr == 0 && dc == 0) continue;
                int r = row + dr;
                int c = column + dc;
                if (r >= 0 && r < Size && c >= 0 && c < Size) yield return r * Size + c;
            }
        }

        int AdjacentRunes(int index)
        {
            int count = 0;
            foreach (int neighbour in Neighbours(index)) if (_mine[neighbour]) count++;
            return count;
        }

        // --- Play ------------------------------------------------------------------

        void OnCellPressed(int index)
        {
            if (!_laid) LayField(index);
            if (_revealed[index]) return;

            if (_mine[index])
            {
                Reveal(index);
                _cells[index].SetText("*");
                EndRun(false);
                return;
            }
            Flood(index);
            UpdateStatus();
            if (_safeFound >= _safeTotal) EndRun(true);
        }

        /// <summary>Reveal <paramref name="index"/>, and keep spreading through
        /// any cell that touches no rune. Iterative rather than recursive: a
        /// 25-cell flood is small, but a recursive reveal is the classic way this
        /// ends up re-entering a cell it already opened.</summary>
        void Flood(int index)
        {
            var pending = new Stack<int>();
            pending.Push(index);
            while (pending.Count > 0)
            {
                int current = pending.Pop();
                if (_revealed[current] || _mine[current]) continue;

                Reveal(current);
                int adjacent = AdjacentRunes(current);
                _cells[current].SetText(adjacent > 0 ? adjacent.ToString() : "");
                if (adjacent != 0) continue;

                foreach (int neighbour in Neighbours(current))
                    if (!_revealed[neighbour]) pending.Push(neighbour);
            }
        }

        void Reveal(int index)
        {
            _revealed[index] = true;
            if (!_mine[index]) _safeFound++;
            StyleRevealed(_cells[index], _mine[index]);
            _cells[index].Button.interactable = false;
        }

        void UpdateStatus()
        {
            if (_statusLabel != null)
                _statusLabel.text = $"{_safeFound} of {_safeTotal} cells clear · {Runes} runes";
        }

        void EndRun(bool won)
        {
            for (int index = 0; index < _cells.Count; index++)
            {
                _cells[index].Button.interactable = false;
                if (won || !_mine[index] || _revealed[index]) continue;
                // Show the field on a loss. A puzzle that hides its answer
                // teaches nothing and reads as arbitrary.
                StyleRevealed(_cells[index], true);
                _cells[index].SetText("*");
            }

            float performance = Mathf.Clamp01(_safeFound / (float)Mathf.Max(1, _safeTotal));
            if (_stateLabel != null)
            {
                _stateLabel.text = won ? "FIELD CLEAR" : "RUNE STRUCK";
                _stateLabel.color = won ? VantaTheme.Ink : VantaTheme.Muted;
            }
            Finish(won ? Outcome.WIN : Outcome.LOSS, performance, _safeFound,
                $"{_safeFound} of {_safeTotal} clear");
        }
    }
}
