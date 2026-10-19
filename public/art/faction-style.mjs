/**
 * Faction visual identity for Frontline Command.
 *
 * One shared silhhouette per unit class, four faction skins. A faction is a
 * coherent set of seven surface slots plus the material colours (metal, glass,
 * tent canvas, tire rubber) that the unit painters read. Slots are indexed so
 * existing art code keeps working:
 *
 *   0  paintLight    brightest mass, catches the top-left light
 *   1  paintMid      main upper surface
 *   2  paintDark     shadow mass, visible lower hull
 *   3  paintShade    deepest paint, armour edge
 *   4  accent        faction stripe / insignia colour
 *   5  metal         steel, treads, gun barrels
 *   6  wood          wooden furniture, crates, pole
 *
 * Invariant shared by all four skins: the hull slides left and down the
 * lightness ramp, so paintShade is always the darkest body colour and
 * paintLight never falls below the metal so armour never reads as
 * camouflage. `validateFactionStyles()` asserts these numeric relations and is
 * meant to run in the test suite once the skins are wired into the game.
 */

export const FACTIONS = ["red", "blue", "yellow", "green"];

export const FACTION_NAMES = ["红军", "蓝军", "黄军", "绿军"];

/** Slots a unit painter may read. Kept explicit so tests can check coverage. */
export const STYLE_SLOTS = [
  "paintLight",
  "paintMid",
  "paintDark",
  "paintShade",
  "accent",
  "metal",
  "wood",
];

/** Material colours that define a faction's industry, not shared neutrals. */
export const MATERIAL_SLOTS = [
  "metalDark",
  "metalLight",
  "treadLight",
  "glass",
  "canvas",
  "rubber",
  "tireHub",
];

/**
 * The four faction skins.
 *
 * red    — scarlet, copper, khaki. Round turrets, slab tracks, canvas cabins.
 * blue   — azure, blued steel. Boxy turrets, skirted tracks, cool grey steel.
 * yellow — ochre, brass, oak. Angular welded turrets, civilian road wheels.
 * green  — olive, patina, spruce. Casemate turrets, narrow high tracks.
 */
export const FACTION_STYLES = {
  red: {
    id: "red",
    name: "红军",
    codename: "赤焰军",
    descriptor: "暖色钢铁 · 铸造型炮塔 · 布篷舱盖",
    paintLight: "#f4a07d",
    paintMid: "#d3593f",
    paintDark: "#953026",
    paintShade: "#5e2020",
    accent: "#f6d68a",
    metal: "#8e897c",
    wood: "#a8763f",
    metalDark: "#20252e",
    metalLight: "#b5ab97",
    treadLight: "#a29a86",
    glass: "#a9c8bb",
    canvas: "#c9b183",
    rubber: "#24262b",
    tireHub: "#b0a99a",
  },
  blue: {
    id: "blue",
    name: "蓝军",
    codename: "苍蓝军",
    descriptor: "冷色钢铁 · 盒式炮塔 · 侧裙履带",
    paintLight: "#9ecde7",
    paintMid: "#3f93bc",
    paintDark: "#234e78",
    paintShade: "#1b2f4c",
    accent: "#d6ebf6",
    metal: "#8b929e",
    wood: "#8d7a58",
    metalDark: "#1d232b",
    metalLight: "#b3bac6",
    treadLight: "#98a1ac",
    glass: "#a9c9bd",
    canvas: "#9fb0b6",
    rubber: "#22252b",
    tireHub: "#aab2bd",
  },
  yellow: {
    id: "yellow",
    name: "黄军",
    codename: "金叶军",
    descriptor: "沙色装甲 · 棱角炮塔 · 民用附加轮",
    paintLight: "#f5ebc0",
    paintMid: "#d8b14a",
    paintDark: "#96702a",
    paintShade: "#4a3820",
    accent: "#4d4a35",
    metal: "#98917a",
    wood: "#a8763f",
    metalDark: "#242420",
    metalLight: "#bdb69c",
    treadLight: "#b0a88c",
    glass: "#a9c8bb",
    canvas: "#cdbd8c",
    rubber: "#27261f",
    tireHub: "#b6ae95",
  },
  green: {
    id: "green",
    name: "绿军",
    codename: "青枫军",
    descriptor: "橄榄装甲 · 固定战斗室 · 原野植被",
    paintLight: "#a9c493",
    paintMid: "#62805a",
    paintDark: "#3c5138",
    paintShade: "#27331f",
    accent: "#e2b663",
    metal: "#8a9184",
    wood: "#a8763f",
    metalDark: "#1f271f",
    metalLight: "#b0b8a4",
    treadLight: "#969e8c",
    glass: "#a9c8bb",
    canvas: "#b3c1a0",
    rubber: "#232720",
    tireHub: "#adb59f",
  },
};

