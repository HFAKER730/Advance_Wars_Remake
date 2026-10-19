/** 前线指令 — deterministic, shared rules. No DOM, network, timers or randomness. */
/**
 * `vision` is the sight radius in tiles, measured as Manhattan distance from
 * the unit's own tile (so `vision: 2` covers its tile plus everything within
 * two steps). Recon units see furthest; indirect fire sees least.
 *
 * `category` is what the unit *is*, `targets` is what it may shoot at. Ground
 * forces cannot reach aircraft; fighters can only fight aircraft; bombers and
 * destroyers hit ground and ships. `produceAt` names the building that builds
 * it, and `fuelPerTurn` is deducted at the start of its owner's turn.
 */
export const UNITS = {
  infantry: {
    name: "步兵",
    cost: 1000,
    move: 3,
    minRange: 1,
    maxRange: 1,
    maxAmmo: null,
    maxFuel: 99,
    movement: "foot",
    vision: 2,
    category: "ground",
    targets: ["ground", "naval"],
    produceAt: "factory",
    fuelPerTurn: 0,
    capture: true,
    description: "廉价占领部队。可穿越山地，占领城市、工厂与总部。",
  },
  mech: {
    name: "机动步兵",
    cost: 3000,
    move: 2,
    minRange: 1,
    maxRange: 1,
    maxAmmo: 3,
    maxFuel: 70,
    movement: "foot",
    vision: 2,
    category: "ground",
    targets: ["ground", "naval"],
    produceAt: "factory",
    fuelPerTurn: 0,
    capture: true,
    description: "携带反装甲武器的步兵，可占领建筑、翻越山地。",
  },
  recon: {
    name: "侦察车",
    cost: 4000,
    move: 8,
    minRange: 1,
    maxRange: 1,
    maxAmmo: null,
    maxFuel: 80,
    movement: "wheel",
    vision: 5,
    category: "ground",
    targets: ["ground", "naval"],
    produceAt: "factory",
    fuelPerTurn: 0,
    description: "道路机动性极高，擅长压制步兵，但装甲薄弱。视野最远。",
  },
  tank: {
    name: "轻型坦克",
    cost: 7000,
    move: 6,
    minRange: 1,
    maxRange: 1,
    maxAmmo: 6,
    maxFuel: 70,
    movement: "track",
    vision: 3,
    category: "ground",
    targets: ["ground", "naval"],
    produceAt: "factory",
    fuelPerTurn: 0,
    description: "攻防均衡的直射主力，可在移动后攻击相邻敌人。",
  },
  heavy: {
    name: "重型坦克",
    cost: 16000,
    move: 4,
    minRange: 1,
    maxRange: 1,
    maxAmmo: 5,
    maxFuel: 50,
    movement: "track",
    vision: 2,
    category: "ground",
    targets: ["ground", "naval"],
    produceAt: "factory",
    fuelPerTurn: 0,
    description: "强大的反装甲火力与厚重装甲，代价是造价和机动性。",
  },
  artillery: {
    name: "自行火炮",
    cost: 6000,
    move: 5,
    minRange: 2,
    maxRange: 3,
    maxAmmo: 6,
    maxFuel: 50,
    movement: "track",
    vision: 1,
    category: "ground",
    targets: ["ground", "naval"],
    produceAt: "factory",
    fuelPerTurn: 0,
    indirect: true,
    description: "射程 2–3 格。攻击回合必须原地不动，无法反击。视野狭窄。",
  },
  rocket: {
    name: "火箭炮",
    cost: 15000,
    move: 5,
    minRange: 3,
    maxRange: 5,
    maxAmmo: 6,
    maxFuel: 50,
    movement: "wheel",
    vision: 1,
    category: "ground",
    targets: ["ground", "naval"],
    produceAt: "factory",
    fuelPerTurn: 0,
    indirect: true,
    description: "射程 3–5 格的远程重火力。移动后无法开火，无法反击。视野狭窄。",
  },
  apc: {
    name: "补给车",
    cost: 5000,
    move: 6,
    minRange: 0,
    maxRange: 0,
    maxAmmo: null,
    maxFuel: 80,
    movement: "track",
    vision: 1,
    category: "ground",
    targets: [],
    produceAt: "factory",
    fuelPerTurn: 0,
    description:
      "无武器。待机或补给时，为相邻友军补满燃料与弹药。不载兵。",
  },
  fighter: {
    name: "战斗机",
    cost: 18000,
    move: 9,
    minRange: 1,
    maxRange: 1,
    maxAmmo: 9,
    maxFuel: 40,
    movement: "air",
    vision: 4,
    category: "air",
    targets: ["air"],
    produceAt: "airport",
    fuelPerTurn: 2,
    description: "制空战机。只能攻击空中目标，对地无效。",
  },
  bomber: {
    name: "轰炸机",
    cost: 22000,
    move: 7,
    minRange: 1,
    maxRange: 1,
    maxAmmo: 9,
    maxFuel: 45,
    movement: "air",
    vision: 3,
    category: "air",
    targets: ["ground", "naval"],
    produceAt: "airport",
    fuelPerTurn: 2,
    description: "对地重锤。无法攻击空中目标，也没有反击能力。",
  },
  heli: {
    name: "运输直升机",
    cost: 6000,
    move: 6,
    minRange: 0,
    maxRange: 0,
    maxAmmo: null,
    maxFuel: 40,
    movement: "air",
    vision: 3,
    category: "air",
    targets: [],
    produceAt: "airport",
    fuelPerTurn: 2,
    capacity: 1,
    carry: ["infantry", "mech"],
    description: "空运步兵与机动步兵，一次载一支。无武器。",
  },
  destroyer: {
    name: "驱逐舰",
    cost: 18000,
    move: 6,
    minRange: 1,
    maxRange: 1,
    maxAmmo: 9,
    maxFuel: 60,
    movement: "naval",
    vision: 4,
    category: "naval",
    targets: ["ground", "naval"],
    produceAt: "port",
    fuelPerTurn: 1,
    description: "海上火力支援。炮击沿岸与舰船，打不到空中目标。",
  },
  lander: {
    name: "登陆舰",
    cost: 12000,
    move: 6,
    minRange: 0,
    maxRange: 0,
    maxAmmo: null,
    maxFuel: 60,
    movement: "naval",
    vision: 2,
    category: "naval",
    targets: [],
    produceAt: "port",
    fuelPerTurn: 1,
    capacity: 2,
    carry: ["ground"],
    description: "运载两支地面部队抢滩。无武器，自身不能上岸。",
  },
};
export const TERRAINS = {
  plain: {
    name: "平原",
    defense: 1,
    costs: { foot: 1, track: 1, wheel: 2, air: 1 },
  },
  road: {
    name: "道路",
    defense: 0,
    costs: { foot: 1, track: 1, wheel: 1, air: 1 },
  },
  forest: {
    name: "森林",
    defense: 2,
    costs: { foot: 1, track: 2, wheel: 3, air: 1 },
  },
  mountain: { name: "山地", defense: 4, costs: { foot: 2, air: 1 } },
  water: { name: "河流", defense: 0, costs: { air: 1 } },
  bridge: {
    name: "桥梁",
    defense: 0,
    costs: { foot: 1, track: 1, wheel: 1, air: 1 },
  },
  sea: { name: "海洋", defense: 0, costs: { naval: 1, air: 1 } },
  city: {
    name: "城市",
    defense: 3,
    income: 1000,
    costs: { foot: 1, track: 1, wheel: 1, air: 1 },
  },
  factory: {
    name: "工厂",
    defense: 3,
    income: 1000,
    costs: { foot: 1, track: 1, wheel: 1, air: 1 },
  },
  airport: {
    name: "机场",
    defense: 3,
    income: 1000,
    costs: { foot: 1, track: 1, wheel: 1, air: 1 },
  },
  port: {
    name: "港口",
    defense: 3,
    income: 1000,
    costs: { foot: 1, track: 1, wheel: 1, naval: 1, air: 1 },
  },
  hq: {
    name: "总部",
    defense: 4,
    income: 1000,
    costs: { foot: 1, track: 1, wheel: 1, air: 1 },
  },
};
export const COMMANDERS = {
  vanguard: {
    name: "林岚",
    title: "突击先锋",
    description: "全军攻击力常驻提升 10%。擅长快速突进，夺取战场主动权。",
    powerName: "疾风突击",
    superName: "破晓攻势",
    powerDescription: "本轮全军攻击力提升至 125%，移动力 +1。",
    superDescription: "本轮全军攻击力提升至 140%，移动力 +2。",
  },
  mechanic: {
    name: "周衡",
    title: "战地工程师",
    description: "全军防御力常驻提升 10%。维修与补给让部队持续作战。",
    powerName: "应急抢修",
    superName: "钢铁防线",
    powerDescription: "全军恢复 2 点生命，并补满弹药与燃料。",
    superDescription:
      "全军恢复 4 点生命并补满补给，本轮移动力 +1、防御力提升至 130%。",
  },
};
export const MAPS = [
  {
    id: "training",
    name: "晨曦平原",
    description: "紧凑平原与中央城市。适合熟悉占领、生产和兵种配合。",
    width: 14,
    height: 12,
    players: [2, 3, 4],
  },
  {
    id: "river",
    name: "双桥河谷",
    description: "双桥贯穿河谷，远程火力控制渡口，侧翼小路决定胜负。",
    width: 18,
    height: 14,
    players: [2, 3, 4],
  },
  {
    id: "crossroads",
    name: "十字要塞",
    description: "四角基地与中央工厂。多条战线适合混战或双人组队。",
    width: 18,
    height: 16,
    players: [2, 3, 4],
  },
  {
    id: "coast",
    name: "海峡对峙",
    description: "中央海峡把战场分成南北两岸，只有两座桥和舰队能过。两岸各有中立机场与港口。",
    width: 18,
    height: 14,
    players: [2, 3, 4],
  },
];
const DAMAGE = {
  infantry: {
    infantry: 55,
    mech: 45,
    recon: 15,
    tank: 8,
    heavy: 3,
    artillery: 20,
    rocket: 25,
    apc: 15,
    destroyer: 5,
    lander: 10,
  },
  mech: {
    infantry: 65,
    mech: 55,
    recon: 85,
    tank: 60,
    heavy: 30,
    artillery: 70,
    rocket: 80,
    apc: 75,
    destroyer: 45,
    lander: 60,
  },
  recon: {
    infantry: 75,
    mech: 65,
    recon: 35,
    tank: 15,
    heavy: 5,
    artillery: 45,
    rocket: 55,
    apc: 45,
    destroyer: 10,
    lander: 15,
  },
  tank: {
    infantry: 75,
    mech: 70,
    recon: 85,
    tank: 55,
    heavy: 25,
    artillery: 75,
    rocket: 85,
    apc: 75,
    destroyer: 25,
    lander: 35,
  },
  heavy: {
    infantry: 95,
    mech: 90,
    recon: 100,
    tank: 85,
    heavy: 55,
    artillery: 95,
    rocket: 100,
    apc: 100,
    destroyer: 55,
    lander: 70,
  },
  artillery: {
    infantry: 80,
    mech: 75,
    recon: 80,
    tank: 70,
    heavy: 45,
    artillery: 75,
    rocket: 85,
    apc: 80,
    destroyer: 40,
    lander: 55,
  },
  rocket: {
    infantry: 95,
    mech: 90,
    recon: 95,
    tank: 85,
    heavy: 65,
    artillery: 90,
    rocket: 90,
    apc: 95,
    destroyer: 55,
    lander: 70,
  },
  apc: {},
  fighter: { fighter: 55, bomber: 55, heli: 85 },
  bomber: {
    infantry: 90,
    mech: 85,
    recon: 95,
    tank: 85,
    heavy: 75,
    artillery: 85,
    rocket: 95,
    apc: 95,
    destroyer: 80,
    lander: 90,
  },
  heli: {},
  destroyer: {
    infantry: 75,
    mech: 70,
    recon: 80,
    tank: 65,
    heavy: 55,
    artillery: 70,
    rocket: 75,
    apc: 80,
    destroyer: 55,
    lander: 75,
    fighter: 0,
    bomber: 70,
    heli: 85,
  },
  lander: {},
};
const clone = (value) => structuredClone(value);
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const positionKey = (x, y) => `${x},${y}`;
const playerOf = (state, seat) => state.players.find((p) => p.id === seat);
const allied = (state, a, b) =>
  a != null &&
  b != null &&
  playerOf(state, a)?.team === playerOf(state, b)?.team;
