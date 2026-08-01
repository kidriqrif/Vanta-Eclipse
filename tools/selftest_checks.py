#!/usr/bin/env python3
"""Positive control for the semantic checkers.

A check that cannot fail is worse than no check: it reports OK forever and is
believed. So each check below is pointed at a copy of the project with ONE real
defect injected, and must reject it. If a mutation passes, that check is
vacuous — a regex stopped matching, a rename made it a no-op — and the line
printed here is the only warning anyone will get.

Injections are deliberately the mistakes actually made while building this
project: a typo'd unique name, a renamed handler, a duplicated id, a stat key
nothing reads.

Usage: python3 tools/selftest_checks.py
"""

import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
# Everything the checkers read. Copied rather than mutated in place so a failed
# run can never leave the real project damaged.
COPY = [
    "project.godot", "scripts", "data", "tools", "scenes", "ui", "resources",
    # check_architecture.py compares docs/ARCHITECTURE.md against the code.
    "docs",
    # check_shaders.py reads .gdshader files and the materials driving them.
    "effects",
]

# Anchors are exact and complete: .tres has no comment syntax, so a mutation
# that leaves a trailing "# original" makes the value unparseable and the
# checker skips the field instead of rejecting it — a pass for the wrong reason.
# (checker, label, file, find, replace) — replace of None means "create the
# file with this content"; find of None means "append".
Mutation = tuple[str, str, str, str | None, str]

MUTATIONS: list[Mutation] = [
    (
        "check_scripts.py",
        "unique names: typo'd %Name",
        "scripts/ui/countdown_timer_bar.gd",
        "%TimeLabel",
        "%TimeLabelTypo",
    ),
    (
        "check_scripts.py",
        "signal arity: signal gains an argument its handlers do not take",
        "scripts/managers/event_bus.gd",
        "signal auto_attack_unlocked",
        "signal auto_attack_unlocked(level: int)",
    ),
    (
        "check_scripts.py",
        "handler existence: connect to a renamed method",
        "scripts/managers/idle_manager.gd",
        "timeout.connect(_on_attack_tick)",
        "timeout.connect(_on_attack_tick_renamed)",
    ),
    (
        "check_scripts.py",
        "res:// literal: path to a file that does not exist",
        "scripts/managers/quest_manager.gd",
        'const DEFINITION_DIR: String = "res://data/quests"',
        'const DEFINITION_DIR: String = "res://data/quests_gone"',
    ),
    (
        "check_scripts.py",
        "load order: manager reads a later autoload in _ready()",
        "scripts/managers/save_manager.gd",
        "func _ready() -> void:",
        "func _ready() -> void:\n\tvar _peek: float = GameManager.total_play_time",
    ),
    (
        "check_data.py",
        "property names: .tres sets a property the script does not export",
        "data/enemies/gloom_wisp.tres",
        "hp_multiplier",
        "hp_multiplier_typo",
    ),
    (
        "check_data.py",
        "enum range: metric_shape past the end of the enum",
        "data/quests/q_first_blood.tres",
        "metric_shape = 0",
        "metric_shape = 9",
    ),
    (
        "check_data.py",
        "ids: two definitions of one class share an id",
        "data/relics/twin_fang.tres",
        'id = &"twin_fang"',
        'id = &"eclipse_heart"',
    ),
    (
        "check_data.py",
        "cross-reference: prereq_id naming a node that does not exist",
        "data/skills/deep_rest.tres",
        'prereq_id = &"abundance"',
        'prereq_id = &"no_such_node"',
    ),
    (
        "check_data.py",
        "reachability: a definition no manager loads",
        "data/relics/orphaned_relic.tres",
        None,
        "[gd_resource type=\"Resource\" script_class=\"RelicDefinition\" format=3]\n",
    ),
    (
        "check_wiring.py",
        "stat wiring: an affix grants a stat nothing reads",
        "data/affixes/tap_flat.tres",
        'stat = &"tap_flat"',
        'stat = &"stat_nobody_reads"',
    ),
    (
        "check_wiring.py",
        "goal metrics: a goal's metric is never fed",
        "data/quests/q_first_blood.tres",
        'metric = &"kills"',
        'metric = &"metric_never_fed"',
    ),
    (
        "check_wiring.py",
        "enum dispatch: a data-used value with no branch",
        "scripts/data/quest_definition.gd",
        "\tACHIEVEMENT,\n}",
        "\tACHIEVEMENT,\n\tWEEKLY,\n}",
    ),
    (
        "check_architecture.py",
        "autoload table: a row names the wrong manager",
        "docs/ARCHITECTURE.md",
        "| 19 | `PrestigeManager` |",
        "| 19 | `PrestigeMgr` |",
    ),
    (
        "check_architecture.py",
        "autoload table: an autoload loses its row (the drift that started this)",
        "docs/ARCHITECTURE.md",
        "| 18 | `MonetizationManager` | `monetization_manager.gd` |",
        "| 18 | SKIPPED |",
    ),
    (
        "check_architecture.py",
        "save sections: a section is attributed to the wrong manager",
        "docs/ARCHITECTURE.md",
        "| `combat` | `CombatManager` | `shop` | `MonetizationManager` |",
        "| `combat` | `CombatManager` | `shop` | `UpgradeManager` |",
    ),
    (
        "check_shaders.py",
        "runtime parameter: set_shader_parameter names no uniform",
        "scripts/ui/enemy_view.gd",
        'set_shader_parameter(&"rim_color"',
        'set_shader_parameter(&"rim_colour"',
    ),
    (
        "check_shaders.py",
        "material parameter: a .tres sets a knob the shader does not declare",
        "effects/dimensional_sprite_material.tres",
        'shader = ExtResource("1")',
        'shader = ExtResource("1")\nshader_parameter/bevel_radius_typo = 7.0',
    ),
    (
        "check_shaders.py",
        "dead uniform: declared, tunable, read by nothing",
        "effects/dimensional_sprite.gdshader",
        "void fragment() {",
        "uniform float unused_knob = 1.0;\n\nvoid fragment() {",
    ),
]

