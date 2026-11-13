const profiles = {
  guppy: { cruise: .94, rush: 2.8, depth: .32, y: .57, drift: .44, period: .8, width: 1.04 },
  neon: { cruise: 1.29, rush: 3.15, depth: -.07, y: -.33, drift: .28, period: 1.05, width: .80 },
  betta: { cruise: .59, rush: 2.15, depth: .69, y: .96, drift: .56, period: .58, width: 1.17 },
};
export const fishWidth = speciesId => profiles[speciesId].width;

const limit = (value, min, max) => Math.max(min, Math.min(max, value));

function hashId(id) {
  let value = 2166136261;
  for (const char of id) value = Math.imul(value ^ char.codePointAt(0), 16777619);
  return value >>> 0;
}

export function createMotion(fish) {
  const seed = hashId(fish.id);
  const phase = seed % 997 / 997 * Math.PI * 2;
  const profile = profiles[fish.speciesId];
  return {
    id: fish.id, speciesId: fish.speciesId, seed, phase, profile,
    x: Math.sin(phase) * 3.12, y: profile.y + Math.cos(phase) * .39,
    z: profile.depth + Math.sin(phase * .64) * .39,
    vx: Math.cos(phase) * profile.cruise, vy: 0, vz: 0,
    facing: Math.cos(phase) < 0 ? -1 : 1, flip: 1, angle: 0, bite: 0,
  };
}

export function createFeeding(models, portionIds, time) {
  const selected = [...new Set(portionIds)].map(id => models.get(id)).filter(Boolean);
  const pellets = selected.map((model, index) => {
    const horizontal = index % 7 - Math.min(6, selected.length - 1) / 2;
    const depth = Math.floor(index / 7);
    return {
      owner: model.motion.id,
      approach: 0,
      x: limit(model.motion.x * .48 + horizontal * .28, -4, 4),
      y: 2.69 + (index % 3) * .09, z: .46 + depth * .30 + (index % 2) * .16,
      release: time + index % 4 * .09, eaten: false,
    };
  });
  return { pellets, served: pellets.length, eaten: 0, ends: time + 6 };
}

export function advanceFeeding(feeding, time, delta) {
  if (!feeding || time > feeding.ends) return;
  for (const pellet of feeding.pellets) {
    if (pellet.eaten || time < pellet.release) continue;
    pellet.y = Math.max(-1.85, pellet.y - delta * .58);
    pellet.x += Math.sin(time * 3.1 + pellet.release * 7) * delta * .055;
  }
  return feeding;
}

export function stepMotion(motion, seconds, delta, feeding) {
  const { phase, seed, profile } = motion;
  const target = feeding?.pellets.find(pellet => pellet.owner === motion.id && !pellet.eaten);
  const seeking = target && !target.eaten && seconds >= target.release;
  const tempo = seconds * profile.period + phase;
  const pause = motion.speciesId === 'betta' ? .60 + .4 * Math.sin(tempo * .69) ** 4 : 1;
  const school = motion.speciesId === 'neon' ? Math.sin(seconds * .48) * 2.2 : 0;
  if (seeking && !target.approach) target.approach = Math.sign(target.x - motion.x) || motion.facing;
  const mouthOffset = profile.width * .34;
  const destinationX = seeking ? target.x - target.approach * mouthOffset
    : school + Math.sin(tempo * .53) * (motion.speciesId === 'neon' ? 1.15 : 3.4);
  const destinationY = seeking ? target.y : profile.y + Math.sin(tempo * .74 + .3) * profile.drift;
  const destinationZ = seeking ? target.z : profile.depth + Math.sin(tempo * .42 + seed % 7) * .72;
  const dx = destinationX - motion.x;
  const dy = destinationY - motion.y;
  const dz = destinationZ - motion.z;
  const max = seeking ? profile.rush : profile.cruise * pause;
  const approach = Math.min(1.70, max / Math.max(.10, Math.hypot(dx, dy, dz)));
  const easing = 1 - Math.exp(-delta * (seeking ? 5.2 : 2.4));
  motion.vx += (dx * approach - motion.vx) * easing;
  motion.vy += (dy * approach - motion.vy) * easing;
  motion.vz += (dz * approach - motion.vz) * easing;
  const direction = seeking ? target.approach : Math.sign(motion.vx);
  if (direction && (seeking || Math.abs(motion.vx) > .11) && direction !== motion.facing) {
    motion.facing = direction;
    motion.flip = .42;
  }
  motion.flip = Math.min(1, motion.flip + delta * 4.5);
  motion.x = limit(motion.x + motion.vx * delta, -4.6, 4.6);
  motion.y = limit(motion.y + motion.vy * delta, -1.4, 2.70);
  motion.z = limit(motion.z + motion.vz * delta, -1.55, 1.65);
  const mouth = motion.x + motion.facing * mouthOffset;
  motion.bite = Math.max(0, motion.bite - delta * 4);
  if (seeking && Math.hypot(target.x - mouth, target.y - motion.y, target.z - motion.z) < .37) {
    target.eaten = true;
    feeding.eaten++;
    motion.bite = 1;
  }
  const angle = limit(motion.vy * (seeking ? .30 : .12), -.42, .49) * motion.facing;
  motion.angle += (angle - motion.angle) * easing;
  return motion;
}
