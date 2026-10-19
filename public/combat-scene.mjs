import { TERRAINS, UNITS } from "./shared/engine.mjs";
import { paintUnitMotion } from "./unit-motion.mjs";
import { deathEffectKind, paintFallingSoldier, paintVehicleBlast } from "./unit-death.mjs";
import { COMBAT_TIMING, combatClock, combatDuration } from "./shared/animation-timing.mjs";
import { paintPixelText } from "./pixel-font.mjs";
export { COMBAT_TIMING, combatDuration };

const PALETTES = [
  ["#f79a75", "#df634c", "#a83c36", "#713134"],
  ["#91d5ef", "#4ba5d1", "#2e668f", "#29415f"],
  ["#ffe499", "#dfbd56", "#a27b33", "#6a522d"],
  ["#c2acef", "#9278ce", "#634da0", "#44385f"],
];
const ARMIES = ["赤焰军", "苍蓝军", "金叶军", "紫星军"];
const WIDTH = 640;
const HEIGHT = 300;
// A whole-number sprite scale keeps every unit pixel on the scene's own grid.
// 2.4 rounded each box independently, which left one-pixel steps in the
// silhouettes and made the units look resampled next to the map.
const SCALE = 2;
const POSITIONS = [{ x: 140, y: 178 }, { x: 420, y: 178 }];
// Where each side's shots land. The attacker stands on the left facing right,
// so its rounds strike the defender's leading edge, and vice versa.
const HIT_X = { attacker: 188, defender: 452 };
const HIT_Y = 214;
const WEAPONS = {
  infantry: { kind: "burst", x: 34, y: 18, recoil: 2 },
  mech: { kind: "rocket", x: 36, y: 16, recoil: 3 },
  recon: { kind: "burst", x: 35, y: 22, recoil: 2 },
  tank: { kind: "shell", x: 38, y: 13, recoil: 4 },
  heavy: { kind: "heavy", x: 38, y: 15, recoil: 6 },
  artillery: { kind: "arc", x: 35, y: 7, recoil: 5 },
  rocket: { kind: "salvo", x: 25, y: 10, recoil: 3 },
};

