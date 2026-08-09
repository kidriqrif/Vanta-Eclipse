// Builds the game's content library from the JSON in Assets/Editor/PortedData.
//
// Run once after opening the project: Vanta Eclipse > Import Ported Data.
// It is idempotent — re-running updates the existing .asset files in place
// rather than making duplicates, so the import can be replayed on top of an
// existing library whenever the JSON changes.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEngine;
using VantaEclipse.Data;

namespace VantaEclipse.EditorTools
{
    public static class DefinitionImporter
    {
        const string JsonDir = "Assets/Editor/PortedData";
        // Under Resources/ so DefinitionRegistry can load a whole type with
        // Resources.LoadAll, so a manager asks for a type rather than keeping
        // its own hard-coded list of paths.
        const string ContentDir = "Assets/Resources/Content";
        const string ArtDir = "Assets/Resources/Art";

        [MenuItem("Vanta Eclipse/Import Ported Data")]
        public static void Import()
        {
            if (!Directory.Exists(JsonDir))
            {
                Debug.LogError($"No ported data at {JsonDir}. Run: python tools/port/port_data.py");
                return;
            }

            var types = AppDomain.CurrentDomain.GetAssemblies()
                .SelectMany(SafeTypes)
                .Where(t => t.Namespace == "VantaEclipse.Data" && t.IsSubclassOf(typeof(ScriptableObject)))
                .ToDictionary(t => t.Name, t => t);

            int created = 0, updated = 0, failed = 0;

            foreach (var path in Directory.GetFiles(JsonDir, "*.json"))
            {
                string typeName = Path.GetFileNameWithoutExtension(path);
                if (!types.TryGetValue(typeName, out var type))
                {
                    Debug.LogError($"{typeName}.json has no matching class in VantaEclipse.Data");
                    failed++;
                    continue;
                }

                string outDir = $"{ContentDir}/{typeName}";
                Directory.CreateDirectory(outDir);

                foreach (var row in JArray.Parse(File.ReadAllText(path)).Children<JObject>())
                {
                    string id = (string)row["id"];
                    if (string.IsNullOrEmpty(id))
                    {
                        Debug.LogError($"{typeName}: record with no id in {row["_source"]}");
                        failed++;
                        continue;
                    }

                    string assetPath = $"{outDir}/{id}.asset";
                    var asset = AssetDatabase.LoadAssetAtPath(assetPath, type) as ScriptableObject;
                    bool isNew = asset == null;
                    if (isNew)
                    {
                        asset = ScriptableObject.CreateInstance(type);
                        AssetDatabase.CreateAsset(asset, assetPath);
                    }

                    Populate(asset, type, row);
                    EditorUtility.SetDirty(asset);
                    if (isNew) created++; else updated++;
                }
            }

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log($"Ported data import: {created} created, {updated} updated, {failed} failed.");
        }

        static IEnumerable<Type> SafeTypes(Assembly a)
        {
            try { return a.GetTypes(); }
            catch (ReflectionTypeLoadException e) { return e.Types.Where(t => t != null); }
        }

        static void Populate(ScriptableObject asset, Type type, JObject row)
        {
            foreach (var prop in row.Properties())
            {
                if (prop.Name.StartsWith("_")) continue;

                var field = type.GetField(ToCamel(prop.Name),
                    BindingFlags.Public | BindingFlags.Instance);
                if (field == null)
                {
                    Debug.LogWarning($"{type.Name}: no field for '{prop.Name}' — skipped");
                    continue;
                }

                object value = Convert(prop.Value, field.FieldType, type.Name, prop.Name);
                if (value != null) field.SetValue(asset, value);
            }
        }

        static object Convert(JToken token, Type target, string typeName, string fieldName)
        {
            // A colour comes across as {r,g,b,a}.
            if (target == typeof(Color))
            {
                return new Color((float)token["r"], (float)token["g"],
                                 (float)token["b"], (float)token["a"]);
            }

            // Sprites came across as res:// paths into the generated art tree.
            if (target == typeof(Sprite)) return LoadSprite((string)token);
            if (target == typeof(Sprite[]))
                return token.Select(t => LoadSprite((string)t)).ToArray();

            // MinigameDefinition.context is a free-form blob; it stays JSON and
            // is parsed where it is used, because Unity cannot serialise a
            // Dictionary and the shape differs per minigame.
            if (target == typeof(string) && token.Type == JTokenType.Object)
                return token.ToString(Newtonsoft.Json.Formatting.None);

            // WorldDefinition points at enemies by .tres path. Ids are what the
            // save file already speaks, so paths collapse to ids here and the
            // runtime resolves them through DefinitionRegistry.
            if (target == typeof(string[]))
                return token.Select(t => StripResPath((string)t)).ToArray();

            if (target == typeof(int[])) return token.Select(t => (int)t).ToArray();
            if (target.IsEnum) return Enum.ToObject(target, (int)token);
            if (target == typeof(string)) return (string)token;
            if (target == typeof(float)) return (float)token;
            if (target == typeof(int)) return (int)token;
            if (target == typeof(bool)) return (bool)token;

            Debug.LogWarning($"{typeName}.{fieldName}: unhandled type {target.Name}");
            return null;
        }

        static Sprite LoadSprite(string resPath)
        {
            if (string.IsNullOrEmpty(resPath)) return null;
            string assetPath = $"{ArtDir}/{StripResPath(resPath, keepExtension: true)}";
            var sprite = AssetDatabase.LoadAssetAtPath<Sprite>(assetPath);
            if (sprite == null)
                Debug.LogWarning($"Sprite not found: {assetPath} (from {resPath}). " +
                                 "Run tools/make_sprites.py with the Unity output path.");
            return sprite;
        }

        static string StripResPath(string path, bool keepExtension = false)
        {
            if (string.IsNullOrEmpty(path)) return path;
            if (!path.StartsWith("res://")) return path;
            string rest = path.Substring("res://".Length);
            if (keepExtension)
            {
                // res://sprites/pets/pet_ember.png -> pets/pet_ember.png
                int slash = rest.IndexOf('/');
                return slash >= 0 ? rest.Substring(slash + 1) : rest;
            }
            return Path.GetFileNameWithoutExtension(rest);
        }

        static string ToCamel(string snake)
        {
            var parts = snake.Split('_');
            return parts[0] + string.Concat(parts.Skip(1)
                .Select(p => p.Length == 0 ? p : char.ToUpperInvariant(p[0]) + p.Substring(1)));
        }
    }
}
