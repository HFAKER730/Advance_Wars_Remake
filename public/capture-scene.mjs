import { TEAM_PALETTES } from "./renderer.mjs";
import { paintUnitArtwork } from "./unit-art.mjs";
import { captureDuration } from "./shared/animation-timing.mjs";
export { captureDuration };

const ARMIES = ["赤焰军", "苍蓝军", "金叶军", "紫星军"];
const PROPERTY_NAMES = { city: "城市", factory: "工厂", hq: "总部" };
const spriteCache = new Map();
const clamp = (value) => Math.max(0, Math.min(1, value));

export function captureSceneState(capture, elapsed) {
  const progress = capture.progressBefore +
    (capture.progressAfter - capture.progressBefore) * clamp((elapsed - 1300) / 750);
  return {
    progress,
    owner: capture.completed && elapsed >= 2300 ? capture.unit.owner : capture.previousOwner,
    exitStart: capture.completed ? 2550 : 2150,
  };
}

function box(ctx, x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function palette(owner) {
  return owner == null
    ? ["#dedbb9", "#aeb8a0", "#74877b", "#3e5b54"]
    : TEAM_PALETTES[((owner % TEAM_PALETTES.length) + TEAM_PALETTES.length) % TEAM_PALETTES.length];
}

function sprite(type, owner) {
  const key = `${type}:${owner}`;
  if (!spriteCache.has(key)) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 40;
    paintUnitArtwork(canvas.getContext("2d"), type, palette(owner));
    spriteCache.set(key, canvas);
  }
  return spriteCache.get(key);
}

function backdrop(ctx, type) {
  box(ctx, 0, 0, 800, 450, "#a9c6b2");
  box(ctx, 0, 0, 800, 124, "#bed6ca");
  box(ctx, 0, 124, 800, 250, "#91b092");
  for (const [x, width, height] of [[8, 124, 132], [124, 80, 102], [210, 130, 114], [658, 125, 135], [760, 60, 116]]) {
    box(ctx, x, 374 - height, width, height, "#73967e");
    box(ctx, x + 9, 383 - height, width - 18, height - 9, "#8daa91");
    for (let wx = x + 20; wx < x + width - 12; wx += 33)
      box(ctx, wx, 412 - height, 12, 19, "#d4dfc3");
  }
  if (type === "hq") {
    box(ctx, 0, 342, 800, 33, "#829887");
    for (let x = 0; x < 800; x += 66) box(ctx, x, 337, 49, 8, "#788e7c");
  }
  box(ctx, 0, 384, 800, 66, "#b9b69a");
  box(ctx, 0, 390, 800, 6, "#d2cfad");
  for (let x = 24; x < 800; x += 116) box(ctx, x, 428, 48, 4, "#e8dfb7");
  box(ctx, 0, 375, 800, 10, "#7b9b7a");
}

function doorAmount(elapsed, exitStart) {
  if (elapsed < 430) return 0;
  if (elapsed < 780) return clamp((elapsed - 430) / 350);
  const exitEnd = exitStart + 650;
  if (elapsed < exitEnd) return 1;
  return 1 - clamp((elapsed - exitEnd) / 220);
}

function cityStructure(ctx, p) {
  const roof = p[1], light = p[0];
  box(ctx, 324, 112, 436, 278, "#3f5a51");
  box(ctx, 331, 119, 422, 269, "#d5d6b9");
  box(ctx, 324, 112, 436, 23, "#2c4c49");
  box(ctx, 330, 116, 425, 16, roof);
  box(ctx, 330, 116, 425, 5, light);
  box(ctx, 348, 136, 382, 27, "#afbaa0");
  box(ctx, 354, 139, 370, 17, "#d9d7b7");
  box(ctx, 345, 163, 15, 213, "#a2ad92");
  box(ctx, 733, 163, 15, 213, "#a2ad92");
  box(ctx, 325, 372, 434, 17, "#597469");
  box(ctx, 332, 374, 420, 7, "#e9dfb4");
  for (const x of [370, 445, 626, 691]) {
    box(ctx, x - 4, 191, 40, 74, "#536e66");
    box(ctx, x, 195, 32, 65, "#dce9d3");
    box(ctx, x + 13, 195, 5, 65, "#7e9c8f");
    box(ctx, x, 225, 32, 5, "#7e9c8f");
    box(ctx, x - 7, 260, 46, 7, "#8b9d89");
  }
}

