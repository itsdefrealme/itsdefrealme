"""Hero film: floating End-island blocks assemble into a 16x9-block frame,
the 144 frame tiles flip one by one and reveal a thumbnail, then the camera
pushes in until the thumbnail fills the shot.

Rendered frame by frame (no keyframes): every object's transform is computed
from the normalised time t in [0, 1]. That keeps the easing under exact
control for scroll-scrubbing and lets a crashed render resume where it stopped.

  blender -b --factory-startup --python hero.py -- --variant desktop
  blender -b --factory-startup --python hero.py -- --variant mobile --only 0,60,119 --pct 50
"""
import argparse
import json
import math
import os
import random
import sys
import time

import bmesh
import bpy
from mathutils import Quaternion, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")).replace("\\", "/")
TEX = ROOT + "/blender/tex/"
THUMB = ROOT + "/assets-src/gallery01_40536b0e_original.jpg"

# ---------------------------------------------------------------- arguments
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--variant", default="desktop", choices=["desktop", "mobile"])
ap.add_argument("--frames", type=int, default=144)
ap.add_argument("--only", default="")          # comma list of frame indices
ap.add_argument("--pct", type=int, default=100)
ap.add_argument("--samples", type=int, default=48)
ap.add_argument("--out", default="")
ap.add_argument("--force", action="store_true")
ap.add_argument("--diag", default="")
args = ap.parse_args(argv)

VARIANT = args.variant
RES = (1920, 1080) if VARIANT == "desktop" else (810, 1440)
OUT = args.out or f"{ROOT}/blender/out/hero-{VARIANT}"
os.makedirs(OUT, exist_ok=True)

rng = random.Random(7)

# ---------------------------------------------------------------- easing
def clamp01(x):
    return 0.0 if x < 0 else 1.0 if x > 1 else x

def lerp(a, b, u):
    return a + (b - a) * u

def ease_out_cubic(u):
    return 1 - (1 - u) ** 3

def ease_in_out_cubic(u):
    return 4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2

def ease_out_back(u, s=1.1):
    u -= 1
    return 1 + (s + 1) * u ** 3 + s * u ** 2

def smooth(u):
    return u * u * (3 - 2 * u)

# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x, sc.render.resolution_y = RES
sc.render.resolution_percentage = args.pct
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGB"
sc.render.film_transparent = False
sc.view_settings.view_transform = "Standard"   # exact sRGB for the thumbnail hand-off
sc.view_settings.look = "None"
sc.view_settings.exposure = 0.0
ee = sc.eevee
ee.taa_render_samples = args.samples
ee.use_raytracing = True
ee.use_shadows = True
ee.use_fast_gi = True
ee.fast_gi_method = "GLOBAL_ILLUMINATION"

# ---------------------------------------------------------------- materials
def img(path, closest=True):
    im = bpy.data.images.load(path, check_existing=True)
    return im

