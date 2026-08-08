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
# The harness log is cleaned up by this same handler on purpose. A SECOND
# `trap ... EXIT` does not run alongside this one, it REPLACES it — which is
# how a later edit to this file silently disabled the project.godot restore
# and left a duplicate ScreenshotHarness autoload behind on every run until
# the sweep noticed there were 23 of them.
LOG="$(mktemp)"

# The harness SEEDS A LATE-GAME SAVE — currencies, prestige, equipment, boss
# cards — and the managers it drives call SaveManager.save_game(), so all of it
# lands in the player's real save file. tools/logic_run.sh has always backed the
# save up for exactly this reason; this script never did, so every screenshot
# run quietly granted the player 4.8M essence and pushed them to level 60.
#
# It went unnoticed because seeding is idempotent-looking: currencies are set,
# not added. Boss cards are what exposed it — they APPEND, so the collection
# grew by five every run and the twentieth card made it obvious.
#
# BOTH files, not just savegame.json. SaveManager writes atomically by copying
# the current save to savegame.backup.json before swapping, and its load path
# falls back to that backup when the main file is missing or unreadable. So
# removing only savegame.json leaves the harness's seeded run sitting in the
# backup slot, and the very next launch restores it — a "reset" save that comes
# back at level 60 with 20 boss cards.
USER_DIR="${VANTA_USER_DIR:-$APPDATA/Godot/app_userdata/Vanta Eclipse}"
SAVE="$USER_DIR/savegame.json"
SAVE_BAK="$USER_DIR/savegame.backup.json"
BACKUP_SAVE="$(mktemp)"
BACKUP_SAVE_BAK="$(mktemp)"
had_save=0
had_backup=0
[ -f "$SAVE" ] && { cp "$SAVE" "$BACKUP_SAVE"; had_save=1; }
[ -f "$SAVE_BAK" ] && { cp "$SAVE_BAK" "$BACKUP_SAVE_BAK"; had_backup=1; }

restored=0
restore() {
	# EXIT fires after INT/TERM, so without this guard the second pass finds
	# the backups already deleted and clobbers the real save with nothing.
	[ "$restored" -eq 1 ] && return
	restored=1
	cp "$BACKUP" "$PROJECT_DIR/project.godot"
	if [ "$had_save" -eq 1 ]; then
		[ -f "$BACKUP_SAVE" ] && cp "$BACKUP_SAVE" "$SAVE"
	else
		# There was no save before the run; the harness created one.
		rm -f "$SAVE"
	fi
	if [ "$had_backup" -eq 1 ]; then
		[ -f "$BACKUP_SAVE_BAK" ] && cp "$BACKUP_SAVE_BAK" "$SAVE_BAK"
	else
		rm -f "$SAVE_BAK"
	fi
	rm -f "$BACKUP" "$BACKUP_SAVE" "$BACKUP_SAVE_BAK" "$LOG"
}
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
	--position 40,20 2>&1 | grep -v 'reimport\|loading_editor' | tee "$LOG"

if [ "${PIPESTATUS[0]}" = "124" ]; then
	echo "TIMED OUT after 300s — the harness never quit." >&2
fi

echo
echo "--- written ---"
ls -1 "$OUT_DIR"/*.png 2>/dev/null || echo "(no screenshots — check the log above)"

# The verdicts decide the exit status. Until this existed the script ended on
# `ls`, so it returned 0 whatever the harness had just said — LAYOUT could
# report overflow on every screen and the run still "passed". That is the same
# defect validate_all.sh documents twice (a stage piped into `tail`, and a
# verdict read with `tail -1`), and it is why this reads each verdict BY NAME:
# anything the engine prints afterwards — a leak warning, a driver notice — is
# not the result.
#
# A missing verdict is a failure, not a pass. If the harness died before it
# spoke, the absence of the word "problem" means nothing at all.
echo
status=0
for verdict in LAYOUT FONT FONTDEVICE; do
	line=$(grep -m1 "^${verdict}: " "$LOG" || true)
	if [ -z "$line" ]; then
		echo "   $verdict: MISSING — the harness never reported one" >&2
		status=1
		continue
	fi
	echo "   $line"
	case "$line" in
		"$verdict: OK"*) ;;
		# Only the device verdict may be inconclusive and still pass: at a
		# fractional window:viewport the 9px face cannot land exactly at any
		# size, which is a property of the resolution, not of this project.
		"FONTDEVICE: INCONCLUSIVE"*) ;;
		*) status=1 ;;
	esac
done
exit $status
