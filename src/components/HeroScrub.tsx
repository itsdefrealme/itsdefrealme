"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { ArrowRight, DiscordLogo } from "@phosphor-icons/react";
import { LINKS } from "@/data/site";
import { Embers } from "./Embers";

/**
 * The hero is a Blender film (blender/scripts/hero.py) scrubbed by scroll:
 * End-stone blocks fly together into a 16 x 9 block frame, the 144 tiles flip
 * over into a thumbnail, and the camera pushes in until it fills the screen.
 * Frames are WebP stills drawn to a canvas; they load coarse-to-fine (every
 * 16th, 8th, 4th ...) so scrubbing works long before the last one arrives.
 *
 * While the key frames load it reports progress with a "hero-progress"
 * window event, which the Loader screen listens to.
 */

type Variant = "desktop" | "mobile";
type Manifest = { count: number; width: number; height: number; pattern: string; endFill: number };

const STATIC_AT = 0.86; // frame shown with reduced motion: the finished frame on the island
const pickVariant = (): Variant => (window.innerWidth / window.innerHeight < 0.85 ? "mobile" : "desktop");
const frameUrl = (m: Manifest, i: number) => m.pattern.replace("%04d", String(i).padStart(4, "0"));
const reportProgress = (v: number) => window.dispatchEvent(new CustomEvent("hero-progress", { detail: v }));

function loadOrder(count: number) {
  const seen = new Set<number>();
  const order: number[] = [];
  const push = (i: number) => {
    if (i >= 0 && i < count && !seen.has(i)) {
      seen.add(i);
      order.push(i);
    }
  };
  push(0);
  push(count - 1);
  for (const stride of [16, 8, 4, 2, 1]) for (let i = 0; i < count; i += stride) push(i);
  return order;
}

