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
	# LANDSCAPE. The app is portrait-locked
	# (android:screenOrientation="portrait") and has no landscape layout, so
	# for most of its life these shapes were not worth testing. They are now:
	# the build targets SDK 36, and Android 16 IGNORES an orientation lock on
	# displays 600dp and wider. A tablet or an unfolded foldable will therefore
	# show this game in landscape whether it asks to or not, and so will any
	# phone in split-screen.
	#
	# expand only ever GROWS the logical viewport, so nothing is cropped and
	# nothing overflows — which is exactly why the layout audit alone cannot
	# judge these. Read the "content column" figure, not the LAYOUT line: at
	# 4267 logical pixels the 1080-wide UI occupies a quarter of the screen.
	"tablet_land_4x3|960x720|2560x1920|4:3 tablet forced landscape (Android 16)"
	"tablet_land_16x10|960x600|3072x1920|16:10 tablet forced landscape"
	"phone_land_20x9|960x432|4267x1920|phone landscape / split-screen"
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

	# Let the previous engine process release the project before starting the
	# next. Launching Godot back-to-back makes scene loads fail intermittently —
	# a run done this way came back "20 scene(s) never loaded" and the identical
	# shape passed cleanly on its own moments later. The harness reports that as
	# LAYOUT: INCONCLUSIVE rather than a false OK, which is the guard working,
	# but an inconclusive device costs the whole 15-minute matrix its meaning.
	sleep 3

	log=$(SHOT_RES="$res" VANTA_EXPECT_ASPECT="$aspect" GODOT="$BIN" \
		bash tools/screenshot_run.sh "$OUT_ROOT/$label" 2>&1)

	echo "$log" | grep -E "LAYOUT:|WRONG ASPECT|asked for|as requested" | sed 's/^/  /'

	# These tests are bash pattern matches, NOT `echo "$log" | grep -q`.
	#
	# `grep -q` exits the instant it matches, which closes the pipe under it and
	# kills `echo` with SIGPIPE (141). With `set -o pipefail` the PIPELINE then
	# reports 141 — so a successful match reads as a failure, and does so only
	# once the log is big enough that echo has not already finished writing.
	# This script passed for months on a small log and began reporting all seven
	# shapes as broken the moment the harness started emitting per-control
	# findings, which took it past 200 KB. The layout was fine every time.
	#
	# It is the mirror image of the trap validate_all.sh documents twice: there,
	# a pipe HID a failure; here, a pipe INVENTS one. Neither is visible in the
	# output — only in the exit status nobody reads.
	case "$log" in
		*"WRONG ASPECT"*)
			# A clamped window renders the wrong shape while still producing
			# plausible screenshots, so this is a failure of the RUN, not a
			# layout finding.
			summary+=$'\n'"  $label: RUN INVALID — window was clamped, shape not tested"
			failures=$((failures + 1))
			continue
			;;
	esac
	case "$log" in
		*"LAYOUT: OK"*)
			summary+=$'\n'"  $label: OK"
			;;
		*)
			n=$(printf '%s' "$log" | grep -oE "LAYOUT: [0-9]+ problem" \
				| grep -oE "[0-9]+" | tail -1 || true)
			summary+=$'\n'"  $label: ${n:-?} problem(s)"
			failures=$((failures + 1))
			;;
	esac
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
