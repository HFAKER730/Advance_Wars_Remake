/**
 * Naval unit painters — two shared silhouettes (patrol hull, landing hull)
 * with four faction kits.
 *
 * Geometry differences per faction:
 *   red    flush deck, rounded bridge, twin stacks, tub-mounted turret
 *   blue   long forecastle, single raked stack, deckhouse aft, VLS grid
 *   yellow clipper bow with a beak, tall funnel, stern gantry crane
 *   green  flat deck, low casemate bridge, lattice mast, ramp over the bow
 *
 * Every hull carries the same detail layers regardless of kit — deck planking,
 * railing posts, bollards, hatch coamings, a boot-topping line and bow foam —
 * so a ship reads as a ship at 1× before the faction kit is even considered.
 *
 * Unlike land and air units, ships are tall on the Y axis: they are drawn
 * bow-right, occupy the lower two thirds of the tile, and leave the water
 * visible above the hull. The renderer keeps terrain water beneath them.
 */
import { box, face, poly, insignia, rivets, line } from "./pixel-draw.mjs";
import { FACTION_STYLES } from "./faction-style.mjs";
import { LAND_KITS } from "./faction-land.mjs";

export const SEA_KITS = {
  red: { bridge: "round", funnel: "twin", bow: "flush", deck: "turret" },
  blue: { bridge: "box", funnel: "raked", bow: "forecastle", deck: "vls" },
  yellow: { bridge: "tall", funnel: "clipper", bow: "beak", deck: "crane" },
  green: { bridge: "casemate", funnel: "lattice", bow: "ramp", deck: "well" },
};

const style = (id) => FACTION_STYLES[id] ?? FACTION_STYLES.red;
const kit = (id) => SEA_KITS[id] ?? SEA_KITS.red;
const landKit = (id) => LAND_KITS[id] ?? LAND_KITS.red;

/* ------------------------------------------------------------------- hull */

/** Hull body shared by both classes. Deck line sits at y=19, waterline at 29. */
function hull(ctx, s, k, length) {
  const ink = s.metalDark;
  const bow = 3 + length;

  // Freeboard: one ink silhouette, then three paint bands so the hull is
  // never a single flat block.
  face(ctx, [[3, 22], [bow - 7, 18], [bow, 22], [bow - 1, 28], [4, 30], [2, 26]], ink);
  face(ctx, [[4, 23], [bow - 7, 19], [bow - 1, 22], [bow - 1, 25], [4, 28], [3, 25]], s.paintLight);
  face(ctx, [[4, 25], [bow - 2, 25], [bow - 1, 27], [4, 29]], s.paintMid);
  face(ctx, [[4, 27], [bow - 2, 27], [bow - 2, 28], [4, 29]], s.paintDark);
  face(ctx, [[4, 28], [bow - 2, 28], [bow - 3, 29], [5, 30]], s.paintShade);

  // Deck edge highlight and the shadow the bulwark casts on the freeboard.
  box(ctx, 4, 22, bow - 8, 1, s.paintLight);
  box(ctx, 5, 23, bow - 10, 1, s.paintMid);

  // Boot-topping: the only near-black band, one pixel row at the waterline.
  box(ctx, 4, 29, bow - 7, 1, s.rubber);
  // Bow foam where the hull cuts the water.
  box(ctx, bow - 5, 29, 4, 1, s.canvas);

  // Bow treatment.
  if (k.bow === "beak") {
    face(ctx, [[bow - 8, 19], [bow, 22], [bow - 2, 24], [bow - 8, 22]], s.paintShade);
    box(ctx, bow - 4, 21, 4, 1, s.metalLight);
  } else if (k.bow === "forecastle") {
    face(ctx, [[bow - 8, 18], [bow, 22], [bow - 1, 24], [bow - 8, 22]], s.paintMid);
    box(ctx, bow - 9, 19, 8, 1, s.paintLight);
    box(ctx, bow - 9, 20, 7, 1, s.paintShade);
  } else if (k.bow === "ramp") {
    face(ctx, [[bow - 7, 18], [bow, 22], [bow - 7, 22]], s.paintShade);
    line(ctx, [[bow - 7, 19], [bow - 1, 21]], s.metalLight);
    box(ctx, bow - 6, 20, 5, 1, s.paintDark);
  } else {
    box(ctx, bow - 6, 20, 5, 1, s.paintLight);
    box(ctx, bow - 7, 21, 4, 1, s.paintShade);
  }

  // Anchor hawse and a chain lead, always at the bow.
  box(ctx, bow - 7, 23, 2, 2, ink);
  box(ctx, bow - 7, 23, 1, 1, s.metalLight);
  for (let i = 0; i < 4; i++) box(ctx, bow - 9 + i, 24 + (i % 2), 1, 1, s.metalDark);

  // Stern transom and rudder.
  face(ctx, [[3, 22], [6, 21], [6, 29], [3, 30]], s.paintDark);
  box(ctx, 3, 26, 3, 1, s.paintShade);
  box(ctx, 2, 27, 1, 3, ink);
}

