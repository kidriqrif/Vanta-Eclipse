#!/usr/bin/env python3
"""Verify every Autoload.method(...) call resolves to a method that exists.

gdparse and gdlint both pass a call to a nonexistent method on an autoload —
it is a runtime error only. That class of bug has bitten twice, so it is now
part of the validation sweep.
"""
import re, pathlib, sys

root = pathlib.Path(".")
autoloads = {}
for line in (root / "project.godot").read_text().splitlines():
    m = re.match(r'^(\w+)="\*(res://[^"]+)"$', line.strip())
    if m:
        autoloads[m.group(1)] = root / m.group(2).replace("res://", "")

# name -> set of methods it defines (plus Node/Object builtins we allow)
BUILTINS = {
    "connect","disconnect","emit","call","call_deferred","get","set","has_method",
    "get_children","add_child","queue_free","is_connected","new","duplicate","emit_signal",
}
methods = {}
for name, path in autoloads.items():
    src = path.read_text() if path.exists() else ""
    methods[name] = set(re.findall(r'^(?:static )?func (\w+)\(', src, re.M)) | \
                    set(re.findall(r'^(?:@\w+\s+)?var (\w+)', src, re.M)) | \
                    set(re.findall(r'^const (\w+)', src, re.M)) | \
                    set(re.findall(r'^signal (\w+)', src, re.M)) | \
                    set(re.findall(r'^enum (\w+)', src, re.M))

problems = []
for gd in sorted(root.rglob("scripts/**/*.gd")):
    src = gd.read_text()
    for m in re.finditer(r'\b(' + "|".join(autoloads) + r')\.(\w+)', src):
        owner, member = m.group(1), m.group(2)
        if member in methods[owner] or member in BUILTINS:
            continue
        line = src[:m.start()].count("\n") + 1
        problems.append(f"  {gd}:{line}  {owner}.{member} — not defined in {owner}")

if problems:
    print(f"AUTOLOAD MEMBER CHECK: {len(problems)} unresolved")
    print("\n".join(problems))
    sys.exit(1)
print(f"AUTOLOAD MEMBER CHECK: OK ({len(autoloads)} autoloads scanned)")