/** Coverage: every slot a painter reads exists on every faction. */
export function styleCoverage() {
  const missing = [];
  for (const id of FACTIONS) {
    const style = FACTION_STYLES[id];
    for (const slot of [...STYLE_SLOTS, ...MATERIAL_SLOTS])
      if (typeof style[slot] !== "string") missing.push(`${id}.${slot}`);
    const legacy = [0, 1, 2, 3].map((i) => style[STYLE_SLOTS[i]]);
    if (legacy.some((value) => typeof value !== "string"))
      missing.push(`${id} legacy array`);
  }
  return missing;
}

/**
 * The legacy four-colour array the current painters index as p[0..3].
 * Keeps `paintUnitArtwork` and `paintDirectionalMotion` signatures intact.
 */
export function styleArray(styleOrId) {
  const style =
    typeof styleOrId === "string" ? FACTION_STYLES[styleOrId] : styleOrId;
  return [style.paintLight, style.paintMid, style.paintDark, style.paintShade];
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/** Rec. 601 relative luminance, 0–255 so it reads directly against the hex. */
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function contrastRatio(hexA, hexB) {
  const la = luminance(hexA) / 255;
  const lb = luminance(hexB) / 255;
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Structural assertions. Returns an array of human-readable problems; empty
 * means the skins obey the shared ramp rule.
 */
export function validateFactionStyles() {
  const problems = styleCoverage().map((slot) => `缺少颜色槽 ${slot}`);
  for (const id of FACTIONS) {
    const style = FACTION_STYLES[id];
    const ramp = STYLE_SLOTS.slice(0, 4).map((slot) => style[slot]);
    const l = ramp.map(luminance);
    for (let i = 1; i < l.length; i++)
      if (l[i] >= l[i - 1])
        problems.push(`${id}: 明度未严格递减 (${ramp[i - 1]} → ${ramp[i]})`);
    if (luminance(style.paintLight) < 140)
      problems.push(`${id}: 最亮漆色过暗，1× 下会与阴影混在一起`);
    if (contrastRatio(style.paintLight, style.paintShade) < 3)
      problems.push(`${id}: 亮暗对比不足，剪影会糊成一团`);
    for (const shared of ["#23383b", "#243b3c"])
      if (Object.values(style).includes(shared))
        problems.push(`${id}: 仍在复用中性深色 ${shared}，会削弱阵营识别`);
  }
  return problems;
}

/**
 * The four shared silhouettes and the variants that hang off each one. The
 * shared silhouette is what makes a unit readable as a class; the faction kit
 * is what makes it readable as an army.
 */
export const FAMILY_CATALOG = [
  {
    family: "foot",
    label: "士兵",
    variants: [
      { id: "infantry", label: "步兵" },
      { id: "mech", label: "机动步兵" },
    ],
  },
  {
    family: "land",
    label: "车辆",
    variants: [
      { id: "tank", label: "轻型坦克" },
      { id: "heavy", label: "重型坦克" },
      { id: "artillery", label: "自行火炮" },
      { id: "recon", label: "侦察车" },
      { id: "rocket", label: "火箭炮" },
      { id: "apc", label: "补给车" },
    ],
  },
  {
    family: "air",
    label: "飞机",
    variants: [
      { id: "fighter", label: "战斗机（固定翼）" },
      { id: "copter", label: "武装直升机（旋翼）" },
    ],
  },
  {
    family: "sea",
    label: "舰艇",
    variants: [
      { id: "patrol", label: "巡逻舰" },
      { id: "landing", label: "登陆舰" },
    ],
  },
];

export const SAMPLE_UNITS = FAMILY_CATALOG.flatMap((entry) =>
  entry.variants.map((variant) => ({
    ...variant,
    family: entry.family,
    familyLabel: entry.label,
  })),
);
