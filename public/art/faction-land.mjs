/**
 * Faction land units — one shared silhouette per class, four faction kits.
 *
 * A kit changes geometry, not just colour:
 *   red    round cast turret, slab tracks, canvas tie-downs
 *   blue   box turret with rear bustle, side-skirted tracks
 *   yellow faceted welded turret, exposed road wheels
 *   green  low fixed casemate, narrow high tracks
 *
 * Canvas is 40×40 and units face right, matching the frozen `unit-art.mjs`
 * geometry so a swap is drop-in.
 */
import { box, face, poly, insignia, rivets, line } from "./pixel-draw.mjs";
import { FACTION_STYLES, styleArray } from "./faction-style.mjs";

export const LAND_KITS = {
  red: { turret: "cast", track: "slab", cab: "canvas", insignia: "bars" },
  blue: { turret: "box", track: "skirt", cab: "steel", insignia: "bands" },
  yellow: { turret: "welded", track: "road", cab: "glass", insignia: "chevron" },
  green: { turret: "casemate", track: "narrow", cab: "open", insignia: "bars" },
};

const kit = (factionId) => LAND_KITS[factionId] ?? LAND_KITS.red;
const style = (factionId) => FACTION_STYLES[factionId] ?? FACTION_STYLES.red;

/* ------------------------------------------------------------------ tracks */

/**
 * Track run shared by every tracked chassis. `width` is "standard" or "heavy".
 * The kit decides how much of the running gear stays visible.
 */
function tracks(ctx, s, k, width, step) {
  const ink = s.metalDark;
  const heavy = width === "heavy";
  const nearTop = heavy ? 22 : 24;
  const nearBottom = heavy ? 33 : 31;

  // Far track, partly hidden behind the hull.
  face(ctx, [[10, 15], [30, 17], [37, 21], [36, 27], [31, 30], [9, 24]], ink);
  face(ctx, [[30, 21], [36, 23], [35, 27], [31, 29]], s.metal);

  // Near track run.
  face(ctx, [[5, nearTop], [26, nearTop + 4], [29, nearTop + 6], [26, nearBottom + 3],
    [5, nearBottom - 1], [2, nearTop + 3]], ink);
  face(ctx, [[5, nearTop + 1], [26, nearTop + 5], [27, nearTop + 7], [25, nearBottom + 2],
    [5, nearBottom - 2], [3, nearTop + 3]], s.metal);
  face(ctx, [[6, nearTop + 1], [25, nearTop + 5], [25, nearTop + 6], [6, nearTop + 2]],
    s.treadLight);

  if (k.track === "slab") {
    // Heavy cast track shoes with a visible pin boss on each shoe.
    for (const [x, y] of [[7, nearTop + 2], [12, nearTop + 3], [17, nearTop + 4], [22, nearTop + 5]]) {
      box(ctx, x, y, 3, 3, s.rubber);
      box(ctx, x, y, 2, 2, s.tireHub);
      box(ctx, x + 1, y + 3, 1, 1, s.metalLight);
    }
  } else if (k.track === "skirt") {
    // Armour skirt covers the top half of the run, leaving drive sprockets.
    face(ctx, [[4, nearTop], [26, nearTop + 4], [27, nearTop + 8], [5, nearTop + 4]], s.paintShade);
    face(ctx, [[5, nearTop + 1], [25, nearTop + 5], [25, nearTop + 6], [5, nearTop + 2]],
      s.paintDark);
    box(ctx, 26, nearTop + 5, 3, 4, s.metal);
    box(ctx, 3, nearTop + 2, 3, 4, s.metal);
    box(ctx, 3, nearTop + 3, 2, 2, s.metalLight);
  } else if (k.track === "road") {
    // Exposed road wheels and small return rollers.
    for (const [x, y] of [[6, nearTop + 2], [11, nearTop + 3], [16, nearTop + 4], [21, nearTop + 4]]) {
      box(ctx, x, y, 4, 4, s.rubber);
      box(ctx, x + 1, y + 1, 2, 2, s.tireHub);
    }
    box(ctx, 9, nearTop, 2, 2, s.metalLight);
    box(ctx, 18, nearTop + 1, 2, 2, s.metalLight);
  } else {
    // Narrow high track with exposed suspension arms.
    face(ctx, [[5, nearTop + 2], [26, nearTop + 6], [26, nearTop + 7], [5, nearTop + 3]],
      s.treadLight);
    for (const x of [7, 13, 19]) {
      box(ctx, x, nearTop + 3, 5, 2, s.metal);
      box(ctx, x + 2, nearTop + 5, 2, 2, s.metalDark);
    }
  }
  if (step !== undefined && step >= 0)
    for (const x of [7, 13, 19, 24]) box(ctx, x, nearTop + 2 + (step % 2), 2, 1, s.treadLight);
}

/* ------------------------------------------------------------------- hulls */

function trackedHull(ctx, s, k, width, step) {
  tracks(ctx, s, k, width, step);
  const ink = s.metalDark;
  face(ctx, [[5, 18], [12, 14], [30, 18], [36, 22], [27, 27], [4, 22]], ink);
  face(ctx, [[6, 18], [12, 15], [30, 19], [33, 22], [26, 25], [5, 21]], s.paintLight);
  face(ctx, [[5, 21], [26, 25], [27, 29], [5, 25]], s.paintDark);
  face(ctx, [[26, 25], [35, 22], [34, 27], [27, 30]], s.paintShade);
  // Front glacis plate is the same on every faction; only the paint differs.
  face(ctx, [[24, 20], [32, 20], [35, 22], [26, 25]], s.paintMid);
  face(ctx, [[8, 18], [22, 21], [24, 20], [13, 16]], s.paintMid);
  face(ctx, [[7, 20], [22, 23], [22, 24], [7, 21]], s.paintLight);
}

