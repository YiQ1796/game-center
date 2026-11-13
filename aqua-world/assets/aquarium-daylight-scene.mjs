import { drawCanvasCharacter } from './aquarium-fish-characters.mjs';
import { createTankBackdrop, drawDecoration, drawWaterMotion, WIDTH, HEIGHT } from './aquarium-scenery.mjs';

const sizes = {
  guppy: { width: 72, height: 30 },
  neon: { width: 61, height: 22 },
  betta: { width: 86, height: 46 },
};

function fishSeed(id) {
  let hash = 0;
  for (const character of id) hash = (Math.imul(hash, 31) + character.codePointAt(0)) >>> 0;
  return hash;
}

function swim(fish, seconds, feeding) {
  const seed = fishSeed(fish.id);
  const phase = seconds * (.24 + (seed % 11) * .014) + (seed % 719) / 110;
  const lane = .25 + ((seed >>> 8) % 29) / 100;
  const x = WIDTH * (.50 + (.28 + (seed % 6) * .012) * Math.sin(phase));
  const y = HEIGHT * lane + Math.sin(phase * 1.46 + (seed % 7)) * 26;
  return {
    x: x + (WIDTH * .51 - x) * feeding,
    y: y + (HEIGHT * .21 - y) * feeding,
    heading: Math.cos(phase) < 0 ? -1 : 1,
  };
}

export class AquariumScene {
  tank;
  texture;
  selectedFish = '';
  selectedDecor = '';
  previewDecor;
  lowPower = false;
  lastFrame = 0;
  feedTime = -10_000;
  feedFishId;
  fishPositions = [];
  backdrops = new Map();

  constructor(parent, stage) {
    this.stage = stage;
    this.stage.dataset.fishArt = 'illustrated';
    const view = this;
    this.game = new window.Phaser.Game({
      type: window.Phaser.CANVAS, width: WIDTH, height: HEIGHT, parent,
      transparent: true, banner: false, audio: { noAudio: true },
      scene: {
        create() {
          view.texture = this.textures.createCanvas('aquarium-view', WIDTH, HEIGHT);
          if (!view.texture) throw new Error('無法啟動魚缸畫面。');
          this.add.image(WIDTH / 2, HEIGHT / 2, 'aquarium-view');
        },
        update(time) { view.draw(time); },
      },
    });
  }

  setView(tank, fishId, lowPower, decorId) {
    if (this.tank?.id !== tank.id) this.fishPositions = [];
    this.tank = tank;
    this.selectedFish = fishId;
    this.lowPower = lowPower;
    this.selectedDecor = decorId;
  }

  setPreview(item) { this.previewDecor = item; }

  feed(fishId) {
    this.feedTime = this.lastFrame;
    this.feedFishId = fishId;
  }

  fishAt(x, y) {
    for (let index = this.fishPositions.length - 1; index >= 0; index--) {
      const { id, speciesId, point } = this.fishPositions[index];
      const size = sizes[speciesId];
      const dx = point.x - point.heading * 15 - x * WIDTH;
      if (Math.hypot(dx / size.width, (point.y - y * HEIGHT) / size.height) <= 1) return id;
    }
  }

  decorAt(x, y) {
    return this.tank?.decorations.findLast(item =>
      Math.abs(item.x - x) < .063 && y < item.y + .025 && y > item.y - (item.kind === 'grass' ? .20 : .11));
  }

  draw(time) {
    if (!this.tank || !this.texture || time - this.lastFrame < (this.lowPower ? 66 : 28)) return;
    this.lastFrame = time;
    const seconds = time / 1_000;
    const { id, fish, decorations } = this.tank;
    const backdropId = id === 'river' ? 'river' : 'studio';
    if (!this.backdrops.has(backdropId)) this.backdrops.set(backdropId, createTankBackdrop(backdropId));
    const ctx = this.texture.getContext();
    ctx.drawImage(this.backdrops.get(backdropId), 0, 0);
    drawWaterMotion(ctx, seconds, this.lowPower);

    for (const item of decorations) {
      const shown = item.id === this.previewDecor?.id ? this.previewDecor : item;
      drawDecoration(ctx, shown, backdropId, this.lowPower ? 0 : seconds, item.id === this.selectedDecor);
    }

    const feedProgress = (time - this.feedTime) / 2_200;
    const feeding = feedProgress >= 0 && feedProgress < 1;
    if (feeding) {
      ctx.fillStyle = '#b57939';
      for (let index = 0; index < 9; index++) {
        ctx.beginPath();
        ctx.arc(403 + (index * 19) % 166, 55 + feedProgress * 132 + index * 4, 2 + index % 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    this.fishPositions = fish.filter(item => item.diedAt === null).map(item => {
      const attract = feeding && (!this.feedFishId || this.feedFishId === item.id) ? Math.sin(Math.PI * feedProgress) * .45 : 0;
      return { id: item.id, speciesId: item.speciesId, item, point: swim(item, seconds, attract) };
    }).sort((left, right) => left.point.y - right.point.y);
    for (const { item, point } of this.fishPositions) {
      drawCanvasCharacter(ctx, item, point, point.heading, seconds, item.id === this.selectedFish);
    }
    this.texture.refresh();
    if (this.stage.dataset.scene !== backdropId) this.stage.dataset.scene = backdropId;
  }
}
