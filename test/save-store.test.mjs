import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SAVE_VERSION, createSaveStore } from "../save-store.mjs";

async function fixture(t) {
  const dataDir = await mkdtemp(join(tmpdir(), "field-command-save-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  return dataDir;
}

test("atomic autosaves recover last valid backup and do not overwrite manual slots", async (t) => {
  const dataDir = await fixture(t);
  const recovered = [];
  const options = {
    dataDir,
    validate: (rooms) => rooms.every((room) => Number.isInteger(room.turn)),
    onRecovery: (recovery) => recovered.push(recovery),
  };
  const store = await createSaveStore(options);
  assert.equal(await store.load(), null);
  await store.save([{ turn: 1 }]);
  await store.save([{ turn: 1 }], "manual-ABC123");
  await store.save([{ turn: 2 }]);
  await store.save([{ turn: 3 }]);
  assert.equal((await store.load("manual-ABC123")).rooms[0].turn, 1);
  await writeFile(join(dataDir, "autosave.json"), "{broken");
  assert.equal((await store.load()).rooms[0].turn, 2);
  assert.equal(recovered.length, 1);
  await store.save([{ turn: 4 }]);
  assert.equal(
    JSON.parse(await readFile(join(dataDir, "autosave.json.bak"), "utf8"))
      .rooms[0].turn,
    2,
  );
  const freshStore = await createSaveStore(options);
  assert.equal((await freshStore.load()).rooms[0].turn, 4);
  assert.equal((await freshStore.load()).version, SAVE_VERSION);
});

test("queued snapshots are immutable, serialized, and reject invalid schema or slot paths", async (t) => {
  const dataDir = await fixture(t);
  const store = await createSaveStore({
    dataDir,
    validate: (rooms) => rooms.every((room) => Number.isInteger(room.turn)),
  });
  const mutable = [{ turn: 1 }];
  const first = store.save(mutable);
  mutable[0].turn = 999;
  const second = store.save([{ turn: 2 }]);
  await Promise.all([first, second]);
  assert.equal((await store.load()).rooms[0].turn, 2);
  assert.equal(
    JSON.parse(await readFile(join(dataDir, "autosave.json.bak"), "utf8"))
      .rooms[0].turn,
    1,
  );
  assert.throws(() => store.save([{ turn: "bad" }]), /检查/);
  assert.throws(() => store.save([], "../escape"), /名称/);
  await writeFile(
    join(dataDir, "autosave.json"),
    JSON.stringify({ version: 999, savedAt: "future", rooms: [] }),
  );
  await writeFile(
    join(dataDir, "autosave.json.bak"),
    JSON.stringify({ version: 999, savedAt: "future", rooms: [] }),
  );
  await assert.rejects(store.load(), /不支持的存档版本/);
});

test("structurally invalid saves use backup, while unrecoverable corruption is reported", async (t) => {
  const dataDir = await fixture(t);
  const store = await createSaveStore({
    dataDir,
    validate: (rooms) => rooms.every((room) => Number.isInteger(room.turn)),
  });
  await store.save([{ turn: 1 }]);
  await store.save([{ turn: 2 }]);
  await writeFile(
    join(dataDir, "autosave.json"),
    JSON.stringify({ version: 1, savedAt: "now", rooms: [{ turn: "bad" }] }),
  );
  assert.equal((await store.load()).rooms[0].turn, 1);
  await writeFile(join(dataDir, "autosave.json.bak"), "broken");
  await assert.rejects(store.load(), /无法读取/);
});
