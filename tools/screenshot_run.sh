#!/usr/bin/env bash
# Launch the real game on a real renderer and screenshot every screen in it.
#
#   bash tools/screenshot_run.sh [output_dir]
#   VANTA_SHOT_ONLY=gear bash tools/screenshot_run.sh   # one screen, fast loop
#
# The static sweep (validate_all.sh) and a `--headless` boot together prove the
# scripts parse, the resources load, and the managers start. Neither compiles a
# shader: --headless uses the dummy rasterizer. This runs the game windowed on
# the real Vulkan backend, walks it through every screen, panel, minigame and
# transient, and writes PNGs you can actually look at.
#
# It registers tools/screenshot_harness.gd as the last autoload and ALWAYS puts
# project.godot back, including on crash or Ctrl-C.
set -uo pipefail

cd "$(dirname "$0")/.."
PROJECT_DIR="$PWD"
OUT_DIR="${1:-$PWD/.godot-shots}"

# GODOT env var wins; otherwise try PATH, then the usual Windows download spot.
if [ -n "${GODOT:-}" ]; then
	BIN="$GODOT"
elif command -v godot >/dev/null 2>&1; then
	BIN="$(command -v godot)"
else
	BIN=$(ls -1 \
		"$HOME/Downloads/Godot_v4."*"_win64.exe/Godot_v4."*"_win64_console.exe" \
		2>/dev/null | head -1)
fi

if [ -z "${BIN:-}" ] || [ ! -f "$BIN" ]; then
	echo "Godot binary not found. Set GODOT=/path/to/godot and retry." >&2
	exit 1
fi

BACKUP="$(mktemp)"
cp project.godot "$BACKUP"
restore() { cp "$BACKUP" "$PROJECT_DIR/project.godot"; rm -f "$BACKUP"; }
trap restore EXIT INT TERM

# Insert at the END of the [autoload] section, so it loads after every manager.
# NOT a plain >> append: project.godot is sectioned and the last section is
# [rendering], so appending silently files the entry under the wrong header and
# it never registers — the game then just sits at the menu until something
# kills it.
HARNESS_LINE='ScreenshotHarness="*res://tools/screenshot_harness.gd"'
awk -v line="$HARNESS_LINE" '
	/^\[/ && in_autoload { print line; in_autoload = 0 }
	{ print }
	$0 == "[autoload]" { in_autoload = 1 }
	END { if (in_autoload) print line }
' "$BACKUP" > project.godot

# -F is load-bearing: the line contains ="* and grep would read "* as a
# quantifier, so the literal text never matches its own regex.
if ! grep -qF "$HARNESS_LINE" project.godot; then
	echo "Failed to register the harness autoload." >&2
	exit 1
fi

mkdir -p "$OUT_DIR"
echo "Godot:  $BIN"
echo "Shots:  $OUT_DIR"
echo

# Stale shots are worse than none: a screen that stops being reached leaves its
# old PNG sitting there looking like a pass. Only on a FULL run, though — a
# filtered run writes one screen and would otherwise delete the other 26,
# which reads as "the rest of the game stopped rendering".
if [ -z "${VANTA_SHOT_ONLY:-}" ]; then
	rm -f "$OUT_DIR"/*.png
fi

# Import first, always. A newly added .svg has no .import sidecar and no entry
# in .godot/imported/, so every reference to it fails to load — and because the
# theme is one resource, ONE unimported sprite takes the whole theme down and
# the game boots unstyled. The static sweep cannot see this: the file is on
# disk and the path resolves, so every checker is green while nothing renders.
# .godot/ is gitignored, so a fresh clone is always in exactly this state.
"$BIN" --headless --path "$PROJECT_DIR" --import >/dev/null 2>&1

# Hard cap: if the harness ever fails to reach its own quit(), the window would
# otherwise stay open forever waiting for input that never comes. The full walk
# is ~60s; the margin is for first-run shader compilation.
# 540x960 rather than the project's native 1080x1920, because a window cannot
# exceed the desktop: asking for 1920 tall on a 1080p monitor silently gives a
# 1080x1050 window, and with stretch/aspect="expand" the game then renders a
# near-SQUARE viewport. Every screenshot still looks plausible, so the wrong
# aspect ratio is invisible — it just quietly invalidates every judgement about
# vertical layout. Half scale keeps the exact 9:16 the phone has; canvas_items
# stretch means the layout is identical, only the raster is smaller.
timeout 300 env VANTA_SHOT_DIR="$OUT_DIR" VANTA_SHOT_ONLY="${VANTA_SHOT_ONLY:-}" "$BIN" \
	--path "$PROJECT_DIR" \
	--resolution ${SHOT_RES:-540x960} \
	--position 40,20 2>&1 | grep -v 'reimport\|loading_editor'

if [ "${PIPESTATUS[0]}" = "124" ]; then
	echo "TIMED OUT after 300s — the harness never quit." >&2
fi

echo
echo "--- written ---"
ls -1 "$OUT_DIR"/*.png 2>/dev/null || echo "(no screenshots — check the log above)"
