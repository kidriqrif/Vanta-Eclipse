using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Base class every Arcade minigame extends. It is the whole contract
    /// between a game and the framework, and it is deliberately tiny.
    ///
    /// The host owns all framing, payout, saving, and scene flow; a minigame
    /// owns only its own play. A minigame must NOT change scenes, touch currency
    /// or tokens, or call SaveManager — it just plays, then reports once.
    ///
    /// Lifecycle:
    ///     host: Spawn -> Setup(context) -> the board builds on Start
    ///     game: raises Finished exactly once, via Finish()
    /// </summary>
    public abstract class Minigame : UIScreen
    {
        public enum Outcome { WIN, LOSS, QUIT }

        public sealed class Result
        {
            public Outcome Outcome;
            /// <summary>0-1, clamped by Finish. Drives the payout.</summary>
            public float Performance;
            public float Score;
            public string Detail = "";
        }

        /// <summary>Raised exactly once, when the run ends for any reason.</summary>
        public event Action<Result> Finished;

        /// <summary>Guards the raise-once contract — Finish is a no-op after the
        /// first call.</summary>
        bool _finished;

        /// <summary>Coroutines started through <see cref="Run"/>, so Teardown
        /// can stop them.</summary>
        readonly List<Coroutine> _managed = new();

        /// <summary>Override to receive host context (difficulty, modifiers,
        /// board size…). Called before the first frame, so the board build in
        /// Start can rely on it.</summary>
        public virtual void Setup(Dictionary<string, object> context) { }

        /// <summary>Called by the host's QUIT flow only. A minigame never quits
        /// itself.</summary>
        public void ForceQuit() => Finish(Outcome.QUIT, 0f, 0f, "Forfeited");

        /// <summary>
        /// Stop playing. The host calls this the moment a run resolves, so the
        /// board freezes under the result banner instead of playing on beneath
        /// it — the banner does not block input.
        ///
        /// The base implementation handles the two things every minigame has: it
        /// stops every managed coroutine and refuses further input. Override to
        /// add your own quiescing, and call base.Teardown() first.
        /// </summary>
        public virtual void Teardown()
        {
            foreach (var routine in _managed)
                if (routine != null) StopCoroutine(routine);
            _managed.Clear();
            // StopAllCoroutines rather than trusting the list alone: a subclass
            // that started one directly would otherwise keep flipping a card
            // under the result banner, and that is exactly the failure this
            // whole method exists to prevent.
            StopAllCoroutines();

            // Stopping a coroutine leaves its property wherever it stopped, so a
            // pop, drop or flip caught mid-flight would freeze the board shrunk
            // or squashed. Every game's animations start from an off-rest scale
            // and return to one, so restoring it settles all of them — on EVERY
            // terminal path, including a forfeit, which never runs a game's end
            // routine.
            SnapRest(transform);
            Quiesce(transform);
            enabled = false;
        }

        /// <summary>
        /// Start a coroutine the framework can stop.
        ///
        /// Use this instead of StartCoroutine directly. It is the Unity spelling
        /// A timer owned by anything but this object cannot be reached by
        /// teardown, and a forfeited run then keeps firing under the result
        /// banner. That has happened.
        /// </summary>
        protected Coroutine Run(IEnumerator routine)
        {
            var handle = StartCoroutine(routine);
            _managed.Add(handle);
            return handle;
        }

        /// <summary>
        /// Paint a board cell flat in one fill and one border.
        ///
        /// Setting only the normal state is the trap: a cell repainted on tap
        /// reverts to its base look the moment a finger rests on it, because
        /// the ColorTint transition multiplies the
        /// target graphic instead of replacing it, so the fix here is to keep
        /// every state's tint at white and let the graphic colours be the truth.
        /// </summary>
        protected static void PaintCell(Button button, Image fill, Image border,
                                        Color fillColor, Color borderColor)
        {
            if (fill != null) fill.color = fillColor;
            if (border != null) border.color = borderColor;
            if (button == null) return;

            var colors = button.colors;
            colors.normalColor = VantaTheme.TintNormal;
            colors.highlightedColor = VantaTheme.TintNormal;
            colors.pressedColor = VantaTheme.TintPressed;
            colors.selectedColor = VantaTheme.TintNormal;
            // A finished board keeps the colours it ended on rather than fading
            // to the disabled tint.
            colors.disabledColor = VantaTheme.TintNormal;
            button.colors = colors;
        }

        /// <summary>
        /// One board cell: a square button with a fill, a ring, an optional
        /// glyph and an optional caption.
        ///
        /// Every board builds a grid of these, and each of the seven used to
        /// write out the same construction. Holding the
        /// parts together is what lets <see cref="Paint"/> be a one-liner at the
        /// call sites.
        /// </summary>
        protected sealed class Cell
        {
            public Button Button;
            public UIBuild.Panel Panel;
            public Text Label;
            public Image Glyph;

            /// <summary>Repaint. Width is a real channel, not decoration: a lit
            /// cell and a dark cell differ in ring thickness as well as hue, so
            /// the board stays readable without colour (UX §7).</summary>
            public void Paint(Color fill, Color border, float width)
            {
                PaintCell(Button, Panel.Fill, Panel.Border, fill, border);
                UIBuild.SetBorderWidth(Panel, width);
            }

            public void SetText(string value)
            {
                if (Label != null) Label.text = value;
            }

            public void SetGlyph(Sprite sprite, Color? tint = null)
            {
                if (Glyph == null) return;
                Glyph.sprite = sprite;
                Glyph.enabled = sprite != null;
                if (tint.HasValue) Glyph.color = tint.Value;
            }
        }

        /// <summary>Build a square cell into <paramref name="parent"/>.</summary>
        protected static Cell MakeCell(Transform parent, float size, string name,
                                       bool withLabel = false, bool withGlyph = false,
                                       int fontSize = 27)
        {
            var (button, panel) = UIBuild.Tile(parent, VantaTheme.Surface, VantaTheme.Line,
                borderWidth: 2f, padding: 6f, name: name);
            UIBuild.SizeTo(panel.Root, new Vector2(size, size));

            var cell = new Cell { Button = button, Panel = panel };
            if (withGlyph)
                cell.Glyph = UIBuild.Icon(panel.Content, null, size * 0.7f);
            if (withLabel)
                cell.Label = UIBuild.Label(panel.Content, "", fontSize, VantaTheme.Ink,
                    TextAnchor.MiddleCenter, wrap: false);
            if (cell.Label != null) UIBuild.Stretch((RectTransform)cell.Label.transform);
            if (cell.Glyph != null) UIBuild.Stretch((RectTransform)cell.Glyph.transform);
            return cell;
        }

        /// <summary>Configure a grid container to lay cells out in
        /// <paramref name="columns"/> columns of <paramref name="cellSize"/>
        /// square. The built layouts carry a GridLayoutGroup; a board that lost
        /// one still lays out rather than stacking every cell at the
        /// origin.</summary>
        protected static GridLayoutGroup ConfigureGrid(GameObject grid, int columns,
                                                       float cellSize, float spacing = 8f)
        {
            if (grid == null) return null;
            var layout = grid.GetComponent<GridLayoutGroup>()
                         ?? grid.AddComponent<GridLayoutGroup>();
            layout.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            layout.constraintCount = columns;
            layout.cellSize = new Vector2(cellSize, cellSize);
            layout.spacing = new Vector2(spacing, spacing);
            layout.childAlignment = TextAnchor.MiddleCenter;
            return layout;
        }

        static void SnapRest(Transform node)
        {
            for (int i = 0; i < node.childCount; i++)
            {
                var child = node.GetChild(i);
                child.localScale = Vector3.one;
                SnapRest(child);
            }
        }

        /// <summary>
        /// Disable every child button.
        ///
        /// This is the load-bearing half: turning off the root's own raycasting
        /// does NOT stop its children from receiving taps, so without this a
        /// resolved game still answers input.
        /// </summary>
        static void Quiesce(Transform node)
        {
            for (int i = 0; i < node.childCount; i++)
            {
                var child = node.GetChild(i);
                var button = child.GetComponent<Selectable>();
                if (button != null) button.interactable = false;
                Quiesce(child);
            }
        }

        /// <summary>Report the run's end. Subclasses call this instead of
        /// raising directly: it enforces raise-once and clamps performance into
        /// the payout's valid range.</summary>
        protected void Finish(Outcome outcome, float performance, float score, string detail)
        {
            if (_finished) return;
            _finished = true;
            Finished?.Invoke(new Result
            {
                Outcome = outcome,
                Performance = Mathf.Clamp01(performance),
                Score = score,
                Detail = detail,
            });
        }

        // --- Context readers ---------------------------------------------------
        //
        // The context is JSON from the definition, so every value arrives boxed
        // and the numeric ones arrive as whatever the parser chose. These are
        // the one place that is untangled.

        protected static int ReadInt(Dictionary<string, object> context, string key, int fallback)
        {
            if (context == null || !context.TryGetValue(key, out var value)) return fallback;
            return value switch
            {
                int i => i,
                long l => (int)l,
                float f => Mathf.RoundToInt(f),
                double d => Mathf.RoundToInt((float)d),
                string s => int.TryParse(s, out int parsed) ? parsed : fallback,
                _ => fallback,
            };
        }

        protected static float ReadFloat(Dictionary<string, object> context, string key,
                                         float fallback)
        {
            if (context == null || !context.TryGetValue(key, out var value)) return fallback;
            return value switch
            {
                float f => f,
                double d => (float)d,
                int i => i,
                long l => l,
                string s => float.TryParse(s, out float parsed) ? parsed : fallback,
                _ => fallback,
            };
        }

        /// <summary>
        /// A JSON array of numbers, e.g. Battleship's `"fleet":[4,3,2]`.
        ///
        /// Iterated through the NON-generic IEnumerable and converted per item:
        /// the parser hands nested arrays back as its own token type, which
        /// enumerates as tokens rather than as objects, so a
        /// `IEnumerable&lt;object&gt;` test silently misses every one of them
        /// and every board quietly falls back to its defaults.
        /// </summary>
        protected static int[] ReadIntArray(Dictionary<string, object> context, string key,
                                            int[] fallback)
        {
            if (context == null || !context.TryGetValue(key, out var value)) return fallback;
            if (value is not System.Collections.IEnumerable items || value is string) return fallback;

            var result = new List<int>();
            foreach (var item in items)
            {
                try { result.Add(Convert.ToInt32(item)); }
                catch (Exception) { /* a non-numeric entry is skipped, not fatal */ }
            }
            return result.Count > 0 ? result.ToArray() : fallback;
        }
    }
}
