using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;
using VantaEclipse.Data;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Relic Collection — a slide-up panel inside the Gear screen. Lists owned
    /// relics; one is active at a time. Attune and detach are free and
    /// reversible.
    /// </summary>
    public sealed class RelicCollectionPanel : SlidePanel
    {
        public const float RowMinHeight = 150f;
        public const float SigilSize = 72f;

        /// <summary>Relics were gold — a third accent on a red-and-black screen.
        /// They stay special by being the only thing here drawn in full white,
        /// with the accent reserved for the one that is actually attuned.</summary>
        public static Color RelicIvory => Color.white;

        public static Color RelicActive => VantaTheme.Accent;

        protected override string CloseButtonName => "RelicCloseButton";

        Transform _list;
        GameObject _emptyLabel;

        protected override void OnFirstShow()
        {
            _list = FindObject("RelicList")?.transform;
            _emptyLabel = FindObject("RelicEmptyLabel");

            Game.Events.ActiveRelicChanged += OnChanged;
            Game.Events.RelicDropped += OnChanged;
        }

        void OnDestroy()
        {
            if (!Game.IsBooted) return;
            Game.Events.ActiveRelicChanged -= OnChanged;
            Game.Events.RelicDropped -= OnChanged;
        }

        protected override void OnOpening()
        {
            Rebuild();
            Game.Relics.MarkAllSeen();
        }

        void OnChanged(string id)
        {
            if (IsOpen) Rebuild();
        }

        void Rebuild()
        {
            if (_list == null) return;
            UIBuild.Clear(_list, _emptyLabel);

            var owned = Game.Relics.GetOwned();
            if (_emptyLabel != null) _emptyLabel.SetActive(owned.Count == 0);

            string active = Game.Relics.GetActiveId();
            foreach (var entry in owned)
            {
                var definition = Game.Relics.GetDefinition(entry.Id);
                if (definition != null) MakeRow(definition, definition.id == active);
            }
        }

        void MakeRow(RelicDefinition definition, bool isActive)
        {
            var panel = UIBuild.Frame(_list, VantaTheme.Fade(VantaTheme.Surface, 0.92f),
                isActive ? RelicActive : VantaTheme.Line,
                borderWidth: 2f, padding: 18f, name: $"Relic_{definition.id}");
            UIBuild.MinHeight(panel.Root.transform, RowMinHeight);

            var row = UIBuild.Row(panel.Content, spacing: 18f);
            UIBuild.Stretch((RectTransform)row.transform);

            UIBuild.Icon(row.transform, definition.sigil, SigilSize);

            var info = UIBuild.Expand(UIBuild.Column(row.transform, spacing: 4f,
                align: TextAnchor.MiddleLeft));

            var nameRow = UIBuild.Row(info.transform, spacing: 12f);
            UIBuild.Label(nameRow.transform, definition.displayName, 27, RelicIvory,
                TextAnchor.MiddleLeft, wrap: false);
            if (isActive)
                UIBuild.Label(nameRow.transform, "● ACTIVE", 18, RelicActive,
                    TextAnchor.MiddleLeft, wrap: false);

            UIBuild.Label(info.transform, definition.effectDescription, 18, VantaTheme.Muted,
                TextAnchor.MiddleLeft);

            string id = definition.id;
            var (button, buttonPanel) = UIBuild.Tile(row.transform,
                isActive ? VantaTheme.Surface : VantaTheme.AccentDeep,
                isActive ? VantaTheme.Line : VantaTheme.Accent,
                borderWidth: 2f, padding: 8f,
                name: isActive ? "Detach" : "Attune");
            UIBuild.SizeTo(buttonPanel.Root, new Vector2(220f, 110f));
            var buttonColumn = UIBuild.Column(buttonPanel.Content);
            UIBuild.Stretch((RectTransform)buttonColumn.transform);
            UIBuild.Label(buttonColumn.transform, isActive ? "DETACH" : "ATTUNE", 27,
                VantaTheme.Ink, wrap: false);

            if (isActive) button.onClick.AddListener(() => Game.Relics.Detach());
            else button.onClick.AddListener(() => Game.Relics.Attune(id));
        }
    }
}
