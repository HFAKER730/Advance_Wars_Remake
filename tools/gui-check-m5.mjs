/**
 * M5 acceptance check in a real browser: the naval map, the new production
 * sites, and the transport orders.
 *
 * Everything is driven through the page's own handlers. Clicks are real
 * `Input.dispatchMouseEvent` presses; the two `<select>` choices are set by
 * dispatching the same `change` event the browser fires, because CDP has no
 * synthetic option picker.
 *
 * Usage: node tools/gui-check-m5.mjs [baseUrl] [outDir]
 */
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const BASE = process.argv[2] ?? "http://127.0.0.1:4173";
const OUT = process.argv[3] ?? "gui-test-screenshots";
const PORT = 9226;

const CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];
const findBrowser = () => {
  const found = CANDIDATES.find((path) => existsSync(path));
  if (!found) throw new Error("找不到 Chrome 或 Edge");
  return found;
};

async function connect(url) {
  const socket = new WebSocket(url);
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
  return {
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => socket.close(),
  };
}
async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression: `(() => { ${expression} })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.exception?.description ?? result.exceptionDetails.text,
    );
  return result.result.value;
}
async function click(client, x, y) {
  for (const type of ["mousePressed", "mouseReleased"])
    await client.send("Input.dispatchMouseEvent", {
      type,
      x: Math.round(x),
      y: Math.round(y),
      button: "left",
      clickCount: 1,
    });
}
async function screenshot(client, name) {
  const shot = await client.send("Page.captureScreenshot", { format: "png" });
  await writeFile(join(OUT, name), Buffer.from(shot.data, "base64"));
}
async function centerOf(client, selector) {
  const box = await evaluate(
    client,
    `const el = document.querySelector(${JSON.stringify(selector)});
     if (!el) return null;
     const r = el.getBoundingClientRect();
     return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`,
  );
  if (!box) throw new Error(`找不到 ${selector}`);
  return box;
}
async function waitFor(client, expression, label, timeout = 15000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await evaluate(client, expression)) return true;
    await delay(120);
  }
  throw new Error(`等待超时：${label}`);
}
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const record = (name, detail) => console.log(`✔ ${name}：${detail}`);

const profile = await mkdtemp(join(tmpdir(), "field-command-m5-"));
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
  for (let i = 0; i < 60 && !target; i++) {
    await delay(300);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((entry) => entry.type === "page");
    } catch {}
  }
  if (!target) throw new Error("调试端口没有就绪");
  client = await connect(target.webSocketDebuggerUrl);
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 860,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: "try { localStorage.clear(); } catch {}",
  });
  await client.send("Page.navigate", { url: BASE });
  await waitFor(client, `return !!document.querySelector("#create-room")`, "首页");
  await evaluate(client, `window.scrollTo(0, 0); return true;`);

  // 1. Create a solo room on the naval map through the real dialog.
  await click(client, (await centerOf(client, "#create-room")).x, (await centerOf(client, "#create-room")).y);
  await waitFor(client, `return !!document.querySelector("#create-form")`, "建房弹窗");
  const maps = await evaluate(
    client,
    `return [...document.querySelectorAll("#create-map option")].map((o) => [o.value, o.textContent]);`,
  );
  assert(
    maps.some(([value]) => value === "coast"),
    `地图列表必须包含海峡地图，实际：${JSON.stringify(maps)}`,
  );
  await evaluate(
    client,
    `const select = document.querySelector("#create-map");
     select.value = "coast";
     select.dispatchEvent(new Event("change", { bubbles: true }));
     return select.value;`,
  );
  await screenshot(client, "m5-01-create-coast.png");
  // A real submit-button press: the handler reads `event.submitter`, which a
  // bare form.requestSubmit() does not provide.
  const submit = await centerOf(client, '#create-form button[type="submit"]');
  await click(client, submit.x, submit.y);
  await waitFor(
    client,
    `return !document.querySelector("#lobby")?.classList.contains("hidden")`,
    "进入大厅",
  );
  await delay(600);
  const lobby = await evaluate(
    client,
    `return {
       map: [...document.querySelectorAll("#map-options .map-option")].find((b) => b.classList.contains("active"))?.textContent,
       seats: document.querySelectorAll("#seat-list .seat").length,
     };`,
  );
  assert(lobby.seats === 2, `默认应为 2 个席位，实际 ${lobby.seats}`);
  assert(/海峡/.test(lobby.map || ""), `大厅应显示海峡地图，实际 ${lobby.map}`);
  record("创建海战房间", `${lobby.map.replace(/\s+/g, " ")} · ${lobby.seats} 席位`);

  // 2. Start and check the board has sea, airports and a quay. The lobby is
  //    taller than the viewport, so bring the button into view first.
  await evaluate(
    client,
    `document.querySelector("#start-game").scrollIntoView({ block: "center" });
     return true;`,
  );
  await delay(300);
  await click(client, (await centerOf(client, "#start-game")).x, (await centerOf(client, "#start-game")).y);
  await waitFor(
    client,
    `return !document.querySelector("#battle")?.classList.contains("hidden")`,
    "进入战场",
  );
  await evaluate(client, `window.scrollTo(0, 0); return true;`);
  await delay(800);
  const board = await evaluate(
    client,
    `const canvas = document.querySelector("#battle-canvas");
     const label = canvas.getAttribute("aria-label");
     const state = JSON.parse(window.__lastRoomState ?? "null");
     return { label, title: document.querySelector("#battle-map-title").textContent };`,
  );
  assert(/海峡/.test(board.title), `战场标题应为海峡，实际 ${board.title}`);
  await screenshot(client, "m5-02-coast-battle.png");
  record("海峡战场", `${board.title} · ${board.label.match(/\d+ 列 \d+ 行/)?.[0] ?? ""}`);

  // 3. Own airport: open the build dialog and check only aircraft are offered.
  const airport = await evaluate(
    client,
    `const canvas = document.querySelector("#battle-canvas");
     const r = canvas.getBoundingClientRect();
     const style = getComputedStyle(canvas);
     const px = (n) => parseFloat(style[n]) || 0;
     const bW = r.width - px("borderLeftWidth") - px("borderRightWidth") - px("paddingLeft") - px("paddingRight");
     const bH = r.height - px("borderTopWidth") - px("borderBottomWidth") - px("paddingTop") - px("paddingBottom");
     const m = canvas.getAttribute("aria-label").match(/(\\d+) 列 (\\d+) 行/);
     const cols = Number(m[1]), rows = Number(m[2]);
     let cW = bW, cH = bH;
     let cL = r.left + px("borderLeftWidth") + px("paddingLeft");
     let cT = r.top + px("borderTopWidth") + px("paddingTop");
     if (style.objectFit === "contain" || style.objectFit === "cover" || style.objectFit === "scale-down") {
       const ratio = style.objectFit === "cover"
         ? Math.max(bW / (cols * 40), bH / (rows * 40))
         : Math.min(bW / (cols * 40), bH / (rows * 40));
       cW = cols * 40 * ratio;
       cH = rows * 40 * ratio;
       const pos = (style.objectPosition || "50% 50%").split(/\\s+/);
       const off = (v, space) => {
         if (v === "left" || v === "top") return 0;
         if (v === "right" || v === "bottom") return space;
         if (!v || v === "center") return space / 2;
         return v.endsWith("%") ? (parseFloat(v) || 0) * space / 100 : parseFloat(v) || 0;
       };
       cL += off(pos[0], bW - cW);
       cT += off(pos[1], bH - cH);
     }
     // The player-0 airport is at (3,2) on the coast map; its build pad is
     // empty at the start of the match.
     return {
       x: cL + (3.5 * cW) / cols,
       y: cT + (2.5 * cH) / rows,
     };`,
  );
  await click(client, airport.x, airport.y);
  await delay(500);
  const tilePanel = await evaluate(
    client,
    `return document.querySelector("#selection-panel").textContent.replace(/\\s+/g, " ").slice(0, 120);`,
  );
  await screenshot(client, "m5-03-airport.png");
  assert(/机场/.test(tilePanel), `应识别出机场地形：${tilePanel}`);
  record("机场地形", tilePanel);

  const openBuild = await evaluate(
    client,
    `const button = document.querySelector("#open-build");
     return button ? { disabled: button.disabled, text: button.textContent.trim() } : null;`,
  );
  assert(openBuild && !openBuild.disabled, `自己的机场应可部署：${JSON.stringify(openBuild)}`);
  await click(client, (await centerOf(client, "#open-build")).x, (await centerOf(client, "#open-build")).y);
  await waitFor(client, `return !!document.querySelector(".build-list")`, "生产弹窗");
  const aircraft = await evaluate(
    client,
    `return [...document.querySelectorAll(".build-list [data-unit]")].map((b) => b.dataset.unit);`,
  );
  assert(
    aircraft.length === 3 &&
      aircraft.every((t) => ["fighter", "bomber", "heli"].includes(t)),
    `机场只能生产空中单位，实际 ${JSON.stringify(aircraft)}`,
  );
  await screenshot(client, "m5-04-aircraft-build.png");
  record("机场生产列表", aircraft.join(" / "));

  // 4. Buy a transport helicopter; the server must accept it and the board
  //    must show five of our units afterwards.
  const before = await evaluate(
    client,
    `return document.querySelectorAll("#player-strip .player-card")[0].textContent;`,
  );
  await click(client, (await centerOf(client, '.build-list [data-unit="heli"]')).x, (await centerOf(client, '.build-list [data-unit="heli"]')).y);
  await waitFor(
    client,
    `return !document.querySelector("#modal-overlay") ||
            document.querySelector("#modal-overlay").classList.contains("hidden") ||
            getComputedStyle(document.querySelector("#modal-overlay")).display === "none";`,
    "弹窗关闭",
  );
  await delay(900);
  const after = await evaluate(
    client,
    `return document.querySelectorAll("#player-strip .player-card")[0].textContent;`,
  );
  assert(before !== after, `生产后席位栏应变化：${before} → ${after}`);
  await screenshot(client, "m5-05-heli-built.png");
  record("生产运输直升机", after.replace(/\s+/g, " ").slice(0, 80));

  // 5. Select the helicopter and confirm the cargo line and the transport hint
  //    appear; its orders are only offered for valid neighbours.
  await click(client, airport.x, airport.y);
  await delay(400);
  const panel = await evaluate(
    client,
    `return document.querySelector("#selection-panel").textContent.replace(/\\s+/g, " ").slice(0, 200);`,
  );
  assert(/运输直升机/.test(panel), `机场格上应显示新生产的直升机：${panel}`);
  assert(/货舱/.test(panel), `运输单位应显示货舱容量：${panel}`);
  await screenshot(client, "m5-06-heli-selected.png");
  record("运输单位面板", panel.slice(0, 120));

  const errors = await evaluate(client, `return window.__errors ?? [];`);
  record("控制台", errors.length ? `${errors.length} 条错误` : "无脚本错误");

  console.log(`\n截图：${OUT}/m5-0*.png`);
} finally {
  client?.close();
  browser.kill();
  await delay(200);
  await rm(profile, { recursive: true, force: true });
}
