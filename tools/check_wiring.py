#!/usr/bin/env python3
"""Contracts that span data/ and scripts/ — where the two halves disagree.

These are the "player pays and nothing happens" checks. Every one of them
describes a feature that loads, renders, costs currency, and does nothing, with
no error anywhere. No single-file review can see any of it: the data says one
thing, the code says another, and only comparing them reveals the gap.

  1. stat wiring     — a relic/pet/power/affix/upgrade grants a stat key that
                       nothing ever reads. Fully purchasable, zero effect.
  2. goal metrics    — a Journal goal's metric is never fed, so the goal shows
                       a progress bar that sits at 0 forever.
  3. enum handling   — a data-used enum value no consumer dispatches. The claim
                       succeeds, the branch does not exist, nothing is paid.

Consumers are the managers and UI only; scripts/data/ is excluded on purpose —
a definition class formatting its own label is not the same as a manager acting
on the value.
"""

import collections
import pathlib
import re
import sys

from _tree import glob, rglob

ROOT = pathlib.Path(__file__).resolve().parent.parent
COMMENT = re.compile(r"#[^\n]*")


def consumer_source() -> str:
    out = ""
    for gd in glob(ROOT, "scripts/**/*.gd"):
        if gd.parent.name == "data":
            continue
        out += COMMENT.sub("", gd.read_text(encoding="utf-8")) + "\n"
    return out


# --- 1. every granted stat is consumed ----------------------------------------

STAT_SOURCES = [
    ("Ascendant Power", "data/skills/*.tres", r'^effect_stat = &"(\w+)"'),
    ("Relic", "data/relics/*.tres", r'^effect_id = &"(\w+)"'),
    ("Pet", "data/pets/*.tres", r'^bonus_stat = &"(\w+)"'),
    ("Affix", "data/affixes/*.tres", r'^stat = &"(\w+)"'),
    ("Upgrade", "data/upgrades/*.tres", r'^stat = &"(\w+)"'),
]

STAT_CONSUMERS = [
    "scripts/managers/player_stats.gd",
    "scripts/managers/idle_manager.gd",
    "scripts/managers/combat_manager.gd",
    "scripts/managers/prestige_manager.gd",
    "scripts/managers/equipment_manager.gd",
    "scripts/managers/relic_manager.gd",
    "scripts/managers/pet_manager.gd",
    "scripts/managers/skill_tree_manager.gd",
]


def check_stat_wiring() -> tuple[list[str], list[str]]:
    read_keys: set[str] = set()
    for rel in STAT_CONSUMERS:
        read_keys |= set(re.findall(r'&"(\w+)"', (ROOT / rel).read_text(encoding="utf-8")))

    problems: list[str] = []
    counted = 0
    for label, source_glob, pattern in STAT_SOURCES:
        for tres in glob(ROOT, source_glob):
            m = re.search(pattern, tres.read_text(encoding="utf-8"), re.M)
            if not m:
                continue
            counted += 1
            if m.group(1) not in read_keys:
                problems.append(
                    f'{label} "{tres.stem}" grants &"{m.group(1)}", which no '
                    f"manager reads — it is purchasable and does nothing"
                )
    return problems, [f"{counted} granted stats across {len(STAT_SOURCES)} sources"]


# --- 2. every goal metric is fed ----------------------------------------------


