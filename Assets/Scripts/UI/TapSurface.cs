using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace VantaEclipse.UI
{
    /// <summary>
    /// A region that reports taps and where they landed.
    ///
    /// Unity's EventSystem collapses touch and mouse into one PointerDown, so
    /// the guard is no longer needed and its absence is not an oversight.
    ///
    /// The reported position is in the surface's own rect, bottom-left origin —
    /// ready to become an anchoredPosition on a sibling in the same space.
    /// </summary>
    [RequireComponent(typeof(RectTransform))]
    public sealed class TapSurface : MonoBehaviour, IPointerDownHandler
    {
        public Action<Vector2> Tapped;

        RectTransform _rect;

        void Awake()
        {
            _rect = (RectTransform)transform;
            // A Graphic is what makes a region hit-testable at all. A fully
            // transparent Image still receives raycasts, which is exactly what
            // an invisible tap target needs.
            if (GetComponent<Graphic>() == null)
                gameObject.AddComponent<Image>().color = VantaTheme.Invisible;
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            RectTransformUtility.ScreenPointToLocalPointInRectangle(
                _rect, eventData.position, eventData.pressEventCamera, out var local);
            // ScreenPointToLocalPointInRectangle returns a point relative to the
            // rect's pivot; shifting by the pivot puts it in the bottom-left
            // space anchoredPosition uses.
            Tapped?.Invoke(local + Vector2.Scale(_rect.rect.size, _rect.pivot));
        }
    }
}
