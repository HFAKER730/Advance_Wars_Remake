import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "../server.mjs";
import { chooseAIAction } from "../public/shared/engine.mjs";
import { actionAnimationDuration } from "../public/shared/animation-timing.mjs";

async function setup(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), "field-command-server-"));
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
    api: client(app.url),
    track: (server) => {
      apps.push(server);
      return server;
    },
  };
}

function client(base) {
  return async (path, body, expected = 200, options = {}) => {
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
    const result = await response.json();
    assert.equal(
      response.status,
      expected,
      `${path}: ${JSON.stringify(result)}`,
    );
    return result;
  };
}

async function waitFor(predicate, timeout = 8000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const value = await predicate();
    if (value) return value;
    await delay(20);
  }
  throw new Error("Timed out waiting for server state");
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
  };
}

test("two HTTP clients enforce ownership, revision, host permissions and room token isolation", async (t) => {
  const { api } = await setup(t);
  const host = await api(
    "/api/rooms",
    { name: "红方", playerCount: 2, mapId: "training", commander: "vanguard" },
    201,
  );
  const id = host.room.id;
  const guest = await api(`/api/rooms/${id}/join`, {
    name: "蓝方",
    commander: "mechanic",
  });
  const other = await api("/api/rooms", { name: "别的房间" }, 201);
  assert.equal(guest.seat, 1);
  await api(`/api/rooms/${id}?token=${other.token}`, undefined, 403);
  await api(`/api/rooms/${id}`, undefined, 403);
  await api(`/api/rooms/${id}/start`, { token: guest.token }, 403);
  await api(
    `/api/rooms/${id}/configure`,
    { token: host.token, slots: [{ seat: 1, controller: "ai" }] },
    409,
  );
  const started = await api(`/api/rooms/${id}/start`, { token: host.token });
  assert.equal(started.room.phase, "playing");
  assert.equal(started.room.state.currentPlayer, 0);
  await api(
    `/api/rooms/${id}/action`,
    { token: guest.token, action: { type: "endTurn" } },
    403,
  );
  await api(
    `/api/rooms/${id}/action`,
    { token: other.token, action: { type: "endTurn" } },
    403,
  );
  await api(
    `/api/rooms/${id}/action`,
    {
      token: host.token,
      revision: started.room.revision - 1,
      action: { type: "endTurn" },
    },
    409,
  );
  const hostUnit = started.room.state.units.find((unit) => unit.owner === 0);
  const next = await api(`/api/rooms/${id}/action`, {
    token: host.token,
    revision: started.room.revision,
    action: { type: "endTurn" },
  });
  assert.equal(next.room.state.currentPlayer, 1);
  await api(
    `/api/rooms/${id}/action`,
    {
      token: guest.token,
      action: {
        type: "move",
        unitId: hostUnit.id,
        x: hostUnit.x,
        y: hostUnit.y,
        command: "wait",
      },
    },
    400,
  );
  await api(`/api/rooms/${id}/join`, { name: "迟到的玩家" }, 409);
  await api(
    `/api/rooms/${id}/seat`,
    { token: guest.token, name: "战中修改" },
    409,
  );
  const finished = await api(`/api/rooms/${id}/action`, {
    token: guest.token,
    action: { type: "surrender" },
  });
  assert.equal(finished.room.phase, "finished");
  await api(`/api/rooms/${id}/rematch`, { token: guest.token }, 403);
  const reset = await api(`/api/rooms/${id}/rematch`, { token: host.token });
  assert.equal(reset.room.phase, "lobby");
  assert.equal(reset.room.state, null);
  assert.equal(reset.room.seats[1].name, "蓝方");
  for (const publicResult of [
    host.room,
    guest.room,
    next.room,
    await api("/api/rooms"),
  ]) {
    const serialized = JSON.stringify(publicResult);
    assert.ok(!serialized.includes(host.token));
    assert.ok(!serialized.includes(guest.token));
    assert.ok(!serialized.includes('"token"'));
  }
});

test("four-seat rooms assign open slots first and preserve team/commander configuration", async (t) => {
  const { api } = await setup(t);
  const host = await api(
    "/api/rooms",
    { name: "一号", playerCount: 4, mode: "teams" },
    201,
  );
  const id = host.room.id;
  await api(`/api/rooms/${id}/configure`, {
    token: host.token,
    mapId: "crossroads",
    slots: [{ seat: 2, controller: "open" }],
  });
  await api(`/api/rooms/${id}/start`, { token: host.token }, 409);
  const guest = await api(`/api/rooms/${id}/join`, { name: "三号" });
  assert.equal(guest.seat, 2);
  await api(`/api/rooms/${id}/seat`, {
    token: guest.token,
    name: "盟友",
    commander: "mechanic",
  });
  const start = await api(`/api/rooms/${id}/start`, { token: host.token });
  assert.deepEqual(
    start.room.state.players.map((player) => player.team),
    [0, 1, 0, 1],
  );
  assert.equal(start.room.state.players[2].commander, "mechanic");
  assert.equal(start.room.mapId, "crossroads");
});

