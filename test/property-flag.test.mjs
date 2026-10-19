import test from "node:test";
import assert from "node:assert/strict";
import { propertyFlagPose } from "../public/property-flag.mjs";

const base = { type: "city", owner: 1, capture: 20, captureBy: null };

test("neutral property has no flag until capture and retains a half-raised flag", () => {
  const neutral = { ...base, owner: null };
  assert.equal(propertyFlagPose(neutral).owner, null);
  const partial = { ...neutral, capture: 10, captureBy: 0 };
  const visual = { owner: 0, previousOwner: null, progressBefore: 0,
    progressAfter: 10, completed: false, start: 100, duration: 3100 };
  assert.equal(propertyFlagPose(partial, visual, 100).owner, null);
  assert.deepEqual(propertyFlagPose(partial, visual, 1900),
    { owner: 0, offset: -5, buildingOwner: null });
  assert.deepEqual(propertyFlagPose(partial),
    { owner: 0, offset: -5, buildingOwner: null });
});

test("enemy capture lowers its flag halfway, then fully before raising the new flag", () => {
  const partial = { ...base, capture: 10, captureBy: 0 };
  const first = { owner: 0, previousOwner: 1, progressBefore: 0,
    progressAfter: 10, completed: false, start: 100, duration: 3100 };
  assert.deepEqual(propertyFlagPose(partial, first, 100),
    { owner: 1, offset: -15, buildingOwner: 1 });
  assert.deepEqual(propertyFlagPose(partial, first, 1900),
    { owner: 1, offset: -5, buildingOwner: 1 });
  assert.deepEqual(propertyFlagPose(partial),
    { owner: 1, offset: -5, buildingOwner: 1 });

  const captured = { ...base, owner: 0 };
  const second = { owner: 0, previousOwner: 1, progressBefore: 10,
    progressAfter: 20, completed: true, start: 100, duration: 3400 };
  assert.deepEqual(propertyFlagPose(captured, second, 1500),
    { owner: 0, offset: 10, buildingOwner: 1 });
  assert.deepEqual(propertyFlagPose(captured, second, 2700),
    { owner: 0, offset: -15, buildingOwner: 1 });
  assert.deepEqual(propertyFlagPose(captured, second, 3500),
    { owner: 0, offset: -15, buildingOwner: 0 });
});
