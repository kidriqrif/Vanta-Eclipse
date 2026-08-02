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

echo "11. font-safe glyphs in button text"
"$PY" - <<'PYEOF' || status=1
import re, pathlib, sys
# These were absent from Cinzel, the old Button/Header face. Nunito replaced
# it and its coverage of these has NOT been verified, so the ban is kept:
# being over-strict costs a design choice, being under-strict ships .notdef
# boxes to players.
UNSAFE = "◈◆★●→"
bad = []
for gd in pathlib.Path("scripts").rglob("*.gd"):
    for i, l in enumerate(gd.read_text(encoding="utf-8").splitlines(), 1):
        if re.search(r'(button|Button)\w*\.text\s*=', l) and any(c in UNSAFE for c in l):
            bad.append(f"   {gd}:{i}")
print("   OK" if not bad else "\n".join(bad))
sys.exit(1 if bad else 0)
PYEOF

# Everything above compares what the files say to each other. This one runs
# the game: it seeds every save section, pushes it through the real save/load
# path, and asserts the economy invariants. A dropped field or a non-idempotent
# load produces no parse error and no visual difference, so nothing earlier in
# this script can see it.
echo "12. runtime logic (save round-trip, invariants)"
if bash tools/logic_run.sh >/tmp/vanta_logic.$$ 2>&1; then
  tail -1 /tmp/vanta_logic.$$ | sed 's/^ *//;s/^/   /'
else
  sed 's/^/   /' /tmp/vanta_logic.$$ | tail -12
  status=1
fi
rm -f /tmp/vanta_logic.$$

exit $status
