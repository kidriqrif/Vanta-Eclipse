#!/usr/bin/env bash
# Render every screen at every Android shape and measure what came out.
#
#   bash tools/screenshots.sh                     all 11 screens x 10 shapes
#   bash tools/screenshots.sh MainMenu,Gameplay   named screens only
#   SHAPES=1080x1920_9-16 bash tools/screenshots.sh MainMenu
#
# Output: build/screenshots/<Scene>__<shape>.png plus report.csv.
# Exit code is the gate; the PNGs are for looking at, which is the point —
# every sprite that came out wrong in this project's history looked correct in
# source.
#
# TWO FLAGS ARE DELIBERATELY ABSENT from the invocation below, and both of
# them are the kind of thing that gets "helpfully" added back:
#
#   -nographics  gives a null graphics device. Every capture comes back empty
#                and the harness reports eleven blank screens.
#   -quit        closes the editor as soon as the executeMethod RETURNS, which
#                is before play mode has started. The harness calls
#                EditorApplication.Exit itself when the run is done.
set -uo pipefail

UNITY="${UNITY:-/c/Program Files/Unity/Hub/Editor/6000.5.7f1/Editor/Unity.exe}"
PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${OUT:-build/screenshots}"
LOG="${LOG:-build/unity-screenshots.log}"

cd "$PROJECT" || exit 1
mkdir -p "$(dirname "$LOG")" "$OUT"

if [ ! -f "$UNITY" ]; then
	echo "no Unity at \$UNITY: $UNITY" >&2
	exit 1
fi

ARGS=(-batchmode
	-projectPath "$PROJECT"
	-executeMethod VantaEclipse.EditorTools.ScreenshotHarness.Run
	-harnessOut "$OUT"
	-logFile "$PROJECT/$LOG")

[ $# -ge 1 ] && ARGS+=(-harnessScenes "$1")
[ -n "${SHAPES:-}" ] && ARGS+=(-harnessShapes "$SHAPES")

"$UNITY" "${ARGS[@]}"
status=$?

# The exit code is the harness's own verdict, but a crash before it runs looks
# identical to a clean pass if nothing checks that work actually happened.
count=$(find "$OUT" -name '*.png' 2>/dev/null | wc -l | tr -d ' ')
echo "$count capture(s) in $OUT"
grep -E "^  HARNESS-FAIL|Harness: " "$LOG" | sed 's/^/   /'

if [ "$count" -eq 0 ]; then
	echo "harness produced nothing — see $LOG" >&2
	exit 1
fi
exit $status
