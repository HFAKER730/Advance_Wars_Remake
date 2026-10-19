/** Original procedural pixel artwork for Frontline Command. No external assets. */
import { UNITS, TERRAINS, reachable } from "./shared/engine.mjs";
import { paintUnitArtwork } from "./unit-art.mjs";
import { paintDirectionalMotion } from "./unit-direction.mjs";
import { COMBAT_TIMING, combatDuration } from "./combat-scene.mjs";
import { deathEffectKind, paintFallingSoldier, paintVehicleBlast } from "./unit-death.mjs";
import { MOVE_STEP_MS, MOVE_TURN_MS, movementDuration, captureDuration } from "./shared/animation-timing.mjs";
import { propertyFlagPose } from "./property-flag.mjs";
import { paintPixelText } from "./pixel-font.mjs";

export { movementDuration } from "./shared/animation-timing.mjs";

export const TEAM_COLORS = ["#ef745e", "#64b7e8", "#edcb66", "#9c8ce6"];
const TILE = 40;
export const TEAM_PALETTES = [
  ["#f79a75", "#df634c", "#a83c36", "#713134"],
  ["#91d5ef", "#4ba5d1", "#2e668f", "#29415f"],
  ["#ffe499", "#dfbd56", "#a27b33", "#6a522d"],
  ["#c2acef", "#9278ce", "#634da0", "#44385f"],
];
/** The single base tone every plain tile shares, so the board reads as one field. */
const MEADOW = "#7a9a6d";
/** Two neighbours of the base tone, used for sparse tufts rather than whole tiles. */
const MEADOW_LIGHT = "#86a675";
const MEADOW_DARK = "#6b8b62";
const NEUTRAL = ["#e4ddbd", "#b7b89d", "#777f74", "#505f5a"];
const hash = (x, y, k = 0) =>
  Math.abs(((x * 92837111) ^ (y * 689287499) ^ (k * 283923481)) >>> 0);
const tileKey = (x, y) => `${x},${y}`;
const palette = (owner) =>
  owner == null ? NEUTRAL : TEAM_PALETTES[((owner % 4) + 4) % 4];

function box(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
function line(ctx, points, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(Math.round(points[0][0]), Math.round(points[0][1]));
  for (let i = 1; i < points.length; i++)
    ctx.lineTo(Math.round(points[i][0]), Math.round(points[i][1]));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function polygon(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(Math.round(points[0][0]), Math.round(points[0][1]));
  for (let i = 1; i < points.length; i++)
    ctx.lineTo(Math.round(points[i][0]), Math.round(points[i][1]));
  ctx.closePath();
  ctx.fill();
}
/**
 * A 2px checkerboard of the dark tone. Pixel art fakes translucency with
 * dithering: it keeps every colour inside the palette and stays crisp when the
 * canvas is upscaled, which a `globalAlpha` wash never does.
 */
function dither(ctx, x, y, w, h, color = "rgba(18,38,34,.42)") {
  ctx.fillStyle = color;
  for (let row = 0; row < h; row += 2) {
    const offset = (Math.floor(row / 2) % 2) * 2;
    for (let column = offset; column < w; column += 4)
      ctx.fillRect(Math.round(x + column), Math.round(y + row), 2, 2);
  }
}
function tree(ctx, x, y, size = 1, shade = 0) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(size, size);
  box(ctx, 0, 12, 12, 4, "#627c58");
  box(ctx, 5, 9, 3, 7, "#665b41");
  box(ctx, 2, 5, 11, 7, "#315e51");
  box(ctx, 0, 2, 13, 7, shade ? "#3e7059" : "#3c6e53");
  box(ctx, 3, -1, 8, 3, "#4e805c");
  box(ctx, 1, 3, 5, 3, "#619261");
  box(ctx, 5, 0, 5, 3, "#729d69");
  box(ctx, 10, 6, 3, 5, "#2e594b");
  ctx.restore();
}
function pine(ctx, x, y, size = 1) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(size, size);
  box(ctx, 6, 15, 3, 6, "#6b6042");
  box(ctx, 0, 13, 15, 4, "#315c4c");
  box(ctx, 2, 8, 11, 5, "#376a50");
  box(ctx, 4, 4, 7, 5, "#46815c");
  box(ctx, 6, 0, 3, 5, "#669367");
  box(ctx, 3, 12, 3, 2, "#619461");
  ctx.restore();
}

