// Ported from scripts/ui/upgrade_shop_panel.gd
using VantaEclipse.Core;

namespace VantaEclipse.UI
{
    /// <summary>
    /// The upgrade shop — a panel that slides up over the bottom half of the
    /// gameplay screen, so the player can keep tapping while browsing.
    ///
    /// Builds one UpgradeRow per definition at load: adding a new upgrade
    /// definition makes it appear here automatically.
    /// </summary>
    public sealed class UpgradeShopPanel : SlidePanel
    {
        protected override string CloseButtonName => "CloseButton";

        /// <summary>The only slide panel that announces: a boss gate can fire
        /// while this one is open, and a manager holding that moment needs to
        /// know the screen is obstructed.</summary>
        protected override bool AnnouncesOverlay => true;

        protected override void OnFirstShow()
        {
            var rows = FindObject("RowsVBox");
            if (rows == null) return;
            foreach (var definition in Game.Upgrades.GetDefinitions())
            {
                var row = UIPrefabs.Spawn<UpgradeRow>(rows.transform);
                row?.Setup(definition);
            }
        }
    }
}
