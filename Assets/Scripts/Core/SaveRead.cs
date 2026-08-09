using System;
using System.Collections.Generic;
using UnityEngine;

namespace VantaEclipse.Core
{
    /// <summary>
    /// Tolerant readers for save-document fields.
    ///
    /// Reading a save field wants three things at once: a missing-key default,
    /// type coercion, and never throwing. C# gives none of them for free, and a
    /// save file is the one input that is guaranteed to eventually be wrong —
    /// written by an older build, hand-edited, or truncated by a battery death
    /// mid-write. A manager that throws while loading takes the whole boot with
    /// it, so every read goes through here and every failure is a logged
    /// default rather than an exception.
    ///
    /// Non-finite values are rejected on the way in, not just clamped. NaN
    /// defeats every comparison it takes part in, so a NaN that reaches a
    /// balance or a level makes the guards downstream silently stop working —
    /// see the long note in CurrencyManager.
    /// </summary>
    public static class SaveRead
    {
        public static float Float(Dictionary<string, object> data, string key, float fallback = 0f)
        {
            if (!TryRaw(data, key, out var raw)) return fallback;
            try
            {
                float value = Convert.ToSingle(raw);
                if (float.IsNaN(value) || float.IsInfinity(value))
                {
                    Debug.LogError($"SaveRead: '{key}' was {value} — using {fallback}.");
                    return fallback;
                }
                return value;
            }
            catch (Exception)
            {
                Debug.LogError($"SaveRead: '{key}' was {Describe(raw)}, expected a number — using {fallback}.");
                return fallback;
            }
        }

        public static int Int(Dictionary<string, object> data, string key, int fallback = 0)
        {
            if (!TryRaw(data, key, out var raw)) return fallback;
            try
            {
                // Truncate rather than round, matching how these were written.
                double value = Convert.ToDouble(raw);
                if (double.IsNaN(value) || double.IsInfinity(value)
                    || value > int.MaxValue || value < int.MinValue)
                {
                    Debug.LogError($"SaveRead: '{key}' was {value} — using {fallback}.");
                    return fallback;
                }
                return (int)value;
            }
            catch (Exception)
            {
                Debug.LogError($"SaveRead: '{key}' was {Describe(raw)}, expected a number — using {fallback}.");
                return fallback;
            }
        }

        public static long Long(Dictionary<string, object> data, string key, long fallback = 0L)
        {
            if (!TryRaw(data, key, out var raw)) return fallback;
            try
            {
                double value = Convert.ToDouble(raw);
                if (double.IsNaN(value) || double.IsInfinity(value)
                    || value > long.MaxValue || value < long.MinValue)
                {
                    Debug.LogError($"SaveRead: '{key}' was {value} — using {fallback}.");
                    return fallback;
                }
                return (long)value;
            }
            catch (Exception)
            {
                Debug.LogError($"SaveRead: '{key}' was {Describe(raw)}, expected a number — using {fallback}.");
                return fallback;
            }
        }

        public static bool Bool(Dictionary<string, object> data, string key, bool fallback = false)
        {
            if (!TryRaw(data, key, out var raw)) return fallback;
            try { return Convert.ToBoolean(raw); }
            catch (Exception)
            {
                Debug.LogError($"SaveRead: '{key}' was {Describe(raw)}, expected a bool — using {fallback}.");
                return fallback;
            }
        }

        public static string Str(Dictionary<string, object> data, string key, string fallback = "")
        {
            if (!TryRaw(data, key, out var raw)) return fallback;
            return raw as string ?? raw.ToString();
        }

        /// <summary>A nested object, as a plain dictionary. Empty (never null)
        /// when absent or the wrong shape, so callers can foreach it
        /// unguarded.</summary>
        public static Dictionary<string, object> Section(Dictionary<string, object> data, string key)
        {
            if (!TryRaw(data, key, out var raw)) return new Dictionary<string, object>();

            if (raw is Dictionary<string, object> already) return already;

            // Newtonsoft hands back JObject/JArray for nested structures unless
            // the whole document was converted; accept either shape.
            if (raw is Newtonsoft.Json.Linq.JObject jobject)
                return jobject.ToObject<Dictionary<string, object>>();

            Debug.LogError($"SaveRead: '{key}' was {Describe(raw)}, expected an object — using empty.");
            return new Dictionary<string, object>();
        }

        /// <summary>A nested list. Empty (never null) when absent or the wrong
        /// shape.</summary>
        public static List<object> Array(Dictionary<string, object> data, string key)
        {
            if (!TryRaw(data, key, out var raw)) return new List<object>();

            if (raw is List<object> already) return already;

            if (raw is Newtonsoft.Json.Linq.JArray jarray)
                return jarray.ToObject<List<object>>();

            Debug.LogError($"SaveRead: '{key}' was {Describe(raw)}, expected an array — using empty.");
            return new List<object>();
        }

        static bool TryRaw(Dictionary<string, object> data, string key, out object raw)
        {
            raw = null;
            if (data == null) return false;
            if (!data.TryGetValue(key, out raw)) return false;
            return raw != null;
        }

        static string Describe(object raw) => raw == null ? "null" : $"{raw} ({raw.GetType().Name})";
    }
}
