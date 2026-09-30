// Thumbnails from the old carrd page. Names are descriptive titles for the
// tooltip and lightbox, not the video titles.
export type Work = { slug: string; name: string };

export const WORK: Work[] = [
  { slug: "diamond-squad", name: "Diamond Squad" },
  { slug: "amethyst-gear", name: "Amethyst Gear" },
  { slug: "trapped-twin", name: "Frozen Twin" },
  { slug: "snow-standoff", name: "Snow Standoff" },
  { slug: "frost-axe", name: "Frost Axe" },
  { slug: "crown-maze", name: "Crown Maze" },
  { slug: "rainbow-blade", name: "Rainbow Blade" },
  { slug: "trim-set", name: "Trim Set" },
  { slug: "void-orb", name: "Void Orb" },
  { slug: "dragon-army", name: "Dragon Army" },
];

export const workSrc = (slug: string, w: 640 | 1280 | 1920) => `/work/${slug}-${w}.webp`;
export const workSrcSet = (slug: string) =>
  `${workSrc(slug, 640)} 640w, ${workSrc(slug, 1280)} 1280w, ${workSrc(slug, 1920)} 1920w`;
