"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";

/**
 * A thumbnail that resolves like a Minecraft texture loading in: drawn as
 * 4, 8, 16, 32 and 64 blocks across with nearest-neighbour scaling, then the
 * real image fades in underneath. Runs once, when the tile scrolls into view.
 */

const STEPS = [4, 8, 16, 32, 64];
const STEP_MS = 75;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Props = {
  src: string;
  srcSet: string;
  sizes: string;
  alt: string;
  className?: string;
};

export function PixelImage({ src, srcSet, sizes, alt, className = "" }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const inView = useInView(wrap, { once: true, amount: 0.25 });
  const reduce = useReducedMotion();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (reduce) {
      setDone(true);
      return;
    }
    if (!inView) return;
    const el = img.current;
    const c = cv.current;
    if (!el || !c) return;
    let dead = false;

    (async () => {
      if (!el.complete) await new Promise((r) => el.addEventListener("load", r, { once: true }));
      try {
        await el.decode();
      } catch {
        /* drawImage works on a loaded image without decode() */
      }
      if (dead || !el.naturalWidth) return setDone(true);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = (c.width = Math.max(1, Math.round(c.clientWidth * dpr)));
      const H = (c.height = Math.max(1, Math.round(c.clientHeight * dpr)));
      const ctx = c.getContext("2d");
      const tmp = document.createElement("canvas");
      const tctx = tmp.getContext("2d");
      if (!ctx || !tctx) return setDone(true);

      for (const n of STEPS) {
        const w = n;
        const h = Math.max(1, Math.round((n * el.naturalHeight) / el.naturalWidth));
        tmp.width = w;
        tmp.height = h;
        tctx.imageSmoothingEnabled = true;
        tctx.drawImage(el, 0, 0, w, h);
        // cover-fit the tiny image into the tile, blocks stay hard-edged
        const s = Math.max(W / w, H / h);
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(tmp, (W - w * s) / 2, (H - h * s) / 2, w * s, h * s);
        await sleep(STEP_MS);
        if (dead) return;
      }
      setDone(true);
    })();

    return () => {
      dead = true;
    };
  }, [inView, reduce]);

  return (
    <div ref={wrap} className={`relative overflow-hidden bg-bg-3 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={img}
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading="lazy"
        decoding="async"
        width={1920}
        height={1080}
        className="absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.025]"
        style={{ opacity: done ? 1 : 0 }}
      />
      <canvas
        ref={cv}
        aria-hidden
        className="absolute inset-0 h-full w-full transition-opacity duration-300"
        style={{ opacity: done ? 0 : 1 }}
      />
    </div>
  );
}
