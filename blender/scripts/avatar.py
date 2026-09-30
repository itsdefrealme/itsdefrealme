"""Contact-section loop: the Discord avatar as a 40 x 40 block relief.

Every pixel becomes a block column; brighter pixels stand further out, the
violet eye glows. A ripple runs out from the eye and the camera sways, both
on whole cycles, so frame N wraps cleanly to frame 0.

  blender -b --factory-startup --python avatar.py -- [--only 0,40] [--pct 50]
"""
import argparse
import json
import math
import os
import sys
import time

import bmesh
import bpy
from mathutils import Quaternion, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")).replace("\\", "/")
TEX = ROOT + "/blender/tex/"
PX = json.load(open(ROOT + "/blender/out/avatar_px.json"))

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--frames", type=int, default=150)
ap.add_argument("--only", default="")
ap.add_argument("--pct", type=int, default=100)
ap.add_argument("--samples", type=int, default=48)
ap.add_argument("--out", default=ROOT + "/blender/out/avatar")
ap.add_argument("--force", action="store_true")
args = ap.parse_args(argv)
os.makedirs(args.out, exist_ok=True)

BG = (10 / 255, 8 / 255, 16 / 255)          # page background #0a0810 (sRGB)


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def smooth(e0, e1, x):
    u = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return u * u * (3 - 2 * u)


bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = sc.render.resolution_y = 960
sc.render.resolution_percentage = args.pct
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGB"
sc.render.film_transparent = True
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"
ee = sc.eevee
ee.taa_render_samples = args.samples
ee.use_raytracing = True
ee.use_shadows = True
ee.use_fast_gi = True
ee.fast_gi_method = "GLOBAL_ILLUMINATION"

# ---------------------------------------------------------------- material
# colour comes from the object (Object Info > Color), glow from a custom prop,
# and a faint block texture is multiplied in so faces read as blocks.
mat = bpy.data.materials.new("voxel")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.55
bsdf.inputs["Specular IOR Level"].default_value = 0.35
info = nt.nodes.new("ShaderNodeObjectInfo")
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(TEX + "voxel_face.png")
tex.interpolation = "Linear"
bw = nt.nodes.new("ShaderNodeRGBToBW")
mapr = nt.nodes.new("ShaderNodeMapRange")
mapr.inputs["From Min"].default_value = 0.55
mapr.inputs["From Max"].default_value = 0.95
mapr.inputs["To Min"].default_value = 0.62
mapr.inputs["To Max"].default_value = 1.05
mul = nt.nodes.new("ShaderNodeMix")
mul.data_type = "RGBA"
mul.blend_type = "MULTIPLY"
mul.inputs["Factor"].default_value = 1.0
glow = nt.nodes.new("ShaderNodeAttribute")
glow.attribute_type = "OBJECT"
glow.attribute_name = "glow"
nt.links.new(tex.outputs["Color"], bw.inputs[0])
nt.links.new(bw.outputs[0], mapr.inputs["Value"])
nt.links.new(info.outputs["Color"], mul.inputs[6])
nt.links.new(mapr.outputs["Result"], mul.inputs[7])
nt.links.new(mul.outputs[2], bsdf.inputs["Base Color"])
nt.links.new(info.outputs["Color"], bsdf.inputs["Emission Color"])
nt.links.new(glow.outputs["Fac"], bsdf.inputs["Emission Strength"])

# ---------------------------------------------------------------- blocks
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
uv = bm.loops.layers.uv.new("UVMap")
for f in bm.faces:
    ax = max(range(3), key=lambda i: abs(f.normal[i]))
    ui, vi = {0: (1, 2), 1: (0, 2), 2: (0, 1)}[ax]
    for lp in f.loops:
        lp[uv].uv = (lp.vert.co[ui] + 0.5, lp.vert.co[vi] + 0.5)
cube = bpy.data.meshes.new("cube")
bm.to_mesh(cube)
bm.free()
cube.materials.append(mat)

N = PX["n"]
BLOCKS = []
EYE = Vector((20.5, 0, 20.5))   # centre of the glowing eye in grid coords (x, -, row-from-top)
for row in range(N):
    for colx in range(N):
        r, g, b = [c / 255 for c in PX["px"][row][colx]]
        lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        sat = max(r, g, b) - min(r, g, b)
        ob = bpy.data.objects.new(f"v_{row}_{colx}", cube)
        sc.collection.objects.link(ob)
        ob.rotation_mode = "QUATERNION"
        ob.color = (srgb_to_lin(r), srgb_to_lin(g), srgb_to_lin(b), 1)
        depth = 0.3 + (lum ** 1.1) * 4.2           # how far the column stands out
        glow_amt = sat * smooth(0.12, 0.45, lum) * 2.6 + smooth(0.7, 0.95, lum) * 0.9
        x = colx - (N - 1) / 2
        z = (N - 1) / 2 - row
        dist = math.hypot(colx - EYE.x, row - EYE.z)
        BLOCKS.append(dict(ob=ob, x=x, z=z, depth=depth, glow=glow_amt, dist=dist))
        ob["glow"] = glow_amt

