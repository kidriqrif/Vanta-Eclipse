using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace VantaEclipse.EditorTools
{
    /// <summary>
    /// Android build configuration and entry point.
    ///
    /// Every value here is carried across from the Godot export preset rather
    /// than chosen fresh, because these are the settings a store listing, an
    /// installed app's upgrade path, and the save-file location all depend on.
    /// Changing the package name after release orphans every install; changing
    /// minSdk silently drops devices. They are set in code so a fresh clone or
    /// a reimported ProjectSettings cannot quietly differ from what shipped.
    ///
    ///   Unity.exe -batchmode -nographics -quit \
    ///     -executeMethod VantaEclipse.EditorTools.BuildAndroid.BuildApk
    ///
    /// Append -aab for the Play Store bundle.
    /// </summary>
    public static class BuildAndroid
    {
        // --- carried over from export_presets.cfg ---
        public const string PackageName = "com.kidriqrif.vantaeclipse";
        public const string ProductName = "Vanta Eclipse";
        public const string CompanyName = "Vantrexa Games";
        public const string VersionName = "0.1.0";
        public const int VersionCode = 1;
        public const AndroidSdkVersions MinSdk = AndroidSdkVersions.AndroidApiLevel24;
        public const AndroidSdkVersions TargetSdk = (AndroidSdkVersions)36;

        const string OutputDir = "build";

        [MenuItem("Vanta Eclipse/Configure Android Player Settings")]
        public static void Configure()
        {
            PlayerSettings.companyName = CompanyName;
            PlayerSettings.productName = ProductName;
            PlayerSettings.SetApplicationIdentifier(
                NamedBuildTarget.Android, PackageName);
            PlayerSettings.bundleVersion = VersionName;
            PlayerSettings.Android.bundleVersionCode = VersionCode;

            PlayerSettings.Android.minSdkVersion = MinSdk;
            PlayerSettings.Android.targetSdkVersion = TargetSdk;

            // arm64 only, and IL2CPP because Play requires a 64-bit binary and
            // Mono cannot produce one. This pairing is also what makes the
            // 16 KB page-size requirement satisfiable — the Godot build already
            // met it and the Unity one must not regress.
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;

            // Portrait, locked. The game's entire layout is drawn for it.
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.Portrait;
            PlayerSettings.allowedAutorotateToPortrait = true;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = false;
            PlayerSettings.allowedAutorotateToLandscapeRight = false;

            // Draw behind the cutout rather than letterboxing away from it.
            // SafeAreaFitter is what keeps controls clear of it, and it can
            // only do that if the app is actually given the full display.
            PlayerSettings.Android.renderOutsideSafeArea = true;

            // No splash: the game fades in from black on its own, and Unity's
            // logo splash is only removable on a paid tier anyway — this at
            // least stops a second one being drawn on top.
            PlayerSettings.SplashScreen.show = false;

            PlayerSettings.Android.forceInternetPermission = false;
            PlayerSettings.Android.forceSDCardPermission = false;

            // The colour the window clears to before the first frame, matched
            // to the fade colour so launch reads as one continuous black.
            PlayerSettings.Android.startInFullscreen = true;

            AssetDatabase.SaveAssets();
            Debug.Log($"Android configured: {PackageName} v{VersionName} ({VersionCode}), " +
                      $"minSdk {(int)MinSdk}, targetSdk {(int)TargetSdk}, IL2CPP/ARM64");
        }

        [MenuItem("Vanta Eclipse/Build Android APK")]
        public static void BuildApk() => Build(aab: false);

        [MenuItem("Vanta Eclipse/Build Android AAB")]
        public static void BuildAab() => Build(aab: true);

        static void Build(bool aab)
        {
            Configure();

            foreach (var arg in Environment.GetCommandLineArgs())
                if (arg == "-aab") aab = true;

            EditorUserBuildSettings.buildAppBundle = aab;

            var scenes = EditorBuildSettings.scenes;
            if (scenes == null || scenes.Length == 0)
            {
                Debug.LogError("BuildAndroid: no scenes in Build Settings. " +
                               "Run Vanta Eclipse > Create Bootstrap Scene first.");
                EditorApplication.Exit(1);
                return;
            }

            Directory.CreateDirectory(OutputDir);
            string path = Path.Combine(OutputDir, aab ? "vanta-eclipse.aab" : "vanta-eclipse.apk");

            var options = new BuildPlayerOptions
            {
                scenes = ScenePaths(scenes),
                locationPathName = path,
                target = BuildTarget.Android,
                targetGroup = BuildTargetGroup.Android,
                options = BuildOptions.None,
            };

            var report = BuildPipeline.BuildPlayer(options);
            var summary = report.summary;

            if (summary.result == BuildResult.Succeeded)
            {
                // The file on disk, NOT summary.totalSize — that counts staging
                // artifacts and reported 481 MB for a 27 MB APK, which is the
                // kind of number that starts an afternoon of hunting a bloat
                // problem that does not exist.
                long bytes = new FileInfo(path).Length;
                Debug.Log($"BUILD OK: {path} ({bytes / 1024f / 1024f:F1} MB on disk, " +
                          $"{summary.totalTime.TotalSeconds:F0}s)");
                EditorApplication.Exit(0);
                return;
            }

            Debug.LogError($"BUILD FAILED: {summary.result}, {summary.totalErrors} error(s)");
            EditorApplication.Exit(1);
        }

        static string[] ScenePaths(EditorBuildSettingsScene[] scenes)
        {
            var enabled = new System.Collections.Generic.List<string>();
            foreach (var scene in scenes)
                if (scene.enabled) enabled.Add(scene.path);
            return enabled.ToArray();
        }
    }
}
