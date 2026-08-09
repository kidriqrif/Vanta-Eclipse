using System;
using UnityEngine;
using UnityEngine.EventSystems;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Reports the pressed state of the element it sits on.
    ///
    /// Used by the hold-to-reveal labels. The important property: Unity routes
    /// PointerUp to whichever object received PointerDown, so a finger
    /// that slides off the label before lifting still releases the hold rather
    /// than leaving it stuck on.
    /// </summary>
    public sealed class PressHold : MonoBehaviour, IPointerDownHandler, IPointerUpHandler
    {
        public Action<bool> Held;

        public void OnPointerDown(PointerEventData eventData) => Held?.Invoke(true);

        public void OnPointerUp(PointerEventData eventData) => Held?.Invoke(false);
    }
}
