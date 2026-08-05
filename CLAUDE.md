## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

**COVERAGE — read this before trusting a query.** graphify has no tree-sitter
grammar for GDScript, so the graph contains **none of the ~69 `.gd` files that
are the actual game**. Measured on the first build: 530 Markdown nodes, 324
Python, 16 shell, 0 GDScript. It is genuinely useful for `tools/` (the
validation sweep and the asset generators) and for the large `design/` and
`docs/` corpus. For anything in `scripts/` or `scenes/` — managers, autoloads,
signals, scene wiring — go straight to Grep and Read; a query there returns
nothing useful and wastes a step.

The PreToolUse hooks graphify installs were removed deliberately for this
reason: they asserted the graph should be consulted before any raw file read,
which is wrong for a third of this repository. `graphify install --project
--platform claude` puts them back and also rewrites this section, so re-add
this note if you ever reinstall.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
