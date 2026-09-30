"""Copy + resize the source assets (from the old carrd page and Discord) into public/.

  python tools/prepare_assets.py
"""
import os

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "assets-src")
PUB = os.path.join(ROOT, "public")
APP = os.path.join(ROOT, "src", "app")

# thumbnail file -> slug (order and names live in src/data/work.ts)
WORK = {
    "551b1a35": "diamond-squad",
    "01e8d4c9": "amethyst-gear",
    "1bb06b14": "trapped-twin",
    "1f539c23": "snow-standoff",
    "58fb15f2": "frost-axe",
    "51780447": "crown-maze",
    "4c38a6cf": "rainbow-blade",
    "7017df1c": "trim-set",
    "40536b0e": "void-orb",
    "bc098e1a": "dragon-army",
}

REVIEWS = {
    "c71eeaac": "jettism",
    "1a309329": "qbedwars",
    "6dca443b": "dewier",
    "1aa9ce8e": "itzblake",
    "b3964eb5": "jooonah",
    "a4c4bc07": "pigsruss",
}


def work():
    out = os.path.join(PUB, "work")
    os.makedirs(out, exist_ok=True)
    for key, slug in WORK.items():
        im = Image.open(os.path.join(SRC, f"gallery01_{key}_original.jpg")).convert("RGB")
        for w in (640, 1280, 1920):
            r = im if w == im.width else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
            r.save(os.path.join(out, f"{slug}-{w}.webp"), "WEBP", quality=82, method=6)
    print("work:", len(WORK), "thumbnails x 3 sizes")


def reviews():
    out = os.path.join(PUB, "reviews")
    os.makedirs(out, exist_ok=True)
    for key, name in REVIEWS.items():
        im = Image.open(os.path.join(SRC, f"slideshow01-{key}.jpg")).convert("RGB")
        # the avatar circle sits at x 53..396, y 69..410 on every slide
        av = im.crop((54, 69, 397, 412)).resize((160, 160), Image.LANCZOS)
        av.save(os.path.join(out, f"{name}.webp"), "WEBP", quality=85)
    print("reviews:", len(REVIEWS), "avatars")


def avatar():
    im = Image.open(os.path.join(SRC, "discord_avatar.png")).convert("RGB")
    im.save(os.path.join(PUB, "avatar.png"))
    im.resize((256, 256), Image.LANCZOS).save(os.path.join(APP, "icon.png"))
    im.resize((180, 180), Image.LANCZOS).save(os.path.join(APP, "apple-icon.png"))
    print("avatar + icons")


def og():
    # a frame of the hero film: the thumbnail framed by the island
    src = os.path.join(ROOT, "blender", "out", "hero-desktop", "0118.png")
    if not os.path.exists(src):
        print("og: render missing, skipped")
        return
    im = Image.open(src).convert("RGB")
    w, h = im.size
    tw, th = w, round(w * 630 / 1200)
    top = (h - th) // 2
    im = im.crop((0, top, tw, top + th)).resize((1200, 630), Image.LANCZOS)
    im.save(os.path.join(APP, "opengraph-image.jpg"), quality=86)
    print("og image")


if __name__ == "__main__":
    os.makedirs(APP, exist_ok=True)
    work()
    reviews()
    avatar()
    og()