function wheeledHull(ctx, s, k, truck = false) {
  const ink = s.metalDark;
  const wheel = (x, y) => {
    box(ctx, x + 1, y, 5, 8, s.rubber);
    box(ctx, x, y + 2, 7, 4, s.rubber);
    box(ctx, x + 2, y + 2, 3, 4, s.metal);
    box(ctx, x + 2, y + 2, 2, 2, s.tireHub);
    box(ctx, x + 3, y + 3, 1, 2, s.metalDark);
  };
  if (truck) wheel(29, 23);
  face(ctx, [[3, 20], [13, 15], [35, 21], [37, 27], [29, 32], [4, 26]], ink);
  face(ctx, [[4, 20], [13, 16], [35, 22], [29, 27], [4, 23]], s.paintLight);
  face(ctx, [[4, 23], [29, 28], [29, 31], [4, 27]], s.paintDark);
  face(ctx, [[29, 27], [36, 23], [36, 27], [29, 32]], s.paintShade);
  if (k.track === "skirt") face(ctx, [[4, 24], [28, 29], [28, 31], [4, 26]], s.paintShade);
  wheel(5, 24);
  wheel(13, 26);
  if (truck) wheel(25, 28);
  return wheel;
}

/* ----------------------------------------------------------------- turrets */

/** Rotating turret, geometry chosen by the faction kit. */
function turret(ctx, s, k, heavy) {
  const ink = s.metalDark;
  const ring = heavy ? [[12, 10], [22, 8], [29, 12], [30, 18], [24, 23], [10, 20], [8, 15]]
    : [[15, 11], [22, 10], [28, 13], [29, 17], [25, 21], [14, 19], [11, 16]];
  const roof = heavy ? [[12, 11], [22, 9], [28, 13], [25, 17], [12, 16], [9, 14]]
    : [[15, 12], [22, 11], [27, 14], [26, 17], [15, 17], [12, 15]];
  const flank = heavy ? [[10, 15], [24, 19], [24, 22], [11, 19]]
    : [[12, 15], [15, 17], [26, 18], [25, 20], [15, 18], [12, 17]];
  const top = heavy ? [[14, 12], [21, 10], [25, 13], [23, 16], [13, 15]]
    : [[15, 13], [22, 12], [25, 14], [24, 16], [16, 16], [14, 15]];
  const rear = heavy ? [[24, 14], [27, 12], [30, 14], [29, 19], [25, 21]]
    : [[25, 14], [28, 14], [28, 17], [25, 19], [24, 17]];

  face(ctx, ring, ink);
  face(ctx, roof, s.paintLight);
  face(ctx, flank, s.paintDark);
  face(ctx, top, s.paintMid);
  face(ctx, rear, s.paintShade);

  if (k.turret === "cast") {
    // Rounded casting: soften the front corner and add a sand-cast texture.
    face(ctx, [[heavy ? 28 : 27, 13], [heavy ? 30 : 29, 15], [heavy ? 29 : 28, 17], [heavy ? 27 : 26, 15]],
      s.paintLight);
    box(ctx, 17, heavy ? 11 : 12, 5, 3, s.paintShade);
    box(ctx, 18, heavy ? 11 : 12, 4, 2, s.paintLight);
    rivets(ctx, [13, 20], heavy ? [13, 16] : [15, 16], s.paintShade);
  } else if (k.turret === "box") {
    // Flat roof with a squared rear bustle and a stowage rail.
    face(ctx, [[heavy ? 25 : 24, 12], [heavy ? 30 : 29, 12], [heavy ? 30 : 29, 16], [heavy ? 25 : 24, 16]],
      s.paintShade);
    face(ctx, [[heavy ? 25 : 24, 12], [heavy ? 30 : 29, 12], [heavy ? 30 : 29, 14], [heavy ? 25 : 24, 14]],
      s.paintMid);
    box(ctx, 16, heavy ? 11 : 12, 6, 3, s.paintShade);
    box(ctx, 17, heavy ? 11 : 12, 4, 2, s.accent);
    line(ctx, [[11, heavy ? 16 : 17], [24, heavy ? 20 : 20]], s.metalDark);
  } else if (k.turret === "welded") {
    // Faceted plate turret with a visible weld bead on the leading edge.
    poly(ctx, [[15, 11], [21, 9], [27, 12], [28, 17], [22, 16], [16, 14]],
      s.paintLight);
    poly(ctx, [[21, 9], [25, 10], [27, 12], [22, 13]], s.paintMid);
    box(ctx, 16, heavy ? 11 : 12, 5, 3, s.paintShade);
    box(ctx, 17, heavy ? 11 : 12, 3, 2, s.accent);
    for (let i = 0; i < 6; i++) box(ctx, 16 + i * 2, heavy ? 16 + i : 15 + i, 2, 1, s.metalLight);
  } else {
    // Fixed casemate: no turret ring, sloped plates, gun in the front plate.
    face(ctx, ring, s.paintShade);
    poly(ctx, [[10, 18], [16, 10], [26, 11], [30, 17], [24, 22], [11, 21]], s.paintLight);
    poly(ctx, [[16, 10], [26, 11], [30, 17], [22, 14], [17, 13]], s.paintMid);
    poly(ctx, [[10, 18], [17, 13], [22, 14], [24, 22], [11, 21]], s.paintDark);
    face(ctx, [[26, 11], [30, 17], [24, 22], [23, 20], [28, 16], [24, 13]], s.paintShade);
    box(ctx, 13, 13, 5, 2, s.accent);
    rivets(ctx, [12, 17, 22], [12, 16, 20], s.metalLight);
  }
}

