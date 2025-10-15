import { readFile, writeFile } from "node:fs/promises";
import { renderCard } from "./card.ts";
import { login, orgs, palettes, timeZone, type Mode } from "./config.ts";
import { fetchTelemetry } from "./github.ts";

const root = new URL("../", import.meta.url);
const token = process.env.ACCESS_TOKEN ?? process.env.GITHUB_TOKEN;
// Calendar date in `timeZone`, pinned to UTC midnight so the card's UTC getters read it back as-is.
// CARD_DATE=YYYY-MM-DD renders the card as of that day instead of today.
const day = process.env.CARD_DATE ?? new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
const now = new Date(`${day}T00:00:00Z`);

const stats = token ? await fetchTelemetry(login, orgs, token, now) : null;

const portrait = (await readFile(new URL("assets/ascii.txt", root), "utf8")).trimEnd().split("\n");

for (const mode of Object.keys(palettes) as Mode[]) {
  await writeFile(new URL(`${mode}.svg`, root), renderCard(mode, portrait, stats, now));
}

console.log(stats ? { ...stats, weekly: `${stats.weekly.length} weeks` } : "rendered without telemetry");