/** Deck planking, rails, bollards and hatches — the texture that sells scale. */
function deckDetails(ctx, s, k, startX, endX, deckY, step) {
  const ink = s.metalDark;
  // Plank seams run across the deck, spaced unevenly so it never looks printed.
  for (let x = startX + 2, i = 0; x < endX - 1; x += 3, i++)
    box(ctx, x, deckY, 1, 2, i % 2 ? s.paintShade : s.paintDark);
  // Railing: posts plus a single top rail, broken where the deck fittings sit.
  for (let x = startX + 1; x < endX; x += 4) {
    box(ctx, x, deckY - 2, 1, 2, s.metalLight);
    box(ctx, x, deckY - 3, 1, 1, s.metal);
  }
  box(ctx, startX + 1, deckY - 2, endX - startX - 1, 1, s.metal);
  // Bollards and a fairlead.
  for (const x of [startX + 3, startX + 9, endX - 5]) {
    box(ctx, x, deckY - 1, 2, 1, ink);
    box(ctx, x, deckY - 1, 1, 1, s.metalLight);
  }
  // Cargo hatch coaming with a visible lip.
  box(ctx, startX + 5, deckY - 2, 6, 1, ink);
  box(ctx, startX + 6, deckY - 2, 4, 1, s.paintShade);
  // Life-raft canisters lashed along the rail.
  if (step >= 0 && step % 4 < 2) {
    box(ctx, startX + 12, deckY - 2, 3, 1, s.canvas);
    box(ctx, startX + 12, deckY - 2, 1, 1, s.paintShade);
  }
}

/* --------------------------------------------------------- superstructure */

