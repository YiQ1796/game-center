const forms = {
  guppy: {
    size: 1.02, top: '#fff0c8', mid: '#efae69', shade: '#9a5c52', fin: '#e98163', line: '#fff4d8',
    body: 'M-28 1 C-10 -16 20 -19 39 -7 Q50 -1 42 5 C27 17 -7 14 -28 4Z',
    tail: 'M0 0 C-12 -5 -24 -31 -53 -25 C-45 -12 -43 6 -55 27 C-35 32 -15 14 0 2Z',
    dorsal: 'M-18 -8 Q-11 -29 8 -22 Q15 -19 18 -12Z',
    ventral: 'M3 8 Q-5 29 -19 20 Q-7 10 3 8Z',
  },
  neon: {
    size: .83, top: '#a9e7e1', mid: '#52cbd9', shade: '#2c738f', fin: '#afdbdc', line: '#d7ffff',
    body: 'M-34 1 Q-17 -14 14 -11 Q39 -10 46 -1 Q32 14 -4 10 Q-24 8 -34 3Z',
    tail: 'M0 0 Q-12 -5 -36 -17 Q-29 -4 -20 1 Q-27 8 -35 19 Q-12 11 0 4Z',
    dorsal: 'M-10 -8 Q-3 -22 5 -21 L19 -9Z',
    ventral: 'M-4 6 L-18 20 Q-22 16 -20 9Z',
  },
  betta: {
    size: 1.12, top: '#d4e4ff', mid: '#7f9add', shade: '#605689', fin: '#b282bf', line: '#e4d5ff',
    body: 'M-24 2 Q-9 -20 20 -18 Q42 -16 47 -4 Q51 8 33 10 Q1 22 -24 6Z',
    tail: 'M0 0 C-11 -10 -24 -42 -52 -34 C-67 -22 -56 -16 -61 -8 C-58 4 -65 13 -59 25 C-55 35 -39 43 -20 29 Q-7 17 0 2Z',
    dorsal: 'M-18 -8 Q-21 -30 -5 -36 Q13 -38 19 -14Z',
    ventral: 'M30 8 Q27 21 19 27 Q-5 36 -24 23 Q-27 18 -22 5Z',
  },
};

for (const form of Object.values(forms)) {
  for (const part of ['body', 'tail', 'dorsal', 'ventral']) form[part] = new Path2D(form[part]);
}
const neonStripe = new Path2D('M-34 2 Q-16 2 17 4 Q-5 16 -29 7Z');
const gill = new Path2D('M24 -10 Q16 -3 22 8');
const pectoral = new Path2D('M17 0 Q11 9 -4 10 Q5 0 17 0Z');
const scalePattern = new Path2D();
for (let row = -1; row <= 1; row++) {
  for (let column = 0; column < 7; column++) {
    const x = -17 + column * 5 + row * 2;
    const y = row * 5 - 1;
    scalePattern.moveTo(x, y - 2);
    scalePattern.quadraticCurveTo(x + 3, y, x, y + 2);
  }
}

function fill(ctx, path, paint) {
  ctx.fillStyle = paint;
  ctx.fill(path);
}

function eye(ctx, x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe3a1';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + .8, y, 2.8, 0, Math.PI * 2);
  ctx.fillStyle = '#111c22';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 1.5, y - 1.2, 1, 0, Math.PI * 2);
  ctx.fillStyle = '#fbf7eb';
  ctx.fill();
}

export function drawFishModel(ctx, fish, point, heading, time, selected, artwork) {
  const form = forms[fish.speciesId];
  ctx.save();
  ctx.translate(point.x, point.y);
  if (selected) {
    ctx.strokeStyle = '#226d61';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.ellipse(0, 0, 64 * form.size, 37 * form.size, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.scale(heading * form.size, form.size);
  if (artwork) {
    const ratio = Math.min(116 / artwork.naturalWidth, 66 / artwork.naturalHeight);
    const width = artwork.naturalWidth * ratio;
    const height = artwork.naturalHeight * ratio;
    ctx.drawImage(artwork, -width / 2, -height / 2, width, height);
    ctx.restore();
    return;
  }
  ctx.rotate(Math.sin(time * 3.1 + point.y) * .035);
  if (fish.glow) {
    ctx.shadowColor = '#87fff4';
    ctx.shadowBlur = 12;
  }
  const fin = ctx.createLinearGradient(-51, -24, 12, 27);
  fin.addColorStop(0, form.shade);
  fin.addColorStop(.43, form.fin);
  fin.addColorStop(1, form.top);
  ctx.save();
  ctx.translate(-25, 0);
  ctx.transform(.92 + .08 * Math.sin(time * 8 + point.y), Math.sin(time * 7 + point.x) * .16, 0, 1, 0, 0);
  fill(ctx, form.tail, fin);
  ctx.clip(form.tail);
  ctx.strokeStyle = form.line + '47';
  ctx.lineWidth = .7;
  ctx.beginPath();
  for (let ray = -32; ray <= 32; ray += 7) {
    ctx.moveTo(2, 0);
    ctx.quadraticCurveTo(-20, ray * .40, -61, ray);
  }
  ctx.stroke();
  ctx.restore();
  fill(ctx, form.dorsal, fin);
  fill(ctx, form.ventral, fin);

  const body = ctx.createLinearGradient(0, -18, 0, 17);
  body.addColorStop(0, form.shade);
  body.addColorStop(.4, form.mid);
  body.addColorStop(.72, form.top);
  body.addColorStop(1, form.shade);
  fill(ctx, form.body, body);
  ctx.strokeStyle = form.shade + '88';
  ctx.lineWidth = .8;
  ctx.stroke(form.body);
  ctx.save();
  ctx.clip(form.body);
  if (fish.speciesId === 'neon') fill(ctx, neonStripe, '#ff6573');
  ctx.strokeStyle = form.line + '70';
  ctx.lineWidth = .55;
  ctx.stroke(scalePattern);
  if (!fish.alleles?.every(allele => allele === 'b') && fish.speciesId === 'guppy') {
    ctx.fillStyle = '#a95f546e';
    for (const [x, y, radius] of [[-19, 3, 2], [-12, -2, 1.8], [-9, 5, 1.4], [2, 4, 1.5], [8, -1, 1.4]]) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (fish.alleles?.every(allele => allele === 'b')) {
    ctx.strokeStyle = form.shade + '73';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    for (let x = -13; x <= 13; x += 9) {
      ctx.moveTo(x, -13);
      ctx.lineTo(x - 3, 12);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = form.line + 'b8';
  ctx.lineWidth = fish.speciesId === 'neon' ? 2.3 : 1;
  ctx.beginPath();
  ctx.moveTo(-28, -.5);
  ctx.quadraticCurveTo(0, -7, 29, -4);
  ctx.stroke();
  ctx.restore();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = form.shade + 'a8';
  ctx.lineWidth = 1;
  ctx.stroke(gill);
  fill(ctx, pectoral, form.fin + '9a');
  eye(ctx, 32, -4);
  ctx.restore();
}
