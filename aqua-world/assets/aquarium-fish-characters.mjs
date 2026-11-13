const SIZE = 256;
const HEIGHT = 168;
export const CHARACTER_ASPECT = HEIGHT / SIZE;

const colors = {
  guppy: {
    outline: '#63364f', shadow: '#dc7951', base: '#ffb85d', light: '#ffe6a4',
    belly: '#fff1bc', blush: '#f48877', fin: '#ee775d', finLight: '#ffca88', accent: '#b64c59',
  },
  neon: {
    outline: '#274c72', shadow: '#4389ad', base: '#72c9d9', light: '#c8f4e7',
    belly: '#dbf7e8', blush: '#f3a6a9', fin: '#76bacd', finLight: '#b0e5e2', accent: '#236a93',
  },
  betta: {
    outline: '#44336b', shadow: '#7e63bc', base: '#a48be1', light: '#e3d3ff',
    belly: '#f5ddff', blush: '#eaa3db', fin: '#a177d0', finLight: '#f3bce2', accent: '#704eab',
  },
};

const shapes = {
  guppy: {
    tail: 'M106 86 C85 81 68 63 46 43 C35 34 21 36 18 46 C16 54 22 64 16 69 C10 77 13 87 19 93 C23 99 16 108 21 117 C27 132 45 125 61 113 C79 100 93 95 106 95Z',
    top: 'M115 72 C119 55 135 42 150 43 C159 44 163 56 160 67Z',
    bottom: 'M122 98 C130 124 143 126 151 113 L157 105Z',
    body: 'M87 85 C108 75 120 63 145 61 C174 56 199 64 213 77 C225 88 217 99 203 106 C180 117 144 116 120 108 C105 103 98 95 87 93Z',
    pectoral: 'M171 92 C165 90 151 96 146 107 C155 111 168 106 173 98Z',
    eye: [196, 81, 11.9], cheek: [200, 97], smile: 'M208 95 Q214 98 218 93',
    rays: [[28,49],[23,66],[22,85],[27,103],[36,118]],
  },
  neon: {
    tail: 'M91 82 C77 79 56 69 46 58 C37 56 34 59 38 67 L53 85 L40 106 C36 113 41 117 48 113 C63 101 76 94 91 94Z',
    top: 'M110 76 C115 63 124 51 132 52 C140 57 146 66 150 71Z',
    bottom: 'M110 100 C118 114 126 119 132 112 L136 102Z',
    body: 'M77 85 C99 79 116 71 141 69 C173 66 195 69 209 79 C218 86 218 94 207 101 C184 113 158 112 133 107 C112 104 96 97 77 93Z',
    pectoral: 'M170 92 Q151 95 149 103 Q165 106 173 97Z',
    eye: [196, 83, 10.3], cheek: [200, 96], smile: 'M207 94 Q213 96 216 91',
    rays: [[44,64],[51,74],[57,86],[51,99],[44,109]],
  },
  betta: {
    tail: 'M122 84 C105 78 100 56 74 42 C60 36 62 21 45 24 C34 25 36 35 26 36 C15 38 17 51 24 58 C11 65 12 79 23 85 C11 92 14 104 26 109 C19 119 25 133 37 133 C38 147 53 150 64 137 C76 127 83 134 95 116 C107 104 110 98 123 96Z',
    top: 'M117 76 C108 63 104 50 108 44 C113 37 120 40 125 38 C138 27 153 38 158 49 C164 57 163 64 167 70Z',
    bottom: 'M109 96 C112 112 102 120 110 127 C118 133 126 123 136 129 C151 138 164 124 176 121 C188 119 194 106 190 99Z',
    body: 'M102 87 C120 78 126 66 147 61 C175 54 199 63 214 75 C226 84 226 97 214 104 C197 115 168 114 148 110 C124 107 118 99 102 96Z',
    pectoral: 'M175 93 C165 91 151 101 150 109 C163 116 170 107 177 100Z',
    eye: [201, 81, 11.8], cheek: [204, 97], smile: 'M213 95 Q220 99 223 93',
    rays: [[47,32],[33,43],[27,59],[22,76],[25,94],[31,111],[42,128],[54,139]],
  },
};

for (const shape of Object.values(shapes)) {
  for (const part of ['tail', 'top', 'bottom', 'body', 'pectoral', 'smile']) {
    shape[part] = new Path2D(shape[part]);
  }
}

