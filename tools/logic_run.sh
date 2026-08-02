#!/usr/bin/env bash
# Run the runtime logic checks (tools/logic_harness.gd).
#
#   bash tools/logic_run.sh
#
# Headless is fine here — unlike the screenshot run, nothing being checked is
# drawn, so the dummy rasteriser costs nothing.
#
# The harness WRITES THE REAL SAVE FILE, because testing the round-trip
# through a reimplementation of the save path would stop testing the save
# path. So the player's save is backed up before the run and restored after,
# including when the run fails or is interrupted.
set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR" || exit 1

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

USER_DIR="${VANTA_USER_DIR:-$APPDATA/Godot/app_userdata/Vanta Eclipse}"
SAVE="$USER_DIR/savegame.json"
BACKUP_SAVE="$(mktemp)"
BACKUP_PROJECT="$(mktemp)"
had_save=0
[ -f "$SAVE" ] && { cp "$SAVE" "$BACKUP_SAVE"; had_save=1; }
cp project.godot "$BACKUP_PROJECT"

restored=0
restore() {
	# EXIT fires after INT/TERM, so without this guard the second pass finds
	# the backups already deleted and reports a spurious failure over the real
	# one — which is exactly what it did the first time this script ran.
	[ "$restored" -eq 1 ] && return
	restored=1
	[ -f "$BACKUP_PROJECT" ] && cp "$BACKUP_PROJECT" "$PROJECT_DIR/project.godot"
	if [ "$had_save" -eq 1 ]; then
		[ -f "$BACKUP_SAVE" ] && cp "$BACKUP_SAVE" "$SAVE"
	else
		# There was no save before the run; the harness created one.
		rm -f "$SAVE"
	fi
	rm -f "$BACKUP_SAVE" "$BACKUP_PROJECT"
}
trap restore EXIT INT TERM

# Appended at the END of [autoload] so every manager has registered its save
# section first. Not a plain >> append: project.godot is sectioned, and the
# last section is [rendering], so appending files the entry under the wrong
# header and it never registers.
HARNESS_LINE='LogicHarness="*res://tools/logic_harness.gd"'
awk -v line="$HARNESS_LINE" '
	/^\[/ && in_autoload { print line; in_autoload = 0 }
	{ print }
	$0 == "[autoload]" { in_autoload = 1 }
	END { if (in_autoload) print line }
' "$BACKUP_PROJECT" > project.godot

# -F: the line contains ="* which grep would read as a quantifier.
if ! grep -qF "$HARNESS_LINE" project.godot; then
	echo "Failed to register the logic harness autoload." >&2
	exit 1
fi

LOG="$(mktemp)"
# --quit-after is a watchdog, not the exit path: the harness quits itself as
# soon as it is done. Without it, a runtime error in the harness leaves the
# game sitting at the main menu forever.
"$BIN" --headless --path "$PROJECT_DIR" --quit-after 1800 >"$LOG" 2>&1
status=$?

grep -vE "^Godot Engine|^$|WARNING: ObjectDB|^ +at: " "$LOG" | sed 's/^/   /'

# A harness that dies before printing its verdict exits 0 via the watchdog,
# which would read as a pass. Require the verdict line itself.
if ! grep -q "^LOGIC: " "$LOG"; then
	echo "logic checks INCONCLUSIVE — the harness never reported." >&2
	grep -iE "SCRIPT ERROR|Parse Error|Invalid call|nonexistent" "$LOG" \
		| head -5 | sed 's/^/   /' >&2
	rm -f "$LOG"
	exit 1
fi
rm -f "$LOG"

if [ "$status" -ne 0 ]; then
	echo "logic checks FAILED (exit $status)" >&2
fi
exit "$status"
