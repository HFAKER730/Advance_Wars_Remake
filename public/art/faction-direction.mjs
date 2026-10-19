/**
 * Faction front/back views for land units.
 *
 * Land units need four facings; air and naval units in this game only ever
 * face left/right, so they have no vertical painter. This module ports the
 * vertical silhouettes to the faction style+kit system so a soldier or tank
 * reads as the same army from every angle.
 *
 * The kit decides three things seen from the front:
 *   turret face   round mantlet / flat plate / welded wedge / casemate slot
 *   track face    slab shoes / skirt / road wheels / narrow high track
 *   soldier       body armour / webbing / light kit / foliage
 */
import { box, poly, insignia } from "./pixel-draw.mjs";
import { FACTION_STYLES } from "./faction-style.mjs";
import { LAND_KITS } from "./faction-land.mjs";

const style = (id) => FACTION_STYLES[id] ?? FACTION_STYLES.red;
const kit = (id) => LAND_KITS[id] ?? LAND_KITS.red;

/* --------------------------------------------------------------- infantry */

function soldier(ctx, s, k, type, back, step) {
  const ink = s.metalDark;
  const sway = step >= 0 ? (step % 6 < 3 ? -2 : 2) : 0;
  const bob = step >= 0 && step % 3 === 1 ? -1 : 0;
  ctx.translate(0, bob);

  // Legs: same gait, faction-coloured trousers.
  box(ctx, 13 + sway, 24, 6, 6, ink);
  box(ctx, 14 + sway, 25, 4, 4, s.paintMid);
  box(ctx, 11 + sway, 29, 8, 3, ink);
  box(ctx, 21 - sway, 24, 6, 6, ink);
  box(ctx, 22 - sway, 25, 4, 4, s.paintDark);
  box(ctx, 21 - sway, 29, 8, 3, ink);

  // Torso with kit-specific chest treatment.
  box(ctx, 10, 14, 20, 11, ink);
  box(ctx, 12, 15, 16, 9, s.paintMid);
  box(ctx, 12, 17, 4, 7, s.paintDark);
  box(ctx, 24, 17, 4, 7, s.paintDark);
  if (back) {
    box(ctx, 15, 15, 10, 10, ink);
    box(ctx, 16, 16, 8, 8, k.cab === "canvas" ? s.canvas : s.paintShade);
    box(ctx, 17, 17, 6, 3, s.paintDark);
    box(ctx, 12, 5, 16, 7, ink);
    box(ctx, 14, 4, 12, 7, s.paintMid);
    box(ctx, 16, 3, 8, 3, s.paintLight);
    box(ctx, 12, 10, 16, 2, s.paintShade);
    if (k.cab === "steel") {
      // Blue: armoured kit — wide pauldrons and a radio antenna.
      box(ctx, 13, 14, 14, 2, s.accent);
      box(ctx, 9, 15, 3, 6, s.paintShade);
      box(ctx, 28, 15, 3, 6, s.paintShade);
      box(ctx, 27, 3, 1, 4, ink);
      box(ctx, 27, 2, 1, 1, s.accent);
      box(ctx, 11, 6, 2, 3, s.metalLight);
      box(ctx, 27, 6, 2, 3, s.metalLight);
    } else if (k.cab === "open") {
      // Green: foliage sprigs breaking the helmet line.
      box(ctx, 17, 1, 5, 2, s.paintLight);
      box(ctx, 19, 0, 2, 1, s.accent);
      box(ctx, 12, 15, 4, 6, s.paintDark);
      box(ctx, 24, 15, 4, 6, s.paintDark);
      box(ctx, 15, 21, 10, 2, s.paintShade);
    } else if (k.cab === "canvas") {
      // Red: bedroll strapped across the top of the pack.
      box(ctx, 13, 1, 14, 2, s.canvas);
      box(ctx, 14, 3, 12, 1, s.paintShade);
      box(ctx, 12, 15, 4, 6, s.paintMid);
      box(ctx, 24, 15, 4, 6, s.paintMid);
    } else {
      // Yellow: field cap with a wide brim plus a bedroll under it.
      box(ctx, 11, 4, 3, 5, s.paintMid);
      box(ctx, 26, 4, 3, 5, s.paintMid);
      box(ctx, 16, 1, 8, 1, s.paintShade);
      box(ctx, 12, 15, 4, 6, s.paintMid);
      box(ctx, 24, 15, 4, 6, s.paintMid);
      box(ctx, 15, 21, 10, 2, s.accent);
    }
    if (type === "mech") {
      box(ctx, 8, 11, 4, 16, ink);
      box(ctx, 9, 12, 2, 13, s.metal);
      box(ctx, 28, 12, 4, 15, ink);
      box(ctx, 29, 13, 2, 12, s.metalLight);
    } else {
      box(ctx, 28, 15, 3, 12, ink);
      box(ctx, 29, 13, 1, 4, s.metal);
    }
  } else {
    box(ctx, 17, 11, 6, 4, "#b78165");
    box(ctx, 15, 8, 10, 7, ink);
    box(ctx, 16, 9, 8, 5, "#e9bc91");
    box(ctx, 12, 4, 16, 6, ink);
    box(ctx, 14, 3, 12, 6, s.paintMid);
    box(ctx, 16, 3, 8, 3, s.paintLight);
    box(ctx, 12, 9, 16, 2, s.paintShade);
    // Head kit as seen from the front: the three kits must not silhouette
    // the same, so each adds one protrusion at a different height.
    if (k.cab === "steel") {
      // Armoured helmet with a mounted antenna.
      box(ctx, 29, 4, 1, 7, ink);
      box(ctx, 29, 3, 1, 1, s.accent);
      box(ctx, 13, 5, 2, 3, s.metalLight);
      box(ctx, 25, 5, 2, 3, s.metalLight);
    } else if (k.cab === "open") {
      // Wide slouch brim flaring past the shoulders.
      box(ctx, 11, 8, 18, 1, ink);
      box(ctx, 12, 9, 16, 1, s.paintShade);
      box(ctx, 12, 7, 2, 1, ink);
      box(ctx, 26, 7, 2, 1, ink);
    } else if (k.cab === "canvas") {
      // Red: canvas neck flap hanging over the collar.
      box(ctx, 13, 9, 14, 3, s.canvas);
      box(ctx, 14, 10, 12, 1, s.paintShade);
    } else {
      // Yellow: field cap with a flat visor.
      box(ctx, 13, 8, 14, 1, s.paintShade);
      box(ctx, 14, 9, 12, 1, s.paintMid);
      box(ctx, 26, 6, 2, 3, s.metalLight);
    }
    if (k.cab === "steel") {
      box(ctx, 15, 16, 11, 7, s.paintShade);
      box(ctx, 16, 17, 9, 3, s.paintLight);
      box(ctx, 19, 15, 3, 8, s.metalLight);
      box(ctx, 12, 23, 16, 2, s.accent);
    } else if (k.cab === "open") {
      for (let i = 0; i < 5; i++) box(ctx, 15 + i * 2, 17 + i, 3, 3, s.paintDark);
      box(ctx, 15, 16, 11, 2, s.paintLight);
      box(ctx, 13, 22, 4, 2, s.accent);
    } else {
      box(ctx, 15, 16, 3, 7, s.paintLight);
      box(ctx, 23, 16, 3, 7, s.paintLight);
      box(ctx, 16, 18, 9, 3, s.paintShade);
      box(ctx, 19, 22, 3, 2, s.accent);
    }
    if (type === "mech") {
      box(ctx, 26, 11, 5, 19, ink);
      box(ctx, 27, 12, 3, 16, s.metal);
      box(ctx, 29, 26, 3, 3, s.metalLight);
      box(ctx, 8, 16, 4, 12, ink);
      box(ctx, 9, 17, 2, 9, s.metalLight);
    } else {
      box(ctx, 26, 17, 4, 13, ink);
      box(ctx, 27, 18, 2, 10, s.metal);
      box(ctx, 25, 27, 6, 2, s.wood);
    }
  }
  ctx.translate(0, -bob);
}

