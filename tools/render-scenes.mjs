/**
 * Renders the combat scene and the pixel font to PNGs with the same code the
 * browser runs, so palette, grid and font changes can be reviewed without
 * opening a browser.
 *
 *   node tools/render-scenes.mjs [outDir]
 *
 * Uses the headless canvas shim. The shim has no text API, which is exactly
 * what the pixel font is for.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, encodePng } from "./canvas-shim.mjs";
import { paintCombatScene } from "../public/combat-scene.mjs";
import { paintPixelText } from "../public/pixel-font.mjs";

// Unit sprites are cached in module scope through `document.createElement`.
// Give the shim the one DOM call they need, so the same painters run in Node.
globalThis.document = {
  createElement: () => createCanvas(40, 40),
};

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "art-sheets", "scenes");
const SCALE = 3;

await mkdir(OUT, { recursive: true });

async function save(name, canvas) {
  await writeFile(
    resolve(OUT, `${name}.png`),
    encodePng(canvas.data, canvas.width, canvas.height, SCALE),
  );
}

function combat(attacker, defender, elapsed, counter, name) {
  const canvas = createCanvas(640, 300);
  paintCombatScene(canvas.getContext("2d"), {
    attacker,
    defender,
    damage: 4,
    counter,
    attackerTerrain: "plain",
    defenderTerrain: "forest",
    elapsed,
  });
  return save(name, canvas);
}

/** A contact sheet of every glyph the HUD can print, plus real HUD strings. */
async function fontSheet() {
  const canvas = createCanvas(360, 180);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1b3832";
  ctx.fillRect(0, 0, 360, 180);
  const rows = ["0123456789", "/ - + . :", "10/10", "7/10", "-12", "-4"];
  rows.forEach((text, index) => {
    paintPixelText(ctx, text, 12, 12 + index * 22, {
      scale: 3,
      color: "#fff2cf",
      outline: "#0e1c1a",
    });
  });
  paintPixelText(ctx, "9", 300, 12, { scale: 9, color: "#fff9e8", outline: "#263b3c" });
  await save("font-sheet", canvas);
}

await fontSheet();

await combat(
  { type: "tank", owner: 0, hp: 10, hpAfter: 10, x: 4, y: 4, ammo: 6, fuel: 70 },
  { type: "infantry", owner: 1, hp: 10, hpAfter: 6, x: 5, y: 4, ammo: null, fuel: 99 },
  520,
  2,
  "combat-hit",
);
await combat(
  { type: "bomber", owner: 0, hp: 10, hpAfter: 8, x: 4, y: 4, ammo: 9, fuel: 45 },
  { type: "heavy", owner: 1, hp: 10, hpAfter: 5, x: 5, y: 4, ammo: 5, fuel: 50 },
  300,
  3,
  "combat-air",
);

console.log(`wrote ${OUT}`);
