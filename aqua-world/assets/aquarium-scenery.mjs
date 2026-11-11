export const WIDTH = 960;
export const HEIGHT = 540;

const palettes = {
  river: {
    sky: '#e5fff1', water: '#83dac7', deep: '#68c7b6', sand: '#fff1c7', sandEdge: '#dfbd87',
    foliage: ['#84bd69', '#378b61', '#316e60'], distant: '#3c9b86',
    stone: ['#c3d2a9', '#829881', '#597a73'], timber: ['#b28758', '#765846'],
  },
  studio: {
    sky: '#e3faff', water: '#96d9e8', deep: '#75bfda', sand: '#fcf5dc', sandEdge: '#dccba6',
    foliage: ['#a4c579', '#54a384', '#3c8a83'], distant: '#518fa1',
    stone: ['#d0dcd7', '#9aafa9', '#688c90'], timber: ['#c3986a', '#846c57'],
  },
};

const rockShapes = [
  new Path2D('M-1 1 Q-29 1 -46 -8 Q-55 -14 -42 -29 L-27 -37 Q-18 -58 4 -61 Q15 -60 24 -47 L43 -41 Q52 -32 49 -16 Q41 1 -1 1Z'),
  new Path2D('M-41 -6 Q-47 -14 -35 -31 L-18 -47 Q3 -49 19 -39 L38 -24 Q48 -16 40 -7 Q27 3 2 1Z'),
];

function randomFrom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function gradient(ctx, x1, y1, x2, y2, stops) {
  const paint = ctx.createLinearGradient(x1, y1, x2, y2);
  stops.forEach(([offset, color]) => paint.addColorStop(offset, color));
  return paint;
}

function ellipse(ctx, x, y, radiusX, radiusY, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function paintRock(ctx, x, y, scale, palette, variant = 0) {
  const form = rockShapes[variant % rockShapes.length];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ellipse(ctx, 3, -2, 51, 8, '#547a6540');
  ctx.fillStyle = gradient(ctx, -26, -60, 18, 5, [[0, palette.stone[0]], [.52, palette.stone[1]], [1, palette.stone[2]]]);
  ctx.fill(form);
  ctx.save();
  ctx.clip(form);
  ctx.fillStyle = '#f4f1c64d';
  ctx.beginPath();
  ctx.moveTo(-48, -24);
  ctx.lineTo(-17, -48);
  ctx.lineTo(7, -52);
  ctx.lineTo(24, -44);
  ctx.quadraticCurveTo(-2, -36, -8, -23);
  ctx.quadraticCurveTo(-20, -14, -48, -24);
  ctx.fill();
  ctx.strokeStyle = '#ecf5d65e';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-43, -19);
  ctx.quadraticCurveTo(-22, -25, -8, -21);
  ctx.quadraticCurveTo(13, -19, 25, -37);
  ctx.moveTo(-32, -11);
  ctx.quadraticCurveTo(-15, -18, -6, -14);
  ctx.quadraticCurveTo(15, -10, 34, -26);
  ctx.stroke();
  const specks = randomFrom(33 + variant);
  for (let index = 0; index < 48; index++) {
    const shade = specks() > .55 ? '#e8eccb47' : '#45655243';
    ellipse(ctx, specks() * 98 - 49, -specks() * 58, .6 + specks() * 1.2, .65, shade);
  }
  ctx.restore();
  ctx.restore();
}

function paintGrass(ctx, x, y, scale, palette, wave = 0, count = 9) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const shade = gradient(ctx, 0, 0, 0, -160, [[0, palette.foliage[2]], [.5, palette.foliage[1]], [1, palette.foliage[0]]]);
  for (let blade = 0; blade < count; blade++) {
    const index = blade - (count - 1) / 2;
    const tip = index * 13 + Math.sin(wave * .9 + blade * 1.4) * (wave ? 7 : 3);
    const height = 145 - Math.abs(index) * 13 + (blade % 3) * 9;
    const root = index * 4;
    ctx.beginPath();
    ctx.moveTo(root, 0);
    ctx.bezierCurveTo(root - 8, -height * .31, tip - 9, -height * .81, tip, -height);
    ctx.bezierCurveTo(tip + 5, -height * .72, root + 13, -height * .25, root + 4, 0);
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.strokeStyle = '#e7ffba63';
    ctx.lineWidth = .75;
    ctx.beginPath();
    ctx.moveTo(root + 1, -3);
    ctx.quadraticCurveTo(root + 2, -height * .58, tip, -height * .92);
    ctx.stroke();
  }
  ctx.restore();
}

