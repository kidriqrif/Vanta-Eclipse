# Vanta Eclipse — Technical Preferences

## Engine

Unity 6000.5.7f1, C#. See `docs/ARCHITECTURE.md` for the service-locator
manager pattern, the two clocks, the save system, and the folder conventions
this project follows — read it before making architectural decisions.

## Engine Specialists

### UI Specialist

No dedicated `unity-ui-specialist` subagent is configured in this environment,
so `/team-ui` Phase 3's engine-specialist step is filled by a general-purpose
agent briefed with this persona:

> Reviews RectTransform hierarchies and anchoring, theme discipline
> (`VantaTheme` over per-object literals), nested-Canvas sorting for
> modals/overlays, event-driven data binding (UI reads `EventBus`/manager
> state, never owns it), touch-first input handling (EventSystem pointer
> handlers, not polled `Input`), and mobile performance (avoid per-frame
> allocation in `Update`, prefer coroutines over per-frame recomputation, keep
> shaders cheap for low-end Android GPUs).

## Project-wide rules that apply to every UI feature

- UI behaviours (`Assets/Scripts/UI/`) never mutate game state directly — they
  call manager methods and read manager state / `EventBus` events only.
- All player-facing numbers go through `NumberFormat`
  (`Assets/Scripts/Core/NumberFormat.cs`).
- New shop/content-style screens are data-driven from `ScriptableObject`
  definitions in `Assets/Resources/Content/`, not hardcoded lists.
- Every new screen gets a `Scenes` constant AND a Build Settings entry if it is
  a full screen; a component a screen spawns is a prefab under
  `Assets/Resources/Prefabs/` instead.
- Screens derive from `UIScreen` and find their nodes by NAME. Node names are
  load-bearing — renaming one silently drops that element from the screen.
- Every colour comes from `VantaTheme` and every font size is a whole multiple
  of 9. `tools/check_unity.py` fails the sweep on either.
