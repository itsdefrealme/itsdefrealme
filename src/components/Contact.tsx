"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Copy, DiscordLogo, EnvelopeSimple, YoutubeLogo } from "@phosphor-icons/react";
import { LINKS } from "@/data/site";

export function Contact() {
  const reduce = useReducedMotion();
  const video = useRef<HTMLVideoElement>(null);
  const inView = useInView(video, { amount: 0.2 });
  const [toast, setToast] = useState(false);

  // the loop only plays while it is on screen, and never with reduced motion
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (inView && !reduce) v.play().catch(() => {});
    else v.pause();
  }, [inView, reduce]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(LINKS.email);
      setToast(false);
      requestAnimationFrame(() => setToast(true));
    } catch {
      window.location.href = `mailto:${LINKS.email}`;
    }
  };

  return (
    <section id="contact" className="border-t border-line">
      <div className="mx-auto grid max-w-[1400px] items-center gap-10 px-5 py-24 md:grid-cols-12 md:gap-6 md:px-8 md:py-32">
        <div className="md:col-span-5">
          <video
            ref={video}
            muted
            loop
            playsInline
            preload="metadata"
            poster="/media/avatar-poster.webp"
            aria-label="The itsdefrealme avatar rebuilt as a wall of glowing blocks"
            className="mx-auto aspect-square w-full max-w-[520px] [mask-image:radial-gradient(closest-side,#000_78%,transparent)]"
          >
            <source src="/media/avatar-loop.webm" type="video/webm" />
            <source src="/media/avatar-loop.mp4" type="video/mp4" />
          </video>
        </div>

        <div className="md:col-span-7 md:pl-6">
          <h2 className="wider text-[2.6rem] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance md:text-7xl">
            Got a video coming up?
          </h2>

          <a
            href={LINKS.discord}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-9 inline-flex h-14 items-center gap-3 bg-accent px-7 text-lg font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-accent-hi active:translate-y-px"
          >
            <DiscordLogo size={22} weight="fill" aria-hidden />
            Order on Discord
          </a>

          <div className="mt-10 grid max-w-[40rem] gap-px bg-line sm:grid-cols-2">
            <button
              type="button"
              onClick={copyEmail}
              className="group flex items-center gap-4 bg-bg px-5 py-5 text-left transition-colors hover:bg-bg-2"
            >
              <EnvelopeSimple size={22} className="shrink-0 text-accent-ink" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-muted">Email, click to copy</span>
                <span className="block truncate font-semibold">{LINKS.email}</span>
              </span>
              <Copy size={18} className="shrink-0 text-faint transition-colors group-hover:text-ink" aria-hidden />
            </button>
            <a
              href={LINKS.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 bg-bg px-5 py-5 transition-colors hover:bg-bg-2"
            >
              <YoutubeLogo size={22} weight="fill" className="shrink-0 text-accent-ink" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-muted">YouTube</span>
                <span className="block truncate font-semibold">@itsdefrealme</span>
              </span>
            </a>
          </div>
        </div>
      </div>

      <AdvancementToast show={toast} />
    </section>
  );
}

/** Minecraft's top-right "Advancement Made!" toast, for a copied email. */
function AdvancementToast({ show }: { show: boolean }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed top-20 right-4 z-50 md:right-6">
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ x: "115%" }}
            animate={{ x: 0 }}
            exit={{ x: "115%" }}
            transition={{ type: "tween", duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex w-[320px] items-center gap-3 border-2 border-[#5c5c5c] bg-[#212121] p-3 shadow-[inset_0_0_0_2px_#141414]"
            style={{ fontFamily: "var(--font-pixel)" }}
          >
            <span className="grid size-10 shrink-0 place-items-center bg-[#8b8b8b] shadow-[inset_2px_2px_0_#373737,inset_-2px_-2px_0_#fff]">
              <EnvelopeSimple size={22} weight="fill" className="text-accent" aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block text-[16px] text-[#ffff55] [text-shadow:2px_2px_0_#3f3f15]">Advancement Made!</span>
              <span className="mt-0.5 block text-[15px] text-white [text-shadow:2px_2px_0_#3f3f3f]">Email copied</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
