import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Bumped in M2 for request-deduplication records and in M4 for the room fog
 * toggle. Tests import it so a bump does not need a test edit.
 */
export const SAVE_VERSION = 3;

/** Versioned snapshots. Writes are serialized and both primary/backup are atomic. */
export async function createSaveStore({
  dataDir,
  validate = () => true,
  onRecovery = () => {},
  /** `{ [fromVersion]: (snapshot) => snapshot }`, applied in sequence. */
  migrations = {},
}) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  let queue = Promise.resolve();

  function pathFor(slot) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(slot)) throw new Error("无效的存档名称");
    return join(dataDir, `${slot}.json`);
  }

  /**
   * Applies registered migrations in order. An older version without a
   * migrator and a version newer than this build both fail loudly rather than
   * being loaded under the wrong rules.
   */
  function migrate(snapshot) {
    let current = snapshot;
    while (Number.isInteger(current?.version) && current.version < SAVE_VERSION) {
      const upgrade = migrations[current.version];
      if (!upgrade) throw new Error(`缺少版本 ${current.version} 的存档迁移器`);
      current = upgrade(structuredClone(current));
    }
    if (current?.version !== SAVE_VERSION)
      throw new Error(
        current?.version > SAVE_VERSION
          ? `不支持的存档版本：${current.version}（高于当前支持的 ${SAVE_VERSION}）`
          : `不支持的存档版本：${current?.version ?? "未知"}`,
      );
    return current;
  }

  function parse(raw) {
    const snapshot = migrate(JSON.parse(raw));
    if (
      typeof snapshot.savedAt !== "string" ||
      !Array.isArray(snapshot.rooms)
    ) {
      throw new Error("存档结构不完整");
    }
    if (validate(snapshot.rooms) === false)
      throw new Error("存档内容未通过检查");
    return snapshot;
  }

  async function atomicWrite(path, raw) {
    const temporary = `${path}.${process.pid}.${randomBytes(5).toString("hex")}.tmp`;
    let file;
    try {
      file = await open(temporary, "wx", 0o600);
      await file.writeFile(raw, "utf8");
      await file.sync();
      await file.close();
      file = null;
      await rename(temporary, path);
      // Persist the directory entry as well as the file contents on local disks.
      let directory;
      try {
        directory = await open(dataDir, "r");
        await directory.sync();
      } catch (error) {
        if (
          !["EINVAL", "ENOTSUP", "EISDIR", "EPERM", "EBADF"].includes(
            error.code,
          )
        )
          throw error;
      } finally {
        await directory?.close();
      }
    } finally {
      await file?.close();
      await unlink(temporary).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }

  async function load(slot = "autosave") {
    const path = pathFor(slot);
    let primaryError;
    try {
      return parse(await readFile(path, "utf8"));
    } catch (error) {
      primaryError = error;
    }
    try {
      const backup = parse(await readFile(`${path}.bak`, "utf8"));
      onRecovery({ slot, reason: primaryError.message });
      return backup;
    } catch (backupError) {
      if (primaryError.code === "ENOENT" && backupError.code === "ENOENT")
        return null;
      throw new Error(`无法读取${slot}存档或备份：${primaryError.message}`, {
        cause: primaryError,
      });
    }
  }

  function save(rooms, slot = "autosave") {
    const path = pathFor(slot);
    // Capture immediately: subsequent game actions must not mutate a queued save.
    const raw = JSON.stringify({
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      rooms,
    });
    parse(raw);
    const operation = queue.then(async () => {
      let previous;
      try {
        previous = await readFile(path, "utf8");
        parse(previous);
      } catch (error) {
        // Never replace the last good backup with malformed primary data.
        if (error.code && error.code !== "ENOENT") throw error;
        previous = null;
      }
      if (previous !== null) await atomicWrite(`${path}.bak`, previous);
      await atomicWrite(path, raw);
    });
    queue = operation.catch(() => {});
    return operation;
  }

  return { load, save, flush: () => queue };
}