function box(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(0, Math.round(w)), Math.max(0, Math.round(h)));
}
function label(ctx, value, x, y, color, align = "left", size = 10) {
  // The headless review raster has no text API. Skipping the army/terrain
  // captions keeps the generated PNG honest about what it can show instead of
  // faking glyphs.
  if (typeof ctx.fillText !== "function") return;
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px ui-monospace, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const ease = (n) => n * n * (3 - 2 * n);
const palette = (owner) => PALETTES[((owner || 0) % PALETTES.length + PALETTES.length) % PALETTES.length];

function tree(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  box(ctx, 14, 31, 7, 26, "#685e43");
  box(ctx, 16, 33, 3, 21, "#9b8660");
  box(ctx, 3, 20, 29, 18, "#284f45");
  box(ctx, 7, 8, 27, 27, "#386d52");
  box(ctx, 12, 2, 18, 22, "#4b805a");
  box(ctx, 17, 0, 10, 8, "#71a06a");
  box(ctx, 5, 27, 8, 7, "#5a8f62");
  box(ctx, 23, 12, 7, 5, "#699867");
  ctx.restore();
}
function house(ctx, x, y, owner, variant = 0) {
  const p = palette(owner);
  box(ctx, x + 2, y + 15, 52, 51, "#596e64");
  box(ctx, x + 5, y + 17, 46, 46, "#cfcbb0");
  box(ctx, x + 1, y + 12, 54, 8, "#455e59");
  box(ctx, x + 5, y + 9, 46, 8, p[2]);
  box(ctx, x + 10, y + 8, 34, 4, p[0]);
  if (variant % 3 === 1) {
    box(ctx, x + 14, y + 2, 12, 10, "#798778");
    box(ctx, x + 15, y + 1, 11, 3, "#c7c8aa");
  }
  for (const wx of [x + 12, x + 36]) {
    box(ctx, wx, y + 27, 9, 15, "#375350");
    box(ctx, wx + 2, y + 29, 5, 10, "#a9bdad");
  }
  box(ctx, x + 25, y + 45, 9, 18, "#445d57");
  box(ctx, x + 26, y + 46, 7, 17, "#758a79");
  box(ctx, x + 6, y + 61, 45, 3, "#e5d8b5");
}
function headquarters(ctx, ox, owner) {
  const p = palette(owner);
  box(ctx, ox, 30, 320, 142, "#879b83");
  box(ctx, ox, 172, 320, 100, "#88977f");
  box(ctx, ox, 186, 320, 86, "#a6a98c");
  for (let x = ox + 23; x < ox + 320; x += 57) box(ctx, x, 239, 25, 3, "#d7d3aa");
  box(ctx, ox + 48, 80, 224, 84, "#3f5854");
  box(ctx, ox + 54, 86, 212, 74, "#aaaf95");
  box(ctx, ox + 45, 72, 230, 17, "#2c4846");
  box(ctx, ox + 53, 69, 214, 11, p[2]);
  box(ctx, ox + 60, 72, 199, 4, p[0]);
  box(ctx, ox + 126, 52, 68, 30, "#344e4d");
  box(ctx, ox + 132, 56, 56, 21, "#b8bba0");
  for (const x of [139, 168]) box(ctx, ox + x, 60, 13, 10, "#34524f");
  box(ctx, ox + 149, 48, 22, 6, p[1]);
  box(ctx, ox + 155, 88, 10, 21, "#d9c78d");
  box(ctx, ox + 148, 95, 24, 7, "#f9e6aa");
  box(ctx, ox + 151, 92, 18, 13, "#f9e6aa");
  box(ctx, ox + 155, 96, 10, 5, p[2]);
  box(ctx, ox + 127, 115, 66, 45, "#324a49");
  box(ctx, ox + 131, 119, 58, 41, "#60736a");
  box(ctx, ox + 158, 120, 4, 40, "#263f3e");
  for (let y = 126; y < 158; y += 8) box(ctx, ox + 134, y, 52, 2, "#91a194");
  for (const x of [ox + 73, ox + 220]) {
    box(ctx, x, 103, 27, 21, "#344e4e");
    box(ctx, x + 3, 106, 21, 15, "#879f97");
    box(ctx, x + 6, 110, 15, 6, "#2b4c4f");
    box(ctx, x - 2, 128, 31, 7, "#6e7d70");
  }
  box(ctx, ox + 242, 36, 4, 42, "#374f4c");
  box(ctx, ox + 230, 40, 28, 3, "#d5d8ba");
  box(ctx, ox + 234, 37, 20, 2, "#d5d8ba");
  box(ctx, ox + 245, 32, 3, 11, "#e5e4c8");
  box(ctx, ox + 69, 45, 3, 28, "#35554b");
  box(ctx, ox + 72, 47, 25, 13, p[1]);
  box(ctx, ox + 73, 49, 18, 5, p[0]);
  for (const x of [ox + 10, ox + 277]) {
    box(ctx, x, 102, 31, 61, "#53665d");
    box(ctx, x + 4, 108, 23, 48, "#a9ad91");
    box(ctx, x - 3, 96, 37, 10, "#384f4b");
    box(ctx, x + 8, 120, 15, 7, "#2e4c4b");
    box(ctx, x + 8, 137, 15, 7, "#2e4c4b");
  }
  box(ctx, ox, 159, 113, 18, "#798674");
  box(ctx, ox + 207, 159, 113, 18, "#798674");
  for (const x of [ox + 18, ox + 48, ox + 272, ox + 302]) {
    box(ctx, x, 171, 18, 7, "#b9b294");
    box(ctx, x + 2, 168, 14, 4, "#d0c59d");
  }
}
function buildingZone(ctx, ox, owner, type) {
  if (type === "hq") return headquarters(ctx, ox, owner);
  box(ctx, ox, 30, 320, 139, "#9eb195");
  box(ctx, ox, 160, 320, 19, "#b8b49a");
  box(ctx, ox, 175, 320, 4, "#ded4b0");
  box(ctx, ox, 179, 320, 93, "#aaa68c");
  box(ctx, ox, 184, 320, 82, "#b7b092");
  for (let x = ox + 19; x < ox + 320; x += 63) box(ctx, x, 238, 21, 2, "#e0d6ae");
  if (type === "factory") {
    for (const x of [ox + 27, ox + 116, ox + 205]) {
      box(ctx, x, 93, 75, 70, "#53685f");
      box(ctx, x + 4, 105, 67, 55, "#b5b6a0");
      box(ctx, x + 7, 93, 60, 13, palette(owner)[2]);
      box(ctx, x + 20, 123, 35, 37, "#52645c");
      for (const y of [127, 136, 145]) box(ctx, x + 23, y, 29, 3, "#a4b2a1");
      box(ctx, x + 61, 76, 9, 21, "#64776b");
    }
    for (const x of [ox + 15, ox + 269]) {
      box(ctx, x, 226, 27, 23, "#6d6a53");
      box(ctx, x + 3, 224, 21, 4, "#b6aa7f");
    }
  } else {
    [2, 65, 128, 191, 254].forEach((x, i) => house(ctx, ox + x, 97 - (i % 2) * 8, owner, i));
  }
}
function landscapeZone(ctx, ox, type) {
  box(ctx, ox, 30, 320, 242, "#7e9e72");
  box(ctx, ox, 30, 320, 64, "#a6bc9a");
  box(ctx, ox, 93, 320, 59, "#7c9c72");
  for (let x = ox + 8; x < ox + 320; x += 38) {
    box(ctx, x, 108 + (x % 3) * 5, 25, 5, "#6a9068");
    box(ctx, x + 7, 112 + (x % 3) * 5, 13, 2, "#91ac7e");
  }
  if (type === "forest") {
    [8, 45, 83, 121, 160, 199, 237, 277].forEach((x, i) => tree(ctx, ox + x, 91 + (i % 2) * 10, .9));
    box(ctx, ox + 76, 168, 168, 104, "#829e70");
    box(ctx, ox + 90, 186, 143, 68, "#93a477");
    tree(ctx, ox + 9, 177, 1.1);
    tree(ctx, ox + 272, 181, 1.08);
    for (const x of [72, 91, 225, 244]) {
      box(ctx, ox + x, 258, 7, 3, "#3b7254");
      box(ctx, ox + x + 2, 255, 5, 3, "#639265");
    }
  } else if (type === "road") {
    tree(ctx, ox + 23, 111, .8);
    tree(ctx, ox + 264, 109, .8);
    for (let y = 130; y < 188; y += 4) {
      const half = 13 + Math.floor((y - 130) * .6);
      box(ctx, ox + 160 - half, y, half * 2, 4, "#b5ad8d");
    }
    box(ctx, ox, 187, 320, 85, "#8d9780");
    box(ctx, ox, 192, 320, 78, "#b8b091");
    box(ctx, ox, 201, 320, 2, "#d1c8a5");
    for (let x = ox + 18; x < ox + 310; x += 57) box(ctx, x, 239, 25, 3, "#e4dbb7");
  } else if (type === "bridge") {
    box(ctx, ox, 149, 320, 123, "#598d9a");
    for (let x = ox + 10; x < ox + 320; x += 45) {
      box(ctx, x, 171, 26, 2, "#80b3b9");
      box(ctx, x + 9, 255, 29, 2, "#80b3b9");
    }
    box(ctx, ox, 182, 320, 9, "#626e6a");
    box(ctx, ox, 191, 320, 81, "#b6ae92");
    box(ctx, ox, 185, 320, 3, "#ece3bc");
    box(ctx, ox, 267, 320, 4, "#505b57");
    for (let x = ox + 17; x < ox + 320; x += 55) box(ctx, x, 237, 23, 3, "#e2d8ae");
  } else if (type === "mountain") {
    box(ctx, ox, 103, 320, 169, "#819477");
    for (const [x, y, w] of [[-13, 110, 92], [58, 75, 127], [185, 91, 129], [273, 118, 61]]) {
      box(ctx, ox + x, y + 23, w, 75, "#657d6f");
      box(ctx, ox + x + 11, y + 9, w - 20, 62, "#a8a78b");
      box(ctx, ox + x + 29, y, Math.max(16, w - 55), 25, "#dbd5b3");
    }
    box(ctx, ox + 69, 181, 182, 91, "#aaa98d");
    for (const x of [30, 72, 237, 279]) box(ctx, ox + x, 232, 17, 5, "#687d6c");
  } else if (type === "water") {
    box(ctx, ox, 126, 320, 146, "#5c929f");
    for (let x = ox + 16; x < ox + 320; x += 45) box(ctx, x, 190 + x % 23, 23, 2, "#92c3c0");
  } else {
    for (const x of [ox + 22, ox + 274]) tree(ctx, x, 135, .65);
    box(ctx, ox + 79, 182, 163, 90, "#8ca67a");
    for (let x = ox + 9; x < ox + 320; x += 26) box(ctx, x, 238 + x % 9, 6, 2, "#a4b88a");
  }
}
function ground(ctx, sides) {
  sides.forEach(({ terrain, unit }, side) => {
    const ox = side * 320;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, 30, 320, 244);
    ctx.clip();
    if (["city", "factory", "hq"].includes(terrain)) buildingZone(ctx, ox, unit.owner, terrain);
    else landscapeZone(ctx, ox, terrain);
    ctx.restore();
  });
  box(ctx, 318, 30, 4, 244, "#1f4038");
  box(ctx, 319, 30, 1, 244, "#b4c9a6");
  box(ctx, 0, 0, WIDTH, 30, "#1b3832");
  box(ctx, 0, 274, WIDTH, 26, "#1b3832");
}