function ellipse(ctx, x, y, rx, ry, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function line(ctx, path, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke(path);
}

function paintedShape(ctx, path, paint, outline, width = 2.8) {
  ctx.fillStyle = paint;
  ctx.fill(path);
  if (outline) line(ctx, path, outline, width);
}

function gradient(ctx, x, y, endX, endY, stops) {
  const fill = ctx.createLinearGradient(x, y, endX, endY);
  for (const [offset, color] of stops) fill.addColorStop(offset, color);
  return fill;
}

function drawFins(ctx, name, palette, shape) {
  const fin = gradient(ctx, 26, 42, 151, 113, [[0, palette.finLight], [.51, palette.fin], [1, palette.shadow]]);
  paintedShape(ctx, shape.top, fin, palette.outline, 2.3);
  paintedShape(ctx, shape.bottom, fin, palette.outline, 2.3);
  paintedShape(ctx, shape.tail, fin, palette.outline, 2.9);
  ctx.save();
  ctx.clip(shape.tail);
  for (const [index, [x, y]] of shape.rays.entries()) {
    const root = name === 'betta' ? 121 : 103;
    ctx.beginPath();
    ctx.moveTo(root, 89);
    ctx.quadraticCurveTo(x + 25, y + (89 - y) * .14, x - 1, y);
    ctx.strokeStyle = palette.outline + (index % 2 ? '27' : '39');
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }
  if (name === 'guppy') {
    const spots = [[35,52,4],[46,62,3],[29,73,4],[46,84,5],[62,79,3],[38,100,4],[50,109,3],[62,97,4]];
    for (const [x, y, radius] of spots) ellipse(ctx, x, y, radius, radius * .69, palette.accent + 'a1');
  }
  ctx.restore();
}

function drawMarkings(ctx, name, palette) {
  if (name === 'neon') {
    paintedShape(ctx, neonRed, '#f78291');
    paintedShape(ctx, neonLine, '#a5fff3');
    paintedShape(ctx, neonLight, '#f2fff4');
    return;
  }
  const flecks = name === 'guppy' ? [[119,87],[132,80],[145,90],[155,80],[161,93]] : [[120,87],[131,80],[141,88],[153,75],[157,88]];
  for (const [index, [x, y]] of flecks.entries()) {
    ellipse(ctx, x, y, index % 2 ? 2.5 : 3.1, 1.55, palette.accent + '65');
  }
}

const neonRed = new Path2D('M76 91 C101 93 123 93 150 90 Q162 92 172 98 Q130 108 78 98Z');
const neonLine = new Path2D('M74 85 Q114 86 142 78 Q170 73 191 78 L189 83 Q167 80 142 84 Q105 94 74 90Z');
const neonLight = new Path2D('M93 86 Q133 80 145 78 Q165 75 180 77 Q158 77 139 82 Q115 87 93 87Z');
const belly = new Path2D('M98 98 Q135 101 160 96 Q192 93 214 98 Q215 114 166 122 L114 113Z');
const sheen = new Path2D('M131 76 Q156 62 178 69 Q180 72 173 73 Q151 72 135 80 Q128 80 131 76Z');
const gill = new Path2D('M180 83 Q176 91 180 97');

function drawEye(ctx, x, y, radius, palette) {
  ellipse(ctx, x, y, radius, radius * 1.04, palette.outline);
  ellipse(ctx, x + .1, y - .35, radius * .84, radius * .89, '#fffbee');
  ellipse(ctx, x + radius * .20, y + .70, radius * .60, radius * .72, palette.accent);
  ellipse(ctx, x + radius * .24, y + .10, radius * .47, radius * .59, '#202740');
  ellipse(ctx, x + radius * .10, y - radius * .24, radius * .20, radius * .21, '#fffdf7');
  ellipse(ctx, x + radius * .43, y + radius * .28, radius * .094, radius * .105, '#fffdf7');
}

function drawFish(ctx, name) {
  const palette = colors[name];
  const shape = shapes[name];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawFins(ctx, name, palette, shape);
  const paint = gradient(ctx, 143, 58, 152, 114, [[0, palette.light], [.47, palette.base], [1, palette.shadow]]);
  paintedShape(ctx, shape.body, paint, palette.outline, 3.15);
  ctx.save();
  ctx.clip(shape.body);
  paintedShape(ctx, belly, palette.belly);
  paintedShape(ctx, sheen, '#fff8e07a');
  drawMarkings(ctx, name, palette);
  ellipse(ctx, ...shape.cheek, 5.8, 2.85, palette.blush + 'ca');
  ctx.restore();
  line(ctx, gill, palette.outline + '77', 1.25);
  paintedShape(ctx, shape.pectoral, palette.finLight, palette.outline + 'a6', 1.7);
  drawEye(ctx, ...shape.eye, palette);
  line(ctx, shape.smile, palette.outline, 1.7);
}

const pictures = new Map();
export function characterArtwork(speciesId) {
  if (!pictures.has(speciesId)) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE * 2;
    canvas.height = HEIGHT * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    drawFish(ctx, speciesId);
    pictures.set(speciesId, canvas);
  }
  return pictures.get(speciesId);
}

export function drawCharacterPreview(canvas, speciesId) {
  const source = characterArtwork(speciesId);
  const ctx = canvas.getContext('2d');
  const scale = Math.min((canvas.width - 10) / source.width, (canvas.height - 4) / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
}

export function drawCanvasCharacter(ctx, fish, point, heading, seconds, selected) {
  const source = characterArtwork(fish.speciesId);
  const size = { guppy: 127, neon: 104, betta: 143 }[fish.speciesId];
  ctx.save();
  ctx.translate(point.x, point.y);
  if (selected) {
    ellipse(ctx, 0, size * .22, size * .17, 2.5, '#fff2bc');
  }
  ctx.scale(heading * (.98 + Math.sin(seconds * 8.4 + point.y) * .025), 1);
  ctx.rotate(Math.sin(seconds * 2.1 + point.y) * .027);
  ctx.drawImage(source, -size * .5, -size * CHARACTER_ASPECT * .5, size, size * CHARACTER_ASPECT);
  ctx.restore();
}
