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
    /// Every value here is pinned rather than left to the inspector, because
    /// these are the settings a store listing, an
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
        /// <summary>
        /// 26, not the 24 this constant asks for. GameActivity —
        /// which androidApplicationEntry selects and which libgame.so exists
        /// for — has an API 26 floor, so Unity raised it silently: every APK
        /// built since the port declares minSdkVersion 26 while this constant,
        /// ProjectSettings and the release checklist all said 24. Stating 26
        /// here makes the file agree with the artifact. The cost is Android 7.x
        /// and below, which the build had already dropped without saying so.
        /// </summary>
        public const AndroidSdkVersions MinSdk = AndroidSdkVersions.AndroidApiLevel26;
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
            // 16 KB page-size requirement satisfiable, which every shipped
            // artifact is checked against in tools/build_android.sh.
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

            ConfigureIcons();

            AssetDatabase.SaveAssets();
            Debug.Log($"Android configured: {PackageName} v{VersionName} ({VersionCode}), " +
                      $"minSdk {(int)MinSdk}, targetSdk {(int)TargetSdk}, IL2CPP/ARM64");
        }

        /// <summary>
        /// Point the launcher at the generated icons.
        ///
        /// Unity reads launcher icons from PlayerSettings, and a project that
        /// never sets them ships the default
        /// Unity logo — which is not a cosmetic gap, because Play rejects a
        /// listing whose launcher icon does not match the store icon.
        ///
        /// The adaptive pair is the one Android actually draws on API 26+; the
        /// legacy 192 is the fallback for older launchers and is what Unity uses
        /// for the round variant.
        /// </summary>
        static void ConfigureIcons()
        {
            var launcher = LoadIcon("Assets/Icons/launcher_192.png");
            var foreground = LoadIcon("Assets/Icons/adaptive_foreground_432.png");
            var background = LoadIcon("Assets/Icons/adaptive_background_432.png");
            if (launcher == null) return;

            // The kinds are discovered rather than named. The concrete enum
            // lives in the Android editor extension, which is only referenced
            // when that module is installed — naming it directly makes this
            // file fail to COMPILE on a machine without Android Build Support,
            // taking every other editor tool down with it.
            foreach (var kind in PlayerSettings.GetSupportedIconKinds(NamedBuildTarget.Android))
            {
                var icons = PlayerSettings.GetPlatformIcons(NamedBuildTarget.Android, kind);
                if (icons == null || icons.Length == 0) continue;

                foreach (var icon in icons)
                {
                    switch (kind.ToString())
                    {
                        // Adaptive is a two-layer icon: layer 0 is the
                        // background, layer 1 the foreground. Android slides
                        // them against each other during parallax, which is why
                        // the background must be fully opaque.
                        case "Adaptive":
                            if (background != null) icon.SetTexture(background, 0);
                            if (foreground != null) icon.SetTexture(foreground, 1);
                            break;
                        // Round and Legacy are single-layer fallbacks for
                        // launchers older than API 26.
                        case "Round":
                        case "Legacy":
                            icon.SetTexture(launcher, 0);
                            break;
                    }
                }
                PlayerSettings.SetPlatformIcons(NamedBuildTarget.Android, kind, icons);
            }
        }

        /// <summary>An icon must import as an uncompressed, point-filtered,
        /// full-alpha texture: the pixel art is authored at 32px and scaled, and
        /// a compressed mip chain turns the silhouette to mush at launcher
        /// size.</summary>
        static Texture2D LoadIcon(string path)
        {
            var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            if (texture == null)
            {
                Debug.LogWarning($"BuildAndroid: no icon at {path} — " +
                                 "run `python tools/make_icons.py`.");
                return null;
            }
            if (AssetImporter.GetAtPath(path) is TextureImporter importer
                && (importer.textureCompression != TextureImporterCompression.Uncompressed
                    || importer.filterMode != FilterMode.Point))
            {
                importer.textureType = TextureImporterType.Default;
                importer.filterMode = FilterMode.Point;
                importer.mipmapEnabled = false;
                importer.alphaIsTransparency = true;
                importer.textureCompression = TextureImporterCompression.Uncompressed;
                importer.SaveAndReimport();
                texture = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            }
            return texture;
        }

        [MenuItem("Vanta Eclipse/Build Android APK")]
        public static void BuildApk() => Build(aab: false);

        [MenuItem("Vanta Eclipse/Build Android AAB")]
        public static void BuildAab() => Build(aab: true);

        /// <summary>
        /// Point the build at the upload keystore.
        ///
        /// UNITY DOES NOT PARSE THESE ARGUMENTS. tools/build_android.sh has
        /// passed -keystorePath/-keystorePass/-keyaliasName/-keyaliasPass since
        /// the port, and a comment there claimed Unity read them "through the
        /// documented CLI arguments". It does not: the literals do not appear
        /// anywhere in Unity.exe, UnityEditor.dll or the Android extension in
        /// 6000.5.7f1. They were accepted, ignored, and every "release" AAB
        /// would have gone out signed with Unity's DEBUG key — which Play
        /// rejects outright. This method is what makes them real.
        ///
        /// The password is preferred as a FILE PATH (-keystorePassFile), not a
        /// value: an argument is visible in the process list to every other
        /// process on the machine for the whole 10-minute IL2CPP build.
        /// </summary>
        static void ApplySigning()
        {
            string keystore = Arg("-keystorePath");
            if (string.IsNullOrEmpty(keystore))
            {
                PlayerSettings.Android.useCustomKeystore = false;
                Debug.LogWarning(
                    "BuildAndroid: no -keystorePath. This artifact will be signed with " +
                    "Unity's DEBUG key and Play will reject it. Fine for a device test, " +
                    "never for an upload.");
                return;
            }

            string pass = ReadSecret("-keystorePassFile", "-keystorePass");
            string alias = Arg("-keyaliasName") ?? "upload";
            string aliasPass = ReadSecret("-keyaliasPassFile", "-keyaliasPass") ?? pass;

            if (!File.Exists(keystore))
                throw new BuildFailedException($"BuildAndroid: no keystore at {keystore}");
            if (string.IsNullOrEmpty(pass))
                throw new BuildFailedException(
                    "BuildAndroid: -keystorePath given without a password. Pass " +
                    "-keystorePassFile <path> (preferred) or -keystorePass <value>.");

            PlayerSettings.Android.useCustomKeystore = true;
            PlayerSettings.Android.keystoreName = keystore;
            PlayerSettings.Android.keystorePass = pass;
            PlayerSettings.Android.keyaliasName = alias;
            PlayerSettings.Android.keyaliasPass = aliasPass;
            Debug.Log($"BuildAndroid: signing with {Path.GetFileName(keystore)}, alias '{alias}'.");
        }

        /// <summary>
        /// Put the signing fields back to empty.
        ///
        /// ProjectSettings.asset is TRACKED and the Stop hook pushes to a public
        /// remote every turn. Unity persists PlayerSettings when the editor
        /// exits, so a password left in these fields is a password committed.
        /// This runs in a finally for that reason and no other.
        /// </summary>
        static void ClearSigning()
        {
            PlayerSettings.Android.useCustomKeystore = false;
            PlayerSettings.Android.keystoreName = "";
            PlayerSettings.Android.keystorePass = "";
            PlayerSettings.Android.keyaliasName = "";
            PlayerSettings.Android.keyaliasPass = "";
        }

        static string Arg(string name)
        {
            var args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length - 1; i++)
                if (args[i] == name) return args[i + 1];
            return null;
        }

        static string ReadSecret(string fileArg, string valueArg)
        {
            string path = Arg(fileArg);
            if (!string.IsNullOrEmpty(path))
            {
                if (!File.Exists(path))
                    throw new BuildFailedException($"BuildAndroid: no password file at {path}");
                return File.ReadAllText(path).Trim();
            }
            return Arg(valueArg);
        }

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
                               "Run Vanta Eclipse > Build Screens From Ported Layouts first.");
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

            BuildReport report;
            try
            {
                ApplySigning();
                report = BuildPipeline.BuildPlayer(options);
            }
            finally
            {
                ClearSigning();
            }
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
