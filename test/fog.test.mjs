/**
 * M4: fog of war. Vision, concealment, team sharing, state projection and the
 * ambush that happens when a fogged route meets a hidden enemy.
 *
 * The load-bearing rule: `projectState` is the only thing a client is allowed
 * to see, so nothing it returns may reveal a hidden unit — not its identity,
 * not its HP, not the funds or capture progress it implies.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  UNITS,
  applyAction,
  attackable,
  createGame,
  isFoggedTile,
  projectState,
  reachable,
  seesUnit,
  validateState,
  visibleTiles,
} from "../public/shared/engine.mjs";
import { addUnit, fixture, moveAction, round, tileAt } from "./helpers.mjs";

const room = (state, seat) => projectState(state, seat);
const key = (x, y) => `${x},${y}`;

test("every unit declares a vision radius and the table is stable", () => {
  const expected = {
    infantry: 2,
    mech: 2,
    recon: 5,
    tank: 3,
    heavy: 2,
    artillery: 1,
    rocket: 1,
    apc: 1,
  };
  for (const [type, vision] of Object.entries(expected)) {
    assert.equal(UNITS[type].vision, vision, `${type} 视野`);
    assert.ok(Number.isInteger(vision) && vision >= 1, `${type} 视野必须是正数`);
  }
});

test("vision is a Manhattan radius around each allied unit", () => {
  const state = fixture();
  state.fog = true;
  const scout = addUnit(state, "recon", 0, 5, 5);
  const seen = visibleTiles(state, 0);

  // 半径 5 内可见，半径外不可见。
  assert.ok(seen.has(key(5, 5)), "自身格可见");
  assert.ok(seen.has(key(5, 0)), "正上方 5 格可见");
  assert.ok(seen.has(key(0, 5)), "正左方 5 格可见");
  assert.equal(seen.has(key(0, 0)), false, "对角 10 步不可见");
  assert.equal(seen.has(key(5, 11)), false, "正下方 6 格不可见");

  // 视野与地形无关：森林不会挡住视线，只会藏住站在里面的单位。
  assert.ok(seen.has(key(5, 6)), "邻近森林格仍然可见");

  // 视野随单位移动而变化。
  const moved = applyAction(state, 0, moveAction(scout, 6, 5));
  const movedSeen = visibleTiles(moved, 0);
  assert.ok(movedSeen.has(key(11, 5)), "移动后新位置可见");
  assert.equal(movedSeen.has(key(0, 5)), false, "离开后旧位置不可见");
});

test("teams share vision, opponents never do", () => {
  const state = fixture(4, true); // P0/P2 一队，P1/P3 一队
  state.fog = true;
  addUnit(state, "infantry", 0, 1, 1);
  addUnit(state, "infantry", 2, 12, 10);

  const team = visibleTiles(state, 0);
  assert.ok(team.has(key(1, 1)), "自己的单位可见");
  assert.ok(team.has(key(12, 10)), "队友的单位也提供视野");
  const mate = visibleTiles(state, 2);
  assert.deepEqual([...mate].sort(), [...team].sort(), "同队视野完全一致");

  const enemy = visibleTiles(state, 1);
  assert.equal(enemy.has(key(1, 1)), false, "敌方单位不提供视野");
  assert.equal(enemy.has(key(12, 10)), false);
});

test("forests hide units from anyone who is not adjacent", () => {
  const state = fixture();
  state.fog = true;
  const spotter = addUnit(state, "recon", 0, 2, 5); // 视野 5
  const hider = addUnit(state, "tank", 1, 5, 5);
  tileAt(state, 5, 5).type = "forest";

  assert.ok(visibleTiles(state, 0).has(key(5, 5)), "格子本身可见");
  assert.equal(seesUnit(state, 0, hider), false, "森林中的敌军不可见");

  // 平原上的同样距离单位可见。
  tileAt(state, 5, 5).type = "plain";
  assert.equal(seesUnit(state, 0, hider), true, "平原上的敌军可见");

  // 换回森林，但只要有一个己方单位贴上去就暴露。
  tileAt(state, 5, 5).type = "forest";
  assert.equal(seesUnit(state, 0, hider), false);
  addUnit(state, "infantry", 0, 4, 5);
  assert.equal(seesUnit(state, 0, hider), true, "相邻侦察后可见");

  // 山地同理；己方单位在任何地形上都不会被自己的迷雾藏起来。
  const watcher = addUnit(state, "recon", 0, 6, 8);
  const mountain = addUnit(state, "tank", 1, 8, 8);
  tileAt(state, 8, 8).type = "mountain";
  assert.equal(seesUnit(state, 0, mountain), false, "山地的敌军不可见");
  assert.ok(visibleTiles(state, 0).has(key(8, 8)), "山地格本身可见");
  assert.equal(seesUnit(state, 0, watcher), true, "己方单位永远可见");
});

test("fog off keeps the shared projection identical to the master state", () => {
  const state = fixture(4, true);
  addUnit(state, "tank", 0, 3, 3);
  addUnit(state, "infantry", 1, 9, 9);
  assert.equal(state.fog, false);
  // 无迷雾时不该复制状态：客户端与服务端用的是同一份数据。
  assert.equal(projectState(state, 0), state);
  assert.equal(projectState(state, 1), state);
});

test("a projection never leaks a hidden unit, its HP, or membership", () => {
  const state = fixture();
  state.fog = true;
  const watcher = addUnit(state, "tank", 0, 2, 2);
  const hidden = addUnit(state, "heavy", 1, 12, 10, { hp: 4, fuel: 9 });
  const visible = addUnit(state, "infantry", 1, 4, 2);

  const view = room(state, 0);
  const ids = view.units.map((u) => u.id);
  assert.ok(ids.includes(watcher.id), "己方单位必须保留");
  assert.ok(ids.includes(visible.id), "视野内的敌军必须保留");
  assert.equal(ids.includes(hidden.id), false, "视野外的敌军必须移除");

  // 隐藏单位不能通过任何其他字段暴露。
  const serialized = JSON.stringify(view);
  assert.equal(serialized.includes(hidden.id), false, "隐藏单位 ID 泄漏");
  assert.equal(serialized.includes("heavy"), false, "隐藏兵种泄漏");
  assert.equal(
    view.units.some((u) => u.hp === 4 && u.owner === 1 && u.x === 12),
    false,
    "隐藏单位的位置与血量泄漏",
  );

  // 其他玩家的资金与能量对本人以外不可见。
  const enemy = view.players.find((p) => p.id === 1);
  assert.equal(enemy.funds, null, "敌方资金必须隐藏");
  assert.equal(enemy.energy, null, "敌方能量必须隐藏");
  assert.equal(view.players[0].funds, state.players[0].funds, "自己的资金保留");

  // 投影是客户端视图而不是存档：资金已被置空、隐藏单位已被删除，因此它不满足
  // validateState。要守的是另外两条——序列化不夹带，重复投影不漂移。
  assert.equal(
    JSON.stringify(JSON.parse(JSON.stringify(view))).includes(hidden.id),
    false,
    "序列化后仍不得夹带隐藏单位",
  );
  assert.deepEqual(projectState(view, 0), view, "重复投影必须幂等");
});

test("vision follows the unit, so stale information disappears", () => {
  const state = fixture();
  state.fog = true;
  const scout = addUnit(state, "recon", 0, 2, 2);
  const target = addUnit(state, "infantry", 1, 6, 2);
  assert.ok(room(state, 0).units.some((u) => u.id === target.id), "进入视野后可见");

  // 侦察车撤走，敌方单位从投影中消失——没有残影。
  const gone = applyAction(state, 0, moveAction(scout, 2, 6));
  assert.equal(
    room(gone, 0).units.some((u) => u.id === target.id),
    false,
    "离开视野后必须消失",
  );
});

test("capture progress is only reported where the seat has vision", () => {
  const state = fixture();
  state.fog = true;
  const mine = addUnit(state, "infantry", 0, 2, 2);
  const theirs = addUnit(state, "infantry", 1, 12, 10);
  tileAt(state, 2, 3).type = "city";
  tileAt(state, 12, 9).type = "city";

  const contested = applyAction(state, 0, moveAction(mine, 2, 3, "capture"));
  const view = room(contested, 0);
  // 满血步兵一次占领扣 10 点，20 起步剩 10。
  assert.equal(tileAt(view, 2, 3).capture, 10, "视野内的占领进度可见");
  assert.equal(tileAt(view, 2, 3).captureBy, 0, "视野内的占领者可见");

  // 敌方在自己的视野内占领；对 P0 来说那一格不在视野中。
  const next = applyAction(contested, 0, { type: "endTurn" });
  const byEnemy = applyAction(next, 1, moveAction(theirs, 12, 9, "capture"));
  const enemyView = room(byEnemy, 0);
  assert.equal(tileAt(enemyView, 12, 9).capture, 20, "视野外的占领进度被清空");
  assert.equal(tileAt(enemyView, 12, 9).captureBy, null);
  assert.equal(tileAt(byEnemy, 12, 9).capture, 10, "主状态仍记录真实进度");
});

test("property ownership stays public so players can plan objectives", () => {
  const state = fixture();
  state.fog = true;
  addUnit(state, "infantry", 0, 2, 2);
  tileAt(state, 12, 10).type = "factory";
  tileAt(state, 12, 10).owner = 1;

  const view = room(state, 0);
  assert.equal(tileAt(view, 12, 10).owner, 1, "建筑归属始终可见");
  assert.equal(tileAt(view, 12, 10).type, "factory", "地形始终可见");
});

test("private log lines stay with their seat", () => {
  const state = fixture();
  state.fog = true;
  state.players[0].funds = 9000;

  // P0 生产一支步兵：费用只应写进 P0 自己的日志。
  const afterBuild = applyAction(state, 0, {
    type: "build",
    unitType: "infantry",
    x: 0,
    y: 0,
  });
  assert.equal(validateState(afterBuild), true, "私有日志仍是合法状态");
  const mine = room(afterBuild, 0).log.join("\n");
  const theirs = room(afterBuild, 1).log.join("\n");
  assert.match(mine, /生产了步兵/, "本人能看到自己的生产记录");
  assert.equal(/生产了步兵/.test(theirs), false, "对手看不到生产记录");
  assert.equal(/1000|（−/.test(theirs), false, "对手看不到花费金额");
});

test("fog is part of the persisted state and must be declared", () => {
  const state = fixture();
  state.fog = true;
  assert.equal(validateState(state), true);
  const broken = structuredClone(state);
  delete broken.fog;
  assert.throws(() => validateState(broken), /迷雾/);
});

test("a route that crosses a hidden enemy stops before it and ends the action", () => {
  const state = fixture();
  state.fog = true;
  const mover = addUnit(state, "tank", 0, 3, 3);
  const ambusher = addUnit(state, "heavy", 1, 5, 3);
  tileAt(state, 5, 3).type = "forest"; // 藏住埋伏者
  addUnit(state, "infantry", 0, 3, 8); // 只给远处一点视野，看不到 (5,3)

  assert.equal(seesUnit(state, 0, ambusher), false, "埋伏者应当不可见");
  // 客户端按「忽略隐形阻挡」画出的路线确实会走过 (5,3)。
  assert.ok(
    !reachable(state, mover.id).some((c) => c.x === 5 && c.y === 3),
    "主状态里该格不可达",
  );

  const ambushed = applyAction(state, 0, moveAction(mover, 6, 3, "wait"));
  const moved = ambushed.units.find((u) => u.id === mover.id);
  assert.equal(moved.x, 4, "行军应停在碰撞格之前");
  assert.equal(moved.y, 3);
  assert.equal(moved.acted, true, "遭遇埋伏消耗本次行动");
  assert.ok(
    ambushed.log.some((line) =>
      (typeof line === "string" ? line : line.message).includes("埋伏"),
    ),
    "日志应记录遭遇埋伏",
  );
  assert.equal(validateState(ambushed), true);
});

test("a hidden enemy does not block movement into the tiles beyond it", () => {
  const state = fixture();
  state.fog = true;
  const mover = addUnit(state, "tank", 0, 3, 3);
  const ambusher = addUnit(state, "heavy", 1, 5, 3);
  tileAt(state, 5, 3).type = "forest";

  const ambushed = applyAction(state, 0, moveAction(mover, 6, 3, "wait"));
  const moved = ambushed.units.find((u) => u.id === mover.id);
  assert.equal(moved.x, 4, "停在埋伏者前");
  assert.equal(
    ambushed.units.some((u) => u.id === ambusher.id && u.x === 5 && u.y === 3),
    true,
    "埋伏者留在原地",
  );
  // 埋伏者未被攻击，双方血量不变。
  assert.equal(ambushed.units.find((u) => u.id === ambusher.id).hp, 10);
  assert.equal(moved.hp, 10);
});

test("an ambush never fires a queued attack at a different target", () => {
  const state = fixture();
  state.fog = true;
  // 侦察车视野 5、射程 1：诱饵在视野内，且正好落在原定终点的相邻格。
  const mover = addUnit(state, "recon", 0, 3, 3);
  const ambusher = addUnit(state, "heavy", 1, 5, 3);
  tileAt(state, 5, 3).type = "forest";
  const decoy = addUnit(state, "infantry", 1, 7, 3);

  assert.equal(seesUnit(state, 0, decoy), true, "诱饵可见");
  assert.ok(
    attackable(state, mover.id, { x: 6, y: 3 }).includes(decoy.id),
    "按原计划应当可以攻击诱饵",
  );
  // 对照组：没有埋伏者时，同一条命令会走到 (6,3) 并真的打掉诱饵的血。
  const control = fixture();
  const free = addUnit(control, "recon", 0, 3, 3);
  const bait = addUnit(control, "infantry", 1, 7, 3);
  const struck = applyAction(
    control,
    0,
    moveAction(free, 6, 3, "attack", bait.id),
  );
  assert.equal(struck.units.find((u) => u.id === free.id).x, 6);
  assert.ok(struck.units.find((u) => u.id === bait.id).hp < 10, "无埋伏时攻击命中");

  const ambushed = applyAction(
    state,
    0,
    moveAction(mover, 6, 3, "attack", decoy.id),
  );
  assert.equal(
    ambushed.units.find((u) => u.id === decoy.id).hp,
    10,
    "埋伏后不得结算原先的攻击",
  );
  assert.equal(ambushed.units.find((u) => u.id === mover.id).x, 4);
  assert.equal(validateState(ambushed), true);
});

test("without fog the same order simply reaches its destination", () => {
  const state = fixture();
  const mover = addUnit(state, "tank", 0, 3, 3);
  addUnit(state, "heavy", 1, 5, 3);
  const moved = applyAction(state, 0, moveAction(mover, 6, 3, "wait"));
  assert.equal(moved.units.find((u) => u.id === mover.id).x, 6, "无迷雾时正常行进");
});

test("fog never changes what the rules allow, only what a client sees", () => {
  const build = (fog) => {
    const state = fixture();
    state.fog = fog;
    const a = addUnit(state, "tank", 0, 3, 3);
    const b = addUnit(state, "infantry", 1, 4, 3);
    return { state, a, b };
  };
  const clear = build(false);
  const foggy = build(true);

  const attackableClear = attackable(clear.state, clear.a.id);
  const attackableFoggy = attackable(foggy.state, foggy.a.id);
  assert.deepEqual(attackableFoggy, attackableClear, "可攻击目标与迷雾无关");

  const reachClear = reachable(clear.state, clear.a.id).length;
  const reachFoggy = reachable(foggy.state, clear.a.id).length;
  assert.equal(reachFoggy, reachClear, "移动范围与迷雾无关");

  // 隐藏单位的攻击仍然会被主状态接受：规则不因客户端看不见而放水。
  // 间接火力不受「相邻即暴露」影响，正好用来构造一个看不见却打得到的靶子。
  const hidden = fixture();
  hidden.fog = true;
  const gun = addUnit(hidden, "artillery", 0, 3, 3);
  const target = addUnit(hidden, "infantry", 1, 6, 3);
  tileAt(hidden, 6, 3).type = "forest";
  assert.equal(seesUnit(hidden, 0, target), false, "射程内的森林敌军不可见");
  assert.ok(
    attackable(hidden, gun.id).includes(target.id),
    "看不见不影响可攻击性",
  );
  const settled = applyAction(
    hidden,
    0,
    moveAction(gun, 3, 3, "attack", target.id),
  );
  assert.ok(
    settled.units.find((u) => u.id === target.id).hp < 10,
    "攻击仍然生效",
  );
});

test("isFoggedTile answers per seat and stays false without fog", () => {
  const state = fixture();
  addUnit(state, "infantry", 0, 1, 1);
  assert.equal(isFoggedTile(state, 0, 12, 10), false, "无迷雾时处处可见");

  state.fog = true;
  assert.equal(isFoggedTile(state, 0, 1, 1), false, "己方单位所在格可见");
  assert.equal(isFoggedTile(state, 0, 12, 10), true, "远处不可见");
  assert.equal(isFoggedTile(state, 0, 2, 1), false, "视野半径之内可见");
});

test("a fogged match survives a full turn cycle and validates at every step", () => {
  let state = createGame({
    mapId: "training",
    fog: true,
    players: [
      { id: 0, name: "甲", team: 0, commander: "vanguard", controller: "ai" },
      { id: 1, name: "乙", team: 1, commander: "mechanic", controller: "ai" },
    ],
  });
  assert.equal(state.fog, true);
  assert.equal(validateState(state), true);

  // 走完整整两轮：每个席位一次，确认迷雾下的回合结算与投影都成立。
  for (let step = 0; step < 4; step++) {
    const seat = state.currentPlayer;
    state = applyAction(state, seat, { type: "endTurn" });
    assert.equal(validateState(state), true, `第 ${step} 步状态无效`);
    assert.equal(projectState(state, 0).fog, true, "投影保留迷雾开关");
    assert.equal(projectState(state, 1).fog, true);
  }
  assert.equal(state.turn, 5, "四个席位应推进四回合");
  assert.equal(state.day, 3, "两轮之后应进入第 3 天");
});