function muzzlePosition(unit, side) {
  const weapon = WEAPONS[unit.type] || WEAPONS.tank;
  const pos = POSITIONS[side];
  return {
    x: pos.x + SCALE * (side === 0 ? weapon.x : 40 - weapon.x),
    y: pos.y + SCALE * weapon.y,
  };
}
function unitSprite(ctx, unit, side, time, hitAt, fireAt) {
  const weapon = WEAPONS[unit.type];
  const pos = POSITIONS[side];
  if (unit.hpAfter === 0 && time >= hitAt) {
    if (deathEffectKind(unit.type) === "fall")
      paintFallingSoldier(ctx, unit.type, palette(unit.owner), time - hitAt,
        pos.x, pos.y, SCALE, side === 1);
    return;
  }
  const firing = weapon && time >= fireAt && time < fireAt + 180;
  const struck = time >= hitAt && time < hitAt + 350;
  const recoil = firing ? (side === 0 ? -1 : 1) * Math.round(weapon.recoil * (1 - (time - fireAt) / 180)) : 0;
  // A two-frame white flash on the hit. `brightness` filters are a browser-side
  // approximation that does not survive nearest-neighbour upscaling, so the
  // flash is drawn as a silhouette overlay in the palette's own light tone.
  const flash = struck && Math.floor((time - hitAt) / 50) % 2 === 0;
  const shake = struck ? Math.round(Math.sin(time * .12) * 2) : 0;
  ctx.save();
  ctx.translate(pos.x + recoil + shake, pos.y);
  ctx.scale(SCALE, SCALE);
  box(ctx, 5, 30, 32, 3, "#193c3855");
  if (side === 1) {
    ctx.translate(40, 0);
    ctx.scale(-1, 1);
  }
  paintUnitMotion(ctx, unit.type, palette(unit.owner), { action: "idle", phase: 0 });
  if (flash) {
    ctx.globalCompositeOperation = "source-atop";
    box(ctx, 0, 0, 40, 40, "#fff6d8");
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();
}
function spark(ctx, x, y, size) {
  box(ctx, x - size, y - 2, size * 2, 4, "#f9d585");
  box(ctx, x - 2, y - size, 4, size * 2, "#fff0ac");
  box(ctx, x - 1, y - 1, 3, 3, "#fff9d8");
}
function projectile(ctx, kind, x, y, direction, number = 0) {
  if (kind === "burst") {
    box(ctx, x - direction * 14, y, 11, 2, "#ffe5a0");
    box(ctx, x, y, 5, 2, "#fff9d5");
  } else if (kind === "rocket" || kind === "salvo") {
    box(ctx, x - direction * 12, y + 1, 12, 3, "#e5a373");
    box(ctx, x - direction * 6, y, 11, 5, "#d9e0c4");
    box(ctx, x + direction * 3, y + 1, 4, 3, "#263e3c");
    if (number % 2 === 0) box(ctx, x - direction * 17, y, 4, 5, "#fff0ac");
  } else {
    box(ctx, x - direction * 16, y + 1, 9, 1, "#eac989");
    box(ctx, x - direction * 6, y, 7, 3, "#f8e0a0");
    box(ctx, x, y - 1, kind === "heavy" ? 9 : 6, kind === "heavy" ? 6 : 5, "#283e3c");
  }
}
function weaponFire(ctx, unit, side, time, fireAt, hitAt) {
  const weapon = WEAPONS[unit.type];
  if (!weapon || time < fireAt || time >= hitAt) return;
  const from = muzzlePosition(unit, side);
  const to = { x: side === 0 ? HIT_X.defender : HIT_X.attacker, y: HIT_Y };
  const direction = side === 0 ? 1 : -1;
  const age = time - fireAt;
  const burst = weapon.kind === "burst" || weapon.kind === "salvo";
  const count = burst ? 3 : 1;
  for (let i = 0; i < count; i++) {
    const launch = i * (weapon.kind === "salvo" ? 62 : 75);
    const shotAge = age - launch;
    if (shotAge >= 0 && shotAge < 85) spark(ctx, from.x, from.y + (i - 1) * 3, burst ? 4 : weapon.kind === "heavy" ? 10 : 7);
    const p = (shotAge - 40) / (hitAt - fireAt - launch - 40);
    if (p < 0 || p >= 1) continue;
    const eased = ease(clamp(p));
    const x = from.x + (to.x - from.x) * eased;
    const arc = weapon.kind === "arc" ? 86 : weapon.kind === "rocket" || weapon.kind === "salvo" ? 25 : 0;
    const y = from.y + (to.y - from.y) * eased - Math.sin(Math.PI * eased) * arc + (i - 1) * 5;
    projectile(ctx, weapon.kind, x, y, direction, i);
  }
}
function impact(ctx, x, y, age, kind) {
  if (age < 0 || age > 470) return;
  const p = age / 470;
  const power = ["heavy", "arc", "salvo"].includes(kind) ? 1.45 : ["burst"].includes(kind) ? .7 : 1;
  if (age < 145) {
    const r = Math.round((3 + age / 17) * power);
    box(ctx, x - r, y - 2, r * 2, 4, "#ffe6a0");
    box(ctx, x - 2, y - r, 4, r * 2, "#fff4bc");
    box(ctx, x - 3, y - 3, 6, 6, "#fff9d7");
  }
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7;
    const distance = (3 + p * (12 + i % 3 * 4)) * power;
    const color = age < 170 ? i % 2 ? "#fff1b2" : "#f0a66b" : "#6b7468";
    box(ctx, x + Math.cos(angle) * distance, y + Math.sin(angle) * distance - p * 5, 3 - Math.floor(p), 3 - Math.floor(p), color);
  }
  if (age > 120) {
    ctx.save();
    ctx.globalAlpha = 1 - clamp((age - 120) / 350);
    box(ctx, x - 9 - p * 4, y - 13 - p * 8, 8, 5, "#d8d2b6");
    box(ctx, x + 3 + p * 5, y - 8 - p * 11, 7, 4, "#7c8375");
    ctx.restore();
  }
}
function hpBar(ctx, x, y, n, owner) {
  box(ctx, x, y, 108, 16, "#1b3832");
  for (let i = 0; i < 10; i++) box(ctx, x + 3 + i * 7, y + 3, 5, 4, i < n ? palette(owner)[0] : "#4d6359");
  paintPixelText(ctx, `${n}/10`, x + 87, y + 5, {
    scale: 1,
    color: "#fff2d4",
    align: "center",
  });
}
function largeHp(ctx, n, x, align) {
  paintPixelText(ctx, String(n), x, 42, {
    scale: 9,
    color: "#fff9e8",
    outline: "#263b3c",
    align,
  });
}

