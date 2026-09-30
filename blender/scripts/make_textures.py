"""Hand-rolled 16x16 block textures in a Minecraft-like style.

Own pixel art, generated from fixed seeds, so nothing here is copied from
Mojang's texture files. Palettes lean on the brand violet (#8200ff).
Run with the system Python (Pillow + numpy).
"""
import os
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "tex")
os.makedirs(OUT, exist_ok=True)


def save(name, arr):
    # stored 8x nearest-upscaled: Blender can then filter with mipmaps
    # (no sparkle at a distance) while the pixels stay hard up close
    im = Image.fromarray(arr.astype(np.uint8), "RGB").resize((128, 128), Image.NEAREST)
    im.save(os.path.join(OUT, name + ".png"))


def pick(rng, palette, weights, shape=(16, 16)):
    idx = rng.choice(len(palette), size=shape, p=np.array(weights) / sum(weights))
    return np.array(palette)[idx]


def end_stone():
    rng = np.random.default_rng(11)
    pal = [(222, 224, 162), (232, 234, 178), (208, 210, 148), (196, 197, 136)]
    img = pick(rng, pal, [5, 2, 3, 1])
    # a few darker pits, 2x1 or 1x2 like the real thing's crater dots
    for _ in range(9):
        x, y = rng.integers(0, 15, 2)
        img[y, x] = (176, 176, 118)
        if rng.random() < 0.6:
            img[y, x + 1] = (188, 189, 128)
    save("end_stone", img)


def obsidian(name="obsidian", seed=5, emit=False):
    rng = np.random.default_rng(seed)
    pal = [(16, 11, 26), (24, 16, 38), (34, 22, 54), (12, 8, 20)]
    img = pick(rng, pal, [4, 3, 1, 2])
    # violet streaks
    for _ in range(7):
        x, y = rng.integers(0, 14, 2)
        img[y, x] = (58, 36, 96)
        img[y, x + 1] = (46, 30, 78)
    save(name, img)
    if emit:
        mask = np.zeros((16, 16, 3), np.uint8)
        for _ in range(11):
            x, y = rng.integers(1, 15, 2)
            mask[y, x] = (150, 60, 255)
            if rng.random() < 0.5:
                mask[y + 1, x] = (110, 40, 230)
        save(name + "_emit", mask)
        base = img.copy()
        base[mask.sum(axis=2) > 0] = (92, 40, 170)
        save(name, base)


def amethyst():
    rng = np.random.default_rng(23)
    img = np.zeros((16, 16, 3), np.uint8)
    # diagonal facets
    for y in range(16):
        for x in range(16):
            band = ((x + y) // 3 + (x - y) // 5) % 4
            img[y, x] = [(142, 98, 214), (168, 128, 236), (118, 78, 190), (196, 160, 250)][band]
    noise = rng.integers(-10, 10, (16, 16, 1))
    img = np.clip(img.astype(int) + noise, 0, 255)
    save("amethyst", img)


def purpur():
    rng = np.random.default_rng(31)
    base = pick(rng, [(150, 104, 200), (160, 114, 210), (140, 96, 190)], [3, 2, 2])
    # 2x2 tile grid of 8x8 squares with darker grout and a light top-left bevel
    for y in range(16):
        for x in range(16):
            if x % 8 == 0 or y % 8 == 0:
                base[y, x] = (104, 70, 150)
            elif x % 8 == 1 or y % 8 == 1:
                base[y, x] = np.minimum(np.array(base[y, x]) + 22, 255)
    save("purpur", base)


def dark_side():
    rng = np.random.default_rng(41)
    img = pick(rng, [(20, 16, 30), (26, 20, 38), (17, 13, 26)], [3, 2, 2])
    for y in range(16):
        for x in range(16):
            if x in (0, 15) or y in (0, 15):
                img[y, x] = (40, 30, 62)
    save("tile_side", img)


if __name__ == "__main__":
    end_stone()
    obsidian()
    obsidian("crying_obsidian", seed=9, emit=True)
    amethyst()
    purpur()
    dark_side()
    print("textures ->", os.path.abspath(OUT), sorted(os.listdir(OUT)))
