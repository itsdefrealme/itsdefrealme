import { REVIEWS } from "@/data/reviews";
import { Reveal } from "./Reveal";

export function Reviews() {
  return (
    <section id="reviews" className="border-t border-line bg-bg-2">
      <div className="mx-auto grid max-w-[1400px] gap-14 px-5 py-24 md:grid-cols-12 md:gap-6 md:px-8 md:py-36">
        <div className="md:col-span-5">
          <div className="md:sticky md:top-28">
            <h2 className="sr-only">Reviews</h2>
            <dl className="grid gap-10">
              <div>
                <dt className="sr-only">Views generated</dt>
                <dd className="wider text-[5.5rem] leading-[0.88] font-extrabold tracking-[-0.05em] md:text-[8rem] lg:text-[9.5rem]">
                  10M+
                </dd>
                <dd aria-hidden className="mt-4 text-xl font-semibold md:text-2xl">views generated</dd>
              </div>
              <div>
                <dt className="sr-only">Average click-through rate</dt>
                <dd className="wider text-[4rem] leading-[0.88] font-extrabold tracking-[-0.05em] text-accent-ink md:text-[5.5rem]">
                  10%+
                </dd>
                <dd aria-hidden className="mt-4 text-xl font-semibold md:text-2xl">average CTR</dd>
              </div>
            </dl>
          </div>
        </div>

        <ul className="divide-y divide-line md:col-span-7">
          {REVIEWS.map((r, i) => (
            <li key={r.name} className="py-9 first:pt-0 last:pb-0 md:py-11">
              <Reveal delay={i * 0.04}>
                <figure>
                  <blockquote className="text-xl leading-snug text-balance md:text-[1.65rem] md:leading-[1.32]">
                    &ldquo;{r.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-3 text-[15px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.avatar}
                      alt=""
                      width={40}
                      height={40}
                      loading="lazy"
                      className="size-10 rounded-full ring-1 ring-white/10"
                    />
                    <span className="font-semibold">{r.name}</span>
                    <span className="text-muted">{r.subs}K subscribers</span>
                  </figcaption>
                </figure>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
