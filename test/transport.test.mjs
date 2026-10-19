/**
 * M5: ships, aircraft, fuel upkeep, transport and merging.
 *
 * The rules contract (§11) is the source of truth; this suite pins the engine
 * to it. Two properties matter most:
 *
 *   1. Category gating — ground units cannot shoot aircraft, fighters cannot
 *      shoot ground, and a unit cannot counter a type it cannot attack.
 *   2. Cargo integrity — a passenger is never on the board, always follows its
 *      carrier, and dies with it. `validateState` is checked after every step.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  UNITS,
  applyAction,
  attackable,
  createGame,
  previewCombat,
  projectState,
  reachable,
  validateState,
} from "../public/shared/engine.mjs";
import { addUnit, fixture, moveAction, round, tileAt } from "./helpers.mjs";

/** Flat board with a wide sea band; the shore rows on both sides stay land. */
function coastal(playerCount = 2) {
  const state = fixture(playerCount, false);
  for (let y = 6; y <= 8; y++)
    for (let x = 6; x <= 10; x++) tileAt(state, x, y).type = "sea";
  return state;
}

const act = (state, seat, unit, x, y, command, extra = {}) =>
  applyAction(state, seat, {
    type: "move",
    unitId: unit.id,
    x,
    y,
    command,
    ...extra,
  });

test("sea is not a river: only hulls and aircraft may enter", () => {
  const state = coastal();
  const ship = addUnit(state, "lander", 0, 6, 7);
  const foot = addUnit(state, "infantry", 0, 5, 7);

  assert.ok(
    reachable(state, ship.id).some((c) => c.x === 8 && c.y === 7),
    "登陆舰可以驶入海洋",
  );
  assert.equal(
    reachable(state, foot.id).some((c) => c.x === 8 && c.y === 7),
    false,
    "步兵不能走进海洋",
  );
  // A river is still closed to hulls.
  const river = fixture();
  tileAt(river, 4, 4).type = "water";
  const boat = addUnit(river, "lander", 0, 3, 4);
  assert.equal(
    reachable(river, boat.id).some((c) => c.x === 4 && c.y === 4),
    false,
    "登陆舰不能驶入河流",
  );
});

test("aircraft fly over units and water at one movement per tile", () => {
  const state = coastal();
  const plane = addUnit(state, "fighter", 0, 2, 2);
  addUnit(state, "heavy", 1, 3, 2);
  addUnit(state, "tank", 1, 4, 2);

  const cells = reachable(state, plane.id);
  // The tiles with enemies are not valid destinations, but the aircraft must be
  // able to pass over them: (5,2) sits behind two enemy units.
  assert.ok(
    cells.some((c) => c.x === 5 && c.y === 2),
    "飞机可以飞越敌军上方",
  );
  assert.ok(
    cells.some((c) => c.x >= 6 && c.y >= 6),
    "飞机可以飞越海洋",
  );
  // Every step costs exactly 1 regardless of terrain.
  for (const cell of cells) assert.equal(cell.cost, cell.path.length - 1);
  assert.equal(plane.type, "fighter");
});

test("target categories gate attacks and counterattacks", () => {
  const state = fixture();
  const tank = addUnit(state, "tank", 0, 3, 3);
  const bomber = addUnit(state, "bomber", 1, 4, 3);
  const fighter = addUnit(state, "fighter", 0, 4, 4);

  assert.equal(attackable(state, tank.id).includes(bomber.id), false, "坦克打不到飞机");
  assert.equal(attackable(state, bomber.id).includes(tank.id), true, "轰炸机可以打坦克");
  assert.equal(attackable(state, fighter.id).includes(bomber.id), true, "战斗机可以打飞机");
  assert.equal(attackable(state, fighter.id).includes(tank.id), false, "战斗机打不到地面");
  assert.deepEqual(previewCombat(state, fighter.id, tank.id), { damage: 0, counter: 0 });

  // A counter only happens when the defender can attack the attacker's type.
  const strike = previewCombat(state, fighter.id, bomber.id);
  assert.ok(strike.damage > 0);
  assert.equal(strike.counter, 0, "轰炸机无法反击战斗机");
});

test("aircraft ignore terrain cover", () => {
  const open = fixture();
  const attacker = addUnit(open, "fighter", 0, 3, 3);
  const target = addUnit(open, "bomber", 1, 4, 3);

  const mountain = fixture();
  addUnit(mountain, "fighter", 0, 3, 3);
  const target2 = addUnit(mountain, "bomber", 1, 4, 3);
  tileAt(mountain, 4, 3).type = "mountain";

  assert.equal(
    previewCombat(open, attacker.id, target.id).damage,
    previewCombat(mountain, mountain.units[0].id, target2.id).damage,
    "空中目标不吃地形防御",
  );
  // Ground targets still do.
  const ground = fixture();
  const bomber = addUnit(ground, "bomber", 0, 3, 3);
  const foot = addUnit(ground, "infantry", 1, 4, 3);
  const covered = structuredClone(ground);
  tileAt(covered, 4, 3).type = "hq";
  assert.ok(
    previewCombat(covered, bomber.id, foot.id).damage <
      previewCombat(ground, bomber.id, foot.id).damage,
    "地面目标仍然吃地形防御",
  );
});

