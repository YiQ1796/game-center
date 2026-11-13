import { EQUIPMENT, equipmentOf, targetTemperature } from './aquarium-facilities.mjs?v=080';

function rounded(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function disc(ctx, x, y, radius, fill) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function equipmentArtwork(kind, level, temperature) {
  const canvas = document.createElement('canvas');
  canvas.width = 152;
  canvas.height = 224;
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  const shell = '#29445b';
  const rim = '#19364d';
  const highlight = '#64909b';
  const upgrade = level > 1;
  if (kind === 'filter') {
    // The outlet and intake are visible above and below the rounded filter body.
    rounded(ctx, 23, 102, 25, 58, 8, shell, rim);
    rounded(ctx, 16, 146, 39, 43, 9, '#456478', rim);
    for (let x = 23; x < 50; x += 7) rounded(ctx, x, 154, 3, 27, 1.5, rim);
    rounded(ctx, 76, 17, 26, 34, 6, shell, rim);
    rounded(ctx, 85, 14, 41, 24, 7, '#3d6c7e', rim);
    rounded(ctx, 117, 14, 12, 25, 4, '#86d1ce', rim);
    rounded(ctx, 14, 43, 91, 89, 15, shell, rim);
    rounded(ctx, 22, 52, 75, 32, 9, '#3e6a80');
    rounded(ctx, 28, 58, 56, 4, 2, highlight);
    for (let y = 94; y < 117; y += 8) rounded(ctx, 28, y, 39, 3, 1.5, '#7095a4');
    disc(ctx, 87, 105, 6, upgrade ? '#ffd678' : '#94efdc');
    if (upgrade) rounded(ctx, 78, 60, 14, 15, 4, '#e6b66c');
  } else {
    ctx.beginPath();
    ctx.moveTo(69, 52);
    ctx.bezierCurveTo(70, 21, 91, 33, 91, 2);
    ctx.strokeStyle = rim;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.stroke();
    rounded(ctx, 39, 64, 60, 151, 17, '#447087', rim);
    rounded(ctx, 47, 86, 44, 112, 12, '#6a9cab');
    rounded(ctx, 53, 91, 31, 100, 10, '#243b5d');
    rounded(ctx, 59, 102, 5, 78, 2, '#6594a6');
    for (let y = 112; y < 178; y += 11) {
      rounded(ctx, 65, y, 13, 5, 2.5, upgrade ? '#ffc277' : '#ef9c80');
    }
    rounded(ctx, 37, 38, 64, 51, 11, shell, rim);
    rounded(ctx, 44, 48, 49, 28, 6, '#172f47');
    ctx.fillStyle = '#9ff3db';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(temperature) + '°', 69, 68);
  }
  return canvas;
}

export function installEquipmentLayer(stage) {
  const layer = document.createElement('div');
  layer.className = 'tank-equipment';
  stage.append(layer);
  let current = '';
  return tank => {
    const levels = equipmentOf(tank);
    const target = targetTemperature(tank);
    const key = [tank.id, levels.filter, levels.heater, target].join('/');
    if (current === key) return;
    current = key;
    layer.replaceChildren();
    for (const [kind, label] of Object.entries(EQUIPMENT)) {
      const level = levels[kind];
      if (!level) continue;
      const control = document.createElement('button');
      control.type = 'button';
      control.className = 'tank-device';
      control.dataset.device = kind;
      control.dataset.level = String(level);
      control.title = label.name + ' Lv.' + level + (kind === 'heater' ? ' · ' + target + '°C' : ' · 運轉中');
      control.setAttribute('aria-label', control.title);
      control.setAttribute('aria-haspopup', 'dialog');
      control.append(equipmentArtwork(kind, level, target));
      if (kind === 'filter') {
        for (let index = 0; index < (level === 2 ? 5 : 3); index++) {
          const bubble = document.createElement('span');
          bubble.className = 'tank-filter-bubble';
          bubble.style.setProperty('--bubble-delay', -index * .31 + 's');
          bubble.style.setProperty('--bubble-offset', index % 3 * 4 + 'px');
          control.append(bubble);
        }
      }
      control.addEventListener('pointerdown', event => event.stopPropagation());
      control.addEventListener('click', () => document.querySelector('[data-career="facilities"]').click());
      layer.append(control);
    }
  };
}
