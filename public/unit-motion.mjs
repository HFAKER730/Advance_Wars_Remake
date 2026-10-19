import { paintUnitArtwork } from "./unit-art.mjs";

const sprites = new Map();
const infantry = new Set(["infantry", "mech"]);
const tracked = new Set(["tank", "heavy", "artillery", "apc"]);
const airborne = new Set(["fighter", "bomber", "heli"]);

function box(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function leg(ctx, x, knee, foot, shade) {
  box(ctx, x, 25, 5, 3, "#243b3c");
  box(ctx, x + 1, 26, 3, 2, shade);
  box(ctx, knee, 28, 4, 3, "#243b3c");
  box(ctx, knee + 1, 28, 2, 2, shade);
  box(ctx, foot, 31, 7, 2, "#243b3c");
  box(ctx, foot + 1, 31, 4, 1, "#83917a");
}

function sprite(type, palette, gait = -1) {
  const key = `${type}:${palette[0]}:${gait}`;
  if (sprites.has(key)) return sprites.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 40;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  paintUnitArtwork(ctx, type, palette);
  if (gait >= 0 && infantry.has(type)) {
    ctx.clearRect(10, 26, 20, 8);
    const steps = [
      [-2, 3, 1, -1], [0, 2, 2, -2], [2, 1, 4, -3],
      [2, -2, 3, -1], [0, -3, 1, 2], [-2, -1, -1, 3],
    ];
    const [near, far, nearFoot, farFoot] = steps[gait % 6];
    leg(ctx, 12, 12 + near, 10 + nearFoot, "#52655a");
    leg(ctx, 21, 21 + far, 22 + farFoot, "#718171");
    if (type === "mech") {
      const sway = gait < 3 ? 0 : 1;
      box(ctx, 8 + sway, 23 + (gait % 3 === 2 ? 1 : 0), 3, 3, "#64765d");
      box(ctx, 9 + sway, 24 + (gait % 3 === 2 ? 1 : 0), 1, 1, "#b8be97");
    }
  } else if (gait >= 0 && tracked.has(type)) {
    for (let x = 6; x < 27; x += 5)
      box(ctx, x + (gait % 2), 29, 2, 1, "#b7bba3");
  } else if (gait >= 0 && (type === "recon" || type === "rocket")) {
    for (const x of type === "recon" ? [8, 24] : [6, 14, 26])
      box(ctx, x + (gait % 2), 29, 2, 1, "#d1d4b0");
  } else if (gait >= 0 && airborne.has(type)) {
    // Flight bob: a one-pixel shadow shift reads as altitude at this scale.
    box(ctx, 8 + (gait % 3), 36, 24, 1, "rgba(24,45,42,.25)");
  } else if (gait >= 0 && (type === "destroyer" || type === "lander")) {
    // Wake behind the hull.
    box(ctx, 12 + (gait % 2), 34, 16, 1, "#a9cbd0");
    box(ctx, 15 - (gait % 2), 36, 10, 1, "#c4dde0");
  }
  sprites.set(key, canvas);
  return canvas;
}

function spark(ctx, x, y, size = 3) {
  box(ctx, x - size, y - 1, size * 2 + 1, 3, "#f7cf83");
  box(ctx, x - 1, y - size, 3, size * 2 + 1, "#fff0ae");
  box(ctx, x, y, 2, 2, "#fff9d6");
}

function smoke(ctx, x, y, progress) {
  ctx.globalAlpha = Math.max(0, 1 - progress);
  box(ctx, x + Math.round(progress * 7), y - Math.round(progress * 8), 4, 3, "#e4e1c0");
  ctx.globalAlpha = 1;
}

function attackEffect(ctx, type, phase) {
  if (phase < .3 || phase > .78) return;
  const fire = (phase - .3) / .48;
  const muzzle = {
    infantry: [34, 18], mech: [36, 16], recon: [35, 22],
    tank: [38, 13], heavy: [38, 15], artillery: [35, 7], rocket: [25, 10],
    bomber: [35, 20], destroyer: [27, 20],
  }[type];
  if (!muzzle) return;
  const [x, y] = muzzle;
  if (type === "bomber") {
    // Bomb falls away from the wing centre, with a trailing glare.
    if (fire < .18) spark(ctx, 20, 20, 3);
    const drop = Math.round(fire * 24);
    box(ctx, 19, 22 + drop, 3, 6, "#d6dbba");
    box(ctx, 20, 21 + drop, 1, 2, "#273f3d");
    box(ctx, 17, 27 + drop, 7, 1, "#f7b76e");
  } else if (type === "destroyer") {
    if (fire < .3) spark(ctx, x, y, 4);
    const px = x + Math.round(fire * 16);
    box(ctx, px - 5, y + 1, 5, 2, "#f5ac6b");
    box(ctx, px, y, 6, 3, "#d5d9bb");
    smoke(ctx, 14, 22, fire);
  } else if (type === "rocket") {
    for (let i = 0; i < 3; i++) {
      const flight = fire * 3 - i;
      if (flight < 0 || flight > 1) continue;
      const px = x + Math.round(flight * 30);
      const py = y - Math.round(flight * 15) + i * 4;
      box(ctx, px - 6, py + 1, 6, 2, "#f7b76e");
      box(ctx, px, py, 7, 3, "#d6dbba");
      box(ctx, px + 5, py, 2, 3, "#273f3d");
    }
    smoke(ctx, 18, 16, fire);
  } else if (type === "artillery") {
    if (fire < .3) spark(ctx, x, y, 4);
    box(ctx, x + Math.round(fire * 24), y - Math.round(fire * 16), 5, 3, "#344a45");
    smoke(ctx, x - 4, y + 4, fire);
  } else if (type === "mech") {
    if (fire < .25) spark(ctx, x, y, 3);
    const px = x + Math.round(fire * 25);
    box(ctx, px - 5, y + 1, 5, 2, "#f5ac6b");
    box(ctx, px, y, 7, 3, "#d5d9bb");
    smoke(ctx, 7, 18, fire);
  } else if (type === "recon") {
    if (Math.floor(fire * 6) % 2 === 0) spark(ctx, x, y, 2);
  } else {
    if (fire < .32) spark(ctx, x, y, type === "heavy" ? 6 : type === "tank" ? 4 : 2);
    if (type === "tank" || type === "heavy") {
      const px = x + Math.round(fire * 19);
      box(ctx, px, y + 1, 6, 2, "#d8d8be");
      box(ctx, px + 5, y, 2, 4, "#3b534d");
    } else if (type === "infantry" && fire < .55) {
      box(ctx, x + Math.round(fire * 15), y + 1, 5, 1, "#fff0bc");
    }
  }
}

function supplyEffect(ctx, palette, phase) {
  if (phase < .18 || phase > .9) return;
  const progress = (phase - .18) / .72;
  box(ctx, 13, 9, 13, 4, "#243b3c");
  box(ctx, 15, 8, 9, 3, palette[0]);
  box(ctx, 8, 17, 5, 9, palette[3]);
  const px = 31 + Math.round(progress * 22);
  const py = 23 - Math.round(Math.sin(progress * Math.PI) * 5);
  box(ctx, px, py, 8, 6, "#343f37");
  box(ctx, px + 1, py + 1, 6, 4, "#d6bd88");
  box(ctx, px + 3, py + 1, 2, 4, "#edf0d2");
  if (progress > .25) {
    const crewX = 7 - Math.round(Math.min(1, (progress - .25) * 2) * 10);
    box(ctx, crewX, 20, 4, 4, "#243b3c");
    box(ctx, crewX + 1, 20, 2, 2, "#e5bd90");
    box(ctx, crewX, 24, 4, 5, palette[1]);
    box(ctx, crewX, 29, 2, 3, "#263b3b");
    box(ctx, crewX + 3, 29, 2, 3, "#263b3b");
  }
  if (progress > .48) {
    box(ctx, 34, 4, 3, 9, "#d9f3bf");
    box(ctx, 31, 7, 9, 3, "#d9f3bf");
  }
}

export function paintCaptureEffect(ctx, palette, phase) {
  const raised = Math.max(0, Math.min(1, (phase - .12) / .44));
  const height = Math.round(24 * raised);
  if (!height) return;
  const top = 31 - height;
  // The soldier plants a pole, then unfurls the army flag over the building.
  box(ctx, 28, 22, 6, 3, "#243b3c");
  box(ctx, 30, 23, 4, 1, palette[0]);
  box(ctx, 33, top, 2, height + 1, "#273e3b");
  box(ctx, 34, top + 1, 1, Math.max(1, height - 2), "#d9d1a8");
  if (phase > .48) {
    const unfurl = Math.max(1, Math.round(Math.min(1, (phase - .48) / .2) * 12));
    box(ctx, 21, top + 2, unfurl, 7, "#243b3c");
    box(ctx, 22, top + 3, Math.max(1, unfurl - 2), 5, palette[1]);
    box(ctx, 22, top + 3, Math.max(1, unfurl - 3), 2, palette[0]);
  }
  if (phase > .72 && phase < .94) {
    box(ctx, 17, top + 1, 3, 1, "#fff3bc");
    box(ctx, 18, top, 1, 3, "#fff3bc");
  }
}

// Draws only the sprite and its action effects; the renderer owns HP and status badges.
export function paintUnitMotion(ctx, type, palette, motion = {}) {
  const { action = "idle", phase = 0, facing = 1 } = motion;
  const moving = action === "move";
  const gait = moving ? Math.floor(phase * (type === "mech" ? 6 : 8)) : -1;
  let dx = 0, dy = 0;
  if (moving) {
    dx = gait % 4 === 1 ? 1 : 0;
    dy = gait % 3 === 1 ? -1 : 0;
  } else if (action === "idle") {
    dy = phase > .28 && phase < .58 ? -1 : 0;
  } else if (action === "attack") {
    if (phase > .3 && phase < .55) {
      dx = type === "heavy" ? -3 : -2;
      dy = type === "mech" ? 1 : 0;
    }
  } else if (action === "hit") {
    if (phase > .18 && phase < .65) dx = Math.floor(phase * 14) % 2 ? -2 : 2;
  } else if (action === "capture") {
    if (phase > .16 && phase < .72) dy = 2;
  }
  ctx.save();
  if (facing < 0 && action === "attack") {
    ctx.translate(40, 0);
    ctx.scale(-1, 1);
  }
  ctx.translate(dx, dy);
  if (action === "hit" && phase > .18 && phase < .46)
    ctx.filter = "brightness(1.9) saturate(.3)";
  ctx.drawImage(sprite(type, palette, gait), 0, 0);
  ctx.filter = "none";
  if (moving) {
    for (let i = 0; i < 2; i++)
      box(ctx, 5 - i * 5, 32 + i % 2, 3, 2, i ? "#c6c8ac" : "#e3d8ad");
  } else if (action === "attack") {
    attackEffect(ctx, type, phase);
  } else if (action === "supply" && type === "apc") {
    supplyEffect(ctx, palette, phase);
  } else if (action === "capture" && infantry.has(type)) {
    paintCaptureEffect(ctx, palette, phase);
  } else if (action === "hit" && phase > .2 && phase < .75) {
    spark(ctx, 22, 13 - Math.round((phase - .2) * 5), 3);
  } else if (action === "idle") {
    if (type === "recon" && phase > .25 && phase < .62)
      box(ctx, 7, 8, 2, 2, "#e7edc6");
    else if (type === "apc" && phase > .25 && phase < .62)
      box(ctx, 15, 19, 2, 1, "#d8e7bb");
    else if (type === "heli" && phase < .7) {
      // Rotor sweep: the blades rotate through four positions as it hovers.
      const step = Math.floor(phase * 4) % 4;
      const sweep = [[0, 1], [1, 0], [0, 1], [1, 0]][step];
      box(ctx, 19, 6 + sweep[0] * 2, 3, 10, "rgba(185,200,189,.55)");
      box(ctx, 6 + sweep[1] * 2, 18, 28, 2, "rgba(185,200,189,.55)");
    } else if (airborne.has(type) && phase > .2 && phase < .8)
      box(ctx, 6, 34, 28, 1, "rgba(24,45,42,.18)");
    else if (!infantry.has(type) && !airborne.has(type) && phase > .2 && phase < .8)
      smoke(ctx, 5, 17, (phase - .2) / .6);
  }
  ctx.restore();
}
