/**
 * Turns a portrait into the ASCII used on the card. Local only (needs `sharp`).
 *
 *   npm run portrait -- photo.jpg
 *
 * Writes assets/ascii.txt, bright = dense. Both themes use it: on the light card
 * it reads like an engraving, while an inverted copy turned the black backdrop
 * into a solid wall of ink.
 */
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const RAMP = " .'`^,:;-~=+*!|ilt1jfrxnuvczXYUJCLQ0OZmwqpdbkhao#MW&8%B@$";
const COLS = 54;
const ROWS = 43;
// keep the middle of the frame, where the face is
const CROP_SIDES = 0.18;

const src = process.argv[2];
if (!src) throw new Error("usage: npm run portrait -- <image>");

const meta = await sharp(src).metadata();
const w = meta.width ?? 0;
const h = meta.height ?? 0;
const inset = Math.round(w * CROP_SIDES);

const { data } = await sharp(src)
  .extract({ left: inset, top: 0, width: w - inset * 2, height: h })
  .grayscale()
  .normalise()
  .linear(1.25, -32)
  .resize(COLS, ROWS, { fit: "fill", kernel: "lanczos3" })
  .raw()
  .toBuffer({ resolveWithObject: true });

function toAscii() {
  const rows: string[] = [];
  for (let y = 0; y < ROWS; y++) {
    let row = "";
    for (let x = 0; x < COLS; x++) {
      row += RAMP[Math.floor((data[y * COLS + x] * RAMP.length) / 256)];
    }
    rows.push(row.trimEnd());
  }
  return rows.join("\n") + "\n";
}

await writeFile(new URL("../assets/ascii.txt", import.meta.url), toAscii());
console.log(`portrait written (${COLS}x${ROWS})`);
