/**
 * Headless art sheet renderer.
 *
 * Renders every faction × family × variant into PNG contact sheets so the
 * art can be reviewed without a browser. Uses the local canvas shim, so it
 * needs no npm dependency and no display.
 *
 * Usage:
 *   node tools/render-faction-sheets.mjs [outDir]
 *
 * Output: `faction-<id>.png` per faction (all 12 units, 1× and 3×) plus
 * `faction-overview.png` (12 units × 4 factions at 2×) and
 * `faction-identity.png` (one tank per faction, 6×).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, encodePng, blit } from "./canvas-shim.mjs";
import { FACTIONS, FACTION_STYLES, SAMPLE_UNITS, validateFactionStyles } from "../public/art/faction-style.mjs";
import { paintLandUnit } from "../public/art/faction-land.mjs";
import { paintAirUnit } from "../public/art/faction-air.mjs";
import { paintSeaUnit } from "../public/art/faction-sea.mjs";
import { SAMPLE_UNITS as UNITS } from "../public/art/faction-style.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv[2] ?? resolve(HERE, "..", "art-sheets"));

const TILE = 40;
const FAMILY_PAINTERS = {
  foot: (ctx, type, faction) => paintLandUnit(ctx, type, faction, -1),
  land: (ctx, type, faction) => paintLandUnit(ctx, type, faction, -1),
  air: (ctx, type, faction) => paintAirUnit(ctx, type, faction, -1),
  sea: (ctx, type, faction) => paintSeaUnit(ctx, type, faction, -1),
};

function pad(value, width) {
  return String(value).padStart(width, " ");
}

/** Ground a sprite on a background so silhouettes can be judged, not just pixels. */
function backdrop(ctx, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
}

function renderUnit(faction, unit) {
  const canvas = createCanvas(TILE, TILE);
  const ctx = canvas.getContext("2d");
  FAMILY_PAINTERS[unit.family](ctx, unit.id, faction);
  return canvas;
}

function sheetForFaction(faction, scale) {
  const cols = 4;
  const rows = Math.ceil(UNITS.length / cols);
  const cell = TILE * scale + 8;
  const width = cols * cell + 8;
  const height = rows * cell + 8;
  const sheet = createCanvas(width, height);
  const ctx = sheet.getContext("2d");
  backdrop(ctx, width, height, "#2b3a36");
  UNITS.forEach((unit, index) => {
    const sprite = scaleSprite(renderUnit(faction, unit), scale);
    const offset = Math.floor((cell - 8 - TILE * scale) / 2);
    blit(
      sheet,
      sprite,
      6 + (index % cols) * cell + offset,
      6 + Math.floor(index / cols) * cell + offset,
    );
  });
  return sheet;
}

/** Nearest-neighbour upscale into a plain buffer the blitter understands. */
function scaleSprite(sprite, scale) {
  if (scale === 1) return sprite;
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

function overviewSheet(scale) {
  const cols = UNITS.length;
  const rows = FACTIONS.length;
  const cell = TILE * scale + 6;
  const width = cols * cell + 8;
  const height = rows * cell + 8;
  const sheet = createCanvas(width, height);
  backdrop(sheet.getContext("2d"), width, height, "#2b3a36");
  FACTIONS.forEach((faction, row) => {
    UNITS.forEach((unit, col) => {
      const sprite = scaleSprite(renderUnit(faction, unit), scale);
      const offset = Math.floor((cell - 6 - TILE * scale) / 2);
      blit(
        sheet,
        sprite,
        6 + col * cell + offset,
        6 + row * cell + offset,
      );
    });
  });
  return sheet;
}

/** One class, four factions, large — the identity check. */
function identitySheet(unitId, scale) {
  const unit = UNITS.find((entry) => entry.id === unitId) ?? UNITS[0];
  const cell = TILE * scale + 8;
  const width = FACTIONS.length * cell + 8;
  const height = cell + 8;
  const sheet = createCanvas(width, height);
  backdrop(sheet.getContext("2d"), width, height, "#2b3a36");
  FACTIONS.forEach((faction, index) => {
    blit(sheet, scaleSprite(renderUnit(faction, unit), scale), 6 + index * cell + 4, 10);
  });
  return sheet;
}

const problems = validateFactionStyles();
if (problems.length) {
  console.error("faction-style 校验失败：");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

await mkdir(OUT, { recursive: true });
const written = [];
for (const faction of FACTIONS) {
  const sheet = sheetForFaction(faction, 3);
  const file = resolve(OUT, `faction-${faction}.png`);
  await writeFile(file, encodePng(sheet.data, sheet.width, sheet.height));
  written.push(file);
}
{
  const sheet = overviewSheet(2);
  const file = resolve(OUT, "faction-overview.png");
  await writeFile(file, encodePng(sheet.data, sheet.width, sheet.height));
  written.push(file);
}
{
  const sheet = identitySheet("tank", 6);
  const file = resolve(OUT, "faction-identity-tank.png");
  await writeFile(file, encodePng(sheet.data, sheet.width, sheet.height));
  written.push(file);
}
{
  const sheet = identitySheet("infantry", 6);
  const file = resolve(OUT, "faction-identity-infantry.png");
  await writeFile(file, encodePng(sheet.data, sheet.width, sheet.height));
  written.push(file);
}
{
  const sheet = identitySheet("fighter", 6);
  const file = resolve(OUT, "faction-identity-fighter.png");
  await writeFile(file, encodePng(sheet.data, sheet.width, sheet.height));
  written.push(file);
}

console.log(`已生成 ${written.length} 张图：`);
for (const file of written) console.log(`  ${file}`);
console.log("");
console.log("阵营色板：");
for (const faction of FACTIONS) {
  const s = FACTION_STYLES[faction];
  console.log(
    `  ${pad(s.name, 4)} ${s.paintLight} ${s.paintMid} ${s.paintDark} ${s.paintShade}  强调 ${s.accent}  · ${s.descriptor}`,
  );
}