def check_goal_metrics() -> tuple[list[str], list[str]]:
    qm = (ROOT / "scripts/managers/quest_manager.gd").read_text(encoding="utf-8")
    bumped = set(re.findall(r'_bump\(&"(\w+)"', qm))
    snap = re.search(r"func _snapshot\(.*?(?=^func )", qm, re.M | re.S)
    snapshotted = set(re.findall(r'&"(\w+)":', snap.group(0))) if snap else set()

    problems: list[str] = []
    goals = 0
    for tres in glob(ROOT, "data/quests/*.tres"):
        text = tres.read_text(encoding="utf-8")
        metric = re.search(r'^metric = &"(\w*)"', text, re.M)
        shape = re.search(r"^metric_shape = (\d+)", text, re.M)
        if not metric:
            problems.append(f"{tres.name}: no metric set")
            continue
        goals += 1
        name = metric.group(1)
        is_snapshot = bool(shape) and int(shape.group(1)) == 1
        if is_snapshot and name not in snapshotted:
            problems.append(
                f"{tres.name}: SNAPSHOT metric '{name}' has no case in "
                f"_snapshot() — the goal can never progress"
            )
        elif not is_snapshot and name not in bumped:
            problems.append(
                f"{tres.name}: CUMULATIVE metric '{name}' is never _bump()ed "
                f"— the goal can never progress"
            )
    return problems, [
        f"{goals} goals; {len(bumped)} counters fed, {len(snapshotted)} snapshots served"
    ]


# --- 3. every data-used enum value is dispatched ------------------------------

# .tres field -> (owning definition script stem, enum name), or None when the
# same field name belongs to different classes and must be resolved per file.
FIELD_ENUM: dict[str, tuple[str, str] | None] = {
    "reward_kind": None,
    "kind": None,
    "metric_shape": ("quest_definition", "MetricShape"),
    "effect_kind": ("skill_node_definition", "EffectKind"),
    "modifier_type": ("upgrade_definition", "ModifierType"),
}

EXT_SCRIPT = re.compile(r'\[ext_resource type="Script"[^\]]*path="([^"]+)"[^\]]*id="([^"]+)"')
SCRIPT_REF = re.compile(r'script\s*=\s*ExtResource\("([^"]+)"\)')
FIELD = re.compile(r"^([a-z_]\w*)\s*=\s*(.+)$", re.M)


def _class_name(stem: str) -> str:
    return "".join(part.title() for part in stem.split("_"))


def check_enum_handling() -> tuple[list[str], list[str]]:
    enums: dict[str, dict[str, list[str]]] = {}
    for gd in glob(ROOT, "scripts/data/*.gd"):
        for m in re.finditer(r"enum\s+(\w+)\s*\{(.*?)\}", gd.read_text(encoding="utf-8"), re.S):
            body = COMMENT.sub("", m.group(2))
            members = [p.split("=")[0].strip() for p in body.split(",") if p.split("=")[0].strip()]
            enums.setdefault(gd.stem, {})[m.group(1)] = members

    used: dict[tuple[str, str], set[str]] = collections.defaultdict(set)
    problems: list[str] = []
    for tres in glob(ROOT, "data/**/*.tres"):
        text = tres.read_text(encoding="utf-8")
        ext = {ident: p for p, ident in EXT_SCRIPT.findall(text)}
        ref = SCRIPT_REF.search(text)
        if not ref:
            continue
        stem = pathlib.Path(ext.get(ref.group(1), "?")).stem
        fields = dict(FIELD.findall(text.split("[resource]", 1)[-1]))
        for field, target in FIELD_ENUM.items():
            raw = fields.get(field, "").strip()
            if not re.fullmatch(r"-?\d+", raw):
                continue
            owner, ename = target or (
                stem,
                "RewardKind" if field == "reward_kind" else "Kind",
            )
            members = enums.get(owner, {}).get(ename)
            if members is None or not 0 <= int(raw) < len(members):
                problems.append(
                    f"{tres.relative_to(ROOT)}: {field} = {raw} does not resolve "
                    f"against {owner}.{ename}"
                )
                continue
            used[(owner, ename)].add(members[int(raw)])

    source = consumer_source()

    def qualified(owner: str, ename: str, member: str) -> str:
        return f"{_class_name(owner)}.{ename}.{member}"

    def wildcard_dispatch(owner: str, ename: str) -> bool:
        """A `match` branching on THIS class's enum that carries a `_:` routes
        every value the branches do not name. Scoped to the owning class so a
        shared enum name (two classes both spell theirs `Kind`) cannot borrow
        another's default branch."""
        needle = f"{_class_name(owner)}.{ename}."
        for m in re.finditer(r"^([ \t]*)match\s+.*?:[ \t]*$", source, re.M):
            indent = len(m.group(1))
            block: list[str] = []
            for line in source[m.end() :].split("\n"):
                if line.strip() and len(line) - len(line.lstrip()) <= indent:
                    break
                block.append(line)
            body = "\n".join(block)
            if needle in body and re.search(r"^[ \t]+_:[ \t]*$", body, re.M):
                return True
        return False

    def negation_excluded(owner: str, ename: str, member: str) -> bool:
        """`x != Kind.OTHER` handles every member except OTHER."""
        pattern = re.escape(_class_name(owner)) + r"\." + re.escape(ename) + r"\.(\w+)"
        return any(m.group(1) != member for m in re.finditer(r"!=\s*" + pattern, source))

    total = 0
    info: list[str] = []
    for (owner, ename), members in sorted(used.items()):
        short = owner.replace("_definition", "")
        implicit: list[str] = []
        for member in sorted(members):
            total += 1
            if qualified(owner, ename, member) in source:
                continue
            if negation_excluded(owner, ename, member):
                implicit.append(f"{member} (by !=)")
            elif wildcard_dispatch(owner, ename):
                implicit.append(f"{member} (by _:)")
            else:
                problems.append(
                    f"{short}.{ename}.{member} is used by data but no consumer "
                    f"dispatches it — the branch does not exist"
                )
        note = f"{short}.{ename}={len(members)}"
        if implicit:
            note += " [" + ", ".join(implicit) + "]"
        info.append(note)

    return problems, [f"{total} data-used values: " + ", ".join(info)]


