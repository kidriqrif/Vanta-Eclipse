// Ported from scripts/minigames/sequence_echo.gd
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Sequence Echo — four runes call a growing pattern; echo it back.
    ///
    /// The sequence GROWS rather than being redrawn each round: appending one
    /// step means the player's memory of the previous round still counts, which
    /// is the whole appeal. Regenerating it every round would make each round
    /// independent and turn a memory game into five reaction tests.
    /// </summary>
    public sealed class SequenceEcho : Minigame
    {
        public const int Runes = 4;
        /// <summary>Echoing a sequence this long wins the run. Reached in four
        /// correct rounds from a start of two.</summary>
        public const int WinLength = 6;
        public const int StartLength = 2;
        public const float LitSeconds = 0.42f;
        public const float GapSeconds = 0.2f;
        public const float RoundPause = 0.6f;
        public const float RuneSize = 200f;

        static readonly string[] Numerals = { "I", "II", "III", "IV" };

        readonly List<int> _sequence = new();
        readonly List<Cell> _cells = new();
        int _position;
        bool _playing = true;
        int _roundsCleared;

        Text _roundLabel;
        Text _stateLabel;

        void Start()
        {
            _roundLabel = Find<Text>("RoundLabel");
            _stateLabel = Find<Text>("StateLabel");

            BuildRunes();
            for (int i = 0; i < StartLength; i++) _sequence.Add(Random.Range(0, Runes));
            Run(Playback());
        }

        void BuildRunes()
        {
            var grid = FindObject("Grid");
            ConfigureGrid(grid, 2, RuneSize, spacing: 16f);
            for (int index = 0; index < Runes; index++)
            {
                int captured = index;
                var cell = MakeCell(grid != null ? grid.transform : transform, RuneSize,
                    $"Rune{index}", withLabel: true, fontSize: 36);
                cell.SetText(Numerals[index]);
                cell.Button.onClick.AddListener(() => OnRunePressed(captured));
                _cells.Add(cell);
                SetRuneLit(index, false);
            }
        }

        /// <summary>Lit and dark differ by FILL and BORDER WIDTH as well as
        /// colour, so the pattern is followable without relying on hue.</summary>
        void SetRuneLit(int index, bool lit)
        {
            if (lit) _cells[index].Paint(VantaTheme.Accent, VantaTheme.Ink, 6f);
            else _cells[index].Paint(VantaTheme.Surface, VantaTheme.Line, 2f);
        }

        // --- Playback ------------------------------------------------------------

        IEnumerator Playback()
        {
            _playing = true;
            _position = 0;
            if (_roundLabel != null) _roundLabel.text = $"Pattern of {_sequence.Count}";
            SetState("WATCH", VantaTheme.Muted);

            yield return new WaitForSecondsRealtime(RoundPause);

            for (int i = 0; i < _sequence.Count; i++)
            {
                SetRuneLit(_sequence[i], true);
                yield return new WaitForSecondsRealtime(LitSeconds);
                SetRuneLit(_sequence[i], false);
                yield return new WaitForSecondsRealtime(GapSeconds);
            }

            _playing = false;
            SetState("ECHO", VantaTheme.Ink);
        }

        void SetState(string text, Color color)
        {
            if (_stateLabel == null) return;
            _stateLabel.text = text;
            _stateLabel.color = color;
        }

        // --- Input ---------------------------------------------------------------

        void OnRunePressed(int index)
        {
            if (_playing) return;   // taps during playback are ignored, not penalised
            if (index != _sequence[_position])
            {
                EndRun(false);
                return;
            }
            _position++;
            if (_position < _sequence.Count) return;

            _roundsCleared++;
            if (_sequence.Count >= WinLength)
            {
                EndRun(true);
                return;
            }
            _sequence.Add(Random.Range(0, Runes));
            Run(Playback());
        }

        void EndRun(bool won)
        {
            foreach (var cell in _cells) cell.Button.interactable = false;

            // Progress toward the win length, so a run that died one rune short
            // still pays most of the way. A loss on the first round pays nothing.
            int reached = won ? _sequence.Count : _sequence.Count - 1;
            float performance = Mathf.Clamp01(
                (reached - StartLength + 1f) / (WinLength - StartLength + 1f));

            SetState(won ? "ECHOED" : "BROKEN", won ? VantaTheme.Ink : VantaTheme.Muted);
            Finish(won ? Outcome.WIN : Outcome.LOSS, performance, _roundsCleared,
                $"pattern of {reached}");
        }
    }
}
