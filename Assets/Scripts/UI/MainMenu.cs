// Ported from scripts/ui/main_menu.gd
using UnityEngine;
using VantaEclipse.Core;
using VantaEclipse.Managers;

namespace VantaEclipse.UI
{
    /// <summary>The entry point of the game. Pure UI: it only reads display
    /// data and asks managers to act.</summary>
    public sealed class MainMenu : UIScreen
    {
        void Start()
        {
            SetText("VersionLabel", $"v{GameManager.GameVersion}");

            Bind("PlayButton", () => Game.Flow.ChangeScene(Scenes.Gameplay));
            Bind("SettingsButton", () => Game.Flow.ChangeScene(Scenes.Settings));
            Bind("QuitButton", OnQuitPressed);

            // Google Play guidelines: mobile apps should not offer their own
            // quit button — the OS handles that. So it only appears off mobile.
            if (Application.isMobilePlatform) SetVisible("QuitButton", false);
        }

        static void OnQuitPressed()
        {
            // Save first: Quit() closes immediately, without the pause/quit
            // callbacks GameRuntime would otherwise save from.
            Game.Save.SaveGame();
            Application.Quit();
        }
    }
}