const tileAt = (state, x, y) =>
  Number.isInteger(x) &&
  Number.isInteger(y) &&
  x >= 0 &&
  y >= 0 &&
  x < state.width &&
  y < state.height
    ? state.tiles[y * state.width + x]
    : null;
/** Units inside a transport share its tile but do not occupy the board. */
const onBoard = (unit) => unit.carriedBy == null;
const unitAt = (state, x, y) =>
  state.units.find((u) => onBoard(u) && u.x === x && u.y === y);
const cargoOf = (state, transport) =>
  (transport.cargo || [])
    .map((id) => state.units.find((u) => u.id === id))
    .filter(Boolean);
const capacityOf = (type) => UNITS[type].capacity ?? 0;
const canCarry = (transportType, cargoType) =>
  (UNITS[transportType].carry || []).some(
    (kind) => kind === cargoType || UNITS[cargoType].category === kind,
  );
const requireRule = (condition, message) => {
  if (!condition) throw new Error(message);
};
const property = (tile) => !!TERRAINS[tile.type]?.income;
/**
 * Fog-of-war log entries carry a `seat` so the projection can drop lines the
 * receiving player should not read. `null` means the line is public.
 */
function log(state, message, seat = null) {
  state.log.push(seat == null ? message : { seat, message });
  if (state.log.length > 70) state.log.splice(0, state.log.length - 70);
}
function movementBonus(player) {
  return player.commander === "vanguard"
    ? player.power === "super"
      ? 2
      : player.power === "power"
        ? 1
        : 0
    : player.power === "super"
      ? 1
      : 0;
}
function attackFactor(player) {
  return player.commander === "vanguard"
    ? player.power === "super"
      ? 1.4
      : player.power === "power"
        ? 1.25
        : 1.1
    : 1;
}
function defenseFactor(player) {
  return player.commander === "mechanic"
    ? player.power === "super"
      ? 1.3
      : 1.1
    : 1;
}
function newUnit(state, owner, type, x, y, acted = false) {
  const def = UNITS[type];
  return {
    id: `u${state.nextUnitId++}`,
    type,
    owner,
    x,
    y,
    hp: 10,
    ammo: def.maxAmmo,
    fuel: def.maxFuel,
    acted,
    cargo: capacityOf(type) ? [] : null,
    carriedBy: null,
  };
}
function resupply(unit) {
  unit.fuel = UNITS[unit.type].maxFuel;
  unit.ammo = UNITS[unit.type].maxAmmo;
}
function supplyNeighbors(state, supplier) {
  let count = 0;
  for (const u of state.units)
    if (
      onBoard(u) &&
      u.id !== supplier.id &&
      allied(state, supplier.owner, u.owner) &&
      manhattan(u, supplier) === 1
    ) {
      if (u.fuel < UNITS[u.type].maxFuel || u.ammo !== UNITS[u.type].maxAmmo)
        count++;
      resupply(u);
    }
  return count;
}
function generateTiles(map) {
  const { width, height, id } = map;
  const tiles = Array.from({ length: width * height }, (_, i) => ({
    x: i % width,
    y: Math.floor(i / width),
    type: "plain",
    owner: null,
    capture: 20,
    captureBy: null,
  }));
  const set = (x, y, type) => {
    if (x >= 0 && y >= 0 && x < width && y < height)
      tiles[y * width + x].type = type;
  };
  const midX = Math.floor(width / 2),
    midY = Math.floor(height / 2);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if ((x * 13 + y * 7) % 19 < 3) set(x, y, "forest");
      if ((x * 7 + y * 11) % 37 === 2 && x > 3 && x < width - 4)
        set(x, y, "mountain");
    }
  for (let x = 1; x < width - 1; x++) {
    set(x, 3, "road");
    set(x, height - 4, "road");
  }
  for (let y = 1; y < height - 1; y++) {
    set(3, y, "road");
    set(width - 4, y, "road");
  }
  if (id === "river") {
    for (let y = 0; y < height; y++) set(midX, y, "water");
    set(midX, 3, "bridge");
    set(midX, height - 4, "bridge");
    set(midX - 2, 5, "city");
    set(midX + 2, height - 6, "city");
    set(midX - 2, height - 5, "forest");
    set(midX + 2, 4, "forest");
    set(midX - 1, midY, "city");
    set(midX + 1, midY - 1, "city");
    // River banks get cities, not quays: the contract keeps hulls out of
    // rivers, so a port here would only build a ship that can never leave.
    set(midX - 1, 6, "city");
    set(midX + 1, height - 7, "city");
    set(midX - 1, height - 6, "city");
    set(midX + 1, 5, "city");
    // Neutral airfields on the two flanks, away from the bridges.
    set(1, height - 3, "airport");
    set(width - 2, 2, "airport");
  } else if (id === "coast") {
    // A wide bay bites into the middle of the board. Land units can walk around
    // both flanks, so the water is an advantage rather than a wall; the two
    // quays and the island city give the navy a reason to exist.
    const left = 4,
      right = width - 5, // 13
      top = 5,
      bottom = 9;
    for (let x = left; x <= right; x++)
      for (let y = top; y <= bottom; y++) set(x, y, "sea");
    // A lone island with the only forward city, reachable by air or sea.
    set(midX, midY, "city");
    set(midX - 2, midY, "sea");
    set(midX + 2, midY, "sea");
    // Quays on all four shores, so every seat has one within reach.
    set(midX - 3, top - 1, "port");
    set(midX + 2, bottom + 1, "port");
    set(left - 1, bottom - 1, "port");
    set(right + 1, top + 2, "port");
    // Neutral airfields near the flanking land routes, on dry ground clear of
    // the existing cities at (5,3) and (12,10).
    set(1, midY + 2, "airport");
    set(width - 2, midY - 2, "airport");
  } else {
    for (let x = 3; x <= width - 4; x++) set(x, midY, "road");
    for (let y = 3; y <= height - 4; y++) set(midX, y, "road");
    set(midX - 1, midY - 1, id === "crossroads" ? "factory" : "city");
    set(midX + 1, midY + 1, "city");
    set(midX - 2, midY + 1, "forest");
    // Neutral airfields on the quiet flanks, so every map can field aircraft.
    set(2, height - 3, "airport");
    set(width - 3, 2, "airport");
  }
  set(5, 3, "city");
  set(width - 6, height - 4, "city");
  set(3, midY, "city");
  set(width - 4, midY - 1, "city");
  return tiles;
}
export function createGame({
  mapId = "river",
  fog = false,
  players = [
    {
      id: 0,
      name: "红方",
      team: 0,
      commander: "vanguard",
      controller: "human",
    },
    { id: 1, name: "蓝方", team: 1, commander: "mechanic", controller: "ai" },
  ],
} = {}) {
  const map = MAPS.find((m) => m.id === mapId);
  requireRule(map, "地图不存在");
  requireRule(
    Array.isArray(players) && players.length >= 2 && players.length <= 4,
    "需要 2 至 4 名玩家",
  );
  requireRule(
    new Set(players.map((p) => p.id)).size === players.length,
    "玩家编号不能重复",
  );
  requireRule(
    players.every(
      (p) =>
        Number.isInteger(p.id) &&
        p.id >= 0 &&
        p.id < 4 &&
        Object.hasOwn(COMMANDERS, p.commander || "vanguard") &&
        ["human", "ai"].includes(p.controller || "human"),
    ),
    "玩家配置无效",
  );
  const state = {
    version: 1,
    mapId,
    fog: !!fog,
    width: map.width,
    height: map.height,
    tiles: generateTiles(map),
    units: [],
    players: players.map((p) => ({
      id: p.id,
      name: String(p.name || `玩家 ${p.id + 1}`).slice(0, 24),
      team: p.team ?? p.id,
      commander: p.commander || "vanguard",
      controller: p.controller || "human",
      funds: 5000,
      energy: 0,
      power: null,
      defeated: false,
    })),
    currentPlayer: players[0].id,
    day: 1,
    turn: 1,
    phase: "playing",
    winner: null,
    log: [],
    nextUnitId: 1,
  };
  requireRule(
    new Set(state.players.map((p) => p.team)).size > 1,
    "至少需要两个不同队伍",
  );
  const corners = [
    { x: 1, y: 1, dx: 1, dy: 1 },
    { x: map.width - 2, y: map.height - 2, dx: -1, dy: -1 },
    { x: map.width - 2, y: 1, dx: -1, dy: 1 },
    { x: 1, y: map.height - 2, dx: 1, dy: -1 },
  ];
  state.players.forEach((p, index) => {
    const { x, y, dx, dy } = corners[index];
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        tileAt(state, x + a * dx, y + b * dy).type = "plain";
    [
      [0, 0, "hq"],
      [1, 0, "factory"],
      [0, 1, "city"],
      // A home airfield keeps the new air arm playable from turn one.
      [2, 1, "airport"],
    ].forEach(([a, b, type]) => {
      const t = tileAt(state, x + a * dx, y + b * dy);
      t.type = type;
      t.owner = p.id;
    });
    [
      [0, 2, "infantry"],
      [2, 0, "infantry"],
      [1, 1, "tank"],
      [2, 2, "recon"],
    ].forEach(([a, b, type]) =>
      state.units.push(newUnit(state, p.id, type, x + a * dx, y + b * dy)),
    );
  });
  // Each seat also gets the quay nearest its corner, so a naval map can be
  // played without first marching across the board to capture one.
  const ports = state.tiles.filter((t) => t.type === "port" && t.owner == null);
  const claimed = new Set();
  state.players.forEach((p, index) => {
    const { x, y } = corners[index];
    const nearest = ports
      .filter((t) => !claimed.has(`${t.x},${t.y}`))
      .sort(
        (a, b) =>
          Math.abs(a.x - x) + Math.abs(a.y - y) -
          (Math.abs(b.x - x) + Math.abs(b.y - y)),
      )[0];
    if (!nearest) return;
    claimed.add(`${nearest.x},${nearest.y}`);
    nearest.owner = p.id;
  });
  beginTurn(state, true);
  log(state, `${map.name}：占领敌军总部，或击败所有敌对队伍。`);
  validateState(state);
  return state;
}
/**
 * Shortest legal routes. Allied tiles can be crossed, but never used as
 * destinations. Air units fly over everything, so units — friend or foe — do
 * not block their path; only the destination has to be free.
 */
