"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue } from "motion/react";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { WORK, workSrc, workSrcSet } from "@/data/work";
import { PixelImage } from "./PixelImage";

type Layout = "left" | "right" | "full";
const GROUPS: { items: number[]; layout: Layout }[] = [
  { items: [0, 1, 2], layout: "left" },
  { items: [3, 4, 5], layout: "right" },
  { items: [6, 7, 8], layout: "left" },
  { items: [9], layout: "full" },
];

// grid placement per slot, md and up; below md everything is one column
function place(layout: Layout, slot: number) {
  if (layout === "full") return { cell: "md:col-span-12", big: true };
  const bigSlot = layout === "left" ? 0 : 2;
  if (slot === bigSlot) {
    const col = layout === "left" ? "md:col-start-1" : "md:col-start-5";
    return { cell: `md:col-span-8 md:row-span-2 md:row-start-1 ${col}`, big: true };
  }
  // the two small tiles stack in the remaining four columns
  const row = layout === "left" ? slot : slot + 1;
  const col = layout === "left" ? "md:col-start-9" : "md:col-start-1";
  return { cell: `md:col-span-4 ${col} ${row === 1 ? "md:row-start-1" : "md:row-start-2"}`, big: false };
}

export function Work() {
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  // one Minecraft-style tooltip that follows the mouse
  const tipX = useMotionValue(-999);
  const tipY = useMotionValue(-999);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<string | null>(null);

  const moveTip = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const w = tipRef.current?.offsetWidth ?? 180;
    const flip = e.clientX + 18 + w > window.innerWidth - 8;
    tipX.set(flip ? e.clientX - w - 14 : e.clientX + 18);
    tipY.set(e.clientY - 30);
  };

  return (
    <section id="work" className="mx-auto max-w-[1400px] px-5 pt-24 pb-28 md:px-8 md:pt-36 md:pb-40">
      <div className="mb-12 md:mb-16">
        <h2 className="wider text-[2.4rem] leading-none font-extrabold tracking-[-0.035em] md:text-7xl">
          Recent work
        </h2>
        <p className="mt-5 max-w-[46ch] text-muted md:text-lg">
          Open any thumbnail to see the full 1920 x 1080 version.
        </p>
      </div>

      <div className="flex flex-col gap-3" onPointerMove={moveTip} onPointerLeave={() => setTip(null)}>
        {GROUPS.map((g, gi) => (
          <div key={gi} className="grid grid-cols-1 gap-3 md:grid-cols-12">
            {g.items.map((idx, slot) => {
              const item = WORK[idx];
              const { cell, big } = place(g.layout, slot);
              return (
                <button
                  key={item.slug}
                  type="button"
                  onClick={(e) => {
                    opener.current = e.currentTarget;
                    setTip(null);
                    setOpen(idx);
                  }}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setTip(item.name)}
                  onPointerLeave={() => setTip(null)}
                  aria-label={`${item.name}, open full size`}
                  className={`group relative block cursor-zoom-in text-left outline-offset-4 ${cell}`}
                >
                  <motion.div layoutId={`work-${item.slug}`} className="h-full">
                    <PixelImage
                      src={workSrc(item.slug, 1280)}
                      srcSet={workSrcSet(item.slug)}
                      sizes={big ? "(min-width: 768px) 66vw, 100vw" : "(min-width: 768px) 33vw, 100vw"}
                      alt={`${item.name}, Minecraft thumbnail by itsdefrealme`}
                      className={big ? "aspect-video" : "aspect-video md:aspect-auto md:h-full"}
                    />
                  </motion.div>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 ring-1 ring-white/8 transition-[box-shadow] duration-300 ring-inset group-hover:ring-2 group-hover:ring-accent"
                  />
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <motion.div
        ref={tipRef}
        aria-hidden
        style={{ x: tipX, y: tipY }}
        className="pointer-events-none fixed top-0 left-0 z-50"
      >
        {tip && (
          <div className="mc-tooltip">
            <div className="mc-shadow-epic text-[17px] whitespace-nowrap">{tip}</div>
            <div className="mc-shadow-gray mt-0.5 text-[14px] whitespace-nowrap">Click to enlarge</div>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {open !== null && (
          <Lightbox
            start={open}
            onClose={() => {
              setOpen(null);
              requestAnimationFrame(() => opener.current?.focus());
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function Lightbox({ start, onClose }: { start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const dialog = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const item = WORK[index];
  const n = WORK.length;

  const go = useCallback((d: number) => setIndex((i) => (i + d + n) % n), [n]);

  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    closeBtn.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Tab" && dialog.current) {
        // keep focus inside the dialog
        const f = dialog.current.querySelectorAll<HTMLElement>("button");
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = prev;
    };
  }, [go, onClose]);

  // the opened thumbnail morphs out of its tile; after paging, plain crossfades
  const shared = index === start;

  return (
    <motion.div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={`${item.name}, full size`}
      className="fixed inset-0 z-50 flex flex-col bg-[rgb(6_5_10/0.95)] backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
    >
      <div className="flex h-16 shrink-0 items-center justify-between px-5 md:px-8">
        <p className="wide text-sm font-semibold text-muted">
          <span className="text-ink">{item.name}</span>
        </p>
        <button
          ref={closeBtn}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-10 place-items-center text-muted transition-colors hover:text-ink"
        >
          <X size={24} />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 md:px-20 md:pb-10">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.figure
            key={item.slug}
            layoutId={shared ? `work-${item.slug}` : undefined}
            initial={shared ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 32 }}
            className="relative aspect-video max-h-full w-full max-w-[min(100%,calc((100dvh-8rem)*16/9))]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={workSrc(item.slug, 1920)}
              srcSet={workSrcSet(item.slug)}
              sizes="100vw"
              alt={`${item.name}, Minecraft thumbnail by itsdefrealme`}
              className="h-full w-full object-contain"
            />
          </motion.figure>
        </AnimatePresence>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          aria-label="Previous thumbnail"
          className="absolute top-1/2 left-2 grid size-12 -translate-y-1/2 place-items-center bg-bg/70 text-ink transition-colors hover:bg-accent md:left-5"
        >
          <CaretLeft size={22} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          aria-label="Next thumbnail"
          className="absolute top-1/2 right-2 grid size-12 -translate-y-1/2 place-items-center bg-bg/70 text-ink transition-colors hover:bg-accent md:right-5"
        >
          <CaretRight size={22} />
        </button>
      </div>
    </motion.div>
  );
}