# The enum-dispatch mutation needs data pointing at the new member as well.
EXTRA = {
    "enum dispatch: a data-used value with no branch": (
        "data/quests/q_first_blood.tres",
        "kind = 0",
        "kind = 3",
    )
}


def baseline() -> bool:
    """Every checker must pass on the real project, or the mutations below
    prove nothing."""
    ok = True
    for checker in [
        "check_scripts.py", "check_data.py", "check_wiring.py",
        "check_architecture.py", "check_shaders.py",
    ]:
        result = subprocess.run(
            [sys.executable, str(ROOT / "tools" / checker)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"BASELINE FAIL  {checker} rejects the unmodified project:")
            print("    " + result.stdout.strip().replace("\n", "\n    "))
            ok = False
    return ok


def apply(work: pathlib.Path, target: str, find: str | None, replace: str) -> bool:
    path = work / target
    if find is None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(replace, encoding="utf-8")
        return True
    if not path.exists():
        print(f"    (mutation target missing: {target})")
        return False
    text = path.read_text(encoding="utf-8")
    if find not in text:
        print(f"    (anchor not found in {target}: {find!r})")
        return False
    path.write_text(text.replace(find, replace, 1), encoding="utf-8")
    return True


def main() -> int:
    if not baseline():
        return 1

    failures = 0
    with tempfile.TemporaryDirectory() as tmp:
        pristine = pathlib.Path(tmp) / "pristine"
        pristine.mkdir()
        for item in COPY:
            src = ROOT / item
            if src.is_dir():
                shutil.copytree(src, pristine / item)
            elif src.exists():
                shutil.copy2(src, pristine / item)

        for i, (checker, label, target, find, replace) in enumerate(MUTATIONS):
            work = pathlib.Path(tmp) / f"case{i}"
            shutil.copytree(pristine, work)
            if not apply(work, target, find, replace):
                print(f"BROKEN MUTATION  {label}")
                failures += 1
                continue
            if label in EXTRA:
                extra_target, extra_find, extra_replace = EXTRA[label]
                if not apply(work, extra_target, extra_find, extra_replace):
                    print(f"BROKEN MUTATION  {label} (extra)")
                    failures += 1
                    continue
            result = subprocess.run(
                [sys.executable, str(work / "tools" / checker)],
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                print(f"NOT CAUGHT  {checker}  {label}")
                failures += 1
            else:
                print(f"caught      {checker}  {label}")

    print()
    if failures:
        print(f"SELFTEST: {failures} of {len(MUTATIONS)} injected defects slipped through")
        return 1
    print(f"SELFTEST: OK — all {len(MUTATIONS)} injected defects rejected")
    return 0


if __name__ == "__main__":
    sys.exit(main())
