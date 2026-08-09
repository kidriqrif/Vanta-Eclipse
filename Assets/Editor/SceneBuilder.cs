using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.UI;

namespace VantaEclipse.EditorTools
{
    /// <summary>
    /// Builds the 32 Unity screens from the layout trees export_scenes.py
    /// lifted out of the .tscn files.
    ///
    /// This is a migration tool, not a runtime: it runs once, writes real
    /// .unity scenes, and then the JSON and the exporter both go away with the
    /// Godot tree. What it produces is ordinary Unity UI that a person edits
    /// normally afterwards — nothing here stays in the loop.
    ///
    /// It does not attempt pixel-perfection. It reproduces the hierarchy, the
    /// anchoring, the layout groups and their spacing, the text and its style,
    /// and the script attachment points. Fine positioning is then a visual
    /// pass in the editor, which is far cheaper than rebuilding 357 nodes by
    /// hand.
    /// </summary>
    public static class SceneBuilder
    {
        const string JsonDir = "Assets/Editor/PortedScenes";
        const string SceneDir = "Assets/Scenes";
        const string PrefabDir = "Assets/Resources/Prefabs";
        const string ArtDir = "Assets/Resources/Art";

        static readonly Vector2 ReferenceResolution = new(1080f, 1920f);

        /// <summary>
        /// Layouts that are components, not screens.
        ///
        /// Godot drew no distinction: a .tscn was a .tscn, and `preload(...)
        /// .instantiate()` worked on any of them. Unity splits the two — a
        /// Scene is loaded (one at a time, replacing what was there) and a
        /// Prefab is instantiated (many at once, into whatever is open). Every
        /// one of these is spawned by a script or embedded in a screen, so
        /// building them as scenes produced 21 entries in Build Settings that
        /// nothing could ever navigate to, and left the screens that embed them
        /// holding empty placeholders.
        /// </summary>
        static readonly HashSet<string> Components = new()
        {
            // Embedded in a screen's layout, or spawned by one at runtime.
            "AutoAttackToast", "CountdownTimerBar", "DamageNumber", "EnemyView",
            "ForgePanel", "InspectorCard", "LootToast", "OfflineRewardsModal",
            "RelicCollectionPanel", "ResultBanner", "UpgradeRow",
            "UpgradeShopPanel", "VoidBackground", "WorldUnlockModal",
            // The arcade boards. MinigameHost instantiates exactly one of these
            // into itself, chosen by the MinigameDefinition the player picked.
            "Battleship", "ConnectFour", "LightsOut", "MemoryMatch",
            "RuneSweeper", "SequenceEcho", "VoidReflex",
        };

        [MenuItem("Vanta Eclipse/Build Screens From Ported Layouts")]
        public static void BuildAll()
        {
            if (!Directory.Exists(JsonDir))
            {
                Debug.LogError($"No layouts at {JsonDir}. Run: python tools/port/export_scenes.py");
                return;
            }

            Directory.CreateDirectory(SceneDir);
            Directory.CreateDirectory(PrefabDir);

            // Read every layout before building any of it. Screens resolve their
            // Instance nodes against the prefab tree, so the prefabs have to
            // exist first — which means two ordered passes, not one loop.
            var layouts = new List<(string Name, JArray Nodes)>();
            foreach (var path in Directory.GetFiles(JsonDir, "*.json"))
            {
                var doc = JObject.Parse(File.ReadAllText(path));
                layouts.Add((ToPascal((string)doc["name"]), (JArray)doc["nodes"]));
            }

            int nodeTotal = 0;
            var prefabs = new List<string>();
            var screens = new List<string>();

            // Pass 1 — components, into an empty scene so nothing lands in a
            // real one on the way past.
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            foreach (var (name, nodes) in layouts)
            {
                if (!Components.Contains(name)) continue;
                nodeTotal += BuildPrefab(name, nodes);
                prefabs.Add(name);
            }
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            // Pass 2 — screens.
            foreach (var (name, nodes) in layouts)
            {
                if (Components.Contains(name)) continue;
                nodeTotal += BuildScene(name, nodes);
                screens.Add(name);
            }

            // Register every screen in Build Settings, main menu first — it is
            // the entry point, and Unity loads index 0 on launch.
            screens.Sort((a, b) => a == "MainMenu" ? -1 : b == "MainMenu" ? 1 : string.Compare(a, b));
            var registered = new List<EditorBuildSettingsScene>();
            foreach (var name in screens)
                registered.Add(new EditorBuildSettingsScene($"{SceneDir}/{name}.unity", true));
            EditorBuildSettings.scenes = registered.ToArray();

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log($"Built {screens.Count} screens and {prefabs.Count} prefabs, " +
                      $"{nodeTotal} nodes; {registered.Count} scenes in Build Settings.");
        }