/* -------------------------------------------------------------- vehicles */

function trackFace(ctx, s, k, x, step) {
  const ink = s.metalDark;
  poly(ctx, [[x + 4, 9], [x + 9, 11], [x + 7, 32], [x + 1, 34], [x - 1, 29], [x, 14]], ink);
  poly(ctx, [[x + 4, 12], [x + 7, 13], [x + 5, 30], [x + 2, 31]], s.metal);
  if (k.track === "slab") {
    for (let y = 14; y < 31; y += 4) box(ctx, x + 2, y, 4, 3, s.rubber);
    box(ctx, x + 2, 14, 4, 1, s.tireHub);
  } else if (k.track === "skirt") {
    poly(ctx, [[x, 11], [x + 8, 11], [x + 7, 28], [x + 1, 28]], s.paintShade);
    poly(ctx, [[x + 1, 12], [x + 7, 12], [x + 6, 27], [x + 2, 27]], s.paintDark);
    box(ctx, x + 3, 13, 2, 12, s.paintLight);
  } else if (k.track === "road") {
    for (const y of [13, 20, 27]) {
      box(ctx, x + 1, y, 6, 5, s.rubber);
      box(ctx, x + 2, y + 1, 3, 3, s.tireHub);
    }
  } else {
    poly(ctx, [[x + 3, 10], [x + 8, 12], [x + 6, 30], [x + 1, 32]], s.treadLight);
    for (const y of [14, 20, 26]) box(ctx, x + 1, y, 6, 2, s.metal);
  }
  if (step >= 0) for (let y = 14; y < 31; y += 5) box(ctx, x + 2, y + (step % 2), 4, 2, ink);
}

