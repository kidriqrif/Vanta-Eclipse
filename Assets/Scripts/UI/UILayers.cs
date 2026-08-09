using UnityEngine;
using UnityEngine.UI;

namespace VantaEclipse.UI
{
    /// <summary>
    /// The sorting registry the UX spec fixed and every transient obeys.
    ///
    /// Godot spelled this as a CanvasLayer's `layer` property, set in the .tscn.
    /// Unity's equivalent is a nested Canvas with overrideSorting — but only a
    /// Canvas gets a sorting order at all, so a spawned object that is merely
    /// parented to the screen draws in hierarchy order and a toast can end up
    /// behind the thing it is announcing.
    ///
    /// Applied from code rather than left to the built prefabs: the layer is a
    /// contract between screens ("a modal covers a toast covers the screen"),
    /// and a contract that lives in twenty separate scene files is one bad
    /// merge away from being wrong in one of them.
    /// </summary>
    public static class UILayers
    {
        public const int Screen = 0;
        public const int Toast = 50;
        public const int Modal = 60;
        /// <summary>The scene fade sits above everything — it has to cover the
        /// modal it is fading away from.</summary>
        public const int SceneFade = 32000;

        /// <summary>Give <paramref name="go"/> its own sorting order. Idempotent:
        /// re-applying to an object that already has a Canvas just updates the
        /// order.</summary>
        public static void Apply(GameObject go, int order)
        {
            var canvas = go.GetComponent<Canvas>();
            if (canvas == null) canvas = go.AddComponent<Canvas>();
            canvas.overrideSorting = true;
            canvas.sortingOrder = order;

            // A nested Canvas does not inherit the parent's raycaster, so
            // without this nothing inside it is clickable — which is silent and
            // looks like a dead button rather than a missing component.
            if (go.GetComponent<GraphicRaycaster>() == null)
                go.AddComponent<GraphicRaycaster>();
        }
    }
}