function factoryStructure(ctx, p) {
  box(ctx, 290, 150, 480, 240, "#3c5552");
  box(ctx, 299, 160, 462, 224, "#b9c2b1");
  box(ctx, 290, 150, 480, 17, p[1]);
  box(ctx, 290, 150, 480, 5, p[0]);
  for (let x = 302; x <= 622; x += 80) {
    box(ctx, x, 124, 72, 27, "#3b5550");
    box(ctx, x + 6, 130, 60, 21, p[2]);
    box(ctx, x + 12, 135, 47, 13, "#a7c2b5");
  }
  box(ctx, 681, 76, 48, 75, "#566c62");
  box(ctx, 687, 82, 36, 69, "#8f9e8c");
  box(ctx, 674, 70, 62, 12, "#405950");
  box(ctx, 689, 53, 32, 14, "#adc0a9");
  box(ctx, 701, 40, 24, 10, "#c1d0b7");
  for (const x of [310, 457, 630]) box(ctx, x, 162, 12, 212, "#6e8275");
  box(ctx, 328, 210, 122, 170, "#3d5651");
  box(ctx, 336, 218, 106, 162, "#9cae9f");
  for (let y = 232; y < 378; y += 20) box(ctx, 336, y, 106, 5, "#607d71");
  box(ctx, 654, 213, 73, 61, "#405951");
  box(ctx, 661, 220, 59, 47, "#c3d7c0");
  box(ctx, 683, 220, 5, 47, "#6b8b7c");
  box(ctx, 290, 375, 480, 15, "#536c61");
  box(ctx, 329, 305, 121, 12, "#3b544b");
  for (let x = 336; x < 444; x += 25) box(ctx, x, 305, 12, 12, "#e4c274");
}

function headquartersStructure(ctx, p) {
  box(ctx, 288, 213, 486, 177, "#3a514d");
  box(ctx, 298, 223, 466, 160, "#aebaa7");
  for (const x of [290, 358, 426, 648, 716]) {
    box(ctx, x, 194, 54, 27, "#344d48");
    box(ctx, x + 7, 198, 40, 18, "#829889");
  }
  for (const x of [301, 676]) {
    box(ctx, x, 169, 85, 218, "#3b554f");
    box(ctx, x + 9, 184, 67, 193, "#bfc6ac");
    box(ctx, x - 7, 162, 99, 19, p[2]);
    box(ctx, x + 24, 235, 35, 44, "#38544e");
    box(ctx, x + 30, 242, 23, 32, "#718e7d");
  }
  box(ctx, 438, 83, 224, 308, "#344e49");
  box(ctx, 448, 96, 204, 288, "#d0d4b8");
  box(ctx, 430, 81, 240, 17, p[1]);
  box(ctx, 438, 81, 224, 5, p[0]);
  box(ctx, 460, 116, 180, 95, "#536f64");
  box(ctx, 468, 124, 164, 79, "#a9c5b5");
  for (const x of [478, 537, 596]) {
    box(ctx, x, 137, 27, 40, "#33534e");
    box(ctx, x + 5, 143, 17, 29, "#8fb5a7");
  }
  box(ctx, 471, 207, 158, 22, "#49645b");
  box(ctx, 458, 238, 173, 18, "#9aab99");
  box(ctx, 487, 225, 126, 165, "#3d5851");
  box(ctx, 684, 53, 5, 116, "#405e59");
  box(ctx, 661, 67, 51, 5, "#405e59");
  box(ctx, 669, 55, 35, 5, "#405e59");
  box(ctx, 675, 42, 23, 5, "#dbe7c5");
  box(ctx, 290, 375, 483, 15, "#526c60");
}

function building(ctx, capture, elapsed, state) {
  const p = palette(state.owner), type = capture.tile.type;
  if (type === "factory") factoryStructure(ctx, p);
  else if (type === "hq") headquartersStructure(ctx, p);
  else cityStructure(ctx, p);
  box(ctx, 487, 226, 126, 164, "#587067");
  box(ctx, 495, 234, 110, 156, "#d5d4ae");
  box(ctx, 501, 240, 98, 149, "#263e3b");
  box(ctx, 493, 384, 119, 7, "#e2d6ae");
  const open = doorAmount(elapsed, state.exitStart);
  box(ctx, 502 - 52 * open, 242, 48, 141, "#687b6b");
  box(ctx, 505 - 52 * open, 245, 42, 135, "#a6b094");
  box(ctx, 550 + 52 * open, 242, 48, 141, "#687b6b");
  box(ctx, 553 + 52 * open, 245, 42, 135, "#b9c09e");
  if (open < .25) {
    box(ctx, 544, 306, 4, 7, "#f2daa0");
    box(ctx, 553, 306, 4, 7, "#f2daa0");
  }
  if (elapsed >= 1300 && elapsed < (capture.completed ? 2300 : captureDuration(false))) {
    const y = type === "hq" ? 215 : type === "factory" ? 181 : 171;
    box(ctx, 337, y, 404, 6, "#456259");
    box(ctx, 337, y, 404 * state.progress / 20, 6, palette(capture.unit.owner)[0]);
  }
}

