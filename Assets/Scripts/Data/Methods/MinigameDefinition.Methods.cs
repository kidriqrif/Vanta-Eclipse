using System.Collections.Generic;
using Newtonsoft.Json;
using UnityEngine;

namespace VantaEclipse.Data
{
    public partial class MinigameDefinition
    {
        /// <summary>
        /// The prefab MinigameHost instantiates for this game.
        ///
        /// The stored field is the .tscn path the content came across with;
        /// SceneBuilder named every minigame prefab after the PascalCase of that
        /// same stem, so the two cannot drift as long as this is the one place
        /// that converts between them.
        /// </summary>
        public string PrefabName
        {
            get
            {
                if (string.IsNullOrEmpty(scenePath)) return "";
                string stem = System.IO.Path.GetFileNameWithoutExtension(scenePath);
                var builder = new System.Text.StringBuilder();
                foreach (var part in stem.Split('_'))
                {
                    if (part.Length == 0) continue;
                    builder.Append(char.ToUpperInvariant(part[0]));
                    builder.Append(part.Substring(1));
                }
                return builder.ToString();
            }
        }

        /// <summary>
        /// The board's tuning, parsed from the definition's JSON blob.
        ///
        /// Tuning never lives in code — a board size, a fleet, a sequence length
        /// is content, and content is editable without a rebuild. Parsed on
        /// demand and cached: the host reads it once per run, but a malformed
        /// blob should be reported once rather than on every access.
        /// </summary>
        public Dictionary<string, object> ParseContext()
        {
            if (_context != null) return _context;

            if (string.IsNullOrWhiteSpace(context))
            {
                _context = new Dictionary<string, object>();
                return _context;
            }
            try
            {
                _context = JsonConvert.DeserializeObject<Dictionary<string, object>>(context)
                           ?? new Dictionary<string, object>();
            }
            catch (JsonException error)
            {
                Debug.LogError($"MinigameDefinition '{id}': context is not valid JSON " +
                               $"({error.Message}). Falling back to the board's defaults.");
                _context = new Dictionary<string, object>();
            }
            return _context;
        }

        [System.NonSerialized] Dictionary<string, object> _context;
    }
}
