import { HEIGHT, HIDDEN, WIDTH } from './engine.mjs?v=110';

const amber = ['#ffe9a0', '#ffcc64', '#ff914c', '#fff8da'];
const palettes = [
  ['#e9ffc7', '#f8eca0', '#a7debf'],
  ['#9decd7', '#efffdd', '#69d5c6'],
  ['#ffc078', '#fff1bb', '#ff9758'],
  amber
];

export class LineBurst {
  constructor(canvas, colors) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.colors = colors;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.bursts = [];
  }

  reset() {
    this.bursts.length = 0;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  add(event, now) {
    const rows = (event.cleared ?? []).filter(({ y }) => y >= HIDDEN && y < HIDDEN + HEIGHT);
    if (!rows.length) return;
    const intensity = Math.min(4, Math.max(event.lines, event.bombs, 1));
    const palette = palettes[intensity - 1];
    const span = this.reduced.matches ? 160 : [270, 340, 450, 620][intensity - 1];
    const unit = this.canvas.width / WIDTH;
    const particles = [];
    if (!this.reduced.matches) {
      for (const { y, cells, bomb } of rows) {
        for (let col = 0; col < WIDTH; col++) {
          for (let piece = 0; piece < (intensity >= 3 ? 3 : 2); piece++) {
            particles.push({
              x: (col + .25 + Math.random() * .5) * unit,
              y: (y - HIDDEN + .5) * unit,
              vx: (Math.random() - .5) * (110 + intensity * 55),
              vy: (Math.random() - .65) * (105 + intensity * 70),
              size: (3 + Math.random() * (3 + intensity * 2)) * unit / 40,
              color: piece === 0 && !bomb ? this.colors[cells[col]] : palette[(col + piece) % palette.length],
              spin: (Math.random() - .5) * 12
            });
          }
        }
      }
    }
    this.bursts.push({ now, span, unit, rows, intensity, palette, particles });
    if (this.bursts.length > 5) this.bursts.shift();
    this.paint(now);
  }

  paint(now) {
    if (!this.bursts.length) return;
    const { context: ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.bursts = this.bursts.filter(burst => now - burst.now < burst.span);
    for (const burst of this.bursts) {
      const { span, unit, rows, intensity, palette, particles } = burst;
      const age = Math.max(0, now - burst.now);
      const progress = age / span;
      const decay = (1 - progress) ** 2;
      const seconds = age / 1000;
      for (const { y } of rows) {
        const row = (y - HIDDEN) * unit;
        const glow = ctx.createLinearGradient(0, row, 0, row + unit);
        glow.addColorStop(0, '#fff8cb00');
        glow.addColorStop(.5, palette[0]);
        glow.addColorStop(1, '#fff8cb00');
        ctx.globalAlpha = decay * (this.reduced.matches ? .46 : .76);
        ctx.fillStyle = glow;
        ctx.fillRect(0, row, canvas.width, unit);
        if (intensity >= 2 && !this.reduced.matches) {
          ctx.globalAlpha = decay * .8;
          ctx.strokeStyle = palette[1];
          ctx.lineWidth = intensity;
          ctx.beginPath();
          ctx.ellipse(canvas.width / 2, row + unit / 2, 5 + progress * canvas.width * .57,
            2 + progress * unit * .78, 0, 0, 2 * Math.PI);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = Math.min(1, (1 - progress) * 1.45);
      for (const p of particles) {
        ctx.save();
        ctx.translate(p.x + seconds * p.vx, p.y + seconds * p.vy + 180 * seconds ** 2);
        ctx.rotate(p.spin * seconds);
        ctx.fillStyle = p.color;
        ctx.fillRect(0, 0, p.size, p.size);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
}
