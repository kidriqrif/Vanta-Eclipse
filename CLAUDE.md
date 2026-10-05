## graphify

This project uses graphify to keep a knowledge graph of the repository in
graphify-out/. It is the real graphify CLI, the `graphifyy` package on PyPI.
Install it once with `uv tool install graphifyy`.

**Build it before you query it.** graphify-out/ is gitignored, so a fresh clone
has no graph. `npm run graphify` (which runs `graphify update .`) builds or
refreshes it. The build is AST extraction only: no LLM, no API cost, and it
finishes in seconds. It writes graph.json, graph.html and GRAPH_REPORT.md.

**Coverage.** The graph covers:

- the TypeScript and TSX source: `src/`, `e2e/` and the root config files;
- the Android project's Java;
- the markdown in `design/`, `docs/` and the root files.

Markdown is indexed by its headings (section structure), not its prose. To see
what a spec actually says, read the spec. `.graphifyignore` keeps out the
lockfile, build output, and the audio and image binaries. The Gradle files are
only partly parsed.

Rules:
- For codebase questions, first run `graphify query "<question>"` when
  graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for
  relationships and `graphify explain "<concept>"` for focused concepts. These
  return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw
  grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of
  raw source browsing. `npm run graphify` does not create it; the full
  /graphify pipeline with --wiki does.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review, or when
  query, path and explain do not surface enough context.
- After modifying code, run `npm run graphify` to keep the graph current
  (AST-only, no API cost). The /graphify skill
  (`.claude/skills/graphify/SKILL.md`) runs the full pipeline, which adds LLM
  extraction of documents. It is not needed for code changes.

## The design archive

`design/` holds the GDD (`design/gdd/game-concept.md`), the per-milestone UX
specs in `design/ux/`, `design/player-journey.md` and
`design/accessibility-requirements.md`. The React source cites the specs by
milestone and section. For example, "M5 §2C" in `src/game/reducer.ts` means §2C
of `design/ux/milestone-5-bosses-worlds.md`. The rules the specs state are
binding, including the accessibility tiers.

`design/RELEASE-CHECKLIST.md` (what must be true before production) and
`design/TESTING-GUIDE.md` (what must be proven, and in what order) are the two
process documents, and `production/monetisation-switch.md` is the runbook for
turning on ads and billing. The automated checks are `npm run typecheck`,
`npm test` and `npm run e2e`; the Android build steps are in `README.md`.

**The specs predate the React build, and many still name Godot or Unity files
in backticks** (**Assets/Scripts/...**, **Assets/Resources/Prefabs/...**,
**tools/...**). Those paths no longer exist. Read them as history: the rule a
spec states binds, the file it names does not. To recover the old code:

- Godot: the `godot-final` tag exists on origin only. Run
  `git fetch origin tag godot-final`, then `git show godot-final:<path>`.
- Unity: the C# was deleted by commit 35935fb, so
  `git show 35935fb^:<path>` recovers it.

The convention for anything written from now on: **backticks mean a live
path**, one that exists in the repo now, and a file or tool described
historically goes in bold instead. Generated output (graphify-out/, dist/, the
web bundle that `npx cap sync` copies into the Android project) is named in
plain text. Nothing enforces the convention, so it is on whoever edits. Check
backticked paths with `ls` or `git ls-files` before committing.