        /// <summary>
        /// Build one component layout and save it as a prefab.
        ///
        /// Unlike a screen this keeps the layout's own root: damage_number's
        /// root IS the Label, and replacing it with a bare Control (which is
        /// what a screen root gets, so it can carry the safe-area inset) would
        /// throw away the thing the prefab exists to be.
        /// </summary>
        static int BuildPrefab(string prefabName, JArray nodes)
        {
            // A throwaway parent so Make() has something to attach the root to;
            // the root is lifted out of it before it is destroyed.
            var holder = new GameObject("~PrefabHolder", typeof(RectTransform));
            var byPath = new Dictionary<string, GameObject>();
            GameObject root = null;
            int count = 0;

            foreach (JObject node in nodes)
            {
                string name = (string)node["name"];
                string kind = (string)node["kind"];
                string parentPath = (string)node["parent"];

                if (parentPath == null)
                {
                    root = Make(kind, name, node, holder);
                    if (root == null) break;
                    byPath[""] = root;
                    count++;
                    continue;
                }

                string key = parentPath == "." ? "" : parentPath;
                if (!byPath.TryGetValue(key, out var parent))
                {
                    Debug.LogWarning($"{prefabName}: '{name}' has no parent at '{parentPath}' — " +
                                     "attaching to the root instead.");
                    parent = root;
                }

                var go = Make(kind, name, node, parent);
                if (go == null) continue;

                byPath[key == "" ? name : $"{key}/{name}"] = go;
                count++;
            }

            if (root != null)
            {
                root.transform.SetParent(null, false);
                PrefabUtility.SaveAsPrefabAsset(root, $"{PrefabDir}/{prefabName}.prefab");
                Object.DestroyImmediate(root);
            }
            Object.DestroyImmediate(holder);
            return count;
        }

