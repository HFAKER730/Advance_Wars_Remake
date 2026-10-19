/**
 * Air unit painters — two shared silhouettes (fixed wing, rotor) with four
 * faction kits.
 *
 * Geometry differences per faction:
 *   red    straight wing, square tip, chin intake, framed canopy
 *   blue   swept wing, pointed tip, twin cheek intakes, razor canopy
 *   yellow tapered wing with a winglet, underwing pylons, fixed skids
 *   green  long high wing, rounded tip, bubble canopy, three-blade rotor
 *
 * The wing is drawn once as a swept, layered airfoil and flipped below the
 * fuselage for the near wing, so both wings carry the same panel seams,
 * leading-edge highlight and wingtip navigation light instead of reading as
 * flat rectangles.
 *
 * Aircraft are drawn nose-right in a 40×40 tile, hovering a few pixels above
 * the ground line so the tile's drop shadow reads as altitude.
 */
import { box, face, line, rivets, insignia } from "./pixel-draw.mjs";
import { FACTION_STYLES } from "./faction-style.mjs";
import { LAND_KITS } from "./faction-land.mjs";

export const AIR_KITS = {
  red: { wing: "straight", intake: "single", gear: "wheel", canopy: "framed", rotor: "two" },
  blue: { wing: "swept", intake: "twin", gear: "wheel", canopy: "razor", rotor: "four" },
  yellow: { wing: "tapered", intake: "single", gear: "skid", canopy: "framed", rotor: "two" },
  green: { wing: "high", intake: "single", gear: "skid", canopy: "bubble", rotor: "three" },
};

const style = (id) => FACTION_STYLES[id] ?? FACTION_STYLES.red;
const kit = (id) => AIR_KITS[id] ?? AIR_KITS.red;
const landKit = (id) => LAND_KITS[id] ?? LAND_KITS.red;

/* ------------------------------------------------------------ wing shapes */

/** One wing, root at x≈9, tip at x≈33, built from an ink outline, two paint
 *  faces, a leading-edge highlight, a panel seam and a wingtip light. */
function wingGeometry(ctx, s, shape) {
  const ink = s.metalDark;
  if (shape === "swept") {
    face(ctx, [[9, 16], [22, 7], [29, 8], [33, 13], [18, 17]], ink);
    face(ctx, [[10, 16], [22, 8], [28, 9], [31, 13], [18, 16]], s.paintMid);
    face(ctx, [[10, 16], [22, 8], [25, 8], [13, 15]], s.paintLight);
    face(ctx, [[28, 9], [31, 13], [28, 13], [26, 11]], s.paintDark);
    line(ctx, [[14, 14], [27, 10]], s.paintShade);
    box(ctx, 26, 9, 3, 1, s.accent);
    box(ctx, 31, 12, 2, 1, s.metalLight);
  } else if (shape === "tapered") {
    face(ctx, [[9, 15], [23, 9], [30, 10], [31, 14], [17, 17]], ink);
    face(ctx, [[10, 15], [23, 10], [29, 11], [30, 14], [17, 16]], s.paintMid);
    face(ctx, [[10, 15], [23, 10], [26, 10], [12, 14]], s.paintLight);
    box(ctx, 29, 10, 2, 3, s.metal);
    box(ctx, 24, 11, 4, 1, s.accent);
    rivets(ctx, [14, 18, 22], [13, 12, 11], s.paintShade);
  } else if (shape === "high") {
    face(ctx, [[8, 14], [24, 8], [32, 9], [33, 12], [16, 16]], ink);
    face(ctx, [[9, 14], [24, 9], [31, 10], [32, 12], [16, 15]], s.paintMid);
    face(ctx, [[9, 14], [24, 9], [28, 9], [11, 13]], s.paintLight);
    face(ctx, [[24, 9], [32, 10], [32, 11], [24, 11]], s.paintDark);
    line(ctx, [[13, 13], [30, 10]], s.paintShade);
    box(ctx, 27, 9, 4, 1, s.accent);
  } else {
    face(ctx, [[9, 16], [23, 10], [31, 10], [31, 15], [17, 18]], ink);
    face(ctx, [[10, 16], [23, 11], [30, 11], [30, 15], [17, 17]], s.paintMid);
    face(ctx, [[10, 16], [23, 11], [27, 11], [12, 15]], s.paintLight);
    box(ctx, 29, 11, 2, 1, s.metalLight);
    box(ctx, 22, 12, 5, 1, s.paintShade);
    box(ctx, 23, 13, 4, 1, s.accent);
  }
}

