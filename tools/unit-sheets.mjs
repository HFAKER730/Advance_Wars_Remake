/**
 * Per-unit comparison sheet: one row of four factions at 13× for a single
 * unit id. Complements `zoom-sheets.mjs` (which gives one sheet per faction)
 * when a single silhouette needs to be judged closely.
 *
 * Usage: node tools/unit-sheets.mjs [scale]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, encodePng, blit } from "./canvas-shim.mjs";
import { FACTIONS, SAMPLE_UNITS } from "../public/art/faction-style.mjs";
import { paintLandUnit } from "../public/art/faction-land.mjs";
import { paintAirUnit } from "../public/art/faction-air.mjs";
import { paintSeaUnit } from "../public/art/faction-sea.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "..", "art-sheets");
const Z = Number(process.argv[2] ?? 13);

const PAINTERS = {
  foot: paintLandUnit,
  land: paintLandUnit,
  air: paintAirUnit,
  sea: paintSeaUnit,
};

function scaleSprite(sprite, scale) {
  const width = sprite.width * scale;
  const height = sprite.height * scale;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const from = (Math.floor(y / scale) * sprite.width + Math.floor(x / scale)) * 4;
      const to = (y * width + x) * 4;
      data[to] = sprite.data[from];
      data[to + 1] = sprite.data[from + 1];
      data[to + 2] = sprite.data[from + 2];
      data[to + 3] = sprite.data[from + 3];
    }
  return { width, height, data };
}

await mkdir(OUT, { recursive: true });
for (const unit of SAMPLE_UNITS) {
  const cell = 40 * Z + 16;
  const width = FACTIONS.length * cell + 16;
  const height = cell + 16;
  const sheet = createCanvas(width, height);
  const ctx = sheet.getContext("2d");
  ctx.fillStyle = "#2b3a36";
  ctx.fillRect(0, 0, width, height);
  FACTIONS.forEach((faction, index) => {
    const canvas = createCanvas(40, 40);
    PAINTERS[unit.family](canvas.getContext("2d"), unit.id, faction, -1);
    blit(sheet, scaleSprite(canvas, Z), 8 + index * cell + 4, 10);
  });
  await writeFile(resolve(OUT, `unit-${unit.id}.png`), encodePng(sheet.data, width, height));
  console.log(`unit-${unit.id}.png`);
}
