// Ported from scripts/utils/number_format.gd
using System;
using System.Globalization;
using UnityEngine;

namespace VantaEclipse.Core
{
    /// <summary>
    /// Static helpers for displaying the huge numbers incremental games
    /// produce. 1234 -> "1.23K", 5600000 -> "5.6M", and so on.
    ///
    /// TODO(future): the suffix table tops out near 1e36. Deep prestige runs
    /// can pass that; switch to scientific notation before they do.
    /// </summary>
    public static class NumberFormat
    {
        static readonly string[] Suffixes =
        {
            "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc",
        };

        // Every format here pins InvariantCulture. Godot's String.num was
        // culture-independent; .NET's is not, and on a device set to a
        // comma-decimal locale the defaults would render "1,23K" and put a
        // decimal comma inside the comma-grouped exact figures.
        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        /// <summary>Exact integer with comma grouping ("1,240") — used by
        /// hold-to-reveal interactions behind abbreviated figures (Enhanced
        /// accessibility tier).</summary>
        public static string FormatExact(float value)
        {
            bool negative = value < 0f;
            double rounded = Math.Round(Math.Abs((double)value));
            string grouped = rounded.ToString("#,##0", Inv);
            return negative ? "-" + grouped : grouped;
        }

        /// <summary>Percent affix display: 0.12 -> "12%", 0.045 -> "4.5%".</summary>
        public static string FormatPercent(float fraction)
        {
            float pct = fraction * 100f;
            int decimals = Mathf.Abs(pct) >= 10f ? 0 : 1;
            return Num(pct, decimals) + "%";
        }

        public static string Format(float value)
        {
            bool negative = value < 0f;
            float v = Mathf.Abs(value);
            if (v < 1000f)
            {
                string whole = Math.Round((double)v).ToString("0", Inv);
                return negative ? "-" + whole : whole;
            }

            int tier = (int)Math.Floor(Math.Log(v) / Math.Log(1000.0));
            tier = Math.Min(tier, Suffixes.Length - 1);
            float scaled = v / Mathf.Pow(1000f, tier);
            int decimals = scaled < 10f ? 2 : (scaled < 100f ? 1 : 0);
            string text = Num(scaled, decimals) + Suffixes[tier];
            return negative ? "-" + text : text;
        }

        /// <summary>Godot's String.num(): fixed decimals, trailing zeros kept,
        /// invariant separator.</summary>
        public static string Num(float value, int decimals)
            => value.ToString("F" + decimals, Inv);
    }
}