/** Barrel and muzzle. `heavy` widens it; `angle` tilts it for howitzers. */
function barrel(ctx, s, heavy, angle = 0, from = 24) {
  const ink = s.metalDark;
  const w = heavy ? 5 : 3;
  if (angle) {
    face(ctx, [[from, 15], [36, 15 - angle], [37, 17 - angle], [from + 1, 19]], ink);
    face(ctx, [[from + 1, 15], [35, 16 - angle], [36, 17 - angle], [from + 2, 18]], s.metal);
    face(ctx, [[from + 1, 17], [36, 17 - angle], [36, 18 - angle], [from + 2, 19]], s.paintMid);
    box(ctx, 35, 15 - angle, 3, 3, s.metal);
    box(ctx, 36, 16 - angle, 2, 2, s.metalDark);
  } else {
    face(ctx, [[from, 13], [36, 11], [38, 12], [38, 15], [26, 18], [from, 17]], ink);
    face(ctx, [[from + 1, 13], [36, 12], [37, 13], [from + 1, 16]], s.metal);
    face(ctx, [[from + 1, 16], [37, 13], [38, 15], [from + 1, 17]], s.paintMid);
    box(ctx, 36, 12, 2, 3, s.metal);
    box(ctx, 37, 13, 1, 2, ink);
    if (heavy) box(ctx, from + 3, 13, 3, 4, s.paintShade);
  }
}

/* ---------------------------------------------------------------- vehicles */

function tank(ctx, s, k, heavy, step) {
  trackedHull(ctx, s, k, heavy ? "heavy" : "standard", step);
  turret(ctx, s, k, heavy);
  if (k.turret === "casemate") barrel(ctx, s, heavy, 0, 26);
  else barrel(ctx, s, heavy, 0, heavy ? 24 : 25);
  turretKit(ctx, s, k, heavy);
  // Faction marks sit on the rear deck, where the hull is widest.
  insignia(ctx, 8, 18, 6, 3, s, k.insignia);
  box(ctx, 11, 7, 1, 6, s.metalDark);
  box(ctx, 11, 6, 1, 1, s.accent);
  box(ctx, 29, 25, 2, 2, s.accent);
  box(ctx, 7, 22, 2, 1, s.paintLight);
}

/**
 * Kit-specific turret furniture that protrudes past the shared ring, so the
 * unit's outline — not only its paint — identifies the faction at 1×.
 */
function turretKit(ctx, s, k, heavy) {
  const ink = s.metalDark;
  const top = heavy ? 8 : 10;
  if (k.turret === "cast") {
    // Rounded commander's cupola bulging above the cast turret roof.
    face(ctx, [[16, top], [21, top - 2], [23, top + 1], [17, top + 3]], ink);
    face(ctx, [[17, top], [21, top - 1], [22, top + 1], [18, top + 2]], s.paintLight);
    box(ctx, 18, top, 3, 1, s.accent);
  } else if (k.turret === "box") {
    // Squared stowage bustle overhanging the rear plate.
    face(ctx, [[27, heavy ? 12 : 13], [33, heavy ? 10 : 12], [34, heavy ? 16 : 17], [28, heavy ? 18 : 18]], ink);
    face(ctx, [[28, heavy ? 12 : 13], [32, heavy ? 11 : 13], [33, heavy ? 16 : 16], [29, heavy ? 17 : 17]], s.paintMid);
    face(ctx, [[28, heavy ? 12 : 13], [32, heavy ? 11 : 13], [32, heavy ? 13 : 14], [28, heavy ? 14 : 14]], s.paintShade);
  } else if (k.turret === "welded") {
    // Angular mantlet wedging forward off the turret face.
    poly(ctx, [[24, heavy ? 13 : 14], [31, heavy ? 11 : 12], [33, heavy ? 15 : 16], [25, heavy ? 17 : 17]], ink);
    poly(ctx, [[25, heavy ? 13 : 14], [30, heavy ? 12 : 13], [31, heavy ? 15 : 16], [25, heavy ? 16 : 16]], s.metal);
    line(ctx, [[26, heavy ? 13 : 14], [31, heavy ? 12 : 13]], s.metalLight);
  } else {
    // Fixed casemate: a sloped gun house with no overhang at all.
    face(ctx, [[9, heavy ? 17 : 18], [15, heavy ? 9 : 10], [25, heavy ? 10 : 11], [29, heavy ? 16 : 17]],
      ink);
    face(ctx, [[10, heavy ? 17 : 18], [15, heavy ? 10 : 11], [24, heavy ? 11 : 12], [28, heavy ? 16 : 17]],
      s.paintLight);
    face(ctx, [[15, heavy ? 10 : 11], [24, heavy ? 11 : 12], [28, heavy ? 16 : 17], [21, heavy ? 14 : 15]],
      s.paintMid);
    rivets(ctx, [12, 17, 22], [heavy ? 13 : 14, heavy ? 16 : 17], s.metalLight);
  }
}

