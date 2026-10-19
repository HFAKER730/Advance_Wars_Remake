/**
 * Measurable art-quality report for the faction painters.
 *
 * Prints per unit: opaque pixels, distinct colours, how many of the faction's
 * style slots are actually used, and the fraction of the silhouette boundary
 * that is painted with the darkest ink (readability over terrain).
 *
 * Usage: node tools/art-stats.mjs
 */
import { createCanvas } from "./canvas-shim.mjs";
import { FACTIONS, FACTION_STYLES, SAMPLE_UNITS } from "../public/art/faction-style.mjs";
import { paintLandUnit } from "../public/art/faction-land.mjs";
import { paintAirUnit } from "../public/art/faction-air.mjs";
import { paintSeaUnit } from "../public/art/faction-sea.mjs";

const PAINTERS = {
  foot: paintLandUnit,
  land: paintLandUnit,
  air: paintAirUnit,
  sea: paintSeaUnit,
};

const hex = (r, g, b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

function analyse(type, family, faction) {
  const canvas = createCanvas(40, 40);
  PAINTERS[family](canvas.getContext("2d"), type, faction, -1);
  const data = canvas.data;
  const colours = new Map();
  let count = 0;
  const alpha = (x, y) =>
    x < 0 || y < 0 || x >= 40 || y >= 40 ? 0 : data[(y * 40 + x) * 4 + 3];
  let boundary = 0;
  let inkBoundary = 0;
  const ink = FACTION_STYLES[faction].metalDark;
  for (let y = 0; y < 40; y++)
    for (let x = 0; x < 40; x++) {
      const offset = (y * 40 + x) * 4;
      if (data[offset + 3] === 0) continue;
      count++;
      const key = hex(data[offset], data[offset + 1], data[offset + 2]);
      colours.set(key, (colours.get(key) ?? 0) + 1);
      const edge =
        alpha(x - 1, y) === 0 || alpha(x + 1, y) === 0 ||
        alpha(x, y - 1) === 0 || alpha(x, y + 1) === 0;
      if (!edge) continue;
      boundary++;
      if (key === ink) inkBoundary++;
    }
  const slots = new Set(Object.values(FACTION_STYLES[faction]).filter((v) => typeof v === "string" && v.startsWith("#")));
  let slotUse = 0;
  for (const key of colours.keys()) if (slots.has(key)) slotUse++;
  return {
    count,
    colours: colours.size,
    slots: slotUse,
    inkRatio: boundary ? inkBoundary / boundary : 0,
  };
}

const pad = (v, n) => String(v).padStart(n);
console.log("unit        family  faction  px   colours slots ink%");
for (const unit of SAMPLE_UNITS) {
  const rows = [];
  for (const faction of FACTIONS) rows.push(analyse(unit.id, unit.family, faction));
  const avg = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
  console.log(
    `${pad(unit.id, 11)} ${pad(unit.family, 6)} ${pad("-", 7)} ${pad(Math.round(avg("count")), 4)} ` +
    `${pad(avg("colours").toFixed(1), 7)} ${pad(avg("slots").toFixed(1), 5)} ${pad((avg("inkRatio") * 100).toFixed(0), 4)}`,
  );
}
