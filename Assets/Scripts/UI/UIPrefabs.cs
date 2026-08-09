using System.Collections.Generic;
using UnityEngine;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Spawns the transient UI the screens build at runtime — damage numbers,
    /// result banners, loot toasts, the two blocking modals, the arcade boards.
    ///
    /// A prefab reachable from a plain static context has to come from
    /// Resources — there is no serialized field to hang it on — so SceneBuilder
    /// writes
    /// these to Assets/Resources/Prefabs and this loads them by name.
    ///
    /// The names are the PascalCase of the layout stem, which is also the name of
    /// the C# behaviour on the prefab root — so <see cref="Spawn{T}"/> can take
    /// the type and infer the name, and a rename cannot leave the two disagreeing.
    /// </summary>
    public static class UIPrefabs
    {
        const string Root = "Prefabs/";

        static readonly Dictionary<string, GameObject> Cache = new();

        public static GameObject Load(string name)
        {
            if (Cache.TryGetValue(name, out var cached)) return cached;

            var prefab = Resources.Load<GameObject>(Root + name);
            if (prefab == null)
                Debug.LogError($"UIPrefabs: no prefab at Resources/{Root}{name}.");
            // Cache misses too — see UISprites for why.
            Cache[name] = prefab;
            return prefab;
        }

        /// <summary>
        /// Instantiate under <paramref name="parent"/>, keeping the prefab's own
        /// local transform. `worldPositionStays: false` is the one that matters
        /// for UI: the default (true) preserves world position, which drags a
        /// freshly spawned RectTransform to wherever the canvas happens to put
        /// it and makes anchored layouts land in the wrong place.
        /// </summary>
        public static GameObject Spawn(string name, Transform parent)
        {
            var prefab = Load(name);
            if (prefab == null) return null;
            var instance = Object.Instantiate(prefab, parent, worldPositionStays: false);
            // Instantiate appends "(Clone)". Screens look objects up by name, so
            // the suffix is a silent way to break a lookup on a spawned object.
            instance.name = name;
            return instance;
        }

        /// <summary>Spawn the prefab named after <typeparamref name="T"/> and
        /// hand back its behaviour, ready to configure.</summary>
        public static T Spawn<T>(Transform parent) where T : Component
        {
            var instance = Spawn(typeof(T).Name, parent);
            if (instance == null) return null;

            var component = instance.GetComponent<T>();
            if (component == null)
                Debug.LogError($"UIPrefabs: '{typeof(T).Name}' prefab has no {typeof(T).Name}.");
            return component;
        }
    }
}
