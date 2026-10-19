import {
  UNITS,
  TERRAINS,
  COMMANDERS,
  MAPS,
  createGame,
  reachable,
  attackable,
  canCapture,
  previewCombat,
  visibleTiles,
} from "./shared/engine.mjs";
import { createRenderer, TEAM_COLORS } from "./renderer.mjs";
import { paintCombatScene, COMBAT_TIMING, combatDuration } from "./combat-scene.mjs";

const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const number = (value) => Number(value || 0).toLocaleString("zh-CN");
const names = ["赤焰军", "苍蓝军", "金叶军", "紫星军"];
const symbols = {
  infantry: "♟",
  mech: "♟",
  recon: "▱",
  tank: "▰",
  heavy: "▰",
  artillery: "⌁",
  rocket: "⋰",
  apc: "▤",
  fighter: "✈",
  bomber: "✈",
  heli: "⚙",
  destroyer: "⚓",
  lander: "⛴",
};
let room = null,
  session = null,
  eventSource = null,
  screen = "landing",
  busy = false;
let selectedId = null,
  destination = null,
  targetId = null,
  selectedTile = null,
  hoveredTile = null;
let serviceURLs = [],
  previousTurn = null,
  victoryShown = null,
  soundEnabled = false,
  audioContext;
let storedSessions = loadJSON("field-command-sessions", {});
const modal = $("#modal");
let modalCleanup = null;
function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}
function store(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode can disable storage */
  }
}
function nickname() {
  return loadJSON("field-command-name", "指挥官");
}
function toast(message, error = false) {
  const el = document.createElement("div");
  el.className = `toast${error ? " error" : ""}`;
  el.textContent = message;
  $("#toast-container").append(el);
  setTimeout(() => el.remove(), error ? 5500 : 3200);
}
function beep(type = "select") {
  if (!soundEnabled) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const osc = audioContext.createOscillator(),
      gain = audioContext.createGain();
    osc.type = "square";
    osc.frequency.value = type === "attack" ? 110 : type === "turn" ? 660 : 330;
    gain.gain.setValueAtTime(0.035, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.12,
    );
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.13);
  } catch {
    /* audio is optional */
  }
}
function setNetwork(text, offline = false) {
  $("#network-status").innerHTML = `<i></i>${esc(text)}`;
  $("#network-status").classList.toggle("offline", offline);
}
function showScreen(next) {
  const changed = screen !== next;
  screen = next;
  for (const id of ["landing", "lobby", "battle"])
    $(`#${id}`).classList.toggle("hidden", id !== next);
  $(".nav-label").textContent =
    next === "landing"
      ? "作战大厅"
      : next === "lobby"
        ? "战前部署"
        : "战术指挥";
  // The landing page is taller than the viewport, so entering the battle keeps
  // the scroll offset and pushes the header and command panel off screen.
  if (changed) window.scrollTo(0, 0);
  requestAnimationFrame(() => {
    heroRenderer.resize();
    battleRenderer.resize();
  });
}
function openModal(title, body, eyebrow = "FIELD COMMAND") {
  closeModal();
  delete modal.dataset.turn;
  $("#modal-title").textContent = title;
  $("#modal-eyebrow").textContent = eyebrow;
  $("#modal-body").innerHTML = body;
  modal.showModal();
}
function openActionModal(title, body, eyebrow) {
  openModal(title, body, eyebrow);
  modal.dataset.turn = `${room.id}:${room.state.turn}`;
}
function closeModal() {
  if (modal.open) modal.close();
  if (modalCleanup) modalCleanup();
  modalCleanup = null;
}
$("#close-modal").onclick = closeModal;
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    const r = modal.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      closeModal();
  }
});
modal.addEventListener("close", () => {
  if (modalCleanup) modalCleanup();
  modalCleanup = null;
});
async function api(path, data) {
  const response = await fetch(
    path,
    data === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
  );
  let payload;
  try {
    payload = await response.json();
  } catch {
    // No readable body means we cannot tell whether the server applied it.
    const error = new Error("服务暂时不可用，请确认房主的服务仍在运行。");
    error.network = true;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(payload.error || "操作未完成，请重试。");
    error.status = response.status;
    throw error;
  }
  return payload;
}
async function safe(task) {
  try {
    await task();
  } catch (error) {
    toast(error.message || "连接失败，请稍后重试。", true);
  }
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function commanderOptions(selected = "vanguard") {
  return Object.entries(COMMANDERS)
    .map(
      ([id, c]) =>
        `<option value="${esc(id)}" ${id === selected ? "selected" : ""}>${esc(c.name)} · ${esc(c.title || "")}</option>`,
    )
    .join("");
}
function mapOptions(selected = "river") {
  return MAPS.map(
    (m) =>
      `<option value="${esc(m.id)}" ${m.id === selected ? "selected" : ""}>${esc(m.name)}</option>`,
  ).join("");
}
function getMap(id) {
  return MAPS.find((map) => map.id === id) || MAPS[0];
}
const heroState = createGame({
  mapId: "river",
  players: [
    {
      id: 0,
      name: "赤焰军",
      team: 0,
      commander: "vanguard",
      controller: "human",
    },
    { id: 1, name: "苍蓝军", team: 1, commander: "mechanic", controller: "ai" },
  ],
});
const heroRenderer = createRenderer($("#hero-canvas"), {
  onTile(x, y) {
    const tile = tileAt(heroState, x, y),
      unit = heroState.units.find((u) => u.x === x && u.y === y);
    $("#hero-detail-title").textContent = unit
      ? `${UNITS[unit.type].name} · ${names[unit.owner]}`
      : TERRAINS[tile.type]?.name || tile.type;
    $("#hero-detail-text").textContent = unit
      ? `移动 ${UNITS[unit.type].move} 格 · 射程 ${UNITS[unit.type].minRange}–${UNITS[unit.type].maxRange} · 点击「单人演习」开始`
      : `地形防御 ${TERRAINS[tile.type]?.defense || 0} ★ · 善用地形保护部队`;
    heroRenderer.setScene({
      state: heroState,
      selectedId: unit?.id || null,
      reachable: [],
      targets: [],
      hoverTile: { x, y },
      preview: null,
    });
    beep();
  },
  onHover() {},
});
heroRenderer.setScene({
  state: heroState,
  selectedId: null,
  reachable: [],
  targets: [],
  hoverTile: null,
  preview: null,
});
$("#hero-map-name").textContent = getMap("river").name;
const combatStage = $("#combat-stage");
const combatScene = $("#combat-scene");
const combatSceneCtx = combatScene.getContext("2d");
let combatTimers = [];
let combatFrame = null;
function hideCombat() {
  for (const timer of combatTimers) clearTimeout(timer);
  combatTimers = [];
  if (combatFrame !== null) cancelAnimationFrame(combatFrame);
  combatFrame = null;
  combatStage.hidden = true;
  combatStage.className = "combat-stage";
}
function afterCombat(delay, action) {
  combatTimers.push(setTimeout(action, delay));
}
function showCombat({ attacker, defender, damage, counter, attackerTerrain, defenderTerrain, delay = 0 }) {
  if (screen !== "battle") return;
  hideCombat();
  const battle = { attacker, defender, damage, counter, attackerTerrain, defenderTerrain };
  if (delay > 0) {
    afterCombat(delay, () => showCombat(battle));
    return;
  }
  combatStage.hidden = false;
  $("#combat-caption").textContent = "准备攻击";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    paintCombatScene(combatSceneCtx, { ...battle, elapsed: combatDuration(counter) });
    $("#combat-caption").textContent = `造成 ${damage} 点伤害${counter ? ` · 反击 ${counter} 点` : ""}`;
    afterCombat(850, hideCombat);
    return;
  }
  const started = performance.now();
  const animate = (now) => {
    if (combatStage.hidden) return;
    const elapsed = now - started;
    paintCombatScene(combatSceneCtx, { ...battle, elapsed });
    const caption = elapsed < COMBAT_TIMING.firstFire ? "准备攻击"
      : elapsed < COMBAT_TIMING.firstHit ? `${UNITS[attacker.type].name}开火！`
        : elapsed < COMBAT_TIMING.counterFire || !counter ? `命中 · 减少 ${damage} 点兵力`
          : elapsed < COMBAT_TIMING.counterHit ? `${UNITS[defender.type].name}反击！`
            : `反击 · 减少 ${counter} 点兵力`;
    $("#combat-caption").textContent = caption;
    if (elapsed >= combatDuration(counter)) {
      hideCombat();
      return;
    }
    combatFrame = requestAnimationFrame(animate);
  };
  combatFrame = requestAnimationFrame(animate);
}
$("#skip-combat").onclick = hideCombat;
let victoryTimer = null;
function clearVictoryDelay() {
  if (victoryTimer !== null) clearTimeout(victoryTimer);
  victoryTimer = null;
}
function onMapCapture(capture) {
  if (!capture.completed || room?.state?.phase !== "finished" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  clearVictoryDelay();
  victoryTimer = setTimeout(() => {
    victoryTimer = null;
    if (screen === "battle" && room?.state?.phase === "finished") showVictory();
  }, capture.delay + capture.duration);
}
const battleRenderer = createRenderer($("#battle-canvas"), {
  onTile: handleTile,
  onCombat: showCombat,
  onCapture: onMapCapture,
  onHover(x, y) {
    hoveredTile = { x, y };
    if (!room?.state) return;
    const tile = tileAt(room.state, x, y),
      unit = room.state.units.find((u) => u.x === x && u.y === y);
    if (tile)
      $("#field-hover").textContent =
        `${String(x + 1).padStart(2, "0")}:${String(y + 1).padStart(2, "0")} · ${TERRAINS[tile.type]?.name || tile.type} · 防御 ${TERRAINS[tile.type]?.defense || 0}★${unit ? ` · ${UNITS[unit.type].name} ${unit.hp} HP${unit.cargo?.length ? ` · 载 ${unit.cargo.length}` : ""}${unit.carriedBy ? " · 运输中" : ""}` : ""}`;
  },
});
function tileAt(state, x, y) {
  return state.tiles[y * state.width + x];
}
function ownPlayer() {
  return room?.state?.players.find((p) => p.id === session?.seat);
}
function isMyTurn() {
  return (
    room?.state?.phase === "playing" &&
    room.state.currentPlayer === session?.seat &&
    !ownPlayer()?.defeated
  );
}
/** Tiles the viewer can see, or null when the room has no fog. */
function visibleSet() {
  if (!room?.state?.fog || !session) return null;
  return visibleTiles(room.state, session.seat);
}
/**
 * Whether this seat may act on a tile at all. The server already strips hidden
 * units from the state, so this only guards the dark itself: a click on ground
 * nobody has scouted would otherwise answer with terrain, ownership and capture
 * detail for free. A tile that the selected unit can actually walk to is
 * allowed, because the rules engine would accept that move anyway.
 */
function canActOn(x, y) {
  const seen = visibleSet();
  if (!seen || seen.has(`${x},${y}`)) return true;
  const unit = selectedUnit();
  if (!unit || !canCommand()) return false;
  try {
    return reachable(room.state, unit.id).some(
      (cell) => cell.x === x && cell.y === y,
    );
  } catch {
    return false;
  }
}
function selectedUnit() {
  return room?.state?.units.find((u) => u.id === selectedId);
}
function canCommand() {
  const unit = selectedUnit();
  return isMyTurn() && unit?.owner === session.seat && !unit.acted && !busy;
}
function effectivePosition(unit) {
  return destination || { x: unit.x, y: unit.y };
}
function validTargets(unit) {
  if (!unit || !canCommand()) return [];
  const pos = effectivePosition(unit);
  // 间接火力移动后不能开火由 attackable 判定，客户端不再重复该规则。
  try {
    return attackable(room.state, unit.id, pos);
  } catch {
    return [];
  }
}
/**
 * The transport orders a tile can carry, shared by the cursor, the range
 * overlay and the command list so all three agree with `applyAction`.
 * Loading and merging target an occupied tile, and unloading targets an empty
 * neighbour the cargo can stand on; none of those are normal move destinations.
 */
function transportOrderFor(unit, x, y) {
  const state = room?.state;
  if (!state || !unit) return null;
  const tile = tileAt(state, x, y);
  if (!tile || Math.abs(x - unit.x) + Math.abs(y - unit.y) !== 1) return null;
  const other = state.units.find((u) => u.x === x && u.y === y);
  if (other && other.id !== unit.id) {
    if (other.owner !== unit.owner) return null;
    const def = UNITS[unit.type];
    if (
      (def.capacity ?? 0) > 0 &&
      (other.cargo?.length ?? 0) < def.capacity &&
      (def.carry || []).some(
        (kind) => kind === other.type || UNITS[other.type].category === kind,
      )
    )
      return "load";
    if (other.type === unit.type && !unit.cargo?.length && !other.cargo?.length)
      return "join";
    return null;
  }
  const def = UNITS[unit.type];
  if ((def.capacity ?? 0) === 0 || !unit.cargo?.length) return null;
  if (state.units.some((u) => u.x === x && u.y === y)) return null;
  const fits = unit.cargo.some((id) => {
    const cargo = state.units.find((u) => u.id === id);
    return cargo && TERRAINS[tile.type]?.costs[UNITS[cargo.type].movement] != null;
  });
  return fits ? "unload" : null;
}
/** Tiles painted as selectable because a transport order can start there. */
function transportTargets(unit) {
  const state = room?.state;
  if (!state || !unit || !canCommand()) return [];
  const cells = [];
  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]) {
    const x = unit.x + dx,
      y = unit.y + dy;
    if (transportOrderFor(unit, x, y)) cells.push({ x, y, cost: 0 });
  }
  return cells;
}
function resetSelection() {
  selectedId = null;
  destination = null;
  targetId = null;
  selectedTile = null;
}
function updateScene() {
  if (!room?.state) return;
  const unit = selectedUnit();
  let moves = [];
  if (canCommand()) {
    try {
      const all = reachable(room.state, unit.id);
      moves = destination
        ? all.filter(
            (cell) => cell.x === destination.x && cell.y === destination.y,
          )
        : all;
      // Transport orders sit outside the movement range: they target a
      // neighbour. Show those tiles too, but only when nothing is preselected.
      if (!destination) moves = [...moves, ...transportTargets(unit)];
    } catch {}
  }
  battleRenderer.setScene({
    state: room.state,
    selectedId,
    reachable: moves,
    targets: validTargets(unit),
    hoverTile: selectedTile,
    preview: destination,
    visible: visibleSet(),
  });
}
function handleTile(x, y) {
  if (!room?.state || busy) return;
  const state = room.state,
    unit = state.units.find((u) => u.x === x && u.y === y),
    selected = selectedUnit();
  const seen = visibleSet();
  // Unexplored ground cannot be inspected: a click would otherwise answer with
  // terrain, ownership and capture detail for free. A tile the selected unit can
  // actually reach stays allowed, because the rules engine accepts that move.
  if (seen && !seen.has(`${x},${y}`) && !canActOn(x, y)) {
    toast("那里还在迷雾里，先派侦察车或步兵过去看看。", true);
    return;
  }
  selectedTile = { x, y };
  if (canCommand()) {
    if (unit && validTargets(selected).includes(unit.id)) {
      targetId = unit.id;
      beep();
      renderBattle();
      return;
    }
    // A neighbouring unit or landing tile may be a transport target. Treat it
    // as the "destination" so the command list can offer load/join/unload; the
    // rules decide whether that order is legal, not this click handler.
    const order = transportOrderFor(selected, x, y);
    if (order) {
      destination = { x, y };
      targetId = null;
      beep();
      renderBattle();
      return;
    }
    if (!unit || unit.id === selected.id) {
      const moves = reachable(state, selected.id);
      if (moves.some((p) => p.x === x && p.y === y)) {
        destination = { x, y };
        targetId = null;
        beep();
        renderBattle();
        return;
      }
    }
  }
  selectedId = unit?.id || null;
  destination = null;
  targetId = null;
  beep();
  renderBattle();
}
function attachSession(result) {
  if (!result.room?.id || !result.token || !Number.isInteger(result.seat))
    throw new Error("房间凭证不完整，请重新加入。");
  session = { roomId: result.room.id, token: result.token, seat: result.seat };
  storedSessions[session.roomId] = session;
  store("field-command-sessions", storedSessions);
  store("field-command-last", session.roomId);
  connectEvents();
  receiveRoom(result.room);
  updateResume();
}
function connectEvents() {
  eventSource?.close();
  eventSource = new EventSource(
    `/api/rooms/${encodeURIComponent(session.roomId)}/events?token=${encodeURIComponent(session.token)}`,
  );
  const source = eventSource;
  eventSource.addEventListener("room", (event) => {
    if (eventSource !== source) return;
    try {
      receiveRoom(JSON.parse(event.data));
    } catch (error) {
      console.error("Room update failed", error);
      toast("房间数据更新失败，请刷新重连。", true);
    }
  });
  eventSource.onopen = () => {
    if (eventSource === source) setNetwork("房间已连接");
  };
  eventSource.onerror = () => {
    if (eventSource !== source) return;
    setNetwork("正在重连…", true);
    $("#save-status").textContent = "连接中断 · 正在自动重连";
  };
}
function receiveRoom(next) {
  if (!session || next.id !== session.roomId) return;
  if (room?.id === next.id && next.revision < room.revision) return;
  if (
    modal.dataset.turn &&
    modal.dataset.turn !== `${next.id}:${next.state?.turn}`
  )
    closeModal();
  const oldId = room?.id;
  room = next;
  if (room.phase === "lobby") {
    hideCombat();
    clearVictoryDelay();
    if (screen !== "lobby") closeModal();
    previousTurn = null;
    victoryShown = null;
    resetSelection();
    showScreen("lobby");
    renderLobby();
  } else {
    const current = room.state?.currentPlayer,
      turnKey = `${room.id}:${room.state?.turn}:${current}`;
    const unit = selectedUnit();
    if (turnKey !== previousTurn || (selectedId && (!unit || unit.acted)))
      resetSelection();
    showScreen("battle");
    renderBattle();
    if (turnKey !== previousTurn && room.state?.phase !== "finished") {
      previousTurn = turnKey;
      showTurnBanner();
    }
    if (room.state?.phase === "finished") {
      if (victoryTimer === null) showVictory();
    }
  }
  $("#footer-message").textContent =
    `房间 ${room.id} · ${room.mode === "teams" ? "联合行动" : "自由混战"} · 每一步都已同步`;
  if (oldId && oldId !== room.id) closeModal();
}
function renderLobby() {
  $("#room-id").textContent = room.id;
  $("#lobby-count").textContent =
    `${room.seats.filter((s) => s.controller === "human").length} 名玩家 / ${room.playerCount} 席位`;
  const isHost = session.seat === room.hostSeat;
  $("#seat-list").innerHTML = room.seats
    .map(
      (seat) =>
        `<div class="seat" style="--seat-color:${TEAM_COLORS[seat.id]}"><div class="seat-color">${String(seat.id + 1).padStart(2, "0")}</div><div class="seat-info"><div class="seat-name">${esc(seat.controller === "open" ? "等待玩家加入" : seat.name)}${seat.id === session.seat ? "<small>你</small>" : ""}${seat.id === room.hostSeat ? "<small>房主</small>" : ""}</div><p>${esc(names[seat.id])} · ${room.mode === "teams" ? `第 ${(seat.id % 2) + 1} 队 · ` : ""}${esc(COMMANDERS[seat.commander]?.name || "")}</p></div>${seat.controller === "human" ? `<span class="seat-state"><i class="tiny-dot" style="background:${seat.connected ? "#a4c49b" : "#657c7a"}"></i>${seat.connected ? "已连接" : "等待连接"}</span>` : `<select data-seat="${seat.id}" aria-label="${names[seat.id]}席位" ${!isHost ? "disabled" : ""}><option value="ai" ${seat.controller === "ai" ? "selected" : ""}>电脑指挥官</option><option value="open" ${seat.controller === "open" ? "selected" : ""}>等待玩家</option></select>`}</div>`,
    )
    .join("");
  $("#seat-list")
    .querySelectorAll("select")
    .forEach(
      (select) =>
        (select.onchange = () =>
          safe(() =>
            roomRequest("configure", {
              slots: [
                { seat: Number(select.dataset.seat), controller: select.value },
              ],
            }),
          )),
    );
  const mySeat = room.seats.find((s) => s.id === session.seat);
  $("#my-commander").innerHTML = commanderOptions(mySeat.commander);
  $("#commander-description").textContent =
    COMMANDERS[mySeat.commander]?.description || "";
  $("#map-options").innerHTML = MAPS.map(
    (m) =>
      `<button class="map-option ${m.id === room.mapId ? "active" : ""}" data-map="${m.id}" ${!isHost ? "disabled" : ""}><span>${esc(m.name)}</span><small>${m.width} × ${m.height}</small></button>`,
  ).join("");
  $("#map-options")
    .querySelectorAll("button")
    .forEach(
      (button) =>
        (button.onclick = () =>
          safe(() => roomRequest("configure", { mapId: button.dataset.map }))),
    );
  $("#room-mode").value = room.mode;
  $("#room-mode").disabled = !isHost;
  $("#room-mode").querySelector('[value="teams"]').disabled =
    room.playerCount !== 4;
  $("#room-fog").value = room.fog ? "on" : "off";
  $("#room-fog").disabled = !isHost;
  $("#mode-description").textContent =
    room.mode === "teams"
      ? `赤焰与金叶一队，苍蓝与紫星一队。资金独立，队友共享胜利。${
          room.fog
            ? "迷雾下队友之间共享视野，但不共享未看见的情报。"
            : ""
        }`
      : room.fog
        ? `${getMap(room.mapId).description} 战争迷雾：只能看到己方视野范围内，森林与山地会藏住里面的部队。`
        : getMap(room.mapId).description;
  $("#invite-url").value = inviteURL();
  $("#start-game").disabled =
    !isHost || room.seats.some((s) => s.controller === "open") || busy;
  $("#start-game").textContent = isHost
    ? "全员就位 · 开始作战 →"
    : "等待房主开始作战";
  $("#start-hint").textContent = room.seats.some((s) => s.controller === "open")
    ? "还有空席位：等待朋友加入，或将其设置为电脑。"
    : "朋友可在开局前加入电脑席位。开始后仍可断线重连。";
}
async function roomRequest(endpoint, data = {}) {
  const origin = session;
  if (!origin) throw new Error("请先加入房间。");
  const result = await api(
    `/api/rooms/${encodeURIComponent(origin.roomId)}/${endpoint}`,
    { token: origin.token, ...data },
  );
  if (session === origin && result.room) receiveRoom(result.room);
  return result;
}
/** Opaque retry key: matches the server's accepted charset and is never reused. */
function newRequestId() {
  if (globalThis.crypto?.randomUUID)
    return crypto.randomUUID().replace(/-/g, "");
  return `req${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
function inviteURL() {
  const lan = serviceURLs.find(
    (url) =>
      !url.includes("127.0.0.1") &&
      !url.includes("localhost") &&
      !url.includes("[::1]"),
  );
  return `${lan || location.origin}/?room=${encodeURIComponent(room.id)}`;
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("邀请地址已复制");
  } catch {
    openModal(
      "分享房间",
      `<p class="modal-description">复制下方地址，发送给同一局域网的朋友。</p><input style="width:100%" id="manual-copy" readonly value="${esc(text)}"><p class="muted">房间码：${esc(room?.id || "")}</p>`,
    );
    $("#manual-copy").select();
  }
}
$("#my-commander").onchange = () =>
  safe(() => roomRequest("seat", { commander: $("#my-commander").value }));
$("#room-mode").onchange = () =>
  safe(() => roomRequest("configure", { mode: $("#room-mode").value }));
$("#room-fog").onchange = () =>
  safe(() => roomRequest("configure", { fog: $("#room-fog").value === "on" }));
$("#copy-invite").onclick = () => copyText(inviteURL());
$("#start-game").onclick = () =>
  safe(async () => {
    busy = true;
    renderLobby();
    try {
      await roomRequest("start");
    } finally {
      busy = false;
      if (screen === "lobby") renderLobby();
      else renderBattle();
    }
  });
function renderBattle() {
  if (!room?.state) return;
  const state = room.state,
    active = state.players.find((p) => p.id === state.currentPlayer),
    me = ownPlayer(),
    mine = isMyTurn();
  $("#battle-map-title").textContent = getMap(room.mapId).name;  $("#day-number").textContent = String(state.day).padStart(2, "0");
  $("#active-player").textContent =
    state.phase === "finished" ? "作战结束" : `${active?.name || ""}的回合`;
  $("#active-player").style.color = TEAM_COLORS[active?.id || 0];
  $("#turn-status").textContent =
    state.phase === "finished"
      ? "查看战后报告"
      : mine
        ? "轮到你了，指挥官"
        : active?.controller === "ai"
          ? "电脑正在部署部队…"
          : "等待对方行动";
  $("#field-status").innerHTML =
    `<i class="tiny-dot"></i> ${state.phase === "finished" ? "作战结束" : mine ? "你的回合 · 下达指令" : "观察战场 · 等待回合"}`;
  const co = COMMANDERS[me.commander];
  $("#co-name").textContent = co.name;
  $("#commander-avatar").textContent = me.commander === "mechanic" ? "M" : "V";
  $("#commander-avatar").style.borderColor = TEAM_COLORS[me.id];
  $("#my-faction").textContent =
    `${names[me.id]}${room.mode === "teams" ? ` / 第 ${me.team + 1} 队` : ""}`;
  $("#funds").textContent = number(me.funds);
  $("#energy-value").textContent = `${Math.floor(me.energy || 0)} / 100`;
  $("#energy-fill").style.width = `${Math.min(100, me.energy || 0)}%`;
  $("#power-button").innerHTML =
    `${esc(co.powerName || "普通能力")} <span>50</span>`;
  $("#super-button").innerHTML =
    `${esc(co.superName || "超级能力")} <span>100</span>`;
  $("#power-button").disabled = !mine || busy || me.energy < 50 || !!me.power;
  $("#super-button").disabled = !mine || busy || me.energy < 100 || !!me.power;
  $("#end-turn").disabled = state.phase === "finished" ? false : !mine || busy;
  $("#end-turn").innerHTML =
    `${state.phase === "finished" ? "查看战后报告" : mine ? "结束我的回合" : me.defeated ? "你的部队已退出" : "等待对方回合"} <b>→</b>`;
  const fogged = !!state.fog;
  $("#player-strip").innerHTML = state.players
    .map((player) => {
      // Under fog the unit list only holds what this seat can see, so an enemy
      // count would read as a total that is simply wrong. Own and allied seats
      // share the view and keep the exact figure.
      const known = !fogged || player.id === session.seat || player.team === me.team;
      const units = known
        ? `${state.units.filter((u) => u.owner === player.id).length} 部队`
        : `${state.units.filter((u) => u.owner === player.id).length} 已知部队`;
      const holdings = state.tiles.filter(
        (t) => t.owner === player.id && ["city", "factory", "hq"].includes(t.type),
      ).length;
      return `<div class="player-card ${player.id === state.currentPlayer ? "active" : ""} ${player.defeated ? "defeated" : ""}" style="--player-color:${TEAM_COLORS[player.id]}"><div class="player-name"><i></i>${esc(player.name)}${player.id === session.seat ? " · 你" : ""}</div><small>${player.defeated ? "已退出" : `${units} · ${holdings} 据点`}${room.mode === "teams" ? ` · 队${player.team + 1}` : ""}</small></div>`;
    })
    .join("");
  $("#event-log").innerHTML = (state.log || [])
    .slice(-5)
    .reverse()
    .map(
      (line) =>
        `<li>${esc(typeof line === "string" ? line : line.message || JSON.stringify(line))}</li>`,
    )
    .join("");
  $("#save-status").textContent = busy
    ? "正在同步行动…"
    : "行动自动保存 · 支持刷新重连";
  renderSelection();
  updateScene();
}
function renderSelection() {
  const panel = $("#selection-panel"),
    state = room.state,
    unit = selectedUnit(),
    can = canCommand();
  if (unit) {
    const definition = UNITS[unit.type],
      pos = effectivePosition(unit),
      tile = tileAt(state, pos.x, pos.y);
    let commands = "",
      combat = "";
    if (can) {
      // 占领合法性直接取规则引擎的判定，避免客户端自行拼装条件后与服务端漂移。
      const captureAllowed = canCapture(state, unit.owner, unit, pos.x, pos.y);
      if (targetId) {
        const target = state.units.find((u) => u.id === targetId);
        if (target) {
          const p = previewCombat(state, unit.id, targetId, pos);
          combat = `<div class="combat-preview"><span>${esc(UNITS[target.type].name)}<strong>−${p.damage} HP</strong></span><span>预计反击<strong>−${p.counter} HP</strong></span></div>`;
          commands += `<button class="attack-command" data-command="attack">确认攻击</button>`;
        }
      }
      if (!targetId) {
        commands += `<button data-command="wait">${destination && (pos.x !== unit.x || pos.y !== unit.y) ? "移动并待机" : "原地待机"}</button>`;
        if (captureAllowed)
          commands += '<button data-command="capture">⚑ 占领据点</button>';
        if (unit.type === "apc")
          commands += '<button data-command="supply">补给邻近部队</button>';
        // Transport orders share the destination rule: click a neighbour, then
        // pick one of these. The list is filtered here so an impossible order
        // never becomes a round trip the server has to reject.
        const neighbour = destination
          ? state.units.find(
              (u) => u.id !== unit.id && u.x === destination.x && u.y === destination.y,
            )
          : null;
        if (
          neighbour &&
          neighbour.owner === unit.owner &&
          (definition.capacity ?? 0) > 0 &&
          (neighbour.cargo?.length ?? 0) < definition.capacity &&
          (definition.carry || []).some(
            (kind) =>
              kind === neighbour.type || UNITS[neighbour.type].category === kind,
          )
        )
          commands += '<button data-command="load">装载上车</button>';
        if (
          neighbour &&
          neighbour.owner === unit.owner &&
          neighbour.type === unit.type &&
          !unit.cargo?.length &&
          !neighbour.cargo?.length
        )
          commands += '<button data-command="join">合并部队</button>';
        if ((definition.capacity ?? 0) > 0 && (unit.cargo?.length ?? 0) > 0) {
          // Unloading needs an adjacent empty tile the cargo can stand on.
          const landing = [
            [0, -1],
            [1, 0],
            [0, 1],
            [-1, 0],
          ].some(([dx, dy]) => {
            const tile = tileAt(state, unit.x + dx, unit.y + dy);
            if (!tile || state.units.some((u) => u.x === tile.x && u.y === tile.y))
              return false;
            return (unit.cargo || []).some((id) => {
              const cargo = state.units.find((u) => u.id === id);
              return cargo && TERRAINS[tile.type]?.costs[UNITS[cargo.type].movement] != null;
            });
          });
          if (landing)
            commands += '<button data-command="unload">卸载部队</button>';
        }
      }
      commands += `<button data-command="cancel">${destination || targetId ? "取消预选" : "取消选择"}</button>`;
    }
    const cargoNote =
      (definition.capacity ?? 0) > 0
        ? `<p>货舱 ${(unit.cargo || []).length}/${definition.capacity}${
            (unit.cargo || []).length
              ? `：${(unit.cargo || [])
                  .map((id) => state.units.find((u) => u.id === id))
                  .filter(Boolean)
                  .map((u) => esc(UNITS[u.type].name))
                  .join("、")}`
              : ""
          }</p>`
        : unit.carriedBy
          ? `<p>正在${esc(UNITS[state.units.find((u) => u.id === unit.carriedBy)?.type]?.name || "运输单位")}上。</p>`
          : "";
    panel.innerHTML = `<div class="selection-top"><div><span class="eyebrow">${esc(names[unit.owner])} / UNIT ${esc(unit.id)}</span><h2>${esc(definition.name)}</h2></div><span class="hp-badge">${unit.hp}<small>兵力 / 10</small></span></div><div class="selection-content"><div class="unit-stats"><div><span>移动 / 射程</span><strong>${definition.move} / ${definition.minRange}–${definition.maxRange}</strong></div><div><span>弹药 / 燃料</span><strong>${unit.ammo === null || unit.ammo === undefined ? "∞" : unit.ammo} / ${Math.floor(unit.fuel || 0)}${definition.fuelPerTurn ? `（−${definition.fuelPerTurn}/回合）` : ""}</strong></div><div><span>地形防御</span><strong>${TERRAINS[tile.type]?.defense || 0} ★</strong></div></div>${combat}${cargoNote}<p>${can ? (targetId ? "确认后结算伤害与反击。" : destination ? "目的地已预选。选择命令后执行；点击红色目标可攻击。" : "点击青色格预选移动；点击红色敌军预览攻击。") : unit.acted ? "该部队已行动，下个己方回合恢复。" : unit.owner !== session.seat ? "观察敌我部署，利用射程与地形安排推进。" : "等待己方回合后可下达指令。"}</p>${["city", "factory", "airport", "port", "hq"].includes(tile.type) ? `<p>据点：${tile.owner === null ? "中立" : esc(names[tile.owner])} · 剩余占领值 ${tile.capture ?? 20}</p>` : ""}<div class="command-list">${commands}</div></div>`;
    panel.querySelectorAll("[data-command]").forEach(
      (button) =>
        (button.onclick = () => {
          const command = button.dataset.command;
          if (command === "cancel") {
            if (destination || targetId) {
              destination = null;
              targetId = null;
            } else resetSelection();
            renderBattle();
          } else
            performAction({
              type: "move",
              unitId: unit.id,
              x: pos.x,
              y: pos.y,
              command,
              ...(command === "attack" ? { targetId } : {}),
            });
        }),
    );
  } else if (selectedTile) {
    const tile = tileAt(state, selectedTile.x, selectedTile.y),
      type = TERRAINS[tile.type] || { name: tile.type, defense: 0 },
      builds = ["factory", "airport", "port"].includes(tile.type),
      site = builds && tile.owner === session.seat,
      owner = tile.owner === null ? "中立区域" : names[tile.owner];
    const siteHint =
      tile.type === "factory"
        ? "选择新部队部署到工厂。新生产的单位下个回合才能行动。"
        : tile.type === "airport"
          ? "机场生产战斗机、轰炸机与运输直升机。飞行器每回合耗油，只能在机场补满。"
          : "港口生产驱逐舰与登陆舰。舰船只能航行于海洋，登陆舰可运载两支地面部队。";
    panel.innerHTML = `<div class="selection-top"><div><span class="eyebrow">TERRAIN / ${selectedTile.x + 1}:${selectedTile.y + 1}</span><h2>${esc(type.name)}</h2></div><span class="hp-badge">${type.defense || 0}<small>防御星级</small></span></div><div class="selection-content"><p>${esc(owner)}${["city", "factory", "airport", "port", "hq"].includes(tile.type) ? " · 据点每回合提供资金。友方地面部队在此可维修补给。" : ""}</p><p>${site ? siteHint : tile.type === "sea" ? "海洋只有舰船与飞行器可以进入。" : tile.type === "water" ? "陆军无法穿越水域，请寻找桥梁。" : tile.type === "mountain" ? "步兵可登山，车辆需要绕行。" : "地形会影响移动消耗与防御。"}</p>${site ? `<div class="command-list"><button id="open-build" ${!isMyTurn() || busy || state.units.some((u) => u.x === tile.x && u.y === tile.y) ? "disabled" : ""}>＋ 部署部队</button></div>` : ""}</div>`;
    if (site)
      $("#open-build").onclick = () =>
        showBuild(selectedTile.x, selectedTile.y);
  } else
    panel.innerHTML = `<div class="selection-hint"><div class="crosshair">⌖</div><h3>${isMyTurn() ? "选择一支部队" : "观察战场"}</h3><p>${isMyTurn() ? "点击己方单位查看行动范围。<br>点击空闲的己方工厂生产部队。" : "查看部队与地形，规划下一回合。<br>其他玩家的行动会实时同步。"}</p></div>`;
}
async function performAction(action) {
  if (busy || !session || !room?.state) return;
  const origin = session;
  // One request id for this player decision. A dropped response is retried with
  // the same id, so the server either applies it once or replays the result.
  const requestId = newRequestId();
  busy = true;
  renderBattle();
  try {
    const revision = room.revision;
    let result;
    try {
      result = await roomRequest("action", { action, revision, requestId });
    } catch (error) {
      if (!error?.network && error?.status !== 503) throw error;
      setNetwork("连接抖动 · 正在确认行动结果", true);
      await wait(600);
      result = await roomRequest("action", { action, revision, requestId });
      setNetwork("房间已连接");
    }
    if (session !== origin) return;
    if (result?.replayed) toast("这次行动此前已经生效，未重复执行。");
    resetSelection();
    beep(action.command === "attack" ? "attack" : "select");
  } catch (error) {
    if (session !== origin) return;
    if (error?.network || error?.status === 503)
      toast("行动结果未知，已重新同步战局，请确认后再操作。", true);
    else toast(error.message, true);
    try {
      const fresh = await api(
        `/api/rooms/${encodeURIComponent(origin.roomId)}?token=${encodeURIComponent(origin.token)}`,
      );
      if (session === origin && fresh.room) receiveRoom(fresh.room);
    } catch {}
  } finally {
    busy = false;
    renderBattle();
  }
}
function showBuild(x, y) {
  const funds = ownPlayer().funds;
  const tile = tileAt(room.state, x, y);
  // Only the units this pad can actually launch; the server enforces the same
  // rule, so hiding the rest keeps the dialog honest instead of decorative.
  const options = Object.entries(UNITS).filter(
    ([, unit]) => unit.produceAt === tile.type,
  );
  const site = TERRAINS[tile.type]?.name || "生产设施";
  openActionModal(
    "部署新部队",
    `<p class="modal-description">${esc(site)} ${x + 1}:${y + 1} · 可用资金 <strong>${number(funds)}</strong></p><div class="build-list">${options
      .map(
        ([type, unit]) =>
          `<button class="build-option" data-unit="${type}" ${unit.cost > funds ? "disabled" : ""}><span class="build-symbol">${symbols[type] || "◆"}</span><span><strong>${esc(unit.name)}</strong><small>移动 ${unit.move} · 射程 ${unit.minRange}–${unit.maxRange}${
            unit.capacity ? ` · 载 ${unit.capacity} 队` : ""
          }${unit.fuelPerTurn ? ` · 每回合耗油 ${unit.fuelPerTurn}` : ""} · ${esc(unit.description || "")}</small></span><span class="cost">${number(unit.cost)}</span></button>`,
      )
      .join("")}</div>`,
    "REINFORCEMENTS / 部队生产",
  );
  $("#modal-body")
    .querySelectorAll("[data-unit]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          closeModal();
          performAction({ type: "build", unitType: button.dataset.unit, x, y });
        }),
    );
}
function endTurnDialog() {
  if (room?.state?.phase === "finished") {
    showVictory(true);
    return;
  }
  if (!isMyTurn() || busy) return;
  const unacted = room.state.units.filter(
    (u) => u.owner === session.seat && !u.acted,
  ).length;
  if (!unacted) {
    performAction({ type: "endTurn" });
    return;
  }
  openActionModal(
    "结束本回合？",
    `<p class="modal-description">还有 <strong>${unacted}</strong> 支部队尚未行动。结束后将轮到下一位指挥官。</p><div class="modal-buttons"><button class="button secondary" id="keep-turn">继续部署</button><button class="button primary" id="confirm-end">结束回合 →</button></div>`,
    "PASS THE COMMAND",
  );
  $("#keep-turn").onclick = closeModal;
  $("#confirm-end").onclick = () => {
    closeModal();
    performAction({ type: "endTurn" });
  };
}
$("#end-turn").onclick = endTurnDialog;
function powerDialog(level) {
  if (!isMyTurn() || busy) return;
  const co = COMMANDERS[ownPlayer().commander];
  openActionModal(
    level === "super" ? co.superName : co.powerName,
    `<p class="modal-description">${esc(level === "super" ? co.superDescription : co.powerDescription)}</p><p class="muted">消耗 ${level === "super" ? 100 : 50} 点指挥能量。强化持续到下个己方回合开始。</p><div class="modal-buttons"><button class="button secondary" id="cancel-power">稍后使用</button><button class="button primary" id="confirm-power">发动能力 ⚡</button></div>`,
    "CO POWER / 指挥官能力",
  );
  $("#cancel-power").onclick = closeModal;
  $("#confirm-power").onclick = () => {
    closeModal();
    performAction({ type: "power", level });
  };
}
$("#power-button").onclick = () => powerDialog("power");
$("#super-button").onclick = () => powerDialog("super");
function showTurnBanner() {
  const active = room.state.players.find(
      (p) => p.id === room.state.currentPlayer,
    ),
    banner = $("#turn-banner");
  banner.innerHTML = `${esc(active.name)}的回合<small>DAY ${String(room.state.day).padStart(2, "0")} · ${isMyTurn() ? "AWAITING YOUR ORDERS" : "COMMAND IN PROGRESS"}</small>`;
  banner.style.borderColor = TEAM_COLORS[active.id];
  banner.classList.remove("hidden");
  clearTimeout(showTurnBanner.timer);
  showTurnBanner.timer = setTimeout(() => banner.classList.add("hidden"), 1900);
  if (isMyTurn()) beep("turn");
}
function showVictory(force = false) {
  const key = `${room.id}:${room.state.turn}`;
  if (victoryShown === key && !force) return;
  victoryShown = key;
  const won = ownPlayer().team === room.state.winner,
    state = room.state,
    winners = state.players
      .filter((p) => p.team === state.winner)
      .map((p) => p.name)
      .join(" & ");
  openModal(
    won ? "战术奏效。胜利属于你。" : "作战结束，整装再来。",
    `<div class="result-medal">${won ? "⚑" : "⌖"}</div><p class="result-subtitle">${esc(winners || "本局")}获胜<br>每一次部署，都是下一次胜利的经验。</p><div class="result-stats"><div><strong>${state.day}</strong><span>作战天数</span></div><div><strong>${state.units.filter((u) => u.owner === session.seat).length}</strong><span>剩余部队</span></div><div><strong>${state.tiles.filter((t) => t.owner === session.seat).length}</strong><span>控制据点</span></div></div><div class="modal-buttons"><button class="button secondary" id="review-field">查看战场</button>${session.seat === room.hostSeat ? '<button class="button primary" id="rematch">重新部署 →</button>' : ""}</div>`,
    "AFTER ACTION REPORT / 战后报告",
  );
  $("#review-field").onclick = closeModal;
  if ($("#rematch"))
    $("#rematch").onclick = () =>
      safe(async () => {
        closeModal();
        await roomRequest("rematch");
      });
}
$("#save-game").onclick = () =>
  safe(async () => {
    await roomRequest("save");
    toast("整场对局已保存，房主重启服务后也可继续。");
  });
$("#battle-invite").onclick = () => {
  const url = inviteURL();
  openModal(
    `房间 ${room.id}`,
    `<p class="modal-description">${esc(getMap(room.mapId).name)} · ${room.mode === "teams" ? "2v2 联合行动" : "自由混战"}<br>对局开始后保留原有席位。已加入的玩家可通过原浏览器恢复连接。</p><div class="copy-row"><input readonly id="room-info-url" value="${esc(url)}"><button class="button small" id="copy-room-info">复制</button></div><p class="muted">浏览器可关闭后重新加入；提供服务的房主电脑需保持运行。服务重启后会从最近存档恢复。</p><div class="modal-buttons"><button class="button secondary" id="return-hall">返回大厅</button><button class="button subtle" id="surrender" ${!isMyTurn() ? "disabled" : ""}>认输退出本局</button></div>`,
    "LAN SESSION",
  );
  $("#copy-room-info").onclick = () => copyText(url);
  $("#return-hall").onclick = () => {
    closeModal();
    goHome();
  };
  $("#surrender").onclick = () => {
    openActionModal(
      "确认认输？",
      '<p class="modal-description">你将退出这场作战，剩余部队会从战场移除。此操作无法撤销。</p><div class="modal-buttons"><button class="button secondary" id="cancel-surrender">继续战斗</button><button class="button primary" id="confirm-surrender">确认认输</button></div>',
    );
    $("#cancel-surrender").onclick = closeModal;
    $("#confirm-surrender").onclick = () => {
      closeModal();
      performAction({ type: "surrender" });
    };
  };
};
function goHome() {
  hideCombat();
  clearVictoryDelay();
  eventSource?.close();
  eventSource = null;
  session = null;
  room = null;
  previousTurn = null;
  victoryShown = null;
  resetSelection();
  showScreen("landing");
  setNetwork("局域网服务就绪");
  $("#footer-message").textContent = "保持观察，等待你的机会。";
  updateResume();
}
$("#home-button").onclick = () => {
  if (screen === "landing") return;
  openModal(
    "返回作战大厅？",
    '<p class="modal-description">当前对局会保留。你可以通过「继续上次作战」重新加入，其他人的游戏不会中断。</p><div class="modal-buttons"><button class="button secondary" id="stay-here">留在这里</button><button class="button primary" id="leave-here">返回大厅</button></div>',
  );
  $("#stay-here").onclick = closeModal;
  $("#leave-here").onclick = () => {
    closeModal();
    goHome();
  };
};
$("#lobby-back").onclick = goHome;
function createDialog() {
  openModal(
    "建立作战房间",
    `<p class="modal-description">房间创建后即可邀请朋友。其余席位默认由电脑补齐。</p><form id="create-form"><div class="form-grid"><div class="form-field"><label for="create-name">你的呼号</label><input id="create-name" maxlength="18" required value="${esc(nickname())}" autocomplete="nickname"></div><div class="form-field"><label for="create-count">作战人数</label><select id="create-count"><option value="2">2 人</option><option value="3">3 人混战</option><option value="4">4 人</option></select></div><div class="form-field"><label for="create-map">战场</label><select id="create-map">${mapOptions()}</select></div><div class="form-field"><label for="create-co">指挥官</label><select id="create-co">${commanderOptions()}</select></div><div class="form-field wide"><label for="create-fog">战场情报</label><select id="create-fog"><option value="off">全图可见 · 标准规则</option><option value="on">战争迷雾 · 只看得见视野内</option></select></div></div><div class="form-error" id="create-error"></div><button class="button primary large" type="submit">创建房间 <b>→</b></button></form>`,
    "CREATE OPERATION / 战前集结",
  );
  $("#create-form").onsubmit = async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      const name = $("#create-name").value.trim() || "指挥官";
      store("field-command-name", name);
      const result = await api("/api/rooms", {
        name,
        playerCount: Number($("#create-count").value),
        mapId: $("#create-map").value,
        commander: $("#create-co").value,
        mode: "ffa",
        fog: $("#create-fog").value === "on",
      });
      closeModal();
      attachSession(result);
    } catch (error) {
      $("#create-error").textContent = error.message;
      button.disabled = false;
    }
  };
}
$("#create-room").onclick = createDialog;
$("#quick-start").onclick = () =>
  safe(async () => {
    const button = $("#quick-start");
    button.disabled = true;
    try {
      const result = await api("/api/rooms", {
        name: nickname(),
        playerCount: 2,
        mapId: "training",
        commander: "vanguard",
        mode: "ffa",
      });
      attachSession(result);
      await roomRequest("start");
      toast("演习开始：点击赤焰军单位，选择移动位置，再下达命令。");
    } finally {
      button.disabled = false;
    }
  });
/** One click into a fogged match, so the mode is reachable without a lobby. */
$("#fog-skirmish").onclick = () =>
  safe(async () => {
    const button = $("#fog-skirmish");
    button.disabled = true;
    try {
      const result = await api("/api/rooms", {
        name: nickname(),
        playerCount: 2,
        mapId: "training",
        commander: "vanguard",
        mode: "ffa",
        fog: true,
      });
      attachSession(result);
      await roomRequest("start");
      toast("迷雾演习：只看得见己方视野，森林与山地会藏住部队。");
    } finally {
      button.disabled = false;
    }
  });
function joinDialog(prefill = "") {
  openModal(
    "加入作战房间",
    `<p class="modal-description">在房主的服务地址打开本页，输入房间码加入。两台设备需要处于同一局域网。</p><form id="join-form"><div class="form-grid"><div class="form-field"><label for="join-code">房间码</label><input id="join-code" maxlength="12" placeholder="例如 AB12CD" required value="${esc(prefill)}" style="text-transform:uppercase" autocomplete="off"></div><div class="form-field"><label for="join-name">你的呼号</label><input id="join-name" maxlength="18" required value="${esc(nickname())}" autocomplete="nickname"></div><div class="form-field wide"><label for="join-co">指挥官</label><select id="join-co">${commanderOptions("mechanic")}</select></div></div><div class="form-error" id="join-error"></div><button class="button primary large" type="submit">加入战场 <b>→</b></button></form><div class="room-list" id="available-rooms"></div>`,
    "JOIN OPERATION / 接入战场",
  );
  $("#join-form").onsubmit = async (event) => {
    event.preventDefault();
    event.submitter.disabled = true;
    try {
      const id = $("#join-code").value.trim().toUpperCase(),
        name = $("#join-name").value.trim() || "指挥官";
      store("field-command-name", name);
      if (storedSessions[id]) {
        await resumeSession(id);
        closeModal();
        return;
      }
      const result = await api(`/api/rooms/${encodeURIComponent(id)}/join`, {
        name,
        commander: $("#join-co").value,
      });
      closeModal();
      attachSession(result);
    } catch (error) {
      if ($("#join-error")) $("#join-error").textContent = error.message;
      if (event.submitter) event.submitter.disabled = false;
    }
  };
  api("/api/rooms")
    .then((result) => {
      const list = $("#available-rooms");
      if (!list) return;
      list.innerHTML = result.rooms
        .filter((r) => r.phase === "lobby")
        .slice(0, 5)
        .map(
          (r) =>
            `<button data-room="${esc(r.id)}"><span>${esc(r.hostName)}的房间 · ${esc(r.id)}</span><small>${r.humanCount}/${r.playerCount} 玩家</small></button>`,
        )
        .join("");
      list.querySelectorAll("button").forEach(
        (button) =>
          (button.onclick = () => {
            $("#join-code").value = button.dataset.room;
          }),
      );
    })
    .catch(() => {});
}
$("#join-room").onclick = () => joinDialog();
function updateResume() {
  const id = loadJSON("field-command-last", null);
  $("#resume-game").classList.toggle("hidden", !id || !storedSessions[id]);
}
async function resumeSession(id) {
  const saved = storedSessions[id];
  if (!saved) throw new Error("此浏览器没有该房间的席位记录。");
  try {
    const result = await api(
      `/api/rooms/${encodeURIComponent(id)}?token=${encodeURIComponent(saved.token)}`,
    );
    attachSession({
      ...result,
      token: saved.token,
      seat: result.seat ?? saved.seat,
    });
  } catch (error) {
    if (/不存在|凭证|失效|无效|找到/.test(error.message)) {
      delete storedSessions[id];
      store("field-command-sessions", storedSessions);
      updateResume();
    }
    throw error;
  }
}
$("#resume-game").onclick = () =>
  safe(() => resumeSession(loadJSON("field-command-last", null)));
function help() {
  openModal(
    "战地手册",
    `<section class="help-section"><h3>01 / 下达第一条指令</h3><p>点击己方单位 → 点击青色移动格 → 选择「待机」「占领」或点击红色敌军后「确认攻击」。预选移动可以取消；执行后的指令不可撤销。</p></section><section class="help-section"><h3>02 / 用地形与射程赢得交换</h3><p>单位每回合行动一次。森林、山地和据点提供防御。步兵可登山，车辆必须绕行。火炮与火箭炮具有最小射程，移动后不能开火；近战单位会在条件允许时反击。</p></section><section class="help-section"><h3>03 / 占领、生产与补给</h3><p>步兵与机步兵能占领城市、工厂与总部，单次占领推进量取决于剩余血量。点击空闲的己方工厂生产部队。占领据点带来收入；己方据点能维修和补给。补给车可补充邻近部队的弹药与燃料。</p></section><section class="help-section"><h3>04 / 指挥官与胜利条件</h3><p>交战积累指挥能量，50 点可发动普通能力，100 点可发动超级能力。占领敌方总部可使其出局；失去全部单位与工厂也会出局。最后存活的一方或队伍获胜。2v2 中队友资金独立。</p></section><section class="help-section"><h3>05 / 局域网与存档</h3><p>房主创建房间，把邀请地址发给同一局域网内的朋友。支持 2–4 人，空闲电脑席位可在开局前被玩家加入。每次行动自动保存，「保存对局」另存手动快照。断线后使用原浏览器重连，原席位会保留。房主浏览器可以关闭，运行服务的电脑需保持在线。</p></section><section class="help-section"><h3>06 / 操作与首版范围</h3><p><span class="key">Esc</span> 取消预选 / 关闭弹窗　<span class="key">Space</span> 结束回合</p><p>本版提供 8 种陆军、3 张地图与 2 名原创指挥官，全图可见。补给车暂不载兵。海空军、战争迷雾与战役剧情留待后续扩展。</p></section>`,
    "FIELD MANUAL / 指挥入门",
  );
}
$("#help-button").onclick = help;
$("#sound-button").onclick = () => {
  soundEnabled = !soundEnabled;
  $(".sound-slash").classList.toggle("hidden", soundEnabled);
  $("#sound-button").title = soundEnabled ? "关闭音效" : "开启音效";
  $("#sound-button").setAttribute("aria-label", $("#sound-button").title);
  beep();
};
document.addEventListener("keydown", (event) => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
  if (modal.open) return;
  if (screen !== "battle") return;
  if (event.key === "Escape") {
    if (destination || targetId) {
      destination = null;
      targetId = null;
    } else resetSelection();
    renderBattle();
  }
  if (event.code === "Space") {
    event.preventDefault();
    endTurnDialog();
  }
});
window.addEventListener("online", () =>
  setNetwork(session ? "重新连接房间…" : "局域网服务就绪"),
);
window.addEventListener("offline", () => setNetwork("网络已断开", true));
updateResume();
api("/api/rooms")
  .then((result) => {
    serviceURLs = result.urls || [];
    setNetwork("局域网服务就绪");
    const code = new URLSearchParams(location.search).get("room");
    if (code) {
      const normalized = code.trim().toUpperCase();
      if (storedSessions[normalized]) safe(() => resumeSession(normalized));
      else joinDialog(normalized);
    }
  })
  .catch(() => {
    setNetwork("服务未连接", true);
    toast("无法连接游戏服务，请确认启动窗口仍在运行。", true);
  });