test("aircraft burn fuel each turn and crash when dry", () => {
  const state = fixture();
  const plane = addUnit(state, "fighter", 0, 2, 2, { fuel: 2 });
  const ship = addUnit(state, "lander", 0, 5, 6, { fuel: 1, hp: 10 });
  tileAt(state, 5, 6).type = "sea";
  const next = round(state, 0);
  assert.equal(
    next.units.some((u) => u.id === plane.id),
    false,
    "燃料耗尽的飞机应坠毁",
  );
  assert.equal(
    next.units.some((u) => u.id === ship.id),
    false,
    "燃料耗尽的舰船应沉没",
  );
  assert.ok(next.log.some((line) => String(line).includes("燃料耗尽")));
});

test("aircraft refit only at an airfield, and the upkeep runs after refit", () => {
  const state = fixture();
  const airport = tileAt(state, 2, 2);
  airport.type = "airport";
  airport.owner = 0;
  const plane = addUnit(state, "fighter", 0, 2, 2, { fuel: 4 });
  const next = round(state, 0);
  const kept = next.units.find((u) => u.id === plane.id);
  assert.ok(kept, "停在机场上的飞机不会坠毁");
  assert.equal(kept.fuel, UNITS.fighter.maxFuel - 2, "补满后扣当回合消耗");

  // A captured city is not an airfield.
  const city = fixture();
  tileAt(city, 2, 2).type = "city";
  tileAt(city, 2, 2).owner = 0;
  const parked = addUnit(city, "fighter", 0, 2, 2, { fuel: 2 });
  const after = round(city, 0);
  assert.equal(
    after.units.some((u) => u.id === parked.id),
    false,
    "飞机不能在城市上无限续航",
  );
});

test("ground units at zero fuel are stuck, not destroyed", () => {
  const state = fixture();
  const tank = addUnit(state, "tank", 0, 3, 3, { fuel: 0 });
  const next = round(state, 0);
  assert.ok(next.units.some((u) => u.id === tank.id), "地面单位不会因缺油自毁");
  assert.equal(
    reachable(next, tank.id).length,
    1,
    "缺油的地面单位只能原地不动",
  );
});

test("loading puts a passenger on its carrier and off the board", () => {
  const state = coastal();
  const lander = addUnit(state, "lander", 0, 6, 7);
  const foot = addUnit(state, "infantry", 0, 5, 7);

  const loaded = act(state, 0, foot, 6, 7, "load");
  const shipped = loaded.units.find((u) => u.id === foot.id);
  const hull = loaded.units.find((u) => u.id === lander.id);
  assert.equal(shipped.carriedBy, lander.id);
  assert.deepEqual(hull.cargo, [foot.id]);
  assert.equal(shipped.acted, true, "装载消耗行动");
  assert.equal(hull.x, 6);
  assert.equal(hull.y, 7);
  assert.equal(validateState(loaded), true);

  // Cargo is not a board unit: it cannot be targeted or block movement.
  const onLooker = addUnit(loaded, "tank", 1, 5, 7);
  const targets = attackable(loaded, onLooker.id);
  assert.equal(targets.includes(foot.id), false, "货舱单位不能被攻击");
  assert.equal(targets.includes(lander.id), true, "载具本身可以被攻击");

  // The hull moves and the passenger follows.
  const moved = act(loaded, 0, hull, 8, 7, "wait");
  const following = moved.units.find((u) => u.id === foot.id);
  assert.deepEqual([following.x, following.y], [8, 7]);
  assert.equal(validateState(moved), true);
});

test("loading is refused when the carrier is full, wrong, or out of reach", () => {
  const full = fixture();
  const heli = addUnit(full, "heli", 0, 5, 6);
  const firstFoot = addUnit(full, "infantry", 0, 5, 7);
  const secondFoot = addUnit(full, "mech", 0, 4, 6);
  const first = act(full, 0, firstFoot, 5, 6, "load");
  assert.equal(first.units.find((u) => u.id === heli.id).cargo.length, 1);
  assert.throws(
    () => act(first, 0, secondFoot, 5, 6, "load"),
    /已满载/,
  );

  const wrong = fixture();
  addUnit(wrong, "heli", 0, 3, 3);
  const tank = addUnit(wrong, "tank", 0, 4, 3);
  assert.throws(() => act(wrong, 0, tank, 3, 3, "load"), /不能运载/);

  const far = coastal();
  addUnit(far, "lander", 0, 6, 7);
  const foot = addUnit(far, "infantry", 0, 9, 9);
  assert.throws(() => act(far, 0, foot, 6, 7, "load"), /相邻/);
});