        static int BuildScene(string sceneName, JArray nodes)
        {
            var scene = EditorSceneManager.NewScene(
                NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);

            var camera = Camera.main;
            if (camera != null)
            {
                camera.clearFlags = CameraClearFlags.SolidColor;
                camera.backgroundColor = VantaTheme.Void;
                camera.orthographic = true;
            }

            var canvasGo = new GameObject("Canvas",
                typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;

            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = ReferenceResolution;
            // Match height: the layout is portrait and its vertical rhythm is
            // what must stay intact. Extra width becomes margin, which
            // SafeAreaFitter's width cap then absorbs on tablets.
            scaler.matchWidthOrHeight = 1f;

            // Godot path ("MarginContainer/SettingsVBox") -> the built object.
            var byPath = new Dictionary<string, GameObject>();
            GameObject root = null;
            int count = 0;

            foreach (JObject node in nodes)
            {
                string name = (string)node["name"];
                string kind = (string)node["kind"];
                string parentPath = (string)node["parent"];

                GameObject parent;
                if (parentPath == null)
                {
                    // The scene root. Its own children hang off the canvas, and
                    // it carries the safe-area inset for the whole screen.
                    root = new GameObject(name, typeof(RectTransform), typeof(SafeAreaFitter));
                    root.transform.SetParent(canvasGo.transform, false);
                    Stretch(root.GetComponent<RectTransform>());
                    byPath[""] = root;
                    ApplyScript(root, node);
                    count++;
                    continue;
                }

                string key = parentPath == "." ? "" : parentPath;
                if (!byPath.TryGetValue(key, out parent))
                {
                    Debug.LogWarning($"{sceneName}: '{name}' has no parent at '{parentPath}' — " +
                                     "attaching to the root instead.");
                    parent = root;
                }

                var go = Make(kind, name, node, parent);
                if (go == null) continue;

                string ownPath = key == "" ? name : $"{key}/{name}";
                byPath[ownPath] = go;
                count++;
            }

            EditorSceneManager.SaveScene(scene, $"{SceneDir}/{sceneName}.unity");
            return count;
        }

        static GameObject Make(string kind, string name, JObject node, GameObject parent)
        {
            // An instanced sub-scene resolves to the prefab pass 1 built from
            // the same layout. Godot's .tscn recorded which scene was embedded;
            // export_scenes.py carried that through, so this is a lookup rather
            // than a guess. A miss falls through to an empty Control, which is
            // what every one of these used to be.
            if (kind == "Instance")
            {
                var instanced = MakeInstance(name, node, parent);
                if (instanced != null) return instanced;
                kind = "Control";
            }

            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent.transform, false);
            var rect = go.GetComponent<RectTransform>();

            // Default to filling the parent; anchors below override.
            Stretch(rect);

            switch (kind)
            {
                case "Control":
                case "CanvasLayer":
                    break;

                case "Label":
                    MakeText(go, node);
                    break;

                case "Button":
                {
                    var image = go.AddComponent<Image>();
                    var style = VantaTheme.Get((string)node["style"]);
                    image.color = style.Background ?? VantaTheme.Slate;
                    go.AddComponent<Button>();

                    var labelGo = new GameObject("Label", typeof(RectTransform));
                    labelGo.transform.SetParent(go.transform, false);
                    Stretch(labelGo.GetComponent<RectTransform>());
                    MakeText(labelGo, node, style);
                    break;
                }

                case "Panel":
                {
                    var image = go.AddComponent<Image>();
                    var style = VantaTheme.Get((string)node["style"]);
                    image.color = style.Background ?? VantaTheme.Abyss;
                    break;
                }

                case "ColorRect":
                {
                    var image = go.AddComponent<Image>();
                    image.color = ReadColor(node["color"]) ?? VantaTheme.Void;
                    break;
                }

                case "Texture":
                {
                    var image = go.AddComponent<Image>();
                    image.color = Color.white;
                    image.preserveAspect = true;
                    var sprite = LoadSprite((string)node["sprite"]);
                    if (sprite != null) image.sprite = sprite;
                    else image.color = new Color(1f, 1f, 1f, 0f);  // placeholder, invisible
                    break;
                }

                case "VBox":
                {
                    var group = go.AddComponent<VerticalLayoutGroup>();
                    ConfigureGroup(group, node);
                    break;
                }

                case "HBox":
                {
                    var group = go.AddComponent<HorizontalLayoutGroup>();
                    ConfigureGroup(group, node);
                    break;
                }

                case "Margin":
                {
                    // Godot's MarginContainer is a container whose only job is
                    // padding, so it becomes a layout group carrying nothing
                    // but padding.
                    var group = go.AddComponent<VerticalLayoutGroup>();
                    ConfigureGroup(group, node);
                    group.childForceExpandHeight = true;
                    break;
                }

                case "Grid":
                {
                    var group = go.AddComponent<GridLayoutGroup>();
                    int columns = node["columns"] != null ? (int)node["columns"] : 2;
                    group.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
                    group.constraintCount = Mathf.Max(1, columns);
                    if (node["spacing"] != null)
                    {
                        float s = (float)node["spacing"];
                        group.spacing = new Vector2(s, s);
                    }
                    break;
                }

                case "Scroll":
                {
                    var scroll = go.AddComponent<ScrollRect>();
                    go.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
                    go.AddComponent<Mask>().showMaskGraphic = false;
                    scroll.horizontal = false;
                    scroll.movementType = ScrollRect.MovementType.Elastic;

                    // A ScrollRect needs a content child; Godot's
                    // ScrollContainer has its children directly. The real
                    // children are parented to this content object by path
                    // lookup, so it must carry the same name as the node.
                    var content = new GameObject("Content", typeof(RectTransform));
                    content.transform.SetParent(go.transform, false);
                    var contentRect = content.GetComponent<RectTransform>();
                    contentRect.anchorMin = new Vector2(0f, 1f);
                    contentRect.anchorMax = new Vector2(1f, 1f);
                    contentRect.pivot = new Vector2(0.5f, 1f);
                    var fitter = content.AddComponent<ContentSizeFitter>();
                    fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
                    content.AddComponent<VerticalLayoutGroup>();
                    scroll.content = contentRect;
                    scroll.viewport = rect;
                    break;
                }

                case "Slider":
                case "ProgressBar":
                {
                    var slider = go.AddComponent<Slider>();
                    slider.interactable = kind == "Slider";

                    var background = new GameObject("Background", typeof(RectTransform));
                    background.transform.SetParent(go.transform, false);
                    Stretch(background.GetComponent<RectTransform>());
                    background.AddComponent<Image>().color = VantaTheme.Slate;

                    var fillArea = new GameObject("Fill Area", typeof(RectTransform));
                    fillArea.transform.SetParent(go.transform, false);
                    Stretch(fillArea.GetComponent<RectTransform>());

                    var fill = new GameObject("Fill", typeof(RectTransform));
                    fill.transform.SetParent(fillArea.transform, false);
                    Stretch(fill.GetComponent<RectTransform>());
                    fill.AddComponent<Image>().color = VantaTheme.Crimson;

                    slider.fillRect = fill.GetComponent<RectTransform>();
                    slider.targetGraphic = background.GetComponent<Image>();
                    break;
                }

                case "Toggle":
                {
                    var toggle = go.AddComponent<Toggle>();
                    var background = new GameObject("Background", typeof(RectTransform));
                    background.transform.SetParent(go.transform, false);
                    Stretch(background.GetComponent<RectTransform>());
                    var bgImage = background.AddComponent<Image>();
                    bgImage.color = VantaTheme.Slate;
                    toggle.targetGraphic = bgImage;

                    var check = new GameObject("Checkmark", typeof(RectTransform));
                    check.transform.SetParent(background.transform, false);
                    Stretch(check.GetComponent<RectTransform>());
                    var checkImage = check.AddComponent<Image>();
                    checkImage.color = VantaTheme.Crimson;
                    toggle.graphic = checkImage;
                    break;
                }

                default:
                    Debug.LogWarning($"SceneBuilder: unhandled kind '{kind}' on '{name}'");
                    break;
            }

            ApplyRect(rect, node);
            ApplyLayoutElement(go, node);
            ApplyScript(go, node);

            if (node["hidden"] != null && (bool)node["hidden"]) go.SetActive(false);
            return go;
        }