function artilleryUnit(ctx, s, k, step) {
  trackedHull(ctx, s, k, "standard", step);
  const ink = s.metalDark;
  if (k.turret === "box") {
    // Enclosed self-propelled gun.
    face(ctx, [[10, 16], [18, 12], [27, 16], [27, 23], [11, 22]], ink);
    face(ctx, [[11, 16], [18, 13], [26, 16], [26, 22], [12, 21]], s.paintLight);
    poly(ctx, [[18, 13], [26, 16], [26, 20], [18, 18]], s.paintMid);
    face(ctx, [[11, 17], [18, 19], [18, 22], [11, 21]], s.paintDark);
    box(ctx, 12, 17, 5, 4, s.glass);
    box(ctx, 12, 18, 4, 2, s.paintShade);
    barrel(ctx, s, false, 7, 26);
    insignia(ctx, 14, 20, 6, 2, s, k.insignia);
  } else if (k.turret === "casemate") {
    // Low mortar carrier with a near-vertical tube.
    face(ctx, [[9, 17], [17, 13], [26, 16], [26, 23], [10, 22]], ink);
    poly(ctx, [[10, 17], [17, 14], [25, 17], [25, 22], [11, 21]], s.paintLight);
    poly(ctx, [[17, 14], [25, 17], [25, 20], [17, 18]], s.paintMid);
    face(ctx, [[10, 18], [17, 19], [17, 22], [10, 21]], s.paintDark);
    box(ctx, 19, 4, 5, 16, ink);
    box(ctx, 20, 5, 3, 14, s.metal);
    box(ctx, 20, 5, 2, 14, s.paintMid);
    box(ctx, 19, 3, 5, 2, s.metalDark);
    insignia(ctx, 12, 19, 5, 2, s, k.insignia);
  } else {
    // Open-topped howitzer with an elevated long barrel.
    face(ctx, [[8, 16], [17, 13], [25, 17], [25, 24], [10, 22]], ink);
    face(ctx, [[9, 16], [17, 14], [23, 17], [17, 19]], k.cab === "canvas" ? s.canvas : s.paintLight);
    face(ctx, [[10, 17], [17, 15], [22, 17], [17, 18]], s.paintShade);
    face(ctx, [[9, 17], [17, 20], [17, 23], [10, 21]], s.paintMid);
    face(ctx, [[17, 20], [24, 17], [24, 23], [18, 25]], s.paintDark);
    box(ctx, 19, 17, 7, 6, ink);
    box(ctx, 20, 18, 5, 3, s.metal);
    if (k.turret === "cast") {
      face(ctx, [[21, 17], [29, 6], [33, 5], [35, 8], [26, 21]], ink);
      face(ctx, [[22, 17], [30, 7], [32, 7], [24, 19]], s.paintLight);
      face(ctx, [[24, 19], [32, 7], [34, 8], [26, 20]], s.paintMid);
      face(ctx, [[29, 5], [32, 4], [36, 7], [35, 10], [31, 9]], ink);
      face(ctx, [[30, 5], [32, 5], [35, 7], [34, 8]], s.metal);
    } else {
      face(ctx, [[21, 17], [28, 7], [31, 6], [34, 9], [26, 21]], ink);
      face(ctx, [[22, 17], [29, 8], [31, 8], [24, 19]], s.paintLight);
      face(ctx, [[24, 19], [31, 8], [33, 9], [26, 20]], s.paintMid);
      box(ctx, 31, 6, 4, 3, s.metalDark);
      box(ctx, 32, 7, 2, 2, s.metal);
      rivets(ctx, [24, 28], [16, 13], s.metalLight);
    }
    insignia(ctx, 11, 19, 5, 2, s, k.insignia);
  }
  box(ctx, 8, 18, 1, 4, s.paintLight);
  face(ctx, [[7, 23], [14, 25], [14, 26], [7, 24]], s.paintLight);
  box(ctx, 29, 24, 3, 2, s.accent);
}