test("a retried action cannot be applied twice", async (t) => {
  const { api } = await setup(t);
  const host = await api("/api/rooms", { name: "重复提交", mapId: "training" }, 201);
  const id = host.room.id;
  await api(`/api/rooms/${id}/join`, { name: "对手" });
  const started = await api(`/api/rooms/${id}/start`, { token: host.token });
  const revision = started.room.revision;
  const factory = started.room.state.tiles.find(
    (tile) => tile.type === "factory" && tile.owner === 0,
  );
  const build = { type: "build", unitType: "infantry", x: factory.x, y: factory.y };

  const first = await api(`/api/rooms/${id}/action`, {
    token: host.token,
    revision,
    action: build,
  });
  assert.equal(first.room.revision, revision + 1);
  const after = first.room.state.units.filter((unit) => unit.owner === 0).length;

  // 同一个 revision 的重复提交必须被拒绝，而不是再次扣款或再建一支部队。
  await api(
    `/api/rooms/${id}/action`,
    { token: host.token, revision, action: build },
    409,
  );
  const current = await api(`/api/rooms/${id}?token=${host.token}`);
  assert.equal(current.room.revision, first.room.revision);
  assert.equal(
    current.room.state.units.filter((unit) => unit.owner === 0).length,
    after,
    "重复提交不能改变部队数量",
  );
  assert.deepEqual(current.room.state, first.room.state);
});

test("SSE synchronizes multiple clients, counts browser tabs, and never broadcasts credentials", async (t) => {
  const { app, api } = await setup(t);
  const host = await api("/api/rooms", { name: "连接测试" }, 201);
  const id = host.room.id;
  const guest = await api(`/api/rooms/${id}/join`, { name: "远端玩家" });
  const hostStream = await connect(app.url, id, host.token);
  const hostTab = await connect(app.url, id, host.token);
  const guestStream = await connect(app.url, id, guest.token);
  t.after(async () => {
    await hostStream.close();
    await hostTab.close();
    await guestStream.close();
  });
  await guestStream.next((room) => room.seats.every((seat) => seat.connected));
  await hostStream.close();
  const stillConnected = await api(`/api/rooms/${id}?token=${guest.token}`);
  assert.equal(stillConnected.room.seats[0].connected, true);
  await hostTab.close();
  await guestStream.next(
    (room) => !room.seats[0].connected && room.seats[1].connected,
  );
  const restartedStream = await connect(app.url, id, host.token);
  t.after(() => restartedStream.close());
  await restartedStream.next((room) => room.seats[0].connected);
  const changed = await api(`/api/rooms/${id}/seat`, {
    token: host.token,
    name: "重新连接成功",
  });
  await guestStream.next(
    (room) =>
      room.revision === changed.room.revision &&
      room.seats[0].name === "重新连接成功",
  );
  for (const snapshot of guestStream.rooms) {
    assert.ok(!JSON.stringify(snapshot).includes(host.token));
    assert.ok(!JSON.stringify(snapshot).includes(guest.token));
  }
});

