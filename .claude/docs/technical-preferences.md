# Vanta Eclipse — Technical Preferences

## Engine

Godot 4.7 Stable, GDScript, fully typed. See `docs/ARCHITECTURE.md` for the
autoload/manager pattern, save system, and folder conventions this project
follows — read it before making architectural decisions.

## Engine Specialists

### UI Specialist

No dedicated `godot-ui-specialist` subagent is configured in this
environment, so `/team-ui` Phase 3's engine-specialist step is filled by a
general-purpose agent briefed with this persona:

> Reviews Control-node hierarchies, Theme resource usage (variations over
> per-node overrides), CanvasLayer patterns for modals/overlays,
> signal-driven data binding (UI reads `EventBus`/manager state, never
> owns it), touch-first input handling (`gui_input` mouse-button events,
> since Godot emulates touch as mouse), and mobile performance (avoid
> per-frame allocation in `_process`, prefer `Tween` over manual
> interpolation, keep shaders cheap for low-end Android GPUs).

## Project-wide rules that apply to every UI feature

- UI scripts (`scripts/ui/`) never mutate game state directly — they call
  manager methods and read manager state/EventBus signals only.
- All player-facing numbers go through `NumberFormat`
  (`scripts/utils/number_format.gd`).
- New shop/content-style screens are data-driven from `.tres` Resource
  definitions in `data/`, not hardcoded lists.
- Every new screen registers with `SceneManager` if it's a full scene, or
  is a child panel of an existing scene if it's an overlay.