function paintGround(ctx, tile) {
  const { x, y } = tile;
  // One base tone across the whole board with sparse tufts. Per-tile colour
  // pickups turned every field into a checkerboard patchwork and read as noise
  // rather than terrain.
  box(ctx, 0, 0, TILE, TILE, MEADOW);
  for (let i = 0; i < 6; i++) {
    const px = 3 + (hash(x, y, i + 2) % 33);
    const py = 3 + (hash(y, x, i + 30) % 32);
    box(ctx, px, py, 2, 1, i % 3 ? MEADOW_LIGHT : MEADOW_DARK);
    if (i % 4 === 0) box(ctx, px, py + 1, 1, 1, MEADOW_DARK);
  }
}
function paintSea(ctx, tile, neighbors) {
  box(ctx, 0, 0, TILE, TILE, "#3f7f91");
  // Deep-water banding, then a foam edge wherever the sea meets land.
  for (let i = 0; i < TILE; i += 4) {
    const shade = (hash(tile.x, tile.y, i) >> 3) % 4;
    box(ctx, 0, i, TILE, 2, shade === 0 ? "#39758a" : shade === 1 ? "#448699" : "#3b7b8e");
  }
  const land = (t) =>
    t && !["water", "sea", "bridge"].includes(t.type);
  const foam = "#b9dde0";
  if (land(neighbors.up)) {
    box(ctx, 0, 0, TILE, 4, foam);
    box(ctx, 0, 4, TILE, 2, "#8dbfc6");
  }
  if (land(neighbors.down)) {
    box(ctx, 0, 36, TILE, 4, foam);
    box(ctx, 0, 34, TILE, 2, "#8dbfc6");
  }
  if (land(neighbors.left)) {
    box(ctx, 0, 0, 4, TILE, foam);
    box(ctx, 4, 0, 2, TILE, "#8dbfc6");
  }
  if (land(neighbors.right)) {
    box(ctx, 36, 0, 4, TILE, foam);
    box(ctx, 34, 0, 2, TILE, "#8dbfc6");
  }
}
function paintWater(ctx, tile, neighbors) {
  box(ctx, 0, 0, TILE, TILE, "#578f9c");
  box(ctx, 0, 0, TILE, 2, "#609aa4");
  const land = (t) => t && t.type !== "water" && t.type !== "sea" && t.type !== "bridge";
  if (land(neighbors.up)) {
    box(ctx, 0, 0, TILE, 5, "#a7b185");
    box(ctx, 0, 5, TILE, 2, "#8fb4ad");
    box(ctx, 4, 3, 9, 2, "#bdbe8d");
    box(ctx, 26, 3, 8, 2, "#bdbe8d");
  }
  if (land(neighbors.down)) {
    box(ctx, 0, 35, TILE, 5, "#a7b185");
    box(ctx, 0, 33, TILE, 2, "#8fb4ad");
  }
  if (land(neighbors.left)) {
    box(ctx, 0, 0, 5, TILE, "#a7b185");
    box(ctx, 5, 0, 2, TILE, "#8fb4ad");
  }
  if (land(neighbors.right)) {
    box(ctx, 35, 0, 5, TILE, "#a7b185");
    box(ctx, 33, 0, 2, TILE, "#8fb4ad");
  }
}
function paintRoad(ctx, neighbors, bridge = false) {
  const connects = (t) =>
    t && ["road", "bridge", "city", "factory", "airport", "port", "hq"].includes(t.type);
  let u = connects(neighbors.up),
    d = connects(neighbors.down);
  let l = connects(neighbors.left),
    r = connects(neighbors.right);
  if (!u && !d && !l && !r) l = r = true;
  const surface = bridge ? "#b5b298" : "#b4ad89";
  const edge = bridge ? "#5e6862" : "#8d9272";
  box(ctx, 7, 7, 26, 26, edge);
  box(ctx, 9, 9, 22, 22, surface);
  if (u) {
    box(ctx, 7, 0, 26, 20, edge);
    box(ctx, 9, 0, 22, 20, surface);
  }
  if (d) {
    box(ctx, 7, 20, 26, 20, edge);
    box(ctx, 9, 20, 22, 20, surface);
  }
  if (l) {
    box(ctx, 0, 7, 20, 26, edge);
    box(ctx, 0, 9, 20, 22, surface);
  }
  if (r) {
    box(ctx, 20, 7, 20, 26, edge);
    box(ctx, 20, 9, 20, 22, surface);
  }
  if (bridge) {
    const horizontal = (l || r) && !(u || d);
    if (horizontal) {
      box(ctx, 0, 5, 40, 3, "#d8d4ae");
      box(ctx, 0, 32, 40, 3, "#464f4c");
      for (let x = 0; x < 40; x += 8) {
        box(ctx, x, 5, 2, 5, "#e2dab4");
        box(ctx, x, 30, 2, 6, "#979780");
      }
      for (let x = 4; x < 40; x += 8) box(ctx, x, 11, 1, 18, "#a09f89");
    } else {
      box(ctx, 5, 0, 3, 40, "#d8d4ae");
      box(ctx, 32, 0, 3, 40, "#464f4c");
      for (let y = 0; y < 40; y += 8) {
        box(ctx, 5, y, 5, 2, "#e2dab4");
        box(ctx, 30, y, 6, 2, "#979780");
      }
      for (let y = 4; y < 40; y += 8) box(ctx, 11, y, 18, 1, "#a09f89");
    }
  } else {
    if (u) box(ctx, 19, 2, 2, 5, "#d6cfac");
    if (d) box(ctx, 19, 34, 2, 4, "#d6cfac");
    if (l) box(ctx, 2, 19, 5, 2, "#d6cfac");
    if (r) box(ctx, 34, 19, 4, 2, "#d6cfac");
    box(ctx, 12, 13, 2, 1, "#c4bd99");
    box(ctx, 26, 25, 3, 1, "#a49f81");
  }
}
function paintMountain(ctx, tile) {
  const flip = hash(tile.x, tile.y) % 2;
  if (flip) {
    ctx.translate(40, 0);
    ctx.scale(-1, 1);
  }
  polygon(
    ctx,
    [
      [3, 34],
      [3, 30],
      [7, 30],
      [7, 24],
      [12, 24],
      [12, 17],
      [16, 17],
      [16, 10],
      [20, 10],
      [20, 5],
      [23, 5],
      [23, 10],
      [27, 10],
      [27, 17],
      [31, 17],
      [31, 25],
      [35, 25],
      [35, 31],
      [38, 31],
      [38, 36],
    ],
    "#536a56",
  );
  polygon(
    ctx,
    [
      [5, 32],
      [9, 24],
      [14, 24],
      [18, 15],
      [21, 8],
      [23, 8],
      [23, 31],
      [33, 35],
      [10, 35],
    ],
    "#a7aa84",
  );
  polygon(
    ctx,
    [
      [23, 8],
      [26, 15],
      [28, 20],
      [31, 26],
      [36, 33],
      [25, 34],
      [20, 30],
    ],
    "#7c8a70",
  );
  polygon(
    ctx,
    [
      [16, 17],
      [20, 9],
      [21, 5],
      [23, 5],
      [26, 14],
      [27, 17],
      [23, 15],
      [21, 18],
      [19, 15],
    ],
    "#e4dfbd",
  );
  box(ctx, 10, 28, 5, 2, "#bdba91");
  box(ctx, 15, 23, 3, 3, "#c6c29b");
  box(ctx, 27, 29, 3, 2, "#607660");
}
function paintBuilding(ctx, tile) {
  const p = palette(tile.owner);
  box(ctx, 3, 10, 34, 28, "#78876e");
  box(ctx, 4, 9, 32, 27, "#b2b294");
  box(ctx, 7, 12, 26, 21, "#c3c1a2");
  box(ctx, 29, 17, 7, 19, "#8b917b");
  if (tile.type === "factory") {
    box(ctx, 6, 16, 27, 17, "#777f70");
    box(ctx, 6, 12, 8, 6, p[2]);
    box(ctx, 14, 9, 8, 9, p[1]);
    box(ctx, 22, 12, 11, 6, p[2]);
    box(ctx, 7, 12, 7, 2, p[0]);
    box(ctx, 15, 9, 7, 2, p[0]);
    box(ctx, 23, 12, 9, 2, p[0]);
    box(ctx, 10, 22, 19, 11, "#394f4a");
    box(ctx, 12, 22, 15, 2, "#a6af9e");
    box(ctx, 12, 26, 15, 1, "#7f9585");
    box(ctx, 12, 29, 15, 1, "#7f9585");
    box(ctx, 29, 4, 4, 10, "#6f7a6a");
    box(ctx, 28, 3, 6, 3, "#b5b59a");
    box(ctx, 29, 4, 4, 1, "#455b50");
    box(ctx, 5, 32, 28, 3, "#d9cd9a");
    for (let x = 7; x < 32; x += 6) box(ctx, x, 33, 3, 2, "#8a835f");
  } else if (tile.type === "hq") {
    box(ctx, 8, 14, 23, 19, "#d5ccb0");
    box(ctx, 7, 12, 25, 5, p[2]);
    box(ctx, 10, 10, 19, 3, p[1]);
    box(ctx, 14, 6, 11, 5, p[0]);
    box(ctx, 9, 17, 3, 13, "#f3e3b7");
    box(ctx, 27, 17, 3, 13, "#b2b498");
    box(ctx, 17, 22, 7, 10, "#3e5855");
    box(ctx, 16, 18, 9, 2, "#799187");
    box(ctx, 7, 32, 26, 3, "#eddfb6");
    box(ctx, 5, 35, 30, 2, "#c7bd96");
    // The two-tone star is a distinct command-post insignia.
    box(ctx, 19, 10, 3, 6, "#ffe7aa");
    box(ctx, 17, 12, 7, 2, "#ffe7aa");
  } else if (tile.type === "airport") {
    // Flat apron with a runway stripe and a striped control tower.
    box(ctx, 3, 12, 34, 25, "#6f7d76");
    box(ctx, 5, 14, 30, 21, "#8f9b90");
    box(ctx, 7, 20, 26, 3, "#e8e4c8");
    for (let x = 8; x < 32; x += 6) box(ctx, x, 20, 3, 3, "#7d8a80");
    box(ctx, 8, 15, 4, 4, "#cfc9a8");
    box(ctx, 15, 15, 4, 4, "#cfc9a8");
    box(ctx, 26, 6, 8, 12, "#c3bda0");
    box(ctx, 27, 7, 6, 9, p[2]);
    box(ctx, 27, 7, 6, 2, p[0]);
    box(ctx, 29, 2, 2, 5, "#d8d3b4");
    box(ctx, 27, 9, 6, 2, "#3f4d49");
    box(ctx, 4, 28, 32, 2, "#b0a982");
  } else if (tile.type === "port") {
    // Quay wall, bollards and a crane; the water side is the sea or river.
    box(ctx, 3, 12, 34, 24, "#8b8f7d");
    box(ctx, 4, 14, 32, 20, "#c0baa0");
    box(ctx, 4, 30, 32, 6, "#5a7b82");
    box(ctx, 6, 31, 28, 2, "#7fa6ab");
    for (let x = 7; x < 33; x += 7) box(ctx, x, 27, 3, 3, "#6c6a55");
    // Crane arm reaching over the quay edge.
    box(ctx, 9, 4, 4, 20, "#6b6a58");
    box(ctx, 9, 4, 18, 3, p[2]);
    box(ctx, 11, 4, 14, 1, p[0]);
    box(ctx, 26, 7, 1, 8, "#4d4a3d");
    box(ctx, 24, 14, 5, 3, "#3e4a45");
    box(ctx, 22, 16, 9, 2, "#a99b74");
    box(ctx, 28, 18, 7, 8, "#a8a184");
    box(ctx, 29, 19, 5, 5, p[2]);
  } else {
    box(ctx, 7, 13, 12, 18, "#e3d5b0");
    box(ctx, 6, 10, 14, 6, p[2]);
    box(ctx, 8, 8, 10, 3, p[1]);
    box(ctx, 8, 9, 10, 1, p[0]);
    box(ctx, 21, 18, 12, 15, "#cecaab");
    box(ctx, 20, 15, 14, 5, p[2]);
    box(ctx, 22, 13, 10, 3, p[1]);
    box(ctx, 22, 14, 10, 1, p[0]);
    for (const [x, y] of [
      [9, 18],
      [15, 18],
      [9, 24],
      [23, 22],
      [29, 22],
    ]) {
      box(ctx, x, y, 3, 4, "#587575");
      box(ctx, x, y, 3, 1, "#385655");
    }
    box(ctx, 14, 25, 4, 7, "#6d7968");
    box(ctx, 25, 28, 4, 5, "#6d7968");
    box(ctx, 4, 33, 31, 2, "#d4c8a3");
  }
}
function paintTile(ctx, tile, neighbors) {
  ctx.save();
  ctx.translate(tile.x * TILE, tile.y * TILE);
  paintGround(ctx, tile);
  switch (tile.type) {
    case "sea":
      paintSea(ctx, tile, neighbors);
      break;
    case "water":
      paintWater(ctx, tile, neighbors);
      break;
    case "bridge":
      paintWater(ctx, tile, neighbors);
      paintRoad(ctx, neighbors, true);
      break;
    case "road":
      paintRoad(ctx, neighbors);
      break;
    case "forest":
      tree(ctx, 22, 4, 1, 1);
      tree(ctx, 2, 2);
      pine(ctx, 14, 12);
      tree(ctx, 2, 20, 0.9, 1);
      tree(ctx, 26, 24, 0.8);
      break;
    case "mountain":
      paintMountain(ctx, tile);
      break;
    case "city":
    case "factory":
    case "airport":
    case "port":
    case "hq":
      paintBuilding(ctx, tile);
      break;
    default:
      if (hash(tile.x, tile.y, 5) % 9 === 0) {
        box(ctx, 29, 30, 3, 2, "#b9b68b");
        box(ctx, 31, 29, 3, 2, "#a7a87c");
      }
  }
  // No per-tile seam lines: adjacent tiles of the same terrain have to read as
  // one continuous field. Buildings and roads carry their own outlines.
  ctx.restore();
}

