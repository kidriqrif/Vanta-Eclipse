// Ported from scripts/managers/settings_manager.gd
using UnityEngine;
using UnityEngine.Audio;
// AndroidHaptics is referenced only inside a UNITY_ANDROID && !UNITY_EDITOR
// block, so a missing using here compiles fine in the editor and fails the
// device build — which is exactly what it did.
using VantaEclipse.Core;

namespace VantaEclipse.Managers
{
    /// <summary>
    /// Loads, applies, and persists player settings.
    ///
    /// Settings live in PlayerPrefs, deliberately separate from the gameplay
    /// save file: volume preferences must survive prestige resets, save
    /// deletion, and save-format migrations. That was the reason the Godot
    /// version used its own ConfigFile, and PlayerPrefs is the Unity construct
    /// with the same property.
    ///
    /// Every property applies on write, so setting MusicVolume immediately
    /// updates the mixer and schedules a disk write.
    /// </summary>
    public sealed class SettingsManager
    {
        const string KeyMaster = "audio.master_volume";
        const string KeyMusic = "audio.music_volume";
        const string KeySfx = "audio.sfx_volume";
        const string KeyHaptics = "gameplay.haptics_enabled";

        /// <summary>Exposed AudioMixer parameters. Must match the names
        /// exposed on the mixer asset exactly — the Unity equivalent of the
        /// bus names in default_bus_layout.tres.</summary>
        const string ParamMaster = "MasterVolume";
        const string ParamMusic = "MusicVolume";
        const string ParamSfx = "SFXVolume";

        /// <summary>How long after the last change we wait before writing.
        /// Prevents hammering storage while the player drags a slider.</summary>
        const float SaveDebounceSeconds = 0.5f;

        /// <summary>Assigned by the audio bootstrap once the mixer asset
        /// exists. Null-safe: settings still work without it, they just do not
        /// reach the mixer.</summary>
        public static AudioMixer Mixer;

        float _master = 1f;
        float _music = 0.8f;
        float _sfx = 0.8f;
        bool _haptics = true;
        bool _writePending;
        float _writeDueAt;

        // Volumes are stored as linear values from 0 (silent) to 1 (full).
        public float MasterVolume
        {
            get => _master;
            set { _master = Mathf.Clamp01(value); ApplyBusVolume(ParamMaster, _master); QueueSave(); }
        }

        public float MusicVolume
        {
            get => _music;
            set { _music = Mathf.Clamp01(value); ApplyBusVolume(ParamMusic, _music); QueueSave(); }
        }

        public float SfxVolume
        {
            get => _sfx;
            set { _sfx = Mathf.Clamp01(value); ApplyBusVolume(ParamSfx, _sfx); QueueSave(); }
        }

        /// <summary>Whether the phone should vibrate on important game events
        /// (mobile only).</summary>
        public bool HapticsEnabled
        {
            get => _haptics;
            set { _haptics = value; QueueSave(); }
        }

        public SettingsManager() => LoadFromDisk();

        // --- Public helpers ------------------------------------------------

        /// <summary>Vibrate the device, respecting the player's setting. Safe
        /// on any platform — it does nothing off mobile.</summary>
        public void Vibrate(int durationMs)
        {
            if (!_haptics) return;
#if UNITY_ANDROID && !UNITY_EDITOR
            // Unity's Handheld.Vibrate() ignores the duration and always
            // fires the ~500ms system buzz, which is far too long for a tap.
            // The real duration needs the Android Vibrator service.
            AndroidHaptics.Vibrate(durationMs);
#endif
        }

        /// <summary>Write now if a debounced write is outstanding. Called when
        /// the app closes or is backgrounded.</summary>
        public void FlushPendingWrite()
        {
            if (!_writePending) return;
            WriteToDisk();
        }

        /// <summary>Driven by GameRuntime; runs the debounce.</summary>
        public void Tick(float unscaledDeltaTime)
        {
            if (!_writePending) return;
            _writeDueAt -= unscaledDeltaTime;
            if (_writeDueAt <= 0f) WriteToDisk();
        }

        // --- Internals -----------------------------------------------------

        void ApplyBusVolume(string parameter, float linear)
        {
            if (Mixer == null) return;
            // A linear 0 is negative infinity in dB, so fully-off is clamped to
            // the mixer's floor rather than fed a non-finite value.
            float db = linear <= 0.0001f ? -80f : Mathf.Log10(linear) * 20f;
            if (!Mixer.SetFloat(parameter, db))
                Debug.LogWarning($"SettingsManager: mixer parameter not exposed: {parameter}");
        }

        void QueueSave()
        {
            _writePending = true;
            _writeDueAt = SaveDebounceSeconds;
        }

        void WriteToDisk()
        {
            _writePending = false;
            PlayerPrefs.SetFloat(KeyMaster, _master);
            PlayerPrefs.SetFloat(KeyMusic, _music);
            PlayerPrefs.SetFloat(KeySfx, _sfx);
            PlayerPrefs.SetInt(KeyHaptics, _haptics ? 1 : 0);
            PlayerPrefs.Save();
        }

        void LoadFromDisk()
        {
            _master = PlayerPrefs.GetFloat(KeyMaster, 1f);
            _music = PlayerPrefs.GetFloat(KeyMusic, 0.8f);
            _sfx = PlayerPrefs.GetFloat(KeySfx, 0.8f);
            _haptics = PlayerPrefs.GetInt(KeyHaptics, 1) != 0;

            ApplyBusVolume(ParamMaster, _master);
            ApplyBusVolume(ParamMusic, _music);
            ApplyBusVolume(ParamSfx, _sfx);

            // Loading is not a player change — do not let it queue a write.
            _writePending = false;
        }
    }
}
