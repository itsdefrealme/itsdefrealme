"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { DiscordLogo } from "@phosphor-icons/react";
import { LINKS, NAV } from "@/data/site";

export function Nav() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);

  // a boolean that flips once, not a per-frame value
  useMotionValueEvent(scrollY, "change", (y) => {
    const next = y > 24;
    if (next !== solid) setSolid(next);
  });

  // which section sits in the middle of the screen
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const ids = NAV.map((n) => n.href.slice(1));
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    const onTop = new IntersectionObserver(([e]) => e.isIntersecting && setActive(null), {
      rootMargin: "0px 0px -60% 0px",
    });
    const top = document.getElementById("top");
    if (top) onTop.observe(top);
    return () => {
      io.disconnect();
      onTop.disconnect();
    };
  }, []);

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300"
      data-solid={solid}
      style={{
        backgroundColor: solid ? "rgb(10 8 16 / 0.82)" : "rgb(10 8 16 / 0)",
        borderBottom: `1px solid ${solid ? "rgb(242 238 251 / 0.08)" : "transparent"}`,
        backdropFilter: solid ? "blur(14px)" : "none",
        WebkitBackdropFilter: solid ? "blur(14px)" : "none",
      }}
    >
      <nav className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-6 px-5 md:px-8">
        <a href="#top" className="group flex items-center gap-3" aria-label="itsdefrealme, back to top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/avatar.png"
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-full ring-1 ring-white/15 transition-transform duration-300 group-hover:rotate-[-8deg]"
          />
          <span className="wide text-[15px] font-bold tracking-tight">itsdefrealme</span>
        </a>

        <ul className="hidden items-center gap-8 text-sm text-muted md:flex">
          {NAV.map((item) => {
            const on = active === item.href.slice(1);
            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  aria-current={on ? "true" : undefined}
                  className={`relative py-2 transition-colors hover:text-ink ${on ? "text-ink" : ""}`}
                >
                  {item.label}
                  <span
                    aria-hidden
                    className={`absolute -bottom-0.5 left-0 h-0.5 bg-accent transition-[width] duration-300 ${on ? "w-full" : "w-0"}`}
                  />
                </a>
              </li>
            );
          })}
        </ul>

        <a
          href={LINKS.discord}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 bg-accent px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-accent-hi active:translate-y-px"
        >
          <DiscordLogo size={18} weight="fill" aria-hidden />
          <span className="hidden sm:inline">Order on Discord</span>
          <span className="sm:hidden">Order</span>
        </a>
      </nav>
    </motion.header>
  );
}
