using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace VantaEclipse.Core
{
    /// <summary>
    /// Loads and indexes the ScriptableObject content library by id.
    ///
    /// Replaces the per-manager `load("res://data/...")` lists the Godot
    /// managers each kept. Those lists were a standing maintenance cost — a
    /// new .tres had to be added to a const array or it silently did not
    /// exist — so the port drops them: a definition is in the game because it
    /// is in Assets/Resources/Content, not because a manager remembered it.
    /// </summary>
    public static class DefinitionRegistry
    {
        static readonly Dictionary<System.Type, object> Cache = new();

        /// <summary>Every definition of a type, in sort_order then id order —
        /// the same order the Godot managers sorted into for display.</summary>
        public static IReadOnlyList<T> All<T>() where T : ScriptableObject
        {
            if (Cache.TryGetValue(typeof(T), out var cached))
                return (IReadOnlyList<T>)cached;

            var loaded = Resources.LoadAll<T>($"Content/{typeof(T).Name}")
                .OrderBy(SortOrderOf)
                .ThenBy(IdOf)
                .ToList();

            if (loaded.Count == 0)
                Debug.LogError($"DefinitionRegistry: no {typeof(T).Name} assets under " +
                               $"Resources/Content/{typeof(T).Name}. " +
                               "Run Vanta Eclipse > Import Ported Data.");

            Cache[typeof(T)] = loaded;
            return loaded;
        }

        public static T Get<T>(string id) where T : ScriptableObject
        {
            foreach (var d in All<T>())
                if (IdOf(d) == id) return d;
            Debug.LogError($"DefinitionRegistry: unknown {typeof(T).Name}: {id}");
            return null;
        }

        public static bool Has<T>(string id) where T : ScriptableObject
        {
            foreach (var d in All<T>())
                if (IdOf(d) == id) return true;
            return false;
        }

        /// <summary>Drop the cache. Play-mode tests call this between cases;
        /// nothing in the running game should need it.</summary>
        public static void Clear() => Cache.Clear();

        // The definition classes are generated and share these two fields by
        // convention rather than a base class, so they are read reflectively.
        // Cheap: it happens once per type, at load, behind the cache.
        static int SortOrderOf(object d)
        {
            var f = d.GetType().GetField("sortOrder");
            return f == null ? 0 : (int)f.GetValue(d);
        }

        static string IdOf(object d)
        {
            var f = d.GetType().GetField("id");
            return f == null ? "" : (string)f.GetValue(d) ?? "";
        }
    }
}
