const profiles = {
  guppy: { cruise: .94, rush: 2.8, depth: .32, y: .57, drift: .44, period: .8, width: 1.04 },
  neon: { cruise: 1.29, rush: 3.15, depth: -.07, y: -.33, drift: .28, period: 1.05, width: .80, school: true },
  betta: { cruise: .59, rush: 2.15, depth: .69, y: .96, drift: .56, period: .58, width: 1.17 },
  zebra: { cruise: 1.65, rush: 3.2, depth: -.20, y: 1.24, drift: .33, period: 1.44, width: .83 },
  platy: { cruise: .97, rush: 2.7, depth: .36, y: .45, drift: .33, period: .84, width: .96 },
  harlequin: { cruise: 1.25, rush: 2.95, depth: -.20, y: -.08, drift: .30, period: 1.01, width: .96, school: true },
  molly: { cruise: .86, rush: 2.64, depth: .36, y: .70, drift: .46, period: .77, width: 1.12 },
  swordtail: { cruise: 1.25, rush: 3.05, depth: .13, y: .55, drift: .46, period: 1.11, width: 1.15 },
  cory: { cruise: .80, rush: 2.68, depth: .78, y: -1.38, drift: .18, period: .92, width: .99 },
  kuhli: { cruise: .71, rush: 2.80, depth: .92, y: -1.42, drift: .12, period: .76, width: 1.11 },
  gourami: { cruise: .76, rush: 2.55, depth: .26, y: 1.21, drift: .42, period: .72, width: 1.19 },
  ram: { cruise: .82, rush: 2.70, depth: .60, y: -.75, drift: .31, period: .72, width: 1.09 },
  goldfish: { cruise: .64, rush: 2.40, depth: .73, y: .23, drift: .45, period: .62, width: 1.42 },
  angelfish: { cruise: .67, rush: 2.48, depth: .42, y: .42, drift: .63, period: .59, width: 1.42 },
  discus: { cruise: .57, rush: 2.43, depth: .29, y: .08, drift: .41, period: .54, width: 1.50 },
};
export const fishWidth = speciesId => profiles[speciesId].width;
export const fishLane = speciesId => profiles[speciesId].y;

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

export function createFeeding(models, portionIds, time, swimScale = 1) {
  const selected = [...new Set(portionIds)].map(id => models.get(id)).filter(Boolean);
  const pellets = selected.map((model, index) => {
    const horizontal = index % 7 - Math.min(6, selected.length - 1) / 2;
    const depth = Math.floor(index / 7) % 4;
    return {
      owner: model.motion.id,
      approach: 0,
      x: limit(model.motion.x * .48 + horizontal * .28, -4 * swimScale, 4 * swimScale),
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

export function stepMotion(motion, seconds, delta, feeding, swimScale = 1) {
  const { phase, seed, profile } = motion;
  const target = feeding?.pellets.find(pellet => pellet.owner === motion.id && !pellet.eaten);
  const seeking = target && !target.eaten && seconds >= target.release;
  const tempo = seconds * profile.period + phase;
  const pause = motion.speciesId === 'betta' ? .60 + .4 * Math.sin(tempo * .69) ** 4 : 1;
  const school = profile.school ? Math.sin(seconds * .48) * 2.2 : 0;
  if (seeking && !target.approach) target.approach = Math.sign(target.x - motion.x) || motion.facing;
  const mouthOffset = profile.width * .34;
  const destinationX = seeking ? target.x - target.approach * mouthOffset
    : (school + Math.sin(tempo * .53) * (profile.school ? 1.15 : 3.4)) * swimScale;
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
  motion.x = limit(motion.x + motion.vx * delta, -4.6 * swimScale, 4.6 * swimScale);
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
