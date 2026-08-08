// Ported from scripts/ui/settings_menu.gd
using System;
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;
using VantaEclipse.Managers;

namespace VantaEclipse.UI
{
    /// <summary>Audio sliders, haptics toggle, manual save, and the
    /// about/privacy block. Pure UI: all real work happens in SettingsManager
    /// and SaveManager.</summary>
    public sealed class SettingsMenu : UIScreen
    {
        /// <summary>Play requires a reachable privacy policy for the listing,
        /// and expects the app itself to be able to reach it. Served by GitHub
        /// Pages out of docs/ in this repository, so the page and the app
        /// version it describes are committed together and cannot drift.</summary>
        public const string PrivacyUrl =
            "https://kidriqrif.github.io/Vanta-Eclipse/privacy-policy.html";

        Text _lastSaveLabel;

        void Start()
        {
            var master = Find<Slider>("MasterSlider");
            var music = Find<Slider>("MusicSlider");
            var sfx = Find<Slider>("SfxSlider");
            var haptics = Find<Toggle>("HapticsToggle");
            _lastSaveLabel = Find<Text>("LastSaveLabel");

            // Show the current values FIRST, then subscribe — otherwise setting
            // .value here would immediately re-trigger the handlers for nothing.
            if (master != null) { master.maxValue = 100f; master.value = Game.Settings.MasterVolume * 100f; }
            if (music != null) { music.maxValue = 100f; music.value = Game.Settings.MusicVolume * 100f; }
            if (sfx != null) { sfx.maxValue = 100f; sfx.value = Game.Settings.SfxVolume * 100f; }
            if (haptics != null) haptics.isOn = Game.Settings.HapticsEnabled;

            master?.onValueChanged.AddListener(v => Game.Settings.MasterVolume = v / 100f);
            music?.onValueChanged.AddListener(v => Game.Settings.MusicVolume = v / 100f);
            sfx?.onValueChanged.AddListener(v => Game.Settings.SfxVolume = v / 100f);
            haptics?.onValueChanged.AddListener(on => Game.Settings.HapticsEnabled = on);

            Bind("SaveGameButton", () => Game.Save.SaveGame());
            Bind("PrivacyButton", OnPrivacyPressed);
            Bind("BackButton", () => Game.Flow.ChangeScene(Scenes.MainMenu));

            SetText("VersionLabel", $"Vanta Eclipse {GameManager.GameVersion}");

            Game.Events.GameSaved += OnGameSaved;
            UpdateLastSaveLabel();
        }

        void OnDestroy()
        {
            if (Game.IsBooted) Game.Events.GameSaved -= OnGameSaved;
        }

        /// <summary>Hands the URL to the system browser. The only outbound call
        /// the game makes — and it is the OS opening a page, not the game
        /// fetching anything, so the "this app makes no network requests" claim
        /// in that very policy holds.</summary>
        static void OnPrivacyPressed() => Application.OpenURL(PrivacyUrl);

        void OnGameSaved(bool success)
        {
            if (success) UpdateLastSaveLabel();
            else if (_lastSaveLabel != null)
                _lastSaveLabel.text = "Save failed — check device storage.";
        }

        void UpdateLastSaveLabel()
        {
            if (_lastSaveLabel == null) return;

            long savedAt = Game.Save.LastSaveUnix;
            if (savedAt <= 0)
            {
                _lastSaveLabel.text = "Not saved yet this session.";
                return;
            }

            long ago = DateTimeOffset.UtcNow.ToUnixTimeSeconds() - savedAt;
            if (ago < 5) _lastSaveLabel.text = "Last saved: just now";
            else if (ago < 60) _lastSaveLabel.text = $"Last saved: {Plural(ago, "second")} ago";
            else if (ago < 3600) _lastSaveLabel.text = $"Last saved: {Plural(ago / 60, "minute")} ago";
            else _lastSaveLabel.text = $"Last saved: {Plural(ago / 3600, "hour")} ago";
        }

        /// <summary>"1 hour" / "2 hours". Every branch above hits the singular
        /// case for a full unit each time (the first minute after a save, the
        /// first hour, and so on), so "1 hours ago" was on screen more often
        /// than not.</summary>
        static string Plural(long count, string noun)
            => $"{count} {(count == 1 ? noun : noun + "s")}";
    }
}
