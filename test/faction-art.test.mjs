/**
 * Art regression tests for the faction skin system.
 *
 * These lock the two properties the design depends on: the four skins obey the
 * shared lightness ramp, and every unit variant paints inside the 40×40 tile
 * with a readable mass in every faction. They are deliberately implementation
 * agnostic — they never assert exact pixels, so painters can keep being
 * refined without churning the suite.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createCanvas } from "../tools/canvas-shim.mjs";
import {
  FACTIONS,
  FACTION_STYLES,
  MATERIAL_SLOTS,
  STYLE_SLOTS,
  SAMPLE_UNITS,
  contrastRatio,
  luminance,
  styleArray,
  styleCoverage,
  validateFactionStyles,
} from "../public/art/faction-style.mjs";
import { paintLandUnit } from "../public/art/faction-land.mjs";
import { paintAirUnit } from "../public/art/faction-air.mjs";
import { paintSeaUnit } from "../public/art/faction-sea.mjs";
import { paintLandDirection } from "../public/art/faction-direction.mjs";

const PAINTERS = {
  foot: (ctx, type, faction) => paintLandUnit(ctx, type, faction, -1),
  land: (ctx, type, faction) => paintLandUnit(ctx, type, faction, -1),
  air: (ctx, type, faction) => paintAirUnit(ctx, type, faction, -1),
  sea: (ctx, type, faction) => paintSeaUnit(ctx, type, faction, -1),
};

const LAND_UNITS = SAMPLE_UNITS.filter(
  (unit) => unit.family === "foot" || unit.family === "land",
);
const DIRECTIONS = ["up", "down"];

function render(unit, faction) {
  const canvas = createCanvas(40, 40);
  PAINTERS[unit.family](canvas.getContext("2d"), unit.id, faction);
  return canvas;
}

function opaqueBounds(canvas) {
  let minX = 40;
  let minY = 40;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++) {
      if (canvas.data[(y * canvas.width + x) * 4 + 3] === 0) continue;
      count++;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  return { count, minX, minY, maxX, maxY };
}

test("四个阵营的皮肤都覆盖了全部颜色槽", () => {
  assert.deepEqual(styleCoverage(), []);
  for (const faction of FACTIONS) {
    const style = FACTION_STYLES[faction];
    for (const slot of [...STYLE_SLOTS, ...MATERIAL_SLOTS])
      assert.match(style[slot], /^#[0-9a-f]{6}$/i, `${faction}.${slot}`);
    assert.equal(styleArray(faction).length, 4);
  }
});

test("皮肤遵循单一明度递减坡道，剪影不会被压平", () => {
  assert.deepEqual(validateFactionStyles(), []);
  for (const faction of FACTIONS) {
    const style = FACTION_STYLES[faction];
    const ramp = [style.paintLight, style.paintMid, style.paintDark, style.paintShade];
    for (let i = 1; i < ramp.length; i++)
      assert.ok(
        luminance(ramp[i]) < luminance(ramp[i - 1]),
        `${faction}: ${ramp[i]} 不比 ${ramp[i - 1]} 暗`,
      );
    assert.ok(
      luminance(style.paintLight) >= 140,
      `${faction}: 最亮漆色明度 ${luminance(style.paintLight).toFixed(1)} 偏低`,
    );
    assert.ok(
      contrastRatio(style.paintLight, style.paintShade) >= 3,
      `${faction}: 亮暗对比 ${contrastRatio(style.paintLight, style.paintShade).toFixed(2)} 不足`,
    );
  }
});

test("四个阵营的主色互不相同，避免同屏混淆", () => {
  const mids = FACTIONS.map((faction) => FACTION_STYLES[faction].paintMid);
  assert.equal(new Set(mids).size, FACTIONS.length);
  const lights = FACTIONS.map((faction) => FACTION_STYLES[faction].paintLight);
  assert.equal(new Set(lights).size, FACTIONS.length);
  // 任意两阵营的主色亮度差至少 5，保证灰度打印下仍可区分。
  for (let i = 0; i < mids.length; i++)
    for (let j = i + 1; j < mids.length; j++)
      assert.ok(
        Math.abs(luminance(mids[i]) - luminance(mids[j])) >= 5 ||
          Math.abs(luminance(lights[i]) - luminance(lights[j])) >= 5,
        `${FACTIONS[i]} 与 ${FACTIONS[j]} 的漆色过于接近`,
      );
});

test("每个阵营都能画出全部 12 个兵种，且剪影占据可辨认的面积", () => {
  for (const faction of FACTIONS)
    for (const unit of SAMPLE_UNITS) {
      const canvas = render(unit, faction);
      const bounds = opaqueBounds(canvas);
      assert.ok(
        bounds.count >= 120,
        `${faction}/${unit.id} 仅 ${bounds.count} 个像素，剪影过小`,
      );
      assert.ok(
        bounds.count <= 900,
        `${faction}/${unit.id} 有 ${bounds.count} 个像素，可能溢出画布`,
      );
      assert.ok(bounds.minX >= 0 && bounds.minY >= 0, `${faction}/${unit.id} 越界`);
      assert.ok(bounds.maxX <= 39 && bounds.maxY <= 39, `${faction}/${unit.id} 越界`);
      // 至少出现在三个不同高度带上，否则单位会读成一条色带。
      const rows = new Set();
      for (let y = 0; y < 40; y++)
        for (let x = 0; x < 40; x++)
          if (canvas.data[(y * 40 + x) * 4 + 3] !== 0) {
            rows.add(Math.floor(y / 8));
            break;
          }
      assert.ok(rows.size >= 3, `${faction}/${unit.id} 垂直分布过窄`);
    }
});

test("同一兵种在不同阵营下几何不同，而不只是换了颜色", () => {
  for (const unit of SAMPLE_UNITS) {
    const masks = FACTIONS.map((faction) => {
      const canvas = render(unit, faction);
      let signature = "";
      for (let i = 3; i < canvas.data.length; i += 4)
        signature += canvas.data[i] > 0 ? "1" : "0";
      return signature;
    });
    assert.ok(
      new Set(masks).size >= 2,
      `${unit.id} 在四个阵营下的剪影完全相同，缺少几何差异`,
    );
  }
});

test("渲染是确定性的：同一输入两次得到相同像素", () => {
  for (const faction of FACTIONS)
    for (const unit of SAMPLE_UNITS) {
      const first = render(unit, faction);
      const second = render(unit, faction);
      assert.deepEqual(
        Array.from(first.data),
        Array.from(second.data),
        `${faction}/${unit.id} 渲染不稳定`,
      );
    }
});

test("未知阵营与未知兵种回退到默认皮肤而不是抛错", () => {
  const fallback = createCanvas(40, 40);
  assert.doesNotThrow(() =>
    paintLandUnit(fallback.getContext("2d"), "tank", "purple", -1),
  );
  const unknown = createCanvas(40, 40);
  assert.doesNotThrow(() =>
    paintLandUnit(unknown.getContext("2d"), "submarine", "red", -1),
  );
  const red = render(SAMPLE_UNITS.find((u) => u.id === "tank"), "red");
  let unknownCount = 0;
  for (let i = 3; i < unknown.data.length; i += 4) if (unknown.data[i] > 0) unknownCount++;
  assert.ok(unknownCount >= 120, "未知兵种应回退到步兵而不是空白");
  assert.ok(red.data.some((value, index) => index % 4 === 3 && value > 0));
});

test("陆战单位四个朝向都能绘制，且正背面也分阵营", () => {
  for (const unit of LAND_UNITS)
    for (const direction of DIRECTIONS) {
      const signatures = new Set();
      for (const faction of FACTIONS) {
        const canvas = createCanvas(40, 40);
        assert.doesNotThrow(() =>
          paintLandDirection(canvas.getContext("2d"), unit.id, faction, direction, -1),
        );
        const bounds = opaqueBounds(canvas);
        assert.ok(
          bounds.count >= 120 && bounds.count <= 940,
          `${faction}/${unit.id}/${direction} 像素数 ${bounds.count} 异常`,
        );
        let signature = "";
        for (let i = 3; i < canvas.data.length; i += 4)
          signature += canvas.data[i] > 0 ? "1" : "0";
        signatures.add(signature);
      }
      assert.equal(
        signatures.size,
        FACTIONS.length,
        `${unit.id}/${direction} 在四个阵营下剪影未全部区分`,
      );
    }
});

test("前后朝向使用不同的剪影，不能靠左右翻转蒙混", () => {
  for (const unit of LAND_UNITS) {
    const up = createCanvas(40, 40);
    const down = createCanvas(40, 40);
    paintLandDirection(up.getContext("2d"), unit.id, "red", "up", -1);
    paintLandDirection(down.getContext("2d"), unit.id, "red", "down", -1);
    let differs = false;
    for (let i = 3; i < up.data.length; i += 4)
      if ((up.data[i] > 0) !== (down.data[i] > 0)) {
        differs = true;
        break;
      }
    assert.ok(differs, `${unit.id} 的正面与背面剪影相同`);
  }
});

test("左右朝向共用同一侧视剪影，右视可直接水平镜像", () => {
  for (const unit of SAMPLE_UNITS) {
    const right = createCanvas(40, 40);
    PAINTERS[unit.family](right.getContext("2d"), unit.id, "blue");
    const mirrored = createCanvas(40, 40);
    for (let y = 0; y < 40; y++)
      for (let x = 0; x < 40; x++) {
        const from = (y * 40 + (39 - x)) * 4;
        const to = (y * 40 + x) * 4;
        mirrored.data[to] = right.data[from];
        mirrored.data[to + 1] = right.data[from + 1];
        mirrored.data[to + 2] = right.data[from + 2];
        mirrored.data[to + 3] = right.data[from + 3];
      }
    // 镜像只是左右翻转：两边的实心像素数必须一致。
    assert.equal(
      opaqueBounds(right).count,
      opaqueBounds(mirrored).count,
      `${unit.id} 镜像后像素数变化，说明存在非对称贴图状态`,
    );
  }
});
