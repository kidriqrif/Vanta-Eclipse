## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

**COVERAGE.** graphify parses C# and indexes the whole Unity codebase —
namespaces, classes, methods, and the call edges between them. Query it first
for anything under `Assets/`, for `tools/` (the validation sweep and the asset
generators), and for the large `design/` and `docs/` corpus. The coverage claim
is unconditional: there is no part of this repository the graph cannot see.

This replaces a long-standing caveat that said the opposite. graphify has no
tree-sitter grammar for GDScript, so for as long as the game was written in
`.gd` the graph contained none of it and a query about the managers was a
wasted step. The Godot→Unity port closed that gap by removing GDScript, and the
last `.gd` file is gone — the qualifier that used to sit here, about `scripts/`
and `scenes/` being invisible, retired with it.

The PreToolUse hooks graphify installs were removed deliberately, back when the
graph missed a third of the repository and the hooks asserted it should be
consulted before any raw file read. Now that everything is indexed that
reasoning no longer applies, and they can be re-added if wanted.
`graphify install --project --platform claude` puts them back and also rewrites
this section, so re-add this note if you ever reinstall.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## The design archive

`design/` is history, not instructions. It holds the UX specs, the GDD and the
per-milestone notes written while the game was being built, and the C# source
cites its sections by number (§4B, §7.2, the accessibility tiers). Those rules
are engine-independent and still binding.

Eight files there are named `milestone-*-godot-implementation-notes.md`. They
describe how a decision was implemented in the PREVIOUS engine. They were left
untouched on purpose when the Godot tree was deleted: rewriting them would
falsify a record of what was actually decided and why. Read them as history —
the reasoning transfers, the API calls do not.