export function reachable(state, unitId) {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || !onBoard(unit)) return [];
  const def = UNITS[unit.type];
  const limit = Math.min(
    def.move + movementBonus(playerOf(state, unit.owner)),
    unit.fuel,
  );
  const occupied = new Map(
    state.units.filter(onBoard).map((u) => [positionKey(u.x, u.y), u]),
  );
  const first = {
    x: unit.x,
    y: unit.y,
    cost: 0,
    path: [{ x: unit.x, y: unit.y }],
  };
  const queue = [first],
    best = new Map([[positionKey(unit.x, unit.y), first]]);
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift();
    if (best.get(positionKey(current.x, current.y)) !== current) continue;
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const x = current.x + dx,
        y = current.y + dy,
        tile = tileAt(state, x, y);
      if (!tile) continue;
      const occupant = occupied.get(positionKey(x, y));
      if (
        occupant &&
        def.movement !== "air" &&
        !allied(state, unit.owner, occupant.owner)
      )
        continue;
      const step = TERRAINS[tile.type].costs[def.movement];
      if (step == null) continue;
      const cost = current.cost + step,
        key = positionKey(x, y);
      if (cost > limit || (best.has(key) && best.get(key).cost <= cost))
        continue;
      const next = { x, y, cost, path: [...current.path, { x, y }] };
      best.set(key, next);
      queue.push(next);
    }
  }
    return [...best.values()].filter((cell) => {
      const u = occupied.get(positionKey(cell.x, cell.y));
      if (u && u.id !== unit.id) return false;
      const tile = tileAt(state, cell.x, cell.y);
      // Non-capture units cannot stand on an enemy HQ (see the rule in
      // `applyAction`); keep them out of the movement range too so the client
      // never offers a destination the server would reject.
      if (!def.capture && tile.type === "hq" && !allied(state, unit.owner, tile.owner))
        return false;
      // Ground units cannot shoot aircraft, so a plane parked on a capturable
      // building would make that objective permanently uncapturable. Aircraft
      // may fly over properties but may only *stop* on a friendly airfield,
      // which is also where they refit.
      if (def.movement === "air" && property(tile))
        return (
          tile.type === "airport" && allied(state, unit.owner, tile.owner)
        );
      return true;
    });
}
/**
 * Capture legality, shared by the server rule check and the client command list.
 * `seat` is the acting seat, `unit` the capturing unit, and `x,y` its destination.
 */
export function canCapture(state, seat, unit, x, y) {
  const tile = tileAt(state, x, y);
  return (
    !!unit &&
    unit.owner === seat &&
    !!UNITS[unit.type]?.capture &&
    !!tile &&
    property(tile) &&
    !allied(state, seat, tile.owner)
  );
}
/**
 * Fog of war. Vision is a plain Manhattan radius with no line-of-sight
 * occlusion; forests and other concealing terrain hide the units standing in
 * them without blocking sight beyond.
 *
 * `visibleTiles` answers "which tiles can this seat see". A tile is visible
 * when some allied unit covers it. Teams share vision, so a 2v2 team sees the
 * union of both players' units.
 */
export function visibleTiles(state, seat) {
  const seen = new Set();
  if (!state.fog) {
    for (const tile of state.tiles) seen.add(positionKey(tile.x, tile.y));
    return seen;
  }
  for (const unit of state.units) {
    if (!onBoard(unit) || !allied(state, seat, unit.owner)) continue;
    const radius = UNITS[unit.type].vision;
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > radius) continue;
        const x = unit.x + dx,
          y = unit.y + dy;
        if (tileAt(state, x, y)) seen.add(positionKey(x, y));
      }
  }
  return seen;
}
/** Terrain that hides a unit standing on it from non-adjacent observers. */
const CONCEALING = new Set(["forest", "mountain"]);
/**
 * Air units fly above concealing terrain. Ground and naval units can hide in
 * forests and mountains; a transport's cargo is never listed separately.
 */
const isConcealable = (unit) => UNITS[unit.type].movement !== "air";
/**
 * Whether `seat` may see `unit`. Own units are always visible. Enemies are
 * visible inside vision range, except when concealed and nobody is adjacent.
 */
export function seesUnit(state, seat, unit, seen = null) {
  if (!state.fog) return true;
  if (allied(state, seat, unit.owner)) return true;
  const tile = tileAt(state, unit.x, unit.y);
  // An enemy standing inside a building our team owns is always spotted: the
  // garrison reports it. Without this rule a player could not tell why a
  // production order was refused, and the AI would keep ordering into an
  // occupied pad it cannot see.
  if (tile && property(tile) && allied(state, seat, tile.owner)) return true;
  const vision = seen ?? visibleTiles(state, seat);
  if (!vision.has(positionKey(unit.x, unit.y))) return false;
  if (!isConcealable(unit)) return true;
  if (!tile || !CONCEALING.has(tile.type)) return true;
  return state.units.some(
    (spotter) =>
      onBoard(spotter) &&
      allied(state, seat, spotter.owner) &&
      manhattan(spotter, unit) === 1,
  );
}
/**
 * The state one seat is allowed to know. With fog off this is the state itself
 * (no copy). With fog on it drops hidden units, privates every other player's
 * finances, hides capture progress on tiles without vision, and filters the log.
 *
 * Terrain and property ownership stay visible, matching the source genre: fog
 * conceals units, not the map. Units that leave vision simply disappear —
 * there is no last-known-position ghost, and this is a snapshot, not a delta.
 */
