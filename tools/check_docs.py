#!/usr/bin/env python3
"""The published docs match what tools/make_docs.py produces from the code.

This is check_generated.py's argument applied to prose instead of pixels. That
check asks whether the shipped sprites are still what make_sprites.py draws;
this one asks whether the README's numbers and the public site are still what
the project actually is.

The failure it prevents is not hypothetical here. Inside a single session this
repository was found claiming 19 autoloads with 20 declared, describing a
shader deleted two restyles earlier in the present tense, asserting the game
had no audio while sixteen sound files sat in audio/, and serving a landing
page in two colours that no longer existed anywhere in the project. Each was
written accurately and then quietly stopped being true, because nothing about
editing code makes anyone reread a paragraph.

A checker cannot make prose honest. It can make a stale NUMBER impossible,
which is most of what goes wrong, and it can keep the public page from drifting
off the palette everything else is held to.

render() is imported from make_docs rather than reimplemented, so the generator
and the check cannot disagree about what "correct" means — a check with its own
opinion of the right answer is a second thing to keep in sync, not a guard.
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from make_docs import render  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main() -> int:
    expected = render()

    # A render that produced nothing would otherwise pass silently, which is
    # the shape of every vacuous check this project has had to fix.
    if len(expected) < 3:
        print(f"docs match the code: FAIL (make_docs produced only "
              f"{len(expected)} file(s))")
        return 1

    stale: list[str] = []
    for name, content in expected.items():
        path = ROOT / name
        if not path.exists():
            stale.append(f"{name}: missing")
            continue
        actual = path.read_text(encoding="utf-8")
        if actual == content:
            continue
        # Report the first differing line: "the file differs" sends someone
        # diffing 200 lines of base64 to find a changed integer.
        actual_lines = actual.splitlines()
        expected_lines = content.splitlines()
        where = "end of file"
        for number, (a, b) in enumerate(zip(actual_lines, expected_lines), 1):
            if a != b:
                where = f"line {number}\n        committed: {a.strip()[:90]}\n" \
                        f"        should be: {b.strip()[:90]}"
                break
        else:
            where = (f"length differs — {len(actual_lines)} lines committed, "
                     f"{len(expected_lines)} expected")
        stale.append(f"{name}: {where}")

    if stale:
        print(f"docs match the code: FAIL ({len(expected)} documents checked)")
        for item in stale:
            print(f"    {item}")
        print("    run: python tools/make_docs.py")
        return 1
    print(f"docs match the code: OK ({len(expected)} documents, "
          "every figure read from the file that defines it)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
