import { Nav } from "@/components/Nav";
import { HeroScrub } from "@/components/HeroScrub";
import { Work } from "@/components/Work";
import { Reviews } from "@/components/Reviews";
import { Contact } from "@/components/Contact";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <HeroScrub />
        <Work />
        <Reviews />
        <Contact />
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-5 py-10 text-sm text-faint md:flex-row md:items-center md:justify-between md:px-8">
          <p>&copy; {new Date().getFullYear()} itsdefrealme</p>
          <p>Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.</p>
        </div>
      </footer>
    </>
  );
}
