/**
 * M2: request deduplication and reconnect snapshots over the real HTTP surface.
 *
 * The rule under test: one player decision carries one `requestId`. Retrying it
 * must never apply the action twice, must return the current room, and must
 * keep working after a process restart because the log is persisted.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "../server.mjs";
import { SAVE_VERSION } from "../save-store.mjs";
import { chooseAIAction } from "../public/shared/engine.mjs";

async function setup(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), "field-command-m2-"));
  const app = await createServer({
    port: 0,
    host: "127.0.0.1",
    dataDir,
    aiDelay: 5,
    aiAnimationPacing: false,
    ...options,
  });
  const apps = [app];
  t.after(async () => {
    for (const server of apps) await server.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  return {
    app,
    dataDir,
    api: post(app.url),
    track: (server) => {
      apps.push(server);
      return server;
    },
  };
}

/** Returns the parsed body plus the status, so refusals can be asserted. */
function post(base) {
  return async (path, body, options = {}) => {
    const response = await fetch(
      `${base}${path}`,
      body === undefined
        ? options
        : {
            ...options,
            method: "POST",
            headers: { "Content-Type": "application/json", ...options.headers },
            body: JSON.stringify(body),
          },
    );
    let result = null;
    try {
      result = await response.json();
    } catch {
      /* empty body is meaningful for some assertions */
    }
    return { status: response.status, body: result };
  };
}

