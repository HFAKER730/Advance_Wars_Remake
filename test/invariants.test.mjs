/**
 * Rule correctness suite: command validation matrix plus state invariants that
 * must hold after every applied action. Illegal commands must never mutate the
 * state, and every settled state must stay self-consistent.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  UNITS,
  applyAction,
  attackable,
  canCapture,
  chooseAIAction,
  createGame,
  previewCombat,
  reachable,
  validateState,
} from "../public/shared/engine.mjs";
import {
  addUnit,
  fixture,
  livePlayers,
  liveTeams,
  moveAction,
  round,
  tileAt,
} from "./helpers.mjs";

const seats = (count, teams = false) =>
  Array.from({ length: count }, (_, id) => ({
    id,
    name: `席位${id}`,
    team: teams ? id % 2 : id,
    commander: id % 2 ? "mechanic" : "vanguard",
    controller: "ai",
  }));

/** Asserts the command is refused and that the input state is left untouched. */
function rejected(state, seat, action, pattern) {
  const before = structuredClone(state);
  assert.throws(() => applyAction(state, seat, action), pattern);
  assert.deepEqual(state, before, "被拒绝的指令不能改变原状态");
}

test("rejected commands leave the state untouched across every action type", () => {
  const state = fixture(4, true);
  const unit = addUnit(state, "tank", 0, 3, 3);
  const ally = addUnit(state, "tank", 2, 4, 3);
  const enemy = addUnit(state, "infantry", 1, 3, 5);
  tileAt(state, 3, 3).type = "city";

  // 身份与回合
  rejected(state, 1, { type: "endTurn" }, /轮到/);
  rejected(state, 1, { type: "surrender" }, /轮到/);
  rejected(state, 1, { type: "build", unitType: "infantry", x: 1, y: 0 }, /轮到/);
  rejected(state, 1, { type: "power", level: "power" }, /轮到/);
  rejected(state, 9, { type: "endTurn" }, /玩家不存在/);

  // 指令结构
  for (const action of [null, [], "endTurn", 42, { type: "nuke" }])
    rejected(state, 0, action, /行动格式|未知行动/);
  rejected(state, 0, { type: "move" }, /只能指挥己方单位/);

  // 移动、路径与子指令
  rejected(state, 0, moveAction(unit, 99, 3), /无法到达/);
  rejected(state, 0, moveAction(unit, 3.5, 3), /无法到达/);
  rejected(state, 0, moveAction(unit, 4, 3), /无法到达/, "盟友所在格不能作为终点");
  rejected(state, 0, moveAction(unit, 3, 3, "teleport"), /不支持此单位指令/);
  rejected(state, 0, { ...moveAction(unit, 3, 3), unitId: "u999" }, /只能指挥己方单位/);
  rejected(state, 0, moveAction(unit, 3, 3, "attack", ally.id), /可攻击范围/);
  rejected(state, 0, moveAction(unit, 3, 3, "attack", enemy.id), /可攻击范围/, "射程外的目标");
  rejected(state, 0, moveAction(unit, 3, 3, "capture"), /步兵/);
  rejected(state, 0, moveAction(unit, 3, 3, "supply"), /补给车/);

  // 生产与能力
  rejected(state, 0, { type: "build", unitType: "dragon", x: 0, y: 0 }, /兵种不存在/);
  rejected(state, 0, { type: "build", unitType: "constructor", x: 0, y: 0 }, /兵种不存在/);
  rejected(state, 0, { type: "build", unitType: "infantry", x: 3, y: 3 }, /工厂/);
  rejected(state, 0, { type: "build", unitType: "heavy", x: 0, y: 0 }, /资金不足/);
  rejected(state, 0, { type: "power" }, /能力类型无效/);
  rejected(state, 0, { type: "power", level: "mega" }, /能力类型无效/);
  rejected(state, 0, { type: "power", level: "super" }, /能量不足/);

  assert.equal(unit.acted, false);
  assert.deepEqual([unit.x, unit.y], [3, 3]);
});

test("an acted unit cannot act again until its next turn", () => {
  let state = fixture();
  const unit = addUnit(state, "tank", 0, 3, 3);
  state = applyAction(state, 0, moveAction(unit, 4, 3));
  rejected(state, 0, moveAction(state.units[0], 5, 3), /已经行动/);
  assert.deepEqual(attackable(state, state.units[0].id), [], "已行动单位没有可攻击目标");
  state = applyAction(state, 0, { type: "endTurn" });
  state = applyAction(state, 1, { type: "endTurn" });
  assert.equal(state.units[0].acted, false);
  state = applyAction(state, 0, moveAction(state.units[0], 5, 3));
  assert.equal(state.units[0].x, 5);
});

