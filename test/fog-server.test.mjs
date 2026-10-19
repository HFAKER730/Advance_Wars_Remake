/**
 * M4 acceptance: fog over the real HTTP surface.
 *
 * The engine-level `fog.test.mjs` proves the projection itself. These tests
 * prove the server only ever hands a seat its own view: the initial snapshot,
 * the SSE stream, the action response and the reconnect snapshot all carry the
 * same projected state, and the master state stays inside the process.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "../server.mjs";
import {
  chooseAIAction,
  seesUnit,
  validateState,
  visibleTiles,
} from "../public/shared/engine.mjs";

const STEP_LIMIT = 3000;

async function setup(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), "field-command-m4-"));
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
  return {
    app,
    dataDir,
    api: client(app.url),
  };
}

function client(base) {
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

async function waitFor(predicate, timeout = 8000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const value = await predicate();
    if (value) return value;
    await delay(20);
  }
  throw new Error("等待服务端状态超时");
}

async function connect(base, id, token) {
  const abort = new AbortController();
  const response = await fetch(
    `${base}/api/rooms/${id}/events?token=${token}`,
    { signal: abort.signal },
  );
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  const rooms = [];
  let buffer = "";
  const decoder = new TextDecoder();
  const done = (async () => {
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) return;
        buffer += decoder.decode(chunk.value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const event = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const data = event
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (data) rooms.push(JSON.parse(data.slice(6)));
        }
      }
    } catch (error) {
      if (error.name !== "AbortError") throw error;
    }
  })();
  return {
    rooms,
    async close() {
      abort.abort();
      await done;
    },
    next: (predicate) => waitFor(() => rooms.find(predicate)),
    last: () => rooms[rooms.length - 1],
  };
}

/** Creates a two-human room with the requested fog setting and starts it. */
async function fogRoom(api, { fog, playerCount = 2, mapId = "training" } = {}) {
  const created = await api("/api/rooms", {
    name: "房主",
    mapId,
    playerCount,
    mode: "ffa",
    fog,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.room.id;
  assert.equal(
    created.body.room.fog,
    fog,
    "建房时必须保留迷雾设置",
  );
  const seats = [{ token: created.body.token, seat: 0 }];
  for (let seat = 1; seat < playerCount; seat++) {
    const joined = await api(`/api/rooms/${id}/join`, { name: `玩家${seat}` });
    assert.equal(joined.status, 200, JSON.stringify(joined.body));
    seats.push({ token: joined.body.token, seat: joined.body.seat });
  }
  const started = await api(`/api/rooms/${id}/start`, { token: seats[0].token });
  assert.equal(started.status, 200, JSON.stringify(started.body));
  return {
    id,
    seats,
    room: started.body.room,
    revision: started.body.room.revision,
  };
}

/** Every unit the master state holds, so leaks can be asserted against it. */
const masterUnits = (app, id) => app.rooms.get(id).state.units;

test("a fog room opens with each seat seeing only its own units", async (t) => {
  const { app, api } = await setup(t);
  const { id, seats, room } = await fogRoom(api, { fog: true });
  assert.equal(room.state.fog, true, "房间迷雾必须进入战局");
  assert.equal(validateState(app.rooms.get(id).state), true, "主状态仍然合法");

  const zero = await api(`/api/rooms/${id}?token=${seats[0].token}`);
  const one = await api(`/api/rooms/${id}?token=${seats[1].token}`);
  assert.equal(zero.status, 200);
  assert.equal(one.status, 200);
  // 两份快照来自同一个主状态，但各自只看到自己那一半。
  assert.equal(zero.body.room.revision, one.body.room.revision);
  assert.notDeepEqual(
    zero.body.room.state,
    one.body.room.state,
    "迷雾下两个席位不该拿到同一份状态",
  );

  // 开局两角相距 12 格，远超任一兵种视野：对手的单位不该出现在任何一侧。
  const all = masterUnits(app, id);
  assert.ok(all.length >= 8, "主状态必须保留双方全部单位");
  for (const [seat, body] of [
    [0, zero.body],
    [1, one.body],
  ]) {
    const view = body.room.state;
    assert.equal(seat, body.seat, "快照必须附带请求者的席位");
    assert.ok(
      view.units.every((u) => u.owner === seat),
      "开局时只能看到自己的部队",
    );
    assert.ok(
      view.units.length > 0 && view.units.length < all.length,
      "投影必须是主状态的子集",
    );
    const enemy = view.players.find((p) => p.id !== seat);
    assert.equal(enemy.funds, null, "对手资金必须隐藏");
    assert.equal(enemy.energy, null, "对手能量必须隐藏");
  }
  // 主状态里的敌方资金没有被投影改动。
  assert.equal(app.rooms.get(id).state.players[1].funds > 0, true);
});

test("without fog the same snapshot is the master state", async (t) => {
  const { app, api } = await setup(t);
  const { id, seats } = await fogRoom(api, { fog: false });
  const snapshot = await api(`/api/rooms/${id}?token=${seats[0].token}`);
  assert.equal(snapshot.body.room.fog, false);
  assert.deepEqual(
    snapshot.body.room.state,
    app.rooms.get(id).state,
    "无迷雾时服务端不下发投影",
  );
});

test("every SSE connection receives its own projected view", async (t) => {
  const { app, api } = await setup(t);
  const { id, seats } = await fogRoom(api, { fog: true });
  const a = await connect(app.url, id, seats[0].token);
  const b = await connect(app.url, id, seats[1].token);
  t.after(async () => {
    await a.close();
    await b.close();
  });
  await a.next((snapshot) => snapshot.revision >= 1);
  await b.next((snapshot) => snapshot.revision >= 1);

  // 一方结束回合，双方都会收到这一版；各自看到的仍然是自己的投影。
  const ended = await api(`/api/rooms/${id}/action`, {
    token: seats[0].token,
    action: { type: "endTurn" },
  });
  assert.equal(ended.status, 200, JSON.stringify(ended.body));
  const revision = ended.body.room.revision;
  const forA = await a.next((snapshot) => snapshot.revision === revision);
  const forB = await b.next((snapshot) => snapshot.revision === revision);
  assert.equal(forA.state.fog, true);
  assert.equal(forB.state.fog, true);
  const all = masterUnits(app, id);
  for (const [seat, view] of [
    [0, forA.state],
    [1, forB.state],
  ]) {
    const seen = visibleTiles(view, seat);
    // 投影里出现的每一个单位，主状态里都确实在这个席位能看到的格子上。
    for (const unit of view.units)
      assert.ok(
        unit.owner === seat || seen.has(`${unit.x},${unit.y}`),
        `席位 ${seat} 收到了看不见的单位 ${unit.id}`,
      );
    assert.equal(
      view.players.find((p) => p.id !== seat).funds,
      null,
      "广播里的对手资金必须隐藏",
    );
  }
  assert.equal(
    JSON.stringify(a.rooms).includes('"requestLog"'),
    false,
    "广播不得携带请求记录",
  );
  assert.equal(
    JSON.stringify(a.rooms).includes('"token"'),
    false,
    "广播不得携带席位凭证",
  );
  assert.equal(all.length >= 8, true, "主状态不受投影影响");
});

test("an action response and a reconnect both carry the seat's own view", async (t) => {
  const { app, api } = await setup(t);
  const { id, seats } = await fogRoom(api, { fog: true });
  const factory = app.rooms
    .get(id)
    .state.tiles.find((tile) => tile.type === "factory" && tile.owner === 0);
  const built = await api(`/api/rooms/${id}/action`, {
    token: seats[0].token,
    action: {
      type: "build",
      unitType: "infantry",
      x: factory.x,
      y: factory.y,
    },
  });
  assert.equal(built.status, 200, JSON.stringify(built.body));
  assert.equal(built.body.room.state.fog, true, "行动响应必须带迷雾开关");
  assert.ok(
    built.body.room.state.units.every((u) => u.owner === 0),
    "行动响应只回本席位的视野",
  );
  assert.equal(
    app.rooms.get(id).state.units.some((u) => u.owner === 1),
    true,
    "主状态仍持有对手部队",
  );
  // 本人看不到花费金额以外的对手情报；生产费用只写进自己的日志。
  const log = built.body.room.state.log.join("\n");
  assert.match(log, /生产了步兵/, "本人的日志保留自己的行动");
  const otherSeat = await api(`/api/rooms/${id}?token=${seats[1].token}`);
  assert.equal(
    /生产了步兵/.test(otherSeat.body.room.state.log.join("\n")),
    false,
    "对手的日志里没有这次生产",
  );

  // 重连拿到的是同一份投影，而不是主状态。
  const back = await api(`/api/rooms/${id}?token=${seats[0].token}`);
  assert.deepEqual(
    back.body.room.state,
    built.body.room.state,
    "重连快照必须与实时响应一致",
  );
});

test("only the host may toggle fog, and only in the lobby", async (t) => {
  const { api } = await setup(t);
  const created = await api("/api/rooms", {
    name: "房主",
    mapId: "training",
    playerCount: 2,
    fog: false,
  });
  const id = created.body.room.id;
  const joined = await api(`/api/rooms/${id}/join`, { name: "客人" });

  const refused = await api(`/api/rooms/${id}/configure`, {
    token: joined.body.token,
    fog: true,
  });
  assert.equal(refused.status, 403, JSON.stringify(refused.body));

  const accepted = await api(`/api/rooms/${id}/configure`, {
    token: created.body.token,
    fog: true,
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  assert.equal(accepted.body.room.fog, true);

  const malformed = await api(`/api/rooms/${id}/configure`, {
    token: created.body.token,
    fog: "yes",
  });
  assert.equal(malformed.status, 400, JSON.stringify(malformed.body));

  const started = await api(`/api/rooms/${id}/start`, {
    token: created.body.token,
  });
  assert.equal(started.body.room.state.fog, true, "开始时迷雾必须传进战局");
  const late = await api(`/api/rooms/${id}/configure`, {
    token: created.body.token,
    fog: false,
  });
  assert.equal(late.status, 409, "开局后不得再改迷雾");
});

test("a fogged room persists its toggle and restores as a fog room", async (t) => {
  const { dataDir, api, app } = await setup(t);
  const { id, seats } = await fogRoom(api, { fog: true });
  await api(`/api/rooms/${id}/action`, {
    token: seats[0].token,
    action: { type: "endTurn" },
  });
  const saved = JSON.parse(await readFile(join(dataDir, "autosave.json"), "utf8"));
  assert.equal(saved.rooms[0].fog, true, "迷雾开关必须落盘");

  await app.close();
  const restarted = await createServer({
    port: 0,
    host: "127.0.0.1",
    dataDir,
    aiDelay: 5,
    aiAnimationPacing: false,
  });
  t.after(() => restarted.close());
  const room = restarted.rooms.get(id);
  assert.equal(room.fog, true, "重启后仍然是迷雾房间");
  assert.equal(validateState(room.state), true);
  const snapshot = await client(restarted.url)(
    `/api/rooms/${id}?token=${seats[0].token}`,
  );
  assert.equal(snapshot.body.room.fog, true);
  assert.ok(
    snapshot.body.room.state.units.every((u) => u.owner === 0),
    "重启后的快照同样只给本席位",
  );
  assert.equal(
    room.state.units.some((u) => u.owner === 1),
    true,
    "主状态在重启后仍然完整",
  );
});

test("a fogged match plays to completion through the API", async (t) => {
  const { app, api } = await setup(t);
  const { id, seats, room } = await fogRoom(api, { fog: true });
  let current = room;
  let steps = 0;
  const actedSeats = new Set();
  // Each seat is its own client: it reads its own snapshot and decides from
  // that alone. This is the point of the test — the response to a seat carries
  // that seat's view, so no seat can plan against another's information.
  while (current.state.phase === "playing" && steps < STEP_LIMIT) {
    const seat = current.state.currentPlayer;
    const view = await api(`/api/rooms/${id}?token=${seats[seat].token}`);
    assert.equal(view.status, 200);
    assert.equal(view.body.seat, seat, "快照必须属于该席位");
    const state = view.body.room.state;
    assert.equal(state.fog, true, "投影必须保留迷雾开关");
    assert.equal(state.currentPlayer, seat, "轮到该席位行动");
    const visible = visibleTiles(state, seat);
    // The projection's contract is `seesUnit`, not "inside a vision radius":
    // an enemy standing in one of our own buildings is spotted by its garrison
    // even when no friendly unit has line of sight. Compare against the master.
    const master = app.rooms.get(id).state;
    for (const unit of state.units) {
      const real = master.units.find((u) => u.id === unit.id);
      assert.ok(real, `第 ${steps} 步投影里出现了主状态没有的单位 ${unit.id}`);
      assert.ok(
        seesUnit(master, seat, real),
        `第 ${steps} 步席位 ${seat} 收到了看不见的单位 ${unit.id}`,
      );
    }
    if (state.units.some((u) => u.owner === seat)) assert.ok(visible.size > 0);

    const revision = view.body.room.revision;
    const action = chooseAIAction(state, seat);
    const response = await api(`/api/rooms/${id}/action`, {
      token: seats[seat].token,
      revision,
      requestId: `req-fog-${String(steps).padStart(6, "0")}`,
      action,
    });
    assert.equal(
      response.status,
      200,
      `第 ${steps} 步（席位 ${seat}）被拒绝：${JSON.stringify(response.body)}`,
    );
    current = response.body.room;
    assert.ok(current.revision > revision, "每次成功提交都必须推进版本");
    actedSeats.add(seat);
    steps++;
  }
  assert.equal(current.state.phase, "finished", "迷雾对局必须能正常打完");
  assert.ok(steps < STEP_LIMIT, "对局不应撞上步数上限");
  assert.deepEqual(
    [...actedSeats].sort(),
    [0, 1],
    "两个席位都必须实际下过命令",
  );
  assert.equal(validateState(app.rooms.get(id).state), true, "主状态全程合法");
});
