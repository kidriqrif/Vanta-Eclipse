extends Node
## EventBus — the game's global signal hub (autoload).
##
## Systems never talk to each other directly. Instead they emit signals here,
## and any other system that cares connects to them. This keeps gameplay logic,
## UI, and managers fully decoupled, which is what lets the project scale to
## many systems (combat, pets, minigames, ...) without spaghetti dependencies.
##
## Convention: every milestone adds its signals under a clearly named section.
## Emit with:    EventBus.game_saved.emit(true)
## Listen with:  EventBus.game_saved.connect(_on_game_saved)

# --- Save system (Milestone 1) ---

## Fired once at startup after SaveManager finished its initial load attempt.
## is_new_game is true when no readable save file existed.
signal game_loaded(is_new_game: bool)

## Fired every time a save finishes (autosave, manual save, or save-on-exit).
signal game_saved(success: bool)

# --- Settings (Milestone 1) ---

## Fired whenever a setting value changes (e.g. "music_volume", 0.8).
signal setting_changed(setting_name: String, value: Variant)

# --- Scene flow (Milestone 1) ---

## Fired when a scene transition begins (screen starts fading to black).
signal scene_transition_started(scene_path: String)

## Fired when a scene transition ends (new scene visible, fade finished).
signal scene_transition_finished(scene_path: String)
