using System;
using UnityEngine;
using UnityEngine.EventSystems;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Reports the pressed state of the element it sits on.
    ///
    /// Replaces Godot's `gui_input` + `InputEventMouseButton.pressed`, which the
    /// hold-to-reveal labels used. The important property carries over: Unity
    /// routes PointerUp to whichever object received PointerDown, so a finger
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
