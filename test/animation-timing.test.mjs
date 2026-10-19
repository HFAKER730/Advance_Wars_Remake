import test from "node:test";
import assert from "node:assert/strict";
import { createGame, applyAction } from "../public/shared/engine.mjs";
import {
  actionAnimationDuration, captureDuration, combatDuration, movementDuration,
} from "../public/shared/animation-timing.mjs";

function state() {
  const game = createGame({
    mapId: "training",
    players: [0, 1].map((id) => ({ id, name: `玩家${id}`, team: id, commander: "vanguard" })),
  });
  game.tiles.forEach((tile) => Object.assign(tile, { type: "plain", owner: null, capture: 20, captureBy: null }));
  game.units = [];
  game.nextUnitId = 1;
  game.players.forEach((player, index) => {
    game.tiles[index].type = "factory";
    game.tiles[index].owner = player.id;
  });
  return game;
}

function unit(game, type, owner, x, y) {
  const stats = { infantry: [null, 99], tank: [9, 70] }[type];
  const current = { id: `u${game.nextUnitId++}`, type, owner, x, y, hp: 10,
    ammo: stats[0], fuel: stats[1], acted: false, cargo: null };
  game.units.push(current);
  return current;
}

test("AI wait covers movement and both capture stages", () => {
  const before = state();
  const soldier = unit(before, "infantry", 0, 2, 3);
  const property = before.tiles[3 * before.width + 3];
  Object.assign(property, { type: "city", owner: null });
  const action = { type: "move", unitId: soldier.id, x: 3, y: 3, command: "capture" };
  const first = applyAction(before, 0, action);
  assert.equal(actionAnimationDuration(before, first, action), 130 + captureDuration(false));
  const secondBefore = structuredClone(first);
  secondBefore.units[0].acted = false;
  const secondAction = { ...action };
  const second = applyAction(secondBefore, 0, secondAction);
  assert.equal(actionAnimationDuration(secondBefore, second, secondAction), captureDuration(true));
  assert.equal(actionAnimationDuration(before, first, { type: "endTurn" }), 0);
});

test("AI wait covers movement followed by a full combat exchange", () => {
  const before = state();
  const attacker = unit(before, "tank", 0, 2, 3);
  const defender = unit(before, "tank", 1, 4, 3);
  const action = { type: "move", unitId: attacker.id, x: 3, y: 3,
    command: "attack", targetId: defender.id };
  const after = applyAction(before, 0, action);
  const counter = attacker.hp - (after.units.find((item) => item.id === attacker.id)?.hp ?? 0);
  assert.equal(actionAnimationDuration(before, after, action),
    movementDuration([{ x: 2, y: 3 }, { x: 3, y: 3 }]) + combatDuration(counter));
});
