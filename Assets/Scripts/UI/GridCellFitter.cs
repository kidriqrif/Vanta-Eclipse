using UnityEngine;
using UnityEngine.UI;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Sizes a GridLayoutGroup's cells to fill the row.
    ///
    /// Godot's GridContainer took its column width from the widest child and
    /// grew to fit. Unity's GridLayoutGroup does the opposite: cellSize is a
    /// FIXED number it imposes on every child, it ignores what the children
    /// would prefer, and the default is 100x100. Nothing in the port set it, so
    /// Gear's seven equipment slots rendered as 100px stamps crammed into the
    /// top-left corner with their labels overlapping — four columns of tiles
    /// that should have spanned the screen.
    ///
    /// Recomputing from the live rect rather than baking a number is what makes
    /// this hold on every shape: the CanvasScaler matches on height, so the
    /// canvas is 1080 units wide at 9:16 and 886 at 19.5:9, and a cell size
    /// correct at one is wrong at the other.
    /// </summary>
    [RequireComponent(typeof(GridLayoutGroup))]
    [ExecuteAlways]
    public sealed class GridCellFitter : MonoBehaviour
    {
        /// <summary>Cell height as a multiple of its width. The gear tiles are
        /// an icon over two lines of text, which is very slightly taller than
        /// square — measured off the last build that looked right.</summary>
        [SerializeField] float aspect = 1.085f;

        GridLayoutGroup _grid;
        float _fittedFor = -1f;

        void OnEnable()
        {
            _fittedFor = -1f;
            // Canvas.willRenderCanvases, not just OnRectTransformDimensionsChange.
            // The canvas can change width without THIS rect changing — its own
            // stale cellSize is what holds it the same size — so the callback
            // that fires on this object never comes and the grid keeps a cell
            // measured against a window that is no longer there. That is
            // exactly what happened under the harness: 2560 was the editor's
            // own backbuffer width, the capture was 1080, and the tiles came
            // out 620px wide in a 1080px frame. This event fires once per
            // canvas update, including inside Canvas.ForceUpdateCanvases().
            Canvas.willRenderCanvases += Fit;
            Fit();
        }

        void OnDisable() => Canvas.willRenderCanvases -= Fit;

        void OnRectTransformDimensionsChange() => Fit();

        void Fit()
        {
            _grid ??= GetComponent<GridLayoutGroup>();
            if (_grid == null) return;

            // MEASURE FROM AN ANCESTOR, NOT FROM SELF. A GridLayoutGroup
            // reports columns x cellSize as its preferred width, so sizing the
            // cell from this rect's own width closes a loop: a pre-layout width
            // of 2432 produced 600px cells, the grid's preferred width grew to
            // match, and the whole screen ended up two and a half times wider
            // than the display with the title clipped off the right edge.
            //
            // The canvas is the right ruler: its width comes from the display
            // and the CanvasScaler, so nothing this component decides can push
            // it around. NOT the screen root — SafeAreaFitter drives that from
            // Screen.safeArea in device pixels while the canvas is in reference
            // units, and the two disagree by a factor of two on this machine.
            var canvas = GetComponentInParent<Canvas>();
            if (canvas == null) return;
            var ruler = (RectTransform)canvas.rootCanvas.transform;

            float available = ruler.rect.width;
            if (Mathf.Approximately(available, _fittedFor)) return;
            _fittedFor = available;

            // Everything between here and the canvas that eats horizontal room.
            // Not the SCREEN ROOT's rect, which is what this measured first:
            // SafeAreaFitter drives that from Screen.safeArea in device pixels
            // while the canvas is in reference units, so under the harness it
            // read 2480 against a 1080 canvas and produced 620px cells — four
            // columns, two of them off the side of the display.
            for (var t = transform; t != null && t != ruler; t = t.parent)
                if (t.TryGetComponent<HorizontalOrVerticalLayoutGroup>(out var outer))
                    available -= outer.padding.horizontal;

            int columns = Mathf.Max(1, _grid.constraintCount);
            available -= _grid.padding.horizontal + _grid.spacing.x * (columns - 1);
            if (available <= 0f) return;

            // Floor, not round: a half-pixel over budget wraps the last column
            // onto a row of its own, which reads as a layout bug rather than as
            // a rounding one.
            float width = Mathf.Floor(available / columns);
            var size = new Vector2(width, Mathf.Round(width * aspect));

            // Assigning cellSize marks the layout dirty, and this method runs
            // ON that rebuild. Without the equality guard it re-enters forever.
            if (_grid.cellSize != size) _grid.cellSize = size;
        }
    }
}
