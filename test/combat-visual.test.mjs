import test from "node:test";
import assert from "node:assert/strict";
import { capturesFromStates, combatDisplayUnits, combatFromStates, movementDuration, movementPosition } from "../public/renderer.mjs";

const unit = (id, owner, x, y, hp = 10, acted = false, type = "tank") => ({
  id, owner, x, y, hp, acted, type,
});
const state = (...units) => ({ mapId: "plain", units });

test("battle visuals identify attack and counterattack from a state transition", () => {
  const before = state(unit("a", 0, 2, 2), unit("b", 1, 3, 2));
  const after = state(unit("a", 0, 2, 2, 8, true), unit("b", 1, 3, 2, 6));
  const exchange = combatFromStates(before, after);
  assert.equal(exchange.attacker.id, "a");
  assert.equal(exchange.defender.id, "b");
  assert.equal(exchange.damage, 4);
  assert.equal(exchange.counter, 2);
});

test("battle visuals handle a destroyed defender and ignore unrelated actions", () => {
  const before = state(unit("a", 0, 2, 2), unit("b", 1, 3, 2, 3));
  const after = state(unit("a", 0, 2, 2, 10, true));
  assert.deepEqual(
    [combatFromStates(before, after).defender.hpAfter,
      combatFromStates(before, after).counter],
    [0, 0],
  );
  assert.equal(
    combatFromStates(before, state(unit("a", 0, 3, 2, 10, true), unit("b", 1, 3, 2, 3))),
    null,
  );
});

test("battle visuals handle an attacker destroyed by a counterattack", () => {
  const before = state(unit("a", 0, 2, 2, 2), unit("b", 1, 3, 2));
  const after = state(unit("b", 1, 3, 2, 6));
  const exchange = combatFromStates(before, after);
  assert.equal(exchange.attacker.hpAfter, 0);
  assert.equal(exchange.damage, 4);
  assert.equal(exchange.counter, 2);
});

test("destroyed units remain visible until their battle impact", () => {
  const attacker = unit("a", 0, 2, 2, 3);
  const defender = unit("b", 1, 3, 2, 2);
  const after = state();
  const visual = {
    attacker, defender,
    defenderHitAt: 1760,
    counterHitAt: 2880,
    endAt: 3700,
  };
  assert.deepEqual(combatDisplayUnits(after, visual, 1759).map((u) => u.id), ["a", "b"]);
  assert.deepEqual(combatDisplayUnits(after, visual, 1760).map((u) => u.id), ["a"]);
  assert.deepEqual(combatDisplayUnits(after, visual, 2880), []);
  assert.deepEqual(combatDisplayUnits(after, visual, 3700), []);
  const survivors = state(unit("a", 0, 2, 2, 1, true), unit("b", 1, 3, 2, 1));
  assert.deepEqual(combatDisplayUnits(survivors, visual, 1759).map((u) => u.hp), [3, 2]);
  assert.deepEqual(combatDisplayUnits(survivors, visual, 1760).map((u) => u.hp), [3, 1]);
  assert.deepEqual(combatDisplayUnits(survivors, visual, 2880).map((u) => u.hp), [1, 1]);
});

test("infantry and mech captures are identified by property progress, not confused with combat", () => {
  for (const type of ["infantry", "mech"]) {
    for (const terrain of ["city", "factory", "hq"]) {
      const before = { ...state(unit("a", 0, 2, 2, 10, false, type), unit("b", 1, 3, 2)),
        tiles: [{ x: 2, y: 2, type: terrain, owner: 1, capture: 20, captureBy: null }] };
      const after = { ...state(unit("a", 0, 2, 2, 10, true, type)),
        tiles: [{ x: 2, y: 2, type: terrain, owner: 0, capture: 20, captureBy: null }] };
      assert.equal(capturesFromStates(before, after)[0]?.unit.id, "a");
      assert.equal(combatFromStates(before, after), null);
      const partial = { ...after,
        tiles: [{ x: 2, y: 2, type: terrain, owner: 1, capture: 10, captureBy: 0 }] };
      assert.equal(capturesFromStates(before, partial)[0]?.unit.id, "a");
    }
  }
});

test("movement follows each corner, turns the sprite, and then reaches the destination", () => {
  const path = [
    { x: 1, y: 1 }, { x: 2, y: 1 },
    { x: 2, y: 2 }, { x: 2, y: 3 },
  ];
  // One 130 ms step, then a 45 ms turn plus a step, then a straight step.
  assert.equal(movementDuration(path), 435);
  assert.deepEqual(movementPosition(path, 65),
    { x: 1.5, y: 1, direction: "right", turning: false, done: false });
  assert.deepEqual(movementPosition(path, 130),
    { x: 2, y: 1, direction: "right", turning: true, done: false });
  assert.deepEqual(movementPosition(path, 160),
    { x: 2, y: 1, direction: "down", turning: true, done: false });
  assert.deepEqual(movementPosition(path, 240),
    { x: 2, y: 1.5, direction: "down", turning: false, done: false });
  assert.deepEqual(movementPosition(path, 435),
    { x: 2, y: 3, direction: "down", turning: false, done: true });
  assert.equal(movementDuration([{ x: 1, y: 1 }, { x: 2, y: 1 }], "left"), 175);
});