export function projectState(state, seat) {
  if (!state.fog) return state;
  const seen = visibleTiles(state, seat);
  const projected = clone(state);
  projected.units = projected.units.filter((unit) =>
    seesUnit(state, seat, unit, seen),
  );
  // Cargo shares its transport's tile, so it is projected as a unit; prune any
  // dangling id rather than let a hidden unit be named by a visible transport.
  const kept = new Set(projected.units.map((unit) => unit.id));
  for (const unit of projected.units)
    if (unit.cargo) unit.cargo = unit.cargo.filter((id) => kept.has(id));
  projected.players = projected.players.map((player) =>
    player.id === seat || allied(state, seat, player.id)
      ? player
      : { ...player, funds: null, energy: null },
  );
  projected.tiles = projected.tiles.map((tile) =>
    seen.has(positionKey(tile.x, tile.y))
      ? tile
      : { ...tile, capture: 20, captureBy: null },
  );
  projected.log = projected.log
    .filter(
      (entry) =>
        entry == null ||
        typeof entry === "string" ||
        allied(state, seat, entry.seat),
    )
    .map((entry) => (entry && typeof entry === "object" ? entry.message : entry));
  return projected;
}
/** True when the tile hides its occupant from this seat's point of view. */
export function isFoggedTile(state, seat, x, y) {
  if (!state.fog) return false;
  return !visibleTiles(state, seat).has(positionKey(x, y));
}
export function attackable(state, unitId, from) {
  const unit = state.units.find((u) => u.id === unitId);
  if (
    !unit ||
    !onBoard(unit) ||
    UNITS[unit.type].maxRange === 0 ||
    unit.ammo === 0
  )
    return [];
  const def = UNITS[unit.type],
    origin = from || unit;
  if (
    !tileAt(state, origin.x, origin.y) ||
    (def.indirect && manhattan(unit, origin) > 0)
  )
    return [];
  return state.units
    .filter(
      (enemy) =>
        onBoard(enemy) &&
        !allied(state, unit.owner, enemy.owner) &&
        def.targets.includes(UNITS[enemy.type].category) &&
        manhattan(origin, enemy) >= def.minRange &&
        manhattan(origin, enemy) <= def.maxRange,
    )
    .map((u) => u.id);
}
function damage(state, attacker, defender, defenderTile, hp = attacker.hp) {
  const base = DAMAGE[attacker.type][defender.type] || 0;
  if (
    !base ||
    attacker.ammo === 0 ||
    hp <= 0 ||
    !UNITS[attacker.type].targets.includes(UNITS[defender.type].category)
  )
    return 0;
  // Aircraft are above the terrain: cover stars do not apply to them.
  const stars =
    UNITS[defender.type].movement === "air" ? 0 : TERRAINS[defenderTile.type].defense;
  const terrainReduction = 1 - (stars * defender.hp) / 100;
  return Math.min(
    defender.hp,
    Math.max(
      1,
      Math.round(
        ((((base / 10) * hp) / 10) *
          attackFactor(playerOf(state, attacker.owner)) *
          terrainReduction) /
          defenseFactor(playerOf(state, defender.owner)),
      ),
    ),
  );
}
export function previewCombat(state, attackerId, defenderId, from) {
  const attacker = state.units.find((u) => u.id === attackerId),
    defender = state.units.find((u) => u.id === defenderId);
  if (
    !attacker ||
    !defender ||
    !attackable(state, attackerId, from).includes(defenderId)
  )
    return { damage: 0, counter: 0 };
  const origin = from || attacker;
  const dealt = damage(
    state,
    attacker,
    defender,
    tileAt(state, defender.x, defender.y),
  );
  const survivingDefender = { ...defender, hp: defender.hp - dealt };
  const counter =
    survivingDefender.hp > 0 &&
    !UNITS[defender.type].indirect &&
    UNITS[defender.type].maxRange > 0 &&
    UNITS[defender.type].targets.includes(UNITS[attacker.type].category) &&
    manhattan(origin, defender) === 1
      ? damage(
          state,
          survivingDefender,
          attacker,
          tileAt(state, origin.x, origin.y),
        )
      : 0;
  return { damage: dealt, counter };
}
function resetCaptures(state) {
  for (const tile of state.tiles)
    if (tile.capture < 20) {
      const occupant = unitAt(state, tile.x, tile.y);
      if (
        !occupant ||
        occupant.owner !== tile.captureBy ||
        !UNITS[occupant.type].capture
      ) {
        tile.capture = 20;
        tile.captureBy = null;
      }
    }
}
/** War machines that cannot reach a repair pad still cost fuel every turn. */
function burnFuel(state, player) {
  const upkeepTypes = new Set(
    Object.entries(UNITS)
      .filter(([, def]) => (def.fuelPerTurn || 0) > 0)
      .map(([type]) => type),
  );
  for (const unit of state.units.filter(
    (u) => u.owner === player.id && onBoard(u),
  )) {
    const upkeep = UNITS[unit.type].fuelPerTurn || 0;
    if (!upkeep) continue;
    unit.fuel = Math.max(0, unit.fuel - upkeep);
  }
  // Only vehicles with an upkeep die when dry; a ground unit at 0 fuel is
  // simply stuck until it is resupplied.
  const stranded = state.units.filter(
    (u) =>
      u.owner === player.id &&
      onBoard(u) &&
      upkeepTypes.has(u.type) &&
      u.fuel === 0,
  );
  if (!stranded.length) return;
  const names = stranded.map((u) => UNITS[u.type].name).join("、");
  state.units = state.units.filter((u) => !stranded.includes(u));
  log(state, `${player.name}的${names}燃料耗尽，已退出战场。`);
}
function defeat(state, seat) {
  const player = playerOf(state, seat);
  if (!player || player.defeated) return;
  player.defeated = true;
  player.power = null;
  state.units = state.units.filter((u) => u.owner !== seat);
  for (const tile of state.tiles)
    if (tile.owner === seat) {
      tile.owner = null;
      tile.capture = 20;
      tile.captureBy = null;
    }
  log(state, `${player.name} 已退出战场。`);
}
/** A production site is any building that can build one of its owner's units. */
const productionSites = (state, seat) =>
  state.tiles.filter(
    (t) =>
      t.owner === seat &&
      Object.values(UNITS).some((def) => def.produceAt === t.type),
  );
