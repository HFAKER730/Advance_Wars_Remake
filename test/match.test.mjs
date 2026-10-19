/**
 * M2 acceptance: complete matches driven entirely through the real HTTP API.
 *
 * The engine-level sweeps in `invariants.test.mjs` already prove the rules are
 * self-consistent in memory. These tests prove the *server* surface carries a
 * whole match: seat ownership, production, capture, elimination and victory all
 * travel through `/action`, and every response is a state that passes
 * `validateState`.
 *
 * They are deliberately end-to-end rather than mocked, so they cost roughly
 * 10–15 ms per command (durable save on every commit). Expect ~40 s total.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "../server.mjs";
import { chooseAIAction, validateState } from "../public/shared/engine.mjs";

const STEP_LIMIT = 6000;

async function harness(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), "field-command-match-"));
  const app = await createServer({
    port: 0,
    host: "127.0.0.1",
    dataDir,
    aiDelay: 5,
    aiAnimationPacing: false,
    ...options,
  });
  t.after(async () => {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  return app;
}

function call(base) {
  return async (path, body) => {
    const response = await fetch(
      `${base}${path}`,
      body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    );
    let parsed = null;
    try {
      parsed = await response.json();
    } catch {
      /* surfaced as a status mismatch by the caller */
    }
    return { status: response.status, body: parsed };
  };
}

