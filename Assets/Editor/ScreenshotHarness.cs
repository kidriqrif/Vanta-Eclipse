using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using UnityEditor;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace VantaEclipse.EditorTools
{
    /// <summary>
    /// Renders every screen at every Android shape and measures what it drew.
    ///
    /// This is the replacement for the Godot screenshot harness that the port
    /// dropped, and it is the only stage in the sweep that looks at PIXELS.
    /// Everything else compares files to other files: the compile checks types,
    /// check_unity.py checks literals, check_pixels.py checks the palette of
    /// source art. None of them can see a label that renders as a smear, a
    /// panel that runs off a tall screen, or a screen that comes up blank —
    /// and all three of those have shipped here before.
    ///
    ///   Unity.exe -batchmode -projectPath . \
    ///     -executeMethod VantaEclipse.EditorTools.ScreenshotHarness.Run
    ///
    /// NOTE THE MISSING FLAGS. No -nographics: that gives a null graphics
    /// device and every capture comes back empty. No -quit: this thing enters
    /// play mode, which is asynchronous, so the harness calls
    /// EditorApplication.Exit itself once the run is finished — -quit would
    /// close the editor before the first frame.
    ///
    /// WHY PLAY MODE. Screens populate themselves in Awake/Start through
    /// UIScreen's name index, and the 21 spawnable prefabs only exist once
    /// something spawns them. An edit-mode capture renders the converter's
    /// authored layout with placeholder text — useful, and a lie about what a
    /// player sees. Getting into play mode from -executeMethod costs the
    /// SessionState dance below, because entering play mode reloads the domain
    /// and every static in this class dies with it.
    ///
    /// Options:
    ///   -harnessOut &lt;dir&gt;      where PNGs and the report go (default build/screenshots)
    ///   -harnessScenes &lt;csv&gt;   scene names to run (default: all in Build Settings)
    ///   -harnessShapes &lt;csv&gt;   shape names to run (default: all ten)
    /// </summary>
    public static class ScreenshotHarness
    {
        /// <summary>
        /// Ten real Android display shapes. Two of them are 1920 high, and
        /// those two are the pixel-exactness gate: the CanvasScaler matches on
        /// height against a 1080x1920 reference, so the scale factor is exactly
        /// 1 there and nowhere else. See "Text and device pixels" in HANDOFF.md
        /// — the other eight are measured and REPORTED, not failed, because
        /// fractional text scaling is a known open design decision and failing
        /// on it would make this stage red by design.
        /// </summary>
        static readonly (string Name, int Width, int Height)[] AllShapes =
        {
            ("720x1280_9-16",    720, 1280),   // low-end handset
            ("1080x1920_9-16",  1080, 1920),   // reference shape, scale 1
            ("1080x2160_18-9",  1080, 2160),
            ("1080x2280_19-9",  1080, 2280),
            ("1080x2340_19.5-9",1080, 2340),   // the modal Android phone
            ("1080x2400_20-9",  1080, 2400),
            ("1440x2560_16-9",  1440, 2560),
            ("1440x3120_19.5-9",1440, 3120),   // QHD flagship
            ("1200x1920_5-8",   1200, 1920),   // small tablet, scale 1
            ("1600x2560_16-10", 1600, 2560),   // tablet / unfolded foldable
        };

        const string ActiveKey = "VantaEclipse.Harness.Active";
        const string OutKey = "VantaEclipse.Harness.Out";
        const string ScenesKey = "VantaEclipse.Harness.Scenes";
        const string ShapesKey = "VantaEclipse.Harness.Shapes";
        const string StashKey = "VantaEclipse.Harness.Stashed";

        const int SettleFrames = 12;
        const string StashSuffix = ".harness-stash";

        // ---------------------------------------------------------------- entry

        [MenuItem("Vanta Eclipse/Capture All Screens")]
        public static void Run()
        {
            string outDir = Arg("-harnessOut") ?? Path.Combine("build", "screenshots");
            SessionState.SetString(OutKey, outDir);
            SessionState.SetString(ScenesKey, Arg("-harnessScenes") ?? "");
            SessionState.SetString(ShapesKey, Arg("-harnessShapes") ?? "");
            SessionState.SetBool(ActiveKey, true);

            StashSaves();

            Debug.Log($"Harness: entering play mode, output -> {outDir}");
            EditorApplication.EnterPlaymode();
        }

        /// <summary>
        /// Runs after every domain reload, including the one that entering play
        /// mode causes. SessionState is what carries the "a run is in progress"
        /// flag across that reload — statics do not survive it, and EditorPrefs
        /// would outlive the editor and re-arm the harness on the next launch.
        /// </summary>
        [InitializeOnLoadMethod]
        static void Boot()
        {
            if (!SessionState.GetBool(ActiveKey, false)) return;
            EditorApplication.playModeStateChanged += OnPlayModeChanged;
        }

        static void OnPlayModeChanged(PlayModeStateChange change)
        {
            if (change != PlayModeStateChange.EnteredPlayMode) return;
            EditorApplication.playModeStateChanged -= OnPlayModeChanged;

            var host = new GameObject("~ScreenshotHarness");
            UnityEngine.Object.DontDestroyOnLoad(host);
            host.AddComponent<HarnessRunner>();
        }

        static string Arg(string name)
        {
            var args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length - 1; i++)
                if (args[i] == name) return args[i + 1];
            return null;
        }

        // ------------------------------------------------------------ save file

        /// <summary>
        /// Move the real save out of the way for the length of the run.
        ///
        /// The harness runs the actual game for several minutes of wall clock,
        /// so GameRuntime's autosave WILL fire and overwrite whatever is on this
        /// machine. Restoring means restoring BOTH files: SaveManager falls back
        /// to savegame.backup.json when the main file is missing, so moving only
        /// one leaves the other to be loaded as if it were current.
        /// </summary>
        static void StashSaves()
        {
            bool stashed = false;
            foreach (var path in SavePaths())
            {
                if (!File.Exists(path)) continue;
                string stash = path + StashSuffix;
                // A stash already here means a previous run died before
                // restoring. That copy is the real save; never overwrite it.
                if (File.Exists(stash)) { stashed = true; continue; }
                File.Move(path, stash);
                stashed = true;
            }
            SessionState.SetBool(StashKey, stashed);
        }

        internal static void RestoreSaves()
        {
            if (!SessionState.GetBool(StashKey, false)) return;
            foreach (var path in SavePaths())
            {
                string stash = path + StashSuffix;
                if (!File.Exists(stash)) continue;
                if (File.Exists(path)) File.Delete(path);
                File.Move(stash, path);
            }
            SessionState.SetBool(StashKey, false);
        }

        static IEnumerable<string> SavePaths()
        {
            string dir = Application.persistentDataPath;
            yield return Path.Combine(dir, "savegame.json");
            yield return Path.Combine(dir, "savegame.backup.json");
        }

        internal static (string Name, int Width, int Height)[] Shapes()
        {
            string filter = SessionState.GetString(ShapesKey, "");
            if (string.IsNullOrWhiteSpace(filter)) return AllShapes;
            var wanted = new HashSet<string>(filter.Split(','));
            return Array.FindAll(AllShapes, s => wanted.Contains(s.Name));
        }

        internal static List<string> ScenePaths()
        {
            string filter = SessionState.GetString(ScenesKey, "");
            var wanted = string.IsNullOrWhiteSpace(filter)
                ? null : new HashSet<string>(filter.Split(','));

            var paths = new List<string>();
            foreach (var scene in EditorBuildSettings.scenes)
            {
                if (!scene.enabled) continue;
                string name = Path.GetFileNameWithoutExtension(scene.path);
                if (wanted != null && !wanted.Contains(name)) continue;
                paths.Add(scene.path);
            }
            return paths;
        }

        internal static string OutDir() =>
            SessionState.GetString(OutKey, Path.Combine("build", "screenshots"));

        internal static void Finish(int exitCode)
        {
            RestoreSaves();
            SessionState.SetBool(ActiveKey, false);
            EditorApplication.Exit(exitCode);
        }
    }

    /// <summary>
    /// The play-mode half. Loads each screen, captures it at each shape, and
    /// measures the result.
    /// </summary>
    public sealed class HarnessRunner : MonoBehaviour
    {
        readonly List<string> _failures = new();
        readonly StringBuilder _report = new();
        int _captures;

        IEnumerator Start()
        {
            yield return null; // let the bootstrapped managers finish Awake

            int exit = 0;
            string outDir = ScreenshotHarness.OutDir();
            Directory.CreateDirectory(outDir);

            var shapes = ScreenshotHarness.Shapes();
            var scenes = ScreenshotHarness.ScenePaths();
            _report.AppendLine("scene,shape,texts,coverage%,scale,problems");

            foreach (var scenePath in scenes)
            {
                string sceneName = Path.GetFileNameWithoutExtension(scenePath);

                var load = SceneManager.LoadSceneAsync(scenePath, LoadSceneMode.Single);
                while (load != null && !load.isDone) yield return null;
                for (int i = 0; i < 12; i++) yield return null;

                foreach (var shape in shapes)
                {
                    Texture2D shot = null;
                    var problems = new List<string>();
                    float scale = 0f;
                    int texts = 0;
                    float coverage = 0f;
                    string note = null;

                    try
                    {
                        // Measure INSIDE the shape scope. The first version of
                        // this loop restored the canvases before measuring, so
                        // every check ran against the editor's own window size
                        // and reported all 30 elements of two screens as
                        // "outside the frame" — a check that answered a
                        // question nobody asked, which is this project's
                        // signature failure.
                        using (var shape_ = new ShapeContext(shape.Width, shape.Height))
                        {
                            shot = shape_.Render();
                            coverage = Coverage(shot);
                            if (coverage < 0.2f)
                                problems.Add($"screen is effectively blank ({coverage:F2}% off-background)");


                            // A screen is allowed to send the player somewhere
                            // else. MinigameHost does exactly that when nothing
                            // has chosen a board for it, so four of its captures
                            // were mid-transition frames — genuinely empty, and
                            // measured against Arcade's node paths under
                            // MinigameHost's name. A capture of a scene that is
                            // no longer the one under test proves nothing about
                            // either of them.
                            string active = SceneManager.GetActiveScene().name;
                            if (active != sceneName || VantaEclipse.Core.SceneFlow.IsTransitioning)
                            {
                                note = active != sceneName
                                    ? $"navigated to {active}"
                                    : "mid-transition";
                                problems.Clear();
                            }
                            else
                            {
                                Measure(shape, problems, out texts, out scale);
                                MeasureOverlap(problems);
                            }
                        }

                        string file = Path.Combine(outDir, $"{sceneName}__{shape.Name}.png");
                        File.WriteAllBytes(file, shot.EncodeToPNG());
                        _captures++;
                    }
                    catch (Exception e)
                    {
                        problems.Add($"threw: {e.GetType().Name}: {e.Message}");
                    }
                    finally
                    {
                        // Immediate, not deferred: these are up to 18 MB each
                        // and 110 of them queued to the end of frame is a
                        // memory profile nobody wants to debug.
                        if (shot != null) DestroyImmediate(shot);
                    }

                    foreach (var problem in problems)
                        _failures.Add($"{sceneName} @ {shape.Name}: {problem}");

                    _report.AppendLine(string.Join(",", sceneName, shape.Name,
                        texts.ToString(CultureInfo.InvariantCulture),
                        coverage.ToString("F2", CultureInfo.InvariantCulture),
                        scale.ToString("F4", CultureInfo.InvariantCulture),
                        // Quoted: the problem strings carry commas of their own.
                        "\"" + (problems.Count > 0 ? string.Join(" | ", problems) : note ?? "-") + "\""));

                    yield return null;
                }
            }

            File.WriteAllText(Path.Combine(outDir, "report.csv"), _report.ToString());

            Debug.Log($"Harness: {_captures} captures, {_failures.Count} problems -> {outDir}");
            foreach (var failure in _failures) Debug.Log($"  HARNESS-FAIL {failure}");
            if (_failures.Count > 0)
            {
                Debug.LogError($"Harness: {_failures.Count} problems across {_captures} captures.");
                exit = 1;
            }

            ScreenshotHarness.Finish(exit);
        }

        // -------------------------------------------------------------- capture

        /// <summary>
        /// Render the live scene at an arbitrary shape.
        ///
        /// Screen.SetResolution does nothing in the editor, so the shape cannot
        /// be simulated by resizing anything — it has to come from the target
        /// texture. A ScreenSpaceOverlay canvas is drawn straight to the
        /// backbuffer and is invisible to Camera.Render(), so each canvas is
        /// switched to ScreenSpaceCamera for the duration; that is also what
        /// makes CanvasScaler size itself off THIS shape rather than off the
        /// editor's real display, which is the entire point of the exercise.
        /// </summary>
        sealed class ShapeContext : IDisposable
        {
            readonly List<(Canvas Canvas, RenderMode Mode, Camera Cam, float Plane)> _restore = new();
            readonly GameObject _camGo;
            readonly Camera _cam;
            readonly RenderTexture _rt;
            readonly int _width, _height;

            public ShapeContext(int width, int height)
            {
                _width = width;
                _height = height;
                _rt = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32) { antiAliasing = 1 };
                _camGo = new GameObject("~harnessCam", typeof(Camera));
                _cam = _camGo.GetComponent<Camera>();
                _cam.clearFlags = CameraClearFlags.SolidColor;
                _cam.backgroundColor = Camera.main != null ? Camera.main.backgroundColor : Color.black;
                _cam.orthographic = true;
                // 1 canvas unit == 1 device pixel. With the default ortho size
                // the canvas picks up a fractional scale and every glyph lands
                // off-grid.
                _cam.orthographicSize = height / 2f;
                _cam.nearClipPlane = 0.1f;
                _cam.farClipPlane = 100f;
                _cam.targetTexture = _rt;

                foreach (var canvas in UnityEngine.Object.FindObjectsByType<Canvas>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
                {
                    if (canvas.renderMode != RenderMode.ScreenSpaceOverlay) continue;
                    _restore.Add((canvas, canvas.renderMode, canvas.worldCamera, canvas.planeDistance));
                    canvas.renderMode = RenderMode.ScreenSpaceCamera;
                    canvas.worldCamera = _cam;
                    canvas.planeDistance = 1f;
                }

                // The scaler caches its factor; toggling forces it to recompute
                // against the camera we just gave the canvas.
                foreach (var scaler in UnityEngine.Object.FindObjectsByType<CanvasScaler>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
                {
                    scaler.enabled = false;
                    scaler.enabled = true;
                }
                // One ForceUpdateCanvases is not enough. Nested layout groups
                // settle one level per rebuild, so the first shape of every
                // scene measured a half-built layout and reported twenty
                // elements of SettingsMenu as off-screen that were fine at the
                // other nine shapes. Rebuild each root explicitly, then flush.
                Canvas.ForceUpdateCanvases();
                foreach (var canvas in UnityEngine.Object.FindObjectsByType<Canvas>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
                {
                    if (canvas.transform.parent != null) continue;
                    if (canvas.transform is RectTransform root)
                        LayoutRebuilder.ForceRebuildLayoutImmediate(root);
                }
                Canvas.ForceUpdateCanvases();
            }

            public Texture2D Render()
            {
                _cam.Render();
                var previous = RenderTexture.active;
                RenderTexture.active = _rt;
                var shot = new Texture2D(_width, _height, TextureFormat.RGBA32, false);
                shot.ReadPixels(new Rect(0, 0, _width, _height), 0, 0);
                shot.Apply();
                RenderTexture.active = previous;
                return shot;
            }

            public void Dispose()
            {
                foreach (var (canvas, mode, worldCam, plane) in _restore)
                {
                    if (canvas == null) continue;
                    canvas.renderMode = mode;
                    canvas.worldCamera = worldCam;
                    canvas.planeDistance = plane;
                }
                // Camera first, then the texture it points at. Deferred Destroy
                // would leave a live camera holding a released RenderTexture for
                // a frame, which logs an error per capture and hides the real
                // ones.
                UnityEngine.Object.DestroyImmediate(_camGo);
                _rt.Release();
                UnityEngine.Object.DestroyImmediate(_rt);
                Canvas.ForceUpdateCanvases();
            }
        }

        /// <summary>
        /// Percentage of the frame that is not the single most common colour.
        ///
        /// Deliberately NOT "percentage that is not black". The palette's void
        /// is (8,8,12), so a "non-black" count reports 100% for a frame that is
        /// nothing but background — which is exactly the shape of check this
        /// project keeps getting burned by. The modal colour IS the background,
        /// whatever it happens to be.
        /// </summary>
        static float Coverage(Texture2D shot)
        {
            var pixels = shot.GetPixels32();
            var counts = new Dictionary<uint, int>();
            const int step = 4;
            int sampled = 0;
            for (int i = 0; i < pixels.Length; i += step)
            {
                var p = pixels[i];
                uint key = (uint)(p.r << 16 | p.g << 8 | p.b);
                counts.TryGetValue(key, out int n);
                counts[key] = n + 1;
                sampled++;
            }
            int modal = 0;
            foreach (var count in counts.Values) if (count > modal) modal = count;
            return sampled == 0 ? 0f : (sampled - modal) * 100f / sampled;
        }

        // -------------------------------------------------------------- measure

        void Measure((string Name, int Width, int Height) shape, List<string> problems,
                     out int textCount, out float scaleFactor)
        {
            textCount = 0;
            scaleFactor = 0f;

            var canvases = FindObjectsByType<Canvas>(FindObjectsInactive.Exclude, FindObjectsSortMode.None);
            foreach (var canvas in canvases)
            {
                if (canvas.transform.parent != null) continue;   // nested canvases share the root's factor
                scaleFactor = canvas.scaleFactor;
            }

            foreach (var text in FindObjectsByType<Text>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
            {
                if (!text.isActiveAndEnabled || string.IsNullOrEmpty(text.text)) continue;
                textCount++;

                // The face is authored at 9px and the theme uses 9x{2,3,6}. A
                // size that is not a whole multiple resamples, and resampling is
                // what pixel art exists to avoid.
                if (text.fontSize % 9 != 0)
                    problems.Add($"'{Name(text)}' fontSize {text.fontSize} is not a multiple of 9");

                // Device pixels. Only gated where the scale factor is exactly 1,
                // i.e. the 1920-high shapes; elsewhere fractional scaling is the
                // documented open decision, not a regression.
                if (shape.Height == 1920)
                {
                    float glyphScale = text.fontSize / 9f * scaleFactor;
                    if (Mathf.Abs(glyphScale - Mathf.Round(glyphScale)) > 1e-4f)
                        problems.Add($"'{Name(text)}' renders at {glyphScale:F3}x — not a whole glyph box");
                }

                var rect = text.rectTransform.rect;
                if (text.horizontalOverflow == HorizontalWrapMode.Overflow
                    && text.preferredWidth > rect.width + 1f)
                    problems.Add($"'{Name(text)}' overflows its box horizontally " +
                                 $"({text.preferredWidth:F0} > {rect.width:F0})");
                if (text.verticalOverflow == VerticalWrapMode.Truncate
                    && text.preferredHeight > rect.height + 1f)
                    problems.Add($"'{Name(text)}' is vertically truncated " +
                                 $"({text.preferredHeight:F0} > {rect.height:F0})");
            }

            // Anything drawn outside the frame. Masked content is excluded:
            // a scroll view's job is to have children outside its own rect.
            foreach (var graphic in FindObjectsByType<Graphic>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
            {
                if (!graphic.isActiveAndEnabled) continue;
                if (graphic.canvas == null) continue;
                if (IsMasked(graphic.transform)) continue;

                var corners = new Vector3[4];
                graphic.rectTransform.GetWorldCorners(corners);
                var canvasRect = graphic.canvas.transform as RectTransform;
                if (canvasRect == null) continue;

                foreach (var corner in corners)
                {
                    var local = canvasRect.InverseTransformPoint(corner);
                    if (canvasRect.rect.Contains(new Vector2(local.x, local.y))) continue;
                    float outX = Mathf.Max(0f, Mathf.Abs(local.x) - canvasRect.rect.width / 2f);
                    float outY = Mathf.Max(0f, Mathf.Abs(local.y) - canvasRect.rect.height / 2f);
                    if (outX > 1f || outY > 1f)
                    {
                        problems.Add($"'{Name(graphic)}' is {Mathf.Max(outX, outY):F0}px outside the frame");
                        break;
                    }
                }
            }
        }

        /// <summary>
        /// Rows of a layout group must not sit on top of each other.
        ///
        /// Added because the overflow check above MISSED a screen that was
        /// obviously broken on sight: SettingsMenu's AUDIO, GAME and ABOUT rows
        /// all render at the same y, overlapping into an unreadable stack. They
        /// were flagged only at the one shape narrow enough to push them off the
        /// right edge — at every other shape the harness said OK while the
        /// screenshot said otherwise. An overlap is not an overflow and needed
        /// its own check.
        /// </summary>
        void MeasureOverlap(List<string> problems)
        {
            foreach (var group in FindObjectsByType<LayoutGroup>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
            {
                if (!group.isActiveAndEnabled) continue;
                var rows = new List<(RectTransform Rect, Rect Box)>();
                foreach (Transform child in group.transform)
                {
                    if (!child.gameObject.activeInHierarchy) continue;
                    if (child is not RectTransform rect) continue;
                    // A child the group is told to ignore is decoration sitting
                    // behind the row on purpose — a frame's Fill is the whole
                    // point of the pattern. Counting it as an overlapping row
                    // reported every bordered tile in Gear as broken.
                    var ignored = child.GetComponent<LayoutElement>();
                    if (ignored != null && ignored.ignoreLayout) continue;

                    // A row collapsed to nothing is the SettingsMenu defect
                    // itself: the group ran, produced zero-height children, and
                    // every label drew on top of the next. Skipping these as
                    // "no rect to compare" is how the first version of this
                    // check missed the screen it was written for.
                    if (rect.rect.height <= 1f && ActiveChildren(rect) > 0)
                    {
                        problems.Add($"'{Name(group)}' row '{rect.name}' collapsed to " +
                                     $"{rect.rect.width:F0}x{rect.rect.height:F0}");
                        continue;
                    }
                    if (rect.rect.width <= 0f || rect.rect.height <= 0f) continue;

                    var corners = new Vector3[4];
                    rect.GetWorldCorners(corners);
                    rows.Add((rect, Rect.MinMaxRect(corners[0].x, corners[0].y, corners[2].x, corners[2].y)));
                }

                for (int i = 0; i < rows.Count; i++)
                for (int j = i + 1; j < rows.Count; j++)
                {
                    var a = rows[i].Box;
                    var b = rows[j].Box;
                    float overlapX = Mathf.Min(a.xMax, b.xMax) - Mathf.Max(a.xMin, b.xMin);
                    float overlapY = Mathf.Min(a.yMax, b.yMax) - Mathf.Max(a.yMin, b.yMin);
                    // A quarter of the smaller row. Adjacent rows routinely
                    // bleed 4-7px into each other where a glyph box is taller
                    // than its ink, and failing on that is noise, not a defect.
                    float limitY = Mathf.Min(a.height, b.height) * 0.25f;
                    float limitX = Mathf.Min(a.width, b.width) * 0.25f;
                    if (overlapX > limitX && overlapY > limitY)
                    {
                        problems.Add($"'{Name(group)}' rows overlap: " +
                                     $"'{rows[i].Rect.name}' and '{rows[j].Rect.name}' " +
                                     $"share {overlapY:F0}px");
                        i = rows.Count; // one report per group is enough
                        break;
                    }
                }
            }
        }

        /// <summary>
        /// A container with nothing switched on inside it is SUPPOSED to be
        /// zero tall. The Shop's tab row is the case: with stub providers there
        /// is no paid tab, so the row has children in the hierarchy and none of
        /// them active, and collapsing is the correct behaviour rather than the
        /// defect this check hunts.
        /// </summary>
        static int ActiveChildren(Transform node)
        {
            int n = 0;
            foreach (Transform child in node)
                if (child.gameObject.activeInHierarchy) n++;
            return n;
        }

        static bool IsMasked(Transform node)
        {
            for (var t = node; t != null; t = t.parent)
                if (t.GetComponent<Mask>() != null || t.GetComponent<RectMask2D>() != null)
                    return true;
            return false;
        }

        static string Name(Component component)
        {
            var t = component.transform;
            string path = t.name;
            for (var p = t.parent; p != null && p.parent != null; p = p.parent)
                path = p.name + "/" + path;
            return path;
        }
    }
}
