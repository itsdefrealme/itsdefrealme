import type { Metadata, Viewport } from "next";
import { Archivo, Pixelify_Sans } from "next/font/google";
import { SITE } from "@/data/site";
import { MotionProvider } from "@/components/MotionProvider";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

// only used by the two Minecraft-UI details (item tooltip, advancement toast)
const pixelify = Pixelify_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-pixelify",
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
    <html lang="en" className={`${archivo.variable} ${pixelify.variable}`}>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