function paintUnit(ctx, unit, x, y, motion) {
  const p = palette(unit.owner);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  const resting = motion.action === "idle";
  box(ctx, 6, 29, 29, 4, "rgba(24,45,42,.25)");
  box(ctx, 10, 33, 20, 1, "rgba(24,45,42,.15)");
  paintDirectionalMotion(ctx, unit.type, p, motion.direction || "right", motion.phase, motion.action);
  // Units that already acted are dithered rather than faded. Alpha blending
  // mixes colours the palette does not contain, which is the main thing that
  // separates a pixel-art board from a web UI overlay.
  if (unit.acted && resting) dither(ctx, 2, 2, 36, 28);
  if (unit.acted && resting) {
    box(ctx, 3, 4, 9, 7, "rgba(27,48,43,.85)");
    box(ctx, 5, 7, 2, 2, "#d4ddbb");
    box(ctx, 7, 5, 3, 2, "#d4ddbb");
  }
  // Show the whole unit's strength, including the full 10/10 state.
  box(ctx, 9, 32, 29, 7, "#253f3e");
  box(ctx, 10, 33, Math.max(1, Math.ceil((27 * unit.hp) / 10)), 1, p[0]);
  paintPixelText(ctx, `${Math.ceil(unit.hp)}/10`, 23.5, 33, {
    scale: 1,
    color: unit.hp <= 3 ? "#ffad87" : "#fff2cf",
    align: "center",
  });
  if (unit.cargo) {
    box(ctx, 3, 27, 7, 8, "#263f3b");
    box(ctx, 5, 28, 3, 2, "#ffe4a3");
    box(ctx, 4, 31, 5, 3, "#ffe4a3");
  }
  if (unit.ammo === 0 || unit.fuel === 0) {
    box(ctx, 30, 3, 7, 8, "#ffe1a2");
    box(ctx, 33, 4, 1, 4, "#9c503d");
    box(ctx, 33, 9, 1, 1, "#9c503d");
  }
  ctx.restore();
}

