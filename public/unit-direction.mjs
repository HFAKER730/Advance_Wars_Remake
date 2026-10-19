import { paintUnitMotion, paintCaptureEffect } from "./unit-motion.mjs";

const ink = "#23383b";
const steel = "#718171";
const glass = "#a7c7b7";
function box(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
function poly(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

function walkingPerson(ctx, type, palette, direction, step) {
  const back = direction === "up";
  const sway = step % 6 < 3 ? -2 : 2;
  const bob = step % 3 === 1 ? -1 : 0;
  ctx.save();
  ctx.translate(0, bob);
  box(ctx, 13 + sway, 24, 6, 6, ink);
  box(ctx, 14 + sway, 25, 4, 4, "#52655a");
  box(ctx, 11 + sway, 29, 8, 3, ink);
  box(ctx, 21 - sway, 24, 6, 6, ink);
  box(ctx, 22 - sway, 25, 4, 4, "#718171");
  box(ctx, 21 - sway, 29, 8, 3, ink);
  box(ctx, 10, 14, 20, 11, ink);
  box(ctx, 12, 15, 16, 9, palette[1]);
  box(ctx, 12, 17, 4, 7, palette[2]);
  box(ctx, 24, 17, 4, 7, palette[2]);
  if (back) {
    box(ctx, 15, 15, 10, 10, ink);
    box(ctx, 16, 16, 8, 8, "#65755a");
    box(ctx, 17, 17, 6, 3, "#95a07c");
    box(ctx, 12, 5, 16, 7, ink);
    box(ctx, 14, 4, 12, 7, palette[1]);
    box(ctx, 16, 3, 8, 3, palette[0]);
    box(ctx, 12, 10, 16, 2, palette[3]);
    if (type === "mech") {
      box(ctx, 8, 11, 4, 16, ink);
      box(ctx, 9, 12, 2, 13, steel);
      box(ctx, 28, 12, 4, 15, ink);
      box(ctx, 29, 13, 2, 12, "#a8a980");
    } else {
      box(ctx, 28, 15, 3, 12, ink);
      box(ctx, 29, 13, 1, 4, steel);
    }
  } else {
    box(ctx, 17, 11, 6, 4, "#b78165");
    box(ctx, 15, 8, 10, 7, ink);
    box(ctx, 16, 9, 8, 5, "#e9bc91");
    box(ctx, 12, 4, 16, 6, ink);
    box(ctx, 14, 3, 12, 6, palette[1]);
    box(ctx, 16, 3, 8, 3, palette[0]);
    box(ctx, 12, 9, 16, 2, palette[3]);
    box(ctx, 15, 16, 3, 7, "#b8b591");
    box(ctx, 22, 16, 3, 7, "#b8b591");
    if (type === "mech") {
      box(ctx, 26, 11, 5, 19, ink);
      box(ctx, 27, 12, 3, 16, steel);
      box(ctx, 29, 26, 3, 3, "#a8a980");
      box(ctx, 8, 16, 4, 12, ink);
      box(ctx, 9, 17, 2, 9, "#a8a980");
    } else {
      box(ctx, 26, 17, 4, 13, ink);
      box(ctx, 27, 18, 2, 10, steel);
      box(ctx, 25, 27, 6, 2, "#946e4f");
    }
  }
  ctx.restore();
}

function tracks(ctx, palette, width, step) {
  const wide = width === "heavy";
  const l = wide ? 2 : 4, r = wide ? 38 : 36;
  poly(ctx, [[l+4,9],[l+9,11],[l+7,32],[l+1,34],[l-1,29],[l,14]],ink);
  poly(ctx, [[r-9,11],[r-4,9],[r,14],[r+1,29],[r-1,34],[r-7,32]],ink);
  poly(ctx, [[l+4,12],[l+7,13],[l+5,30],[l+2,31]],"#526761");
  poly(ctx, [[r-7,13],[r-4,12],[r-2,31],[r-5,30]],"#526761");
  for (let y = 14; y < 31; y += 5) {
    box(ctx,l+2,y+step%2,4,2,"#a2a994");
    box(ctx,r-6,y+step%2,4,2,"#a2a994");
  }
  poly(ctx,[[l+8,10],[r-8,10],[r-5,15],[r-4,29],[r-9,33],[l+9,33],[l+4,29],[l+5,15]],ink);
  poly(ctx,[[l+9,11],[r-9,11],[r-7,15],[r-6,27],[r-10,31],[l+10,31],[l+6,27],[l+7,15]],palette[2]);
  poly(ctx,[[l+10,11],[r-10,11],[r-8,16],[l+8,16]],palette[0]);
  poly(ctx,[[l+8,25],[r-8,25],[r-10,30],[l+10,30]],palette[1]);
}

function verticalArmor(ctx, type, palette, direction, step) {
  const up = direction === "up";
  tracks(ctx, palette, type === "heavy" ? "heavy" : "standard", step);
  poly(ctx,[[10,23],[14,27],[26,27],[30,23],[28,29],[23,32],[16,32],[12,29]],palette[3]);
  box(ctx,14,up?27:11,12,2,palette[0]);
  if (type === "apc") {
    poly(ctx,[[11,14],[18,10],[27,13],[30,22],[25,29],[14,28],[10,21]],ink);
    poly(ctx,[[12,15],[18,11],[26,14],[28,21],[24,26],[15,26],[11,20]],palette[1]);
    box(ctx,15,15,10,5,palette[3]);
    box(ctx,16,16,8,3,palette[0]);
    box(ctx, 17, 19, 6, 2, "#e7d6aa");
    box(ctx, 15, up ? 24 : 11, 10, 2, "#a7c0ac");
    box(ctx, 17, up ? 29 : 8, 6, 2, "#d4bb87");
    return;
  }
  const turretL=type==="heavy"?9:11,turretR=40-turretL;
  poly(ctx,[[turretL+3,13],[17,10],[24,10],[turretR-2,14],[turretR,21],[turretR-4,26],[turretL+4,26],[turretL,21]],ink);
  poly(ctx,[[turretL+4,14],[17,11],[24,11],[turretR-3,15],[turretR-2,20],[turretR-5,23],[turretL+5,23],[turretL+2,20]],palette[1]);
  poly(ctx,[[turretL+4,14],[18,11],[24,11],[turretR-4,15],[turretR-7,17],[turretL+7,17]],palette[0]);
  poly(ctx,[[turretL+3,20],[turretR-3,20],[turretR-5,24],[turretL+5,24]],palette[3]);
  box(ctx,16,13,8,4,palette[3]);
  box(ctx,17,13,6,2,"#b4b896");
  if (type === "artillery") {
    box(ctx,18,up?2:22,4,16,ink);
    box(ctx,19,up?3:23,2,14,"#d2ceaa");
    box(ctx,15,18,10,5,"#344d47");
  } else {
    const barrelW=type==="heavy"?6:4,barrelX=20-barrelW/2;
    box(ctx,barrelX,up?2:22,barrelW,16,ink);
    box(ctx,barrelX+1,up?3:23,barrelW-2,14,palette[2]);
    box(ctx,barrelX,up?2:36,barrelW,2,"#344a45");
  }
}

function wheels(ctx, ys, step) {
  for (const y of ys) for (const x of [5, 29]) {
    box(ctx, x, y, 6, 7, ink);
    box(ctx, x + 1, y + 1, 4, 5, "#6f817b");
    box(ctx, x + 2, y + 2 + step % 2, 2, 2, "#bec4aa");
  }
}

function verticalWheeled(ctx, type, palette, direction, step) {
  const up = direction === "up";
  wheels(ctx, type === "rocket" ? [8, 17, 26] : [11, 25], step);
  poly(ctx,[[13,7],[27,7],[31,13],[32,29],[28,34],[12,34],[8,29],[9,13]],ink);
  poly(ctx,[[14,8],[26,8],[29,14],[30,28],[27,32],[13,32],[10,28],[11,14]],palette[2]);
  poly(ctx,[[14,8],[26,8],[29,14],[11,14]],palette[0]);
  poly(ctx,[[11,26],[29,26],[27,32],[13,32]],palette[1]);
  const cabY=up?17:22;
  poly(ctx,[[13,cabY],[17,cabY-3],[24,cabY-3],[27,cabY],[27,cabY+7],[13,cabY+7]],palette[3]);
  poly(ctx,[[14,cabY+1],[17,cabY-2],[23,cabY-2],[26,cabY+1],[25,cabY+3],[15,cabY+3]],glass);
  box(ctx,13,up?9:29,14,2,palette[0]);
  if (type === "recon") {
    poly(ctx,[[12,up?8:27],[28,up?8:27],[27,up?15:32],[13,up?15:32]],palette[1]);
    box(ctx,16,up?10:29,8,2,palette[0]);
    box(ctx,12,up?9:30,3,2,"#e9dcaa");
    box(ctx,25,up?9:30,3,2,"#e9dcaa");
    box(ctx, 8, 4, 1, 11, ink);
    box(ctx, 8, 3, 1, 2, "#d7dfb9");
  } else {
    const rackY=up?18:8;
    poly(ctx,[[12,rackY],[16,rackY-2],[27,rackY],[29,rackY+12],[24,rackY+14],[11,rackY+12]],ink);
    poly(ctx,[[13,rackY+1],[16,rackY-1],[26,rackY+1],[27,rackY+11],[23,rackY+12],[12,rackY+11]],palette[2]);
    for (let row = 0; row < 3; row++)
      for (const x of [15, 20]) {
        const y = (up ? 21 : 11) + row * 3;
        box(ctx, x, y, 3, 2, "#c9ceac");
        box(ctx, x + 1, y, 1, 2, ink);
      }
  }
}

export function paintDirectionalMotion(ctx, type, palette, direction, phase = 0, action = "move") {
  if (direction === "right" || direction === "left") {
    ctx.save();
    if (direction === "left") {
      ctx.translate(40, 0);
      ctx.scale(-1, 1);
    }
    paintUnitMotion(ctx, type, palette, { action, phase });
    ctx.restore();
    return;
  }
  const step = action === "move"
    ? Math.floor(phase * (type === "infantry" || type === "mech" ? 6 : 8))
    : 0;
  ctx.save();
  if (action === "idle" && phase > .28 && phase < .58) ctx.translate(0, -1);
  if (action === "capture" && phase > .16 && phase < .72) ctx.translate(0, 2);
  if (action === "hit" && phase > .18 && phase < .46)
    ctx.filter = "brightness(1.9) saturate(.3)";
  if (type === "infantry" || type === "mech")
    walkingPerson(ctx, type, palette, direction, step);
  else if (type === "recon" || type === "rocket")
    verticalWheeled(ctx, type, palette, direction, step);
  else
    verticalArmor(ctx, type, palette, direction, step);
  ctx.restore();
  if (action === "attack" && phase > .3 && phase < .78) {
    const sign = direction === "up" ? -1 : 1;
    const originY = direction === "up" ? 3 : 36;
    const flight = (phase - .3) / .48;
    if (flight < .35) {
      box(ctx, 17, originY - 1, 7, 3, "#f7cf83");
      box(ctx, 19, originY - 4, 3, 9, "#fff0ae");
    }
    if (type === "rocket") {
      for (let i = 0; i < 3; i++) {
        const progress = flight * 3 - i;
        if (progress < 0 || progress > 1) continue;
        const y = originY + sign * Math.round(progress * 23);
        box(ctx, 14 + i * 4, y, 2, 6, "#d6dbba");
        box(ctx, 14 + i * 4, y - sign * 3, 2, 3, "#f7b76e");
      }
    } else if (type !== "recon") {
      const y = originY + sign * Math.round(flight * 18);
      box(ctx, 19, y, 3, type === "heavy" ? 7 : 5, "#d8d8be");
      box(ctx, 20, y - sign * 3, 1, 3, "#f7b76e");
    }
  } else if (action === "hit" && phase > .2 && phase < .75) {
    box(ctx, 26, 11, 8, 3, "#f7cf83");
    box(ctx, 29, 8, 3, 9, "#fff0ae");
  } else if (action === "supply" && type === "apc" && phase > .2 && phase < .85) {
    box(ctx, 14, 15, 12, 5, ink);
    box(ctx, 15, 14, 10, 3, palette[0]);
    box(ctx, 31, 12, 3, 10, "#d9f3bf");
    box(ctx, 28, 15, 9, 3, "#d9f3bf");
  } else if (action === "capture" && (type === "infantry" || type === "mech")) {
    paintCaptureEffect(ctx, palette, phase);
  } else if (action === "move") {
    box(ctx, 16, direction === "up" ? 33 : 5, 3, 2, "#c6c8ac");
    box(ctx, 23, direction === "up" ? 35 : 3, 2, 2, "#e3d8ad");
  }
}