function verticalVehicle(ctx, s, k, type, up, step) {
  const ink = s.metalDark;
  const wide = type === "heavy";
  const l = wide ? 2 : 4;
  const r = wide ? 38 : 36;
  trackFace(ctx, s, k, l, step);
  poly(ctx, [[r - 9, 11], [r - 4, 9], [r, 14], [r + 1, 29], [r - 1, 34], [r - 7, 32]], ink);
  poly(ctx, [[r - 7, 13], [r - 4, 12], [r - 2, 31], [r - 5, 30]], s.metal);
  if (k.track === "skirt") {
    poly(ctx, [[r - 8, 11], [r, 11], [r - 1, 28], [r - 7, 28]], s.paintShade);
    poly(ctx, [[r - 7, 12], [r - 1, 12], [r - 2, 27], [r - 6, 27]], s.paintDark);
  } else if (k.track === "road") {
    for (const y of [13, 20, 27]) {
      box(ctx, r - 6, y, 6, 5, s.rubber);
      box(ctx, r - 5, y + 1, 3, 3, s.tireHub);
    }
  } else if (k.track === "narrow") {
    poly(ctx, [[r - 8, 12], [r - 1, 10], [r, 30], [r - 6, 32]], s.treadLight);
    for (const y of [14, 20, 26]) box(ctx, r - 7, y, 6, 2, s.metal);
  }
  for (let y = 14; y < 31; y += 5) box(ctx, r - 6, y + (step >= 0 ? step % 2 : 0), 4, 2,
    k.track === "slab" ? s.rubber : s.metal);
  // Hull deck.
  poly(ctx, [[l + 8, 10], [r - 8, 10], [r - 5, 15], [r - 4, 29], [r - 9, 33], [l + 9, 33], [l + 4, 29], [l + 5, 15]], ink);
  poly(ctx, [[l + 9, 11], [r - 9, 11], [r - 7, 15], [r - 6, 27], [r - 10, 31], [l + 10, 31], [l + 6, 27], [l + 7, 15]], s.paintDark);
  poly(ctx, [[l + 10, 11], [r - 10, 11], [r - 8, 16], [l + 8, 16]], s.paintLight);
  poly(ctx, [[l + 8, 25], [r - 8, 25], [r - 10, 30], [l + 10, 30]], s.paintMid);

  if (type === "apc") {
    poly(ctx, [[11, 14], [18, 10], [27, 13], [30, 22], [25, 29], [14, 28], [10, 21]], ink);
    poly(ctx, [[12, 15], [18, 11], [26, 14], [28, 21], [24, 26], [15, 26], [11, 20]], s.paintLight);
    box(ctx, 15, 15, 10, 5, s.paintShade);
    box(ctx, 16, 16, 8, 3, s.paintLight);
    box(ctx, 17, 19, 6, 2, k.cab === "canvas" ? s.canvas : s.accent);
    box(ctx, 15, up ? 24 : 11, 10, 2, s.glass);
    box(ctx, 17, up ? 29 : 8, 6, 2, k.cab === "open" ? s.paintShade : s.paintMid);
    return;
  }

  // Turret, front face only: the kit decides the plate shape.
  const left = type === "heavy" ? 9 : 11;
  const right = 40 - left;
  if (k.turret === "casemate") {
    poly(ctx, [[left + 5, 13], [right - 5, 13], [right - 3, 26], [left + 3, 26]], ink);
    poly(ctx, [[left + 6, 14], [right - 6, 14], [right - 4, 25], [left + 4, 25]], s.paintLight);
    poly(ctx, [[left + 6, 14], [right - 6, 14], [right - 6, 19], [left + 6, 19]], s.paintMid);
    box(ctx, 17, 16, 6, 2, s.metalDark);
    box(ctx, 18, 17, 4, 2, s.metal);
  } else if (k.turret === "welded") {
    poly(ctx, [[left + 4, 14], [right - 4, 14], [right - 3, 25], [left + 3, 25]], ink);
    poly(ctx, [[left + 5, 15], [right - 5, 15], [right - 4, 24], [left + 4, 24]], s.paintLight);
    poly(ctx, [[left + 5, 15], [20, 15], [20, 22], [left + 4, 22]], s.paintMid);
    poly(ctx, [[20, 15], [right - 5, 15], [right - 4, 22], [20, 22]], s.paintDark);
    for (let x = left + 6; x < right - 6; x += 3) box(ctx, x, 24, 2, 1, s.metalLight);
  } else {
    poly(ctx, [[left + 3, 13], [17, 10], [24, 10], [right - 2, 14], [right, 21], [right - 4, 26], [left + 4, 26], [left, 21]], ink);
    poly(ctx, [[left + 4, 14], [17, 11], [24, 11], [right - 3, 15], [right - 2, 20], [right - 5, 23], [left + 5, 23], [left + 2, 20]], s.paintMid);
    poly(ctx, [[left + 4, 14], [18, 11], [24, 11], [right - 4, 15], [right - 7, 17], [left + 7, 17]], s.paintLight);
    poly(ctx, [[left + 3, 20], [right - 3, 20], [right - 5, 24], [left + 5, 24]], s.paintDark);
    if (k.turret === "box") {
      box(ctx, left + 2, 12, right - left - 4, 2, s.paintShade);
      box(ctx, 18, 11, 4, 1, s.accent);
    } else {
      box(ctx, left + 4, 12, right - left - 8, 2, s.paintShade);
      box(ctx, 19, 11, 2, 2, s.accent);
    }
  }
  box(ctx, 16, 13, 8, 4, s.paintShade);
  box(ctx, 17, 13, 6, 2, k.turret === "welded" ? s.metalLight : s.paintLight);
  if (type === "artillery") {
    box(ctx, 18, up ? 2 : 22, 4, 16, ink);
    box(ctx, 19, up ? 3 : 23, 2, 14, s.metal);
    box(ctx, 15, 18, 10, 5, s.paintShade);
  } else {
    const w = type === "heavy" ? 6 : 4;
    const x = 20 - w / 2;
    box(ctx, x, up ? 2 : 22, w, 16, ink);
    box(ctx, x + 1, up ? 3 : 23, w - 2, 14, s.metal);
    box(ctx, x, up ? 2 : 36, w, 2, s.paintMid);
  }
}