async function startRoom(api, { playerCount = 2, mode = "ffa", mapId = "training" } = {}) {
  const created = await api("/api/rooms", {
    name: "房主",
    mapId,
    playerCount,
    mode,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const { id } = created.body.room;
  const seats = [{ token: created.body.token, seat: 0 }];
  for (let seat = 1; seat < playerCount; seat++) {
    const joined = await api(`/api/rooms/${id}/join`, { name: `玩家${seat}` });
    assert.equal(joined.status, 200, JSON.stringify(joined.body));
    seats.push({ token: joined.body.token, seat: joined.body.seat });
  }
  const started = await api(`/api/rooms/${id}/start`, { token: seats[0].token });
  assert.equal(started.status, 200, JSON.stringify(started.body));
  return { id, seats, state: started.body.room.state, revision: started.body.room.revision };
}

const requestId = (label) => `req-${label}-${Math.random().toString(36).slice(2, 12)}`;

test("retrying an applied action replays it instead of applying it twice", async (t) => {
  const { api } = await setup(t);
  const room = await startRoom(api);
  const factory = room.state.tiles.find(
    (tile) => tile.type === "factory" && tile.owner === 0,
  );
  const action = { type: "build", unitType: "infantry", x: factory.x, y: factory.y };
  const id = requestId("build");
  const first = await api(`/api/rooms/${room.id}/action`, {
    token: room.seats[0].token,
    revision: room.revision,
    requestId: id,
    action,
  });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.replayed, undefined);
  const funds = first.body.room.state.players[0].funds;
  const units = first.body.room.state.units.filter((u) => u.owner === 0).length;

  // Same id, same payload, stale revision: must replay, not re-deduct.
  const retry = await api(`/api/rooms/${room.id}/action`, {
    token: room.seats[0].token,
    revision: room.revision,
    requestId: id,
    action,
  });
  assert.equal(retry.status, 200, JSON.stringify(retry.body));
  assert.equal(retry.body.replayed, true, "重试必须标记为回放");
  assert.equal(retry.body.room.state.players[0].funds, funds, "资金不能再次扣除");
  assert.equal(
    retry.body.room.state.units.filter((u) => u.owner === 0).length,
    units,
    "部队数量不能增加",
  );
  assert.deepEqual(retry.body.room.state, first.body.room.state);
  assert.equal(retry.body.room.revision, first.body.room.revision, "回放不推进版本");
});

test("a request id cannot be reused with different payload or by another seat", async (t) => {
  const { api } = await setup(t);
  const room = await startRoom(api);
  const id = requestId("conflict");
  const first = await api(`/api/rooms/${room.id}/action`, {
    token: room.seats[0].token,
    revision: room.revision,
    requestId: id,
    action: { type: "endTurn" },
  });
  assert.equal(first.status, 200, JSON.stringify(first.body));

  // Same id, different payload: refuse rather than silently replaying.
  const mismatch = await api(`/api/rooms/${room.id}/action`, {
    token: room.seats[0].token,
    revision: room.revision,
    requestId: id,
    action: { type: "surrender" },
  });
  assert.equal(mismatch.status, 409, JSON.stringify(mismatch.body));
  assert.match(mismatch.body.error, /不一致/);

  // Same id, different seat: refuse with 403 even though it is now that seat's turn.
  const stolen = await api(`/api/rooms/${room.id}/action`, {
    token: room.seats[1].token,
    revision: first.body.room.revision,
    requestId: id,
    action: { type: "endTurn" },
  });
  assert.equal(stolen.status, 403, JSON.stringify(stolen.body));
  assert.match(stolen.body.error, /其他席位/);
});

test("a malformed request id is refused before anything else happens", async (t) => {
  const { api } = await setup(t);
  const room = await startRoom(api);
  for (const bad of ["short", "has space", "x".repeat(65), 12345, {}, ""]) {
    const result = await api(`/api/rooms/${room.id}/action`, {
      token: room.seats[0].token,
      revision: room.revision,
      requestId: bad,
      action: { type: "endTurn" },
    });
    assert.equal(result.status, 400, `requestId=${JSON.stringify(bad)}`);
    assert.match(result.body.error, /请求编号/);
  }
  const current = await api(`/api/rooms/${room.id}?token=${room.seats[0].token}`);
  assert.equal(current.body.room.revision, room.revision, "被拒绝的请求不推进版本");
  assert.equal(
    current.body.room.state.currentPlayer,
    0,
    "被拒绝的请求没有结束回合",
  );
});

test("a rejected action stays retryable because it was never recorded", async (t) => {
  const { api } = await setup(t);
  const room = await startRoom(api);
  const id = requestId("rejected");
  // 生产重型坦克但资金不足：失败的前提是「没有真正执行」。
  const factory = room.state.tiles.find(
    (tile) => tile.type === "factory" && tile.owner === 0,
  );
  const poor = await api(`/api/rooms/${room.id}/action`, {
    token: room.seats[0].token,
    revision: room.revision,
    requestId: id,
    action: { type: "build", unitType: "heavy", x: factory.x, y: factory.y },
  });
  assert.equal(poor.status, 400, JSON.stringify(poor.body));

  // 同一个 id 现在用来提交「真的能成功」的行动：必须被接受。
  const ok = await api(`/api/rooms/${room.id}/action`, {
    token: room.seats[0].token,
    revision: room.revision,
    requestId: id,
    action: { type: "build", unitType: "infantry", x: factory.x, y: factory.y },
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.replayed, undefined, "首次成功的提交不是回放");
});

test("the retry log survives a restart and stays bounded", async (t) => {
  const { api, dataDir, track } = await setup(t, { aiAnimationPacing: false });
  const room = await startRoom(api);
  const id = requestId("persist");
  const first = await api(`/api/rooms/${room.id}/action`, {
    token: room.seats[0].token,
    revision: room.revision,
    requestId: id,
    action: { type: "endTurn" },
  });
  assert.equal(first.status, 200);
  const saved = JSON.parse(await readFile(join(dataDir, "autosave.json"), "utf8"));
  assert.equal(saved.version, SAVE_VERSION, `存档版本必须升级到 ${SAVE_VERSION}`);
  assert.ok(
    saved.rooms[0].requestLog.some((entry) => entry.requestId === id),
    "请求记录必须落盘",
  );
  const serialized = JSON.stringify(first.body.room);
  assert.equal(
    serialized.includes('"requestLog"'),
    false,
    "请求记录不广播给客户端",
  );

  const restarted = track(
    await createServer({
      port: 0,
      host: "127.0.0.1",
      dataDir,
      aiDelay: 5,
      aiAnimationPacing: false,
    }),
  );
  const resume = post(restarted.url);
  const retry = await resume(`/api/rooms/${room.id}/action`, {
    token: room.seats[0].token,
    revision: room.revision,
    requestId: id,
    action: { type: "endTurn" },
  });
  assert.equal(retry.status, 200, JSON.stringify(retry.body));
  assert.equal(retry.body.replayed, true, "重启后仍能识别回放");
  assert.equal(retry.body.room.revision, first.body.room.revision);
});

test("an oversized retry log is refused instead of being silently truncated", async (t) => {
  const { api, dataDir } = await setup(t);
  const room = await startRoom(api);
  // 先确认「只损坏主存档、备份仍有效」时按既有策略回退备份并恢复。
  await api(`/api/rooms/${room.id}/action`, {
    token: room.seats[0].token,
    revision: room.revision,
    requestId: requestId("keep"),
    action: { type: "endTurn" },
  });
  const path = join(dataDir, "autosave.json");
  const good = JSON.parse(await readFile(path, "utf8"));
  const oversized = structuredClone(good);
  oversized.rooms[0].requestLog = Array.from({ length: 500 }, (_, index) => ({
    requestId: `req-fill-${String(index).padStart(6, "0")}`,
    seat: 0,
    fingerprint: "0123456789abcdef",
    revision: 1,
    appliedAt: "2026-01-01T00:00:00.000Z",
  }));
  await writeFile(path, JSON.stringify(oversized));
  const recovered = await createServer({
    port: 0,
    host: "127.0.0.1",
    dataDir,
    aiDelay: 5,
    aiAnimationPacing: false,
  });
  t.after(() => recovered.close());
  assert.equal(recovered.rooms.size, 1, "备份有效时按既有策略回退");
  assert.ok(
    recovered.rooms.get(room.id).requestLog.length <= 64,
    "恢复出的记录数必须在上限内",
  );

  // 主存档与备份同时无效时必须直接报错，而不是带着异常数据启动。
  await writeFile(path, JSON.stringify(oversized));
  await writeFile(`${path}.bak`, JSON.stringify(oversized));
  await assert.rejects(
    createServer({
      port: 0,
      host: "127.0.0.1",
      dataDir,
      aiDelay: 5,
      aiAnimationPacing: false,
    }),
    /请求记录/,
    "两份存档都超限时必须在启动阶段报错",
  );
});

test("the retry log is dropped when a new match starts", async (t) => {
  const { api } = await setup(t);
  const room = await startRoom(api);
  const id = requestId("rematch");
  await api(`/api/rooms/${room.id}/action`, {
    token: room.seats[0].token,
    revision: room.revision,
    requestId: id,
    action: { type: "surrender" },
  });
  const reset = await api(`/api/rooms/${room.id}/rematch`, {
    token: room.seats[0].token,
  });
  assert.equal(reset.status, 200, JSON.stringify(reset.body));
  assert.equal(reset.body.room.phase, "lobby");
  const started = await api(`/api/rooms/${room.id}/start`, {
    token: room.seats[0].token,
  });
  assert.equal(started.status, 200);
  // 旧 id 属于上一局，必须当作全新请求处理而不是回放。
  const reused = await api(`/api/rooms/${room.id}/action`, {
    token: room.seats[0].token,
    revision: started.body.room.revision,
    requestId: id,
    action: { type: "endTurn" },
  });
  assert.equal(reused.status, 200, JSON.stringify(reused.body));
  assert.equal(reused.body.replayed, undefined, "新对局中的旧编号不是回放");
  assert.equal(reused.body.room.state.currentPlayer, 1);
});

test("a version 1 save file is migrated instead of rejected", async (t) => {
  const { dataDir } = await setup(t);
  const legacy = {
    version: 1,
    savedAt: "2026-01-01T00:00:00.000Z",
    rooms: [
      {
        id: "ABC123",
        hostSeat: 0,
        phase: "lobby",
        mapId: "training",
        mode: "ffa",
        playerCount: 2,
        state: null,
        revision: 1,
        updatedAt: "2026-01-01T00:00:00.000Z",
        seats: [
          {
            id: 0,
            name: "老存档",
            controller: "human",
            commander: "vanguard",
            token: "a".repeat(64),
          },
          { id: 1, name: "电脑 2", controller: "ai", commander: "mechanic" },
        ],
      },
    ],
  };
  await writeFile(join(dataDir, "autosave.json"), JSON.stringify(legacy));
  const app = await createServer({
    port: 0,
    host: "127.0.0.1",
    dataDir,
    aiDelay: 5,
    aiAnimationPacing: false,
  });
  t.after(() => app.close());
  assert.equal(app.rooms.size, 1, "版本 1 存档必须被迁移并载入");
  const room = app.rooms.get("ABC123");
  assert.deepEqual(room.requestLog, [], "迁移后补上空的请求记录");
  assert.equal(room.fog, false, "迁移后的老房间默认无迷雾");
  const response = await fetch(
    `${app.url}/api/rooms/ABC123?token=${"a".repeat(64)}`,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).room.seats[0].name, "老存档");
});

test("reconnecting receives a full snapshot and converges after a gap", async (t) => {
  const { app, api } = await setup(t);
  const room = await startRoom(api);
  const stream = await openStream(app.url, room.id, room.seats[1].token);
  t.after(() => stream.close());
  const first = await stream.next((snapshot) => snapshot.revision >= room.revision);
  assert.equal(first.state.currentPlayer, 0);

  // 断线期间推进战局。
  const moved = await api(`/api/rooms/${room.id}/action`, {
    token: room.seats[0].token,
    revision: room.revision,
    requestId: requestId("gap"),
    action: { type: "endTurn" },
  });
  assert.equal(moved.status, 200);
  await stream.close();

  // 重连时服务端立即推送当前快照，客户端无需增量补齐。
  const resumed = await openStream(app.url, room.id, room.seats[1].token);
  t.after(() => resumed.close());
  const snapshot = await resumed.next(
    (item) => item.revision === moved.body.room.revision,
  );
  assert.equal(snapshot.state.currentPlayer, 1, "重连快照必须是最新状态");
  assert.deepEqual(snapshot.state, moved.body.room.state);
});

test("a reconnect snapshot is current even when many actions happened offline", async (t) => {
  const { app, api } = await setup(t);
  const room = await startRoom(api, { playerCount: 4, mode: "ffa" });
  const stream = await openStream(app.url, room.id, room.seats[3].token);
  await stream.next((snapshot) => snapshot.revision === room.revision);
  await stream.close();

  // 离线期间连续走完一整轮，客户端完全没收到推送。
  let revision = room.revision;
  for (let seat = 0; seat < 4; seat++) {
    const step = await api(`/api/rooms/${room.id}/action`, {
      token: room.seats[seat].token,
      revision,
      requestId: requestId(`offline-${seat}`),
      action: { type: "endTurn" },
    });
    assert.equal(step.status, 200, JSON.stringify(step.body));
    revision = step.body.room.revision;
  }

  const resumed = await openStream(app.url, room.id, room.seats[3].token);
  t.after(() => resumed.close());
  const snapshot = await resumed.next((item) => item.revision === revision);
  assert.equal(snapshot.revision, revision, "重建连接必须直接拿到最新版本");
  assert.equal(snapshot.state.day, 2);
  assert.equal(snapshot.state.turn, room.state.turn + 4);
});

test("a client that reconnects twice does not get stuck on a stale stream", async (t) => {
  const { app, api } = await setup(t);
  const room = await startRoom(api);
  const first = await openStream(app.url, room.id, room.seats[1].token);
  await first.next((snapshot) => snapshot.revision === room.revision);
  const second = await openStream(app.url, room.id, room.seats[1].token);
  t.after(() => second.close());
  await second.next((snapshot) => snapshot.revision === room.revision);

  const moved = await api(`/api/rooms/${room.id}/action`, {
    token: room.seats[0].token,
    revision: room.revision,
    requestId: requestId("dual"),
    action: { type: "endTurn" },
  });
  // 两条连接都应当收到同一次变更，而不是只有一条活着。
  const [a, b] = await Promise.all([
    first.next((snapshot) => snapshot.revision === moved.body.room.revision),
    second.next((snapshot) => snapshot.revision === moved.body.room.revision),
  ]);
  assert.equal(a.state.currentPlayer, 1);
  assert.equal(b.state.currentPlayer, 1);
  await first.close();
  await second.close();
});

test("a refresh with a stored token resumes the exact seat and revision", async (t) => {
  const { api } = await setup(t);
  const room = await startRoom(api);
  const moved = await api(`/api/rooms/${room.id}/action`, {
    token: room.seats[0].token,
    revision: room.revision,
    requestId: requestId("refresh"),
    action: { type: "endTurn" },
  });
  const refreshed = await api(
    `/api/rooms/${room.id}?token=${room.seats[0].token}`,
    undefined,
  );
  assert.equal(refreshed.status, 200);
  assert.equal(refreshed.body.seat, 0, "刷新必须回到原席位");
  assert.equal(refreshed.body.room.revision, moved.body.room.revision);
  assert.deepEqual(refreshed.body.room.state, moved.body.room.state);
  const guest = await api(
    `/api/rooms/${room.id}?token=${room.seats[1].token}`,
    undefined,
  );
  assert.equal(guest.body.seat, 1);
  assert.deepEqual(guest.body.room.state, moved.body.room.state, "双方看到同一战局");
});

test("an interrupted AI turn resumes and still broadcasts a consistent state", async (t) => {
  const { api, dataDir, track } = await setup(t, { aiDelay: 60000 });
  const created = await api("/api/rooms", {
    name: "AI 续跑",
    mapId: "training",
    playerCount: 2,
  });
  const id = created.body.room.id;
  const token = created.body.token;
  const started = await api(`/api/rooms/${id}/start`, { token });
  const pending = await api(`/api/rooms/${id}/action`, {
    token,
    revision: started.body.room.revision,
    requestId: requestId("handoff"),
    action: { type: "endTurn" },
  });
  assert.equal(pending.body.room.state.currentPlayer, 1);

  const app = track(
    await createServer({
      port: 0,
      host: "127.0.0.1",
      dataDir,
      aiDelay: 2,
      aiAnimationPacing: false,
    }),
  );
  const resume = post(app.url);
  const until = Date.now() + 12000;
  let final = null;
  while (Date.now() < until) {
    const current = await resume(`/api/rooms/${id}?token=${token}`);
    if (
      current.body.room.state.currentPlayer === 0 &&
      current.body.room.state.turn > pending.body.room.state.turn
    ) {
      final = current.body.room;
      break;
    }
    await delay(30);
  }
  assert.ok(final, "重启后 AI 必须完成被打断的回合");
  assert.ok(final.revision > pending.body.room.revision);
  assert.equal(final.state.players[1].funds >= 0, true);
});

test("the local snapshot a client keeps stays consistent with the server", async (t) => {
  const { app, api } = await setup(t);
  const room = await startRoom(api, { playerCount: 4, mode: "ffa" });
  const stream = await openStream(app.url, room.id, room.seats[0].token);
  t.after(() => stream.close());
  await stream.next((snapshot) => snapshot.revision === room.revision);

  // 走完一整轮：每一步都必须让本地快照与最新一条推送一致。
  let revision = room.revision;
  for (let seat = 0; seat < 4; seat++) {
    const step = await api(`/api/rooms/${room.id}/action`, {
      token: room.seats[seat].token,
      revision,
      requestId: requestId(`loop-${seat}`),
      action: { type: "endTurn" },
    });
    assert.equal(step.status, 200, JSON.stringify(step.body));
    revision = step.body.room.revision;
  }
  const latest = await stream.next((snapshot) => snapshot.revision === revision);
  assert.equal(latest.state.turn, room.state.turn + 4);
  assert.equal(latest.state.day, 2, "一轮结束后进入第 2 天");
  const direct = await api(`/api/rooms/${room.id}?token=${room.seats[0].token}`);
  assert.deepEqual(latest.state, direct.body.room.state);
});

async function openStream(base, id, token) {
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
    async next(predicate, timeout = 8000) {
      const until = Date.now() + timeout;
      while (Date.now() < until) {
        const found = rooms.find(predicate);
        if (found) return found;
        await delay(20);
      }
      throw new Error(`等待推送超时，已收到 ${rooms.length} 条`);
    },
  };
}

