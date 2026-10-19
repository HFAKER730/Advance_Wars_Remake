/**
 * Detail comparison: frozen unit-art vs faction painters.
 *
 * Reports pixels, distinct colours, and "edge transitions" (colour changes
 * between 4-neighbours) — a rough proxy for internal detail density.
 */
import { createCanvas } from "./canvas-shim.mjs";
import { paintUnitArtwork } from "../public/unit-art.mjs";
import { paintLandUnit } from "../public/art/faction-land.mjs";
import { paintAirUnit } from "../public/art/faction-air.mjs";
import { paintSeaUnit } from "../public/art/faction-sea.mjs";

const REF_PALETTE = ["#f79a75", "#df634c", "#a83c36", "#713134"];
const MAP = {
  infantry: "infantry", mech: "mech", recon: "recon", tank: "tank", heavy: "heavy",
  artillery: "artillery", rocket: "rocket", apc: "apc",
  fighter: "fighter", heli: "copter", destroyer: "patrol", lander: "landing",
};
const FACTION = {
  fighter: paintAirUnit, heli: paintAirUnit, destroyer: paintSeaUnit, lander: paintSeaUnit,
};

function stats(canvas) {
  const colours = new Set();
  let px = 0, edges = 0;
  const key = (o) => `${canvas.data[o]},${canvas.data[o+1]},${canvas.data[o+2]},${canvas.data[o+3]}`;
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
    const o = (y * 40 + x) * 4;
    if (canvas.data[o+3] === 0) continue;
    px++; colours.add(key(o));
    if (x + 1 < 40) { const r = (y * 40 + x + 1) * 4; if (canvas.data[r+3] && key(r) !== key(o)) edges++; }
    if (y + 1 < 40) { const d = ((y + 1) * 40 + x) * 4; if (canvas.data[d+3] && key(d) !== key(o)) edges++; }
  }
  return { px, colours: colours.size, edges };
}

console.log("unit        ref px/col/edge     faction(avg) px/col/edge");
for (const [refType, factionType] of Object.entries(MAP)) {
  const ref = createCanvas(40, 40);
  paintUnitArtwork(ref.getContext("2d"), refType, REF_PALETTE);
  const r = stats(ref);
  const painters = FACTION[refType] ? [FACTION[refType]] : [paintLandUnit];
  const acc = { px: 0, colours: 0, edges: 0 };
  for (const f of ["red", "blue", "yellow", "green"]) {
    const c = createCanvas(40, 40);
    painters[0](c.getContext("2d"), factionType, f, -1);
    const s = stats(c);
    acc.px += s.px; acc.colours += s.colours; acc.edges += s.edges;
  }
  console.log(
    `${refType.padEnd(11)} ${String(r.px).padStart(4)}/${String(r.colours).padStart(3)}/${String(r.edges).padStart(4)}` +
    `     ${String(Math.round(acc.px/4)).padStart(4)}/${(acc.colours/4).toFixed(1).padStart(4)}/${String(Math.round(acc.edges/4)).padStart(4)}`,
  );
}
