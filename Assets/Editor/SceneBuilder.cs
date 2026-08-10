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
    /// Builds the 32 screens and components from the layout trees in
    /// Assets/Editor/PortedScenes.
    ///
    /// THIS IS LOAD-BEARING, despite having been written as a one-shot
    /// migration tool. The layout collapse that broke nine screens was fixed
    /// HERE and the whole tree regenerated, which is the only reason that fix
    /// was one change rather than nine. A scene edited by hand is silently
    /// eaten by the next regeneration. Either keep editing this, or retire it
    /// deliberately and say so in HANDOFF.md.
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
        /// Scroll node -> the content object its children belong inside.
        ///
        /// A ScrollRect is three rects (viewport, content, children) where the
        /// layout had one, so the object a path resolves to is not the object
        /// built for that path. Cleared per layout; see ChildHost.
        /// </summary>
        static readonly Dictionary<GameObject, GameObject> ScrollContent = new();

        /// <summary>Where a node's children are parented, which is the node
        /// itself for everything except a scroll.</summary>
        static GameObject ChildHost(GameObject go)
            => go != null && ScrollContent.TryGetValue(go, out var content) ? content : go;

        /// <summary>
        /// Layouts that are components, not screens.
        ///
        /// Unity splits the two: a Scene is loaded (one at a time, replacing
        /// what was there) and a Prefab is instantiated (many at once, into
        /// whatever is open). Every
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
                Debug.LogError($"No layouts at {JsonDir} — the tree cannot be rebuilt without them.");
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
        /// Unlike a screen this keeps the layout's own root: DamageNumber's
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
            var built = new List<(GameObject Go, string Kind)>();
            ScrollContent.Clear();

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

                byPath[key == "" ? name : $"{key}/{name}"] = ChildHost(go);
                built.Add((go, kind));
                count++;
            }

            HugContainers(built);

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

            // Layout path ("MarginContainer/SettingsVBox") -> the built object.
            var byPath = new Dictionary<string, GameObject>();
            GameObject root = null;
            int count = 0;
            var built = new List<(GameObject Go, string Kind)>();
            ScrollContent.Clear();

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
                byPath[ownPath] = ChildHost(go);
                built.Add((go, kind));
                count++;
            }

            HugContainers(built);

            EditorSceneManager.SaveScene(scene, $"{SceneDir}/{sceneName}.unity");
            return count;
        }

        static GameObject Make(string kind, string name, JObject node, GameObject parent)
        {
            // An instanced sub-scene resolves to the prefab pass 1 built from
            // the same layout. The layout records which component was
            // embedded, so this is a lookup rather than a guess. A miss falls
            // through to an empty Control rather than losing the node.
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
                    // A margin node's only job is padding, so it becomes a
                    // layout group carrying nothing but padding.
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
                    // A GridLayoutGroup imposes a FIXED cellSize and defaults to
                    // 100x100 — the columns count above is meaningless without
                    // it. GridCellFitter derives the cell from the live width.
                    go.AddComponent<GridCellFitter>();
                    break;
                }

                case "Scroll":
                {
                    var scroll = go.AddComponent<ScrollRect>();
                    scroll.horizontal = false;
                    scroll.movementType = ScrollRect.MovementType.Elastic;

                    // RectMask2D, NOT Mask.
                    //
                    // Mask builds its stencil from a Graphic's ALPHA, and this
                    // carried an Image at alpha 0 so the viewport would not
                    // paint. Alpha 0 everywhere is a stencil that rejects
                    // everywhere: every list in the game — arcade cards, quests,
                    // shop products, eclipse powers, gear inventory, pets,
                    // relics, the forge — was built correctly, laid out
                    // correctly, measured correctly, and then clipped to
                    // nothing. Ten screens rendered as a header over an empty
                    // rectangle. RectMask2D clips to the rect and needs no
                    // graphic at all, which is also what a scroll viewport
                    // wants.
                    go.AddComponent<RectMask2D>();

                    // The scrollable content. The layout parents the scroll
                    // node's children straight to the scroll node, so this
                    // object is registered as their host below — without that
                    // they land on the VIEWPORT, which pins them to its size
                    // and leaves ScrollRect.content empty, so a list longer
                    // than the frame overflows instead of scrolling.
                    var content = new GameObject("Content", typeof(RectTransform));
                    content.transform.SetParent(go.transform, false);
                    var contentRect = content.GetComponent<RectTransform>();
                    contentRect.anchorMin = new Vector2(0f, 1f);
                    contentRect.anchorMax = new Vector2(1f, 1f);
                    contentRect.pivot = new Vector2(0.5f, 1f);
                    // A NEW RectTransform's sizeDelta is (100, 100), and the X
                    // anchors above are stretched — where sizeDelta is an offset
                    // from the parent's edges, not a size. Left at the default
                    // it makes the content 100 units WIDER than the viewport,
                    // 50 of it off each side, and a RectMask2D then eats the
                    // first and last characters of every row in the list. The
                    // height stays whatever the ContentSizeFitter computes.
                    contentRect.sizeDelta = new Vector2(0f, contentRect.sizeDelta.y);
                    var fitter = content.AddComponent<ContentSizeFitter>();
                    fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
                    var contentGroup = content.AddComponent<VerticalLayoutGroup>();
                    contentGroup.childForceExpandWidth = true;
                    contentGroup.childForceExpandHeight = false;
                    contentGroup.childControlWidth = true;
                    contentGroup.childControlHeight = true;
                    scroll.content = contentRect;
                    scroll.viewport = rect;
                    ScrollContent[go] = content;
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
                    // A Toggle is two stretched Images and nothing that reports
                    // a size, so inside a row it collapses to zero height and
                    // takes the row with it. 72 is the accessibility floor the
                    // rest of the UI uses for a tap target (§4B), snapped onto
                    // the 9px grid the whole layout is built on.
                    var box = go.AddComponent<LayoutElement>();
                    box.minWidth = box.preferredWidth = 72f;
                    box.minHeight = box.preferredHeight = 72f;
                    box.flexibleWidth = 0f;

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

        /// <summary>
        /// Make a bare container report the height of its contents.
        ///
        /// The layouts were authored where a container propagated a combined
        /// minimum size up the tree, so a Panel wrapping a VBox was as tall as
        /// the VBox and nobody wrote that down. Unity propagates nothing: an
        /// Image reports no preferred size,
        /// so `SettingsVBox` (childControlHeight = true) gave AudioPanel a
        /// height of ZERO and the AUDIO, GAME and ABOUT rows all drew on top of
        /// each other. Nine of the eleven screens had a version of this.
        ///
        /// A VerticalLayoutGroup is the fix because a layout group IS an
        /// ILayoutElement — it reports its children's preferred height as its
        /// own, which is exactly the propagation that went missing.
        ///
        /// ONLY when the parent lays this node out. A screen root and a
        /// full-bleed overlay are also Controls with children, and stacking
        /// THEIR children vertically would break layouts that currently work —
        /// MainMenu and Gameplay are the two screens that were already correct
        /// and neither may regress.
        /// </summary>
        /// <summary>
        /// Runs after the whole tree exists, because whether a node needs this
        /// depends on what ended up INSIDE it — which Make() cannot know while
        /// it is still building the node's siblings.
        /// </summary>
        static void HugContainers(List<(GameObject Go, string Kind)> built)
        {
            foreach (var (go, kind) in built)
            {
                if (kind != "Panel" && kind != "Control" && kind != "ColorRect") continue;
                if (go == null || go.GetComponent<LayoutGroup>() != null) continue;
                if (go.transform.childCount == 0) continue;

                var parent = go.transform.parent;
                if (parent == null || parent.GetComponent<LayoutGroup>() == null) continue;

                // A container holding a COMPONENT does not get a layout group.
                // gameplay's CombatArea is the only one: its child is the
                // EnemyView prefab, which positions itself inside its own 500px
                // box, as it was authored to. Laying it out instead stretches
                // that box to the container's width and the enemy — anchored to
                // the box's top-left — slides to the left edge and half
                // off-screen. The node still needs to report a height, and its
                // EXPAND flag already gave it one through ApplyLayoutElement.
                bool holdsComponent = false;
                foreach (Transform child in go.transform)
                    if (PrefabUtility.IsAnyPrefabInstanceRoot(child.gameObject)) holdsComponent = true;
                if (holdsComponent) continue;

                var group = go.AddComponent<VerticalLayoutGroup>();
                group.childForceExpandWidth = true;
                group.childForceExpandHeight = false;
                group.childControlWidth = true;
                group.childControlHeight = true;
            }
        }

        static void ApplyRect(RectTransform rect, JObject node)
        {
            var anchorMin = ReadVector(node["anchorMin"]);
            var anchorMax = ReadVector(node["anchorMax"]);
            bool explicitAnchors = anchorMin.HasValue && anchorMax.HasValue;
            if (explicitAnchors)
            {
                rect.anchorMin = anchorMin.Value;
                rect.anchorMax = anchorMax.Value;
                rect.offsetMin = Vector2.zero;
                rect.offsetMax = Vector2.zero;
            }

            if (node["offset"] is JObject offset)
            {
                // THE LAYOUT'S DEFAULT ANCHOR IS THE TOP-LEFT POINT — all four
                // anchor values 0 — and only anchors the scene overrode were
                // recorded. So a node with offsets and no recorded anchors is a
                // top-left-anchored box, and leaving it on
                // this builder's full-stretch default turns "500 wide" into
                // "500 wider than the parent". That compounds down a chain:
                // EnemyView 500 -> SpriteHolder 1000 -> EnemySprite 1500, which
                // is precisely how a 500px creature rendered as a 1500px monster
                // bleeding off both edges of a 1080px screen. 80 rects across
                // the project were built this way.
                if (!explicitAnchors)
                {
                    rect.anchorMin = new Vector2(0f, 1f);
                    rect.anchorMax = new Vector2(0f, 1f);
                }
                // The layout's Y grows downward and Unity's upward, so top and
                // bottom swap sign as well as slot.
                float left = (float)offset["left"];
                float right = (float)offset["right"];
                float top = (float)offset["top"];
                float bottom = (float)offset["bottom"];

                // AN OFFSET BOX THAT COVERS THE PARENT EXACTLY IS A FILL, and
                // has to be built as one. Written as a top-left box it is the
                // same pixels but a different contract: `anchoredPosition =
                // Vector2.zero` then means "put my centre on the parent's
                // top-left corner" instead of "sit where I was placed". That is
                // exactly what happened to EnemyView's SpriteHolder — the idle
                // hover resets the bob to zero every loop, and the creature
                // jumped a quarter-screen left and drew half off the display on
                // any shape narrower than the reference.
                if (rect.parent is RectTransform host && !explicitAnchors)
                {
                    var room = host.rect.size;
                    if (Mathf.Approximately(left, 0f) && Mathf.Approximately(top, 0f)
                        && Mathf.Approximately(right, room.x)
                        && Mathf.Approximately(bottom, room.y))
                    {
                        rect.anchorMin = Vector2.zero;
                        rect.anchorMax = Vector2.one;
                        rect.offsetMin = Vector2.zero;
                        rect.offsetMax = Vector2.zero;
                        return;
                    }
                }
                rect.offsetMin = new Vector2(left, -bottom);
                rect.offsetMax = new Vector2(right, -top);
            }

            var minSize = ReadVector(node["minSize"]);
            if (!minSize.HasValue) return;

            // A node its parent lays out gets its size from the LayoutElement
            // ApplyLayoutElement adds; writing a rect here as well is at best
            // redundant and at worst a size the group then fights.
            if (rect.parent != null && rect.parent.GetComponent<LayoutGroup>() != null) return;

            // UNDER STRETCH ANCHORS sizeDelta IS NOT A SIZE. It is an offset
            // from the parent's edges, so writing 500 into it means "500 bigger
            // than the parent" — which is how EnemyView's 500px sprite became a
            // 1500px monster bleeding off both sides of the screen: three
            // nested rects each adding 500 to the one above. Collapse the
            // anchors on the axis that is taking a real size, and only where
            // the node is still on the default full stretch, so an explicit
            // anchor or offset from the layout is never overwritten.
            bool positioned = node["offset"] != null;
            var min = rect.anchorMin;
            var max = rect.anchorMax;
            var size = rect.sizeDelta;

            if (minSize.Value.x > 0f)
            {
                if (!positioned && min.x == 0f && max.x == 1f) min.x = max.x = 0.5f;
                size.x = minSize.Value.x;
            }
            if (minSize.Value.y > 0f)
            {
                if (!positioned && min.y == 0f && max.y == 1f) min.y = max.y = 0.5f;
                size.y = minSize.Value.y;
            }

            rect.anchorMin = min;
            rect.anchorMax = max;
            rect.sizeDelta = size;
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
            // The layout's EXPAND size flag is Unity's flexible weight.
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

            // The authored containers stretch their children across the cross
            // axis by default; Unity's do not unless told.
            group.childForceExpandWidth = true;
            group.childForceExpandHeight = false;
            group.childControlWidth = true;
            group.childControlHeight = true;
        }

        /// <summary>
        /// Instantiate the prefab an Instance node referred to.
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
            // An instance can be renamed at its use site, and several are
            // (gameplay's countdown timer bar is "TimerBar"). The screens look
            // their nodes up by name, so the use-site name wins.
            go.name = name;

            var rect = go.GetComponent<RectTransform>();
            if (rect != null) ApplyRect(rect, node);

            // A fixed-size component placed with no coordinates of its own
            // belongs in the MIDDLE of its container, not in the corner.
            //
            // The prefab root keeps the anchors it was authored with, which for
            // EnemyView is a 500x500 box at the top-left — correct inside the
            // component, meaningless at the use site. The gameplay layout gives
            // its EnemyView no anchors and no offset, so the box landed against
            // CombatArea's top-left edge and the creature rendered half off the
            // side of the screen. `production/screenshots/02_gameplay_seeded.png`
            // is what it looked like when it worked: centred, with the ground
            // glow under it.
            //
            // Only for a fixed-size root (anchorMin == anchorMax). A stretched
            // one — VoidBackground — is meant to fill its parent, and giving it
            // a centre anchor would shrink it to nothing.
            if (rect != null
                && node["anchorMin"] == null && node["offset"] == null
                && parent.GetComponent<LayoutGroup>() == null
                && rect.anchorMin == rect.anchorMax)
            {
                rect.anchorMin = rect.anchorMax = new Vector2(0.5f, 0.5f);
                rect.anchoredPosition = Vector2.zero;
                // Centred is not the same as contained. The authored size is
                // fixed and the container is not, so it also has to be told to
                // stay inside one.
                go.AddComponent<VantaEclipse.UI.ClampToParent>();
            }

            // A prefab dropped into a layout group has to declare a size. Its
            // root is a plain RectTransform, which reports no preferred height,
            // so `childControlHeight` gives it ZERO and the whole component
            // vanishes — that is how EnemyView came out 1000x0 inside
            // CombatArea, with the sprite spilling off both edges of a box that
            // was not there. The prefab's own authored rect is the size it was
            // drawn at, so that is what it declares.
            if (rect != null
                && parent.GetComponent<LayoutGroup>() != null
                && go.GetComponent<LayoutGroup>() == null
                && go.GetComponent<LayoutElement>() == null)
            {
                var authored = ((RectTransform)prefab.transform).sizeDelta;
                if (authored.x > 0f || authored.y > 0f)
                {
                    var element = go.AddComponent<LayoutElement>();
                    if (authored.x > 0f) { element.minWidth = authored.x; element.preferredWidth = authored.x; }
                    if (authored.y > 0f) { element.minHeight = authored.y; element.preferredHeight = authored.y; }
                }
            }

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

            // Layout codes: 0 left, 1 center, 2 right (h); 0 top, 1 center, 2 bottom (v).
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
        /// Attach the C# behaviour matching the script the layout node names.
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