# A "collect them all" achievement's target is not a balance number — it is a
# restatement of how much content ships. metric -> the directory that defines
# the things being collected.
COLLECTION_METRICS = {
    "pets_owned": "data/pets",
    "relics_owned": "data/relics",
}


def check_collection_targets() -> tuple[list[str], list[str]]:
    """Achievements that mean "own every X" must target exactly how many X ship.

    These are the only quests in the game that pay Astral Shards, so the
    numbers here decide whether the Shop's trails are reachable at all without
    paying. And the failure is silent in both directions: add a sixth relic
    and `a_relics_all` completes at five, so the game hands out the trophy
    while the collection screen still shows a gap; remove one and the trophy
    can never be earned and 150 shards leave the economy.
    """
    problems: list[str] = []
    checked = 0
    for tres in sorted((ROOT / "data" / "quests").glob("*.tres")):
        src = tres.read_text(encoding="utf-8")
        metric = re.search(r'^metric\s*=\s*&"([^"]+)"', src, re.M)
        target = re.search(r"^target\s*=\s*([0-9.]+)", src, re.M)
        if metric is None or target is None:
            continue
        directory = COLLECTION_METRICS.get(metric.group(1))
        if directory is None:
            continue
        # Only the "own every one" quests, not "own your first".
        if not tres.stem.endswith("_all"):
            continue
        checked += 1
        shipped = len(list((ROOT / directory).glob("*.tres")))
        if int(float(target.group(1))) != shipped:
            problems.append(
                f"{tres.relative_to(ROOT)}: targets {target.group(1)} but "
                f"{shipped} {metric.group(1).split('_')[0]} ship in {directory}/"
            )
    return problems, [f"{checked} collect-them-all achievements"]


CHECKS = [
    ("granted stats consumed", check_stat_wiring),
    ("goal metrics fed", check_goal_metrics),
    ("enum values dispatched", check_enum_handling),
    ("collection targets match shipped content", check_collection_targets),
]


def main() -> int:
    failed = 0
    for label, fn in CHECKS:
        problems, info = fn()
        note = "; ".join(info)
        if problems:
            failed += 1
            print(f"{label}: FAIL ({note})")
            for problem in problems:
                print(f"    {problem}")
        else:
            print(f"{label}: OK ({note})")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
