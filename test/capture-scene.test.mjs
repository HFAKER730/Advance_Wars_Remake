import test from "node:test";
import assert from "node:assert/strict";
import { captureDuration, captureSceneState, captureSceneCaption } from "../public/capture-scene.mjs";

const unit = { type: "infantry", owner: 0 };
const tile = { type: "city" };

test("first capture action stops at 10/20 while the property keeps its owner", () => {
  const capture = { unit, tile, previousOwner: 1, progressBefore: 0, progressAfter: 10, completed: false };
  assert.equal(captureSceneState(capture, 1300).progress, 0);
  assert.equal(captureSceneState(capture, 2050).progress, 10);
  assert.equal(captureSceneState(capture, captureDuration(false)).owner, 1);
  assert.match(captureSceneCaption(capture, captureDuration(false)), /10\/20/);
});

test("second capture action starts halfway and changes ownership only after completion", () => {
  const capture = { unit, tile, previousOwner: 1, progressBefore: 10, progressAfter: 20, completed: true };
  assert.equal(captureSceneState(capture, 1300).progress, 10);
  assert.equal(captureSceneState(capture, 2050).progress, 20);
  assert.equal(captureSceneState(capture, 2299).owner, 1);
  assert.equal(captureSceneState(capture, 2300).owner, 0);
  assert.equal(captureDuration(true), 3400);
});