/** Flip a wing below the fuselage; the small x shift fakes near-wing offset. */
function nearWing(ctx, s, shape) {
  ctx.save();
  ctx.translate(1, 36);
  ctx.scale(1, -1);
  wingGeometry(ctx, s, shape);
  ctx.restore();
}

/* ------------------------------------------------------------ fixed wing */

function fighter(ctx, s, k, lk, step) {
  const ink = s.metalDark;
  const bob = step >= 0 && step % 2 ? -1 : 0;
  ctx.translate(0, bob);

  wingGeometry(ctx, s, k.wing);

  // Fuselage: broad spine, tapered tail cone, chined lower edge.
  face(ctx, [[8, 20], [16, 15], [33, 17], [36, 20], [33, 24], [16, 25], [8, 21]], ink);
  face(ctx, [[9, 20], [16, 16], [33, 18], [35, 20], [32, 23], [16, 24], [9, 21]], s.paintLight);
  face(ctx, [[10, 21], [30, 23], [30, 24], [11, 22]], s.paintDark);
  face(ctx, [[16, 16], [33, 18], [33, 19], [16, 17]], s.paintMid);
  // Panel seams along the spine and a walkway line over the wing root.
  line(ctx, [[12, 19], [31, 20]], s.paintShade);
  line(ctx, [[13, 22], [29, 23]], s.paintShade);
  rivets(ctx, [13, 17, 21, 25, 29], [18], s.paintShade);
  rivets(ctx, [15, 22, 28], [22], s.metalDark);

  // Nose: metal cone, pitot probe and a shaded gun port.
  face(ctx, [[31, 18], [36, 20], [33, 22], [31, 21]], s.metal);
  face(ctx, [[33, 19], [36, 20], [34, 21]], s.metalLight);
  box(ctx, 36, 19, 4, 1, s.metalDark);
  box(ctx, 38, 19, 1, 1, s.accent);
  box(ctx, 30, 21, 3, 1, ink);

  // Canopy: frame, glass and a single specular pixel row.
  if (k.canopy === "razor") {
    face(ctx, [[15, 17], [22, 15], [23, 17], [16, 18]], ink);
    face(ctx, [[16, 17], [22, 16], [22, 17], [17, 18]], s.glass);
    box(ctx, 19, 16, 1, 2, s.paintShade);
    box(ctx, 17, 17, 3, 1, s.paintLight);
  } else if (k.canopy === "bubble") {
    face(ctx, [[14, 17], [21, 14], [24, 16], [22, 18], [15, 19]], ink);
    face(ctx, [[15, 17], [21, 15], [22, 17], [15, 18]], s.glass);
    face(ctx, [[16, 16], [20, 15], [21, 16], [17, 17]], s.paintLight);
    box(ctx, 15, 18, 6, 1, s.glass);
  } else {
    face(ctx, [[15, 17], [22, 15], [23, 17], [16, 19]], ink);
    face(ctx, [[16, 17], [21, 16], [22, 17], [17, 18]], s.glass);
    box(ctx, 18, 15, 1, 3, s.paintShade);
    box(ctx, 17, 16, 3, 1, s.paintLight);
  }

  // Intake / nose treatment.
  if (k.intake === "twin") {
    box(ctx, 24, 18, 5, 2, s.paintShade);
    box(ctx, 24, 22, 5, 2, s.paintShade);
    box(ctx, 26, 18, 3, 1, s.metal);
    box(ctx, 26, 23, 3, 1, s.metal);
    box(ctx, 24, 18, 1, 2, s.metalLight);
    box(ctx, 24, 22, 1, 2, s.metalLight);
  } else {
    box(ctx, 9, 19, 4, 3, s.paintShade);
    box(ctx, 11, 20, 3, 1, s.metal);
    box(ctx, 10, 20, 1, 1, s.metalLight);
  }

  // Tail: fin, rudder hinge and a stabiliser with its own tip cap.
  face(ctx, [[27, 17], [34, 12], [37, 13], [35, 17], [30, 19]], ink);
  face(ctx, [[28, 17], [34, 13], [36, 14], [34, 17]], s.paintMid);
  face(ctx, [[29, 16], [34, 13], [35, 13], [30, 16]], s.paintLight);
  line(ctx, [[31, 16], [35, 14]], s.paintShade);
  box(ctx, 36, 13, 1, 2, s.accent);
  face(ctx, [[29, 22], [35, 20], [36, 22], [30, 24]], s.paintDark);
  box(ctx, 34, 21, 2, 1, s.metalLight);

  // Exhaust: nozzle ring plus a short heat-stained trail.
  box(ctx, 7, 19, 2, 3, ink);
  box(ctx, 7, 20, 1, 1, s.accent);
  box(ctx, 5, 20, 2, 1, s.paintShade);

  nearWing(ctx, s, k.wing);

  // Underwing store: pylon, missile body, warhead band and fins.
  if (k.gear === "skid") {
    box(ctx, 24, 27, 1, 3, ink);
    box(ctx, 20, 29, 8, 2, s.paintLight);
    box(ctx, 20, 30, 8, 1, s.paintDark);
    box(ctx, 27, 29, 2, 2, s.accent);
    box(ctx, 19, 29, 1, 1, s.metalLight);
  } else {
    box(ctx, 22, 27, 1, 2, ink);
    box(ctx, 18, 28, 7, 2, s.metal);
    box(ctx, 18, 29, 7, 1, s.metalDark);
    box(ctx, 24, 28, 1, 2, s.accent);
    box(ctx, 17, 28, 1, 1, s.metalLight);
  }

  // Landing gear: strut, tyre and hub, plus a tail skid.
  if (k.gear === "wheel") {
    for (const x of [17, 31]) {
      box(ctx, x, 29, 1, 2, ink);
      box(ctx, x - 1, 31, 3, 2, s.rubber);
      box(ctx, x, 31, 1, 1, s.tireHub);
    }
    box(ctx, 8, 22, 1, 2, ink);
  } else {
    box(ctx, 15, 29, 2, 2, ink);
    box(ctx, 29, 29, 2, 2, ink);
    box(ctx, 13, 31, 5, 1, s.metal);
    box(ctx, 28, 31, 5, 1, s.metal);
    box(ctx, 14, 31, 1, 1, s.metalLight);
  }

  insignia(ctx, 22, 20, 5, 2, s, lk.insignia);
  box(ctx, 8, 20, 3, 1, s.metal);
}

