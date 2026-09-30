"""PNG renders -> WebP frames for the scroll-scrubbed hero.

  python blender/scripts/encode_frames.py            # both variants
  python blender/scripts/encode_frames.py --q 70     # different quality

Writes public/seq/<variant>/NNNN.webp plus public/seq/<variant>/manifest.json.
"""
import argparse
import glob
import json
import os

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "blender", "out")
DST = os.path.join(ROOT, "public", "seq")

VARIANTS = {
    # name: (source dir, output width)
    "desktop": ("hero-desktop", 1600),
    "mobile": ("hero-mobile", 720),
}

ap = argparse.ArgumentParser()
ap.add_argument("--q", type=int, default=72)
ap.add_argument("--only", default="")
args = ap.parse_args()

for name, (src, width) in VARIANTS.items():
    if args.only and name != args.only:
        continue
    files = sorted(glob.glob(os.path.join(SRC, src, "[0-9][0-9][0-9][0-9].png")))
    if not files:
        print("no frames for", name)
        continue
    meta = json.load(open(os.path.join(SRC, src, "meta.json")))
    out = os.path.join(DST, name)
    os.makedirs(out, exist_ok=True)
    total = 0
    for i, f in enumerate(files):
        im = Image.open(f).convert("RGB")
        h = round(im.height * width / im.width)
        im = im.resize((width, h), Image.LANCZOS)
        p = os.path.join(out, f"{i:04d}.webp")
        im.save(p, "WEBP", quality=args.q, method=6)
        total += os.path.getsize(p)
    manifest = {
        "count": len(files),
        "width": width,
        "height": h,
        "pattern": f"/seq/{name}/%04d.webp",
        # share of the frame width the thumbnail covers in the last frame,
        # centred; the page uses it to line up the hand-off
        "endFill": meta["end_fill"],
    }
    json.dump(manifest, open(os.path.join(out, "manifest.json"), "w"), indent=1)
    print(f"{name}: {len(files)} frames, {total / 1e6:.1f} MB, avg {total / len(files) / 1e3:.0f} kB")