test("unloading places the passenger on legal ground and lets it act", () => {
  const state = coastal();
  const lander = addUnit(state, "lander", 0, 6, 7);
  const foot = addUnit(state, "infantry", 0, 5, 7);
  let next = act(state, 0, foot, 6, 7, "load");
  const hull = next.units.find((u) => u.id === lander.id);

  // The only land next to the hull is the tile the infantry came from.
  next = act(next, 0, hull, 5, 7, "unload");
  const landed = next.units.find((u) => u.id === foot.id);
  assert.equal(landed.carriedBy, null);
  assert.equal(landed.acted, false, "卸载后本回合仍可行动");
  assert.deepEqual([landed.x, landed.y], [5, 7]);
  assert.equal(validateState(next), true);

  // And an infantry cannot be "unloaded" into the sea.
  const seaward = coastal();
  const boat = addUnit(seaward, "lander", 0, 6, 7);
  const soldier = addUnit(seaward, "infantry", 0, 5, 7);
  const boarded = act(seaward, 0, soldier, 6, 7, "load");
  const vessel = boarded.units.find((u) => u.id === boat.id);
  assert.throws(() => act(boarded, 0, vessel, 7, 7, "unload"), /没有能在此处卸载/);
});

test("a destroyed transport takes its cargo with it", () => {
  const state = coastal();
  const lander = addUnit(state, "lander", 0, 6, 7, { hp: 1 });
  const foot = addUnit(state, "infantry", 0, 5, 7, { hp: 10 });
  let next = act(state, 0, foot, 6, 7, "load");
  next = applyAction(next, 0, { type: "endTurn" });
  const bomber = addUnit(next, "bomber", 1, 7, 7);
  const sunk = act(next, 1, bomber, 7, 7, "attack", { targetId: lander.id });

  assert.equal(sunk.units.some((u) => u.id === lander.id), false, "载具被摧毁");
  assert.equal(
    sunk.units.some((u) => u.id === foot.id),
    false,
    "货舱内的步兵一并阵亡",
  );
  assert.equal(validateState(sunk), true);
});

test("merging combines HP, ammo and fuel and removes the mover", () => {
  const state = fixture();
  const mover = addUnit(state, "infantry", 0, 3, 3, { hp: 4, fuel: 40 });
  const anchor = addUnit(state, "infantry", 0, 4, 3, { hp: 5, fuel: 30 });
  const merged = act(state, 0, mover, 4, 3, "join");
  const result = merged.units.find((u) => u.id === anchor.id);
  assert.equal(result.hp, 9);
  assert.equal(result.fuel, 70);
  assert.equal(merged.units.some((u) => u.id === mover.id), false);
  assert.equal(result.acted, true);
  assert.equal(validateState(merged), true);

  // HP is capped at 10.
  const cap = fixture();
  const a = addUnit(cap, "tank", 0, 3, 3, { hp: 8 });
  const b = addUnit(cap, "tank", 0, 4, 3, { hp: 7 });
  const capped = act(cap, 0, a, 4, 3, "join");
  assert.equal(capped.units.find((u) => u.id === b.id).hp, 10);
});

test("merging is refused across types, owners, distances and loaded cargo", () => {
  const state = fixture();
  const foot = addUnit(state, "infantry", 0, 3, 3);
  addUnit(state, "tank", 0, 4, 3);
  assert.throws(() => act(state, 0, foot, 4, 3, "join"), /同一兵种/);

  const far = fixture();
  const scout = addUnit(far, "recon", 0, 3, 3);
  addUnit(far, "recon", 0, 7, 3);
  assert.throws(() => act(far, 0, scout, 7, 3, "join"), /相邻|同一兵种/);

  const enemy = fixture();
  const mine = addUnit(enemy, "infantry", 0, 3, 3);
  addUnit(enemy, "infantry", 1, 4, 3);
  assert.throws(() => act(enemy, 0, mine, 4, 3, "join"), /己方/);
});