function checkVictory(state) {
  for (const p of state.players) {
    if (p.defeated) continue;
    const hasUnits = state.units.some((u) => u.owner === p.id);
    // A production site only counts while the owner can use it. An enemy parked
    // on the last airfield or factory would otherwise keep a unitless seat alive
    // forever, because that seat can neither build nor fight.
    const canBuild = productionSites(state, p.id).some((tile) => {
      const occupant = unitAt(state, tile.x, tile.y);
      return !occupant || occupant.owner === p.id;
    });
    if (!hasUnits && !canBuild) defeat(state, p.id);
  }
  const teams = [
    ...new Set(state.players.filter((p) => !p.defeated).map((p) => p.team)),
  ];
  if (teams.length <= 1) {
    state.phase = "finished";
    state.winner = teams[0] ?? null;
    log(
      state,
      teams.length
        ? `${state.players
            .filter((p) => !p.defeated)
            .map((p) => p.name)
            .join("、")} 获得胜利！`
        : "战斗结束。",
    );
  }
}
function beginTurn(state, initial = false) {
  const p = playerOf(state, state.currentPlayer);
  p.power = null;
  const income = state.tiles
    .filter((t) => t.owner === p.id && property(t))
    .reduce((sum, t) => sum + TERRAINS[t.type].income, 0);
  p.funds += income;
  for (const u of state.units.filter((u) => u.owner === p.id && onBoard(u))) {
    u.acted = false;
    const tile = tileAt(state, u.x, u.y);
    // Aircraft can only be turned around at an airfield; ground and naval
    // units use any friendly property. Without this, a plane parked on a
    // captured city would refuel forever and could never be dislodged.
    const canRefit =
      property(tile) &&
      allied(state, p.id, tile.owner) &&
      (UNITS[u.type].movement !== "air" || tile.type === "airport");
    if (canRefit) {
      resupply(u);
      const hpCost = UNITS[u.type].cost / 10;
      const healed = Math.min(2, 10 - u.hp, Math.floor(p.funds / hpCost));
      u.hp += healed;
      p.funds -= healed * hpCost;
    }
  }
  // Upkeep runs after refuelling, so a unit parked on a supply source survives
  // even when it arrives with exactly one turn of fuel left.
  burnFuel(state, p);
  for (const u of state.units.filter(
    (u) => u.owner === p.id && u.type === "apc" && onBoard(u),
  ))
    supplyNeighbors(state, u);
  // 收入金额会泄漏对方据点数量，迷雾下只对本人可见。
  if (state.fog) {
    log(
      state,
      `${initial ? "作战开始" : `第 ${state.day} 天`} · ${p.name} 行动，收入 +${income}。`,
      p.id,
    );
    log(state, `${initial ? "作战开始" : `第 ${state.day} 天`} · ${p.name} 行动。`);
  } else
    log(
      state,
      `${initial ? "作战开始" : `第 ${state.day} 天`} · ${p.name} 行动，收入 +${income}。`,
    );
}
function nextTurn(state) {
  checkVictory(state);
  if (state.phase !== "playing") return;
  const oldIndex = state.players.findIndex((p) => p.id === state.currentPlayer);
  let newIndex = oldIndex;
  do {
    newIndex = (newIndex + 1) % state.players.length;
  } while (state.players[newIndex].defeated);
  if (newIndex <= oldIndex) state.day++;
  state.currentPlayer = state.players[newIndex].id;
  state.turn++;
  beginTurn(state);
}
function gainEnergy(player, hpDamage, unitType) {
  if (!player.power)
    player.energy = Math.min(
      100,
      player.energy +
        Math.max(2, Math.ceil((hpDamage * UNITS[unitType].cost) / 1800)),
    );
}
export function applyAction(original, seat, action) {
  requireRule(original?.phase === "playing", "对局已经结束");
  requireRule(
    action && typeof action === "object" && !Array.isArray(action),
    "行动格式无效",
  );
  const originalPlayer = playerOf(original, seat);
  requireRule(originalPlayer && !originalPlayer.defeated, "玩家不存在或已战败");
  requireRule(original.currentPlayer === seat, "尚未轮到你行动");
  const state = clone(original),
    player = playerOf(state, seat);
  /** In fog games, private lines go only to the seats involved in the event. */
  const privateLog = (message, ...seats) => {
    if (!state.fog) log(state, message);
    else for (const owner of new Set(seats)) log(state, message, owner);
  };
  if (action.type === "endTurn") {
    nextTurn(state);
    return state;
  }
  if (action.type === "surrender") {
    defeat(state, seat);
    resetCaptures(state);
    nextTurn(state);
    return state;
  }
  if (action.type === "power") {
    requireRule(
      action.level === "power" || action.level === "super",
      "能力类型无效",
    );
    const cost = action.level === "super" ? 100 : 50;
    requireRule(!player.power, "本轮已经发动过指挥官能力");
    requireRule(player.energy >= cost, "指挥官能量不足");
    player.energy -= cost;
    player.power = action.level;
    if (player.commander === "mechanic")
      for (const u of state.units.filter(
        (u) => u.owner === seat && onBoard(u),
      )) {
        u.hp = Math.min(10, u.hp + (action.level === "super" ? 4 : 2));
        resupply(u);
      }
    log(
      state,
      `${player.name} 发动「${COMMANDERS[player.commander][action.level === "super" ? "superName" : "powerName"]}」！`,
    );
    return state;
  }
  if (action.type === "build") {
    const def = UNITS[action.unitType],
      tile = tileAt(state, action.x, action.y);
    requireRule(Object.hasOwn(UNITS, action.unitType), "兵种不存在");
    requireRule(
      tile && tile.owner === seat && tile.type === def.produceAt,
      `${TERRAINS[tile?.type]?.name ?? "这里"}不能生产${def.name}，只能在己方${TERRAINS[def.produceAt].name}生产`,
    );
    requireRule(!unitAt(state, tile.x, tile.y), "生产设施已被单位占用");
    requireRule(player.funds >= def.cost, "资金不足");
    player.funds -= def.cost;
    state.units.push(
      newUnit(state, seat, action.unitType, tile.x, tile.y, true),
    );
    privateLog(`${player.name} 生产了${def.name}。`, seat);
    return state;
  }
  requireRule(action.type === "move", "未知行动");
  const unit = state.units.find((u) => u.id === action.unitId);
  requireRule(unit && unit.owner === seat, "只能指挥己方单位");
  requireRule(onBoard(unit), "被运输的单位不能单独行动");
  requireRule(!unit.acted, "该单位已经行动");
  requireRule(
    ["wait", "capture", "attack", "supply", "load", "unload", "join"].includes(
      action.command,
    ),
    "不支持此单位指令",
  );
  if (action.command === "load") return loadCargo(state, seat, unit, action);
  if (action.command === "unload") return unloadCargo(state, seat, unit, action);
  if (action.command === "join") return joinUnits(state, seat, unit, action);
  // Under fog the seat's whole world is the projection, so both the route it can
  // draw and the targets it can name are computed there. Rebuilding the same
  // route on the server is what keeps the two sides agreeing: a hidden unit does
  // not steer the march, it ambushes it.
  const view = state.fog ? projectState(state, seat) : state;
  const routes = reachable(view, unit.id);
  let destination = routes.find(
    (cell) => cell.x === action.x && cell.y === action.y,
  );
  let ambushed = null;
  if (state.fog) {
    const path = destination?.path ?? [];
    // Enemies are absent from the projection's route, so any enemy standing on
    // it is exactly the one that was hidden.
    const blockerAt = path.findIndex((step) =>
      state.units.some(
        (u) =>
          onBoard(u) &&
          u.id !== unit.id &&
          u.x === step.x &&
          u.y === step.y &&
          !allied(state, unit.owner, u.owner),
      ),
    );
    if (blockerAt > 0) {
      // 碰撞点之前可能被友军占着，那是合法的过路格却不能当落点，所以沿路径往回
      // 找最后一个真正可停留的格子；全被占满时只能停在原地。
      const stop = path
        .slice(0, blockerAt)
        .reverse()
        .find((step) =>
          routes.some((cell) => cell.x === step.x && cell.y === step.y),
        );
      destination = routes.find(
        (cell) => cell.x === (stop ?? unit).x && cell.y === (stop ?? unit).y,
      );
      ambushed = unitAt(state, path[blockerAt].x, path[blockerAt].y);
    }
  }
  requireRule(destination, "目标格无法到达");
  const moved = unit.x !== destination.x || unit.y !== destination.y;
  const def = UNITS[unit.type];
  // 遭遇埋伏会改变落点，原先的占领/攻击目标不再成立，只结算移动本身。
  const command = ambushed ? "wait" : action.command;
  if (command === "attack") {
    requireRule(!def.indirect || !moved, "间接火力移动后不能攻击");
    requireRule(
      attackable(state, unit.id, destination).includes(action.targetId),
      "目标不在可攻击范围内，或弹药不足",
    );
  }
  if (command === "capture") {
    requireRule(UNITS[unit.type]?.capture, "只有步兵与机动步兵可以占领");
    requireRule(
      canCapture(state, seat, unit, destination.x, destination.y),
      "只能占领中立或敌方建筑",
    );
  } else {
    // Only infantry can take an HQ. Letting a vehicle end its move there would
    // deny the tile to both sides forever: the owner cannot re-enter it and the
    // parked unit cannot capture it, so the match could never resolve.
    const landing = tileAt(state, destination.x, destination.y);
    requireRule(
      !(landing.type === "hq" && !allied(state, seat, landing.owner) && !UNITS[unit.type].capture),
      "只有步兵可以在敌方总部落脚",
    );
    // Aircraft may only stop on their own airfield, so no plane can sit on a
    // capturable objective that ground units cannot answer.
    requireRule(
      !(
        UNITS[unit.type].movement === "air" &&
        property(landing) &&
        !(landing.type === "airport" && allied(state, seat, landing.owner))
      ),
      "飞行器只能停在己方机场",
    );
  }
  if (command === "supply")
    requireRule(unit.type === "apc", "只有补给车可以执行补给");
  unit.x = destination.x;
  unit.y = destination.y;
  unit.fuel -= destination.cost;
  unit.acted = true;
  syncCargo(state, unit);
  if (ambushed)
    privateLog(`${player.name}的${def.name}遭遇埋伏，行军被迫中止。`, seat);
  if (command === "attack") {
    const enemy = state.units.find((u) => u.id === action.targetId);
    const opponent = playerOf(state, enemy.owner);
    const result = previewCombat(state, unit.id, enemy.id);
    enemy.hp -= result.damage;
    if (unit.ammo != null) unit.ammo--;
    if (result.counter > 0) {
      unit.hp -= result.counter;
      if (enemy.ammo != null) enemy.ammo--;
    }
    gainEnergy(player, result.damage, enemy.type);
    gainEnergy(opponent, result.damage, enemy.type);
    if (result.counter > 0) {
      gainEnergy(player, result.counter, unit.type);
      gainEnergy(opponent, result.counter, unit.type);
    }
    privateLog(
      `${player.name}的${def.name}攻击${UNITS[enemy.type].name}：−${result.damage} HP${result.counter ? `，反击 −${result.counter} HP` : ""}${enemy.hp <= 0 ? "，目标被摧毁" : ""}。`,
      seat,
      enemy.owner,
    );
    state.units = removeDestroyed(state, [enemy.id, unit.id]);
  } else if (command === "capture") {
    const tile = tileAt(state, unit.x, unit.y);
    if (tile.captureBy !== seat) tile.capture = 20;
    tile.captureBy = seat;
    tile.capture -= unit.hp;
    if (tile.capture <= 0) {
      const priorOwner = tile.owner;
      tile.owner = seat;
      tile.capture = 20;
      tile.captureBy = null;
      log(state, `${player.name} 占领了${TERRAINS[tile.type].name}！`);
      if (tile.type === "hq" && priorOwner != null) defeat(state, priorOwner);
    } else
      log(
        state,
        `${player.name} 正在占领${TERRAINS[tile.type].name}，剩余 ${tile.capture} 点。`,
      );
  }
  if (
    unit.type === "apc" &&
    (command === "supply" || command === "wait")
  ) {
    const count = supplyNeighbors(state, unit);
    if (count || command === "supply")
      privateLog(
        `${player.name}的补给车完成补给，恢复 ${count} 支部队。`,
        seat,
      );
  }
  return finishAction(state, seat);
}
/**
 * Loads a unit onto an adjacent friendly transport. `action.x,y` names the
 * transport. Loading costs the passenger its action; the carrier keeps its own
 * action, so it can still drive off with the cargo this turn.
 */