function bridge(ctx, s, k, ship) {
  const ink = s.metalDark;
  const wide = ship === "landing";
  const left = wide ? 13 : 16;
  const right = wide ? 29 : 27;
  const roof = wide ? 12 : 13;
  const deckTop = 19;

  if (k.bridge === "round") {
    face(ctx, [[left, roof], [right - 2, roof - 1], [right, deckTop + 2], [left, deckTop], [left - 2, roof + 2]], ink);
    face(ctx, [[left + 1, roof], [right - 3, roof], [right - 2, deckTop + 1], [left + 1, deckTop - 1]], s.paintMid);
    face(ctx, [[left + 1, deckTop - 2], [right - 3, deckTop - 1], [right - 3, deckTop + 1], [left + 1, deckTop]], s.paintLight);
    box(ctx, left + 2, roof + 1, wide ? 8 : 5, 2, s.glass);
    box(ctx, left + 2, roof + 1, wide ? 8 : 5, 1, s.paintLight);
    box(ctx, left + 2, roof + 3, 3, 2, s.paintShade);
  } else if (k.bridge === "box") {
    face(ctx, [[left, roof], [right, roof], [right + 1, deckTop + 2], [left - 1, deckTop + 1]], ink);
    face(ctx, [[left + 1, roof + 1], [right - 1, roof + 1], [right, deckTop + 1], [left, deckTop]], s.paintMid);
    face(ctx, [[left + 1, roof + 1], [right - 1, roof + 1], [right - 1, roof + 3], [left + 1, roof + 3]], s.paintLight);
    box(ctx, left + 2, roof + 4, wide ? 9 : 6, 2, s.glass);
    box(ctx, left + 2, roof + 4, wide ? 9 : 6, 1, s.paintLight);
    box(ctx, right - 6, roof + 1, 3, 3, s.paintShade);
  } else if (k.bridge === "tall") {
    face(ctx, [[left, roof - 3], [right - 3, roof - 3], [right, deckTop + 2], [left, deckTop]], ink);
    face(ctx, [[left + 1, roof - 2], [right - 4, roof - 2], [right - 1, deckTop + 1], [left + 1, deckTop - 1]], s.paintMid);
    face(ctx, [[left + 1, roof - 2], [right - 4, roof - 2], [right - 4, roof], [left + 1, roof]], s.paintLight);
    box(ctx, left + 2, roof + 1, wide ? 7 : 5, 2, s.glass);
    box(ctx, left + 2, roof + 3, wide ? 7 : 5, 1, s.glass);
    box(ctx, left + 1, roof - 3, 2, 3, s.accent);
    box(ctx, right - 5, roof - 2, 1, 9, s.paintShade);
  } else {
    // Low casemate: broad, flat, one long vision slit.
    face(ctx, [[left - 1, roof + 1], [right, roof + 1], [right, deckTop + 2], [left - 1, deckTop + 1]], ink);
    face(ctx, [[left, roof + 2], [right - 1, roof + 2], [right - 1, deckTop + 1], [left, deckTop]], s.paintMid);
    face(ctx, [[left, roof + 2], [right - 1, roof + 2], [right - 1, roof + 3], [left, roof + 3]], s.paintLight);
    box(ctx, left + 1, roof + 4, wide ? 12 : 8, 1, s.glass);
    rivets(ctx, [left + 2, left + 6, left + 10], [roof + 5], s.metalLight);
    box(ctx, right - 4, roof + 1, 3, 2, s.paintShade);
  }

  // Funnel / mast per faction.
  if (k.funnel === "twin") {
    box(ctx, right - 9, roof - 2, 3, 5, ink);
    box(ctx, right - 8, roof - 1, 2, 4, s.paintShade);
    box(ctx, right - 4, roof - 1, 3, 5, ink);
    box(ctx, right - 3, roof, 2, 4, s.paintShade);
    box(ctx, right - 3, roof - 2, 2, 1, s.rubber);
    box(ctx, right - 9, roof - 2, 2, 1, s.rubber);
    box(ctx, right - 8, roof + 1, 1, 1, s.accent);
  } else if (k.funnel === "raked") {
    poly(ctx, [[right - 7, roof], [right - 3, roof - 3], [right - 1, roof - 3], [right - 1, roof + 4], [right - 7, roof + 4]], ink);
    poly(ctx, [[right - 6, roof + 1], [right - 3, roof - 2], [right - 2, roof - 2], [right - 2, roof + 3], [right - 6, roof + 3]], s.paintShade);
    box(ctx, right - 4, roof - 3, 2, 1, s.rubber);
    box(ctx, right - 6, roof + 1, 1, 3, s.paintDark);
  } else if (k.funnel === "clipper") {
    box(ctx, right - 6, roof - 4, 4, 8, ink);
    box(ctx, right - 5, roof - 3, 3, 6, s.paintShade);
    box(ctx, right - 5, roof - 4, 3, 1, s.accent);
    box(ctx, right - 4, roof - 2, 1, 3, s.metalDark);
  } else {
    line(ctx, [[right - 6, roof + 3], [right - 6, roof - 3]], s.metalDark);
    for (let i = 0; i < 4; i++) line(ctx, [[right - 6, roof - 3 + i * 2], [right - 1, roof - 1 + i]], s.metal);
    box(ctx, right - 7, roof + 3, 4, 2, s.paintShade);
    box(ctx, right - 7, roof - 3, 1, 1, s.accent);
  }

  // Mast, yard and antenna: gives the ship vertical structure above the bridge.
  const mastX = wide ? 11 : 14;
  box(ctx, mastX, roof - 5, 1, 7, s.metalDark);
  box(ctx, mastX - 2, roof - 4, 5, 1, s.metal);
  line(ctx, [[mastX, roof - 5], [mastX + 3, roof + 1]], s.metalDark);
  box(ctx, mastX - 1, roof - 6, 3, 1, s.accent);
  box(ctx, mastX + 3, roof - 4, 1, 1, s.metalLight);

  // Deck fittings.
  if (k.deck === "turret") {
    face(ctx, [[left, deckTop + 1], [left + 6, deckTop], [left + 7, deckTop + 3], [left, deckTop + 4]], ink);
    face(ctx, [[left + 1, deckTop + 1], [left + 5, deckTop + 1], [left + 5, deckTop + 3], [left + 1, deckTop + 3]], s.paintMid);
    box(ctx, left, deckTop + 2, 2, 1, s.metal);
    box(ctx, left + 6, deckTop + 2, 4, 1, s.metalDark);
    box(ctx, left + 9, deckTop + 2, 1, 1, s.metal);
  } else if (k.deck === "vls") {
    for (let gx = 0; gx < 3; gx++)
      for (let gy = 0; gy < 2; gy++) {
        box(ctx, left + 2 + gx * 3, deckTop + 1 + gy * 2, 2, 1, s.metal);
        box(ctx, left + 2 + gx * 3, deckTop + 1 + gy * 2, 1, 1, s.metalDark);
      }
    box(ctx, left + 1, deckTop, 10, 1, s.paintShade);
  } else if (k.deck === "crane") {
    box(ctx, left + 2, deckTop - 2, 1, 4, s.metal);
    box(ctx, left + 2, deckTop - 3, 6, 1, s.metal);
    box(ctx, left + 7, deckTop - 2, 1, 2, s.paintShade);
    line(ctx, [[left + 8, deckTop - 1], [left + 10, deckTop + 2]], s.metalDark);
    box(ctx, left + 9, deckTop + 2, 2, 1, s.metalLight);
  } else {
    face(ctx, [[left + 1, deckTop + 1], [left + 9, deckTop + 1], [left + 9, deckTop + 3], [left + 1, deckTop + 3]], s.paintShade);
    box(ctx, left + 2, deckTop + 2, 6, 1, s.paintDark);
    for (const x of [left + 3, left + 6]) box(ctx, x, deckTop + 1, 1, 1, s.metalLight);
  }
}

