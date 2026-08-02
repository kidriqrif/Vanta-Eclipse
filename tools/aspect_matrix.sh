#!/usr/bin/env bash
# Render the whole game at every Android portrait shape that ships, and report
# anything that does not fit.
#
#   GODOT=/path/to/godot bash tools/aspect_matrix.sh
#
# Android portrait is not one shape. It runs from 9:16 on older budget phones,
# through the 9:19.5 and 9:20 that most current phones use, to 9:21 on an
# Xperia, to 3:4 and 16:10 tablets, to very nearly square on an unfolded
# foldable. That is a 1.85x spread in aspect ratio — a layout tuned on one of
# them says nothing about the others.
#
# The project stretches with mode="canvas_items", aspect="expand". Expand scales
# by min(window.x/base.x, window.y/base.y) and then divides the window through
# by that scale, so the LOGICAL viewport is never smaller than the 1080x1920
# base in either axis — it only ever grows. Two consequences worth stating,
# because they decide what can actually break:
#
#   * Nothing is ever cropped. A taller phone is given extra height, a tablet
#     extra width. So the base 1080x1920 is simultaneously the NARROWEST and
#     the SHORTEST case, which is why it is the one to tune against.
#   * What does break is everything anchored: a bottom bar drifting away from
#     the content above it, a centred column stranded in a wide tablet field,
#     a full-width row stretched to a shape its text was never measured for.
#
# So this runs the whole walk per device and lets the harness's layout audit
# measure it. The screenshots land in .godot-shots/<device>/ if you want to
# look, but the pass/fail is the LAYOUT lines.
set -uo pipefail

cd "$(dirname "$0")/.."
PROJECT_DIR="$PWD"
OUT_ROOT="${1:-$PWD/.godot-shots}"

# label | window WxH | the logical viewport it produces | what ships like this
#
# Window sizes are deliberately exact integer divisions of the real device
# resolution, so the aspect is preserved to the digit: the harness asserts the
# achieved aspect matches, and a rounded window would trip it for no reason.
# They are also all under ~950px tall, because a window cannot exceed the
# desktop and a clamped one silently renders the wrong shape.
DEVICES=(
	"legacy_9x16|540x960|1080x1920|Galaxy S5 era, budget 720p phones"
	"pixel_9x19.5|432x936|1080x2340|Pixel 6/7/8, Galaxy S21/22"
	"common_9x20|432x960|1080x2400|the most common current Android"
	"xperia_9x21|405x945|1080x2520|Xperia 1, ultra-tall"
	"tablet_10x16|600x960|1200x1920|16:10 tablets in portrait"
	"tablet_3x4|690x920|1440x1920|4:3 tablets in portrait"
	"fold_5x6|765x918|1600x1920|foldable inner display, near square"
)

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

failures=0
summary=""

for entry in "${DEVICES[@]}"; do
	IFS='|' read -r label res viewport note <<< "$entry"
	width="${res%x*}"
	height="${res#*x}"
	aspect=$(awk -v w="$width" -v h="$height" 'BEGIN { printf "%.6f", w / h }')

	echo
	echo "=============================================================="
	echo "  $label — viewport ${viewport} (aspect ${aspect})"
	echo "  $note"
	echo "=============================================================="

	log=$(SHOT_RES="$res" VANTA_EXPECT_ASPECT="$aspect" GODOT="$BIN" \
		bash tools/screenshot_run.sh "$OUT_ROOT/$label" 2>&1)

	echo "$log" | grep -E "LAYOUT:|WRONG ASPECT|asked for|as requested" | sed 's/^/  /'

	# A clamped window renders the wrong shape while still producing plausible
	# screenshots, so treat it as a failure of the RUN, not a layout finding.
	if echo "$log" | grep -q "WRONG ASPECT"; then
		summary+=$'\n'"  $label: RUN INVALID — window was clamped, shape not tested"
		failures=$((failures + 1))
		continue
	fi
	count=$(echo "$log" | grep -c "^LAYOUT: [0-9]* problem" || true)
	if echo "$log" | grep -q "LAYOUT: OK"; then
		summary+=$'\n'"  $label: OK"
	else
		n=$(echo "$log" | grep -oE "LAYOUT: [0-9]+ problem" | grep -oE "[0-9]+" | head -1)
		summary+=$'\n'"  $label: ${n:-?} problem(s)"
		failures=$((failures + 1))
	fi
done

echo
echo "=============================================================="
echo "  SUMMARY"
echo "=============================================================="
echo "$summary"
echo
if [ "$failures" -ne 0 ]; then
	echo "$failures device shape(s) need attention." >&2
	exit 1
fi
echo "Every Android portrait shape renders with nothing overflowing or clipped."