test("indirect fire never fires after moving, inside minimum range, or on counter", () => {
  const state = fixture();
  const artillery = addUnit(state, "artillery", 0, 3, 3);
  const far = addUnit(state, "artillery", 1, 6, 3);
  const adjacent = addUnit(state, "tank", 1, 3, 4);

  // 火炮射程 1；相邻 1 格的敌人不在目标内。
  assert.ok(attackable(state, artillery.id).includes(far.id));
  assert.ok(!attackable(state, artillery.id).includes(adjacent.id), "最小射程内不能开火");
  assert.equal(previewCombat(state, adjacent.id, artillery.id).counter, 0, "被间接火力打到不反击");

  const fired = applyAction(state, 0, moveAction(artillery, 3, 3, "attack", far.id));
  assert.ok(fired.units.find((u) => u.id === far.id).hp < 10);
  assert.equal(fired.units.find((u) => u.id === artillery.id).hp, 10);
  assert.equal(fired.units.find((u) => u.id === artillery.id).ammo, 5);
});

test("indirect fire is refused after any move, including within the same tile check", () => {
  const state = fixture();
  const artillery = addUnit(state, "artillery", 0, 3, 3);
  const far = addUnit(state, "artillery", 1, 6, 3);
  // 移动到身旁的空格再开火必须被拒绝，且状态不变。
  rejected(state, 0, moveAction(artillery, 4, 3, "attack", far.id), /移动后/);
  assert.deepEqual(attackable(state, artillery.id, { x: 4, y: 3 }), []);
});

test("capture legality has one shared definition used by client and server", () => {
  const state = fixture(4, true);
  const infantry = addUnit(state, "infantry", 0, 3, 3);
  const tank = addUnit(state, "tank", 0, 6, 3);
  tileAt(state, 3, 3).type = "city";
  tileAt(state, 3, 3).owner = 2; // 同队盟友的建筑
  tileAt(state, 4, 3).type = "city"; // 中立建筑
  tileAt(state, 1, 1).type = "plain";

  assert.equal(canCapture(state, 0, infantry, 3, 3), false, "不能占领盟友建筑");
  assert.equal(canCapture(state, 0, infantry, 4, 3), true, "可以占领中立建筑");
  assert.equal(canCapture(state, 0, tank, 4, 3), false, "车辆不能占领");
  assert.equal(canCapture(state, 0, infantry, 1, 1), false, "平原不能占领");
  assert.equal(canCapture(state, 1, infantry, 4, 3), false, "不能替代其他玩家出手");

  // 共享判定与引擎必须一致：判定为假时指令被拒绝。
  tileAt(state, 4, 3).type = "plain";
  assert.equal(canCapture(state, 0, infantry, 4, 3), false);
  rejected(state, 0, moveAction(infantry, 4, 3, "capture"), /只能占领/);
  // 判定为真时指令被接受。
  tileAt(state, 4, 3).type = "city";
  const accepted = applyAction(state, 0, moveAction(infantry, 4, 3, "capture"));
  assert.equal(accepted.units.find((u) => u.id === infantry.id).acted, true);
  assert.equal(tileAt(accepted, 4, 3).captureBy, 0);
});

test("capture progress tracks current HP and resets when the capturer leaves", () => {
  let state = fixture();
  const healthy = addUnit(state, "infantry", 0, 3, 3, { hp: 10 });
  const wounded = addUnit(state, "infantry", 0, 5, 3, { hp: 4 });
  tileAt(state, 3, 3).type = "city";
  tileAt(state, 5, 3).type = "city";

  state = applyAction(state, 0, moveAction(healthy, 3, 3, "capture"));
  assert.equal(tileAt(state, 3, 3).capture, 10, "健康步兵每回合推进 10 点");
  state = applyAction(state, 0, moveAction(wounded, 5, 3, "capture"));
  assert.equal(tileAt(state, 5, 3).capture, 16, "残血步兵每回合只推进当前 HP");

  // 回到本方回合后，占领进度仍保留；占领者离开则重置。
  state = round(state, 0);
  assert.equal(tileAt(state, 3, 3).capture, 10, "同一占领者续占时进度保留");
  const capturer = state.units.find((u) => u.id === healthy.id);
  const left = applyAction(state, 0, moveAction(capturer, 2, 3));
  assert.equal(tileAt(left, 3, 3).capture, 20);
  assert.equal(tileAt(left, 3, 3).captureBy, null);
  assert.equal(tileAt(left, 5, 3).capture, 16, "其他建筑的进度不受影响");
});