function reconUnit(ctx, s, k, step) {
  const ink = s.metalDark;
  wheeledHull(ctx, s, k, false);
  // Tall open cab: canvas on red, hard-top on blue, glazed on yellow, open green.
  face(ctx, [[10, 12], [18, 10], [25, 13], [26, 22], [11, 19], [8, 16]], ink);
  face(ctx, [[11, 12], [18, 11], [24, 13], [18, 16], [9, 14]], s.paintLight);
  if (k.cab === "canvas") {
    face(ctx, [[10, 13], [18, 14], [18, 20], [10, 18]], s.canvas);
    face(ctx, [[11, 14], [17, 15], [17, 16], [11, 16]], s.paintShade);
    box(ctx, 10, 12, 8, 2, s.paintShade);
  } else if (k.cab === "steel") {
    face(ctx, [[10, 13], [18, 14], [18, 20], [10, 18]], s.paintMid);
    face(ctx, [[11, 15], [17, 16], [17, 18], [11, 17]], s.glass);
    box(ctx, 10, 12, 8, 2, s.paintShade);
  } else if (k.cab === "glass") {
    face(ctx, [[10, 13], [18, 14], [18, 20], [10, 18]], s.paintMid);
    face(ctx, [[11, 14], [17, 15], [17, 19], [11, 17]], s.glass);
    box(ctx, 16, 14, 1, 6, s.paintShade);
  } else {
    face(ctx, [[10, 13], [18, 14], [18, 20], [10, 18]], s.paintDark);
    face(ctx, [[11, 15], [17, 16], [17, 17], [11, 16]], s.paintShade);
    box(ctx, 11, 12, 2, 2, s.accent);
  }
  // Rear fighting compartment.
  face(ctx, [[18, 16], [24, 14], [25, 19], [18, 22]], s.paintDark);
  face(ctx, [[19, 17], [23, 16], [24, 18], [19, 20]], s.paintShade);
  box(ctx, 21, 16, 1, 4, ink);
  face(ctx, [[18, 22], [25, 19], [34, 22], [28, 26]], s.paintLight);
  face(ctx, [[20, 22], [25, 20], [32, 22], [28, 24]], s.paintMid);
  // Signature fittings differ per faction, and each one breaks the shared
  // outline so the variant reads at 1× even in greyscale.
  if (k.track === "skirt") {
    // Spare wheel lashed flat on the engine deck.
    face(ctx, [[27, 19], [33, 17], [34, 21], [28, 23]], ink);
    face(ctx, [[28, 19], [32, 18], [33, 21], [29, 22]], s.rubber);
    box(ctx, 30, 19, 2, 2, s.tireHub);
  } else if (k.track === "road") {
    // Raised ring mount with a long-barrelled hull gun.
    box(ctx, 27, 16, 4, 4, ink);
    box(ctx, 28, 17, 2, 2, s.metal);
    box(ctx, 30, 17, 5, 2, ink);
    box(ctx, 31, 17, 4, 1, s.metal);
  } else if (k.track === "narrow") {
    // Rear-facing stowage basket that hangs off the tail.
    face(ctx, [[27, 24], [35, 22], [36, 28], [28, 29]], ink);
    face(ctx, [[28, 24], [34, 23], [35, 27], [29, 28]], s.paintMid);
    for (const x of [29, 31, 33]) box(ctx, x, 24, 1, 4, s.metalLight);
  } else {
    // Two tall whip antennas off the rear deck.
    box(ctx, 29, 12, 1, 8, ink);
    box(ctx, 33, 14, 1, 6, ink);
    box(ctx, 29, 11, 1, 1, s.accent);
    box(ctx, 33, 13, 1, 1, s.accent);
  }
  face(ctx, [[29, 28], [34, 26], [34, 28], [29, 30]], s.paintShade);
  box(ctx, 7, 11, 1, 9, ink);
  box(ctx, 7, 9, 1, 2, s.accent);
  insignia(ctx, 12, 21, 4, 2, s, k.insignia);
}

function rocketUnit(ctx, s, k, step) {
  const ink = s.metalDark;
  wheeledHull(ctx, s, k, true);
  // Cab behind the launcher.
  face(ctx, [[23, 17], [29, 14], [35, 18], [36, 24], [29, 28], [23, 24]], ink);
  face(ctx, [[24, 17], [29, 15], [34, 18], [29, 21]], s.paintLight);
  face(ctx, [[24, 18], [28, 21], [28, 25], [24, 23]], s.paintMid);
  face(ctx, [[29, 21], [34, 18], [35, 23], [29, 26]], k.cab === "steel" ? s.paintShade : s.glass);
  if (k.cab !== "open") face(ctx, [[30, 21], [33, 19], [34, 22], [30, 24]], s.paintShade);
  face(ctx, [[29, 26], [36, 23], [36, 27], [30, 30]], s.paintMid);
  box(ctx, 30, 27, 2, 2, s.accent);
  box(ctx, 34, 25, 2, 2, s.accent);
  box(ctx, 13, 18, 6, 5, ink);
  box(ctx, 14, 18, 4, 3, s.metal);
  // Launcher rack: round port tubes for red, boxed cells for the rest.
  face(ctx, [[4, 14], [16, 4], [27, 7], [27, 14], [16, 23], [4, 20]], ink);
  face(ctx, [[5, 14], [16, 5], [26, 8], [15, 18]], s.paintLight);
  face(ctx, [[5, 15], [15, 18], [15, 22], [5, 19]], s.paintDark);
  face(ctx, [[15, 18], [26, 9], [26, 14], [16, 22]], s.paintShade);
  for (let i = 0; i < 3; i++) {
    const x = 6 + i * 3;
    if (k.turret === "cast") {
      face(ctx, [[x, 14], [x + 10, 6], [x + 12, 7], [x + 2, 16]], s.metal);
      face(ctx, [[x, 14], [x + 10, 6], [x + 11, 6], [x + 1, 15]], s.metalLight);
    } else if (k.turret === "welded") {
      face(ctx, [[x, 14], [x + 10, 6], [x + 12, 7], [x + 2, 16]], s.paintMid);
      line(ctx, [[x, 14], [x + 10, 6]], s.metalLight);
    } else {
      face(ctx, [[x, 14], [x + 10, 6], [x + 12, 7], [x + 2, 16]], s.metal);
      box(ctx, x + 3, 11 - Math.round(i), 4, 2, s.paintShade);
    }
  }
  for (const [x, y] of [[17, 16], [20, 13], [23, 10]]) {
    box(ctx, x, y, 2, 2, s.metalLight);
    box(ctx, x + 1, y, 1, 2, ink);
    box(ctx, x, y + 3, 2, 2, s.metalLight);
    box(ctx, x + 1, y + 3, 1, 2, ink);
  }
  insignia(ctx, 25, 15, 4, 2, s, k.insignia);
  rocketKit(ctx, s, k);
}

