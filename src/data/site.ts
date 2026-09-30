export const SITE = {
  name: "itsdefrealme",
  // set SITE_URL at build time once the domain is known (used for OG links)
  url: process.env.SITE_URL ?? "http://localhost:3430",
  description:
    "Professional Minecraft thumbnails for YouTubers. From $15 to $35, delivered in 24 to 72 hours, with free unlimited revisions.",
};

export const LINKS = {
  discord: "https://dsc.gg/itsdefrealme",
  youtube: "https://www.youtube.com/@itsdefrealme",
  email: "itsdefrealme.contact@gmail.com",
};

export const NAV = [
  { href: "#work", label: "Work" },
  { href: "#reviews", label: "Reviews" },
  { href: "#contact", label: "Contact" },
];