        // --- property application ------------------------------------------

        static void ApplyRect(RectTransform rect, JObject node)
        {
            var anchorMin = ReadVector(node["anchorMin"]);
            var anchorMax = ReadVector(node["anchorMax"]);
            if (anchorMin.HasValue && anchorMax.HasValue)
            {
                rect.anchorMin = anchorMin.Value;
                rect.anchorMax = anchorMax.Value;
                rect.offsetMin = Vector2.zero;
                rect.offsetMax = Vector2.zero;
            }

            if (node["offset"] is JObject offset)
            {
                // Godot's Y grows downward, Unity's upward, so top and bottom
                // swap sign as well as slot.
                float left = (float)offset["left"];
                float right = (float)offset["right"];
                float top = (float)offset["top"];
                float bottom = (float)offset["bottom"];
                rect.offsetMin = new Vector2(left, -bottom);
                rect.offsetMax = new Vector2(right, -top);
            }

            var minSize = ReadVector(node["minSize"]);
            if (minSize.HasValue)
            {
                var size = rect.sizeDelta;
                if (minSize.Value.x > 0f) size.x = minSize.Value.x;
                if (minSize.Value.y > 0f) size.y = minSize.Value.y;
                rect.sizeDelta = size;
            }
        }

        static void ApplyLayoutElement(GameObject go, JObject node)
        {
            var minSize = ReadVector(node["minSize"]);
            bool expandH = node["expandH"] != null && (bool)node["expandH"];
            bool expandV = node["expandV"] != null && (bool)node["expandV"];
            if (!minSize.HasValue && !expandH && !expandV) return;

            var element = go.AddComponent<LayoutElement>();
            if (minSize.HasValue)
            {
                if (minSize.Value.x > 0f) element.minWidth = minSize.Value.x;
                if (minSize.Value.y > 0f) element.minHeight = minSize.Value.y;
            }
            // Godot's EXPAND size flag is Unity's flexible weight.
            if (expandH) element.flexibleWidth = 1f;
            if (expandV) element.flexibleHeight = 1f;
        }

        static void ConfigureGroup(HorizontalOrVerticalLayoutGroup group, JObject node)
        {
            if (node["spacing"] != null) group.spacing = (float)node["spacing"];

            if (node["padding"] is JObject padding)
            {
                group.padding = new RectOffset(
                    padding["left"] != null ? (int)padding["left"] : 0,
                    padding["right"] != null ? (int)padding["right"] : 0,
                    padding["top"] != null ? (int)padding["top"] : 0,
                    padding["bottom"] != null ? (int)padding["bottom"] : 0);
            }

            // Godot containers stretch their children across the cross axis by
            // default; Unity's do not unless told.
            group.childForceExpandWidth = true;
            group.childForceExpandHeight = false;
            group.childControlWidth = true;
            group.childControlHeight = true;
        }