// The same 640×300 camera is used for every army, unit type, and occupiable terrain.
export function paintCombatScene(ctx, battle) {
  const {
    attacker, defender, damage = 0, counter = 0,
    attackerTerrain = "plain", defenderTerrain = "plain", elapsed = 0,
  } = battle;
  const duration = combatDuration(counter);
  // `elapsed` is wall clock; the pose clock stops for a beat on each hit.
  const time = clamp(combatClock(clamp(elapsed, 0, duration)), 0, duration);
  const sides = [
    { unit: attacker, terrain: attackerTerrain },
    { unit: defender, terrain: defenderTerrain },
  ];
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.imageSmoothingEnabled = false;
  // Screen shake is a whole-scene offset applied once, so terrain, units and
  // effects move together; nudging individual sprites read as jitter.
  const shakeAt = (hitAt) => {
    const age = time - hitAt;
    if (age < 0 || age > 150) return 0;
    return Math.round((1 - age / 150) * 3) * (Math.floor(age / 32) % 2 ? 1 : -1);
  };
  const shake =
    shakeAt(COMBAT_TIMING.firstHit) + (counter > 0 ? shakeAt(COMBAT_TIMING.counterHit) : 0);
  ctx.save();
  ctx.translate(shake, 0);
  ground(ctx, sides);
  unitSprite(ctx, attacker, 0, time, COMBAT_TIMING.counterHit, COMBAT_TIMING.firstFire);
  unitSprite(ctx, defender, 1, time, COMBAT_TIMING.firstHit, counter > 0 ? COMBAT_TIMING.counterFire : Infinity);
  weaponFire(ctx, attacker, 0, time, COMBAT_TIMING.firstFire, COMBAT_TIMING.firstHit);
  if (counter > 0) weaponFire(ctx, defender, 1, time, COMBAT_TIMING.counterFire, COMBAT_TIMING.counterHit);
  impact(ctx, HIT_X.defender, HIT_Y, time - COMBAT_TIMING.firstHit, WEAPONS[attacker.type]?.kind);
  if (counter > 0) impact(ctx, HIT_X.attacker, HIT_Y, time - COMBAT_TIMING.counterHit, WEAPONS[defender.type]?.kind);
  if (defender.hpAfter === 0 && deathEffectKind(defender.type) === "blast")
    paintVehicleBlast(ctx, time - COMBAT_TIMING.firstHit, HIT_X.defender, HIT_Y);
  if (attacker.hpAfter === 0 && counter > 0 && deathEffectKind(attacker.type) === "blast")
    paintVehicleBlast(ctx, time - COMBAT_TIMING.counterHit, HIT_X.attacker, HIT_Y);
  if (damage && time >= COMBAT_TIMING.firstHit && time < COMBAT_TIMING.firstHit + 340)
    paintPixelText(ctx, `-${damage}`, HIT_X.defender + 18, HIT_Y - 52 - Math.floor((time - COMBAT_TIMING.firstHit) / 28) * 2, {
      scale: 3, color: "#fff0ad", outline: "#263b3c", align: "center",
    });
  if (counter && time >= COMBAT_TIMING.counterHit && time < COMBAT_TIMING.counterHit + 340)
    paintPixelText(ctx, `-${counter}`, HIT_X.attacker - 18, HIT_Y - 52 - Math.floor((time - COMBAT_TIMING.counterHit) / 28) * 2, {
      scale: 3, color: "#fff0ad", outline: "#263b3c", align: "center",
    });
  ctx.restore();
  const attackerHp = time >= COMBAT_TIMING.counterHit ? attacker.hpAfter : attacker.hp;
  const defenderHp = time >= COMBAT_TIMING.firstHit ? defender.hpAfter : defender.hp;
  largeHp(ctx, attackerHp, 287, "right");
  largeHp(ctx, defenderHp, 353, "left");
  label(ctx, `${ARMIES[attacker.owner] || "部队"} · ${UNITS[attacker.type]?.name || attacker.type} · ${TERRAINS[attackerTerrain]?.name || "平原"}`, 17, 16, palette(attacker.owner)[0], "left", 10);
  label(ctx, `${ARMIES[defender.owner] || "部队"} · ${UNITS[defender.type]?.name || defender.type} · ${TERRAINS[defenderTerrain]?.name || "平原"}`, 623, 16, palette(defender.owner)[0], "right", 10);
  hpBar(ctx, 16, 278, attackerHp, attacker.owner);
  hpBar(ctx, 516, 278, defenderHp, defender.owner);
}
