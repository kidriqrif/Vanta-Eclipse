# Vanta Eclipse

An incremental dark-fantasy RPG for Android (Google Play), with Steam and iOS planned later.
Built with **Godot 4.7** and **GDScript**.

## Getting started

1. Install [Godot 4.7 Stable](https://godotengine.org/download) (the standard version, not .NET).
2. Clone this repository.
3. Open Godot, click **Import**, and select the `project.godot` file in the repository root.
4. Press **F5** (or the Play button in the top-right corner) to run the game.

The first time you open the project, Godot creates a hidden `.godot/` cache
folder. That folder is intentionally not committed (see `.gitignore`).

## Project structure

| Folder | Contents |
| --- | --- |
| `scenes/` | One subfolder per screen (`main_menu/`, `settings/`, `gameplay/`) |
| `scripts/managers/` | Autoload singletons: EventBus, Settings, Save, Game, Scene managers |
| `scripts/ui/` | Scripts attached to UI scenes |
| `ui/theme/` | The shared dark-fantasy UI theme |
| `audio/`, `sprites/`, `animations/`, `effects/` | Game assets (filled in later milestones) |
| `minigames/` | Self-contained minigame modules (Milestone 9+) |
| `resources/`, `data/` | Equipment, relic, pet definitions and game data (Milestone 6+) |
| `docs/` | Architecture and development documentation |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the systems fit together.

## Where is my save file?

Saves and settings are written to Godot's user data folder:

* Windows: `%APPDATA%\Godot\app_userdata\Vanta Eclipse\`
* Linux: `~/.local/share/godot/app_userdata/Vanta Eclipse/`
* Android: internal app storage

Files: `savegame.json` (progress), `savegame.backup.json` (automatic backup),
`settings.cfg` (volumes and preferences).
