using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Base for every screen and panel.
    ///
    /// Named UIScreen, not Screen: a type called Screen inside a UI namespace
    /// shadows UnityEngine.Screen for every file in that namespace, and the
    /// first casualty was SafeAreaFitter, whose whole job is reading
    /// Screen.safeArea. Qualifying every use site would have worked and would
    /// have kept the trap loaded for the next file.
    ///
    /// Replaces Godot's `%UniqueName` node lookup, which the UI scripts use
    /// everywhere. Godot resolved those at load through the scene's owner;
    /// Unity has no equivalent, so this walks the hierarchy once and caches by
    /// name. The cost is one traversal per screen at Awake, against 20-odd
    /// serialized field references per screen that would otherwise have to be
    /// wired by hand in the inspector for all 32 screens — and silently break
    /// whenever SceneBuilder regenerates one.
    ///
    /// Find() logs and returns null rather than throwing. A screen missing one
    /// label should render the other twenty, not fail to open: these are built
    /// by a converter, and a name that did not survive is a cosmetic gap, not a
    /// reason to lose the screen.
    /// </summary>
    public abstract class UIScreen : MonoBehaviour
    {
        readonly Dictionary<string, Transform> _byName = new();
        bool _indexed;

        protected virtual void Awake() => BuildIndex();

        void BuildIndex()
        {
            if (_indexed) return;
            _indexed = true;
            foreach (var child in GetComponentsInChildren<Transform>(includeInactive: true))
                _byName[child.name] = child;   // last wins; names are unique by construction
        }

        /// <summary>Find a component on a descendant by object name.</summary>
        protected T Find<T>(string name) where T : Component
        {
            BuildIndex();
            if (!_byName.TryGetValue(name, out var transform))
            {
                Debug.LogWarning($"{GetType().Name}: no node named '{name}' under {this.name}.");
                return null;
            }
            var component = transform.GetComponent<T>();
            if (component == null)
            {
                // A Button's label lives on a child in the built scenes, so a
                // Text lookup on the button itself is a near-miss worth
                // resolving rather than reporting.
                component = transform.GetComponentInChildren<T>(includeInactive: true);
            }
            if (component == null)
                Debug.LogWarning($"{GetType().Name}: '{name}' has no {typeof(T).Name}.");
            return component;
        }

        protected GameObject FindObject(string name)
        {
            BuildIndex();
            return _byName.TryGetValue(name, out var transform) ? transform.gameObject : null;
        }

        /// <summary>Wire a button by name. Null-safe on both sides, so a screen
        /// whose button did not survive conversion still loads.</summary>
        protected void Bind(string buttonName, UnityEngine.Events.UnityAction action)
        {
            var button = Find<Button>(buttonName);
            if (button != null && action != null) button.onClick.AddListener(action);
        }

        protected void SetText(string labelName, string value)
        {
            var text = Find<Text>(labelName);
            if (text != null) text.text = value;
        }

        protected void SetVisible(string objectName, bool visible)
        {
            var go = FindObject(objectName);
            if (go != null) go.SetActive(visible);
        }
    }
}