/* ---------------------------------------------------------------- rotor */

function copter(ctx, s, k, lk, step) {
  const ink = s.metalDark;
  const bob = step >= 0 ? (step % 2 ? -1 : 0) : 0;
  ctx.translate(0, bob);

  // Rotor disc: faint blades that sweep with the gait phase.
  const blades = k.rotor === "four" ? 4 : k.rotor === "three" ? 3 : 2;
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < blades; i++) {
    const len = 12 - Math.abs(6 - ((i * 5 + (step >= 0 ? step : 7)) % 12));
    box(ctx, 18 - len, 6 + (i % 2), len + 6, 1, s.metalLight);
  }
  ctx.globalAlpha = 1;
  box(ctx, 19, 4, 2, 3, ink);
  box(ctx, 19, 7, 2, 4, ink);
  box(ctx, 19, 7, 1, 3, s.metalLight);

  // Stub wings with rocket pods, drawn behind the cabin.
  face(ctx, [[13, 15], [25, 13], [27, 15], [15, 18]], ink);
  face(ctx, [[14, 15], [25, 14], [26, 15], [15, 17]], s.paintShade);
  for (const [px, py] of [[12, 17], [25, 17]]) {
    box(ctx, px, py, 4, 3, ink);
    box(ctx, px, py + 1, 4, 1, s.metal);
    for (let i = 0; i < 3; i++) box(ctx, px + (i % 2), py + 1 + Math.floor(i / 2) * 0, 1, 1, s.metalDark);
    box(ctx, px + 3, py + 1, 1, 1, s.accent);
  }

  // Fuselage: cabin, shaded belly, bright upper deck.
  face(ctx, [[11, 13], [24, 11], [32, 14], [32, 21], [24, 24], [11, 22]], ink);
  face(ctx, [[12, 14], [24, 12], [31, 15], [31, 20], [24, 23], [12, 21]], s.paintLight);
  face(ctx, [[12, 15], [23, 21], [23, 23], [12, 21]], s.paintDark);
  face(ctx, [[24, 20], [31, 15], [31, 20], [24, 23]], s.paintShade);
  line(ctx, [[13, 19], [30, 16]], s.paintMid);
  rivets(ctx, [15, 19, 23, 27], [14, 14, 14, 15], s.paintShade);
  box(ctx, 20, 22, 6, 1, s.metalDark);
  box(ctx, 21, 22, 4, 1, s.metalLight);

  // Canopy / nose.
  if (k.canopy === "bubble") {
    face(ctx, [[13, 14], [19, 12], [22, 15], [18, 19], [13, 18]], ink);
    face(ctx, [[14, 14], [19, 13], [20, 15], [18, 18], [14, 17]], s.glass);
    face(ctx, [[15, 14], [19, 13], [19, 14], [16, 16]], s.paintLight);
  } else {
    face(ctx, [[13, 14], [19, 12], [21, 15], [14, 18]], ink);
    face(ctx, [[14, 14], [19, 13], [20, 15], [14, 17]], s.glass);
    box(ctx, 16, 13, 1, 4, s.paintShade);
    box(ctx, 17, 14, 2, 1, s.paintLight);
  }
  box(ctx, 30, 16, 2, 2, s.metal);

  // Tail boom, fin and tail rotor.
  face(ctx, [[31, 17], [37, 15], [38, 17], [31, 21]], s.paintMid);
  face(ctx, [[31, 17], [37, 15], [37, 17], [31, 19]], s.paintLight);
  line(ctx, [[32, 19], [37, 17]], s.paintShade);
  box(ctx, 36, 11, 1, 6, ink);
  box(ctx, 35, 13, 3, 1, s.metalLight);
  box(ctx, 37, 12, 1, 2, s.accent);

  // Exhaust / gear.
  if (k.gear === "wheel") {
    box(ctx, 14, 23, 2, 3, s.metal);
    box(ctx, 27, 23, 2, 3, s.metal);
    box(ctx, 13, 26, 4, 1, s.rubber);
    box(ctx, 26, 26, 4, 1, s.rubber);
    box(ctx, 20, 20, 8, 2, s.metal);
    box(ctx, 20, 20, 8, 1, s.metalLight);
    box(ctx, 26, 20, 3, 2, s.paintShade);
  } else {
    box(ctx, 13, 23, 3, 2, s.metal);
    box(ctx, 26, 23, 3, 2, s.metal);
    box(ctx, 12, 25, 4, 1, s.paintShade);
    box(ctx, 25, 25, 4, 1, s.paintShade);
    box(ctx, 15, 25, 1, 2, s.metalLight);
    box(ctx, 28, 25, 1, 2, s.metalLight);
    box(ctx, 20, 20, 6, 2, s.metal);
    box(ctx, 20, 20, 6, 1, s.metalLight);
    box(ctx, 25, 19, 4, 3, s.paintShade);
    box(ctx, 26, 20, 2, 1, ink);
  }

  insignia(ctx, 27, 17, 4, 2, s, lk.insignia);

  if (k.intake === "twin") {
    // Twin exhaust stacks raked outboard, above and below the boom.
    face(ctx, [[22, 10], [26, 8], [27, 10], [23, 12]], ink);
    face(ctx, [[23, 10], [26, 9], [26, 10], [23, 11]], s.metal);
    face(ctx, [[22, 24], [26, 26], [27, 24], [23, 22]], ink);
    face(ctx, [[23, 24], [26, 25], [26, 24], [23, 23]], s.metal);
  } else if (k.rotor === "three") {
    // High tail stabiliser so the rotor variant reads as a different craft.
    face(ctx, [[32, 12], [37, 8], [38, 11], [34, 15]], ink);
    face(ctx, [[33, 12], [37, 9], [37, 11], [34, 14]], s.paintMid);
    line(ctx, [[34, 12], [37, 10]], s.paintLight);
  } else if (k.gear === "skid") {
    // Long tail skid running past the end of the boom.
    box(ctx, 34, 24, 6, 1, s.metalDark);
    box(ctx, 36, 25, 4, 1, s.paintMid);
  }
}

/* ----------------------------------------------------------------- export */

export function paintAirUnit(ctx, type, factionId, step = -1) {
  const s = style(factionId);
  const k = kit(factionId);
  const lk = landKit(factionId);
  ctx.save();
  if (type === "copter") copter(ctx, s, k, lk, step);
  else fighter(ctx, s, k, lk, step);
  ctx.restore();
}

/** Ground shadow the renderer draws under every airborne unit. */
export function paintAirShadow(ctx, type, x, y) {
  box(ctx, x + (type === "copter" ? 8 : 6), y + 30, type === "copter" ? 26 : 32, 3, "rgba(24,45,42,.22)");
  box(ctx, x + (type === "copter" ? 12 : 11), y + 33, type === "copter" ? 18 : 22, 1, "rgba(24,45,42,.13)");
}

export { style as airStyle, kit as airKit };
