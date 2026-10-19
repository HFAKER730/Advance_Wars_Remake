/**
 * Prints per unit: distinct faction silhouettes and colour count.
 * Used to spot units whose four faction kits still collapse to one outline.
 */
import { createCanvas } from "./canvas-shim.mjs";
import { FACTIONS, SAMPLE_UNITS } from "../public/art/faction-style.mjs";
import { paintLandUnit } from "../public/art/faction-land.mjs";
import { paintAirUnit } from "../public/art/faction-air.mjs";
import { paintSeaUnit } from "../public/art/faction-sea.mjs";

const PAINTERS = { foot: paintLandUnit, land: paintLandUnit, air: paintAirUnit, sea: paintSeaUnit };

function render(type, family, faction) {
  const c = createCanvas(40, 40);
  PAINTERS[family](c.getContext("2d"), type, faction, -1);
  return c;
}

console.log("unit        distinct  colours(avg)  px(avg)");
for (const unit of SAMPLE_UNITS) {
  const sigs = new Set();
  let colours = 0, px = 0;
  for (const f of FACTIONS) {
    const c = render(unit.id, unit.family, f);
    let sig = "", set = new Set();
    for (let i = 0; i < c.data.length; i += 4) {
      sig += c.data[i + 3] > 0 ? "1" : "0";
      if (c.data[i + 3] > 0) set.add(`${c.data[i]},${c.data[i+1]},${c.data[i+2]}`);
    }
    sigs.add(sig);
    colours += set.size;
    px += set.size ? Array.from(sig).filter((v) => v === "1").length : 0;
  }
  console.log(
    `${unit.id.padEnd(11)} ${String(sigs.size).padStart(6)}  ${(colours / 4).toFixed(1).padStart(11)}  ${Math.round(px / 4).toString().padStart(6)}`,
  );
}
