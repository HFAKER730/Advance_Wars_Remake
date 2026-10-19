import test from "node:test";
import assert from "node:assert/strict";
import {
  UNITS,
  MAPS,
  createGame,
  reachable,
  attackable,
  previewCombat,
  applyAction,
  chooseAIAction,
  validateState,
} from "../public/shared/engine.mjs";
const players = (n = 2, teams = false) =>
  Array.from({ length: n }, (_, id) => ({
    id,
    name: `玩家${id}`,
    team: teams ? id % 2 : id,
    commander: id % 2 ? "mechanic" : "vanguard",
    controller: "ai",
  }));
function fixture(n = 2, teams = false) {
  const s = createGame({ mapId: "training", players: players(n, teams) });
  s.tiles.forEach((t) =>
    Object.assign(t, {
      type: "plain",
      owner: null,
      capture: 20,
      captureBy: null,
    }),
  );
  s.units = [];
  s.nextUnitId = 1;
  s.players.forEach((p, i) => {
    Object.assign(s.tiles[i], { type: "factory", owner: p.id });
    p.funds = 10000;
  });
  return s;
}
function add(s, type, owner, x, y, properties = {}) {
  const d = UNITS[type];
  const u = {
    id: `u${s.nextUnitId++}`,
    type,
    owner,
    x,
    y,
    hp: 10,
    ammo: d.maxAmmo,
    fuel: d.maxFuel,
    acted: false,
    cargo: null,
    ...properties,
  };
  s.units.push(u);
  return u;
}
const tile = (s, x, y) => s.tiles[y * s.width + x];
const move = (u, x = u.x, y = u.y, command = "wait", targetId) => ({
  type: "move",
  unitId: u.id,
  x,
  y,
  command,
  ...(targetId ? { targetId } : {}),
});
function round(s) {
  const seat = s.currentPlayer;
  do s = applyAction(s, s.currentPlayer, { type: "endTurn" });
  while (s.currentPlayer !== seat && s.phase === "playing");
  return s;
}

test("every map starts valid with 2–4 seats and a usable production base", () => {
  for (const map of MAPS)
    for (const count of [2, 3, 4]) {
      const s = createGame({ mapId: map.id, players: players(count) });
      assert.equal(validateState(s), true);
      assert.equal(s.units.length, count * 4);
      for (const p of s.players) {
        assert.equal(
          s.tiles.filter((t) => t.owner === p.id && t.type === "hq").length,
          1,
        );
        // 机场从第一回合起就属于席位，否则新兵种只能等玩家去抢中立机场。
        assert.ok(
          s.tiles.some((t) => t.owner === p.id && t.type === "factory"),
          `${map.id} 的席位 ${p.id} 缺少工厂`,
        );
        assert.ok(
          s.tiles.some((t) => t.owner === p.id && t.type === "airport"),
          `${map.id} 的席位 ${p.id} 缺少机场`,
        );
      }
      // 初始资金 = 5000 + 己方据点收入。机场与港口同样产生收入，据点数随地图不同。
      const income = s.tiles
        .filter(
          (t) =>
            t.owner === 0 &&
            ["city", "factory", "hq", "airport", "port"].includes(t.type),
        )
        .length * 1000;
      assert.equal(s.players[0].funds, 5000 + income, `${map.id} 初始资金`);
      assert.ok(income >= 3000, `${map.id} 的初始据点应至少有 3 座`);
    }
  assert.equal(validateState(createGame({ players: players(4, true) })), true);
  assert.throws(
    () => createGame({ players: players().map((p) => ({ ...p, team: 0 })) }),
    /队伍/,
  );
});

test("atomic move rejects illegal commands without mutating original", () => {
  const s = fixture(),
    u = add(s, "tank", 0, 3, 3),
    before = structuredClone(s);
  assert.throws(() => applyAction(s, 1, move(u, 4, 3)), /轮到/);
  assert.throws(() => applyAction(s, 0, move(u, 4, 3, "capture")), /步兵/);
  assert.throws(() => applyAction(s, 0, move(u, 12, 10)), /无法到达/);
  assert.deepEqual(s, before);
  const next = applyAction(s, 0, move(u, 4, 3));
  assert.equal(next.units[0].x, 4);
  assert.equal(next.units[0].fuel, 69);
  assert.equal(next.units[0].acted, true);
  assert.deepEqual(s, before);
  assert.throws(
    () => applyAction(next, 0, move(next.units[0], 5, 3)),
    /已经行动/,
  );
});