/** Launcher furniture that changes the rocket truck's outline per faction. */
function rocketKit(ctx, s, k) {
  const ink = s.metalDark;
  if (k.turret === "cast") {
    // Rear outrigger spades, visible past the tail of the chassis.
    face(ctx, [[29, 30], [35, 28], [38, 33], [33, 33]], ink);
    face(ctx, [[30, 30], [34, 29], [36, 32], [33, 32]], s.paintMid);
    box(ctx, 30, 29, 1, 2, s.metalLight);
    box(ctx, 35, 28, 1, 3, s.metal);
  } else if (k.turret === "box") {
    // Folding loading crane over the cab.
    box(ctx, 22, 11, 1, 7, s.metalDark);
    box(ctx, 22, 10, 9, 1, s.metal);
    box(ctx, 30, 10, 1, 4, s.metalDark);
    box(ctx, 30, 13, 2, 2, s.metal);
  } else if (k.turret === "welded") {
    // Raised sight mast with a small dish.
    box(ctx, 12, 3, 1, 12, s.metalDark);
    box(ctx, 11, 2, 3, 2, s.metal);
    box(ctx, 12, 2, 1, 1, s.accent);
  } else {
    // Rear reload box hanging past the tail of the chassis.
    face(ctx, [[29, 29], [37, 26], [38, 30], [31, 33]], ink);
    face(ctx, [[30, 29], [36, 27], [37, 30], [31, 32]], s.paintMid);
    box(ctx, 31, 30, 1, 2, s.paintLight);
    rivets(ctx, [33, 35], [29], s.metalLight);
  }
}

function apcUnit(ctx, s, k, step) {
  trackedHull(ctx, s, k, "standard", step);
  const ink = s.metalDark;
  face(ctx, [[5, 13], [14, 8], [27, 11], [35, 18], [35, 24], [26, 29], [5, 24]], ink);
  face(ctx, [[6, 13], [14, 9], [26, 12], [31, 17], [23, 21]], s.paintLight);
  face(ctx, [[6, 14], [23, 21], [24, 27], [6, 23]], s.paintMid);
  face(ctx, [[23, 21], [31, 17], [34, 20], [33, 24], [25, 28]], s.paintDark);
  face(ctx, [[7, 22], [24, 26], [24, 28], [6, 24]], s.paintShade);
  // Roof hatch: fabric on red, steel on blue, glazed on yellow, open on green.
  if (k.cab === "open") {
    face(ctx, [[13, 12], [18, 10], [25, 13], [20, 17], [13, 15]], s.paintShade);
    face(ctx, [[14, 12], [18, 11], [24, 13], [20, 16], [14, 14]], s.paintDark);
    box(ctx, 15, 13, 3, 2, ink);
  } else {
    face(ctx, [[13, 12], [18, 10], [25, 13], [20, 17], [13, 15]], s.paintShade);
    face(ctx, [[14, 12], [18, 11], [24, 13], [20, 16], [14, 14]],
      k.cab === "canvas" ? s.canvas : s.paintLight);
    face(ctx, [[15, 12], [18, 11], [23, 13], [21, 14]], s.paintMid);
    if (k.cab === "glass") box(ctx, 19, 12, 3, 1, s.glass);
  }
  box(ctx, 18, 13, 3, 1, s.accent);
  // Driver station: vision blocks only, never a truck windscreen.
  face(ctx, [[25, 14], [28, 14], [31, 17], [28, 19], [25, 17]], s.paintShade);
  face(ctx, [[26, 14], [28, 15], [30, 17], [28, 18], [26, 16]], s.paintLight);
  face(ctx, [[25, 19], [28, 18], [29, 19], [26, 21]], ink);
  face(ctx, [[30, 17], [32, 19], [31, 20], [29, 18]], ink);
  box(ctx, 26, 19, 2, 1, s.glass);
  // Rear boarding door and hinge.
  face(ctx, [[7, 15], [13, 17], [13, 24], [7, 23]], s.paintShade);
  face(ctx, [[8, 16], [12, 18], [12, 23], [8, 22]], s.paintDark);
  box(ctx, 8, 18, 1, 3, s.paintLight);
  box(ctx, 11, 20, 1, 2, s.accent);
  box(ctx, 7, 23, 6, 1, s.metal);
  box(ctx, 8, 24, 4, 1, ink);
  // Side vision ports and troop roof.
  box(ctx, 15, 19, 3, 2, s.paintShade);
  box(ctx, 19, 20, 3, 2, s.paintShade);
  box(ctx, 15, 19, 2, 1, s.paintLight);
  box(ctx, 19, 20, 2, 1, s.paintLight);
  face(ctx, [[15, 23], [22, 25], [22, 26], [15, 24]], s.paintLight);
  // Faction stowage on the sponson.
  if (k.track === "slab") {
    face(ctx, [[5, 11], [9, 9], [13, 11], [13, 14], [9, 16], [5, 14]], ink);
    face(ctx, [[6, 11], [9, 10], [12, 11], [9, 13]], s.canvas);
    box(ctx, 8, 11, 1, 3, s.paintShade);
  } else if (k.track === "skirt") {
    box(ctx, 5, 10, 8, 4, s.paintShade);
    box(ctx, 6, 11, 6, 2, s.paintDark);
    box(ctx, 7, 11, 1, 2, s.accent);
  } else if (k.track === "road") {
    box(ctx, 5, 10, 8, 4, s.paintShade);
    for (const x of [6, 8, 10]) box(ctx, x, 11, 1, 2, s.metalLight);
  } else {
    face(ctx, [[5, 11], [12, 8], [16, 10], [9, 14]], s.paintShade);
    box(ctx, 6, 11, 6, 2, s.paintDark);
    box(ctx, 7, 9, 2, 2, s.accent);
  }
  box(ctx, 3, 16, 3, 6, ink);
  box(ctx, 3, 17, 2, 4, s.paintMid);
  box(ctx, 29, 23, 2, 2, s.accent);
  box(ctx, 32, 21, 2, 2, s.accent);
  box(ctx, 29, 26, 2, 1, s.metal);
  box(ctx, 12, 7, 1, 5, ink);
  box(ctx, 12, 6, 1, 1, s.accent);
}

