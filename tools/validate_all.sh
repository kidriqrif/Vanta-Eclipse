#!/usr/bin/env bash
# The whole validation sweep. Every stage is a hard gate; the script exits
# non-zero if any of them fail, and it runs all of them regardless so one
# failure does not hide the next five.
#
# Run: bash tools/validate_all.sh
#
# WHY THERE ARE EIGHT STAGES AND NOT SIXTEEN
#
# It had sixteen once, and eight of them existed because the previous language
# resolved names at runtime: a parser, a linter, a scene/resource structure
# pass, a member-existence check, a semantic pass over every script, a
# shader-parameter pass, a logic harness run inside the engine, and a
# screenshot harness. A misspelled member or a signal connected with the wrong
# arity was silent until the line ran, so it had to be found by reading source.
#
# In C# every one of those is a compile error. Stage 1 here — a real Unity
# batchmode compile — is a stricter and more honest version of all five script
# stages than any parser written in this directory could be, and the smoke test
# in stage 7 replaces the logic harness with 49 assertions run against the real
# managers.
#
# The screenshot harness is stage 8, and it is the only stage that looks at
# PIXELS. Everything above it compares files to other files. It renders all 11
# screens at 10 Android shapes in play mode and measures layout, glyph box and
# device pixels, for the reason every one of those measurements was written:
# every piece of art and text this project got wrong looked correct in source.

set -uo pipefail
cd "$(dirname "$0")/.."

status=0
fail() { echo "   FAIL"; status=1; }

# Probe by RUNNING it, not by `command -v`. On Windows `python3` resolves to
# the Microsoft Store app-execution alias, which exists on PATH, exits 9009 and
# prints an advert — so a presence test picks an interpreter that cannot run a
# single stage, and all six report FAIL for the same fake reason.
PYTHON="${PYTHON:-}"
if [ -z "$PYTHON" ]; then
  for candidate in python3 python py; do
    if "$candidate" -c "import sys" >/dev/null 2>&1; then PYTHON="$candidate"; break; fi
  done
fi
if [ -z "$PYTHON" ]; then
  echo "no working python found (tried \$PYTHON, python3, python, py)" >&2
  exit 1
fi

UNITY="${UNITY:-/c/Program Files/Unity/Hub/Editor/6000.5.7f1/Editor/Unity.exe}"
PROJECT="$(pwd)"
LOGDIR="${TMPDIR:-/tmp}"

run_unity() {  # run_unity <method> <logfile>
  "$UNITY" -batchmode -quit -nographics \
    -projectPath "$PROJECT" \
    -executeMethod "$1" \
    -logFile "$2" >/dev/null 2>&1
}

echo "1. C# compiles (Unity batchmode)"
if [ ! -x "$UNITY" ] && [ ! -f "$UNITY" ]; then
  echo "   SKIPPED (no Unity at \$UNITY: $UNITY)"
else
  log="$LOGDIR/vanta_compile.$$"
  if run_unity VantaEclipse.EditorTools.PortSmokeTest.Run "$log"; then
    echo "   OK"
  else
    grep -E "error CS" "$log" | sort -u | sed 's/^/   /'
    fail
  fi
  rm -f "$log" 2>/dev/null || true
fi

echo "2. project invariants (palette, glyph box, scene/prefab/sprite names)"
$PYTHON tools/check_unity.py || fail

echo "3. font coverage (every rendered glyph exists in the face)"
$PYTHON tools/check_glyphs.py || fail

echo "4. generated art (every pixel is one of the 16 palette colours)"
$PYTHON tools/check_pixels.py || fail

echo "5. shipped assets match their generators (byte-identical)"
$PYTHON tools/check_generated.py || fail

echo "6. README and the published site match the code"
$PYTHON tools/check_docs.py || fail

echo "7. runtime logic (save round-trip, invariants)"
if [ ! -x "$UNITY" ] && [ ! -f "$UNITY" ]; then
  echo "   SKIPPED (no Unity at \$UNITY: $UNITY)"
else
  log="$LOGDIR/vanta_smoke.$$"
  if run_unity VantaEclipse.EditorTools.PortSmokeTest.Run "$log" \
     && grep -q "0 failed" "$log"; then
    grep -E "PortSmokeTest:" "$log" | sed 's/^/   /'
  else
    grep -E "FAIL|PortSmokeTest:" "$log" | sed 's/^/   /'
    fail
  fi
  rm -f "$log" 2>/dev/null || true
fi

echo "8. every screen rendered at 10 Android shapes (layout, glyph box, pixels)"
if [ ! -x "$UNITY" ] && [ ! -f "$UNITY" ]; then
  echo "   SKIPPED (no Unity at \$UNITY: $UNITY)"
else
  # Not run through run_unity(): this stage needs a graphics device, so it must
  # NOT get -nographics, and it enters play mode, so it must NOT get -quit.
  if out="$(bash tools/screenshots.sh 2>&1)"; then
    echo "$out" | sed 's/^/   /'
  else
    echo "$out" | sed 's/^/   /'
    fail
  fi
fi

echo
if [ $status -eq 0 ]; then
  echo "sweep: OK"
else
  echo "sweep: FAILED"
fi
exit $status
