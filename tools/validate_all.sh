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

echo "1. gdparse"
for f in $(find scripts -name '*.gd'); do
  gdparse "$f" >/dev/null 2>&1 || { echo "   FAIL $f"; status=1; }
done
[ $status -eq 0 ] && echo "   OK"

echo "2. gdlint"
gdlint $(find scripts -name '*.gd') 2>&1 | tail -2 | sed 's/^/   /'

echo "3. scene/resource structure"
python3 tools/validate_godot_files.py . | sed 's/^/   /' || status=1

echo "4. autoload members exist"
python3 tools/check_autoload_calls.py | sed 's/^/   /' || status=1

echo "5. GDScript semantics (names, arity, handlers, paths, load order)"
python3 tools/check_scripts.py | sed 's/^/   /' || status=1

echo "6. content library (properties, enums, ids, reachability)"
python3 tools/check_data.py | sed 's/^/   /' || status=1

echo "7. data-to-code wiring (stats, metrics, enum dispatch)"
python3 tools/check_wiring.py | sed 's/^/   /' || status=1

echo "8. font-safe glyphs in button text"
python3 - <<'PY' || status=1
import re, pathlib, sys
UNSAFE = "◈◆★●→"   # absent from Cinzel, the Button/Header face
bad = []
for gd in pathlib.Path("scripts").rglob("*.gd"):
    for i, l in enumerate(gd.read_text().splitlines(), 1):
        if re.search(r'(button|Button)\w*\.text\s*=', l) and any(c in UNSAFE for c in l):
            bad.append(f"   {gd}:{i}")
print("   OK" if not bad else "\n".join(bad))
sys.exit(1 if bad else 0)
PY

exit $status