function flag(ctx, capture, elapsed, state) {
  const { x, top, bottom } = capture.tile.type === "factory"
    ? { x: 350, top: 83, bottom: 151 }
    : capture.tile.type === "hq"
      ? { x: 447, top: 22, bottom: 83 }
      : { x: 391, top: 58, bottom: 118 };
  box(ctx, x, top, 5, bottom - top, "#374f49");
  box(ctx, x + 5, top, 3, bottom - top, "#e5d3a9");
  let flagOwner = state.owner, y = top + 5;
  if (capture.completed && elapsed >= 2050 && elapsed < 2300) {
    flagOwner = capture.previousOwner;
    y += 24 * clamp((elapsed - 2050) / 250);
  } else if (capture.completed && elapsed >= 2300 && elapsed < 2600) {
    y += 24 * (1 - clamp((elapsed - 2300) / 300));
  }
  const p = palette(flagOwner);
  box(ctx, x + 8, y, 61, 33, "#2b4140");
  box(ctx, x + 11, y + 3, 55, 24, p[1]);
  box(ctx, x + 11, y + 3, 55, 8, p[0]);
}

function actor(ctx, capture, elapsed, state) {
  const art = sprite(capture.unit.type, capture.unit.owner), feet = 393;
  const draw = (x, clipped = false) => {
    ctx.save();
    if (clipped) {
      ctx.beginPath();
      ctx.rect(0, 0, 548, 450);
      ctx.clip();
    }
    ctx.drawImage(art, Math.round(x), feet - 120, 120, 120);
    ctx.restore();
  };
  if (elapsed < 650) {
    draw(66 + 310 * clamp(elapsed / 650));
  } else if (elapsed < 1300) {
    draw(376 + 160 * clamp((elapsed - 650) / 650), true);
  } else if (elapsed >= state.exitStart && elapsed < state.exitStart + 650) {
    draw(536 - 160 * clamp((elapsed - state.exitStart) / 650), true);
  } else if (elapsed >= state.exitStart + 650) {
    draw(376);
  }
}

function label(ctx, value, x, y, color) {
  ctx.font = "bold 20px system-ui, sans-serif";
  const width = Math.ceil(ctx.measureText(value).width) + 32;
  box(ctx, x, y, width, 38, "#19382f");
  box(ctx, x, y, 6, 38, color);
  ctx.fillStyle = "#f5f0dc";
  ctx.fillText(value, x + 18, y + 26);
}

export function captureSceneCaption(capture, elapsed) {
  if (elapsed < 650) return `${PROPERTY_NAMES[capture.tile.type]} · ${capture.unit.type === "mech" ? "机动步兵" : "步兵"}接近大门`;
  if (elapsed < 1300) return `${PROPERTY_NAMES[capture.tile.type]} · 进入建筑`;
  if (elapsed < 2050) return `占领进度 ${Math.round(captureSceneState(capture, elapsed).progress)}/20`;
  if (capture.completed && elapsed < 2600) return "占领完成 · 更换旗帜";
  if (elapsed < captureSceneState(capture, elapsed).exitStart + 650)
    return capture.completed ? "占领完成 · 部队返回" : `本次占领 ${capture.progressAfter}/20 · 下回合继续`;
  return capture.completed ? `${PROPERTY_NAMES[capture.tile.type]}已占领` : `进度 ${capture.progressAfter}/20 · 等待下一回合`;
}

export function paintCaptureScene(ctx, capture, elapsed) {
  const state = captureSceneState(capture, elapsed);
  ctx.imageSmoothingEnabled = false;
  backdrop(ctx, capture.tile.type);
  building(ctx, capture, elapsed, state);
  actor(ctx, capture, elapsed, state);
  flag(ctx, capture, elapsed, state);
  const owner = state.owner;
  label(ctx, `${owner == null ? "中立" : ARMIES[owner]}控制 · ${PROPERTY_NAMES[capture.tile.type]}`, 24, 21,
    owner == null ? "#b7c7b2" : palette(owner)[0]);
  label(ctx, capture.completed ? "完成占领" : "继续占领中", 24, 65, palette(capture.unit.owner)[0]);
  if (elapsed >= 1300 && elapsed < (capture.completed ? 2300 : captureDuration(false))) {
    const value = Math.round(state.progress);
    box(ctx, 447, 82, 211, 42, "#244239");
    box(ctx, 454, 89, 197, 7, "#48695b");
    box(ctx, 454, 89, 197 * value / 20, 7, palette(capture.unit.owner)[0]);
    ctx.fillStyle = "#f0efd7";
    ctx.font = "bold 17px system-ui, sans-serif";
    ctx.fillText(`占领进度 ${value}/20`, 467, 116);
  }
}
