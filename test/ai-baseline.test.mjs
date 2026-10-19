/**
 * M3 AI regression baseline.
 *
 * Locks the AI's observable behaviour so a future change to scoring cannot
 * silently make it stall, idle-loop, or emit illegal commands. The numbers are
 * ranges, not exact step counts: the engine is deterministic today, but a
 * deliberate AI change is allowed to move them — it is not allowed to break the
 * invariants below.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  MAPS,
  UNITS,
  applyAction,
  attackable,
  chooseAIAction,
  createGame,
  reachable,
  validateState,
} from "../public/shared/engine.mjs";

const seats = (count, teams = false) =>
  Array.from({ length: count }, (_, id) => ({
    id,
    name: `AI${id}`,
    team: teams ? id % 2 : id,
    commander: id % 2 ? "mechanic" : "vanguard",
    controller: "ai",
  }));

/** Plays a full match in memory, returning counters used by the assertions. */
function playMatch(mapId, count, teams) {
  let state = createGame({ mapId, players: seats(count, teams) });
  const actedSeats = new Set();
  let steps = 0;
  let waitCommands = 0;
  let buildCommands = 0;
  let captureCommands = 0;
  let attackCommands = 0;
  let maxDecisionMs = 0;
  let maxUnits = state.units.length;
  const idleStreak = { current: 0, max: 0 };

  for (; steps < 6000 && state.phase === "playing"; steps++) {
    const seat = state.currentPlayer;
    const started = performance.now();
    const action = chooseAIAction(state, seat);
    maxDecisionMs = Math.max(maxDecisionMs, performance.now() - started);

    assert.ok(action && typeof action === "object", `第 ${steps} 步没有返回指令`);
    assert.ok(
      ["move", "build", "power", "endTurn", "surrender"].includes(action.type),
      `第 ${steps} 步返回了未知指令 ${action.type}`,
    );

    // 指令必须能被引擎接受：AI 不能产生非法动作。
    const before = state;
    state = applyAction(state, seat, action);
    assert.equal(validateState(state), true, `第 ${steps} 步落到了非法状态`);
    actedSeats.add(seat);
    maxUnits = Math.max(maxUnits, state.units.length);

    if (action.type === "build") buildCommands++;
    if (action.type === "move") {
      const unit = before.units.find((u) => u.id === action.unitId);
      const moved = unit && (unit.x !== action.x || unit.y !== action.y);
      if (action.command === "wait" || action.command === "supply") waitCommands++;
      if (action.command === "capture") captureCommands++;
      if (action.command === "attack") attackCommands++;
      // 连续 40 次「原地待机」说明 AI 陷入空转，需要人工介入。
      if (!moved && action.command === "wait") {
        idleStreak.current++;
        idleStreak.max = Math.max(idleStreak.max, idleStreak.current);
      } else idleStreak.current = 0;
    }
  }

  const survivors = new Set(
    state.players.filter((p) => !p.defeated).map((p) => p.team),
  );
  return {
    state,
    steps,
    actedSeats,
    waitCommands,
    buildCommands,
    captureCommands,
    attackCommands,
    maxDecisionMs,
    maxUnits,
    maxIdleStreak: idleStreak.max,
    survivorTeams: survivors,
  };
}

test("AI finishes every map, seat count and team mode within the step budget", () => {
  const cases = [];
  for (const map of MAPS)
    for (const [count, teams] of [
      [2, false],
      [3, false],
      [4, false],
      [4, true],
    ])
      cases.push([map.id, count, teams]);

  for (const [mapId, count, teams] of cases) {
    const result = playMatch(mapId, count, teams);
    const label = `${mapId}/${count}/${teams ? "2v2" : "ffa"}`;
    assert.equal(result.state.phase, "finished", `${label} 未分出胜负`);
    assert.equal(result.survivorTeams.size, 1, `${label} 结束时存活队伍数不为 1`);
    assert.equal(result.state.winner, [...result.survivorTeams][0], `${label} winner 不符`);
    assert.ok(result.steps > 10, `${label} 推进过少：${result.steps} 步`);
    assert.ok(
      result.steps < 3000,
      `${label} 推进异常长：${result.steps} 步（可能是空转）`,
    );
    assert.equal(
      result.actedSeats.size,
      count,
      `${label} 有席位从未行动`,
    );
    assert.ok(result.buildCommands > 0, `${label} 全程没有生产`);
    assert.ok(result.captureCommands > 0, `${label} 全程没有占领`);
  }
});

test("AI never produces illegal commands and never stalls for long", () => {
  for (const mapId of ["training", "river", "crossroads"]) {
    const result = playMatch(mapId, 4, false);
    assert.ok(
      result.maxIdleStreak < 40,
      `${mapId} 出现连续 ${result.maxIdleStreak} 次原地待机`,
    );
    assert.ok(
      result.maxDecisionMs < 250,
      `${mapId} 单次决策耗时异常：${result.maxDecisionMs.toFixed(1)} ms`,
    );
    assert.ok(
      result.maxUnits < 60,
      `${mapId} 单位数异常膨胀：${result.maxUnits}`,
    );
  }
});

test("AI keeps acting while it still has units, and always ends its turn", () => {
  let state = createGame({ mapId: "training", players: seats(2) });
  for (let step = 0; step < 400 && state.phase === "playing"; step++) {
    const seat = state.currentPlayer;
    const mine = state.units.filter((u) => u.owner === seat && !u.acted);
    const action = chooseAIAction(state, seat);
    if (mine.length && state.tiles.some((t) => t.type === "factory" && t.owner === seat)) {
      // 还有可行动单位或空闲工厂时，不应提前结束回合。
      assert.notEqual(
        action.type,
        "endTurn",
        `第 ${step} 步仍有 ${mine.length} 支未行动单位却直接结束回合`,
      );
    }
    state = applyAction(state, seat, action);
    assert.equal(validateState(state), true);
  }
  assert.ok(state.turn > 1, "AI 应至少推进一个回合");
});

test("AI only selects targets the rules allow", () => {
  let state = createGame({ mapId: "crossroads", players: seats(4, true) });
  for (let step = 0; step < 600 && state.phase === "playing"; step++) {
    const seat = state.currentPlayer;
    const action = chooseAIAction(state, seat);
    if (action.type === "move" && action.command === "attack") {
      const reach = reachable(state, action.unitId);
      const destination = reach.find(
        (c) => c.x === action.x && c.y === action.y,
      );
      assert.ok(destination, "攻击落点必须可达");
      assert.ok(
        attackable(state, action.unitId, destination).includes(action.targetId),
        "攻击目标必须在射程与弹药允许范围内",
      );
    }
    if (action.type === "build") {
      const tile = state.tiles.find((t) => t.x === action.x && t.y === action.y);
      assert.equal(
        tile.type,
        UNITS[action.unitType].produceAt,
        "生产设施必须与兵种匹配",
      );
      assert.equal(tile.owner, seat, "只能在自己的设施生产");
    }
    state = applyAction(state, seat, action);
  }
});
