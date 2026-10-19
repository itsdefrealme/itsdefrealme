import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SITE } from "@/data/site";
import { MotionProvider } from "@/components/MotionProvider";
import "./globals.css";

// Fonts live in src/fonts and are bundled with the site, so building never
// needs the internet (and visitors never talk to Google).
const archivo = localFont({
  src: "../fonts/Archivo-latin.woff2",
  weight: "100 900",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
  variable: "--font-archivo",
  display: "swap",
});

// only used by the two Minecraft-UI details (item tooltip, advancement toast)
const pixelify = localFont({
  src: "../fonts/PixelifySans-latin.woff2",
  weight: "400 600",
  variable: "--font-pixelify",
  display: "swap",
});

// the hero heading
const monocraft = localFont({
  src: "../fonts/Monocraft-Bold.woff2",
  weight: "700",
  variable: "--font-mc",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: "itsdefrealme | Minecraft Thumbnail Designer",
  description: SITE.description,
  openGraph: {
    title: "itsdefrealme | Minecraft Thumbnail Designer",
    description: SITE.description,
    type: "website",
    siteName: "itsdefrealme",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0a0810",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${pixelify.variable} ${monocraft.variable}`}>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
