/**
 * Large-scale contact sheets for eyeballing sprite detail.
 *
 * `render-faction-sheets.mjs` shows 2×/3×/6× overviews; judging pixel work at
 * 1× needs a bigger window, so this writes one 8× sheet per faction.
 *
 * Usage: node tools/zoom-sheets.mjs [scale]
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
const Z = Number(process.argv[2] ?? 8);

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
for (const faction of FACTIONS) {
  const cols = 4;
  const rows = Math.ceil(SAMPLE_UNITS.length / cols);
  const cell = 40 * Z + 12;
  const width = cols * cell + 12;
  const height = rows * cell + 12;
  const sheet = createCanvas(width, height);
  const ctx = sheet.getContext("2d");
  ctx.fillStyle = "#2b3a36";
  ctx.fillRect(0, 0, width, height);
  SAMPLE_UNITS.forEach((unit, index) => {
    const canvas = createCanvas(40, 40);
    PAINTERS[unit.family](canvas.getContext("2d"), unit.id, faction, -1);
    blit(
      sheet,
      scaleSprite(canvas, Z),
      6 + (index % cols) * cell + 4,
      6 + Math.floor(index / cols) * cell + 4,
    );
  });
  const file = resolve(OUT, `zoom-${faction}.png`);
  await writeFile(file, encodePng(sheet.data, width, height));
  console.log(`${file}  ${width}x${height}`);
}