function loadCargo(state, seat, unit, action) {
  const carrier = unitAt(state, action.x, action.y);
  requireRule(
    carrier && carrier.owner === seat && carrier.id !== unit.id,
    "只能装载到相邻的己方运输单位",
  );
  requireRule(manhattan(carrier, unit) === 1, "运输单位必须相邻");
  requireRule(capacityOf(carrier.type) > 0, `${UNITS[carrier.type].name}不能运载部队`);
  requireRule(
    (carrier.cargo?.length ?? 0) < capacityOf(carrier.type),
    "运输单位已满载",
  );
  requireRule(
    canCarry(carrier.type, unit.type),
    `${UNITS[carrier.type].name}不能运载${UNITS[unit.type].name}`,
  );
  unit.carriedBy = carrier.id;
  unit.x = carrier.x;
  unit.y = carrier.y;
  unit.acted = true;
  carrier.cargo ??= [];
  carrier.cargo.push(unit.id);
  log(
    state,
    `${UNITS[unit.type].name}登上了${UNITS[carrier.type].name}（${carrier.cargo.length}/${capacityOf(carrier.type)}）。`,
    seat,
  );
  return finishAction(state, seat);
}
/**
 * Unloads one cargo unit to an adjacent tile. The unloaded unit keeps its
 * `acted = false`, so it may still move or attack this turn.
 */
function unloadCargo(state, seat, unit, action) {
  requireRule(capacityOf(unit.type) > 0 && unit.cargo?.length, "这支部队没有可卸载的货物");
  const x = action.x,
    y = action.y,
    tile = tileAt(state, x, y);
  requireRule(tile, "落点在地图之外");
  requireRule(manhattan(unit, { x, y }) === 1, "只能在相邻格卸载");
  requireRule(!unitAt(state, x, y), "落点已有单位");
  const cargo = cargoOf(state, unit).find((c) => {
    const def = UNITS[c.type];
    return TERRAINS[tile.type].costs[def.movement] != null;
  });
  requireRule(cargo, "没有能在此处卸载的货物");
  unit.cargo = unit.cargo.filter((id) => id !== cargo.id);
  cargo.carriedBy = null;
  cargo.x = x;
  cargo.y = y;
  cargo.acted = false;
  unit.acted = true;
  log(
    state,
    `${UNITS[cargo.type].name}从${UNITS[unit.type].name}上卸载。`,
    seat,
  );
  return finishAction(state, seat);
}
/**
 * Merges two adjacent same-type units. The mover is absorbed: the receiver
 * keeps its tile, HP is capped at 10, and ammo/fuel are summed and clamped.
 * Both units spend their action, so a merge cannot be used to act twice.
 */
function joinUnits(state, seat, unit, action) {
  const other = unitAt(state, action.x, action.y);
  requireRule(other && other.id !== unit.id && other.owner === seat, "只能与相邻的己方单位合并");
  requireRule(other.type === unit.type, "只能合并同一兵种");
  requireRule(manhattan(unit, other) === 1, "只能合并相邻单位");
  requireRule(!unit.cargo?.length && !other.cargo?.length, "携带货物的运输单位不能合并");
  const def = UNITS[unit.type];
  requireRule(UNITS[unit.type].maxRange > 0 || def.capacity, "该兵种不能合并");
  other.hp = Math.min(10, unit.hp + other.hp);
  if (def.maxAmmo != null)
    other.ammo = Math.min(def.maxAmmo, (unit.ammo ?? 0) + (other.ammo ?? 0));
  other.fuel = Math.min(def.maxFuel, unit.fuel + other.fuel);
  other.acted = true;
  state.units = state.units.filter((u) => u.id !== unit.id);
  log(state, `${UNITS[other.type].name}完成合并（${other.hp} HP）。`, seat);
  return finishAction(state, seat);
}
/**
 * Removes destroyed units together with whatever they were carrying. A
 * transport that dies takes its cargo with it, and a destroyed passenger is
 * dropped from its carrier's manifest.
 */
function removeDestroyed(state, candidates) {
  const dead = new Set(
    state.units.filter((u) => u.hp <= 0 && candidates.includes(u.id)).map((u) => u.id),
  );
  for (const unit of state.units)
    if (dead.has(unit.id) && unit.cargo?.length)
      for (const id of unit.cargo) dead.add(id);
  for (const unit of state.units)
    if (dead.has(unit.id) && unit.carriedBy) {
      const carrier = state.units.find((u) => u.id === unit.carriedBy);
      if (carrier?.cargo) carrier.cargo = carrier.cargo.filter((id) => id !== unit.id);
    }
  return state.units.filter((u) => !dead.has(u.id));
}
/** Shared tail for unit actions: captures expire, victory is checked, turn may pass. */
function finishAction(state, seat) {
  resetCaptures(state);
  checkVictory(state);
  if (
    state.phase === "playing" &&
    playerOf(state, state.currentPlayer).defeated
  )
    nextTurn(state);
  return state;
}
/**
 * Cargo rides with its transport. Called whenever a carrier moves or is
 * created, so a passenger's coordinates never drift from the hull carrying it.
 */
