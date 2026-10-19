/**
 * Shared fixtures for rule tests. Kept separate so every suite exercises the
 * same board construction and cannot drift from the others.
 */
import { UNITS, applyAction, createGame } from "../public/shared/engine.mjs";

export const aiPlayers = (count = 2, teams = false) =>
  Array.from({ length: count }, (_, id) => ({
    id,
    name: `玩家${id}`,
    team: teams ? id % 2 : id,
    commander: id % 2 ? "mechanic" : "vanguard",
    controller: "ai",
  }));

/** Flat board, one factory per seat, no starting units. */
export function fixture(count = 2, teams = false) {
  const state = createGame({
    mapId: "training",
    players: aiPlayers(count, teams),
  });
  state.tiles.forEach((tile) =>
    Object.assign(tile, {
      type: "plain",
      owner: null,
      capture: 20,
      captureBy: null,
    }),
  );
  state.units = [];
  state.nextUnitId = 1;
  state.players.forEach((player, index) => {
    Object.assign(state.tiles[index], { type: "factory", owner: player.id });
    player.funds = 10000;
  });
  return state;
}

export function addUnit(state, type, owner, x, y, properties = {}) {
  const definition = UNITS[type];
  const unit = {
    id: `u${state.nextUnitId++}`,
    type,
    owner,
    x,
    y,
    hp: 10,
    ammo: definition.maxAmmo,
    fuel: definition.maxFuel,
    acted: false,
    cargo: null,
    ...properties,
  };
  state.units.push(unit);
  return unit;
}

export const tileAt = (state, x, y) => state.tiles[y * state.width + x];

export const moveAction = (
  unit,
  x = unit.x,
  y = unit.y,
  command = "wait",
  targetId,
) => ({
  type: "move",
  unitId: unit.id,
  x,
  y,
  command,
  ...(targetId ? { targetId } : {}),
});

/** Advances turns until `seat` acts again, or the game ends. */
export function round(state, seat = state.currentPlayer) {
  do
    state = applyAction(state, state.currentPlayer, { type: "endTurn" });
  while (state.currentPlayer !== seat && state.phase === "playing");
  return state;
}

export const livePlayers = (state) => state.players.filter((p) => !p.defeated);
export const liveTeams = (state) =>
  new Set(livePlayers(state).map((p) => p.team));