function verticalWheeledVehicle(ctx, s, k, type, up, step) {
  const ink = s.metalDark;
  const wheels = type === "rocket" ? [8, 17, 26] : [11, 25];
  for (const y of wheels)
    for (const x of [5, 29]) {
      box(ctx, x, y, 6, 7, ink);
      if (k.track === "road") {
        box(ctx, x, y + 1, 6, 5, s.rubber);
        box(ctx, x + 1, y + 2 + (step >= 0 ? step % 2 : 0), 4, 2, s.tireHub);
      } else {
        box(ctx, x + 1, y + 1, 4, 5, s.rubber);
        box(ctx, x + 2, y + 2 + (step >= 0 ? step % 2 : 0), 2, 2, s.tireHub);
      }
    }
  poly(ctx, [[13, 7], [27, 7], [31, 13], [32, 29], [28, 34], [12, 34], [8, 29], [9, 13]], ink);
  poly(ctx, [[14, 8], [26, 8], [29, 14], [30, 28], [27, 32], [13, 32], [10, 28], [11, 14]], s.paintDark);
  poly(ctx, [[14, 8], [26, 8], [29, 14], [11, 14]], s.paintLight);
  poly(ctx, [[11, 26], [29, 26], [27, 32], [13, 32]], s.paintMid);
  const cabY = up ? 17 : 22;
  poly(ctx, [[13, cabY], [17, cabY - 3], [24, cabY - 3], [27, cabY], [27, cabY + 7], [13, cabY + 7]], s.paintShade);
  poly(ctx, [[14, cabY + 1], [17, cabY - 2], [23, cabY - 2], [26, cabY + 1], [25, cabY + 3], [15, cabY + 3]], s.glass);
  box(ctx, 13, up ? 9 : 29, 14, 2, s.paintLight);
  if (type === "recon") {
    poly(ctx, [[12, up ? 8 : 27], [28, up ? 8 : 27], [27, up ? 15 : 32], [13, up ? 15 : 32]], s.paintMid);
    box(ctx, 16, up ? 10 : 29, 8, 2, s.paintLight);
    box(ctx, 12, up ? 9 : 30, 3, 2, s.accent);
    box(ctx, 25, up ? 9 : 30, 3, 2, s.accent);
    // Vertical fittings per faction: roll bar, spare wheel, spare can or none.
    if (k.track === "narrow") {
      box(ctx, 8, 3, 1, 12, ink);
      box(ctx, 8, 2, 1, 1, s.accent);
      box(ctx, 31, 3, 1, 12, ink);
    } else if (k.track === "skirt") {
      box(ctx, 12, up ? 4 : 26, 16, 1, ink);
      box(ctx, 8, up ? 3 : 25, 1, 5, ink);
      box(ctx, 31, up ? 3 : 25, 1, 5, ink);
    } else if (k.track === "road") {
      box(ctx, 31, up ? 11 : 30, 5, 5, ink);
      box(ctx, 32, up ? 12 : 31, 3, 3, s.rubber);
      box(ctx, 33, up ? 13 : 32, 1, 1, s.tireHub);
    } else {
      box(ctx, 8, 4, 1, 11, ink);
      box(ctx, 8, 3, 1, 2, s.paintLight);
      box(ctx, 33, up ? 9 : 28, 4, 4, s.canvas);
      box(ctx, 34, up ? 10 : 29, 2, 2, s.paintShade);
    }
  } else {
    const rackY = up ? 18 : 8;
    poly(ctx, [[12, rackY], [16, rackY - 2], [27, rackY], [29, rackY + 12], [24, rackY + 14], [11, rackY + 12]], ink);
    poly(ctx, [[13, rackY + 1], [16, rackY - 1], [26, rackY + 1], [27, rackY + 11], [23, rackY + 12], [12, rackY + 11]], s.paintMid);
    for (let row = 0; row < 3; row++)
      for (const x of [15, 20]) {
        const y = (up ? 21 : 11) + row * 3;
        box(ctx, x, y, 3, 2, s.metalLight);
        box(ctx, x + 1, y, 1, 2, ink);
      }
    // Rack furniture per faction: rear crane, raised tube, sight mast or none.
    if (k.turret === "box") {
      box(ctx, 9, up ? 6 : 26, 1, 8, s.metalDark);
      box(ctx, 9, up ? 5 : 25, 6, 1, s.metal);
    } else if (k.turret === "welded") {
      box(ctx, 29, up ? 8 : 28, 5, 10, s.metalDark);
      box(ctx, 30, up ? 9 : 29, 3, 8, s.metal);
      box(ctx, 30, up ? 8 : 28, 3, 1, s.accent);
    } else if (k.turret === "cast") {
      box(ctx, 13, up ? 4 : 24, 1, 14, s.metalDark);
      box(ctx, 12, up ? 3 : 23, 3, 2, s.metal);
      box(ctx, 13, up ? 3 : 23, 1, 1, s.accent);
    }
  }
}

/* ----------------------------------------------------------------- export */

export function paintLandDirection(ctx, type, factionId, direction, step = -1) {
  const s = style(factionId);
  const k = kit(factionId);
  const infantry = type === "infantry" || type === "mech";
  const wheeled = type === "recon" || type === "rocket";
  const up = direction === "up";
  ctx.save();
  if (infantry) soldier(ctx, s, k, type, up, step);
  else if (wheeled) verticalWheeledVehicle(ctx, s, k, type, up, step);
  else verticalVehicle(ctx, s, k, type, up, step);
  ctx.restore();
}

export { style as directionStyle, kit as directionKit };