function corners(ctx, x, y, color, inset = 1, length = 7, thickness = 2) {
  const s = TILE - inset * 2;
  x += inset;
  y += inset;
  for (const [cx, cy, dx, dy] of [
    [x, y, 1, 1],
    [x + s, y, -1, 1],
    [x, y + s, 1, -1],
    [x + s, y + s, -1, -1],
  ]) {
    box(
      ctx,
      dx < 0 ? cx - length : cx,
      dy < 0 ? cy - thickness : cy,
      length,
      thickness,
      color,
    );
    box(
      ctx,
      dx < 0 ? cx - thickness : cx,
      dy < 0 ? cy - length : cy,
      thickness,
      length,
      color,
    );
  }
}
function rangeTile(ctx, x, y, isTarget, index) {
  const ox = x * TILE,
    oy = y * TILE;
  // Dithered fill instead of a translucent wash, so the tint stays inside the
  // palette and upscales as visible checkers rather than a muddy rectangle.
  dither(
    ctx,
    ox + 1,
    oy + 1,
    38,
    38,
    isTarget ? "rgba(214,84,62,.34)" : "rgba(46,148,136,.30)",
  );
  const c = isTarget ? "#ff997a" : "#96f8de";
  corners(ctx, ox, oy, c, 2, isTarget ? 5 : 3, 1);
  if (isTarget) {
    box(ctx, ox + 17, oy + 4, 6, 1, "#ffd5b4");
    box(ctx, ox + 4, oy + 17, 1, 6, "#ffd5b4");
  } else if (index % 2 === 0) box(ctx, ox + 19, oy + 19, 2, 2, "#c7ffe8");
}

function heading(from, to) {
  if (to.x > from.x) return "right";
  if (to.x < from.x) return "left";
  return to.y > from.y ? "down" : "up";
}

export function movementPosition(path, elapsed, startFacing = "right") {
  if (!path?.length) return null;
  if (path.length === 1)
    return { ...path[0], direction: startFacing, turning: false, done: true };
  let remaining = Math.max(0, elapsed), previous = startFacing;
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i], to = path[i + 1];
    const direction = heading(from, to);
    if (direction !== previous) {
      if (remaining < MOVE_TURN_MS)
        return {
          x: from.x, y: from.y,
          direction: remaining < MOVE_TURN_MS / 2 ? previous : direction,
          turning: true, done: false,
        };
      remaining -= MOVE_TURN_MS;
    }
    if (remaining < MOVE_STEP_MS) {
      const local = remaining / MOVE_STEP_MS;
      const eased = local - (Math.sin(local * Math.PI * 2) * .35) / (Math.PI * 2);
      return {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
        direction, turning: false, done: false,
      };
    }
    remaining -= MOVE_STEP_MS;
    previous = direction;
  }
  return { ...path[path.length - 1], direction: previous, turning: false, done: true };
}

// Reconstruct one exchange from consecutive authoritative game states. This also
// works for AI and LAN actions, where the local client has no pending command.
export function capturesFromStates(before, after) {
  if (!before || !after || before.mapId !== after.mapId) return [];
  const oldUnits = new Map(before.units.map((unit) => [unit.id, unit]));
  const oldTiles = new Map((before.tiles || []).map((tile) => [tileKey(tile.x, tile.y), tile]));
  const tiles = new Map((after.tiles || []).map((tile) => [tileKey(tile.x, tile.y), tile]));
  return after.units.flatMap((unit) => {
    const old = oldUnits.get(unit.id);
    const key = tileKey(unit.x, unit.y);
    const tile = tiles.get(key), previous = oldTiles.get(key);
    if (!old || old.acted || !unit.acted || !UNITS[unit.type]?.capture ||
      !tile || !previous || !["city", "factory", "hq"].includes(tile.type)) return [];
    if (tile.capture === previous.capture && tile.captureBy === previous.captureBy &&
      tile.owner === previous.owner) return [];
    return [{ unit, tile, previousTile: previous }];
  });
}

export function combatFromStates(before, after) {
  if (!before || !after || before.mapId !== after.mapId) return null;
  const capturing = new Set(capturesFromStates(before, after).map(({ unit }) => unit.id));
  const next = new Map(after.units.map((unit) => [unit.id, unit]));
  const damaged = before.units.filter((unit) => {
    const current = next.get(unit.id);
    return !current || current.hp < unit.hp;
  });
  const actors = before.units.filter((unit) => {
    const current = next.get(unit.id);
    return !unit.acted && (current?.acted || (!current && damaged.length > 1));
  });
  for (const attacker of actors) {
    if (capturing.has(attacker.id)) continue;
    const current = next.get(attacker.id);
    const definition = UNITS[attacker.type];
    for (const defender of damaged) {
      if (defender.owner === attacker.owner || defender.id === attacker.id)
        continue;
      const inRange = (position) => {
        const distance = Math.abs(position.x - defender.x) + Math.abs(position.y - defender.y);
        return distance >= definition.minRange && distance <= definition.maxRange;
      };
      let origin = current || attacker;
      if (!inRange(origin) && !current && before.players && before.tiles)
        origin = reachable(before, attacker.id).find(inRange);
      if (origin && !inRange(origin)) origin = null;
      if (!origin) continue;
      const defenderAfter = next.get(defender.id);
      return {
        attacker: { ...attacker, x: origin.x, y: origin.y, hpAfter: current?.hp ?? 0 },
        defender: { ...defender, hpAfter: defenderAfter?.hp ?? 0 },
        damage: defender.hp - (defenderAfter?.hp ?? 0),
        counter: attacker.hp - (current?.hp ?? 0),
      };
    }
  }
  return null;
}