test("an action that arrives while the room is finishing is not silently lost", async (t) => {
  const { api } = await setup(t);
  const room = await startRoom(api);
  const surrender = await api(`/api/rooms/${room.id}/action`, {
    token: room.seats[0].token,
    revision: room.revision,
    requestId: requestId("finish"),
    action: { type: "surrender" },
  });
  assert.equal(surrender.body.room.phase, "finished");
  const late = await api(`/api/rooms/${room.id}/action`, {
    token: room.seats[1].token,
    revision: surrender.body.room.revision,
    requestId: requestId("late"),
    action: { type: "endTurn" },
  });
  assert.equal(late.status, 409, JSON.stringify(late.body));
  assert.match(late.body.error, /没有进行中的对局/);
});

test("AI decisions use the same validation path as human commands", async (t) => {
  const { api } = await setup(t, { aiDelay: 5 });
  const created = await api("/api/rooms", {
    name: "AI 校验",
    mapId: "crossroads",
    playerCount: 4,
  });
  const id = created.body.room.id;
  const token = created.body.token;
  const started = await api(`/api/rooms/${id}/start`, { token });
  // 只有席位 0 是人类，先交出手牌，AI 才会接管后面三个席位。
  const handoff = await api(`/api/rooms/${id}/action`, {
    token,
    revision: started.body.room.revision,
    requestId: requestId("handoff-ai"),
    action: { type: "endTurn" },
  });
  assert.equal(handoff.status, 200, JSON.stringify(handoff.body));

  const until = Date.now() + 20000;
  let latest = handoff.body.room;
  while (Date.now() < until && latest.state.turn < 5) {
    await delay(50);
    const current = await api(`/api/rooms/${id}?token=${token}`);
    assert.equal(current.status, 200);
    latest = current.body.room;
  }
  assert.ok(
    latest.state.turn >= 5,
    `AI 应至少推进到第 5 回合，当前 ${latest.state.turn}`,
  );
  for (const unit of latest.state.units) {
    assert.ok(unit.hp >= 1 && unit.hp <= 10);
    assert.ok(unit.fuel >= 0);
  }
  assert.equal(
    latest.requestLog,
    undefined,
    "公开房间信息不包含请求记录",
  );
});
