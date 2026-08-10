"""Tile the reference-shape captures into one image, labelled."""
import glob
import os
import sys

from PIL import Image, ImageDraw

SHAPE = "1080x1920_9-16"
SRC = "build/screenshots"
OUT = sys.argv[1] if len(sys.argv) > 1 else "build/screenshots/_contact-sheet.png"

paths = sorted(glob.glob(f"{SRC}/*__{SHAPE}.png"))
if not paths:
    raise SystemExit(f"no captures for {SHAPE} in {SRC}")

THUMB_W = 300
LABEL = 34
GAP = 10
COLS = 6

thumbs = []
for p in paths:
    name = os.path.basename(p).split("__")[0]
    im = Image.open(p).convert("RGB")
    h = round(im.height * THUMB_W / im.width)
    thumbs.append((name, im.resize((THUMB_W, h), Image.LANCZOS)))

cell_h = max(t.height for _, t in thumbs) + LABEL
rows = (len(thumbs) + COLS - 1) // COLS
W = COLS * THUMB_W + (COLS + 1) * GAP
H = rows * cell_h + (rows + 1) * GAP

sheet = Image.new("RGB", (W, H), (8, 8, 12))
draw = ImageDraw.Draw(sheet)

for i, (name, thumb) in enumerate(thumbs):
    col, row = i % COLS, i // COLS
    x = GAP + col * (THUMB_W + GAP)
    y = GAP + row * (cell_h + GAP)
    draw.text((x + 2, y + 8), name.upper(), fill=(255, 58, 70))
    sheet.paste(thumb, (x, y + LABEL))
    draw.rectangle([x, y + LABEL, x + THUMB_W - 1, y + LABEL + thumb.height - 1],
                   outline=(78, 78, 102))

sheet.save(OUT)
print(f"{OUT}  {sheet.width}x{sheet.height}  {len(thumbs)} screens @ {SHAPE}")
