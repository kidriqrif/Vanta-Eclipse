// Ported from scripts/minigames/battleship.gd
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Battleship — sink a hidden fleet inside a shot budget.
    ///
    /// Single-sided salvo rather than the two-player original: no opponent turn
    /// to wait through, which suits a one-minute mobile round and reuses the
    /// budget shape already proven in Memory Match.
    ///
    /// Prefab + definition only. Score is SHOTS USED with lowerIsBetter.
    /// </summary>
    public sealed class Battleship : Minigame
    {
        const int Unknown = 0;
        const int Miss = 1;
        const int Hit = 2;

        public const int DefaultSize = 7;
        /// <summary>34 shots for a 9-cell fleet: locked by simulation (20k
        /// rounds/cell) at a 73% clear for careless play and 90% for a player
        /// who chases hits.</summary>
        public const int DefaultShots = 34;
        /// <summary>How far a win's payout falls from a perfect salvo to a
        /// last-shot scrape.</summary>
        public const float WinFalloff = 0.6f;
        public const float MinWinPerformance = 0.4f;
        public const float PopTime = 0.14f;
        public const float CellSize = 96f;
        /// <summary>Guards against an unluckily-packed board wedging the
        /// placement loop.</summary>
        public const int PlacementAttempts = 200;
        /// <summary>Whole-layout restarts before giving up (see
        /// PlaceFleet).</summary>
        public const int LayoutAttempts = 20;

        static readonly int[] DefaultFleet = { 4, 3, 2 };
        static readonly Color CellBackground = new(0.09f, 0.09f, 0.133f, 0.9f);
        static readonly Color CellEdge = new(0.173f, 0.173f, 0.235f, 0.6f);

        int _size = DefaultSize;
        int _shotBudget = DefaultShots;
        readonly List<int> _fleet = new();

        /// <summary>Per cell: which ship occupies it (-1 = open water), and what
        /// the player knows.</summary>
        int[] _shipAt;
        int[] _marks;
        readonly List<Cell> _cells = new();
        /// <summary>Remaining un-hit cells per ship; 0 = sunk.</summary>
        readonly List<int> _shipHealth = new();

        int _shots;
        int _hits;
        int _sunk;
        int _totalShipCells;

        Text _statusLabel;
        Text _shotsLabel;

        /// <summary>Grid size, shot budget and fleet come from the
        /// definition.</summary>
        public override void Setup(Dictionary<string, object> context)
        {
            _size = Mathf.Clamp(ReadInt(context, "size", DefaultSize), 5, 8);
            _fleet.Clear();

            // Keep the fleet sparse enough that a random layout always succeeds.
            // A board packed past a third full can wedge the placement search,
            // and a ship that fails to place would quietly shrink the target
            // count and inflate scoring.
            int capacity = Mathf.FloorToInt(_size * _size / 3f);
            int occupied = 0;
            foreach (int length in ReadIntArray(context, "fleet", DefaultFleet))
            {
                if (length < 2 || length > _size || occupied + length > capacity) continue;
                _fleet.Add(length);
                occupied += length;
            }
            if (_fleet.Count == 0)
            {
                _fleet.AddRange(DefaultFleet);
                occupied = 0;
                foreach (int length in _fleet) occupied += length;
            }
            // Never ship a mathematically unwinnable round: the budget must at
            // least cover a perfect salvo (the idiom Memory Match uses for its
            // attempts).
            _shotBudget = Mathf.Max(occupied, ReadInt(context, "shots", DefaultShots));
        }

        void Start()
        {
            _statusLabel = Find<Text>("StatusLabel");
            _shotsLabel = Find<Text>("ShotsLabel");

            _shipAt = new int[_size * _size];
            for (int i = 0; i < _shipAt.Length; i++) _shipAt[i] = -1;
            _marks = new int[_size * _size];

            PlaceFleet();
            BuildGrid();
            RefreshLabels();
            SetStatus("FIND THE FLEET", VantaTheme.Ink);
        }

        // --- Setup ----------------------------------------------------------------

        /// <summary>Lay the whole fleet out, retrying the ENTIRE layout on
        /// failure rather than dropping a ship. A pre-sunk ship would read as
        /// "1 of 3 sunk" before the first shot and quietly inflate the score;
        /// restarting keeps the roster honest.</summary>
        void PlaceFleet()
        {
            for (int layout = 0; layout < LayoutAttempts; layout++)
            {
                for (int i = 0; i < _shipAt.Length; i++) _shipAt[i] = -1;
                _shipHealth.Clear();
                _totalShipCells = 0;
                if (TryLayout()) return;
            }
            // Unreachable at any sane density (Setup caps the fleet at a third of
            // the board), but if it ever happened the roster must still match the
            // board.
            while (_fleet.Count > _shipHealth.Count) _fleet.RemoveAt(_fleet.Count - 1);
        }

        bool TryLayout()
        {
            for (int ship = 0; ship < _fleet.Count; ship++)
            {
                int length = _fleet[ship];
                int span = _size - length;
                if (span < 0) return false;

                bool placed = false;
                for (int attempt = 0; attempt < PlacementAttempts; attempt++)
                {
                    bool horizontal = Random.Range(0, 2) == 0;
                    int row = Random.Range(0, horizontal ? _size : span + 1);
                    int column = Random.Range(0, horizontal ? span + 1 : _size);
                    if (!Fits(row, column, length, horizontal)) continue;

                    for (int step = 0; step < length; step++)
                    {
                        int r = row + (horizontal ? 0 : step);
                        int c = column + (horizontal ? step : 0);
                        _shipAt[r * _size + c] = ship;
                    }
                    placed = true;
                    break;
                }
                if (!placed) return false;
                _shipHealth.Add(length);
                _totalShipCells += length;
            }
            return true;
        }

        bool Fits(int row, int column, int length, bool horizontal)
        {
            for (int step = 0; step < length; step++)
            {
                int r = row + (horizontal ? 0 : step);
                int c = column + (horizontal ? step : 0);
                if (r < 0 || r >= _size || c < 0 || c >= _size) return false;
                if (_shipAt[r * _size + c] != -1) return false;
            }
            return true;
        }

        void BuildGrid()
        {
            var grid = FindObject("CellGrid");
            ConfigureGrid(grid, _size, CellSize, spacing: 6f);
            for (int index = 0; index < _size * _size; index++)
            {
                int captured = index;
                var cell = MakeCell(grid != null ? grid.transform : transform, CellSize,
                    $"Cell{index}", withGlyph: true);
                cell.Paint(CellBackground, CellEdge, 2f);
                cell.SetGlyph(UISprites.CellEmpty);
                cell.Button.onClick.AddListener(() => OnCellPressed(captured));
                _cells.Add(cell);
            }
        }

        // --- Firing ------------------------------------------------------------------

        void OnCellPressed(int index)
        {
            if (_marks[index] != Unknown) return;
            _shots++;

            int ship = _shipAt[index];
            if (ship < 0)
            {
                _marks[index] = Miss;
                _cells[index].SetGlyph(UISprites.ShotMiss);
                SetStatus("MISS", VantaTheme.Muted);
            }
            else
            {
                _marks[index] = Hit;
                _hits++;
                _cells[index].SetGlyph(UISprites.ShotHit);
                _shipHealth[ship]--;
                if (_shipHealth[ship] <= 0)
                {
                    _sunk++;
                    RevealSunk(ship, index);
                    SetStatus("SHIP SUNK", VantaTheme.Ink);
                }
                else
                {
                    SetStatus("HIT", VantaTheme.Ink);
                }
            }

            _cells[index].Button.interactable = false;
            Run(Pop(_cells[index]));
            RefreshLabels();

            if (_sunk >= _shipHealth.Count)
                EndRun(true, $"fleet sunk in {_shots} {(_shots == 1 ? "shot" : "shots")}");
            else if (_shots >= _shotBudget)
                EndRun(false, $"{_sunk} of {_shipHealth.Count} ships sunk");
        }

        /// <summary>A sunk ship's cells become one solid slab, so a finished ship
        /// reads as a single mass rather than a scatter of hits.</summary>
        void RevealSunk(int ship, int justHit)
        {
            for (int index = 0; index < _shipAt.Length; index++)
            {
                if (_shipAt[index] != ship) continue;
                _cells[index].SetGlyph(UISprites.ShotSunk);
                // The caller pops the cell that was just hit.
                if (index != justHit) Run(Pop(_cells[index]));
            }
        }

        static IEnumerator Pop(Cell cell)
        {
            var rect = (RectTransform)cell.Panel.Root.transform;
            float elapsed = 0f;
            rect.localScale = Vector3.one * 0.7f;
            while (elapsed < PopTime)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / PopTime);
                float inv = t - 1f;
                float eased = 1f + 2.70158f * inv * inv * inv + 1.70158f * inv * inv;
                rect.localScale = Vector3.one * Mathf.LerpUnclamped(0.7f, 1f, eased);
                yield return null;
            }
            rect.localScale = Vector3.one;
        }

        void RefreshLabels()
        {
            if (_shotsLabel != null)
                _shotsLabel.text =
                    $"Shot {Mathf.Min(_shots, _shotBudget)} of {_shotBudget} · " +
                    $"{_sunk} of {_shipHealth.Count} ships sunk";
        }

        void SetStatus(string text, Color color)
        {
            if (_statusLabel == null) return;
            _statusLabel.text = text;
            _statusLabel.color = color;
        }

        // --- Reporting ------------------------------------------------------------

        void EndRun(bool won, string detail)
        {
            foreach (var cell in _cells) cell.Button.interactable = false;

            // In-flight pops are settled by the base Teardown, which the host
            // calls on every terminal path — including a forfeit, which never
            // reaches here.
            // Win: scaled across the range a real round actually occupies — from
            // a perfect salvo (every shot a hit) down to scraping in on the last
            // shot. Scoring perfection/shots instead would peg almost every win
            // near the floor, since a typical clear takes about three times the
            // minimum.
            // Loss: the fraction of the fleet actually found, so a near-miss
            // beats a blind round once the host applies its loss floor.
            float performance;
            if (won)
            {
                float span = Mathf.Max(1, _shotBudget - _totalShipCells);
                float over = Mathf.Max(0, _shots - _totalShipCells);
                performance = Mathf.Clamp(1f - WinFalloff * (over / span),
                    MinWinPerformance, 1f);
            }
            else
            {
                performance = _totalShipCells > 0 ? _hits / (float)_totalShipCells : 0f;
            }

            SetStatus(won ? "FLEET DESTROYED" : "OUT OF SHOTS",
                won ? VantaTheme.Ink : VantaTheme.Muted);
            Finish(won ? Outcome.WIN : Outcome.LOSS, performance, _shots, detail);
        }
    }
}
