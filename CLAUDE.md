## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

**COVERAGE.** graphify parses C# and indexes the whole Unity codebase —
namespaces, classes, methods, and the call edges between them. Query it first
for anything under `Assets/`, for `tools/` (the validation sweep and the asset
generators), and for the large `design/` and `docs/` corpus. The coverage claim
is unconditional: there is no part of this repository the graph cannot see.

This replaces a long-standing caveat that said the opposite: the graph once
missed the entire game because it had no grammar for the language the game was
written in. Everything is C# now and everything is indexed.

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

`design/` holds the UX specs, the GDD, the per-milestone notes and the two live
process documents — `RELEASE-CHECKLIST.md` (what must exist before submission)
and `TESTING-GUIDE.md` (what must be proven, and in what order). The C# source
cites the specs by section number (§4B, §7.2, the accessibility tiers) and
those rules are binding.

**Every path it names is a live one.** The seven per-milestone
implementation-notes files that used to sit here described how a decision was
carried out in the previous engine; they are deleted, along with every dead
source pointer that was scattered through the remaining specs. Anything worth
keeping — a trap, a constraint, a reason — was rewritten as a statement about
the code that ships. `git show godot-final:<path>` recovers any of it.

The convention that keeps this true: **backticks mean a live path**, and a
file or tool being described historically goes in bold instead. Nothing
enforces it, so it is on whoever edits.
