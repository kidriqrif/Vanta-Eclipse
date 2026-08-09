// Ported from scripts/ui/card_collection.gd
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;

namespace VantaEclipse.UI
{
    /// <summary>
    /// The Cards screen — boss trophies, and the one place they are spent.
    ///
    /// A card is only ever destroyed here, deliberately: absorption is permanent
    /// and a collection screen that consumes on a mistap is a screen players
    /// stop opening. So the row itself is inert and the ABSORB button is a
    /// separate, smaller target that names what it will do before it does it.
    /// </summary>
    public sealed class CardCollection : UIScreen
    {
        public const float RowMinHeight = 140f;

        Transform _target;
        Transform _list;
        GameObject _emptyLabel;
        Text _collectionHeader;

        void Start()
        {
            _target = FindObject("TargetBox")?.transform;
            _list = FindObject("CollectionList")?.transform;
            _emptyLabel = FindObject("EmptyLabel");
            _collectionHeader = Find<Text>("CollectionHeader");

            Bind("BackButton", () => Game.Flow.ChangeScene(Scenes.Pets));

            Game.Events.CardCollected += OnCardCollected;
            Game.Events.CardAbsorbed += OnCardAbsorbed;
            Game.Events.ActivePetChanged += OnPetChanged;

            Refresh();
        }

        void OnDestroy()
        {
            if (!Game.IsBooted) return;
            Game.Events.CardCollected -= OnCardCollected;
            Game.Events.CardAbsorbed -= OnCardAbsorbed;
            Game.Events.ActivePetChanged -= OnPetChanged;
        }

        void Refresh()
        {
            BuildTarget();
            BuildList();
        }

        // --- Absorption target ---------------------------------------------------

        void BuildTarget()
        {
            if (_target == null) return;
            UIBuild.Clear(_target);

            string active = Game.Pets.GetActiveId();
            if (string.IsNullOrEmpty(active))
            {
                UIBuild.Label(_target, "No active companion — a card needs somewhere to go.",
                    18, VantaTheme.Muted);
                return;
            }

            var definition = Game.Pets.GetDefinition(active);
            if (definition == null) return;
            int stage = Mathf.Clamp(Game.Pets.GetStage(active), 0,
                Mathf.Max(0, definition.stageNames.Length - 1));

            UIBuild.Label(_target, "ABSORBING INTO", 18, VantaTheme.Muted);
            UIBuild.Label(_target, definition.stageNames[stage], 27, VantaTheme.Ink);

            // Body ink, not the accent. Crimson on the void background clears AA
            // (5.7:1) and not AAA, and this line is a small STAT rather than a
            // mark — at 18px it was the least readable text on the screen. The
            // accent earns its contrast on short labels, not on numbers someone
            // has to read.
            float absorbed = Game.Pets.GetAbsorbedBonus(active);
            UIBuild.Label(_target, $"Absorbed bonus  +{absorbed * 100f:0.0}%", 27, VantaTheme.Ink);
        }

        // --- Collection ------------------------------------------------------------

        void BuildList()
        {
            if (_list == null) return;
            UIBuild.Clear(_list, _emptyLabel);

            var cards = Game.Cards.GetCards();
            if (_emptyLabel != null) _emptyLabel.SetActive(cards.Count == 0);
            if (_collectionHeader != null)
                _collectionHeader.text = $"COLLECTION ({cards.Count})";

            bool hasPet = !string.IsNullOrEmpty(Game.Pets.GetActiveId());

            // Newest first. The card a player just won is the one they came to
            // look at, and the collection is append-ordered, so this walks it
            // backwards.
            for (int index = cards.Count - 1; index >= 0; index--)
                MakeRow(cards[index], index, hasPet);
        }

        void MakeRow(Card card, int index, bool hasPet)
        {
            var rarity = Game.Cards.GetRarity(card.Rarity);
            Color tint = rarity != null ? rarity.color : VantaTheme.Ink;

            var panel = UIBuild.Frame(_list, VantaTheme.Raised, tint,
                borderWidth: 0f, padding: 16f, name: $"Card_{index}");
            UIBuild.MinHeight(panel.Root.transform, RowMinHeight);

            // The rarity spine. A card's tier is the first thing a player sorts
            // on, so it is carried by an edge that survives being skimmed, not
            // by the text.
            var spine = UIBuild.Bar(panel.Root.transform, tint, width: 6f);
            var spineRect = (RectTransform)spine.transform;
            spineRect.anchorMin = Vector2.zero;
            spineRect.anchorMax = new Vector2(0f, 1f);
            spineRect.pivot = new Vector2(0f, 0.5f);
            spineRect.sizeDelta = new Vector2(6f, 0f);
            spineRect.anchoredPosition = Vector2.zero;

            var row = UIBuild.Row(panel.Content, spacing: 16f);
            UIBuild.Stretch((RectTransform)row.transform);

            // One card graphic, tinted per tier. The art is drawn near-white
            // precisely so the tint can carry the rarity — baking five frames
            // would put the palette in a PNG where a data edit could no longer
            // reach it.
            UIBuild.Icon(row.transform, UISprites.CardFrame, 96f, tint);

            var info = UIBuild.Expand(UIBuild.Column(row.transform, spacing: 9f,
                align: TextAnchor.MiddleLeft));

            UIBuild.Label(info.transform, card.Name, 27, tint, TextAnchor.MiddleLeft);
            string tier = rarity != null ? rarity.displayName : "Unknown";
            UIBuild.Label(info.transform, $"{tier} · Lv. {card.Level}", 18, VantaTheme.Muted,
                TextAnchor.MiddleLeft);
            UIBuild.Label(info.transform,
                $"POW {NumberFormat.FormatExact(card.Power)}   " +
                $"VIG {card.Vigor:0.0}   FOC {card.Focus:0.0}",
                18, VantaTheme.Ink, TextAnchor.MiddleLeft);

            var (button, buttonPanel) = UIBuild.Tile(row.transform,
                hasPet ? VantaTheme.AccentDeep : VantaTheme.Surface,
                hasPet ? VantaTheme.Accent : VantaTheme.Line,
                borderWidth: 2f, padding: 8f, name: "Absorb");
            UIBuild.SizeTo(buttonPanel.Root, new Vector2(200f, 96f));
            var column = UIBuild.Column(buttonPanel.Content);
            UIBuild.Stretch((RectTransform)column.transform);
            UIBuild.Label(column.transform, "ABSORB", 27,
                hasPet ? VantaTheme.Ivory : VantaTheme.Muted, wrap: false);

            button.interactable = hasPet;
            button.onClick.AddListener(() => OnAbsorbPressed(index));
        }

        // --- Events -----------------------------------------------------------------

        void OnAbsorbPressed(int index)
        {
            // The whole list is rebuilt from the manager afterwards rather than
            // the one row being removed: absorbing shifts every later index by
            // one, and a stale index on a button that is still on screen would
            // feed the wrong card next.
            if (Game.Cards.Absorb(index) == null) return;
            // Only the list. Absorb raises CardAbsorbed synchronously before it
            // returns, so OnCardAbsorbed has already rebuilt the target panel —
            // calling Refresh here would build it a second time every tap.
            BuildList();
        }

        void OnCardCollected(Card card) => Refresh();

        void OnCardAbsorbed(string petId, float xp, float bonus) => BuildTarget();

        void OnPetChanged(string id) => Refresh();
    }
}
