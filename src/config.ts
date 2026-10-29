// Everything you'd want to tweak lives here: what the card says and how it looks.

export type Entry = readonly [label: string, value: string] | null;

export const login = process.env.GH_LOGIN ?? "ugi-dev";

/** Orgs whose repos count towards Stars, on top of personal ones. */
export const orgs = ["vortexkit"];

/** Dates on the card (Orbit, last sync) follow this zone, not the CI runner's UTC. */
export const timeZone = "Australia/Sydney";

/** First day on GitHub. Drives the "Orbit" line. */
export const launchDate = new Date("2020-04-19T00:00:00Z");

export const about: Entry[] = [
  ["Role", "Software Engineer"],
  ["Orbit", "{orbit}"],
  ["Shell", "zsh, Ghostty"],
  ["IDE", "Zed"],
  ["Theme", "Ad Astra (made it myself)"],
  null,
  ["Frontend", "TypeScript, React, Next.js"],
  ["Backend", "Node, Express, Postgres"],
  ["Design", "Figma, Design Systems"],
  ["Shipped", "Vortex, Kirari"],
];

export const comms: Entry[] = [
  ["Web", "ugi.dev"],
  ["X", "@ugi_dev"],
  ["GitHub", "ugi-dev"],
];

export interface Palette {
  canvas: string;
  titlebar: string;
  hairline: string;
  text: string;
  accent: string;
  string: string;
  leader: string;
  comment: string;
  portraitFrom: string;
  portraitTo: string;
  portraitOpacity: number;
  /** Panel behind the portrait. The photo has a black backdrop, so on a light canvas it only reads on a dark plate. */
  portraitPlate: string | null;
}

// Lifted straight from the Ad Astra VS Code theme.
export const palettes = {
  dark: {
    canvas: "#111111",
    titlebar: "#1A1A1A",
    hairline: "#262626",
    text: "#FFFFFF",
    accent: "#FBADFF",
    string: "#57E2E5",
    leader: "#3A3A3A",
    comment: "#7F848E",
    portraitFrom: "#FBADFF",
    portraitTo: "#57E2E5",
    portraitOpacity: 0.85,
    portraitPlate: null,
  },
  light: {
    canvas: "#F5F7FC",
    titlebar: "#EEF2FA",
    hairline: "#DDE3EF",
    text: "#1C2230",
    accent: "#8F4AB8",
    string: "#0A8E97",
    leader: "#C9D0DD",
    comment: "#76819A",
    portraitFrom: "#FBADFF",
    portraitTo: "#57E2E5",
    portraitOpacity: 0.9,
    portraitPlate: "#161A24",
  },
} satisfies Record<string, Palette>;

export type Mode = keyof typeof palettes;

export const layout = {
  width: 960,
  height: 540,
  radius: 14,
  titlebar: 36,
  portrait: { x: 24, y: 62, fontSize: 10, lineHeight: 11 },
  plate: { x: 12, y: 48, width: 350, height: 480, radius: 10 },
  panel: { x: 380, y: 66, fontSize: 14, lineHeight: 18, columns: 62 },
  signal: { barWidth: 7, gap: 3, maxHeight: 34 },
} as const;