test("allied tiles can be crossed but never occupied or attacked", () => {
  const state = fixture(4, true);
  const unit = addUnit(state, "tank", 0, 3, 3);
  const ally = addUnit(state, "tank", 2, 4, 3);
  const cells = reachable(state, unit.id);
  assert.ok(!cells.some((cell) => cell.x === 4 && cell.y === 3), "盟友格不能停留");
  assert.ok(cells.some((cell) => cell.x === 5 && cell.y === 3), "盟友格可以穿行");
  assert.ok(!attackable(state, unit.id).includes(ally.id));
});

test("movement is bounded by fuel and charged by terrain cost, not step count", () => {
  const tankState = fixture();
  const tank = addUnit(tankState, "tank", 0, 3, 3, { fuel: 3 });
  const movedTank = applyAction(tankState, 0, moveAction(tank, 6, 3));
  assert.equal(movedTank.units.find((u) => u.id === tank.id).fuel, 0, "燃料按移动消耗扣除");
  rejected(tankState, 0, moveAction(tank, 3, 3, "attack", tank.id), /可攻击范围/);

  // 森林对轮胎消耗 3、对履带消耗 2：同一片地形限制不同兵种。
  const wheelState = fixture();
  const recon = addUnit(wheelState, "recon", 0, 3, 3, { fuel: 4 });
  tileAt(wheelState, 3, 4).type = "forest";
  const intoForest = applyAction(wheelState, 0, moveAction(recon, 3, 4));
  assert.equal(intoForest.units.find((u) => u.id === recon.id).fuel, 1);
  rejected(wheelState, 0, moveAction(recon, 3, 5), /无法到达/, "剩余燃料不足以前进两格");
});

test("combat preview and settlement agree, and both sides spend ammo", () => {
  const state = fixture();
  const attacker = addUnit(state, "tank", 0, 3, 3);
  const defender = addUnit(state, "heavy", 1, 4, 3, { hp: 7 });
  tileAt(state, 4, 3).type = "forest";
  const preview = previewCombat(state, attacker.id, defender.id);
  const settled = applyAction(state, 0, moveAction(attacker, 3, 3, "attack", defender.id));
  assert.equal(settled.units.find((u) => u.id === defender.id).hp, 7 - preview.damage);
  assert.equal(settled.units.find((u) => u.id === attacker.id).hp, 10 - preview.counter);
  assert.equal(settled.units.find((u) => u.id === attacker.id).ammo, 5);
  assert.equal(settled.units.find((u) => u.id === defender.id).ammo, 4, "反击同样消耗弹药");
  assert.deepEqual(
    applyAction(state, 0, moveAction(attacker, 3, 3, "attack", defender.id)),
    settled,
    "相同状态与指令必须得到相同结果",
  );
});

test("a destroyed unit never counters and its attacker stays unharmed", () => {
  const state = fixture();
  const attacker = addUnit(state, "heavy", 0, 3, 3);
  const doomed = addUnit(state, "infantry", 1, 4, 3, { hp: 1 });
  const settled = applyAction(state, 0, moveAction(attacker, 3, 3, "attack", doomed.id));
  assert.equal(settled.units.some((u) => u.id === doomed.id), false);
  assert.equal(settled.units.find((u) => u.id === attacker.id).hp, 10);
});

test("power costs are fixed, last through the enemy turn, and freeze energy gain", () => {
  let state = fixture();
  state.players[0].energy = 100;
  const scout = addUnit(state, "tank", 0, 3, 3);
  const before = reachable(state, scout.id).length;
  state = applyAction(state, 0, { type: "power", level: "super" });
  assert.equal(state.players[0].energy, 0);
  assert.equal(state.players[0].power, "super");
  assert.ok(reachable(state, scout.id).length > before);
  rejected(state, 0, { type: "power", level: "power" }, /已经发动/);

  state = applyAction(state, 0, { type: "endTurn" });
  assert.equal(state.players[0].power, "super", "自己结束回合时能力仍然生效");

  // 敌人攻击期间，能力生效方不应再获得能量。
  const target = state.units.find((u) => u.id === scout.id);
  const raider = addUnit(state, "tank", 1, target.x, target.y - 1);
  state = applyAction(state, 1, moveAction(raider, raider.x, raider.y, "attack", scout.id));
  assert.equal(state.players[0].power, "super", "挨打不改变能力状态");
  assert.equal(state.players[0].energy, 0, "能力生效期间不积累能量");
  assert.equal(validateState(state), true);

  state = applyAction(state, 1, { type: "endTurn" });
  assert.equal(state.players[0].power, null, "回到自己回合时能力结束");
  assert.equal(validateState(state), true);
});