// Keep the old sprite and HP on the map until that side is hit in the duel.
export function combatDisplayUnits(state, visual, time) {
  if (!visual || time >= visual.endAt) return state.units;
  const units = state.units.slice();
  for (const { unit, hitAt } of [
    { unit: visual.attacker, hitAt: visual.counterHitAt },
    { unit: visual.defender, hitAt: visual.defenderHitAt },
  ]) {
    if (time >= hitAt) continue;
    const index = units.findIndex((item) => item.id === unit.id);
    if (index < 0) units.push({ ...unit });
    else units[index] = { ...units[index], hp: unit.hp, acted: unit.acted };
  }
  return units;
}

export function createRenderer(
  canvas,
  { onTile = () => {}, onHover = () => {}, onCombat = () => {}, onCapture = () => {}, paintPropertyFlag = null, previewUnitMotion = null } = {},
) {
  if (!canvas || typeof canvas.getContext !== "function")
    throw new Error("需要 Canvas 画布");
  const ctx = canvas.getContext("2d", { alpha: false });
  const terrainCanvas = document.createElement("canvas");
  const terrainCtx = terrainCanvas.getContext("2d", { alpha: false });
  let scene = {
    state: null,
    selectedId: null,
    reachable: [],
    targets: [],
    hoverTile: null,
    preview: null,
    /** `Set` of `"x,y"` the viewer can see, or null when the room has no fog. */
    visible: null,
  };
  let frame = null,
    destroyed = false,
    terrainDirty = true,
    lastFrameTime = 0;
  let logicalWidth = 0,
    logicalHeight = 0,
    dpr = 1,
    pixelScale = 1,
    lastPointerKey = null;
  let previousState = null;
  let movement = new Map();
  let explosions = [];
  let actionEvents = [];
  let captureVisuals = new Map();
  let combatVisual = null;
  let unitById = new Map();
  let lastTerrainSignature = "";
  const reducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false;
  canvas.style.imageRendering = "pixelated";
  canvas.style.touchAction = "manipulation";
  canvas.style.display = "block";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "战术地图，点击格子选择单位与行动");

  function size() {
    if (!scene.state) return;
    const width = scene.state.width * TILE,
      height = scene.state.height * TILE;
    // Snap the backing store to whole device pixels per logical pixel. A
    // fractional DPR (1.25, 1.5) would otherwise give some columns two device
    // pixels and others three, which is what makes 1px outlines look chewed.
    const deviceRatio = Math.max(
      1,
      Math.min(3, Math.round(window.devicePixelRatio || 1)),
    );
    if (width !== logicalWidth || height !== logicalHeight) {
      logicalWidth = width;
      logicalHeight = height;
      terrainCanvas.width = width;
      terrainCanvas.height = height;
      terrainDirty = true;
      canvas.setAttribute("data-logical-width", String(width));
    }
    fitDisplay();
    const raster = pixelScale * deviceRatio;
    if (raster !== dpr || canvas.width !== width * raster) {
      dpr = raster;
      canvas.width = Math.round(width * raster);
      canvas.height = Math.round(height * raster);
    }
    ctx.imageSmoothingEnabled = false;
  }
  /**
   * Chooses a whole-number display scale so every logical pixel becomes an
   * n×n block of screen pixels. Below 1:1 the only option that still fits a
   * phone is the old fluid width; nearest-neighbour then has no clean answer,
   * but that is better than a board wider than the viewport.
   */
  function fitDisplay() {
    if (!logicalWidth) return;
    const parent = canvas.parentElement;
    let available = parent?.clientWidth || logicalWidth;
    const style = parent ? getComputedStyle(parent) : null;
    if (style)
      available -=
        (parseFloat(style.paddingLeft) || 0) +
        (parseFloat(style.paddingRight) || 0);
    if (available < logicalWidth) {
      pixelScale = 1;
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      canvas.style.aspectRatio = `${logicalWidth} / ${logicalHeight}`;
      return;
    }
    // Keep the board inside the viewport: the toolbar and sidebar need room
    // below it, and scrolling to see the bottom of a battle map is worse than
    // a smaller integer scale. Measured from the wrapper, not the canvas, so
    // changing the canvas size cannot feed back into the measurement.
    const top = Math.max(0, parent?.getBoundingClientRect().top ?? 0);
    const availableHeight = Math.max(
      logicalHeight,
      window.innerHeight - top - 150,
    );
    const next = Math.max(
      1,
      Math.floor(
        Math.min(available / logicalWidth, availableHeight / logicalHeight),
      ),
    );
    if (next === pixelScale && canvas.style.width) return;
    pixelScale = next;
    canvas.style.width = `${logicalWidth * pixelScale}px`;
    canvas.style.height = `${logicalHeight * pixelScale}px`;
    canvas.style.aspectRatio = "auto";
  }
  function rebuildTerrain() {
    const state = scene.state;
    if (!state) return;
    terrainCtx.imageSmoothingEnabled = false;
    terrainCtx.fillStyle = MEADOW;
    terrainCtx.fillRect(0, 0, logicalWidth, logicalHeight);
    const lookup = new Map(state.tiles.map((t) => [tileKey(t.x, t.y), t]));
    for (const tile of state.tiles) {
      const visual = captureVisuals.get(tileKey(tile.x, tile.y));
      const paintedTile = visual?.completed
        ? { ...tile, owner: visual.previousOwner } : tile;
      paintTile(terrainCtx, paintedTile, {
        up: lookup.get(tileKey(tile.x, tile.y - 1)),
        down: lookup.get(tileKey(tile.x, tile.y + 1)),
        left: lookup.get(tileKey(tile.x - 1, tile.y)),
        right: lookup.get(tileKey(tile.x + 1, tile.y)),
      });
    }
    terrainDirty = false;
  }
  function setScene(next) {
    if (destroyed) return;
    const state = next.state || scene.state;
    if (state && state !== previousState) {
      const now = performance.now();
      if (
        !reducedMotion &&
        previousState &&
        previousState.mapId === state.mapId &&
        previousState.width === state.width
      ) {
        const exchange = combatFromStates(previousState, state);
        const oldUnits = new Map(previousState.units.map((u) => [u.id, u]));
        for (const u of state.units) {
          const old = oldUnits.get(u.id);
          if (old && (old.x !== u.x || old.y !== u.y)) {
            const route = reachable(previousState, old.id).find(
              (cell) => cell.x === u.x && cell.y === u.y,
            );
            if (route?.path.length > 1)
              movement.set(u.id, {
                path: route.path,
                start: now,
                startFacing: "right",
                duration: movementDuration(route.path),
              });
          }
          if (old && old.type === "apc" && !old.acted && u.acted) {
            const move = movement.get(u.id);
            const delay = move ? Math.max(0, move.start + move.duration - now) : 0;
            actionEvents.push({ id: u.id, action: "supply", start: now + delay, duration: 1050 });
          }
        }
        for (const { unit, tile, previousTile } of capturesFromStates(previousState, state)) {
          const move = movement.get(unit.id);
          const delay = move ? Math.max(0, move.start + move.duration - now) : 0;
          const completed = tile.owner === unit.owner && previousTile.owner !== unit.owner;
          const capture = {
            owner: unit.owner,
            previousOwner: previousTile.owner,
            progressBefore: previousTile.captureBy === unit.owner ? 20 - previousTile.capture : 0,
            progressAfter: completed ? 20 : 20 - tile.capture,
            completed,
            start: now + delay,
            duration: captureDuration(completed),
          };
          captureVisuals.set(tileKey(tile.x, tile.y), capture);
          if (completed) terrainDirty = true;
          onCapture({
            unit,
            tile,
            previousOwner: capture.previousOwner,
            progressBefore: capture.progressBefore,
            progressAfter: capture.progressAfter,
            completed,
            delay,
            duration: capture.duration,
          });
        }
        const attackingMove = exchange ? movement.get(exchange.attacker.id) : null;
        const travelDelay = attackingMove
          ? Math.max(0, attackingMove.start + attackingMove.duration - now)
          : 0;
        const battleStart = now + travelDelay;
        if (exchange) {
          const attackerAt = state.units.find((unit) => unit.id === exchange.attacker.id) || exchange.attacker;
          const terrainAt = (unit) => state.tiles.find((tile) => tile.x === unit.x && tile.y === unit.y)?.type || "plain";
          combatVisual = {
            attacker: { ...exchange.attacker, x: attackerAt.x, y: attackerAt.y },
            defender: exchange.defender,
            defenderHitAt: battleStart + COMBAT_TIMING.firstHit,
            counterHitAt: exchange.counter > 0 ? battleStart + COMBAT_TIMING.counterHit : Infinity,
            endAt: battleStart + combatDuration(exchange.counter),
          };
          onCombat({
            ...exchange,
            attackerTerrain: terrainAt(attackerAt),
            defenderTerrain: terrainAt(exchange.defender),
            delay: travelDelay,
          });
        }
        if (exchange) {
          const { attacker, defender, counter } = exchange;
          const attackerAt = state.units.find((unit) => unit.id === attacker.id) || attacker;
          actionEvents.push({
            id: attacker.id, action: "attack", start: battleStart + COMBAT_TIMING.firstFire - 180, duration: 450,
            direction: heading(attackerAt, defender),
          });
          actionEvents.push({ id: defender.id, action: "hit", start: combatVisual.defenderHitAt, duration: 500 });
          if (counter > 0) {
            actionEvents.push({
              id: defender.id, action: "attack", start: battleStart + COMBAT_TIMING.counterFire - 180, duration: 450,
              direction: heading(defender, attackerAt),
            });
            actionEvents.push({ id: attacker.id, action: "hit", start: combatVisual.counterHitAt, duration: 500 });
          }
        }
        for (const u of state.units) {
          const old = oldUnits.get(u.id);
          if (old && old.hp > u.hp) {
            const start = exchange?.defender.id === u.id
              ? combatVisual.defenderHitAt
              : exchange?.attacker.id === u.id && exchange.counter > 0
                ? combatVisual.counterHitAt : now;
            explosions.push({ x: u.x, y: u.y, start, destroyed: false });
          }
        }
        for (const old of oldUnits.values()) {
          if (exchange && (old.id === exchange.attacker.id || old.id === exchange.defender.id) &&
            !state.units.some((u) => u.id === old.id)) {
            const position = old.id === exchange.attacker.id ? combatVisual.attacker : old;
            explosions.push({
              x: position.x, y: position.y, type: old.type, owner: old.owner, destroyed: true,
              start: exchange?.defender.id === old.id
                ? combatVisual.defenderHitAt
                : exchange?.attacker.id === old.id && exchange.counter > 0
                  ? combatVisual.counterHitAt : now,
            });
          }
        }
        for (const id of movement.keys())
          if (!state.units.some((u) => u.id === id) && combatVisual?.attacker.id !== id) movement.delete(id);
      } else {
        movement.clear();
        explosions = [];
        actionEvents = [];
        captureVisuals.clear();
        combatVisual = null;
      }
      unitById = new Map(state.units.map((u) => [u.id, u]));
      previousState = state;
    }
    scene = { ...scene, ...next, state };
    if (state) {
      const signature =
        `${state.width}:${state.height}:` +
        state.tiles.map((t) => `${t.type}:${t.owner ?? "-"}`).join("|");
      if (signature !== lastTerrainSignature) {
        terrainDirty = true;
        lastTerrainSignature = signature;
      }
      size();
      canvas.setAttribute(
        "aria-label",
        `战术地图 ${state.width} 列 ${state.height} 行，第 ${state.day || 1} 天。点击格子选择单位与行动。`,
      );
    }
    draw(performance.now());
  }
  /**
   * Fog is painted over the finished board so the tiles a seat cannot see are
   * dimmed without hiding the terrain they already know. Units are absent from
   * those tiles to begin with: the projection already dropped them.
   */
  function paintFog() {
    const visible = scene.visible;
    if (!visible || !scene.state) return;
    // Fog keeps a solid dark wash so unseen ground still reads as clearly out
    // of play, then adds a dithered second pass. The dither supplies the
    // pixel-art texture; the wash keeps the contrast high enough that terrain
    // never looks merely shaded.
    for (const tile of scene.state.tiles) {
      if (visible.has(tileKey(tile.x, tile.y))) continue;
      const x = tile.x * TILE,
        y = tile.y * TILE;
      box(ctx, x, y, TILE, TILE, "rgba(11,26,25,.52)");
      dither(ctx, x, y, TILE, TILE, "rgba(8,20,20,.46)");
      // Sparse darker speckles keep the unseen area from reading as a flat
      // rectangle stamped on top of the board.
      for (let i = 0; i < 5; i++) {
        const seed = hash(tile.x, tile.y, i);
        box(ctx, x + (seed % 36) + 2, y + ((seed >> 8) % 36) + 2, 3, 3, "rgba(4,12,12,.42)");
      }
    }
  }
  function paintDynamics(time) {
    const state = scene.state;
    for (const tile of state.tiles) {
      const x = tile.x * TILE,
        y = tile.y * TILE;
      if (tile.type === "water" || tile.type === "sea" || tile.type === "bridge") {
        if (tile.type === "water" || tile.type === "sea") {
          // Three frames at 160 ms: fast enough to read as moving water, slow
          // enough that the eye does not treat it as a flickering artifact.
          const frame = Math.floor(time / 160 + (hash(tile.x, tile.y) % 3)) % 3;
          const shift = [0, 2, 4][frame];
          const lift = [-1, 0, 1][frame];
          box(ctx, x + 11 + shift, y + 11, 9, 2, "#7ab0b4");
          box(ctx, x + 17 + shift, y + 13, 4, 1, "#689fa9");
          box(ctx, x + 24 - shift, y + 27 + lift, 8, 2, "#79afb4");
          box(ctx, x + 9, y + 31 + lift, 4, 1, "#4e8796");
        }
      }
      if (["city", "factory", "airport", "port", "hq"].includes(tile.type)) {
        if (paintPropertyFlag?.(ctx, tile, time) !== true) {
          const pose = propertyFlagPose(tile, captureVisuals.get(tileKey(tile.x, tile.y)), time);
          if (pose.owner != null) {
            const p = palette(pose.owner);
            const fy = Math.round(y + pose.offset);
            box(ctx, x + 4, y - 17, 2, 35, "#304b43");
            box(ctx, x + 3, y - 18, 4, 2, "#eee1ba");
            box(ctx, x + 6, fy, 11, 7, p[2]);
            box(ctx, x + 6, fy, 10, 3, p[0]);
            box(ctx, x + 14, fy + 3, 4, 3, p[1]);
            box(ctx, x + 6, fy + 6, 8, 1, p[3]);
          }
        }
        if (tile.capture < 20 && tile.captureBy != null) {
          box(ctx, x + 5, y + 36, 30, 3, "#324d44");
          box(
            ctx,
            x + 5,
            y + 36,
            Math.round((30 * (20 - tile.capture)) / 20),
            3,
            TEAM_COLORS[tile.captureBy % 4],
          );
        }
      }
    }
  }
  function paintPath() {
    const preview = scene.preview;
    if (!preview || !scene.selectedId) return;
    const unit = unitById.get(scene.selectedId);
    if (!unit) return;
    const destination = scene.reachable?.find(
      (t) => t.x === preview.x && t.y === preview.y,
    );
    const raw = destination?.path || [];
    const path = raw.length
      ? [{ x: unit.x, y: unit.y }, ...raw]
      : [{ x: unit.x, y: unit.y }, preview];
    if (path.length < 2) return;
    const points = path.map((t) => [t.x * TILE + 20, t.y * TILE + 20]);
    line(ctx, points, "rgba(25,66,57,.75)", 5);
    line(ctx, points, "#dcf5ce", 2);
    const [endX, endY] = points[points.length - 1];
    box(ctx, endX - 3, endY - 3, 6, 6, "#edffe0");
    box(ctx, endX - 1, endY - 1, 2, 2, "#72a690");
  }
  function draw(time = performance.now()) {
    if (destroyed || !scene.state || !logicalWidth) return;
    if (reducedMotion) time = 0;
    const state = scene.state;
    for (const [key, visual] of captureVisuals)
      if (time >= visual.start + visual.duration) {
        captureVisuals.delete(key);
        if (visual.completed) terrainDirty = true;
      }
    if (terrainDirty) rebuildTerrain();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(terrainCanvas, 0, 0);
    paintDynamics(time);
    // Before the units: a unit mid-move may pass through tiles the seat cannot
    // see, and its own marker must stay on top of the fog rather than under it.
    paintFog();
    for (let i = 0; i < (scene.reachable?.length || 0); i++) {
      const t = scene.reachable[i];
      rangeTile(ctx, t.x, t.y, false, i);
    }
    for (const target of scene.targets || []) {
      const u = typeof target === "string" ? unitById.get(target) : target;
      if (u) rangeTile(ctx, u.x, u.y, true, 0);
    }
    paintPath();
    actionEvents = actionEvents.filter((event) => time < event.start + event.duration);
    if (combatVisual && time >= combatVisual.endAt) combatVisual = null;
    const displayUnits = combatDisplayUnits(state, combatVisual, time);
    const loadedIds = new Set(
      state.units
        .filter((u) => u.cargo)
        .map((u) => (typeof u.cargo === "string" ? u.cargo : u.cargo.id)),
    );
    const units = displayUnits
      .filter((u) => !loadedIds.has(u.id) && !u.carriedBy && !u.transportId)
      .slice()
      .sort((a, b) => a.y - b.y || a.x - b.x);
    for (const u of units) {
      let ux = u.x * TILE,
        uy = u.y * TILE;
      let motion = {
        action: "idle",
        phase: (time / (u.type === "mech" ? 2100 : 1500) + (hash(u.x, u.y) % 7) / 7) % 1,
        direction: "right",
      };
      const move = movement.get(u.id);
      let moving = false;
      if (move) {
        const elapsed = Math.max(0, time - move.start);
        const position = movementPosition(move.path, elapsed, move.startFacing);
        ux = position.x * TILE;
        uy = position.y * TILE;
        if (position.done) movement.delete(u.id);
        else {
          const gaitMs = u.type === "mech" ? 600
            : u.type === "infantry" ? 480 : 400;
          motion = {
            action: position.turning ? "turn" : "move",
            phase: (elapsed % gaitMs) / gaitMs,
            direction: position.direction,
          };
          moving = true;
        }
      }
      const event = [...actionEvents].reverse().find((item) =>
        item.id === u.id && time >= item.start && time < item.start + item.duration,
      );
      if (event && !moving)
        motion = {
          action: event.action,
          phase: (time - event.start) / event.duration,
          direction: event.direction || "right",
        };
      paintUnit(ctx, u, ux, uy, previewUnitMotion?.(u, time) || motion);
    }
    explosions = explosions.filter((e) => time - e.start < (e.destroyed ? 1450 : 430));
    for (const e of explosions) {
      if (time < e.start) continue;
      if (e.destroyed) {
        const age = time - e.start;
        if (deathEffectKind(e.type) === "fall")
          paintFallingSoldier(ctx, e.type, palette(e.owner), age, e.x * TILE, e.y * TILE);
        else
          paintVehicleBlast(ctx, age, e.x * TILE + 20, e.y * TILE + 20, .55);
        continue;
      }
      const t = (time - e.start) / 430;
      const cx = e.x * TILE + 20,
        cy = e.y * TILE + 20;
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        // Spark particles shrink in whole steps and vanish on a frame count
        // rather than fading, keeping every drawn pixel fully opaque.
        if (t > 0.15 + (i % 3) * 0.22) continue;
        const size = t < 0.55 ? 4 : 2;
        box(
          ctx,
          cx + Math.cos(angle) * t * 20 - size / 2,
          cy + Math.sin(angle) * t * 20 - size / 2,
          size,
          size,
          i % 2 ? "#ffdc90" : "#fff4ce",
        );
      }
      if (t < 0.4) {
        box(ctx, cx - 4, cy - 12, 8, 24, "#ffdf9c");
        box(ctx, cx - 12, cy - 4, 24, 8, "#fff0ba");
      }
    }
    const selected = scene.selectedId ? unitById.get(scene.selectedId) : null;
    if (selected) {
      // The cursor brackets breathe toward the tile centre and back over
      // ~360 ms, matching the GBA selector's pulse instead of a hard blink.
      const pulse = (Math.sin((time / 360) * Math.PI * 2) + 1) / 2;
      const inset = Math.round(pulse * 3);
      corners(
        ctx,
        selected.x * TILE,
        selected.y * TILE,
        "#264b42",
        inset,
        10,
        4,
      );
      corners(
        ctx,
        selected.x * TILE,
        selected.y * TILE,
        "#fff2c0",
        inset + 1,
        8,
        2,
      );
      box(ctx, selected.x * TILE + 17, selected.y * TILE - 1, 6, 3, "#fff2c0");
    }
    if (scene.preview)
      corners(
        ctx,
        scene.preview.x * TILE,
        scene.preview.y * TILE,
        "#edffe0",
        2,
        9,
        2,
      );
    if (
      scene.hoverTile &&
      (!selected ||
        scene.hoverTile.x !== selected.x ||
        scene.hoverTile.y !== selected.y)
    ) {
      const t = scene.hoverTile;
      corners(ctx, t.x * TILE, t.y * TILE, "rgba(255,246,210,.8)", 1, 7, 1);
    }
    // A slim map-edge bevel anchors the board without obstructing tiles.
    box(ctx, 0, 0, logicalWidth, 1, "rgba(229,236,190,.3)");
    box(ctx, 0, logicalHeight - 1, logicalWidth, 1, "rgba(23,47,44,.25)");
  }
  function tick(time) {
    if (destroyed) return;
    if (
      !reducedMotion &&
      time - lastFrameTime > 32 &&
      !document.hidden &&
      (!canvas.getClientRects || canvas.getClientRects().length)
    ) {
      draw(time);
      lastFrameTime = time;
    }
    frame = requestAnimationFrame(tick);
  }
  function eventTile(event) {
    const state = scene.state;
    if (!state) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    // CSS may constrain the element's height independently from its width.
    // Hit testing follows the actual object-fit content, excluding letterboxes.
    const style =
      typeof getComputedStyle === "function" ? getComputedStyle(canvas) : null;
    const px = (name) => parseFloat(style?.[name]) || 0;
    const leftInset = px("borderLeftWidth") + px("paddingLeft");
    const topInset = px("borderTopWidth") + px("paddingTop");
    const boxWidth =
      rect.width - leftInset - px("borderRightWidth") - px("paddingRight");
    const boxHeight =
      rect.height - topInset - px("borderBottomWidth") - px("paddingBottom");
    let contentWidth = boxWidth,
      contentHeight = boxHeight;
    let contentLeft = rect.left + leftInset,
      contentTop = rect.top + topInset;
    if (
      style?.objectFit === "contain" ||
      style?.objectFit === "cover" ||
      style?.objectFit === "scale-down"
    ) {
      const ratios = [boxWidth / logicalWidth, boxHeight / logicalHeight];
      const ratio =
        style.objectFit === "cover" ? Math.max(...ratios) : Math.min(...ratios);
      contentWidth = logicalWidth * ratio;
      contentHeight = logicalHeight * ratio;
      const position = (style.objectPosition || "50% 50%").split(/\s+/);
      const offset = (value, space) => {
        if (value === "left" || value === "top") return 0;
        if (value === "right" || value === "bottom") return space;
        if (!value || value === "center") return space / 2;
        return value.endsWith("%")
          ? ((parseFloat(value) || 0) * space) / 100
          : parseFloat(value) || 0;
      };
      contentLeft += offset(position[0], boxWidth - contentWidth);
      contentTop += offset(position[1], boxHeight - contentHeight);
    }
    const x = Math.floor(
      ((event.clientX - contentLeft) / contentWidth) * state.width,
    );
    const y = Math.floor(
      ((event.clientY - contentTop) / contentHeight) * state.height,
    );
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) return null;
    return { x, y };
  }
  function click(event) {
    const tile = eventTile(event);
    if (tile) onTile(tile.x, tile.y);
  }
  function hover(event) {
    if (event.pointerType === "touch") return;
    const tile = eventTile(event);
    const key = tile ? tileKey(tile.x, tile.y) : null;
    if (key === lastPointerKey) return;
    lastPointerKey = key;
    if (tile) onHover(tile.x, tile.y);
    else {
      scene.hoverTile = null;
      draw();
    }
  }
  function leave() {
    lastPointerKey = null;
    scene.hoverTile = null;
    draw();
  }
  canvas.addEventListener("click", click);
  canvas.addEventListener("pointermove", hover);
  canvas.addEventListener("pointerleave", leave);
  const observer =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          size();
          draw();
        })
      : null;
  observer?.observe(canvas);
  const onWindowResize = () => {
    size();
    draw();
  };
  window.addEventListener("resize", onWindowResize);
  frame = requestAnimationFrame(tick);
  return {
    setScene,
    render: () => draw(performance.now()),
    resize: () => {
      size();
      draw(performance.now());
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      canvas.removeEventListener("click", click);
      canvas.removeEventListener("pointermove", hover);
      canvas.removeEventListener("pointerleave", leave);
      window.removeEventListener("resize", onWindowResize);
      movement.clear();
      explosions = [];
      actionEvents = [];
      captureVisuals.clear();
    },
  };
}
