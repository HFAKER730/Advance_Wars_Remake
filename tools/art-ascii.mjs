/** Dump one sprite as ASCII so pixel structure is readable without an image. */
import { createCanvas } from "./canvas-shim.mjs";
import { paintLandUnit } from "../public/art/faction-land.mjs";
import { paintAirUnit } from "../public/art/faction-air.mjs";
import { paintSeaUnit } from "../public/art/faction-sea.mjs";
import { FACTION_STYLES } from "../public/art/faction-style.mjs";

const [type = "tank", faction = "red"] = process.argv.slice(2);
const family = ["fighter", "copter"].includes(type) ? "air"
  : ["patrol", "landing"].includes(type) ? "sea" : "land";
const canvas = createCanvas(40, 40);
const paint = family === "air" ? paintAirUnit : family === "sea" ? paintSeaUnit : paintLandUnit;
paint(canvas.getContext("2d"), type, faction, -1);
const s = FACTION_STYLES[faction];
const ramp = [s.paintLight, s.paintMid, s.paintDark, s.paintShade, s.metal, s.metalLight, s.metalDark, s.accent, s.glass, s.rubber, s.canvas, s.wood, s.treadLight, s.tireHub];
const marks = ["L", "m", "d", "s", "t", "T", "K", "a", "g", "r", "c", "w", "e", "h"];
const hex = (r, g, b) => `#${[r,g,b].map((v)=>v.toString(16).padStart(2,"0")).join("")}`;
console.log(`   ${Array.from({length:40},(_,i)=>i%10).join("")}`);
for (let y = 0; y < 40; y++) {
  let row = "";
  for (let x = 0; x < 40; x++) {
    const o = (y * 40 + x) * 4;
    if (canvas.data[o + 3] === 0) { row += "."; continue; }
    const key = hex(canvas.data[o], canvas.data[o + 1], canvas.data[o + 2]);
    const i = ramp.indexOf(key);
    row += i >= 0 ? marks[i] : "?";
  }
  console.log(`${String(y).padStart(2)} ${row}`);
}
