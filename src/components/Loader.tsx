"use client";

import { useEffect, useState } from "react";

/**
 * Loading screen: the logo floats over a progress bar until the hero's
 * key frames have loaded (HeroScrub reports progress through a
 * "hero-progress" window event), then it fades away. Gives up after 7 s
 * so a slow connection never traps a visitor, and CSS hides it at 8 s
 * even if scripts fail entirely.
 */
export function Loader() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "leaving" | "gone">("loading");

  useEffect(() => {
    const start = performance.now();
    const root = document.documentElement;
    root.style.overflow = "hidden"; // no scrolling behind the loader

    let finished = false;
    let timer = 0;

    const finish = () => {
      if (finished) return;
      finished = true;
      setProgress(1);
      // show the loader for at least 0.9 s so it never just flashes
      const wait = Math.max(0, 900 - (performance.now() - start));
      timer = window.setTimeout(() => {
        setPhase("leaving");
        root.style.overflow = "";
        timer = window.setTimeout(() => setPhase("gone"), 650);
      }, wait + 200);
    };

    const onProgress = (e: Event) => {
      const v = Math.min(1, Math.max(0, (e as CustomEvent<number>).detail));
      setProgress((p) => Math.max(p, v));
      if (v >= 1) finish();
    };

    window.addEventListener("hero-progress", onProgress);
    const giveUp = window.setTimeout(finish, 7000);

    return () => {
      window.removeEventListener("hero-progress", onProgress);
      window.clearTimeout(giveUp);
      window.clearTimeout(timer);
      root.style.overflow = "";
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      role="status"
      aria-label="Loading"
      data-phase={phase}
      className="loader fixed inset-0 z-[70] grid place-items-center bg-bg"
    >
      <div className="loader-inner flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.webp"
          fetchPriority="high"
          alt=""
          width={72}
          height={72}
          className="loader-avatar size-[72px] rounded-full"
        />
        <div className="mt-6 h-0.5 w-32 overflow-hidden bg-white/10">
          <div
            className="h-full origin-left bg-accent transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${Math.max(0.04, progress)})` }}
          />
        </div>
      </div>
    </div>
  );
}