# ---------------------------------------------------------------- lights
def light(name, kind, loc, energy, color, size, target=(0, 0, 0)):
    L = bpy.data.lights.new(name, kind)
    L.energy = energy
    L.color = color
    if kind == "AREA":
        L.size = size
    else:
        L.angle = math.radians(size)
    o = bpy.data.objects.new(name, L)
    sc.collection.objects.link(o)
    o.location = loc
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y")
    return o

light("key", "SUN", (-30, -40, 45), 1.7, (1.0, 0.95, 0.9), 8)
light("rim", "AREA", (34, 12, 22), 16000, (0.51, 0.1, 1.0), 18)
light("rim2", "AREA", (-30, 16, -20), 7000, (0.4, 0.2, 1.0), 16)

w = bpy.data.worlds.new("w")
sc.world = w
w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.004, 0.003, 0.008, 1)

# ---------------------------------------------------------------- camera
cd = bpy.data.cameras.new("cam")
cd.lens = 85
cd.sensor_width = 36
cam = bpy.data.objects.new("cam", cd)
sc.collection.objects.link(cam)
sc.camera = cam
cam.rotation_mode = "QUATERNION"
DIST = 118

# ---------------------------------------------------------------- compositor: bloom, then over the page colour
sc.render.use_compositing = True
ng = bpy.data.node_groups.new("comp", "CompositorNodeTree")
sc.compositing_node_group = ng
ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
rl = ng.nodes.new("CompositorNodeRLayers")
gl = ng.nodes.new("CompositorNodeGlare")
gl.inputs["Type"].default_value = "Bloom"
gl.inputs["Threshold"].default_value = 1.0
gl.inputs["Strength"].default_value = 0.45
gl.inputs["Size"].default_value = 0.7
over = ng.nodes.new("CompositorNodeAlphaOver")
out = ng.nodes.new("NodeGroupOutput")
bg_lin = tuple(srgb_to_lin(c) for c in BG)
ng.links.new(rl.outputs["Image"], gl.inputs["Image"])
# Alpha Over: first image input = background, second = foreground
img_inputs = [i for i in over.inputs if i.type == "RGBA"]
img_inputs[0].default_value = (*bg_lin, 1)
ng.links.new(gl.outputs["Image"], img_inputs[1])
ng.links.new(over.outputs[0], out.inputs[0])
print("ALPHAOVER INPUTS", [(i.name, i.type) for i in over.inputs])

# ---------------------------------------------------------------- state
def apply(t):
    ph = t * math.tau
    for b in BLOCKS:
        # ripple travelling out from the eye, two rings per loop
        wave = math.sin(ph * 2 - b["dist"] * 0.42)
        bump = max(0.0, wave) ** 3 * 0.9
        d = b["depth"] + bump
        ob = b["ob"]
        ob.scale = (1, 1 + d, 1)
        ob.location = (b["x"], 0.5 - (1 + d) / 2, b["z"])   # back face fixed at y = +0.5
        pulse = 0.82 + 0.18 * math.sin(ph * 2 - b["dist"] * 0.42 + 0.6)
        ob["glow"] = b["glow"] * pulse
    az = math.radians(15 * math.sin(ph))
    el = math.radians(7 + 5 * math.cos(ph))
    off = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * DIST
    tgt = Vector((0, -1.2, 0))
    cam.location = tgt + off
    cam.rotation_quaternion = (tgt - cam.location).to_track_quat("-Z", "Y")


frames = [int(x) for x in args.only.split(",")] if args.only else list(range(args.frames))
t_all = time.time()
for i in frames:
    path = f"{args.out}/{i:04d}.png"
    if os.path.exists(path) and not args.force:
        continue
    apply(i / args.frames)
    # object props are not tracked by the depsgraph on their own
    for b in BLOCKS:
        b["ob"].update_tag()
    sc.render.filepath = path
    t1 = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"FRAME {i} {time.time() - t1:.1f}s", flush=True)
print(f"DONE {time.time() - t_all:.0f}s")