function paintStems(ctx, x, y, scale, palette, mirrored = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(mirrored ? -scale : scale, scale);
  const leafColor = gradient(ctx, 0, -126, 0, 0, [[0, palette.foliage[0]], [.64, palette.foliage[1]], [1, palette.foliage[2]]]);
  for (let stem = 0; stem < 5; stem++) {
    const root = (stem - 2) * 13;
    const height = 91 + (stem % 3) * 23;
    ctx.strokeStyle = palette.foliage[2];
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(root, 0);
    ctx.quadraticCurveTo(root - 8, -height * .51, root + 18, -height);
    ctx.stroke();
    for (let pair = 1; pair <= 5; pair++) {
      const fraction = pair / 6;
      const baseX = root + fraction * fraction * 18 - Math.sin(fraction * Math.PI) * 3;
      const baseY = -height * fraction;
      for (const side of [-1, 1]) {
        const length = (25 - fraction * 11) * side;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.quadraticCurveTo(baseX + length * .46, baseY - 21, baseX + length, baseY - 15);
        ctx.quadraticCurveTo(baseX + length * .76, baseY - 2, baseX, baseY);
        ctx.fillStyle = leafColor;
        ctx.fill();
        ctx.strokeStyle = '#e4f4aa77';
        ctx.lineWidth = .6;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY - 1);
        ctx.quadraticCurveTo(baseX + length * .52, baseY - 12, baseX + length * .88, baseY - 14);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

const branch = new Path2D('M-64 -2 Q-24 -8 -4 -29 Q11 -48 41 -60 Q52 -63 61 -58 Q32 -46 25 -30 Q11 -12 10 -9 Q29 -12 50 -27 Q61 -32 66 -28 Q61 -22 46 -13 Q14 10 -49 6Z');
const branchGrain = new Path2D('M-54 0 Q-15 -6 4 -27 Q28 -49 52 -57 M-34 4 Q-8 -1 7 -15 Q24 -22 37 -32 M1 1 Q36 -4 57 -23');

function paintWood(ctx, x, y, scale, palette, mirrored = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(mirrored ? -scale : scale, scale);
  ellipse(ctx, 4, 3, 64, 8, '#66816645');
  ctx.fillStyle = gradient(ctx, 0, -60, 4, 8, [[0, '#dfba87'], [.42, palette.timber[0]], [1, palette.timber[1]]]);
  ctx.fill(branch);
  ctx.strokeStyle = '#f6d5a383';
  ctx.lineWidth = 1.5;
  ctx.stroke(branchGrain);
  ctx.restore();
}

function paintWater(ctx, palette) {
  ctx.fillStyle = gradient(ctx, 0, 0, 0, HEIGHT, [[0, palette.sky], [.55, palette.water], [1, palette.deep]]);
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const sun = ctx.createRadialGradient(221, -49, 16, 260, 54, 470);
  sun.addColorStop(0, '#fff8dfe8');
  sun.addColorStop(.48, '#fff9d757');
  sun.addColorStop(1, '#fff8da00');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const rays = [[38, 96, 128, 335], [114, 161, 318, 450], [195, 238, 475, 661], [280, 315, 660, 810]];
  for (const [from, to, endFrom, endTo] of rays) {
    ctx.fillStyle = gradient(ctx, 0, 0, 0, 448, [[0, '#fffce05c'], [.57, '#fffce019'], [1, '#fffce000']]);
    ctx.beginPath();
    ctx.moveTo(from, 0);
    ctx.lineTo(to, 0);
    ctx.lineTo(endTo, 448);
    ctx.lineTo(endFrom, 448);
    ctx.fill();
  }
  ctx.strokeStyle = '#ffffff9e';
  ctx.lineWidth = 2.7;
  ctx.beginPath();
  ctx.moveTo(0, 23);
  ctx.bezierCurveTo(191, 36, 269, 10, 443, 19);
  ctx.bezierCurveTo(632, 31, 795, 11, 960, 22);
  ctx.stroke();
  ctx.strokeStyle = '#f7fff16e';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(37, 37);
  ctx.bezierCurveTo(235, 50, 321, 22, 519, 29);
  ctx.bezierCurveTo(714, 45, 827, 24, 932, 35);
  ctx.stroke();
}

function paintSand(ctx, palette, river) {
  const floor = new Path2D(river
    ? 'M0 406 C163 375 261 414 380 461 C560 490 719 404 960 417 V540 H0Z'
    : 'M0 448 C191 422 321 464 519 450 C698 448 812 414 960 435 V540 H0Z');
  ctx.fillStyle = gradient(ctx, 0, 400, 0, 540, [[0, palette.sandEdge], [.42, palette.sand], [1, palette.sandEdge]]);
  ctx.fill(floor);
  ctx.save();
  ctx.clip(floor);
  const specks = randomFrom(river ? 137 : 701);
  for (let index = 0; index < 1020; index++) {
    const x = specks() * WIDTH;
    const y = 397 + specks() * 143;
    const radius = .4 + specks() * 2.25;
    const color = index % 3 === 0 ? '#7b755332' : '#fffbe194';
    ellipse(ctx, x, y, radius, radius * .53, color);
  }
  for (let index = 0; index < 13; index++) {
    ctx.strokeStyle = index % 2 === 0 ? '#fff9d579' : '#b69e6f3b';
    ctx.lineWidth = index % 2 === 0 ? 1.7 : 1;
    ctx.beginPath();
    ctx.moveTo(-10, 456 + index * 8);
    ctx.bezierCurveTo(268, 445 + index * 8, 383, 529 - index * 3, 688, 474 + index * 4);
    ctx.quadraticCurveTo(827, 453 + index * 6, 971, 471 + index * 6);
    ctx.stroke();
  }
  ctx.restore();
}

export function createTankBackdrop(tankId) {
  const river = tankId === 'river';
  const palette = palettes[river ? 'river' : 'studio'];
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  paintWater(ctx, palette);

  ctx.save();
  ctx.globalAlpha = .23;
  paintStems(ctx, 43, 455, 1.74, palette, true);
  paintGrass(ctx, 178, 462, 1.53, palette);
  paintStems(ctx, 809, 442, 1.40, palette);
  paintGrass(ctx, 940, 442, 1.72, palette);
  ctx.restore();
  paintSand(ctx, palette, river);

  if (river) {
    paintGrass(ctx, 56, 450, 1.52, palette);
    paintStems(ctx, 136, 439, 1.28, palette);
    paintRock(ctx, 49, 465, 1.56, palette);
    paintRock(ctx, 116, 460, 1.24, palette, 1);
    paintWood(ctx, 170, 457, 1.25, palette);
    paintGrass(ctx, 887, 475, 1.44, palette);
    paintStems(ctx, 820, 472, 1.04, palette, true);
    paintRock(ctx, 892, 498, 1.75, palette);
    paintRock(ctx, 792, 493, 1.12, palette, 1);
  } else {
    paintRock(ctx, 184, 489, 1.12, palette, 1);
    paintStems(ctx, 106, 469, 1.18, palette);
    paintRock(ctx, 79, 492, 1.32, palette);
    paintWood(ctx, 812, 477, 1.28, palette, true);
    paintStems(ctx, 905, 469, 1.33, palette, true);
    paintRock(ctx, 873, 495, 1.1, palette, 1);
  }
  return canvas;
}

export function drawDecoration(ctx, item, tankId, wave, selected) {
  const palette = palettes[tankId === 'river' ? 'river' : 'studio'];
  const x = item.x * WIDTH;
  const y = item.y * HEIGHT;
  if (selected) {
    ctx.strokeStyle = '#176a5d';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.ellipse(x, y, 47, 11, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (item.kind === 'grass') paintGrass(ctx, x, y, .69, palette, wave, 8);
  if (item.kind === 'stone') paintRock(ctx, x, y, .83, palette);
  if (item.kind === 'wood') paintWood(ctx, x, y, .79, palette);
}

export function drawWaterMotion(ctx, seconds, lowPower) {
  const bubbles = lowPower ? 8 : 18;
  for (let index = 0; index < bubbles; index++) {
    const x = 32 + (index * 179) % (WIDTH - 64) + Math.sin(seconds * .7 + index) * 9;
    const y = 425 - ((seconds * (12 + index % 7) + index * 63) % 396);
    const radius = 1.6 + (index % 4) * .85;
    ctx.strokeStyle = '#ffffff91';
    ctx.lineWidth = .95;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (lowPower) return;
  ctx.strokeStyle = '#fffbe759';
  ctx.lineWidth = 1.8;
  for (let index = 0; index < 5; index++) {
    const x = 30 + 179 * index + Math.sin(seconds * .5 + index) * 13;
    const y = 20 + (index % 3) * 5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 31, y + Math.sin(seconds + index) * 4, x + 74, y - 2);
    ctx.stroke();
  }
}
