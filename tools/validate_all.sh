#!/usr/bin/env bash
# The full static sweep. Run from anywhere; before every commit.
#
# gdparse and gdlint cover syntax and style. Everything after them covers
# classes of runtime error those two pass cleanly — each has bitten this
# project at least once, and each is listed in the file that implements it.
#
# pipefail is essential: a stage written as `check | sed` reports sed's exit
# status, not the check's, so without it a failing stage silently passes.
set -u
set -o pipefail
cd "$(dirname "$0")/.."
status=0

# Pick an interpreter. On Windows `python3` is usually the Microsoft Store
# alias stub: it EXISTS on PATH and exits non-zero with an ad, so presence
# alone is not enough — each candidate has to actually execute something.
PY=""
for candidate in "${PYTHON:-}" python3 python; do
  [ -n "$candidate" ] || continue
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c "" >/dev/null 2>&1; then
    PY="$candidate"
    break
  fi
done
if [ -z "$PY" ]; then
  echo "no working python found (tried \$PYTHON, python3, python)" >&2
  exit 1
fi

echo "1. gdparse"
if command -v gdparse >/dev/null 2>&1; then
  parse_failed=0
  for f in $(find scripts -name '*.gd'); do
    gdparse "$f" >/dev/null 2>&1 || { echo "   FAIL $f"; parse_failed=1; status=1; }
  done
  [ $parse_failed -eq 0 ] && echo "   OK"
else
  # Without this guard a missing gdtoolkit prints FAIL for every file in the
  # project, which reads as 40 broken scripts rather than one absent tool.
  echo "   SKIPPED (gdparse not installed: pip install gdtoolkit)"
fi

echo "2. gdlint"
if command -v gdlint >/dev/null 2>&1; then
  # The exit status has to be captured BEFORE the pipe: piping to tail made
  # $? the status of tail, which is always 0, so every lint error this stage
  # ever found was printed and then ignored. A whole stage was decorative.
  lint_out=$(gdlint $(find scripts -name '*.gd') 2>&1)
  lint_status=$?
  printf '%s\n' "$lint_out" | tail -2 | sed 's/^/   /'
  if [ "$lint_status" -ne 0 ]; then
    printf '%s\n' "$lint_out" | grep -E "Error|Warning" | head -20 | sed 's/^/   /'
    status=1
  fi
else
  echo "   SKIPPED (gdlint not installed: pip install gdtoolkit)"
fi

echo "3. scene/resource structure"
"$PY" tools/validate_godot_files.py . | sed 's/^/   /' || status=1

echo "4. autoload members exist"
"$PY" tools/check_autoload_calls.py | sed 's/^/   /' || status=1

echo "5. GDScript semantics (names, arity, handlers, paths, load order)"
"$PY" tools/check_scripts.py | sed 's/^/   /' || status=1

echo "6. content library (properties, enums, ids, reachability)"
"$PY" tools/check_data.py | sed 's/^/   /' || status=1

echo "7. data-to-code wiring (stats, metrics, enum dispatch)"
"$PY" tools/check_wiring.py | sed 's/^/   /' || status=1

echo "8. architecture docs match the code (autoloads, save sections)"
"$PY" tools/check_architecture.py | sed 's/^/   /' || status=1

echo "9. shaders and material parameters"
"$PY" tools/check_shaders.py | sed 's/^/   /' || status=1

echo "10. UI theme discipline and asset reachability"
"$PY" tools/check_ui.py | sed 's/^/   /' || status=1

echo "11. font coverage (every rendered glyph exists in the face)"
"$PY" tools/check_glyphs.py | sed 's/^/   /' || status=1

# Stage 10 reads colour out of source files and stops there, so half the
# project's colour — the pixels inside the 58 shipped PNGs — had nothing
# looking at it at all. This opens the images.
echo "12. generated art (every pixel is one of the 16 palette colours)"
"$PY" tools/check_pixels.py | sed 's/^/   /' || status=1

# Everything above compares what the files say to each other. This one runs
# the game: it seeds every save section, pushes it through the real save/load
# path, and asserts the economy invariants. A dropped field or a non-idempotent
# load produces no parse error and no visual difference, so nothing earlier in
# this script can see it.
# Stage 12 proves the pixels are on-palette. This proves they are the pixels
# the generators still produce — the difference between "this art is valid" and
# "this art is current". A hand-edited sprite, or one left over from before a
# generator changed, passes 12 and fails here.
echo "13. shipped assets match their generators (byte-identical)"
"$PY" tools/check_generated.py | sed 's/^/   /' || status=1

# Stage 8 checks that ARCHITECTURE.md names files that exist. This one checks
# that the README and the public GitHub Pages site still describe THIS project:
# every figure in them is regenerated from the file that defines it, so a stale
# count fails here instead of being read by someone as fact.
echo "14. README and the published site match the code"
"$PY" tools/check_docs.py | sed 's/^/   /' || status=1

echo "15. runtime logic (save round-trip, invariants)"
if bash tools/logic_run.sh >/tmp/vanta_logic.$$ 2>&1; then
  # The verdict line by name, NOT tail -1. Anything the engine prints after the
  # harness has spoken — a leak warning, a driver notice — is not the result,
  # and this stage spent a while reporting one of those as if it were.
  grep -E "^ *LOGIC: " /tmp/vanta_logic.$$ | sed 's/^ *//;s/^/   /'
else
  sed 's/^/   /' /tmp/vanta_logic.$$ | tail -12
  status=1
fi
rm -f /tmp/vanta_logic.$$

# Stage 15 runs the game with no renderer. This one runs it with a real one and
# then LOOKS at the result: every screen walked for overflow, every text control
# checked against the glyph box, and every glyph checked against the pixels the
# rasteriser actually produced.
#
# It was not part of this script before, which is why the tagline on the main
# menu could lose both its periods and stay green through fifteen stages. The
# harness had been finding things and reporting them to nobody: it always
# exited 0, so even when it printed problems the sweep never heard.
#
# Skippable, because it is the one stage that needs a GPU and ~90s. CI without
# a display sets VANTA_SKIP_SHOTS=1; a developer machine should not.
echo "16. rendered screens (layout, glyph box, device pixels)"
if [ "${VANTA_SKIP_SHOTS:-0}" = "1" ]; then
  echo "   SKIPPED (VANTA_SKIP_SHOTS=1)"
elif ! command -v timeout >/dev/null 2>&1; then
  echo "   SKIPPED (no timeout(1); the harness needs its hard cap)"
else
  if bash tools/screenshot_run.sh >/tmp/vanta_shots.$$ 2>&1; then
    grep -E "^(LAYOUT|FONT|FONTDEVICE): " /tmp/vanta_shots.$$ | sed 's/^/   /'
  else
    grep -E "^(LAYOUT|FONT|FONTDEVICE): " /tmp/vanta_shots.$$ | sed 's/^/   /'
    grep -E "^ *FINDING: " /tmp/vanta_shots.$$ | sed 's/^ *//;s/^/   /' | head -15
    status=1
  fi
  rm -f /tmp/vanta_shots.$$
fi

exit $status
