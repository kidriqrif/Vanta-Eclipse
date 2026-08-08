using UnityEngine;

namespace VantaEclipse.Core
{
    /// <summary>
    /// Duration-accurate vibration on Android.
    ///
    /// Godot's Input.vibrate_handheld(ms) honours the duration. Unity's
    /// Handheld.Vibrate() does not — it ignores its argument entirely and
    /// fires the ~500ms system buzz, which is far too long for a tap in a game
    /// built around tapping. So the port goes through the Android Vibrator
    /// service directly, which is what Godot does under the hood.
    /// </summary>
    public static class AndroidHaptics
    {
#if UNITY_ANDROID && !UNITY_EDITOR
        static AndroidJavaObject _vibrator;
        static bool _resolved;

        static AndroidJavaObject Vibrator
        {
            get
            {
                if (_resolved) return _vibrator;
                _resolved = true;
                try
                {
                    using var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                    using var activity = player.GetStatic<AndroidJavaObject>("currentActivity");
                    _vibrator = activity.Call<AndroidJavaObject>("getSystemService", "vibrator");
                }
                catch (System.Exception e)
                {
                    Debug.LogWarning($"AndroidHaptics: no vibrator service ({e.Message})");
                    _vibrator = null;
                }
                return _vibrator;
            }
        }
#endif

        public static void Vibrate(int durationMs)
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            var vibrator = Vibrator;
            if (vibrator == null) return;
            try
            {
                // VibrationEffect landed in API 26; minSdk here is 24, so the
                // deprecated vibrate(long) is still the fallback path.
                if (AndroidVersion >= 26)
                {
                    using var effectClass = new AndroidJavaClass("android.os.VibrationEffect");
                    // -1 is DEFAULT_AMPLITUDE.
                    using var effect = effectClass.CallStatic<AndroidJavaObject>(
                        "createOneShot", (long)durationMs, -1);
                    vibrator.Call("vibrate", effect);
                }
                else
                {
                    vibrator.Call("vibrate", (long)durationMs);
                }
            }
            catch (System.Exception e)
            {
                Debug.LogWarning($"AndroidHaptics: vibrate failed ({e.Message})");
            }
#endif
        }

#if UNITY_ANDROID && !UNITY_EDITOR
        static int _sdk = -1;
        static int AndroidVersion
        {
            get
            {
                if (_sdk >= 0) return _sdk;
                using var version = new AndroidJavaClass("android.os.Build$VERSION");
                _sdk = version.GetStatic<int>("SDK_INT");
                return _sdk;
            }
        }
#endif
    }
}