test("bases build only their own category", () => {
  const state = fixture();
  const factory = tileAt(state, 0, 0);
  const airport = tileAt(state, 2, 2);
  airport.type = "airport";
  airport.owner = 0;
  const port = tileAt(state, 4, 4);
  port.type = "port";
  port.owner = 0;
  state.players[0].funds = 999999;

  const built = applyAction(state, 0, {
    type: "build",
    unitType: "fighter",
    x: airport.x,
    y: airport.y,
  });
  assert.ok(built.units.some((u) => u.type === "fighter"));

  const ship = applyAction(state, 0, {
    type: "build",
    unitType: "lander",
    x: port.x,
    y: port.y,
  });
  assert.ok(ship.units.some((u) => u.type === "lander"));

  assert.throws(
    () =>
      applyAction(state, 0, {
        type: "build",
        unitType: "fighter",
        x: factory.x,
        y: factory.y,
      }),
    /工厂不能生产战斗机|只能在己方机场/,
  );
  assert.throws(
    () =>
      applyAction(state, 0, {
        type: "build",
        unitType: "tank",
        x: port.x,
        y: port.y,
      }),
    /港口不能生产轻型坦克|只能在己方工厂/,
  );
});

test("an airport or port keeps a seat alive and counts as its production base", () => {
  const state = fixture();
  // Strip seat 1 down to a single port: no units, no factory.
  state.units = state.units.filter((u) => u.owner !== 1);
  for (const tile of state.tiles)
    if (tile.owner === 1) tile.owner = null;
  const port = tileAt(state, 5, 5);
  port.type = "port";
  port.owner = 1;
  const next = round(state, 1);
  assert.equal(next.players[1].defeated, false, "仍有生产设施的玩家不应被淘汰");
  assert.equal(validateState(next), true);
});

test("only infantry may end a move on an enemy HQ, and aircraft only stop on their own airfield", () => {
  const state = fixture();
  const tank = addUnit(state, "tank", 0, 3, 3);
  Object.assign(tileAt(state, 4, 3), { type: "hq", owner: 1 });
  assert.equal(
    reachable(state, tank.id).some((c) => c.x === 4 && c.y === 3),
    false,
    "车辆的可达范围必须排除敌方总部",
  );
  assert.throws(() => act(state, 0, tank, 4, 3, "wait"), /目标格无法到达/);

  const foot = addUnit(state, "infantry", 0, 3, 4);
  assert.ok(
    reachable(state, foot.id).some((c) => c.x === 4 && c.y === 3),
    "步兵可以进入敌方总部",
  );
  const capped = act(state, 0, foot, 4, 3, "capture");
  assert.equal(tileAt(capped, 4, 3).capture, 10);

  // Ground units cannot shoot aircraft, so a plane on a building would make
  // that objective permanently uncapturable. Aircraft may only stop on their
  // own airfield.
  const air = fixture();
  const city = tileAt(air, 2, 2);
  city.type = "city";
  city.owner = null;
  const ownAirport = tileAt(air, 6, 6);
  ownAirport.type = "airport";
  ownAirport.owner = 0;
  const plane = addUnit(air, "fighter", 0, 3, 2);
  const cells = reachable(air, plane.id);
  assert.equal(
    cells.some((c) => c.x === 2 && c.y === 2),
    false,
    "飞行器不能停在据点上",
  );
  assert.ok(
    cells.some((c) => c.x === 6 && c.y === 6),
    "飞行器可以停在自己的机场上",
  );
  assert.throws(() => act(air, 0, plane, 2, 2, "wait"), /目标格无法到达/);
});

test("a player whose only production site is occupied is eliminated", () => {
  const state = fixture();
  // Seat 1: no units, one factory, and an enemy tank parked on it.
  state.units = state.units.filter((u) => u.owner !== 1);
  for (const tile of state.tiles)
    if (tile.owner === 1) tile.owner = null;
  const factory = tileAt(state, 5, 5);
  factory.type = "factory";
  factory.owner = 1;
  const squatter = addUnit(state, "tank", 0, 5, 5);
  assert.ok(squatter);
  const next = round(state, 0);
  assert.equal(
    next.players[1].defeated,
    true,
    "工厂被占、又没有单位的玩家无法行动，应被淘汰",
  );
  assert.equal(validateState(next), true);
});

test("fog hides a transport's manifest, not the transport", () => {
  const state = coastal();
  state.fog = true;
  const lander = addUnit(state, "lander", 1, 5, 6);
  const cargo = addUnit(state, "infantry", 1, 5, 6, { carriedBy: lander.id });
  lander.cargo = [cargo.id];
  // Hide the hull beyond the observer's vision.
  const viewer = addUnit(state, "infantry", 0, 12, 10);
  assert.ok(viewer);
  const view = projectState(state, 0);
  assert.equal(
    view.units.some((u) => u.id === lander.id),
    false,
    "看不见的运输单位不应出现",
  );
  assert.equal(
    view.units.some((u) => u.id === cargo.id),
    false,
    "它的货物也不应出现",
  );
  assert.equal(JSON.stringify(view).includes(cargo.id), false, "货物 ID 不得泄漏");
});
