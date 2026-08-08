namespace VantaEclipse.Core
{
    /// <summary>
    /// Every screen, by Unity scene name.
    ///
    /// The Godot originals were `res://` paths; Unity's SceneManager addresses
    /// scenes by name (as listed in Build Settings), so these are the bare
    /// names. Managers compare against these constants rather than string
    /// literals — CombatManager and IdleManager both gate behaviour on "is the
    /// gameplay screen current", and a typo there fails silently.
    /// </summary>
    public static class Scenes
    {
        public const string MainMenu = "MainMenu";
        public const string Settings = "SettingsMenu";
        public const string Gameplay = "Gameplay";
        public const string Gear = "Gear";
        public const string Pets = "Pets";
        public const string Cards = "CardCollection";
        public const string Eclipse = "Eclipse";
        public const string Arcade = "Arcade";
        public const string MinigameHost = "MinigameHost";
        public const string Journal = "Journal";
        public const string Shop = "Shop";
    }
}
