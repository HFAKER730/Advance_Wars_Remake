const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const captured = (tile) => tile.captureBy == null ? 0 : 20 - tile.capture;

function neutralOffset(progress) {
  return progress <= 10 ? 10 - 15 * progress / 10 : -5 - 10 * (progress - 10) / 10;
}

function enemyOffset(progress) {
  return progress <= 10 ? -15 + 10 * progress / 10 : -5 + 15 * (progress - 10) / 10;
}

// The map keeps the old roof until the second capture animation has finished.
export function propertyFlagPose(tile, visual = null, time = Infinity) {
  if (!visual || time >= visual.start + visual.duration) {
    const progress = captured(tile);
    if (tile.owner == null && progress === 0)
      return { owner: null, offset: 10, buildingOwner: null };
    return {
      owner: tile.owner ?? tile.captureBy,
      offset: tile.owner == null ? neutralOffset(progress)
        : progress ? enemyOffset(progress) : -15,
      buildingOwner: tile.owner,
    };
  }

  const elapsed = Math.max(0, time - visual.start);
  const previousOwner = visual.previousOwner;
  const buildingOwner = previousOwner;
  if (previousOwner == null) {
    const end = visual.completed ? 2500 : 1800;
    const progress = visual.progressBefore +
      (visual.progressAfter - visual.progressBefore) * ease((elapsed - 400) / (end - 400));
    return {
      owner: progress > 0 ? visual.owner : null,
      offset: neutralOffset(progress),
      buildingOwner,
    };
  }
  if (!visual.completed) {
    const progress = visual.progressBefore +
      (visual.progressAfter - visual.progressBefore) * ease((elapsed - 400) / 1400);
    return { owner: previousOwner, offset: enemyOffset(progress), buildingOwner };
  }
  if (elapsed < 1400) {
    const progress = visual.progressBefore +
      (20 - visual.progressBefore) * ease((elapsed - 500) / 900);
    return { owner: previousOwner, offset: enemyOffset(progress), buildingOwner };
  }
  return {
    owner: visual.owner,
    offset: 10 - 25 * ease((elapsed - 1400) / 1200),
    buildingOwner,
  };
}
