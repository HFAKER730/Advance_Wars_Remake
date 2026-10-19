import { paintUnitArtwork } from "./unit-art.mjs";

const people = new Set(["infantry", "mech"]);
const sprites = new Map();
const clamp = (n) => Math.max(0, Math.min(1, n));

export function deathEffectKind(type) {
  return people.has(type) ? "fall" : "blast";
}

function box(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(0, Math.round(w)), Math.max(0, Math.round(h)));
}

function spriteFor(type, palette) {
  const key = `${type}:${palette.join(":")}`;
  if (sprites.has(key)) return sprites.get(key);
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 40;
  paintUnitArtwork(sprite.getContext("2d"), type, palette);
  sprites.set(key, sprite);
  return sprite;
}

// x/y are the top-left corner of the same 40px unit used on the strategy map.
export function paintFallingSoldier(ctx, type, palette, age, x, y, scale = 1, flip = false) {
  if (deathEffectKind(type) !== "fall" || age < 0 || age >= 1450) return;
  const phase = clamp(age / 850);
  const turn = phase * phase * (3 - 2 * phase);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (flip) {
    ctx.translate(40, 0);
    ctx.scale(-1, 1);
  }
  ctx.globalAlpha = age > 1000 ? clamp(1 - (age - 1000) / 450) : 1;
  ctx.translate(15, 31);
  ctx.rotate(turn * 1.32);
  ctx.translate(-15, -31);
  ctx.drawImage(spriteFor(type, palette), 0, 0);
  ctx.restore();
  if (age < 620) {
    const spread = Math.round(age / 80);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    box(ctx, 5 - spread, 33 - Math.round(age / 200), 5, 2, "#e0d4ac");
    box(ctx, 29 + spread, 32 - Math.round(age / 250), 4, 2, "#c2bea0");
    ctx.restore();
  }
}

// cx/cy mark the vehicle's centre; scale keeps the blast proportional to its camera.
export function paintVehicleBlast(ctx, age, cx, cy, scale = 1) {
  if (age < 0 || age >= 1400) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  if (age < 440) {
    const radius = Math.round(7 + clamp(age / 230) * 24);
    const lobes = [[0, 0, 1], [-.65, -.12, .62], [.42, -.52, .68], [-.35, .55, .58], [.68, .32, .64]];
    for (const [dx, dy, size] of lobes) {
      const r = Math.round(radius * size), x = dx * radius, y = dy * radius;
      box(ctx, x - r, y - r, r * 2, r * 2, "#653f36");
      box(ctx, x - r + 3, y - r + 3, r * 2 - 6, r * 2 - 6, "#e87549");
      box(ctx, x - r + 8, y - r + 7, r * 2 - 16, r * 2 - 15, "#ffe3a1");
    }
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5;
      box(ctx, Math.cos(angle) * radius * 1.7, Math.sin(angle) * radius * 1.55,
        4 + i % 3, 4, i % 2 ? "#ffb16c" : "#ffe2a2");
    }
  } else {
    const progress = (age - 440) / 960;
    ctx.globalAlpha = 1 - progress;
    for (let i = 0; i < 6; i++) {
      const x = -37 + i * 14 + (i % 2 ? 1 : -1) * progress * 18;
      const y = -13 - i * 7 - progress * 42;
      box(ctx, x, y, 16, 9, i % 2 ? "#697870" : "#929789");
    }
  }
  ctx.restore();
}
