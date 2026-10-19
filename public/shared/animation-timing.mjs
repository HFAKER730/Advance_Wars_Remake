import { reachable } from "./engine.mjs";

/**
 * Animation clock. The GBA games move a unit about one tile every 8 frames
 * (~130 ms) and turn without an extra pause; the earlier 240 ms step felt like
 * the board was dragging. Combat was likewise trimmed by roughly a third and
 * gained a short hit stop, which is what carries the impact.
 */
export const MOVE_STEP_MS = 130;
export const MOVE_TURN_MS = 45;
export const COMBAT_TIMING = Object.freeze({
  firstFire: 240,
  firstHit: 470,
  counterFire: 940,
  counterHit: 1170,
  endWithoutCounter: 1020,
  endWithCounter: 1680,
  /** The whole frame freezes for this long on each hit. */
  hitStop: 70,
});

export function combatDuration(counter) {
  const stops = counter > 0 ? 2 : 1;
  return (
    (counter > 0
      ? COMBAT_TIMING.endWithCounter
      : COMBAT_TIMING.endWithoutCounter) +
    stops * COMBAT_TIMING.hitStop
  );
}

/**
 * Maps the wall clock to the animation clock. Each hit freezes the frame for
 * `hitStop`, so a timer that reads this returns the same picture twice — the
 * classic one-two punch. Callers schedule against `combatDuration`, which
 * already includes those pauses.
 */
export function combatClock(raw) {
  const timing = COMBAT_TIMING;
  let paused = 0;
  if (raw >= timing.firstHit) paused += timing.hitStop;
  if (raw >= timing.counterHit + timing.hitStop) paused += timing.hitStop;
  return raw - paused;
}

export function captureDuration(completed) {
  return completed ? 3400 : 3100;
}

export function movementDuration(path, startFacing = "right") {
  if (!path?.length || path.length === 1) return 0;
  let duration = 0, previous = startFacing;
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i], to = path[i + 1];
    const direction = to.x > from.x ? "right" : to.x < from.x ? "left"
      : to.y > from.y ? "down" : "up";
    if (direction !== previous) duration += MOVE_TURN_MS;
    duration += MOVE_STEP_MS;
    previous = direction;
  }
  return duration;
}

// The server schedules the next AI command against the same timeline that
// clients use for movement, combat, supply, and capture playback.
export function actionAnimationDuration(before, after, action) {
  if (action.type !== "move") return 0;
  const unit = before.units.find((item) => item.id === action.unitId);
  if (!unit) return 0;
  const path = reachable(before, unit.id).find(
    (cell) => cell.x === action.x && cell.y === action.y,
  )?.path;
  const travel = movementDuration(path);
  if (action.command === "attack") {
    const survivor = after.units.find((item) => item.id === unit.id);
    return travel + combatDuration(unit.hp - (survivor?.hp ?? 0));
  }
  if (action.command === "capture") {
    const prior = before.tiles.find((tile) => tile.x === action.x && tile.y === action.y);
    const current = after.tiles.find((tile) => tile.x === action.x && tile.y === action.y);
    return travel + captureDuration(current?.owner === unit.owner && prior?.owner !== unit.owner);
  }
  if (unit.type === "apc" && ["supply", "wait"].includes(action.command))
    return travel + 1050;
  return travel;
}
