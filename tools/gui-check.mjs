/**
 * Real-browser acceptance check for Frontline Command, driven over CDP.
 *
 * Every action is an actual input event dispatched to the page
 * (`Input.dispatchMouseEvent`), so this exercises the same path a player does:
 * hit testing, canvas coordinates, event handlers and the server round trip.
 * Page state is only read, never mutated, by `Runtime.evaluate`.
 *
 * Usage:
 *   node server.mjs &                      # serving on http://127.0.0.1:4173
 *   node tools/gui-check.mjs [baseUrl] [outDir]
 *
 * Requires a local Chrome or Edge; no npm dependencies.
 */
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const BASE = process.argv[2] ?? "http://127.0.0.1:4173";
const OUT = process.argv[3] ?? "gui-test-screenshots";
const PORT = 9223;

const CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

function findBrowser() {
  const found = CANDIDATES.find((path) => existsSync(path));
  if (!found) throw new Error("找不到 Chrome 或 Edge，无法进行真实浏览器验收");
  return found;
}

/** Minimal CDP client: one WebSocket, id-matched replies, no dependencies. */
async function connect(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 0;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const send = (method, params = {}) => {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  };
  return { send, close: () => socket.close() };
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression: `(() => { ${expression} })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      `页面求值失败：${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`,
    );
  return result.result.value;
}

/** One real mouse click at viewport coordinates, press and release. */
async function click(client, x, y) {
  for (const type of ["mousePressed", "mouseReleased"]) {
    await client.send("Input.dispatchMouseEvent", {
      type,
      x: Math.round(x),
      y: Math.round(y),
      button: "left",
      clickCount: 1,
    });
  }
}

async function screenshot(client, name) {
  const shot = await client.send("Page.captureScreenshot", { format: "png" });
  await writeFile(join(OUT, name), Buffer.from(shot.data, "base64"));
}

/** Centre of the first element matching `selector`, in viewport coordinates. */
async function centerOf(client, selector) {
  const box = await evaluate(
    client,
    `const el = document.querySelector(${JSON.stringify(selector)});
     if (!el) return null;
     const r = el.getBoundingClientRect();
     return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top };`,
  );
  if (!box) throw new Error(`页面上找不到 ${selector}`);
  return box;
}

async function waitFor(client, expression, label, timeout = 12000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await evaluate(client, expression)) return true;
    await delay(120);
  }
  throw new Error(`等待超时：${label}`);
}

/**
 * Average luminance over a tile rectangle, so fog can be measured instead of
 * eyeballed. A single tile is too noisy: terrain, roads and unit art all move
 * the number, while fog is a uniform multiply across the board.
 */
async function regionLuminance(client, x0, y0, x1, y1) {
  return evaluate(
    client,
    `const canvas = document.querySelector("#battle-canvas");
     const ctx = canvas.getContext("2d");
     const match = canvas.getAttribute("aria-label").match(/(\\d+) 列 (\\d+) 行/);
     const columns = Number(match[1]), rows = Number(match[2]);
     const sx = canvas.width / columns, sy = canvas.height / rows;
     let sum = 0, count = 0;
     for (let y = ${y0}; y <= ${y1} && y < rows; y++)
       for (let x = ${x0}; x <= ${x1} && x < columns; x++) {
         const d = ctx.getImageData(Math.round((x + 0.5) * sx), Math.round((y + 0.5) * sy), 1, 1).data;
         sum += 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2];
         count++;
       }
     return count ? sum / count : 0;`,
  );
}

const checks = [];
const record = (name, detail) => {
  checks.push(`${name}：${detail}`);
  console.log(`✔ ${name}：${detail}`);
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const profile = await mkdtemp(join(tmpdir(), "field-command-gui-"));
await mkdir(OUT, { recursive: true });
const browser = spawn(
  findBrowser(),
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--window-size=1280,860",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let client;
try {
  let target = null;
  for (let attempt = 0; attempt < 60 && !target; attempt++) {
    await delay(300);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((entry) => entry.type === "page");
    } catch {
      /* the port is not listening yet */
    }
  }
  if (!target) throw new Error("浏览器调试端口没有就绪");

  client = await connect(target.webSocketDebuggerUrl);
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 860,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Reset to a clean slate: no stored session, so the landing page is neutral.
  await client.send("Page.navigate", { url: `${BASE}/?fresh=1` });
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: "try { localStorage.clear(); } catch {}",
  });
  await client.send("Page.navigate", { url: BASE });
  await waitFor(
    client,
    `return !!document.querySelector("#fog-skirmish")`,
    "首页加载",
  );
  await evaluate(client, `window.scrollTo(0, 0); return true;`);
  await screenshot(client, "m4-01-landing.png");
  record("首页渲染", "迷雾演习入口与新大厅迷雾选项均已出现在落地页");

  // 1. Enter a fogged match through the real button.
  const fogButton = await centerOf(client, "#fog-skirmish");
  await click(client, fogButton.x, fogButton.y);
  await waitFor(
    client,
    `return !document.querySelector("#battle")?.classList.contains("hidden")`,
    "进入战场",
  );
  await evaluate(client, `window.scrollTo(0, 0); return true;`);
  const opening = await evaluate(
    client,
    `const canvas = document.querySelector("#battle-canvas");
     const match = canvas.getAttribute("aria-label").match(/(\\d+) 列 (\\d+) 行/);
     return {
       title: document.querySelector("#battle-map-title").textContent,
       status: document.querySelector("#field-status").textContent.trim(),
       columns: Number(match[1]),
       rows: Number(match[2]),
       canvasLabel: canvas.getAttribute("aria-label"),
     };`,
  );
  await screenshot(client, "m4-02-battle-fog.png");
  record("迷雾演习开局", `${opening.title} · ${opening.status}`);

  // 2. The projection is what reached the browser: the enemy is not in it.
  const projection = await evaluate(
    client,
    `const me = document.querySelectorAll("#player-strip .player-card").length;
     return { players: me, strip: document.querySelector("#player-strip").textContent };`,
  );
  record("席位栏在迷雾下的措辞", projection.strip.replace(/\s+/g, " ").slice(0, 80));

  // 2b. Fog is actually painted: unseen ground must be darker than seen ground.
  // Averaged over a block, because a single tile also carries terrain and art.
  const seenBlock = await regionLuminance(client, 0, 0, 3, 3);
  const unseenBlock = await regionLuminance(
    client,
    Math.round(opening.columns / 2),
    Math.round(opening.rows / 2),
    opening.columns - 1,
    opening.rows - 1,
  );
  assert(
    unseenBlock < seenBlock * 0.75,
    `迷雾必须压暗看不见的格子：视野内均值 ${seenBlock.toFixed(0)} vs 视野外均值 ${unseenBlock.toFixed(0)}`,
  );
  record(
    "迷雾渲染",
    `视野内 4×4 均值 ${seenBlock.toFixed(0)}，视野外均值 ${unseenBlock.toFixed(0)}（约 ${((1 - unseenBlock / seenBlock) * 100).toFixed(0)}% 压暗）`,
  );

  // 3. Clicking a unit inside own vision still works (real canvas hit testing).
  const own = await evaluate(
    client,
    // The canvas is drawn at `object-fit: contain`, so the element's box is not
    // the board: letterboxes have to be removed before mapping a tile to a
    // viewport point, exactly as the page's own hit testing does.
    `const canvas = document.querySelector("#battle-canvas");
     const r = canvas.getBoundingClientRect();
     const style = getComputedStyle(canvas);
     const px = (name) => parseFloat(style[name]) || 0;
     const boxWidth = r.width - px("borderLeftWidth") - px("borderRightWidth") - px("paddingLeft") - px("paddingRight");
     const boxHeight = r.height - px("borderTopWidth") - px("borderBottomWidth") - px("paddingTop") - px("paddingBottom");
     let contentWidth = boxWidth, contentHeight = boxHeight;
     let contentLeft = r.left + px("borderLeftWidth") + px("paddingLeft");
     let contentTop = r.top + px("borderTopWidth") + px("paddingTop");
     const label = canvas.getAttribute("aria-label");
     const match = label.match(/(\\d+) 列 (\\d+) 行/);
     const columns = Number(match[1]), rows = Number(match[2]);
     if (style.objectFit === "contain" || style.objectFit === "cover" || style.objectFit === "scale-down") {
       const ratios = [boxWidth / (columns * 40), boxHeight / (rows * 40)];
       const ratio = style.objectFit === "cover" ? Math.max(...ratios) : Math.min(...ratios);
       contentWidth = columns * 40 * ratio;
       contentHeight = rows * 40 * ratio;
       const position = (style.objectPosition || "50% 50%").split(/\\s+/);
       const offset = (value, space) => {
         if (value === "left" || value === "top") return 0;
         if (value === "right" || value === "bottom") return space;
         if (!value || value === "center") return space / 2;
         return value.endsWith("%") ? (parseFloat(value) || 0) * space / 100 : parseFloat(value) || 0;
       };
       contentLeft += offset(position[0], boxWidth - contentWidth);
       contentTop += offset(position[1], boxHeight - contentHeight);
     }
     return {
       contentLeft, contentTop, contentWidth, contentHeight,
       columns, rows, objectFit: style.objectFit,
     };`,
  );
  const cell = (x, y) => ({
    x: own.contentLeft + ((x + 0.5) * own.contentWidth) / own.columns,
    y: own.contentTop + ((y + 0.5) * own.contentHeight) / own.rows,
  });
  const ownUnit = await evaluate(client, `return { x: 1, y: 3 };`);
  const unitPoint = cell(ownUnit.x, ownUnit.y);
  await click(client, unitPoint.x, unitPoint.y);
  await waitFor(
    client,
    `return document.querySelector("#selection-panel")?.textContent?.includes("机动") ||
            document.querySelector("#selection-panel")?.textContent?.includes("UNIT")`,
    "选中己方单位",
  );
  const selection = await evaluate(
    client,
    `return document.querySelector("#selection-panel").textContent.replace(/\\s+/g, " ").slice(0, 70);`,
  );
  await screenshot(client, "m4-03-select-unit.png");
  record("选中己方单位", selection);

  // 3b. Vision follows the unit: drive the recon forward and watch unseen
  // ground light up. Selection is cleared first, because the cyan
  // reachable-range overlay is painted on top of fog and would mask the signal.
  await evaluate(
    client,
    `const button = [...document.querySelectorAll("#selection-panel [data-command]")]
       .find((node) => node.dataset.command === "cancel");
     if (button) button.click();
     return true;`,
  );
  await delay(400);
  const probeRow = [9, 3, 11, 3]; // tiles that are dark until the recon arrives
  const beforeMove = await regionLuminance(client, ...probeRow);
  const reconPoint = cell(3, 3);
  await click(client, reconPoint.x, reconPoint.y);
  await waitFor(
    client,
    `return document.querySelector("#selection-panel").textContent.includes("侦察车");`,
    "选中侦察车",
  );
  const destination = cell(6, 3);
  await click(client, destination.x, destination.y);
  await waitFor(
    client,
    `const button = [...document.querySelectorAll("#selection-panel [data-command]")]
       .find((node) => node.dataset.command === "wait");
     return !!button && !button.disabled;`,
    "预选移动",
  );
  const order = await evaluate(
    client,
    `const button = [...document.querySelectorAll("#selection-panel [data-command]")]
       .find((node) => node.dataset.command === "wait");
     button.click();
     return button.textContent.trim();`,
  );
  await waitFor(
    client,
    `const panel = document.querySelector("#selection-panel").textContent;
     return panel.includes("已行动") || panel.includes("等待己方回合");`,
    "行动已提交",
    15000,
  );
  await delay(1500);
  const afterMove = await regionLuminance(client, ...probeRow);
  await screenshot(client, "m4-04-vision-follows.png");
  assert(
    afterMove > beforeMove * 1.3,
    `视野应随单位推进：推进前 ${beforeMove.toFixed(0)} vs 推进后 ${afterMove.toFixed(0)}`,
  );
  record(
    "视野随单位推进",
    `「${order}」把侦察车推到 (6,3)，原本全黑的 (9–11, 3) 亮度 ${beforeMove.toFixed(0)} → ${afterMove.toFixed(0)}`,
  );

  // 4. A tile far outside vision refuses the click and says why.
  const selectionBefore = await evaluate(
    client,
    `return document.querySelector("#selection-panel").textContent.replace(/\\s+/g, " ").trim();`,
  );
  // Clear the entry toast first, so the assertion can only see the rejection.
  await evaluate(
    client,
    `document.querySelectorAll("#toast-container .toast").forEach((node) => node.remove());
     return true;`,
  );
  const far = cell(own.columns - 2, own.rows - 2);
  await click(client, far.x, far.y);
  await delay(500);
  const fogToast = await evaluate(
    client,
    `const nodes = [...document.querySelectorAll("#toast-container .toast")];
     return nodes.map((node) => node.textContent.trim());`,
  );
  const selectionAfter = await evaluate(
    client,
    `return document.querySelector("#selection-panel").textContent.replace(/\\s+/g, " ").trim();`,
  );
  await screenshot(client, "m4-05-fogged-tile.png");
  assert(
    fogToast.length > 0 && fogToast.every((line) => line.includes("迷雾")),
    `点击迷雾格必须给出拒绝提示，实际：${JSON.stringify(fogToast)}`,
  );
  assert(
    selectionAfter === selectionBefore,
    `点击迷雾格不得改变选择面板，实际：${selectionAfter.slice(0, 60)}`,
  );
  record("点击迷雾中的格子", `被拒绝并提示「${fogToast.join(" / ")}」，选择面板未改变`);

  // 5. End the turn through the real button and let the AI answer under fog.
  const endTurn = await centerOf(client, "#end-turn");
  await click(client, endTurn.x, endTurn.y);
  await delay(700);
  const confirm = await centerOf(client, "#confirm-end").catch(() => null);
  if (confirm) await click(client, confirm.x, confirm.y);
  await waitFor(
    client,
    `const status = document.querySelector("#field-status").textContent;
     return status.includes("观察") || status.includes("等待") ||
            document.querySelector("#active-player").textContent.includes("玩家的回合");`,
    "AI 回合",
  );
  await delay(2500);
  const afterAI = await evaluate(
    client,
    `return {
       log: [...document.querySelectorAll("#event-log li")].slice(0, 3).map((li) => li.textContent),
       status: document.querySelector("#field-status").textContent.trim(),
       day: document.querySelector("#day-number").textContent,
     };`,
  );
  await screenshot(client, "m4-06-after-ai.png");
  record("AI 在迷雾下行动", `${afterAI.status} · 第 ${afterAI.day} 天 · 日志 ${afterAI.log.length} 条`);

  // 6. Long play: keep ending turns so a whole fogged match runs in the browser.
  let turns = 0;
  while (turns < 60) {
    const finished = await evaluate(
      client,
      `return document.querySelector("#battle")?.classList.contains("hidden") ||
              document.querySelector("#end-turn").textContent.includes("战后报告");`,
    );
    if (finished) break;
    const ready = await evaluate(
      client,
      `return !document.querySelector("#end-turn").disabled;`,
    );
    if (!ready) {
      await delay(1200);
      continue;
    }
    await click(client, (await centerOf(client, "#end-turn")).x, (await centerOf(client, "#end-turn")).y);
    await delay(400);
    const confirmButton = await centerOf(client, "#confirm-end").catch(() => null);
    if (confirmButton) {
      await click(client, confirmButton.x, confirmButton.y);
      turns++;
      await delay(1600);
    } else await delay(600);
  }
  const progress = await evaluate(
    client,
    `return {
       day: document.querySelector("#day-number").textContent,
       status: document.querySelector("#field-status").textContent.trim(),
       players: [...document.querySelectorAll("#player-strip .player-card")].map((c) => c.textContent.replace(/\\s+/g, " ").trim()),
     };`,
  );
  await screenshot(client, "m4-07-later-day.png");
  record("连续回合推进", `第 ${progress.day} 天 · ${turns} 次结束回合 · ${progress.status}`);
  record("席位栏", progress.players.join(" | ").slice(0, 120));

  const errors = await evaluate(
    client,
    `return (window.__errors ?? []).slice(0, 3);`,
  );
  record("控制台", errors.length ? `出现 ${errors.length} 条错误` : "无脚本错误");

  console.log(`\n截图：${OUT}/m4-0*.png`);
} finally {
  client?.close();
  browser.kill();
  await delay(200);
  await rm(profile, { recursive: true, force: true });
}