        /// <summary>
        /// Instantiate the prefab a Godot Instance node referred to.
        /// Returns null when there is no prefab for it, so the caller can fall
        /// back to an empty Control rather than lose the node.
        /// </summary>
        static GameObject MakeInstance(string name, JObject node, GameObject parent)
        {
            string resPath = (string)node["instance"];
            if (string.IsNullOrEmpty(resPath)) return null;

            string stem = Path.GetFileNameWithoutExtension(resPath);
            string prefabName = ToPascal(stem);
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>($"{PrefabDir}/{prefabName}.prefab");
            if (prefab == null)
            {
                Debug.LogWarning($"SceneBuilder: no prefab '{prefabName}' for instanced " +
                                 $"'{resPath}' — '{name}' built as an empty Control.");
                return null;
            }

            var go = (GameObject)PrefabUtility.InstantiatePrefab(prefab, parent.transform);
            // Godot lets an instance be renamed at its use site, and several are
            // (gameplay's countdown_timer_bar is "TimerBar"). The screens look
            // their nodes up by name, so the use-site name wins.
            go.name = name;

            var rect = go.GetComponent<RectTransform>();
            if (rect != null) ApplyRect(rect, node);
            // No ApplyScript: the behaviour came with the prefab. Adding it
            // again here would give the object two copies, both subscribing to
            // the same EventBus signals.
            return go;
        }

        static void MakeText(GameObject go, JObject node, VantaTheme.Style style = null)
        {
            style ??= VantaTheme.Get((string)node["style"]);
            var text = go.AddComponent<Text>();
            text.font = Fonts.Body;
            text.text = (string)node["text"] ?? "";
            text.color = style.Text;

            int size = node["fontSize"] != null ? (int)node["fontSize"] : style.FontSize;
            text.fontSize = VantaTheme.SnapFontSize(size);

            // Godot: 0 left, 1 center, 2 right (h) and 0 top, 1 center, 2 bottom (v).
            int h = node["hAlign"] != null ? (int)node["hAlign"] : 0;
            int v = node["vAlign"] != null ? (int)node["vAlign"] : 1;
            text.alignment = (h, v) switch
            {
                (0, 0) => TextAnchor.UpperLeft,
                (1, 0) => TextAnchor.UpperCenter,
                (2, 0) => TextAnchor.UpperRight,
                (0, 2) => TextAnchor.LowerLeft,
                (1, 2) => TextAnchor.LowerCenter,
                (2, 2) => TextAnchor.LowerRight,
                (1, _) => TextAnchor.MiddleCenter,
                (2, _) => TextAnchor.MiddleRight,
                _ => TextAnchor.MiddleLeft,
            };
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Overflow;
        }

        /// <summary>
        /// Attach the ported C# behaviour matching the .gd script the node had.
        ///
        /// Missing components are a warning, not an error: the screens are
        /// built before every UI script is ported, and a scene that refuses to
        /// build because one behaviour does not exist yet would block the other
        /// 31. The warning names the type so the gap is visible.
        /// </summary>
        static void ApplyScript(GameObject go, JObject node)
        {
            string scriptPath = (string)node["script"];
            if (string.IsNullOrEmpty(scriptPath)) return;

            string stem = Path.GetFileNameWithoutExtension(scriptPath);
            string typeName = $"VantaEclipse.UI.{ToPascal(stem)}";
            var type = System.Type.GetType($"{typeName}, Assembly-CSharp");
            if (type == null)
            {
                Debug.LogWarning($"SceneBuilder: no C# behaviour for '{scriptPath}' " +
                                 $"(looked for {typeName}) — '{go.name}' has no script attached.");
                return;
            }
            go.AddComponent(type);
        }

        // --- helpers --------------------------------------------------------

        static void Stretch(RectTransform rect)
        {
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
        }

        static Vector2? ReadVector(JToken token)
        {
            if (token is not JObject obj) return null;
            return new Vector2((float)obj["x"], (float)obj["y"]);
        }

        static Color? ReadColor(JToken token)
        {
            if (token is not JObject obj) return null;
            return new Color((float)obj["r"], (float)obj["g"], (float)obj["b"], (float)obj["a"]);
        }

        static Sprite LoadSprite(string resPath)
        {
            if (string.IsNullOrEmpty(resPath) || !resPath.StartsWith("res://")) return null;
            string rest = resPath.Substring("res://".Length);
            int slash = rest.IndexOf('/');
            string relative = slash >= 0 ? rest.Substring(slash + 1) : rest;
            return AssetDatabase.LoadAssetAtPath<Sprite>($"{ArtDir}/{relative}");
        }

        static string ToPascal(string snake)
        {
            var parts = snake.Split('_');
            var builder = new System.Text.StringBuilder();
            foreach (var part in parts)
            {
                if (part.Length == 0) continue;
                builder.Append(char.ToUpperInvariant(part[0]));
                builder.Append(part.Substring(1));
            }
            return builder.ToString();
        }
    }
}