/* --------------------------------------------------------------- infantry */

/**
 * Dismounted soldier. Faction kits read as: red heavy webbing and a rolled
 * blanket, blue body armour and a boxy helmet, yellow light kit and a slouch
 * hat brim, green foliage and a bandolier.
 */
function soldier(ctx, s, k, mech) {
  const ink = s.metalDark;
  const skin = "#e9bc91";
  const skinShadow = "#b78165";
  const pack = k.cab === "canvas" ? s.canvas : s.paintShade;

  // Rear pack.
  box(ctx, 7, 15, 8, 11, ink);
  box(ctx, 8, 15, 5, 9, pack);
  box(ctx, 8, 16, 2, 6, s.paintMid);
  box(ctx, 8, 13, 6, 3, ink);
  box(ctx, 9, 13, 4, 2, s.paintLight);
  box(ctx, 10, 14, 1, 10, s.paintShade);

  // Legs.
  box(ctx, 12, 23, 7, 6, ink);
  box(ctx, 11, 27, 6, 4, ink);
  box(ctx, 13, 24, 4, 4, s.paintMid);
  box(ctx, 12, 27, 3, 3, s.paintLight);
  box(ctx, 10, 30, 7, 3, ink);
  box(ctx, 11, 30, 4, 1, s.paintMid);
  box(ctx, 19, 23, 6, 6, ink);
  box(ctx, 21, 27, 5, 4, ink);
  box(ctx, 20, 24, 3, 3, s.paintMid);
  box(ctx, 22, 27, 2, 3, s.paintDark);
  box(ctx, 22, 30, 7, 3, ink);
  box(ctx, 23, 30, 4, 1, s.paintMid);

  // Torso.
  box(ctx, 12, 14, 10, 12, ink);
  box(ctx, 10, 16, 15, 6, ink);
  box(ctx, 12, 15, 9, 9, s.paintMid);
  box(ctx, 11, 16, 4, 5, s.paintDark);
  box(ctx, 11, 16, 3, 2, s.paintLight);
  box(ctx, 21, 16, 3, 4, s.paintMid);
  box(ctx, 21, 16, 2, 1, s.paintLight);

  if (k.cab === "steel") {
    // Body armour with a chest plate and shoulder pads.
    box(ctx, 15, 16, 5, 7, s.paintShade);
    box(ctx, 15, 16, 5, 2, s.paintLight);
    box(ctx, 19, 16, 1, 6, s.metalLight);
    box(ctx, 12, 21, 9, 2, s.accent);
  } else if (k.cab === "open") {
    // Light kit: bandolier and foliage sprigs.
    box(ctx, 15, 16, 5, 7, s.paintDark);
    for (let i = 0; i < 4; i++) box(ctx, 15 + i, 17 + i, 2, 2, s.paintShade);
    box(ctx, 12, 23, 3, 2, s.paintLight);
    box(ctx, 13, 22, 2, 1, s.accent);
  } else {
    // Webbing with pouches.
    box(ctx, 15, 16, 5, 7, s.paintDark);
    box(ctx, 15, 16, 1, 6, s.paintLight);
    box(ctx, 19, 16, 1, 6, s.paintLight);
    box(ctx, 15, 22, 5, 2, s.paintMid);
    box(ctx, 17, 22, 1, 2, s.accent);
    if (k.cab === "glass") box(ctx, 16, 18, 3, 2, s.metalLight);
  }
  box(ctx, 12, 24, 11, 2, s.paintShade);
  box(ctx, 17, 24, 2, 1, s.accent);

  // Head and helmet.
  box(ctx, 17, 12, 4, 3, skinShadow);
  box(ctx, 15, 8, 9, 6, ink);
  box(ctx, 16, 9, 7, 4, skin);
  box(ctx, 22, 10, 3, 2, skin);
  box(ctx, 16, 11, 2, 2, skinShadow);
  box(ctx, 21, 10, 1, 1, ink);
  box(ctx, 20, 13, 3, 1, skinShadow);
  helmet(ctx, s, k);

  if (mech) {
    // Shoulder launcher and spare tubes, identical geometry across factions.
    box(ctx, 6, 14, 3, 12, s.metalDark);
    box(ctx, 6, 15, 2, 9, s.metal);
    box(ctx, 9, 16, 3, 11, s.metalDark);
    box(ctx, 9, 17, 2, 8, s.metalLight);
    box(ctx, 11, 16, 6, 5, s.paintShade);
    box(ctx, 12, 16, 4, 3, s.paintLight);
    box(ctx, 15, 13, 18, 6, ink);
    box(ctx, 16, 13, 16, 2, s.metal);
    box(ctx, 16, 15, 16, 3, s.paintDark);
    box(ctx, 19, 14, 2, 4, s.paintShade);
    box(ctx, 28, 14, 2, 4, s.paintShade);
    box(ctx, 32, 12, 4, 8, ink);
    box(ctx, 32, 13, 2, 6, s.metal);
    box(ctx, 35, 14, 1, 4, s.metalDark);
    box(ctx, 22, 11, 3, 2, ink);
    box(ctx, 23, 10, 1, 2, s.accent);
    box(ctx, 12, 20, 6, 3, s.paintDark);
    box(ctx, 17, 18, 3, 4, skinShadow);
    box(ctx, 18, 18, 2, 3, skin);
    box(ctx, 26, 18, 3, 3, skin);
    box(ctx, 23, 21, 5, 2, s.paintMid);
  } else {
    // Rifle across the body.
    box(ctx, 15, 19, 6, 3, ink);
    box(ctx, 16, 19, 4, 2, s.wood);
    box(ctx, 20, 18, 10, 3, ink);
    box(ctx, 22, 18, 6, 1, s.metal);
    box(ctx, 28, 17, 6, 2, ink);
    box(ctx, 32, 16, 1, 2, ink);
    box(ctx, 23, 21, 3, 3, ink);
    box(ctx, 23, 21, 1, 2, s.metalDark);
    box(ctx, 12, 20, 4, 3, s.paintDark);
    box(ctx, 14, 21, 5, 2, s.paintMid);
    box(ctx, 18, 20, 3, 2, skin);
    box(ctx, 25, 20, 3, 2, skinShadow);
    box(ctx, 25, 19, 3, 2, skin);
  }
}