test("movement handles allied traversal, blocked enemy tiles, terrain and fuel", () => {
  const s = fixture(4, true),
    u = add(s, "tank", 0, 3, 3, { fuel: 2 });
  add(s, "infantry", 2, 4, 3);
  add(s, "tank", 1, 3, 2);
  tile(s, 2, 3).type = "mountain";
  tile(s, 3, 4).type = "water";
  const cells = reachable(s, u.id);
  assert.ok(cells.some((p) => p.x === 5 && p.y === 3 && p.cost === 2));
  for (const [x, y] of [
    [4, 3],
    [3, 2],
    [2, 3],
    [3, 4],
    [6, 3],
  ])
    assert.ok(!cells.some((p) => p.x === x && p.y === y));
  assert.deepEqual(cells.find((p) => p.x === 5 && p.y === 3).path, [
    { x: 3, y: 3 },
    { x: 4, y: 3 },
    { x: 5, y: 3 },
  ]);
  u.type = "infantry";
  u.ammo = null;
  assert.ok(
    reachable(s, u.id).some((p) => p.x === 2 && p.y === 3 && p.cost === 2),
  );
});

test("combat is deterministic, accounts for cover, counters and excludes allies", () => {
  const s = fixture(4, true),
    a = add(s, "tank", 0, 3, 3),
    b = add(s, "tank", 1, 4, 3),
    ally = add(s, "infantry", 2, 3, 4);
  assert.deepEqual(attackable(s, a.id), [b.id]);
  assert.ok(!attackable(s, a.id).includes(ally.id));
  const plain = previewCombat(s, a.id, b.id);
  tile(s, 4, 3).type = "city";
  const cover = previewCombat(s, a.id, b.id);
  assert.ok(cover.damage < plain.damage);
  assert.ok(cover.counter > 0);
  const next = applyAction(s, 0, move(a, 3, 3, "attack", b.id));
  assert.equal(next.units.find((u) => u.id === b.id).hp, 10 - cover.damage);
  assert.equal(next.units.find((u) => u.id === a.id).hp, 10 - cover.counter);
  assert.equal(next.units.find((u) => u.id === a.id).ammo, 5);
  assert.equal(next.units.find((u) => u.id === b.id).ammo, 5);
  assert.deepEqual(applyAction(s, 0, move(a, 3, 3, "attack", b.id)), next);
});

test("indirect fire cannot move and fire, shoot inside minimum range, or counter", () => {
  const s = fixture(),
    a = add(s, "artillery", 0, 3, 3),
    b = add(s, "tank", 1, 6, 3);
  assert.ok(attackable(s, a.id).includes(b.id));
  assert.deepEqual(attackable(s, a.id, { x: 4, y: 3 }), []);
  assert.throws(
    () => applyAction(s, 0, move(a, 4, 3, "attack", b.id)),
    /移动后/,
  );
  assert.equal(previewCombat(s, a.id, b.id).counter, 0);
  const close = add(s, "tank", 1, 3, 4);
  assert.ok(!attackable(s, a.id).includes(close.id));
  assert.equal(previewCombat(s, close.id, a.id).counter, 0);
  a.ammo = 0;
  assert.deepEqual(attackable(s, a.id), []);
  assert.throws(() => applyAction(s, 0, move(a, 3, 3, "attack", b.id)), /弹药/);
});

test("capture requires two healthy infantry turns, and leaving resets progress", () => {
  let s = fixture(),
    u = add(s, "infantry", 0, 3, 3);
  tile(s, 3, 3).type = "city";
  s = applyAction(s, 0, move(u, 3, 3, "capture"));
  assert.equal(tile(s, 3, 3).capture, 10);
  assert.equal(tile(s, 3, 3).captureBy, 0);
  const continued = applyAction(round(s), 0, move(u, 3, 3, "capture"));
  assert.equal(tile(continued, 3, 3).owner, 0);
  assert.equal(tile(continued, 3, 3).capture, 20);
  const left = applyAction(round(s), 0, move(u, 4, 3));
  assert.equal(tile(left, 3, 3).capture, 20);
  assert.equal(tile(left, 3, 3).captureBy, null);
});

test("destroying a capturing infantry resets its capture progress", () => {
  let s = fixture(),
    u = add(s, "infantry", 0, 3, 3, { hp: 1 }),
    enemy = add(s, "heavy", 1, 4, 3);
  tile(s, 3, 3).type = "city";
  s = applyAction(s, 0, move(u, 3, 3, "capture"));
  s = applyAction(s, 0, { type: "endTurn" });
  s = applyAction(s, 1, move(enemy, 4, 3, "attack", u.id));
  assert.equal(
    s.units.some((a) => a.id === u.id),
    false,
  );
  assert.equal(tile(s, 3, 3).capture, 20);
  assert.equal(validateState(s), true);
});