async function seatRoom(api, { playerCount, mode, mapId, names }) {
  const created = await api("/api/rooms", {
    name: names[0],
    mapId,
    playerCount,
    mode,
    commander: "vanguard",
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.room.id;
  const tokens = [created.body.token];
  for (let seat = 1; seat < playerCount; seat++) {
    const joined = await api(`/api/rooms/${id}/join`, {
      name: names[seat],
      commander: seat % 2 ? "vanguard" : "mechanic",
    });
    assert.equal(joined.status, 200, JSON.stringify(joined.body));
    assert.equal(joined.body.seat, seat, "席位必须按顺序分配");
    tokens.push(joined.body.token);
  }
  const started = await api(`/api/rooms/${id}/start`, { token: tokens[0] });
  assert.equal(started.status, 200, JSON.stringify(started.body));
  return { id, tokens, room: started.body.room };
}

/**
 * Plays the room to completion, always submitting the AI's chosen command for
 * whichever seat is to move. Returns aggregate evidence about the match.
 */
async function playToVictory(api, { id, tokens, room }, { playerCount }) {
  let current = room;
  const actedSeats = new Set();
  const defeated = new Set();
  let builds = 0;
  let captures = 0;
  let attacks = 0;
  let steps = 0;
  let maxUnits = current.state.units.length;
  let previousTurn = current.state.turn;

  while (current.state.phase === "playing" && steps < STEP_LIMIT) {
    const seat = current.state.currentPlayer;
    assert.ok(
      Number.isInteger(seat) && seat >= 0 && seat < playerCount,
      `第 ${steps} 步的当前席位无效：${seat}`,
    );
    const revision = current.revision;
    const action = chooseAIAction(current.state, seat);
    const response = await api(`/api/rooms/${id}/action`, {
      token: tokens[seat],
      revision,
      requestId: `req-${id}-${String(steps).padStart(6, "0")}`,
      action,
    });
    assert.equal(
      response.status,
      200,
      `第 ${steps} 步（席位 ${seat}）被拒绝：${JSON.stringify(response.body)}`,
    );
    current = response.body.room;
    assert.ok(current.revision > revision, "每次成功提交都必须推进版本");
    assert.ok(
      current.state.turn >= previousTurn,
      `回合序号不能回退：${previousTurn} → ${current.state.turn}`,
    );
    assert.equal(
      validateState(current.state),
      true,
      `第 ${steps} 步返回了非法状态`,
    );
    actedSeats.add(seat);
    steps++;
    if (action.type === "build") builds++;
    if (action.command === "capture") captures++;
    if (action.command === "attack") attacks++;
    for (const player of current.state.players)
      if (player.defeated) defeated.add(player.id);
    maxUnits = Math.max(maxUnits, current.state.units.length);
    // 请求记录不得泄漏给客户端。
    assert.equal(current.requestLog, undefined);
    previousTurn = current.state.turn;
  }

  assert.equal(
    current.state.phase,
    "finished",
    `${playerCount} 人 ${steps} 步后仍未分出胜负`,
  );
  const survivors = current.state.players.filter((p) => !p.defeated);
  const survivorsByTeam = new Set(survivors.map((p) => p.team));
  assert.equal(survivorsByTeam.size, 1, "结束时只应剩一支队伍");
  assert.equal(current.state.winner, [...survivorsByTeam][0], "winner 必须是幸存队伍");
  assert.equal(current.state.winner !== null, true);
  assert.ok(steps > 10, "对局应有实际推进");
  assert.ok(builds > 0, "对局中应发生生产");
  assert.ok(captures > 0, "对局中应发生占领");
  assert.ok(attacks > 0, "对局中应发生交火");
  assert.ok(defeated.size > 0, "对局中应出现淘汰");
  assert.equal(
    actedSeats.size,
    playerCount,
    "每个席位都必须实际行动过",
  );
  assert.ok(current.state.day > 1, "对局应跨越多个天数");

  return { final: current, steps, builds, captures, attacks, defeated, maxUnits };
}

test("two-seat FFA plays a complete match through HTTP", async (t) => {
  const api = call((await harness(t)).url);
  const room = await seatRoom(api, {
    playerCount: 2,
    mode: "ffa",
    mapId: "training",
    names: ["红方", "蓝方"],
  });
  const result = await playToVictory(api, room, { playerCount: 2 });
  assert.equal(result.defeated.size, 1, "2 人混战应恰好淘汰 1 席");
  const survivor = result.final.state.players.find((p) => !p.defeated);
  assert.equal(result.final.state.winner, survivor.team);

  // 结束后仍可读取房间，且状态可重复校验。
  const snapshot = await api(`/api/rooms/${room.id}?token=${room.tokens[0]}`);
  assert.equal(snapshot.status, 200);
  assert.equal(snapshot.body.room.phase, "finished");
  assert.equal(validateState(snapshot.body.room.state), true);
});

test("three-seat FFA plays a complete match through HTTP", async (t) => {
  const api = call((await harness(t)).url);
  const room = await seatRoom(api, {
    playerCount: 3,
    mode: "ffa",
    mapId: "training",
    names: ["甲", "乙", "丙"],
  });
  const result = await playToVictory(api, room, { playerCount: 3 });
  assert.equal(result.defeated.size, 2, "3 人混战应淘汰 2 席");
});

test("four-seat FFA plays a complete match through HTTP", async (t) => {
  const api = call((await harness(t)).url);
  const room = await seatRoom(api, {
    playerCount: 4,
    mode: "ffa",
    mapId: "training",
    names: ["一号", "二号", "三号", "四号"],
  });
  const result = await playToVictory(api, room, { playerCount: 4 });
  assert.equal(result.defeated.size, 3, "4 人混战应淘汰 3 席");
  // 4 人混战应当是有实质规模的战局，而不是速胜。
  assert.ok(result.steps > 100, `4 人战局推进过少：${result.steps} 步`);
  assert.ok(result.maxUnits >= 16, `场面单位数异常：${result.maxUnits}`);
});

test("four-seat 2v2 ends by team elimination, not by single-seat wipe", async (t) => {
  const api = call((await harness(t)).url);
  const room = await seatRoom(api, {
    playerCount: 4,
    mode: "teams",
    mapId: "training",
    names: ["赤焰", "苍蓝", "金叶", "紫星"],
  });
  // 队伍映射：0+2 一队，1+3 一队。
  assert.deepEqual(
    room.room.state.players.map((p) => p.team),
    [0, 1, 0, 1],
  );
  const result = await playToVictory(api, room, { playerCount: 4 });

  const winners = result.final.state.players.filter((p) => p.team === result.final.state.winner);
  const losers = result.final.state.players.filter((p) => p.team !== result.final.state.winner);
  assert.equal(winners.every((p) => !p.defeated), true, "胜方全员应存活");
  assert.equal(losers.every((p) => p.defeated), true, "败方全员应出局");
  assert.equal(winners.length, 2, "胜方应包含两名玩家");
  // 单人淘汰制：同队两人各自独立出局，因此淘汰数应是 2。
  assert.equal(result.defeated.size, 2, "2v2 中败方两人各自出局");
});

test("every response during a match is a valid, self-consistent state", async (t) => {
  const api = call((await harness(t)).url);
  const room = await seatRoom(api, {
    playerCount: 3,
    mode: "ffa",
    mapId: "river",
    names: ["左", "中", "右"],
  });
  let current = room.room;
  const requestIds = new Set();
  for (let step = 0; step < 120 && current.state.phase === "playing"; step++) {
    const seat = current.state.currentPlayer;
    const requestId = `req-river-${String(step).padStart(6, "0")}`;
    assert.equal(requestIds.has(requestId), false);
    requestIds.add(requestId);
    const action = chooseAIAction(current.state, seat);
    const response = await api(`/api/rooms/${room.id}/action`, {
      token: room.tokens[seat],
      revision: current.revision,
      requestId,
      action,
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    current = response.body.room;
    assert.equal(response.body.replayed, undefined, "首次提交不是回放");
    assert.equal(validateState(current.state), true);
    assert.equal(current.revision > 0, true);
    assert.equal(JSON.stringify(current).includes("requestId"), false);
    // 单元数据必须始终处于合法范围。
    for (const unit of current.state.units) {
      assert.ok(unit.hp >= 1 && unit.hp <= 10, `单位生命越界：${unit.hp}`);
      assert.ok(unit.fuel >= 0, `单位燃料为负：${unit.fuel}`);
      assert.ok(unit.x >= 0 && unit.x < current.state.width, "单位横坐标越界");
      assert.ok(unit.y >= 0 && unit.y < current.state.height, "单位纵坐标越界");
    }
  }
  // 结束后同一条连接提交任何指令都必须被拒绝，而不是静默丢弃。
  if (current.state.phase === "finished") {
    const late = await api(`/api/rooms/${room.id}/action`, {
      token: room.tokens[0],
      revision: current.revision,
      requestId: `req-late-${Date.now().toString(36)}`,
      action: { type: "endTurn" },
    });
    assert.equal(late.status, 409, JSON.stringify(late.body));
  }
});
