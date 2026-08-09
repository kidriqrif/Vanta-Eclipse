using UnityEngine;
using UnityEngine.UI;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Widget constructors for the screens that build their contents in code.
    ///
    /// Most of this game's UI is not laid out in a scene file: Gear builds a
    /// tile per slot and a row per inventory item, the Journal builds a card per
    /// goal, the Shop builds a row per product. In Godot that was terse because
    /// a StyleBoxFlat carries background, border, and padding as three
    /// properties of one object, and `add_theme_stylebox_override` applied it in
    /// a line. Unity's Image has a colour and nothing else.
    ///
    /// So a "panel with a 3px border and 12px of padding" is three GameObjects
    /// here, and without a helper every screen would restate that construction
    /// twenty times. These functions are that helper — they are what keeps the
    /// ported screens the same length as the originals instead of triple.
    ///
    /// Nothing here is decorative-only by accident: every constructor turns
    /// raycastTarget OFF except on the things meant to be pressed, because a
    /// stray transparent Image over a tile silently eats the tap that tile
    /// exists to receive.
    /// </summary>
    public static class UIBuild
    {
        /// <summary>A framed box: border ring, fill, and an inset content area
        /// for children. Godot got all three from one StyleBoxFlat.</summary>
        public readonly struct Panel
        {
            public readonly GameObject Root;
            public readonly RectTransform Content;
            public readonly Image Border;
            public readonly Image Fill;

            public Panel(GameObject root, RectTransform content, Image border, Image fill)
            {
                Root = root;
                Content = content;
                Border = border;
                Fill = fill;
            }
        }

        // --- Primitives -------------------------------------------------------

        public static GameObject Node(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return go;
        }

        public static RectTransform Stretch(RectTransform rect, float inset = 0f)
        {
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = new Vector2(inset, inset);
            rect.offsetMax = new Vector2(-inset, -inset);
            return rect;
        }

        public static Text Label(Transform parent, string text, int fontSize, Color color,
                                 TextAnchor align = TextAnchor.MiddleCenter, bool wrap = true)
        {
            var go = Node("Label", parent);
            var label = go.AddComponent<Text>();
            label.font = Fonts.Body;
            label.text = text;
            label.fontSize = VantaTheme.SnapFontSize(fontSize);
            label.color = color;
            label.alignment = align;
            label.horizontalOverflow = wrap ? HorizontalWrapMode.Wrap : HorizontalWrapMode.Overflow;
            label.verticalOverflow = VerticalWrapMode.Overflow;
            label.raycastTarget = false;
            // A Text inside a layout group reports no preferred height without
            // this, and the row collapses to nothing.
            go.AddComponent<ContentSizeFitter>().verticalFit =
                ContentSizeFitter.FitMode.PreferredSize;
            return label;
        }

        public static Image Icon(Transform parent, Sprite sprite, float size, Color? tint = null)
        {
            var go = Node("Icon", parent);
            var rect = (RectTransform)go.transform;
            rect.sizeDelta = new Vector2(size, size);

            var element = go.AddComponent<LayoutElement>();
            element.minWidth = size;
            element.minHeight = size;
            element.preferredWidth = size;
            element.preferredHeight = size;

            var image = go.AddComponent<Image>();
            image.sprite = sprite;
            image.preserveAspect = true;
            image.raycastTarget = false;
            image.color = tint ?? Color.white;
            // A null sprite on a visible Image draws an opaque white box, which
            // is far worse than drawing nothing.
            if (sprite == null) image.enabled = false;
            return image;
        }

        /// <summary>A flat colour block of a fixed width — the rarity spine down
        /// the left edge of an inventory row.</summary>
        public static Image Bar(Transform parent, Color color, float width, float height = 0f)
        {
            var go = Node("Bar", parent);
            var element = go.AddComponent<LayoutElement>();
            element.minWidth = width;
            element.preferredWidth = width;
            if (height > 0f) { element.minHeight = height; element.preferredHeight = height; }
            element.flexibleHeight = height > 0f ? 0f : 1f;

            var image = go.AddComponent<Image>();
            image.color = color;
            image.raycastTarget = false;
            return image;
        }

        // --- Layout groups ------------------------------------------------------

        public static VerticalLayoutGroup Column(Transform parent, float spacing = 0f,
                                                 TextAnchor align = TextAnchor.MiddleCenter,
                                                 bool expandChildWidth = true)
        {
            var go = Node("Column", parent);
            var group = go.AddComponent<VerticalLayoutGroup>();
            group.spacing = spacing;
            group.childAlignment = align;
            group.childForceExpandWidth = expandChildWidth;
            group.childForceExpandHeight = false;
            group.childControlWidth = true;
            group.childControlHeight = true;
            return group;
        }

        public static HorizontalLayoutGroup Row(Transform parent, float spacing = 0f,
                                                TextAnchor align = TextAnchor.MiddleLeft)
        {
            var go = Node("Row", parent);
            var group = go.AddComponent<HorizontalLayoutGroup>();
            group.spacing = spacing;
            group.childAlignment = align;
            group.childForceExpandWidth = false;
            group.childForceExpandHeight = true;
            group.childControlWidth = true;
            group.childControlHeight = true;
            return group;
        }

        /// <summary>The child that should absorb the leftover width in a Row —
        /// Godot's SIZE_EXPAND_FILL.</summary>
        public static T Expand<T>(T component) where T : Component
        {
            var element = component.gameObject.GetComponent<LayoutElement>()
                          ?? component.gameObject.AddComponent<LayoutElement>();
            element.flexibleWidth = 1f;
            return component;
        }

        public static T MinHeight<T>(T component, float height) where T : Component
        {
            var element = component.gameObject.GetComponent<LayoutElement>()
                          ?? component.gameObject.AddComponent<LayoutElement>();
            element.minHeight = height;
            element.preferredHeight = height;
            return component;
        }

        // --- Panels and buttons ---------------------------------------------------

        /// <summary>
        /// A bordered, filled box. <paramref name="borderWidth"/> of 0 draws no
        /// ring at all rather than a zero-width one, so a plain fill costs one
        /// Image and not two.
        /// </summary>
        public static Panel Frame(Transform parent, Color fill, Color border,
                                  float borderWidth = 0f, float padding = 0f,
                                  string name = "Panel")
        {
            var root = Node(name, parent);
            Image borderImage = null;
            Image fillImage;

            if (borderWidth > 0f)
            {
                borderImage = root.AddComponent<Image>();
                borderImage.color = border;
                borderImage.raycastTarget = false;

                var fillGo = Node("Fill", root.transform);
                Stretch((RectTransform)fillGo.transform, borderWidth);
                fillImage = fillGo.AddComponent<Image>();
                fillImage.color = fill;
                fillImage.raycastTarget = false;
            }
            else
            {
                fillImage = root.AddComponent<Image>();
                fillImage.color = fill;
                fillImage.raycastTarget = false;
            }

            var content = Node("Content", root.transform);
            Stretch((RectTransform)content.transform, borderWidth + padding);
            return new Panel(root, (RectTransform)content.transform, borderImage, fillImage);
        }

        /// <summary>
        /// A pressable framed box. The Button's target graphic is the frame's own
        /// fill, so the press tint lands on the fill rather than on a fourth
        /// invisible object — and the fill keeps raycasting, which is what makes
        /// the whole tile pressable and not just its text.
        /// </summary>
        public static (Button Button, Panel Panel) Tile(
            Transform parent, Color fill, Color border,
            float borderWidth = 0f, float padding = 0f, string name = "Tile")
        {
            var panel = Frame(parent, fill, border, borderWidth, padding, name);
            // The raycast has to land on something that covers the whole tile.
            // The border ring does when there is one; otherwise it is the fill.
            var target = panel.Border ?? panel.Fill;
            target.raycastTarget = true;

            var button = panel.Root.AddComponent<Button>();
            button.targetGraphic = target;
            button.transition = Selectable.Transition.ColorTint;
            var colors = button.colors;
            colors.normalColor = VantaTheme.TintNormal;
            colors.highlightedColor = VantaTheme.TintHighlighted;
            colors.pressedColor = VantaTheme.TintPressed;
            colors.disabledColor = VantaTheme.TintDisabled;
            button.colors = colors;
            return (button, panel);
        }

        /// <summary>
        /// Change a frame's border thickness after the fact, by moving the fill
        /// inside the ring.
        ///
        /// The board games need this: a lit cell and a dark cell differ in
        /// border WIDTH as well as hue, which is what keeps the board readable
        /// without colour. Only works on a frame built with a border in the
        /// first place — there is no ring to widen otherwise.
        /// </summary>
        public static void SetBorderWidth(in Panel panel, float width)
        {
            if (panel.Border == null || panel.Fill == null) return;
            var rect = (RectTransform)panel.Fill.transform;
            rect.offsetMin = new Vector2(width, width);
            rect.offsetMax = new Vector2(-width, -width);
        }

        public static void SizeTo(GameObject go, Vector2 size)
        {
            ((RectTransform)go.transform).sizeDelta = size;
            var element = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>();
            element.minWidth = size.x;
            element.minHeight = size.y;
            element.preferredWidth = size.x;
            element.preferredHeight = size.y;
        }

        /// <summary>Remove every child of a container. The rebuild-from-scratch
        /// idiom every list screen uses; Destroy is deferred to end of frame, so
        /// the objects are unparented first to keep a rebuild in the same frame
        /// from seeing the old ones.</summary>
        public static void Clear(Transform parent, params GameObject[] keep)
        {
            if (parent == null) return;
            for (int i = parent.childCount - 1; i >= 0; i--)
            {
                var child = parent.GetChild(i).gameObject;
                bool keepThis = false;
                foreach (var k in keep) if (k == child) { keepThis = true; break; }
                if (keepThis) continue;
                child.transform.SetParent(null, false);
                Object.Destroy(child);
            }
        }
    }
}
