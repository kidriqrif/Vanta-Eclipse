using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.UI;

namespace VantaEclipse.EditorTools
{
    /// <summary>
    /// Builds a minimal but REAL gameplay scene.
    ///
    /// Its job is to answer a question no amount of editor-side testing can:
    /// does the ported manager layer actually run on an Android device. So it
    /// is deliberately not a "hello world" — it taps CombatManager, spends the
    /// essence that produces through CurrencyManager, and renders what comes
    /// back over the EventBus. If this scene works on hardware, the port works.
    ///
    /// It is scaffolding. The 32 real screens get rebuilt against the .tscn
    /// layouts; this one exists so the build pipeline can be proven before any
    /// of that, and so there is something to install and hold.
    /// </summary>
    public static class CreateBootstrapScene
    {
        const string ScenePath = "Assets/Scenes/Bootstrap.unity";

        /// <summary>The portrait canvas the whole game is laid out against —
        /// the same 1080x1920 the Godot project used.</summary>
        static readonly Vector2 ReferenceResolution = new(1080f, 1920f);

        [MenuItem("Vanta Eclipse/Create Bootstrap Scene")]
        public static void Create()
        {
            var scene = EditorSceneManager.NewScene(
                NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);

            // The palette's base black, matching SceneFlow.FadeColor so launch
            // and transitions read as one continuous ground.
            var camera = Camera.main;
            if (camera != null)
            {
                camera.clearFlags = CameraClearFlags.SolidColor;
                camera.backgroundColor = new Color(0.016f, 0.016f, 0.02f);
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
            // what must stay intact; extra width becomes margin, which is what
            // SafeAreaFitter's width cap then absorbs on tablets.
            scaler.matchWidthOrHeight = 1f;

            // Content root — everything that must clear the cutout hangs here.
            var content = new GameObject("Content", typeof(RectTransform), typeof(SafeAreaFitter));
            content.transform.SetParent(canvasGo.transform, false);
            Stretch(content.GetComponent<RectTransform>());

            var font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");

            MakeText(content, "Title", "VANTA ECLIPSE", font, 64,
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0f, -160f), 120f,
                new Color(0.929f, 0.929f, 0.941f));

            MakeText(content, "Essence", "ESSENCE 0", font, 44,
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0f, -300f), 90f,
                new Color(0.769f, 0.769f, 0.804f));

            MakeText(content, "Enemy", "—", font, 40,
                new Vector2(0f, 0.5f), new Vector2(1f, 0.5f), new Vector2(0f, 120f), 90f,
                new Color(0.929f, 0.929f, 0.941f));

            MakeText(content, "Hp", "", font, 36,
                new Vector2(0f, 0.5f), new Vector2(1f, 0.5f), new Vector2(0f, 20f), 80f,
                new Color(1f, 0.231f, 0.188f));

            var tap = MakeButton(content, "TapButton", "TAP", font,
                new Vector2(0.5f, 0f), new Vector2(400f, 160f), new Vector2(0f, 260f));

            var driver = content.AddComponent<BootstrapScreen>();
            driver.EssenceLabel = content.transform.Find("Essence").GetComponent<Text>();
            driver.EnemyLabel = content.transform.Find("Enemy").GetComponent<Text>();
            driver.HpLabel = content.transform.Find("Hp").GetComponent<Text>();
            driver.TapButton = tap;

            Directory.CreateDirectory("Assets/Scenes");
            EditorSceneManager.SaveScene(scene, ScenePath);

            // Register it as the only scene in the build.
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };

            Debug.Log($"Bootstrap scene created at {ScenePath} and set as the build scene.");
        }

        // --- construction helpers ------------------------------------------

        static void Stretch(RectTransform rect)
        {
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
        }

        static Text MakeText(GameObject parent, string name, string value, Font font, int size,
            Vector2 anchorMin, Vector2 anchorMax, Vector2 position, float height, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Text));
            go.transform.SetParent(parent.transform, false);

            var rect = go.GetComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = position;
            rect.sizeDelta = new Vector2(0f, height);

            var text = go.GetComponent<Text>();
            text.font = font;
            text.fontSize = size;
            text.text = value;
            text.color = color;
            text.alignment = TextAnchor.MiddleCenter;
            return text;
        }

        static Button MakeButton(GameObject parent, string name, string label, Font font,
            Vector2 anchor, Vector2 size, Vector2 position)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
            go.transform.SetParent(parent.transform, false);

            var rect = go.GetComponent<RectTransform>();
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = new Vector2(0.5f, 0f);
            rect.anchoredPosition = position;
            rect.sizeDelta = size;

            // Flat surface, no radius or gradient — the theme's one rule.
            go.GetComponent<Image>().color = new Color(0.157f, 0.157f, 0.212f);

            var textGo = new GameObject("Label", typeof(RectTransform), typeof(Text));
            textGo.transform.SetParent(go.transform, false);
            Stretch(textGo.GetComponent<RectTransform>());
            var text = textGo.GetComponent<Text>();
            text.font = font;
            text.fontSize = 48;
            text.text = label;
            text.color = new Color(0.929f, 0.929f, 0.941f);
            text.alignment = TextAnchor.MiddleCenter;

            return go.GetComponent<Button>();
        }
    }
}