/* ------------------------------------------------------------------ units */

function patrol(ctx, s, k, lk, step) {
  hull(ctx, s, k, 30);
  deckDetails(ctx, s, k, 4, 26, 20, step);
  bridge(ctx, s, k, "patrol");
  // Radar lattice and a forward gun keep the reading "warship", not "boat".
  box(ctx, 25, 8, 1, 5, s.metalDark);
  box(ctx, 24, 7, 3, 1, s.metal);
  box(ctx, 24, 7, 1, 1, s.accent);
  line(ctx, [[25, 8], [27, 10]], s.metalDark);
  insignia(ctx, 7, 24, 5, 2, s, lk.insignia);
  // Depth-charge rack and stern rail.
  for (const x of [5, 8]) {
    box(ctx, x, 21, 2, 1, s.metalDark);
    box(ctx, x, 21, 1, 1, s.metalLight);
  }
  if (step >= 0 && step % 3 === 0) box(ctx, 2, 30, 4, 1, s.canvas);
}

function landing(ctx, s, k, lk, step) {
  hull(ctx, s, k, 32);
  deckDetails(ctx, s, k, 4, 30, 20, step);
  bridge(ctx, s, k, "landing");
  // Well deck aft and a bow ramp; the silhouette must read as "carrier".
  if (k.deck === "well")
    face(ctx, [[8, 22], [20, 21], [20, 24], [8, 25]], s.paintShade);
  else
    face(ctx, [[8, 22], [20, 21], [20, 23], [8, 24]], s.paintDark);
  // Vehicle lane guides down the deck.
  for (const [x, y] of [[10, 21], [15, 21], [20, 21]]) box(ctx, x, y, 4, 1, s.metalLight);
  box(ctx, 9, 23, 2, 1, s.paintLight);
  box(ctx, 14, 23, 2, 1, s.paintLight);
  face(ctx, [[32, 20], [37, 22], [37, 24], [32, 24]], s.paintShade);
  box(ctx, 33, 21, 4, 1, s.paintLight);
  box(ctx, 32, 23, 5, 1, s.paintDark);
  // Ramp hinge line and landing craft on the davits.
  line(ctx, [[32, 21], [36, 24]], s.metalDark);
  box(ctx, 6, 20, 3, 1, s.canvas);
  insignia(ctx, 9, 23, 5, 2, s, lk.insignia);
  if (step >= 0 && step % 3 === 0) box(ctx, 2, 30, 5, 1, s.canvas);
}

/* ----------------------------------------------------------------- export */

export function paintSeaUnit(ctx, type, factionId, step = -1) {
  const s = style(factionId);
  const k = kit(factionId);
  const lk = landKit(factionId);
  ctx.save();
  if (type === "landing") landing(ctx, s, k, lk, step);
  else patrol(ctx, s, k, lk, step);
  ctx.restore();
}

/** Wake the renderer draws beneath a moving ship. */
export function paintWake(ctx, x, y, step) {
  const spread = step >= 0 ? (step % 3) : 0;
  box(ctx, x + 1, y + 29 + spread, 5 + spread, 1, "#cfe0d6");
  box(ctx, x + 1, y + 31 - spread, 3, 1, "#b6ccc4");
}

export { style as seaStyle, kit as seaKit };
