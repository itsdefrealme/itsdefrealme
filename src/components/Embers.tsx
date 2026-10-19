"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion, type MotionValue } from "motion/react";

/**
 * The drifting purple particles and slow glow over the hero.
 * - big dim "dust" blocks and small bright "sparks" float on a canvas
 * - scrolling pushes them along (parallax by depth) and they fade out
 *   near the end of the hero
 * - pauses when off screen or the tab is hidden; off with reduced motion
 */
const PURPLES = ["#a64dff", "#b866ff", "#c98cff", "#d9a8ff", "#9a2bff"];
const SPARKS = ["#ffffff", "#f3e9ff", "#e2ccff"];

type Particle = {
  kind: 0 | 1; // 0 = dust, 1 = spark
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  age: number;
  color: string;
  depth: number;
  phase: number;
};

export function Embers({ progress }: { progress: MotionValue<number> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    const parts: Particle[] = [];

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const pick = (arr: string[]) => arr[(Math.random() * arr.length) | 0];
    // more particles on bigger screens
    const target = () => Math.round(170 * Math.min(1.3, Math.max(0.5, (w * h) / 1296000)));

    const spawn = (initial: boolean): Particle => {
      const spark = Math.random() < 0.22;
      const depth = rand(0.3, 1);
      const life = spark ? rand(3, 6) : rand(4, 9);
      return {
        kind: spark ? 1 : 0,
        x: rand(0, w),
        y: initial ? rand(0, h) : spark ? rand(h * 0.45, h + 10) : rand(0, h),
        vx: spark ? rand(-4, 4) : rand(-10, 10),
        vy: spark ? rand(-34, -16) * depth : rand(-14, 4) * depth,
        size: spark ? rand(2, 3.5) : rand(3, 7) * (0.55 + 0.6 * depth),
        life,
        age: initial ? rand(0, life) : 0,
        color: spark ? pick(SPARKS) : pick(PURPLES),
        depth,
        phase: rand(0, Math.PI * 2),
      };
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      while (parts.length < target()) parts.push(spawn(true));
      parts.length = Math.min(parts.length, target());
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    });
    io.observe(canvas);
    const onVisibility = () => !document.hidden && start();
    document.addEventListener("visibilitychange", onVisibility);

    let raf = 0;
    let last = performance.now();
    let lastProgress = progress.get();

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const p = progress.get();
      const scrollDelta = p - lastProgress;
      lastProgress = p;
      // fade everything down toward the end of the hero
      const fade = 1 - 0.75 * Math.min(1, Math.max(0, (p - 0.62) / 0.3));

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      for (let i = 0; i < parts.length; i++) {
        const q = parts[i];
        q.age += dt;
        if (q.age >= q.life || q.y < -20 || q.x < -20 || q.x > w + 20) {
          parts[i] = spawn(false);
          continue;
        }
        q.x += (q.vx + 6 * Math.sin(0.8 * t + q.phase)) * dt;
        q.y += q.vy * dt - scrollDelta * h * 0.35 * q.depth;

        const u = q.age / q.life;
        const env = Math.min(1, 6 * u) * Math.min(1, (1 - u) * 3); // fade in and out
        const twinkle = q.kind === 1 ? 0.75 + 0.25 * Math.sin(9 * t + q.phase) : 1;
        const size = Math.max(1, q.size * (q.kind === 0 ? 1 - 0.6 * u : 1));
        const alpha = env * twinkle * fade * (0.55 + 0.45 * q.depth);
        if (alpha <= 0.01) continue;

        const px = Math.round(q.x);
        const py = Math.round(q.y);
        ctx.fillStyle = q.color;
        ctx.globalAlpha = 0.22 * alpha; // soft halo behind the block
        const halo = 3.2 * size;
        ctx.fillRect(px - halo / 2 + size / 2, py - halo / 2 + size / 2, halo, halo);
        ctx.globalAlpha = alpha;
        ctx.fillRect(px, py, size, size);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    };

    function start() {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }
    start();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduce, progress]);

  return (
    <>
      <div aria-hidden className="end-nebula pointer-events-none absolute inset-0 mix-blend-screen" />
      <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
    </>
  );
}