test("energy stays within its ceiling and funds never go negative", () => {
  let state = fixture();
  state.players[0].energy = 100;
  state.players[0].funds = 0;
  const unit = addUnit(state, "tank", 0, 0, 0, { hp: 2 });
  state = applyAction(state, 0, { type: "endTurn" });
  state = applyAction(state, 1, { type: "endTurn" });
  assert.ok(state.players[0].funds >= 0);
  assert.ok(state.players[0].energy <= 100);
  assert.ok(state.units.find((u) => u.id === unit.id).hp <= 10);
  assert.equal(validateState(state), true);
});

test("a defeated seat loses its assets and cannot act again", () => {
  const state = fixture(3);
  addUnit(state, "tank", 1, 5, 3);
  addUnit(state, "tank", 2, 8, 3);
  const infantry = addUnit(state, "infantry", 0, 3, 3);
  Object.assign(tileAt(state, 3, 3), { type: "hq", owner: 1, capture: 10, captureBy: 0 });

  const next = applyAction(state, 0, moveAction(infantry, 3, 3, "capture"));
  assert.equal(next.players[1].defeated, true);
  assert.equal(next.units.some((u) => u.owner === 1), false);
  assert.equal(next.tiles.some((t) => t.owner === 1), false);
  assert.equal(next.phase, "playing", "仍有其他队伍存活");
  rejected(next, 1, { type: "endTurn" }, /战败/);
  rejected(next, 1, { type: "surrender" }, /战败/);
});

test("victory is declared only when a single team remains", () => {
  let state = fixture(2);
  const infantry = addUnit(state, "infantry", 0, 3, 3);
  Object.assign(tileAt(state, 3, 3), { type: "hq", owner: 1, capture: 5, captureBy: 0 });
  state = applyAction(state, 0, moveAction(infantry, 3, 3, "capture"));
  assert.equal(state.phase, "finished");
  assert.equal(state.winner, 0);
  assert.equal(liveTeams(state).size, 1);
  rejected(state, 0, { type: "build", unitType: "infantry", x: 0, y: 0 }, /结束/);
  rejected(state, 0, { type: "endTurn" }, /结束/);
});

test("state invariants hold after every action of every AI match", () => {
  const combinations = [
    ["training", 2, false],
    ["training", 4, true],
    ["river", 3, false],
    ["river", 4, true],
    ["crossroads", 4, false],
    ["coast", 4, true],
  ];
  let actions = 0;
  for (const [mapId, count, teams] of combinations) {
    let state = createGame({ mapId, players: seats(count, teams) });
    // Ships and aircraft stretch matches; this is a stall detector.
    for (let step = 0; step < 6000 && state.phase === "playing"; step++) {
      state = applyAction(
        state,
        state.currentPlayer,
        chooseAIAction(state, state.currentPlayer),
      );
      actions++;
      assert.equal(validateState(state), true, `${mapId} 第 ${step} 步状态无效`);
      const occupied = new Set();
      for (const unit of state.units) {
        // Cargo shares its carrier's tile by design; only board units claim a cell.
        if (unit.carriedBy == null) {
          const key = `${unit.x},${unit.y}`;
          assert.ok(!occupied.has(key), `单位不能在 ${key} 重叠`);
          occupied.add(key);
        }
        assert.ok(unit.hp >= 1 && unit.hp <= 10, "生命必须在 1–10");
        assert.ok(unit.fuel >= 0 && unit.fuel <= UNITS[unit.type].maxFuel, "燃料必须在范围内");
      }
      for (const player of livePlayers(state)) {
        assert.ok(player.funds >= 0, "资金不能为负");
        assert.ok(player.energy >= 0 && player.energy <= 100, "能量必须在 0–100");
        assert.ok(
          state.units.some((u) => u.owner === player.id) ||
            state.tiles.some(
              (t) =>
                t.owner === player.id &&
                ["factory", "airport", "port"].includes(t.type),
            ),
          `存活玩家 ${player.id} 必须仍有单位或生产设施`,
        );
      }
      const teams_alive = liveTeams(state);
      if (state.phase === "finished") assert.equal(teams_alive.size, 1);
      else assert.ok(teams_alive.size > 1, "仍在进行时至少两支队伍存活");
    }
    assert.equal(state.phase, "finished", `${mapId}/${count}/${teams} 应分出胜负`);
  }
  assert.ok(actions > 500, `应执行足够多的动作，实际 ${actions}`);
});

