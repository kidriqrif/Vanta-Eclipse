## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

**COVERAGE.** graphify parses C# and indexes the whole Unity codebase —
namespaces, classes, methods, and the call edges between them. Measured on the
current build: 1432 nodes total — 541 Markdown, 356 Python, 346 C#, 22 JSON,
16 shell. Query it first for anything under `Assets/`, for `tools/` (the
validation sweep and the asset generators), and for the large `design/` and
`docs/` corpus.

This replaces a long-standing caveat that said the opposite. graphify has no
tree-sitter grammar for GDScript, so for as long as the game was written in
`.gd` the graph contained none of it and a query about the managers was a
wasted step. The Godot→Unity port removes that gap by removing GDScript: the
managers are C# now and the graph sees them. **While the port is in progress
the `scripts/` and `scenes/` trees still exist and are still invisible to the
graph** — for those, Grep and Read. That qualifier retires with the last `.gd`
file.

The PreToolUse hooks graphify installs were removed deliberately, back when
the graph missed a third of the repository and the hooks asserted it should be
consulted before any raw file read. That reasoning is weaker now that the game
code is indexed, but the hooks stay off until the Godot tree is gone and the
coverage claim is unconditional. `graphify install --project --platform claude`
puts them back and also rewrites this section, so re-add this note if you ever
reinstall.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