export function HeroScrub() {
  const track = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const [variant, setVariant] = useState<Variant | null>(null);

  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 170, damping: 32, mass: 0.35, restDelta: 0.0004 });
  // function-form transforms on purpose: the range form gets handed to a
  // native scroll timeline for opacity, which ignored the track offsets here
  const copyOpacity = useTransform(scrollYProgress, (v) => 1 - Math.min(1, v / 0.08));
  const copyY = useTransform(scrollYProgress, (v) => -48 * Math.min(1, v / 0.08));
  const scrimOpacity = useTransform(scrollYProgress, (v) => 1 - Math.min(1, v / 0.14));
  // faded-out buttons must not keep catching clicks over the film
  const copyPointer = useTransform(scrollYProgress, (v) => (v > 0.06 ? "none" : "auto"));

  // everything the draw loop touches lives in a ref, never in React state
  const player = useRef({
    m: null as Manifest | null,
    frames: [] as (HTMLImageElement | null)[],
    want: 0,
    drawn: -1,
    dirty: true,
  });

  // draw the loaded frame closest to the wanted one, scaled to cover the canvas
  function draw() {
    const c = canvas.current;
    const p = player.current;
    const m = p.m;
    if (!c || !m) return;

    let idx = -1;
    for (let d = 0; d < m.count; d++) {
      if (p.frames[p.want - d]) {
        idx = p.want - d;
        break;
      }
      if (p.frames[p.want + d]) {
        idx = p.want + d;
        break;
      }
    }
    if (idx < 0 || (idx === p.drawn && !p.dirty)) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(c.clientWidth * dpr);
    const h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext("2d");
    const img = p.frames[idx];
    if (!ctx || !img) return;
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * k;
    const dh = img.naturalHeight * k;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    p.drawn = idx;
    p.dirty = false;
  }

  // pick the frame set once, and again if the screen flips orientation
  useEffect(() => {
    setVariant(pickVariant());
    let t = 0;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        setVariant(pickVariant());
        player.current.dirty = true;
        draw();
      }, 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load the chosen frame set
  useEffect(() => {
    if (!variant || reduce === null) return;
    let dead = false;
    const p = player.current;
    p.m = null;
    p.frames = [];
    p.drawn = -1;
    p.dirty = true;

    (async () => {
      const res = await fetch(`/seq/${variant}/manifest.json`);
      const m: Manifest = await res.json();
      if (dead) return;
      p.m = m;
      p.frames = new Array(m.count).fill(null);
      p.want = reduce ? Math.round(STATIC_AT * (m.count - 1)) : Math.round(progress.get() * (m.count - 1));

      const order = reduce ? [p.want] : loadOrder(m.count);
      // the Loader waits for these "key" frames (every 8th, plus the last)
      const key = new Set(reduce ? [p.want] : order.filter((i) => i % 8 === 0 || i === m.count - 1));
      let keyLoaded = 0;
      reportProgress(0);

      let next = 0;
      const worker = async () => {
        while (!dead && next < order.length) {
          const i = order[next++];
          const img = new Image();
          img.decoding = "async";
          img.src = frameUrl(m, i);
          try {
            await img.decode();
          } catch {
            continue;
          }
          if (dead) return;
          p.frames[i] = img;
          if (key.has(i)) {
            keyLoaded++;
            reportProgress(keyLoaded / key.size);
          }
          // redraw only if this frame is closer to the wanted one than what is on screen
          if (p.drawn < 0 || Math.abs(i - p.want) < Math.abs(p.drawn - p.want)) {
            p.dirty = true;
            draw();
          }
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
    })().catch(() => {
      // frames could not load: the poster image stays visible, let the Loader go
      reportProgress(1);
    });

    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, reduce]);

  useMotionValueEvent(progress, "change", (v) => {
    const p = player.current;
    if (!p.m || reduce) return;
    p.want = Math.round(Math.min(1, Math.max(0, v)) * (p.m.count - 1));
    draw();
  });

  const posterIndex = reduce ? String(Math.round(STATIC_AT * 143)).padStart(4, "0") : "0000";

  return (
    <section
      id="top"
      ref={track}
      aria-label="Intro"
      className={reduce ? "relative h-[100dvh]" : "relative h-[360vh] md:h-[420vh]"}
    >
      <div className="sticky top-0 h-[100dvh] overflow-hidden bg-bg">
        {/* first frame as a real image, so the hero paints before any script runs */}
        <picture>
          <source media="(max-aspect-ratio: 17/20)" srcSet={`/seq/mobile/${posterIndex}.webp`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/seq/desktop/${posterIndex}.webp`}
            alt=""
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </picture>
        <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" />

        {/* drifting particles + slow purple glow */}
        <Embers progress={progress} />

        {/* legibility scrim behind the copy, gone once the film takes over */}
        <motion.div
          aria-hidden
          style={{ opacity: reduce ? 1 : scrimOpacity }}
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(10_8_16/0.9)_0%,rgb(10_8_16/0.55)_38%,transparent_62%)] md:bg-[linear-gradient(90deg,rgb(10_8_16/0.92)_0%,rgb(10_8_16/0.6)_34%,transparent_58%)]"
        />

        <motion.div
          style={reduce ? undefined : { opacity: copyOpacity, y: copyY, pointerEvents: copyPointer }}
          className="relative z-10 mx-auto flex h-full max-w-[1400px] flex-col px-5 pt-24 md:justify-center md:px-8 md:pt-0"
        >
          <div className="max-w-[56rem]">
            <h1 className="mc-text text-[2.1rem] leading-[1.12] text-balance sm:text-5xl lg:text-[2.8rem] lg:text-wrap">
              Minecraft Thumbnail <br className="hidden lg:block" />
              Designer
            </h1>
            <p className="mt-5 max-w-[40ch] text-base leading-relaxed text-muted sm:mt-6 sm:text-lg">
              Professional Minecraft Thumbnails for YouTubers. From $15 to $35, delivered in 24HRS to 72HRS, with
              unlimited free revisions.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-9">
              <a
                href={LINKS.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2.5 bg-accent px-6 font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-accent-hi active:translate-y-px"
              >
                <DiscordLogo size={20} weight="fill" aria-hidden />
                Order on Discord
              </a>
              <a
                href="#work"
                className="group inline-flex h-12 items-center gap-2 border border-white/20 bg-bg/40 px-6 font-semibold text-ink backdrop-blur-sm transition-[border-color,transform] duration-200 hover:border-white/45 active:translate-y-px"
              >
                See the work
                <ArrowRight
                  size={18}
                  aria-hidden
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