def block_mat(name, tex, emit_tex=None, emit_strength=0.0, rough=0.92, emit_color=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = 0.25
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img(TEX + tex)
    t.interpolation = "Linear"          # textures are 8x pre-upscaled, see make_textures.py
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    if emit_tex:
        e = nt.nodes.new("ShaderNodeTexImage")
        e.image = img(TEX + emit_tex)
        e.interpolation = "Linear"
        nt.links.new(e.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    elif emit_color:
        bsdf.inputs["Emission Color"].default_value = (*emit_color, 1)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    return m

def emit_mat(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    em.inputs["Strength"].default_value = strength
    nt.links.new(em.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    return m

def thumb_mat():
    m = bpy.data.materials.new("thumb")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img(THUMB)
    t.interpolation = "Linear"
    t.extension = "EXTEND"
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = 1.0
    nt.links.new(t.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    return m

M = {
    "end": block_mat("end_stone", "end_stone.png", rough=0.95),
    "obs": block_mat("obsidian", "obsidian.png", rough=0.35),
    "cry": block_mat("crying", "crying_obsidian.png", "crying_obsidian_emit.png", 6.0, rough=0.3),
    "ame": block_mat("amethyst", "amethyst.png", rough=0.25),
    "pur": block_mat("purpur", "purpur.png", rough=0.8),
    "side": block_mat("tile_side", "tile_side.png", rough=0.5),
    "rod": emit_mat("end_rod", (1.0, 0.93, 1.0), 14.0),
    "star": emit_mat("star", (0.85, 0.8, 1.0), 6.0),
    "thumb": thumb_mat(),
}

# ---------------------------------------------------------------- meshes
def cube_mesh(name, size=(1, 1, 1), front_rect=None):
    """Unit cube with a full 0..1 UV square on every face.
    front_rect=(u0, v0, u1, v1) maps the -Y face into that part of the
    image and gives it material slot 1."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        ui, vi = {0: (1, 2), 1: (0, 2), 2: (0, 1)}[ax]
        front = ax == 1 and n[1] < 0
        for lp in f.loops:
            co = lp.vert.co
            u, v = co[ui] + 0.5, co[vi] + 0.5
            if front and front_rect:
                u0, v0, u1, v1 = front_rect
                u, v = u0 + u * (u1 - u0), v0 + v * (v1 - v0)
            lp[uv].uv = (u, v)
        f.material_index = 1 if (front and front_rect) else 0
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me

SHARED = {}
def shared_cube(key):
    if key not in SHARED:
        me = cube_mesh("cube_" + key)
        me.materials.append(M[key])
        SHARED[key] = me
    return SHARED[key]

col = bpy.data.collections.new("hero")
sc.collection.children.link(col)

def add_obj(name, me):
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    ob.rotation_mode = "QUATERNION"
    return ob

# ---------------------------------------------------------------- layout
# 1 block = 1 m. Island top surface at z = 0. Inner frame: 16 x 9 tiles,
# columns x = -7.5 .. 7.5, rows z = 1.5 .. 9.5, block centres at y = 0.
BLOCKS = []   # dicts: ob, P (target), kind, t0, dur, S0 (scatter), drift, spin

STRUCT_CENTER = Vector((0, -1.5, 2.0))

def scatter_for(P, strength=1.0):
    """Exploded diorama: every piece keeps its place in the structure but is
    pushed out from the centre and lifted by layer, so frame 0 reads as the
    island in pieces rather than noise."""
    d = P - STRUCT_CENTER
    f = rng.uniform(1.25, 1.75)
    out = Vector((d.x * f, d.y * f, d.z * 1.7)) * strength + d * (1 - strength)
    lift = rng.uniform(3.0, 6.5)
    jitter = Vector((rng.uniform(-0.8, 0.8), rng.uniform(-0.8, 0.8), rng.uniform(-0.8, 0.8)))
    return STRUCT_CENTER + out + Vector((0, 0, lift)) + jitter

def rand_quat(lo=0.4, hi=1.6):
    axis = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))).normalized()
    return Quaternion(axis, rng.uniform(lo, hi))

def register(ob, P, kind, t0, dur, S0=None, strength=1.0):
    BLOCKS.append(dict(
        ob=ob, P=P.copy(), kind=kind, t0=t0, dur=dur,
        S0=S0 if S0 is not None else scatter_for(P, strength),
        drift=Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-.4, 1))) * rng.uniform(1.0, 3.0),
        q0=rand_quat(0.15, 0.9),
        spin=Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))).normalized(),
        spin_amt=rng.uniform(0.2, 0.7),
        arc=rng.uniform(0.5, 3.0),
    ))

# island: elliptical, deepest in the middle, ragged underside
cells = []
RX, RY, CY = 12.5, 6.0, -2.0
for ix in range(-13, 14):
    for iy in range(-7, 5):
        x, y = ix, iy
        r2 = (x / RX) ** 2 + ((y - CY) / RY) ** 2
        if r2 > 1.0 + rng.uniform(-0.08, 0.05):
            continue
        depth = 1 + int((1 - r2) * 4.2 + rng.uniform(-0.6, 0.9))
        cells.append((x, y, max(1, depth), r2))
for (x, y, depth, r2) in cells:
    for k in range(depth):
        z = -0.5 - k
        P = Vector((x, y, z))
        ob = add_obj(f"isl_{x}_{y}_{k}", shared_cube("end"))
        # build order: from the centre outwards, top layer last
        order = 0.55 * math.sqrt(r2) + 0.18 * (1 - k / 5)
        register(ob, P, "island", 0.03 + order * 0.30 + rng.uniform(0, 0.05), 0.15)

# small bumps on the island top, away from the frame footprint
for (x, y, depth, r2) in cells:
    if y < -1 and r2 < 0.75 and rng.random() < 0.12:
        P = Vector((x, y, 0.5))
        key = "ame" if rng.random() < 0.35 else "end"
        ob = add_obj(f"bump_{x}_{y}", shared_cube(key))
        register(ob, P, "island", 0.30 + rng.uniform(0, 0.12), 0.14)

# frame border: 18 x 11 ring, built from the bottom centre up both sides
ring_cells = []
for xi in range(18):
    ring_cells.append((xi - 8.5, 0.5))
    ring_cells.append((xi - 8.5, 10.5))
for zi in range(1, 10):
    ring_cells.append((-8.5, zi + 0.5))
    ring_cells.append((8.5, zi + 0.5))
ring_cells = sorted(set(ring_cells))
for (x, z) in ring_cells:
    corner = abs(x) == 8.5 and z in (0.5, 10.5)
    key = "pur" if corner else "cry"
    P = Vector((x, 0, z))
    ob = add_obj(f"frame_{x}_{z}", shared_cube(key))
    # angular order around the ring starting at bottom centre
    ang = math.atan2(x, -(z - 5.5))            # 0 at bottom centre, +-pi at top centre
    order = abs(ang) / math.pi
    register(ob, P, "frame", 0.26 + order * 0.22 + rng.uniform(0, 0.02), 0.13, strength=0.8)

# purpur pillars with end rods, left and right in front of the frame
PILLARS = [(-11, -3, 4), (10, -4, 3), (-9, -6, 2)]
RODS = []
for (x, y, h) in PILLARS:
    for k in range(h):
        P = Vector((x, y, 0.5 + k))
        ob = add_obj(f"pil_{x}_{y}_{k}", shared_cube("pur"))
        register(ob, P, "deco", 0.36 + k * 0.025 + rng.uniform(0, 0.02), 0.12)
    RODS.append(Vector((x, y, h + 0.5)))

rod_me = cube_mesh("rod", size=(0.14, 0.14, 1.0))
rod_me.materials.append(M["rod"])
base_me = cube_mesh("rodbase", size=(0.36, 0.36, 0.12))
base_me.materials.append(M["pur"])
ROD_LIGHTS = []
for i, P in enumerate(RODS):
    rod = add_obj(f"rod_{i}", rod_me)
    register(rod, P + Vector((0, 0, 0.0)), "rod", 0.50 + i * 0.03, 0.12, strength=0.6)
    L = bpy.data.lights.new(f"rodlight_{i}", "POINT")
    L.color = (0.82, 0.62, 1.0)
    L.shadow_soft_size = 0.3
    Lo = bpy.data.objects.new(f"rodlight_{i}", L)
    col.objects.link(Lo)
    Lo.location = P + Vector((0, 0, 0.2))
    ROD_LIGHTS.append((Lo, 0.50 + i * 0.03))

# 144 tiles: arrive dark side first, row by row from the bottom, then flip
TILES = []
for r in range(9):
    for c in range(16):
        rect = (c / 16, 1 - (r + 1) / 9, (c + 1) / 16, 1 - r / 9)
        me = cube_mesh(f"tile_{r}_{c}", front_rect=rect)
        me.materials.append(M["side"])
        me.materials.append(M["thumb"])
        ob = add_obj(f"tile_{r}_{c}", me)
        P = Vector((-7.5 + c, 0, 1.5 + (8 - r)))
        t0 = 0.40 + (8 - r) / 8 * 0.15 + rng.uniform(0, 0.025)
        S0 = P + Vector((rng.uniform(-6, 6), rng.uniform(4, 14), -rng.uniform(20, 30)))
        TILES.append(dict(ob=ob, P=P, r=r, c=c, t0=t0, dur=0.085, S0=S0,
                          twist=rng.uniform(-0.8, 0.8),
                          flip0=0.585 + (c + r) / 23 * 0.15 + rng.uniform(0, 0.012)))

# ambient debris: small blocks drifting around, cleared before the push-in
DEBRIS = []
for i in range(30):
    key = rng.choice(["end", "end", "obs", "ame", "pur"])
    ob = add_obj(f"debris_{i}", shared_cube(key))
    s = rng.uniform(0.22, 0.55)
    ang = rng.uniform(0, math.tau)
    rad = rng.uniform(14, 34)
    DEBRIS.append(dict(ob=ob, s=s, ang=ang, rad=rad, z=rng.uniform(-8, 16),
                       w=rng.uniform(0.25, 0.7) * rng.choice([-1, 1]),
                       q0=rand_quat(), spin=Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))).normalized(),
                       out=rng.uniform(0.70, 0.80)))

# stars: one mesh, many tiny cubes on a far shell
bm = bmesh.new()
for i in range(520):
    d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized()
    if d.y < -0.3:            # keep them behind / around, never right at the lens
        d.y = -d.y
    p = d * rng.uniform(140, 200)
    s = rng.choice([0.14, 0.18, 0.22, 0.28, 0.45])
    res = bmesh.ops.create_cube(bm, size=s)
    bmesh.ops.translate(bm, vec=p, verts=res["verts"])
me = bpy.data.meshes.new("stars")
bm.to_mesh(me)
bm.free()
me.materials.append(M["star"])
stars = bpy.data.objects.new("stars", me)
col.objects.link(stars)

# ---------------------------------------------------------------- world
w = bpy.data.worlds.new("void")
sc.world = w
w.use_nodes = True
nt = w.node_tree
bg = nt.nodes["Background"]
tc = nt.nodes.new("ShaderNodeTexCoord")
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
ramp = nt.nodes.new("ShaderNodeValToRGB")
nt.links.new(tc.outputs["Generated"], sep.inputs[0])
nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
cr = ramp.color_ramp
cr.elements[0].position = 0.30
cr.elements[0].color = (0.004, 0.002, 0.010, 1)
cr.elements[1].position = 0.52
cr.elements[1].color = (0.030, 0.010, 0.080, 1)
e3 = cr.elements.new(0.80)
e3.color = (0.006, 0.003, 0.016, 1)
nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 1.0
# no world volume: Eevee treats it as infinite and it swallows the sun

# ---------------------------------------------------------------- lights
def add_light(name, kind, loc, rot=None, energy=100, color=(1, 1, 1), size=1.0, target=None):
    L = bpy.data.lights.new(name, kind)
    L.energy = energy
    L.color = color
    if kind == "AREA":
        L.size = size
    elif kind == "SUN":
        L.angle = math.radians(size)
    o = bpy.data.objects.new(name, L)
    col.objects.link(o)
    o.location = loc
    if target is not None:
        d = Vector(target) - Vector(loc)
        o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return o

add_light("key", "SUN", (-30, -40, 50), energy=4.8, color=(1.0, 0.93, 0.80), size=6, target=(0, 0, 0))
add_light("rim", "AREA", (0, 16, 12), energy=9000, color=(0.51, 0.1, 1.0), size=14, target=(0, 0, 4))
add_light("fill", "AREA", (26, -20, 6), energy=380, color=(0.72, 0.76, 1.0), size=12, target=(0, 0, 2))
add_light("under", "AREA", (0, -4, -14), energy=1300, color=(0.5, 0.2, 1.0), size=16, target=(0, -2, 0))

# ---------------------------------------------------------------- camera
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 50
cam_data.sensor_width = 36
cam_data.sensor_fit = "HORIZONTAL"
cam_data.clip_start = 0.1
cam_data.clip_end = 600
cam_data.dof.use_dof = True
cam = bpy.data.objects.new("cam", cam_data)
col.objects.link(cam)
sc.camera = cam
focus = bpy.data.objects.new("focus", None)
col.objects.link(focus)
cam_data.dof.focus_object = focus

HFOV_HALF_TAN = (cam_data.sensor_width / 2) / cam_data.lens      # 0.36
FULL_FILL = 8.0 / HFOV_HALF_TAN                                  # 22.22 m from the tile faces

if VARIANT == "desktop":
    END_FILL = 0.995                          # tiny overscan, no slivers at the edges
    CAM = dict(
        start=dict(az=-34, el=17, dist=84, tgt=(-19.5, -1, 2.8)),   # cloud in the right half, copy on the left
        mid=dict(az=-15, el=8, dist=44, tgt=(0, 0, 4.6)),
    )
else:
    END_FILL = 0.88                           # thumbnail spans 88% of the phone width
    CAM = dict(
        start=dict(az=-24, el=14, dist=74, tgt=(0, -1, 14.5)),   # scene sits low, copy on top
        mid=dict(az=-12, el=7, dist=54, tgt=(0, 0, 6.0)),
    )
END_DIST = FULL_FILL / END_FILL + 0.5         # measured from block centres (y = 0)
CAM["end"] = dict(az=0.0, el=0.0, dist=END_DIST, tgt=(0, 0, 5.5))

def cam_params(t):
    a, m, e = CAM["start"], CAM["mid"], CAM["end"]
    if t <= 0.60:
        u = ease_in_out_cubic(t / 0.60)
        p0, p1 = a, m
    else:
        u = ease_in_out_cubic(clamp01((t - 0.62) / 0.35))
        p0, p1 = m, e
    az = lerp(p0["az"], p1["az"], u)
    el = lerp(p0["el"], p1["el"], u)
    dist = lerp(p0["dist"], p1["dist"], u)
    tgt = Vector(p0["tgt"]).lerp(Vector(p1["tgt"]), u)
    return az, el, dist, tgt

def place_camera(t):
    az, el, dist, tgt = cam_params(t)
    a, e = math.radians(az), math.radians(el)
    off = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    cam.location = tgt + off
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (tgt - cam.location).to_track_quat("-Z", "Y")
    focus.location = tgt + Vector((0, -0.5, 0))
    cam_data.dof.aperture_fstop = lerp(2.2, 16.0, smooth(clamp01((t - 0.35) / 0.5)))

# ---------------------------------------------------------------- state(t)
QI = Quaternion()

def apply_state(t):
    for b in BLOCKS:
        ob, P = b["ob"], b["P"]
        drift_t = min(t, b["t0"])
        S = b["S0"] + b["drift"] * drift_t + Vector((0, 0, math.sin(drift_t * 9 + b["arc"]) * 0.4))
        qS = Quaternion(b["spin"], b["spin_amt"] * drift_t * 4) @ b["q0"]
        u = clamp01((t - b["t0"]) / b["dur"])
        if u <= 0:
            ob.location, ob.rotation_quaternion = S, qS
        else:
            ep = ease_out_back(u, 0.9)
            pos = S.lerp(P, ep) + Vector((0, 0, math.sin(math.pi * min(u, 1)) * b["arc"]))
            ob.location = pos
            ob.rotation_quaternion = qS.slerp(QI, ease_out_cubic(u))
        ob.scale = (1, 1, 1)

    for tl in TILES:
        ob, P = tl["ob"], tl["P"]
        flipped = Quaternion((1, 0, 0), math.pi)
        u = clamp01((t - tl["t0"]) / tl["dur"])
        if u <= 0:
            ob.location = tl["S0"]
            ob.rotation_quaternion = Quaternion((0, 0, 1), tl["twist"]) @ flipped
            ob.scale = (0.94,) * 3
            continue
        e = ease_out_back(u, 0.7)
        ob.location = tl["S0"].lerp(P, e)
        ob.rotation_quaternion = Quaternion((0, 0, 1), tl["twist"] * (1 - ease_out_cubic(u))) @ flipped
        ob.scale = (0.94,) * 3
        f = clamp01((t - tl["flip0"]) / 0.075)
        if f > 0:
            ef = ease_in_out_cubic(f)
            ob.rotation_quaternion = Quaternion((1, 0, 0), math.pi * (1 - ef))
            ob.location = P + Vector((0, -0.75 * math.sin(math.pi * ef), 0))
            s = lerp(0.94, 1.0, smooth(f)) - 0.08 * math.sin(math.pi * ef)
            ob.scale = (s, s, s)

    for d in DEBRIS:
        ang = d["ang"] + d["w"] * t * 2.2
        rad = d["rad"] + max(0, t - d["out"]) * 120
        ob = d["ob"]
        ob.location = Vector((math.cos(ang) * rad, math.sin(ang) * rad * 0.8 + 2, d["z"] + math.sin(t * 6 + d["ang"]) * 0.8))
        ob.rotation_quaternion = Quaternion(d["spin"], t * 5) @ d["q0"]
        s = d["s"] * (1 - smooth(clamp01((t - d["out"]) / 0.08)))
        ob.scale = (s, s, s)

    for (Lo, t_on) in ROD_LIGHTS:
        Lo.data.energy = 140 * smooth(clamp01((t - t_on - 0.08) / 0.06))

    place_camera(t)

# ---------------------------------------------------------------- compositor bloom
def setup_bloom():
    sc.render.use_compositing = True
    ng = bpy.data.node_groups.new("comp", "CompositorNodeTree")
    sc.compositing_node_group = ng
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = ng.nodes.new("CompositorNodeRLayers")
    gl = ng.nodes.new("CompositorNodeGlare")
    out = ng.nodes.new("NodeGroupOutput")
    def setv(name, val):
        if name in gl.inputs:
            gl.inputs[name].default_value = val
            return True
        key = name.lower().replace(" ", "_")
        if hasattr(gl, key):
            try:
                setattr(gl, key, val)
                return True
            except Exception:
                pass
        return False
    if "Type" in gl.inputs:
        gl.inputs["Type"].default_value = "Bloom"
    elif hasattr(gl, "glare_type"):
        gl.glare_type = "BLOOM"
    setv("Threshold", 1.15)
    setv("Strength", 0.55)
    setv("Size", 0.6)
    setv("Quality", "High") if "Quality" in gl.inputs else None
    ng.links.new(rl.outputs["Image"], gl.inputs["Image"])
    ng.links.new(gl.outputs["Image"], out.inputs[0])
    print("GLARE INPUTS", [(i.name, getattr(i, "default_value", None)) for i in gl.inputs])

setup_bloom()

if args.diag:
    keep_lights = args.diag in ("novol",)
    for o in list(col.objects):
        if o.type == "LIGHT" and o.name != "key" and not keep_lights:
            o.hide_render = True
    for o in col.objects:
        if o.type == "LIGHT":
            print("LIGHT", o.name, o.data.type, o.data.energy, tuple(o.matrix_world.to_quaternion() @ Vector((0, 0, -1))))

# ---------------------------------------------------------------- export the hand-off geometry
meta = dict(variant=VARIANT, frames=args.frames, width=RES[0], height=RES[1],
            end_fill=END_FILL, thumb=os.path.basename(THUMB))
with open(f"{OUT}/meta.json", "w") as fh:
    json.dump(meta, fh, indent=1)

# ---------------------------------------------------------------- render loop
N = args.frames
frames = [int(x) for x in args.only.split(",")] if args.only else list(range(N))
print(f"objects: blocks={len(BLOCKS)} tiles={len(TILES)} debris={len(DEBRIS)}; rendering {len(frames)} frames -> {OUT}")
t_all = time.time()
for i in frames:
    path = f"{OUT}/{i:04d}.png"
    if os.path.exists(path) and not args.force:
        continue
    t = i / (N - 1)
    apply_state(t)
    sc.render.filepath = path
    t1 = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"FRAME {i} t={t:.3f} {time.time() - t1:.1f}s", flush=True)
print(f"DONE {time.time() - t_all:.0f}s")