test("HQ capture removes defeated army and properties but a surviving teammate continues", () => {
  let s = fixture(4, true),
    u = add(s, "infantry", 0, 3, 3);
  add(s, "tank", 1, 5, 3);
  add(s, "tank", 2, 8, 3);
  add(s, "tank", 3, 10, 3);
  Object.assign(tile(s, 3, 3), {
    type: "hq",
    owner: 1,
    capture: 10,
    captureBy: 0,
  });
  s = applyAction(s, 0, move(u, 3, 3, "capture"));
  assert.equal(s.players[1].defeated, true);
  assert.equal(
    s.units.some((a) => a.owner === 1),
    false,
  );
  assert.equal(tile(s, 3, 3).owner, 0);
  assert.equal(s.tiles[1].owner, null);
  assert.equal(s.phase, "playing");
  s = applyAction(s, 0, { type: "endTurn" });
  assert.equal(s.currentPlayer, 2);
  s = applyAction(s, 2, { type: "endTurn" });
  s = applyAction(s, 3, { type: "surrender" });
  assert.equal(s.phase, "finished");
  assert.equal(s.winner, 0);
  assert.equal(validateState(s), true);
});

test("production spends funds, requires empty owned factory, and new units cannot act", () => {
  let s = fixture();
  assert.throws(
    () => applyAction(s, 0, { type: "build", unitType: "tank", x: 1, y: 0 }),
    /己方工厂/,
  );
  s = applyAction(s, 0, { type: "build", unitType: "tank", x: 0, y: 0 });
  assert.equal(s.players[0].funds, 3000);
  assert.equal(s.units[0].acted, true);
  assert.throws(
    () =>
      applyAction(s, 0, { type: "build", unitType: "infantry", x: 0, y: 0 }),
    /占用/,
  );
  assert.throws(() => applyAction(s, 0, move(s.units[0])), /已经行动/);
  const next = round(s);
  assert.equal(next.units[0].acted, false);
  assert.equal(next.players[0].funds, 4000);
});

test("property repairs are funded, resupply is free, and APC refills adjacent allies", () => {
  let s = fixture(4, true),
    a = add(s, "tank", 0, 0, 0, { hp: 4, ammo: 0, fuel: 0 });
  s.players[0].funds = 0;
  s = round(s);
  const repaired = s.units.find((u) => u.id === a.id);
  assert.equal(repaired.hp, 5);
  assert.equal(s.players[0].funds, 300);
  assert.equal(repaired.ammo, 6);
  assert.equal(repaired.fuel, 70);
  const apc = add(s, "apc", 0, 3, 3),
    ally = add(s, "tank", 2, 4, 3, { ammo: 0, fuel: 1 });
  s = applyAction(s, 0, move(apc, 3, 3, "supply"));
  assert.equal(s.units.find((u) => u.id === ally.id).ammo, 6);
  assert.equal(s.units.find((u) => u.id === ally.id).fuel, 70);
});

test("CO powers cost 50/100, persist through enemy turn, then expire", () => {
  let s = fixture(),
    a = add(s, "tank", 0, 3, 3);
  s.players[0].energy = 100;
  const beforeRange = reachable(s, a.id).length;
  s = applyAction(s, 0, { type: "power", level: "super" });
  assert.equal(s.players[0].energy, 0);
  assert.equal(s.players[0].power, "super");
  assert.ok(reachable(s, a.id).length > beforeRange);
  assert.throws(
    () => applyAction(s, 0, { type: "power", level: "power" }),
    /已经发动/,
  );
  s = applyAction(s, 0, { type: "endTurn" });
  assert.equal(s.players[0].power, "super");
  s = applyAction(s, 1, { type: "endTurn" });
  assert.equal(s.players[0].power, null);
  s.currentPlayer = 1;
  s.players[1].energy = 50;
  const b = add(s, "heavy", 1, 5, 5, { hp: 3, ammo: 0, fuel: 0, acted: true });
  s = applyAction(s, 1, { type: "power", level: "power" });
  assert.equal(s.units.find((u) => u.id === b.id).hp, 5);
  assert.equal(s.units.find((u) => u.id === b.id).ammo, 5);
  assert.equal(s.units.find((u) => u.id === b.id).acted, true);
});