test("validateState rejects states the rules can never produce", () => {
  const base = createGame({ mapId: "river", players: seats(2) });
  const cases = {
    "普通能力期间剩余能量超过 50": (s) => {
      s.players[0].power = "power";
      s.players[0].energy = 60;
    },
    "超级能力期间没有清空能量": (s) => {
      s.players[0].power = "super";
      s.players[0].energy = 10;
    },
    "存活玩家既无单位也无工厂": (s) => {
      s.units = s.units.filter((u) => u.owner !== 1);
      s.tiles.forEach((t) => {
        if (t.owner === 1) t.owner = null;
      });
    },
    "战败玩家仍持有建筑": (s) => {
      s.players[1].defeated = true;
      s.units = s.units.filter((u) => u.owner !== 1);
    },
    "战败玩家仍保留能力状态": (s) => {
      s.players[1].defeated = true;
      s.players[1].power = "power";
      s.units = s.units.filter((u) => u.owner !== 1);
      s.tiles.forEach((t) => {
        if (t.owner === 1) t.owner = null;
      });
    },
    "单位生命越界": (s) => {
      s.units[0].hp = 0;
    },
    "单位燃料超出上限": (s) => {
      s.units[0].fuel = UNITS[s.units[0].type].maxFuel + 1;
    },
    "单位弹药为负": (s) => {
      s.units.find((u) => u.ammo !== null).ammo = -1;
    },
    "两个单位重叠": (s) => {
      s.units[1].x = s.units[0].x;
      s.units[1].y = s.units[0].y;
    },
    "资金为负": (s) => {
      s.players[0].funds = -1;
    },
    "能量越界": (s) => {
      s.players[0].energy = 101;
    },
    "占领进度没有对应单位": (s) => {
      const tile = s.tiles.find((t) => t.type === "city");
      tile.capture = 10;
      tile.captureBy = 0;
    },
    "非运输单位携带货舱字段": (s) => {
      s.units[0].cargo = [];
    },
    "货舱引用了不存在的单位": (s) => {
      const lander = s.units[0];
      lander.type = "lander";
      lander.cargo = ["u999"];
    },
  };
  for (const [label, mutate] of Object.entries(cases)) {
    const broken = structuredClone(base);
    mutate(broken);
    assert.throws(() => validateState(broken), label);
  }
  assert.equal(validateState(base), true);
});

test("validateState rejects a defeated seat that is still the current player", () => {
  const broken = fixture(2);
  broken.players[0].defeated = true;
  broken.units = broken.units.filter((u) => u.owner !== 0);
  broken.tiles.forEach((t) => {
    if (t.owner === 0) t.owner = null;
  });
  assert.throws(() => validateState(broken), /存活状态|当前行动方/);
});

test("a match replays identically after a save and load round trip", () => {
  const seats = (count, teams = false) =>
    Array.from({ length: count }, (_, id) => ({
      id,
      name: `席位${id}`,
      team: teams ? id % 2 : id,
      commander: id % 2 ? "mechanic" : "vanguard",
      controller: "ai",
    }));
  let state = createGame({ mapId: "training", players: seats(2, true) });
  for (let step = 0; step < 40 && state.phase === "playing"; step++)
    state = applyAction(
      state,
      state.currentPlayer,
      chooseAIAction(state, state.currentPlayer),
    );

  const snapshot = JSON.parse(JSON.stringify(state));
  assert.equal(validateState(snapshot), true, "读档后的状态必须仍然有效");
  assert.deepEqual(snapshot, state, "存档往返不能改变状态");

  // 从同一快照继续推进：内存状态与读档状态必须逐步一致。
  let restored = snapshot;
  for (let step = 0; step < 40 && state.phase === "playing"; step++) {
    const action = chooseAIAction(state, state.currentPlayer);
    assert.deepEqual(
      chooseAIAction(restored, restored.currentPlayer),
      action,
      "相同状态必须给出相同决策",
    );
    const left = applyAction(state, state.currentPlayer, action);
    const right = applyAction(restored, restored.currentPlayer, action);
    assert.deepEqual(right, left, "读档后执行同一指令必须得到同一状态");
    state = left;
    restored = right;
  }
});
