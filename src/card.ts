import { about, comms, launchDate, layout, palettes, type Entry, type Mode } from "./config.ts";
import type { Telemetry } from "./github.ts";
import { orbit } from "./orbit.ts";

type Tone = "text" | "accent" | "string" | "leader" | "comment";

const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ink = (tone: Tone, s: string) => `<tspan class="${tone}">${xml(s)}</tspan>`;

const fmt = (n: number) => n.toLocaleString("en-US");

/** `Label ........ value` padded so every value lands flush right at `width`. */
function field(label: string, value: string, width: number = layout.panel.columns) {
  const name = label
    .split(".")
    .map((part) => ink("accent", part))
    .join(ink("leader", "."));
  const fill = Math.max(1, width - label.length - value.length - 2);
  return name + ink("leader", ` ${".".repeat(fill)} `) + ink("string", value);
}

/** Two fields side by side, together exactly as wide as a single one. */
function pair(left: [string, string], right: [string, string]) {
  const half = Math.floor((layout.panel.columns - 3) / 2);
  return field(...left, half) + ink("leader", " | ") + field(...right, half);
}

function rule(title: string) {
  return ink("text", `${title} `) + ink("leader", "─".repeat(layout.panel.columns - title.length - 1));
}

const block = (entries: Entry[], vars: Record<string, string>) =>
  entries.map((e) => (e ? field(e[0], e[1].replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "")) : ""));

function panelLines(stats: Telemetry | null, now: Date) {
  const lines = [
    rule("ugi@ad-astra"),
    ...block(about, { orbit: orbit(launchDate, now) }),
    "",
    rule("Comms"),
    ...block(comms, {}),
    "",
    rule("GitHub Stats"),
  ];

  if (!stats) return [...lines, ink("comment", "no signal: set ACCESS_TOKEN to pull GitHub stats")];

  return [
    ...lines,
    pair(["Repos", `${fmt(stats.repos)} (${stats.publicRepos} public)`], ["Stars", fmt(stats.stars)]),
    pair(["Contribs", fmt(stats.allTime)], ["Followers", fmt(stats.followers)]),
    field(
      "Lines of Code",
      `${fmt(stats.linesAdded - stats.linesRemoved)} (${fmt(stats.linesAdded)}++, ${fmt(stats.linesRemoved)}--)`,
    ),
  ];
}

function signalBars(weekly: number[], top: number) {
  const { barWidth, gap, maxHeight } = layout.signal;
  const peak = Math.max(1, ...weekly);
  return weekly
    .map((count, i) => {
      const h = Math.max(2, Math.round((count / peak) * maxHeight));
      const x = layout.panel.x + i * (barWidth + gap);
      const opacity = (0.25 + (0.75 * count) / peak).toFixed(2);
      return `<rect x="${x}" y="${top + maxHeight - h}" width="${barWidth}" height="${h}" rx="1.5" fill="url(#signal)" opacity="${opacity}"/>`;
    })
    .join("");
}

const stack = (rows: string[], x: number, y: number, lineHeight: number) =>
  rows.map((row, i) => `<tspan x="${x}" y="${y + i * lineHeight}">${row}</tspan>`).join("\n");

export function renderCard(mode: Mode, portrait: string[], stats: Telemetry | null, now: Date) {
  const c = palettes[mode];
  const { width: W, height: H, radius, titlebar, portrait: art, plate, panel } = layout;

  const lines = panelLines(stats, now);
  const signalTop = panel.y + lines.length * panel.lineHeight - 4;
  const promptY = signalTop + 60;
  const synced = now.toISOString().slice(0, 10);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
     font-family="'JetBrains Mono','SF Mono',Menlo,Consolas,'Liberation Mono',monospace">
<title>ugi · Software Engineer</title>
<defs>
  <linearGradient id="portrait" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c.portraitFrom}"/>
    <stop offset="1" stop-color="${c.portraitTo}"/>
  </linearGradient>
  <linearGradient id="signal" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="${c.string}"/>
    <stop offset="1" stop-color="${c.accent}"/>
  </linearGradient>
  <clipPath id="frame"><rect width="${W}" height="${H}" rx="${radius}"/></clipPath>
</defs>
<style>
  text, tspan { white-space: pre; }
  .text { fill: ${c.text}; }
  .accent { fill: ${c.accent}; }
  .string { fill: ${c.string}; }
  .leader { fill: ${c.leader}; }
  .comment { fill: ${c.comment}; }
  .caret { animation: blink 1.1s steps(1) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
</style>
<g clip-path="url(#frame)">
  <rect width="${W}" height="${H}" fill="${c.canvas}"/>
  <rect width="${W}" height="${titlebar}" fill="${c.titlebar}"/>
  <rect y="${titlebar}" width="${W}" height="1" fill="${c.hairline}"/>
  <circle cx="22" cy="18" r="6" fill="#FF5F57"/>
  <circle cx="42" cy="18" r="6" fill="#FEBC2E"/>
  <circle cx="62" cy="18" r="6" fill="#28C840"/>
  <text x="${W / 2}" y="23" text-anchor="middle" font-size="12" class="comment">ugi@ad-astra: ~ — neofetch --orbit</text>
  ${c.portraitPlate ? `<rect x="${plate.x}" y="${plate.y}" width="${plate.width}" height="${plate.height}" rx="${plate.radius}" fill="${c.portraitPlate}"/>` : ""}
  <text font-size="${art.fontSize}" fill="url(#portrait)" opacity="${c.portraitOpacity}">
${stack(portrait.map(xml), art.x, art.y, art.lineHeight)}
  </text>
  <text font-size="${panel.fontSize}">
${stack(lines, panel.x, panel.y, panel.lineHeight)}
  </text>
  ${stats ? signalBars(stats.weekly, signalTop) : ""}
  <text x="${panel.x}" y="${promptY}" font-size="${panel.fontSize}">${ink("accent", "❯")} ${ink("comment", `last sync ${synced}`)} <tspan class="string caret">▍</tspan></text>
</g>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${radius}" fill="none" stroke="${c.hairline}"/>
</svg>
`;
}