function syncCargo(state, transport) {
  if (!transport.cargo?.length) return;
  for (const unit of state.units)
    if (unit.carriedBy === transport.id) {
      unit.x = transport.x;
      unit.y = transport.y;
    }
}
/** AI chooses one atomic action; every unit acts at most once, and factories fill. */
export function chooseAIAction(master, seat) {
  const officer = playerOf(master, seat);
  if (
    !officer ||
    officer.defeated ||
    master.phase !== "playing" ||
    master.currentPlayer !== seat
  )
    return { type: "endTurn" };
  // A fogged commander plans from the same projection its own client would see.
  // Deciding on the master state would let it react to units it never spotted,
  // and would also let it walk around a hidden blocker the player cannot know
  // about. Its own units, funds and energy survive projection intact.
  const state = master.fog ? projectState(master, seat) : master;
  const p = playerOf(state, seat);
  if (!p.power && p.energy >= 100) return { type: "power", level: "super" };
  if (
    !p.power &&
    p.energy >= 50 &&
    p.commander === "mechanic" &&
    state.units
      .filter((u) => u.owner === seat)
      .reduce((sum, u) => sum + 10 - u.hp, 0) >= 5
  )
    return { type: "power", level: "power" };
  const enemies = state.units.filter((u) => !allied(state, seat, u.owner));
  const targets = state.tiles.filter(
    (t) => property(t) && !allied(state, seat, t.owner),
  );
  const units = state.units
    .filter((u) => u.owner === seat && !u.acted)
    .sort(
      (a, b) =>
        Number(!!UNITS[b.type].capture) - Number(!!UNITS[a.type].capture) ||
        Number(!!UNITS[b.type].indirect) - Number(!!UNITS[a.type].indirect),
    );
  for (const unit of units) {
    const cells = reachable(state, unit.id),
      def = UNITS[unit.type];
    let best = null,
      bestScore = -Infinity;
    const consider = (score, cell, command, targetId) => {
      if (score > bestScore) {
        bestScore = score;
        best = {
          type: "move",
          unitId: unit.id,
          x: cell.x,
          y: cell.y,
          command,
          ...(targetId ? { targetId } : {}),
        };
      }
    };
    for (const cell of cells) {
      const tile = tileAt(state, cell.x, cell.y);
      if (def.capture && property(tile) && !allied(state, seat, tile.owner)) {
        const enemyThreat = enemies.reduce(
          (sum, e) => sum + (manhattan(e, cell) <= 2 ? 1 : 0),
          0,
        );
        const finish =
          tile.captureBy === seat ? tile.capture <= unit.hp : 20 <= unit.hp;
        consider(
          65 +
            (tile.type === "hq" && tile.owner != null
              ? 90
              : tile.type === "factory"
                ? 12
                : 0) +
            (finish ? 35 : 0) +
            (tile.captureBy === seat ? 20 : 0) -
            enemyThreat * 3,
          cell,
          "capture",
        );
      }
      for (const id of attackable(state, unit.id, cell)) {
        const enemy = state.units.find((u) => u.id === id),
          result = previewCombat(state, unit.id, id, cell);
        const value =
          result.damage * Math.sqrt(UNITS[enemy.type].cost / 1000) -
          result.counter * Math.sqrt(def.cost / 1000) * 0.65;
        const kill = result.damage >= enemy.hp ? 22 : 0;
        const invader =
          tileAt(state, enemy.x, enemy.y).owner === seat &&
          UNITS[enemy.type].capture
            ? 30
            : 0;
        consider(
          40 +
            value * 3 +
            kill +
            invader +
            TERRAINS[tile.type].defense -
            cell.cost * 0.2,
          cell,
          "attack",
          id,
        );
      }
    }
    // Transport and merge orders target a neighbouring tile rather than a
    // reachable one, so they are scored on their own. Without this the AI buys
    // hulls and helicopters it never uses, and the new arm stays untested in
    // real matches.
    const steps = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
    const carrier = capacityOf(unit.type) > 0 ? cargoOf(state, unit) : null;
    if (carrier?.length) {
      const first = carrier[0];
      const field = distanceField(state, { ...unit, type: first.type }, targets);
      const here = field.get(positionKey(unit.x, unit.y)) ?? 999;
      for (const [dx, dy] of steps) {
        const x = unit.x + dx,
          y = unit.y + dy;
        const tile = tileAt(state, x, y);
        if (!tile || unitAt(state, x, y)) continue;
        if (!carrier.some((c) => TERRAINS[tile.type].costs[UNITS[c.type].movement] != null))
          continue;
        const there = field.get(positionKey(x, y)) ?? 999;
        if (there < here) consider(46 + Math.min(24, here - there) * 3, { x, y }, "unload");
      }
    }
    for (const [dx, dy] of steps) {
      const x = unit.x + dx,
        y = unit.y + dy;
      const other = unitAt(state, x, y);
      if (!other || other.owner !== seat || other.id === unit.id) continue;
      if (
        capacityOf(other.type) > 0 &&
        (other.cargo?.length ?? 0) < capacityOf(other.type) &&
        canCarry(other.type, unit.type)
      ) {
        const mine = distanceField(state, unit, targets).get(positionKey(unit.x, unit.y)) ?? 999;
        const theirs = distanceField(state, other, targets).get(positionKey(other.x, other.y)) ?? 999;
        if (theirs < mine)
          consider(46 + Math.min(20, mine - theirs) * 2, { x, y }, "load");
      }
      if (
        other.type === unit.type &&
        !unit.cargo?.length &&
        !other.cargo?.length &&
        other.hp < 10 &&
        unit.hp + other.hp > other.hp
      )
        consider(46 + (10 - other.hp) * 2, { x, y }, "join");
    }
    if (best && bestScore >= 45) return best;
    // Build reverse terrain distances, so river crossings and obstacles are navigated.
    let goals = def.capture ? targets : enemies;
    if (unit.type === "apc") {
      const depleted = state.units.filter(
        (u) =>
          u.owner === seat &&
          onBoard(u) &&
          u.id !== unit.id &&
          (u.fuel < UNITS[u.type].maxFuel * 0.65 ||
            (u.ammo != null && u.ammo <= 2)),
      );
      goals = depleted.length
        ? depleted
        : state.units.filter(
            (u) =>
              u.owner === seat &&
              ["tank", "heavy", "artillery"].includes(u.type),
          );
    }
    // Cargo carriers head for their own passengers: a transport with nothing
    // aboard is dead weight, and a passenger left behind never rejoins.
    if (capacityOf(unit.type) > 0) {
      const waiting = state.units.filter(
        (u) =>
          u.owner === seat &&
          onBoard(u) &&
          u.id !== unit.id &&
          canCarry(unit.type, u.type),
      );
      const loaded = cargoOf(state, unit).length;
      if (!loaded && waiting.length) goals = waiting;
      else if (loaded) {
        const landing = state.tiles.filter(
          (t) =>
            !allied(state, seat, t.owner) &&
            cargoOf(state, unit).some(
              (c) => TERRAINS[t.type].costs[UNITS[c.type].movement] != null,
            ),
        );
        goals = landing.length ? landing : targets;
      }
    }
    if (!goals.length) goals = targets;
    const recovery = state.tiles.filter(
      (t) => property(t) && allied(state, seat, t.owner),
    );
    if ((unit.hp <= 4 || unit.ammo === 0 || unit.fuel <= 8) && recovery.length)
      goals = recovery;
    const distances = distanceField(state, unit, goals);
    let chosen = cells[0],
      moveScore = -Infinity;
    for (const cell of cells) {
      const tile = tileAt(state, cell.x, cell.y);
      let score =
        -(distances.get(positionKey(cell.x, cell.y)) ?? 1000) * 6 +
        TERRAINS[tile.type].defense * 0.6 -
        cell.cost * 0.05;
      if (tile.type === "factory" && tile.owner === seat) score -= 8;
      // Leave capturable buildings free for our infantry. A non-capturing unit
      // parked on an enemy HQ walls our own infantry out of it forever and
      // deadlocks the match, so that is priced as a near-veto rather than a
      // nudge.
      if (!def.capture && property(tile) && !allied(state, seat, tile.owner))
        score -= tile.owner == null ? 45 : tile.type === "hq" ? 600 : 200;
      if (unit.hp <= 4 && property(tile) && allied(state, seat, tile.owner))
        score += 50;
      if (def.indirect) {
        const nearest = enemies.length
          ? Math.min(...enemies.map((e) => manhattan(e, cell)))
          : 99;
        if (nearest >= def.minRange && nearest <= def.maxRange) score += 28;
        if (nearest < def.minRange) score -= 25;
      }
      if (unit.type === "apc")
        score +=
          state.units.filter(
            (u) =>
              u.owner === seat &&
              u.id !== unit.id &&
              manhattan(u, cell) === 1 &&
              (u.fuel < UNITS[u.type].maxFuel ||
                u.ammo !== UNITS[u.type].maxAmmo),
          ).length * 35;
      if (score > moveScore) {
        moveScore = score;
        chosen = cell;
      }
    }
    return {
      type: "move",
      unitId: unit.id,
      x: chosen.x,
      y: chosen.y,
      command: unit.type === "apc" ? "supply" : "wait",
    };
  }
  // Production: every owned site builds what it can actually launch. Aircraft
  // and hulls are gated by their airfield/quay, so a landlocked player simply
  // never sees them in the candidate list.
  for (const tile of state.tiles.filter(
    (t) =>
      t.owner === seat &&
      ["factory", "airport", "port"].includes(t.type) &&
      !unitAt(state, t.x, t.y),
  )) {
    const owned = state.units.filter((u) => u.owner === seat);
    const count = (type) => owned.filter((u) => u.type === type).length;
    const enemyAir = state.units.some(
      (u) => !allied(state, seat, u.owner) && UNITS[u.type].category === "air",
    );
    const enemyNaval = state.units.some(
      (u) => !allied(state, seat, u.owner) && UNITS[u.type].category === "naval",
    );
    let preference;
    if (tile.type === "airport")
      // One transport is enough until the AI plans loading; extra hulls would
      // just soak up funds that combat aircraft need.
      preference = enemyAir
        ? ["fighter", "bomber"]
        : count("bomber") < 1
          ? ["bomber", "fighter"]
          : count("heli") < 1
            ? ["heli", "fighter", "bomber"]
            : ["fighter", "bomber"];
    else if (tile.type === "port")
      preference = enemyNaval
        ? ["destroyer", "lander"]
        : count("lander") < 1
          ? ["lander", "destroyer"]
          : ["destroyer"];
    else if (
      owned.filter((u) => UNITS[u.type].capture).length <
      Math.min(4, Math.max(2, Math.ceil(targets.length / 3)))
    )
      preference = ["infantry"];
    else if (count("tank") < 2) preference = ["tank", "mech", "infantry"];
    else if (count("artillery") < Math.ceil(count("tank") / 2))
      preference = ["artillery", "mech", "infantry"];
    else if (
      count("apc") < 1 &&
      owned.some((u) => u.ammo != null && u.ammo <= 2)
    )
      preference = ["apc"];
    else if (count("heavy") < Math.max(1, Math.floor(count("tank") / 2)))
      preference = ["heavy"];
    else if (count("rocket") < 1 && count("heavy") >= 1)
      preference = ["rocket"];
    else if (count("recon") < 1) preference = ["recon", "infantry"];
    else preference = ["tank", "mech", "infantry"];
    if (owned.length >= 24) {
      // At the unit cap the AI can still be unable to win: if every infantry is
      // dead, nothing it owns can capture a building. Let it replace one rather
      // than sit on a full army that can never take the last objective.
      const hasCapture = owned.some((u) => UNITS[u.type].capture);
      if (hasCapture || tile.type !== "factory") continue;
      const infantry = UNITS.infantry.cost <= p.funds ? "infantry" : null;
      if (infantry) return { type: "build", unitType: infantry, x: tile.x, y: tile.y };
      continue;
    }
    const unitType = preference.find((type) => UNITS[type].cost <= p.funds);
    if (unitType) return { type: "build", unitType, x: tile.x, y: tile.y };
  }
  return { type: "endTurn" };
}
function distanceField(state, unit, goals) {
  const def = UNITS[unit.type],
    distances = new Map(),
    queue = [];
  for (const goal of goals) {
    const key = positionKey(goal.x, goal.y);
    if (distances.has(key)) continue;
    distances.set(key, 0);
    queue.push({ x: goal.x, y: goal.y, cost: 0 });
  }
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const cell = queue.shift();
    if (distances.get(positionKey(cell.x, cell.y)) !== cell.cost) continue;
    const cost =
      TERRAINS[tileAt(state, cell.x, cell.y).type].costs[def.movement];
    if (cost == null) continue;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = cell.x + dx,
        y = cell.y + dy,
        t = tileAt(state, x, y);
      if (!t || TERRAINS[t.type].costs[def.movement] == null) continue;
      const nextCost = cell.cost + cost,
        key = positionKey(x, y);
      if (distances.has(key) && distances.get(key) <= nextCost) continue;
      distances.set(key, nextCost);
      queue.push({ x, y, cost: nextCost });
    }
  }
  return distances;
}
/** Strict structural validation for persisted games, never repairs corrupted data. */
export function validateState(state) {
  requireRule(state && state.version === 1, "存档版本不兼容");
  requireRule(typeof state.fog === "boolean", "存档迷雾开关无效");
  const map = MAPS.find((m) => m.id === state.mapId);
  requireRule(
    map && state.width === map.width && state.height === map.height,
    "存档地图尺寸无效",
  );
  requireRule(
    Array.isArray(state.players) &&
      state.players.length >= 2 &&
      state.players.length <= 4,
    "存档玩家数量无效",
  );
  const seats = new Set();
  for (const p of state.players) {
    requireRule(
      Number.isInteger(p.id) && p.id >= 0 && p.id < 4 && !seats.has(p.id),
      "存档玩家编号无效",
    );
    seats.add(p.id);
    requireRule(
      typeof p.name === "string" &&
        p.name.length <= 100 &&
        Object.hasOwn(COMMANDERS, p.commander) &&
        ["human", "ai"].includes(p.controller),
      "存档玩家信息无效",
    );
    requireRule(
      Number.isInteger(p.team) && p.team >= 0 && p.team < 4,
      "存档队伍无效",
    );
    requireRule(
      Number.isFinite(p.funds) &&
        p.funds >= 0 &&
        p.funds <= 1000000000 &&
        Number.isInteger(p.energy) &&
        p.energy >= 0 &&
        p.energy <= 100,
      "存档资源无效",
    );
    requireRule(
      typeof p.defeated === "boolean" &&
        [null, "power", "super"].includes(p.power),
      "存档玩家状态无效",
    );
    // 能力生效期间不会再获得能量，因此普通能力剩余量不超过 50，超级能力必然清零。
    requireRule(
      p.power === null ||
        (p.power === "power" && p.energy <= 50) ||
        (p.power === "super" && p.energy === 0),
      "存档指挥官能力与能量不一致",
    );
  }
  requireRule(
    Array.isArray(state.tiles) &&
      state.tiles.length === state.width * state.height,
    "存档地形数据缺失",
  );
  state.tiles.forEach((t, i) => {
    requireRule(
      t &&
        t.x === i % state.width &&
        t.y === Math.floor(i / state.width) &&
        Object.hasOwn(TERRAINS, t.type),
      "存档地形坐标无效",
    );
    requireRule(
      t.owner === null ||
        (seats.has(t.owner) &&
          property(t) &&
          !playerOf(state, t.owner).defeated),
      "存档建筑归属无效",
    );
    requireRule(
      Number.isInteger(t.capture) &&
        t.capture >= 1 &&
        t.capture <= 20 &&
        (t.captureBy === null || seats.has(t.captureBy)) &&
        (t.capture === 20
          ? t.captureBy === null
          : property(t) &&
            t.captureBy !== null &&
            !allied(state, t.owner, t.captureBy)),
      "存档占领状态无效",
    );
  });
  requireRule(
    Array.isArray(state.units) && state.units.length <= state.tiles.length,
    "存档单位列表无效",
  );
  const ids = new Set(),
    occupied = new Set(),
    carriers = new Map();
  let maxId = 0;
  for (const u of state.units) {
    const def = UNITS[u.type];
    requireRule(
      typeof u.id === "string" &&
        /^u[1-9]\d*$/.test(u.id) &&
        !ids.has(u.id) &&
        Object.hasOwn(UNITS, u.type) &&
        seats.has(u.owner) &&
        !playerOf(state, u.owner).defeated,
      "存档单位身份无效",
    );
    ids.add(u.id);
    maxId = Math.max(maxId, Number(u.id.slice(1)));
    const tile = tileAt(state, u.x, u.y),
      key = positionKey(u.x, u.y);
    requireRule(tile, "存档单位位置无效");
    if (onBoard(u)) {
      requireRule(
        TERRAINS[tile.type].costs[def.movement] != null && !occupied.has(key),
        "存档单位位置无效",
      );
      occupied.add(key);
    } else {
      requireRule(
        u.carriedBy !== u.id &&
          typeof u.carriedBy === "string" &&
          !occupied.has(`${u.id}@cargo`),
        "存档货物状态无效",
      );
      occupied.add(`${u.id}@cargo`);
    }
    requireRule(
      Number.isInteger(u.hp) &&
        u.hp >= 1 &&
        u.hp <= 10 &&
        Number.isInteger(u.fuel) &&
        u.fuel >= 0 &&
        u.fuel <= def.maxFuel,
      "存档单位生命或燃料无效",
    );
    requireRule(
      def.maxAmmo === null
        ? u.ammo === null
        : Number.isInteger(u.ammo) && u.ammo >= 0 && u.ammo <= def.maxAmmo,
      "存档单位弹药无效",
    );
    requireRule(typeof u.acted === "boolean", "存档单位行动状态无效");
    const capacity = capacityOf(u.type);
    requireRule(
      capacity === 0
        ? u.cargo == null
        : Array.isArray(u.cargo) &&
            u.cargo.length <= capacity &&
            new Set(u.cargo).size === u.cargo.length,
      "存档货舱无效",
    );
    if (capacity) carriers.set(u.id, u);
  }
  // Every cargo slot and every carriedBy pointer must agree with its partner.
  const cargoIds = new Set();
  for (const u of state.units)
    if (u.cargo)
      for (const id of u.cargo) {
        requireRule(
          ids.has(id) && !cargoIds.has(id),
          "存档货舱引用了不存在的单位",
        );
        cargoIds.add(id);
        const cargo = state.units.find((c) => c.id === id);
        requireRule(
          cargo.carriedBy === u.id &&
            cargo.owner === u.owner &&
            cargo.x === u.x &&
            cargo.y === u.y &&
            canCarry(u.type, cargo.type),
          "存档货舱内容无效",
        );
      }
  for (const u of state.units)
    requireRule(
      u.carriedBy == null
        ? !cargoIds.has(u.id)
        : carriers.has(u.carriedBy) &&
            carriers.get(u.carriedBy).cargo.includes(u.id),
      "存档货物归属无效",
    );
  for (const t of state.tiles)
    if (t.capture < 20) {
      const u = unitAt(state, t.x, t.y);
      requireRule(
        u && UNITS[u.type].capture && u.owner === t.captureBy,
        "存档占领单位缺失",
      );
    }
  requireRule(
    Number.isInteger(state.nextUnitId) &&
      state.nextUnitId > maxId &&
      Number.isSafeInteger(state.nextUnitId),
    "存档单位序号无效",
  );
  requireRule(
    ["playing", "finished"].includes(state.phase) &&
      seats.has(state.currentPlayer),
    "存档回合状态无效",
  );
  // 与 checkVictory 的淘汰条件保持一致：存活玩家必须仍有单位，或至少有一座
  // 没被敌军占住的生产设施。
  for (const p of state.players) {
    const assets =
      state.units.some((u) => u.owner === p.id) ||
      productionSites(state, p.id).some((tile) => {
        const occupant = unitAt(state, tile.x, tile.y);
        return !occupant || occupant.owner === p.id;
      });
    requireRule(
      p.defeated ? !assets && p.power === null : assets,
      "存档玩家存活状态无效",
    );
  }
  requireRule(
    Number.isSafeInteger(state.day) &&
      state.day >= 1 &&
      Number.isSafeInteger(state.turn) &&
      state.turn >= 1,
    "存档回合计数无效",
  );
  requireRule(
    Array.isArray(state.log) &&
      state.log.length <= 100 &&
      // 迷雾对局中，私有日志条目是 { seat, message } 结构。
      state.log.every(
        (entry) =>
          (typeof entry === "string" && entry.length <= 1000) ||
          (entry &&
            typeof entry === "object" &&
            seats.has(entry.seat) &&
            typeof entry.message === "string" &&
            entry.message.length <= 1000),
      ),
    "存档日志无效",
  );
  if (state.phase === "playing")
    requireRule(
      !playerOf(state, state.currentPlayer).defeated &&
        state.winner === null &&
        new Set(state.players.filter((p) => !p.defeated).map((p) => p.team))
          .size > 1,
      "存档当前行动方或胜负状态无效",
    );
  else
    requireRule(
      state.winner === null ||
        (Number.isInteger(state.winner) &&
          state.players.some((p) => p.team === state.winner && !p.defeated)),
      "存档胜利队伍无效",
    );
  return true;
}
