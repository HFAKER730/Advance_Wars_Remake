/**
 * Pins the published rule contract in docs/RULES-CONTRACT.md to the engine.
 * Every number here was measured from the current implementation; if a change
 * alters one of them, this suite fails until the contract is updated too.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMANDERS,
  TERRAINS,
  UNITS,
  applyAction,
  canCapture,
  createGame,
  previewCombat,
  reachable,
  validateState,
} from "../public/shared/engine.mjs";
import { addUnit, fixture, moveAction, round, tileAt } from "./helpers.mjs";

const infantryAt = (state, owner, x, y, hp = 10) =>
  addUnit(state, "infantry", owner, x, y, { hp });

test("unit roster keeps its published cost, movement and weapon profile", () => {
  const expected = {
    infantry: { cost: 1000, move: 3, minRange: 1, maxRange: 1, maxAmmo: null, maxFuel: 99, movement: "foot", category: "ground", targets: ["ground", "naval"], produceAt: "factory", fuelPerTurn: 0, capture: true },
    mech: { cost: 3000, move: 2, minRange: 1, maxRange: 1, maxAmmo: 3, maxFuel: 70, movement: "foot", category: "ground", targets: ["ground", "naval"], produceAt: "factory", fuelPerTurn: 0, capture: true },
    recon: { cost: 4000, move: 8, minRange: 1, maxRange: 1, maxAmmo: null, maxFuel: 80, movement: "wheel", category: "ground", targets: ["ground", "naval"], produceAt: "factory", fuelPerTurn: 0 },
    tank: { cost: 7000, move: 6, minRange: 1, maxRange: 1, maxAmmo: 6, maxFuel: 70, movement: "track", category: "ground", targets: ["ground", "naval"], produceAt: "factory", fuelPerTurn: 0 },
    heavy: { cost: 16000, move: 4, minRange: 1, maxRange: 1, maxAmmo: 5, maxFuel: 50, movement: "track", category: "ground", targets: ["ground", "naval"], produceAt: "factory", fuelPerTurn: 0 },
    artillery: { cost: 6000, move: 5, minRange: 2, maxRange: 3, maxAmmo: 6, maxFuel: 50, movement: "track", category: "ground", targets: ["ground", "naval"], produceAt: "factory", fuelPerTurn: 0, indirect: true },
    rocket: { cost: 15000, move: 5, minRange: 3, maxRange: 5, maxAmmo: 6, maxFuel: 50, movement: "wheel", category: "ground", targets: ["ground", "naval"], produceAt: "factory", fuelPerTurn: 0, indirect: true },
    apc: { cost: 5000, move: 6, minRange: 0, maxRange: 0, maxAmmo: null, maxFuel: 80, movement: "track", category: "ground", targets: [], produceAt: "factory", fuelPerTurn: 0 },
    fighter: { cost: 18000, move: 9, minRange: 1, maxRange: 1, maxAmmo: 9, maxFuel: 40, movement: "air", category: "air", targets: ["air"], produceAt: "airport", fuelPerTurn: 2 },
    bomber: { cost: 22000, move: 7, minRange: 1, maxRange: 1, maxAmmo: 9, maxFuel: 45, movement: "air", category: "air", targets: ["ground", "naval"], produceAt: "airport", fuelPerTurn: 2 },
    heli: { cost: 6000, move: 6, minRange: 0, maxRange: 0, maxAmmo: null, maxFuel: 40, movement: "air", category: "air", targets: [], produceAt: "airport", fuelPerTurn: 2, capacity: 1, carry: ["infantry", "mech"] },
    destroyer: { cost: 18000, move: 6, minRange: 1, maxRange: 1, maxAmmo: 9, maxFuel: 60, movement: "naval", category: "naval", targets: ["ground", "naval"], produceAt: "port", fuelPerTurn: 1 },
    lander: { cost: 12000, move: 6, minRange: 0, maxRange: 0, maxAmmo: null, maxFuel: 60, movement: "naval", category: "naval", targets: [], produceAt: "port", fuelPerTurn: 1, capacity: 2, carry: ["ground"] },
  };
  assert.deepEqual(Object.keys(UNITS).sort(), Object.keys(expected).sort());
  for (const [type, wanted] of Object.entries(expected))
    for (const [key, value] of Object.entries(wanted))
      assert.deepEqual(UNITS[type][key], value, `${type}.${key}`);
  // 无武器单位：补给车、运输直升机、登陆舰。
  for (const type of ["apc", "heli", "lander"]) {
    assert.equal(UNITS[type].maxRange, 0);
    assert.equal(UNITS[type].maxAmmo, null);
  }
  // 只有步兵系能占领；只有运输单位有货舱容量。
  assert.deepEqual(
    Object.entries(UNITS).filter(([, def]) => def.capture).map(([type]) => type),
    ["infantry", "mech"],
  );
  assert.deepEqual(
    Object.entries(UNITS).filter(([, def]) => def.capacity).map(([type]) => type),
    ["heli", "lander"],
  );
});

test("terrain table keeps its published defense stars and movement costs", () => {
  const expected = {
    plain: { defense: 1, costs: { foot: 1, track: 1, wheel: 2, air: 1 } },
    road: { defense: 0, costs: { foot: 1, track: 1, wheel: 1, air: 1 } },
    forest: { defense: 2, costs: { foot: 1, track: 2, wheel: 3, air: 1 } },
    mountain: { defense: 4, costs: { foot: 2, air: 1 } },
    water: { defense: 0, costs: { air: 1 } },
    bridge: { defense: 0, costs: { foot: 1, track: 1, wheel: 1, air: 1 } },
    sea: { defense: 0, costs: { naval: 1, air: 1 } },
    city: { defense: 3, income: 1000, costs: { foot: 1, track: 1, wheel: 1, air: 1 } },
    factory: { defense: 3, income: 1000, costs: { foot: 1, track: 1, wheel: 1, air: 1 } },
    airport: { defense: 3, income: 1000, costs: { foot: 1, track: 1, wheel: 1, air: 1 } },
    port: { defense: 3, income: 1000, costs: { foot: 1, track: 1, wheel: 1, naval: 1, air: 1 } },
    hq: { defense: 4, income: 1000, costs: { foot: 1, track: 1, wheel: 1, air: 1 } },
  };
  assert.deepEqual(Object.keys(TERRAINS).sort(), Object.keys(expected).sort());
  for (const [type, wanted] of Object.entries(expected)) {
    assert.equal(TERRAINS[type].defense, wanted.defense, `${type}.defense`);
    assert.deepEqual(TERRAINS[type].costs, wanted.costs, `${type}.costs`);
    if (wanted.income) assert.equal(TERRAINS[type].income, wanted.income);
    else assert.equal(TERRAINS[type].income, undefined, `${type} 不应产生收入`);
  }
  // 河流不是海：舰船不能进入，空中单位可以飞越。
  assert.equal(TERRAINS.water.costs.naval, undefined);
  assert.equal(TERRAINS.sea.costs.foot, undefined);
  assert.equal(TERRAINS.sea.costs.naval, 1);
});

test("damage formula matches the published integer expression", () => {
  // 整数伤害（无随机数）：
  // D = min(HP_def, max(1, round( B × HP_atk/100 × A × (1 − stars × HP_def/100) / F )))
  // B 为基础伤害，A 为攻方系数，F 为守方系数，HP 为 1–10 的可视生命。
  const formula = (base, hpAtk, hpDef, stars, attack = 1, defense = 1) =>
    Math.min(
      hpDef,
      Math.max(
        1,
        Math.round(
          ((base * hpAtk) / 100) * attack * (1 - (stars * hpDef) / 100) / defense,
        ),
      ),
    );

  const cases = [
    { attacker: "tank", defender: "infantry", terrain: "plain", attackHp: 10, defendHp: 10, expected: 7 },
    { attacker: "tank", defender: "infantry", terrain: "forest", attackHp: 10, defendHp: 10, expected: 6 },
    { attacker: "infantry", defender: "infantry", terrain: "plain", attackHp: 10, defendHp: 10, expected: 5 },
    { attacker: "infantry", defender: "infantry", terrain: "plain", attackHp: 5, defendHp: 10, expected: 2 },
    { attacker: "infantry", defender: "infantry", terrain: "hq", attackHp: 10, defendHp: 10, expected: 3 },
    { attacker: "infantry", defender: "infantry", terrain: "forest", attackHp: 3, defendHp: 10, expected: 1 },
    { attacker: "tank", defender: "infantry", terrain: "plain", attackHp: 10, defendHp: 10, attack: 1.1, expected: 7 },
    { attacker: "tank", defender: "infantry", terrain: "plain", attackHp: 10, defendHp: 10, attack: 1.25, expected: 8 },
    { attacker: "tank", defender: "infantry", terrain: "plain", attackHp: 10, defendHp: 10, attack: 1.4, expected: 9 },
    { attacker: "tank", defender: "infantry", terrain: "plain", attackHp: 10, defendHp: 10, defense: 1.1, expected: 6 },
    { attacker: "tank", defender: "infantry", terrain: "plain", attackHp: 10, defendHp: 10, defense: 1.3, expected: 5 },
  ];
  for (const item of cases) {
    const state = fixture();
    // 抵消指挥官被动：攻方用周衡（无攻击加成），守方用林岚（无防御加成）。
    state.players[0].commander = "mechanic";
    state.players[1].commander = "vanguard";
    const attacker = addUnit(state, item.attacker, 0, 3, 3, { hp: item.attackHp });
    const defender = addUnit(state, item.defender, 1, 4, 3, { hp: item.defendHp });
    tileAt(state, 4, 3).type = item.terrain;
    if (item.attack) {
      state.players[0].commander = "vanguard";
      state.players[0].power = item.attack === 1.25 ? "power" : item.attack === 1.4 ? "super" : null;
    }
    if (item.defense) {
      state.players[1].commander = "mechanic";
      state.players[1].power = item.defense === 1.3 ? "super" : null;
    }
    const dealt = previewCombat(state, attacker.id, defender.id).damage;
    const derived = formula(
      DAMAGE_MATRIX[item.attacker][item.defender],
      item.attackHp,
      item.defendHp,
      TERRAINS[item.terrain].defense,
      item.attack ?? 1,
      item.defense ?? 1,
    );
    assert.equal(dealt, item.expected, `${item.attacker}→${item.defender} @${item.terrain}`);
    assert.equal(dealt, derived, "公式推导必须与实现一致");
  }
});

test("combat is deterministic: no luck term, repeated previews agree", () => {
  const state = fixture();
  const attacker = addUnit(state, "tank", 0, 3, 3);
  const defender = addUnit(state, "mech", 1, 4, 3);
  const shots = Array.from({ length: 8 }, () => previewCombat(state, attacker.id, defender.id));
  for (const shot of shots) assert.deepEqual(shot, shots[0], "同一次预览必须完全一致");
  const first = applyAction(state, 0, moveAction(attacker, 3, 3, "attack", defender.id));
  const replay = applyAction(state, 0, moveAction(attacker, 3, 3, "attack", defender.id));
  assert.deepEqual(replay, first, "同一状态与指令必须得到同一结果");
});


test("terrain protection shrinks as the defender loses visible HP, capped by remaining HP", () => {
  // 用射程 3 的火炮测量，攻守双方都取不带攻防加成的指挥官，隔离地形因素。
  const measure = (terrain, defenderHp) => {
    const state = fixture();
    state.players[0].commander = "mechanic"; // 无攻击加成
    state.players[1].commander = "vanguard"; // 无防御加成
    const attacker = addUnit(state, "rocket", 0, 3, 3);
    const defender = addUnit(state, "tank", 1, 6, 3, { hp: defenderHp });
    tileAt(state, 6, 3).type = terrain;
    return previewCombat(state, attacker.id, defender.id).damage;
  };

  const hqFull = measure("hq", 10);
  const plainFull = measure("plain", 10);
  assert.ok(hqFull < plainFull, "满血守军在总部获得保护");

  // 未触及扣血上限时，保护随守军可视 HP 线性衰减。
  const hqEight = measure("hq", 8);
  assert.ok(hqEight > hqFull, "守军掉血后保护减弱");
  assert.equal(hqFull, 5, "85 × (1 − 4×10/100) → 5");
  assert.equal(hqEight, 6, "85 × (1 − 4×8/100) → 6");

  // 实际扣血永远不超过守军剩余 HP，因此低血量时表现为“保护被上限吃满”。
  assert.equal(measure("hq", 4), 4);
  assert.equal(measure("hq", 2), 2);
  assert.equal(measure("hq", 1), 1);
});

test("combat modifiers follow the commander table", () => {
  const attackTable = {
    "vanguard|none": 7,
    "vanguard|power": 8,
    "vanguard|super": 9,
    "mechanic|none": 7,
    "mechanic|power": 7,
    "mechanic|super": 7,
  };
  for (const [key, expected] of Object.entries(attackTable)) {
    const [commander, power] = key.split("|");
    const state = fixture();
    const attacker = addUnit(state, "tank", 0, 3, 3);
    const defender = infantryAt(state, 1, 4, 3);
    state.players[0].commander = commander;
    state.players[0].power = power === "none" ? null : power;
    state.players[1].commander = "vanguard";
    assert.equal(
      previewCombat(state, attacker.id, defender.id).damage,
      expected,
      `攻击修正 ${key}`,
    );
  }

  const defenseTable = { none: 6, power: 6, super: 5 };
  for (const [power, expected] of Object.entries(defenseTable)) {
    const state = fixture();
    const attacker = addUnit(state, "tank", 0, 3, 3);
    const defender = infantryAt(state, 1, 4, 3);
    state.players[0].commander = "mechanic";
    state.players[1].commander = "mechanic";
    state.players[1].power = power === "none" ? null : power;
    assert.equal(
      previewCombat(state, attacker.id, defender.id).damage,
      expected,
      `防御修正 mechanic/${power}`,
    );
  }
});

test("movement bonus follows the commander table", () => {
  const table = {
    "vanguard|none": 25,
    "vanguard|power": 41,
    "vanguard|super": 60,
    "mechanic|none": 25,
    "mechanic|power": 25,
    "mechanic|super": 41,
  };
  for (const [key, expected] of Object.entries(table)) {
    const [commander, power] = key.split("|");
    const state = fixture();
    const scout = addUnit(state, "infantry", 0, 7, 7);
    state.players[0].commander = commander;
    state.players[0].power = power === "none" ? null : power;
    assert.equal(reachable(state, scout.id).length, expected, `移动加成 ${key}`);
  }
});

test("income, repair and resupply follow the published economy", () => {
  // 据点收入：每座己方据点每回合 1000，步兵维修每点 100。
  let state = fixture();
  const infantry = infantryAt(state, 0, 0, 0, 3);
  state.players[0].funds = 0;
  state = round(state, 0);
  assert.equal(state.units.find((u) => u.id === infantry.id).hp, 5, "每回合最多恢复 2 点");
  assert.equal(state.players[0].funds, 800, "收入 1000 减去维修 200");

  // 重型单位每点维修费 1600：资金不足时不维修，也不产生负资金。
  let heavyState = fixture();
  const heavy = addUnit(heavyState, "heavy", 0, 0, 0, { hp: 2 });
  heavyState.players[0].funds = 0;
  heavyState = round(heavyState, 0);
  assert.equal(heavyState.units.find((u) => u.id === heavy.id).hp, 2);
  assert.equal(heavyState.players[0].funds, 1000, "收入照常发放，维修被跳过");

  // 据点免费补给弹药与燃料，不消耗资金。
  let supplyState = fixture();
  const thirsty = addUnit(supplyState, "tank", 0, 0, 0, { ammo: 0, fuel: 0, hp: 10 });
  supplyState.players[0].funds = 0;
  supplyState = round(supplyState, 0);
  const resupplied = supplyState.units.find((u) => u.id === thirsty.id);
  assert.equal(resupplied.ammo, UNITS.tank.maxAmmo);
  assert.equal(resupplied.fuel, UNITS.tank.maxFuel);
  assert.equal(supplyState.players[0].funds, 1000, "补给本身不收费");
});

test("energy accrues from both dealt and taken damage, capped at 100", () => {
  // 单次充能：max(2, ceil(伤害 × 受影响单位造价 / 1800))，双方各自结算攻击与反击。
  const charge = (damage, cost) => Math.max(2, Math.ceil((damage * cost) / 1800));
  const state = fixture();
  const attacker = addUnit(state, "tank", 0, 3, 3);
  const defender = infantryAt(state, 1, 4, 3);
  const preview = previewCombat(state, attacker.id, defender.id);
  const settled = applyAction(state, 0, moveAction(attacker, 3, 3, "attack", defender.id));
  const expected =
    charge(preview.damage, UNITS.infantry.cost) + charge(preview.counter, UNITS.tank.cost);
  assert.ok(preview.counter > 0, "本例应当发生反击");
  assert.equal(settled.players[0].energy, expected, "攻击方按造伤与受伤累计充能");
  assert.equal(settled.players[1].energy, expected, "防守方获得同样的充能量");

  const capped = fixture();
  capped.players[0].energy = 100;
  capped.players[0].funds = 0;
  const idle = addUnit(capped, "infantry", 0, 5, 5);
  const after = applyAction(capped, 0, { type: "endTurn" });
  assert.equal(after.players[0].energy, 100, "已经满值时不溢出");
  assert.equal(after.units.find((u) => u.id === idle.id).acted, false, "新回合重置行动状态");
  assert.equal(validateState(after), true);
});

test("commander roster, power costs and durations match the contract", () => {
  assert.deepEqual(Object.keys(COMMANDERS).sort(), ["mechanic", "vanguard"]);
  assert.equal(COMMANDERS.vanguard.name, "林岚");
  assert.equal(COMMANDERS.mechanic.name, "周衡");

  // 周衡能力立即恢复生命与补给，不改变行动状态。
  let state = fixture();
  state.players[1].energy = 50;
  state.currentPlayer = 1;
  const damaged = addUnit(state, "heavy", 1, 5, 5, { hp: 3, ammo: 0, fuel: 0, acted: true });
  state = applyAction(state, 1, { type: "power", level: "power" });
  const healed = state.units.find((u) => u.id === damaged.id);
  assert.equal(healed.hp, 5, "普通能力恢复 2 点");
  assert.equal(healed.ammo, UNITS.heavy.maxAmmo);
  assert.equal(healed.fuel, UNITS.heavy.maxFuel);
  assert.equal(healed.acted, true, "能力不重置行动状态");
  assert.equal(state.players[1].energy, 0);
  assert.equal(validateState(state), true);
});

test("capture needs 20 accumulated points and strong infantry finish in two turns", () => {
  let state = fixture();
  const capturer = infantryAt(state, 0, 3, 3);
  tileAt(state, 3, 3).type = "city";
  state = applyAction(state, 0, moveAction(capturer, 3, 3, "capture"));
  assert.equal(tileAt(state, 3, 3).capture, 10);
  assert.equal(tileAt(state, 3, 3).captureBy, 0);
  state = round(state, 0);
  assert.equal(tileAt(state, 3, 3).capture, 10, "回到本方回合时进度保留");
  state = applyAction(state, 0, moveAction(state.units.find((u) => u.id === capturer.id), 3, 3, "capture"));
  assert.equal(tileAt(state, 3, 3).owner, 0);
  assert.equal(tileAt(state, 3, 3).capture, 20, "完成后进度重置为满值");
  assert.equal(tileAt(state, 3, 3).captureBy, null);
  assert.equal(validateState(state), true);
});

test("a captured HQ eliminates its owner and transfers the building", () => {
  let state = fixture(3);
  addUnit(state, "tank", 1, 5, 3);
  addUnit(state, "tank", 2, 8, 3);
  const capturer = infantryAt(state, 0, 3, 3);
  Object.assign(tileAt(state, 3, 3), { type: "hq", owner: 1, capture: 5, captureBy: 0 });
  state = applyAction(state, 0, moveAction(capturer, 3, 3, "capture"));
  assert.equal(state.players[1].defeated, true);
  assert.equal(tileAt(state, 3, 3).owner, 0, "总部转归占领方");
  assert.equal(tileAt(state, 3, 3).capture, 20);
  assert.equal(validateState(state), true);
});

test("elimination also happens when a seat loses every unit and factory", () => {
  let state = fixture(2);
  const hunter = addUnit(state, "heavy", 0, 3, 3);
  const last = addUnit(state, "infantry", 1, 4, 3, { hp: 1 });
  tileAt(state, 1, 0).owner = null; // 敌方工厂被中立化，只剩最后 1 支部队
  state = applyAction(state, 0, moveAction(hunter, 3, 3, "attack", last.id));
  assert.equal(state.units.some((u) => u.owner === 1), false);
  assert.equal(state.players[1].defeated, true);
  assert.equal(state.phase, "finished");
  assert.equal(state.winner, 0);
});

test("an HQ only counts as captured through the capture command, not through damage", () => {
  const state = fixture(2);
  const attacker = addUnit(state, "heavy", 0, 3, 3);
  const defender = infantryAt(state, 1, 4, 3, 2);
  Object.assign(tileAt(state, 4, 3), { type: "hq", owner: 1 });
  const settled = applyAction(state, 0, moveAction(attacker, 3, 3, "attack", defender.id));
  assert.equal(settled.players[1].defeated, false, "击毁守军不会直接夺走总部");
  assert.equal(tileAt(settled, 4, 3).owner, 1);
  assert.equal(canCapture(settled, 0, settled.units.find((u) => u.id === attacker.id), 4, 3), false, "车辆不能占领总部");
});

test("production requires an empty owned factory and the new unit waits a turn", () => {
  let state = fixture();
  const built = applyAction(state, 0, { type: "build", unitType: "infantry", x: 0, y: 0 });
  const unit = built.units.find((u) => u.owner === 0);
  assert.equal(built.players[0].funds, 10000 - UNITS.infantry.cost);
  assert.equal(unit.acted, true, "新单位在本回合不能行动");
  assert.equal(unit.hp, 10);
  assert.equal(unit.fuel, UNITS.infantry.maxFuel);
  // reachable() 只回答“能走到哪”，是否允许行动由 applyAction 判定；客户端用 acted 过滤。
  const before = structuredClone(built);
  assert.throws(() => applyAction(built, 0, moveAction(unit, 1, 0)), /已经行动/);
  assert.deepEqual(built, before);
  const next = applyAction(applyAction(built, 0, { type: "endTurn" }), 1, { type: "endTurn" });
  assert.equal(next.units.find((u) => u.id === unit.id).acted, false);
  const moved = applyAction(next, 0, moveAction(next.units.find((u) => u.id === unit.id), 1, 0));
  assert.equal(moved.units.find((u) => u.id === unit.id).x, 1);
});

test("empty attack queries are safe and never throw", () => {
  const state = fixture();
  assert.deepEqual(reachable(state, "u404"), []);
  assert.deepEqual(previewCombat(state, "u404", "u405"), { damage: 0, counter: 0 });
  assert.equal(typeof createGame, "function");
});

/** Mirrors the internal damage table so the formula test can derive expectations. */
const DAMAGE_MATRIX = {
  infantry: { infantry: 55, mech: 45, recon: 15, tank: 8, heavy: 3, artillery: 20, rocket: 25, apc: 15 },
  mech: { infantry: 65, mech: 55, recon: 85, tank: 60, heavy: 30, artillery: 70, rocket: 80, apc: 75 },
  recon: { infantry: 75, mech: 65, recon: 35, tank: 15, heavy: 5, artillery: 45, rocket: 55, apc: 45 },
  tank: { infantry: 75, mech: 70, recon: 85, tank: 55, heavy: 25, artillery: 75, rocket: 85, apc: 75 },
  heavy: { infantry: 95, mech: 90, recon: 100, tank: 85, heavy: 55, artillery: 95, rocket: 100, apc: 100 },
  artillery: { infantry: 80, mech: 75, recon: 80, tank: 70, heavy: 45, artillery: 75, rocket: 85, apc: 80 },
  rocket: { infantry: 95, mech: 90, recon: 95, tank: 85, heavy: 65, artillery: 90, rocket: 90, apc: 95 },
  apc: {},
};