test("validation rejects corrupted positions, IDs, resources, captures and turn owner", () => {
  const original = createGame();
  const changes = [
    (s) => {
      s.units[0].x = -1;
    },
    (s) => {
      s.units[0].id = s.units[1].id;
    },
    (s) => {
      s.players[0].funds = -1;
    },
    (s) => {
      s.units[0].hp = 0;
    },
    (s) => {
      s.currentPlayer = 9;
    },
    (s) => {
      s.tiles[0].owner = 0;
    },
    (s) => {
      s.nextUnitId = 1;
    },
    (s) => {
      s.tiles[0].capture = 10;
    },
    (s) => {
      s.units[0].ammo = 100;
    },
    (s) => {
      s.version = 2;
    },
  ];
  for (const mutate of changes) {
    const s = structuredClone(original);
    mutate(s);
    assert.throws(() => validateState(s));
  }
  assert.equal(validateState(JSON.parse(JSON.stringify(original))), true);
});

test("AI uses only legal actions and ends its turns on every map and player count", () => {
  for (const mapId of ["training", "river", "crossroads"])
    for (const count of [2, 3, 4]) {
      let s = createGame({ mapId, players: players(count) });
      for (let i = 0; i < 150 && s.phase === "playing"; i++) {
        const action = chooseAIAction(s, s.currentPlayer);
        try {
          s = applyAction(s, s.currentPlayer, action);
        } catch (error) {
          throw new Error(
            `${mapId}/${count} step ${i}: ${JSON.stringify(action)}: ${error.message}`,
          );
        }
        validateState(s);
      }
      assert.ok(
        s.turn >= count * 2,
        `${mapId}/${count}: AI must finish multiple turns`,
      );
    }
});

test("AI resolves a winning HQ capture and returns endTurn after all units act", () => {
  let s = fixture(),
    u = add(s, "infantry", 0, 3, 3);
  Object.assign(tile(s, 3, 3), {
    type: "hq",
    owner: 1,
    capture: 10,
    captureBy: 0,
  });
  s.players[0].funds = 0;
  const action = chooseAIAction(s, 0);
  assert.equal(action.command, "capture");
  s = applyAction(s, 0, action);
  assert.equal(s.phase, "finished");
  assert.equal(s.winner, 0);
  s = fixture();
  u = add(s, "tank", 0, 3, 3, { acted: true });
  s.players[0].funds = 0;
  assert.deepEqual(chooseAIAction(s, 0), { type: "endTurn" });
});

test("losing the last unit by counterattack skips a defeated current seat", () => {
  let s = fixture(3),
    a = add(s, "infantry", 0, 3, 3, { hp: 1 }),
    b = add(s, "heavy", 1, 4, 3);
  Object.assign(s.tiles[0], { type: "plain", owner: null });
  s = applyAction(s, 0, move(a, 3, 3, "attack", b.id));
  assert.equal(s.players[0].defeated, true);
  assert.equal(s.currentPlayer, 1);
  assert.equal(s.phase, "playing");
  assert.equal(validateState(s), true);
});

test("AI clears a blockaded HQ for infantry instead of creating an endless traffic jam", () => {
  let s = fixture(),
    armor = add(s, "tank", 0, 3, 3),
    infantry = add(s, "infantry", 0, 4, 3, { acted: true });
  Object.assign(tile(s, 3, 3), { type: "hq", owner: 1 });
  const action = chooseAIAction(s, 0);
  assert.equal(action.unitId, armor.id);
  assert.ok(action.x !== 3 || action.y !== 3);
  s = applyAction(s, 0, action);
  s = round(s);
  const capture = chooseAIAction(s, 0);
  assert.equal(capture.unitId, infantry.id);
  assert.equal(capture.command, "capture");
  assert.equal(capture.x, 3);
  assert.equal(capture.y, 3);
});

test("full AI matches reach real victory on every map, seat count and team mode", () => {
  // M5 added ships and aircraft, which lengthens matches: the AI now spends
  // turns crossing water and refitting at airfields. The ceiling is a stall
  // detector, not a performance target.
  for (const mapId of ["training", "river", "crossroads", "coast"])
    for (const [count, teams] of [
      [2, false],
      [3, false],
      [4, false],
      [4, true],
    ]) {
      let s = createGame({ mapId, players: players(count, teams) });
      let steps = 0;
      for (; steps < 6000 && s.phase === "playing"; steps++) {
        const action = chooseAIAction(s, s.currentPlayer);
        s = applyAction(s, s.currentPlayer, action);
        validateState(s);
      }
      assert.equal(
        s.phase,
        "finished",
        `${mapId}/${count}/${teams}: no victory after ${steps} actions`,
      );
      assert.notEqual(s.winner, null);
      assert.ok(s.players.some((p) => p.defeated));
      assert.deepEqual(
        [...new Set(s.players.filter((p) => !p.defeated).map((p) => p.team))],
        [s.winner],
      );
    }
});
