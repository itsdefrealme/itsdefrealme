import Link from "next/link";

// the Minecraft death screen, for pages that don't exist
export default function NotFound() {
  return (
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-bg px-5 text-center">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(150_10_10/0.42),rgb(60_0_0/0.7)_58%,var(--color-bg)_100%)]"
      />
      <div className="relative">
        <h1 className="font-pixel text-5xl text-white [text-shadow:4px_4px_0_#3f3f3f] md:text-7xl">You died!</h1>
        <p className="mt-6 font-pixel text-xl text-white [text-shadow:2px_2px_0_#3f3f3f] md:text-2xl">
          Score: <span className="text-[#ffff55] [text-shadow:2px_2px_0_#3f3f15]">404</span>
        </p>
        <p className="mt-5 text-muted">This page doesn&apos;t exist.</p>
        <Link
          href="/"
          className="mt-10 inline-flex h-12 items-center bg-accent px-8 font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-accent-hi active:translate-y-px"
        >
          Respawn
        </Link>
      </div>
    </main>
  );
}