function helmet(ctx, s, k) {
  const ink = s.metalDark;
  if (k.cab === "steel") {
    // Boxy armoured helmet with a flat crown and side rails.
    box(ctx, 12, 6, 13, 4, ink);
    box(ctx, 13, 5, 11, 1, ink);
    box(ctx, 14, 6, 9, 3, s.paintMid);
    box(ctx, 15, 5, 7, 1, s.paintLight);
    box(ctx, 12, 9, 14, 2, s.paintShade);
    box(ctx, 13, 7, 2, 2, s.metalLight);
    box(ctx, 22, 7, 2, 2, s.metalLight);
  } else if (k.cab === "open") {
    // Slouch hat: brim all round, low crown.
    box(ctx, 11, 9, 15, 2, ink);
    box(ctx, 12, 6, 12, 3, ink);
    box(ctx, 13, 5, 9, 2, s.paintMid);
    box(ctx, 14, 5, 7, 1, s.paintLight);
    box(ctx, 12, 8, 13, 1, s.paintShade);
    box(ctx, 21, 5, 1, 3, s.accent);
  } else {
    // Rounded helmet, the silhouette every faction keeps as the fallback.
    box(ctx, 12, 6, 13, 4, ink);
    box(ctx, 14, 4, 9, 2, ink);
    box(ctx, 16, 3, 5, 1, ink);
    box(ctx, 14, 5, 9, 3, s.paintMid);
    box(ctx, 13, 7, 11, 2, s.paintMid);
    box(ctx, 16, 4, 5, 2, s.paintLight);
    box(ctx, 14, 6, 5, 1, s.paintLight);
    box(ctx, 22, 6, 2, 3, s.paintDark);
    box(ctx, 12, 9, 14, 2, s.paintShade);
    box(ctx, 14, 9, 10, 1, s.paintLight);
    box(ctx, 14, 10, 3, 3, s.paintDark);
    box(ctx, 22, 11, 1, 1, ink);
    if (k.cab === "canvas") {
      box(ctx, 15, 3, 7, 1, s.canvas);
      box(ctx, 17, 2, 3, 1, s.canvas);
    }
  }
}

/* ------------------------------------------------------------------ export */

const PAINTERS = {
  infantry: (ctx, s, k) => soldier(ctx, s, k, false),
  mech: (ctx, s, k) => soldier(ctx, s, k, true),
  tank: (ctx, s, k, step) => tank(ctx, s, k, false, step),
  heavy: (ctx, s, k, step) => tank(ctx, s, k, true, step),
  artillery: (ctx, s, k, step) => artilleryUnit(ctx, s, k, step),
  recon: (ctx, s, k, step) => reconUnit(ctx, s, k, step),
  rocket: (ctx, s, k, step) => rocketUnit(ctx, s, k, step),
  apc: (ctx, s, k, step) => apcUnit(ctx, s, k, step),
};

/**
 * Paint one land unit.
 * @param {CanvasRenderingContext2D} ctx 40×40 destination context
 * @param {string} type unit id from `UNITS`
 * @param {string} factionId one of FACTIONS
 * @param {number} step gait phase index, pass -1 to keep the run static
 */
export function paintLandUnit(ctx, type, factionId, step = -1) {
  const painter = PAINTERS[type] ?? PAINTERS.infantry;
  painter(ctx, style(factionId), kit(factionId), step);
}

/** Legacy signature: the four-colour array the frozen painters already take. */
export function landPalette(factionId) {
  return styleArray(factionId);
}

export { style as landStyle, kit as landKit };