test("restarting the service restores exact game state and credentials; manual snapshots stay separate", async (t) => {
  const { app, api, dataDir, track } = await setup(t);
  const host = await api(
    "/api/rooms",
    { name: "持久化测试", mapId: "training" },
    201,
  );
  const id = host.room.id;
  const guest = await api(`/api/rooms/${id}/join`, { name: "重连玩家" });
  await api(`/api/rooms/${id}/start`, { token: host.token });
  const manualState = await api(`/api/rooms/${id}/action`, {
    token: host.token,
    action: { type: "endTurn" },
  });
  await api(`/api/rooms/${id}/save`, { token: host.token });
  const latest = await api(`/api/rooms/${id}/action`, {
    token: guest.token,
    action: { type: "endTurn" },
  });
  const manual = JSON.parse(
    await readFile(join(dataDir, `manual-${id}.json`), "utf8"),
  );
  assert.equal(manual.rooms[0].revision, manualState.room.revision);
  await app.close();
  const restarted = track(
    await createServer({ port: 0, host: "127.0.0.1", dataDir }),
  );
  const resumed = await client(restarted.url)(
    `/api/rooms/${id}?token=${host.token}`,
  );
  assert.deepEqual(resumed.room.state, latest.room.state);
  assert.equal(resumed.room.revision, latest.room.revision);
  assert.equal(resumed.room.seats[0].connected, false);
  assert.equal(
    (await client(restarted.url)(`/api/rooms/${id}?token=${guest.token}`)).seat,
    1,
  );
  await restarted.close();
  await writeFile(join(dataDir, "autosave.json"), "{truncated");
  const recovered = track(
    await createServer({ port: 0, host: "127.0.0.1", dataDir }),
  );
  const recoveredRoom = await client(recovered.url)(
    `/api/rooms/${id}?token=${host.token}`,
  );
  assert.equal(recoveredRoom.room.revision, manualState.room.revision);
  assert.deepEqual(recoveredRoom.room.state, manualState.room.state);
});

test(
  "AI takes a complete turn and resumes an interrupted AI turn after process restart",
  { timeout: 20000 },
  async (t) => {
    const { app, api, dataDir, track } = await setup(t, { aiDelay: 60000 });
    const host = await api(
      "/api/rooms",
      { name: "AI 测试", mapId: "training" },
      201,
    );
    const id = host.room.id;
    await api(`/api/rooms/${id}/start`, { token: host.token });
    const pending = await api(`/api/rooms/${id}/action`, {
      token: host.token,
      action: { type: "endTurn" },
    });
    assert.equal(pending.room.state.currentPlayer, 1);
    await app.close();
    const restarted = track(
      await createServer({ port: 0, host: "127.0.0.1", dataDir, aiDelay: 2, aiAnimationPacing: false }),
    );
    const resumeApi = client(restarted.url);
    const finishedTurn = await waitFor(async () => {
      const current = await resumeApi(`/api/rooms/${id}?token=${host.token}`);
      return current.room.state.currentPlayer === 0 &&
        current.room.state.turn > pending.room.state.turn
        ? current
        : null;
    }, 12000);
    assert.ok(finishedTurn.room.revision > pending.room.revision);
    assert.ok(finishedTurn.room.state.players[1].funds >= 0);
  },
);

test("AI broadcasts the next instruction only after the previous animation timeline", async (t) => {
  const { api } = await setup(t, { aiDelay: 20, aiAnimationPacing: true });
  const host = await api("/api/rooms", { name: "动画节奏", mapId: "training" }, 201);
  const id = host.room.id;
  await api(`/api/rooms/${id}/start`, { token: host.token });
  const pending = await api(`/api/rooms/${id}/action`, {
    token: host.token, action: { type: "endTurn" },
  });
  const firstAction = chooseAIAction(pending.room.state, 1);
  assert.equal(firstAction.type, "move");
  const first = await waitFor(async () => {
    const result = await api(`/api/rooms/${id}?token=${host.token}`);
    return result.room.revision > pending.room.revision ? result.room : null;
  });
  const animation = actionAnimationDuration(pending.room.state, first.state, firstAction);
  assert.ok(animation > 150);
  await delay(100);
  const during = await api(`/api/rooms/${id}?token=${host.token}`);
  assert.equal(during.room.revision, first.revision);
  const next = await waitFor(async () => {
    const result = await api(`/api/rooms/${id}?token=${host.token}`);
    return result.room.revision > first.revision ? result.room : null;
  }, animation + 2000);
  assert.equal(next.revision, first.revision + 1);
});

test("API rejects cross-origin, malformed, oversized requests and keeps private files inaccessible", async (t) => {
  const { app, api } = await setup(t);
  await api("/api/rooms", { playerCount: 8 }, 400);
  await api("/api/rooms", { mapId: "../private" }, 400);
  await api("/api/rooms", { commander: "__proto__" }, 400);
  await api("/api/rooms", { name: "no" }, 403, {
    headers: { Origin: "https://unrelated.example" },
  });
  await api("/api/rooms", { name: "x".repeat(70_000) }, 413);
  for (const path of [
    "/server.mjs",
    "/save-store.mjs",
    "/data/autosave.json",
    "/%2e%2e/server.mjs",
    "/.git/config",
  ]) {
    assert.equal((await fetch(`${app.url}${path}`)).status, 404, path);
  }
  assert.equal((await fetch(`${app.url}/shared/engine.mjs`)).status, 200);
  const malformed = await fetch(`${app.url}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
});
