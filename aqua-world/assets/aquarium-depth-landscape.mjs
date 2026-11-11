import * as T from '../vendor/three-0.160.1.module.js';

export const WATERLINE = 3.08;
export const FLOOR = -2.28;

function random(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function grit(base, sand = false) {
  const material = new T.MeshStandardMaterial({ color: base, roughness: .86 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 grain;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n grain = position;');
    shader.fragmentShader = `varying vec3 grain;
      float gritNoise(vec3 cell) { return fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float roughNoise(vec3 p) {
        vec3 cell = floor(p), k = fract(p);
        k = k*k*(3.0-2.0*k);
        return mix(mix(mix(gritNoise(cell),gritNoise(cell+vec3(1,0,0)),k.x),mix(gritNoise(cell+vec3(0,1,0)),gritNoise(cell+vec3(1,1,0)),k.x),k.y),
          mix(mix(gritNoise(cell+vec3(0,0,1)),gritNoise(cell+vec3(1,0,1)),k.x),mix(gritNoise(cell+vec3(0,1,1)),gritNoise(cell+vec3(1,1,1)),k.x),k.y),k.z);
      }
    ` + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float freckles = roughNoise(grain * ${sand ? '83.0' : '27.0'});
      float stains = roughNoise(grain * ${sand ? '2.4' : '4.2'});
      float striation = roughNoise(grain * vec3(4.0, 21.0, 5.0) + stains * 1.2);
      diffuseColor.rgb *= ${sand ? '0.83 + 0.24*stains + 0.10*freckles' : '0.37 + 0.37*stains + 0.35*striation + 0.25*freckles'};
      ${sand ? 'float streak = abs(sin(grain.x*6.8 + grain.y*4.0 + sin(grain.x*3.3-grain.y*2.4))); diffuseColor.rgb += vec3(0.09, 0.12, 0.11) * pow(1.0 - streak, 7.0);' : ''}
    `);
  };
  material.customProgramCacheKey = () => sand ? 'sand' : 'rock';
  return material;
}

const leafMaterial = new T.MeshStandardMaterial({ vertexColors: true, side: T.DoubleSide, roughness: .53 });
leafMaterial.onBeforeCompile = shader => {
  shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
    '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * .31;');
};
const stoneMaterials = [grit('#748d9c'), grit('#829993'), grit('#667887')];
const sand = grit('#f3dfb6', true);
const stemMaterials = new Map();

function softRock(seed, flat = false) {
  const geometry = new T.SphereGeometry(1, 56, 36);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index);
    const ripple = Math.sin(x * 7 + z * 5 + seed) * Math.cos(y * 9 - z * 4) * .13;
    const chips = Math.sin((x + y) * 16 + seed) * Math.sin(z * 12 - y * 9) * .045;
    const depth = .94 + ripple + chips + .11 * Math.cos(y * 4 + x * 3);
    positions.setXYZ(index, x * depth + Math.max(y, 0) * .18, flat ? Math.min(.73, y * depth) : y * depth, z * depth);
  }
  geometry.computeVertexNormals();
  return geometry;
}

const stones = [softRock(1), softRock(9, true), softRock(14)];

function rock(root, x, y, z, width, height, depth, angle, style) {
  const stone = new T.Mesh(stones[style % stones.length], stoneMaterials[style % stoneMaterials.length]);
  stone.position.set(x, y, z);
  stone.scale.set(width, height, depth);
  stone.rotation.set(.10, angle, -.11);
  stone.castShadow = true;
  stone.receiveShadow = true;
  root.add(stone);
  return stone;
}

function leafStrip(position, colors, root, length, width, tilt, angle, mainColor) {
  const front = new T.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const lateral = new T.Vector3(-front.z, 0, front.x);
  const apex = new T.Color();
  const point = (progress, edge) => {
    const edgeWidth = Math.sin(Math.PI * progress) ** .8 * width * edge;
    return root.clone()
      .addScaledVector(front, length * progress * tilt + Math.sin(progress * Math.PI) * length * .23)
      .addScaledVector(lateral, edgeWidth)
      .add(new T.Vector3(0, length * progress * (1.03 - progress * .36) - Math.abs(edgeWidth) * .21, 0));
  };
  const put = (progress, edge) => {
    const p = point(progress, edge);
    position.push(p.x, p.y, p.z);
    apex.copy(mainColor).multiplyScalar(.58 + progress * .32 + (edge === 0 ? .24 : .06));
    colors.push(apex.r, apex.g, apex.b);
  };
  for (let segment = 0; segment < 6; segment++) {
    const a = segment / 6, b = (segment + 1) / 6;
    for (const side of [-1, 1]) {
      put(a, 0); put(b, 0); put(b, side);
      put(a, 0); put(b, side); put(a, side);
    }
  }
}

export function makePlant(seed, palette, grassy = false) {
  const draw = random(seed);
  const positions = [], colors = [];
  const group = new T.Group();
  const main = new T.Color(palette);
  for (let stem = 0; stem < (grassy ? 13 : 7); stem++) {
    const x = (draw() - .5) * .48, z = (draw() - .5) * .45;
    const height = .68 + draw() * .86;
    const direction = draw() * Math.PI * 2;
    if (grassy) {
      leafStrip(positions, colors, new T.Vector3(x, 0, z), height * 1.18, .025 + draw() * .043, .32 + draw() * .55, direction, main);
      continue;
    }
    const drift = (draw() - .5) * .44;
    const curve = new T.QuadraticBezierCurve3(new T.Vector3(x, 0, z), new T.Vector3(x - drift * .4, height * .58, z), new T.Vector3(x + drift, height, z + .15));
    if (!stemMaterials.has(palette)) stemMaterials.set(palette, new T.MeshStandardMaterial({ color: main.clone().multiplyScalar(.72), roughness: .85 }));
    group.add(new T.Mesh(new T.TubeGeometry(curve, 5, .012, 4), stemMaterials.get(palette)));
    for (let pair = 0; pair < 5; pair++) {
      const fraction = .17 + pair * .156;
      const root = curve.getPoint(fraction);
      for (const side of [0, Math.PI]) {
        leafStrip(positions, colors, root, (.24 + draw() * .18) * (1.24 - fraction * .50),
          .063 + draw() * .054, .54 + draw() * .50, direction + side + pair * .48, main);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  group.add(new T.Mesh(geometry, leafMaterial));
  return group;
}

function coral(seed, color) {
  const draw = random(seed);
  const stems = [];
  for (let index = 0; index < 15; index++) {
    const angle = draw() * Math.PI * 2;
    const radius = .12 + draw() * .55, height = .14 + draw() * .55;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    const path = new T.QuadraticBezierCurve3(new T.Vector3(x*.12,0,z*.12), new T.Vector3(x*.6,height*.62,z*.6), new T.Vector3(x,height,z));
    stems.push([path, height, x, z]);
  }
  const group = new T.Group();
  const body = new T.MeshStandardMaterial({ color, roughness: .64, emissive: color, emissiveIntensity: .15 });
  const tip = new T.MeshStandardMaterial({ color: new T.Color(color).lerp(new T.Color('#ffe4b4'), .38), roughness: .71 });
  const end = new T.SphereGeometry(.042, 7, 5);
  for (const [path, height, x, z] of stems) {
    group.add(new T.Mesh(new T.TubeGeometry(path, 6, .035, 5), body));
    const cap = new T.Mesh(end, tip);
    cap.position.set(x,height,z);
    group.add(cap);
  }
  return group;
}

function pebbleBed(root) {
  const draw = random(1926);
  const geometry = new T.IcosahedronGeometry(1, 1);
  const pebbles = new T.InstancedMesh(geometry, new T.MeshStandardMaterial({ color: '#ffffff', roughness: .94 }), 285);
  const stamp = new T.Object3D();
  const colors = ['#c7ad8b','#c5bfab','#889a8d','#e4caa0','#a99678','#f1dcad'].map(value => new T.Color(value));
  for (let index = 0; index < pebbles.count; index++) {
    const size = .026 + draw() ** 2.9 * .17;
    stamp.position.set((draw() - .5) * 16, FLOOR + .01, (draw() - .45) * 11);
    stamp.scale.set(size * 1.4, size * .54, size);
    stamp.rotation.y = draw() * 6.28;
    stamp.updateMatrix();
    pebbles.setMatrixAt(index, stamp.matrix);
    pebbles.setColorAt(index, colors[Math.floor(draw() * colors.length)]);
  }
  root.add(pebbles);
}

export function createLandscape(tankId) {
  const root = new T.Group();
  const plants = [];
  const bed = new T.Mesh(new T.PlaneGeometry(24, 17), sand);
  bed.rotation.x = -Math.PI / 2;
  bed.position.set(0, FLOOR, -1.2);
  bed.receiveShadow = true;
  root.add(bed);
  pebbleBed(root);
  const river = tankId === 'river';
  const layers = river ? [
    [-1.45,-.98,-6.40,1.61,1.94,1.53,.45,2],[-2.58,-1.22,-6.01,1.17,1.44,1.04,.31,1],
    [2.10,-1.54,-6.08,1.42,.90,1.33,.91,0],[-5.0,-1.26,-3.05,1.42,1.18,1.23,.3,0],[-3.36,-.90,-3.22,1.34,1.62,1.15,.8,1],
    [-1.81,-1.28,-3.66,1.17,1.20,1.36,.52,2],[-3.24,-.30,-3.30,1.49,.38,1.09,.9,2],
    [3.57,-1.17,-2.15,1.37,1.25,1.45,.2,1],[4.49,-.69,-3.15,1.07,1.52,1.25,1.8,0],
    [5.74,-1.37,-1.03,1.37,.96,1.13,-.7,2],[-5.54,-1.85,1.35,1.38,.50,.96,1.4,2],
    [5.12,-1.82,2.17,1.32,.62,1.18,-.3,1],[-2.1,-1.88,-.19,1.02,.46,.79,.9,0],
    [2.73,-1.88,.65,1.01,.49,.89,.7,2],
  ] : [
    [-4.84,-1.37,-2.76,1.32,1.20,1.33,.2,0],[-3.53,-.99,-3.35,1.15,1.51,1.10,.5,1],
    [-2.6,-1.53,-2.24,1.15,.76,.83,.1,2],[3.87,-1.41,-3.65,1.34,1.07,1.22,1.1,2],
    [4.96,-1.60,-2.47,1.15,.91,.94,-.7,1],[-5.34,-1.97,1.59,1.12,.48,1.02,.3,2],
    [5.02,-1.89,1.77,1.13,.59,1.22,.2,0],[1.84,-1.94,1.71,.73,.43,.61,.7,1],
  ];
  for (const point of layers) rock(root, ...point);
  const beds = river ? [
    [-5.7,-1.9,-2.4,'#fc8425',2.17],[-4.82,-1.87,-3.72,'#ff9d39',2.16],[-3.9,-1.7,-3.75,'#ed507f',1.68],
    [-1.18,-2.25,-5.75,'#74c885',1.42,true],[.02,-2.25,-5.31,'#f0a83f',1.22],[1.1,-2.25,-5.62,'#5fa9ab',1.24],
    [-1.8,-1.85,-4.12,'#9bd892',2.25],[-2.8,-1.29,-2.67,'#7ac28a',1.15,true],[-1.47,-2.24,-1.88,'#e66b54',1.18],
    [1.63,-2.25,-3.36,'#83cbbc',2.12],[2.79,-1.67,-2.75,'#d66092',1.32],[4.58,-1.20,-3.1,'#ff9934',2.07],
    [5.86,-1.86,-1.17,'#ff7933',1.70],[4.65,-2.23,-.36,'#d1bb60',1.16,true],[-5.18,-2.16,.34,'#81b75e',1.33],
    [-4.55,-2.24,1.67,'#56a477',.94,true],[5.01,-2.15,1.55,'#56cdb1',1.06],[3.77,-2.23,2.66,'#7fbe69',.84,true],
  ] : [
    [-5.32,-2.2,-1.6,'#5dac85',1.78],[-4.32,-1.58,-3.1,'#ce9260',1.82],[-3.26,-1.89,-3.75,'#79c396',1.46],
    [3.54,-1.8,-3.06,'#8ec7a5',1.70],[4.62,-1.72,-2.9,'#c59166',1.92],[5.57,-2.15,-.5,'#64a795',1.4],
    [-4.82,-2.24,2.02,'#72bb83',.99,true],[4.70,-2.24,1.92,'#7cbe78',1.15,true],
  ];
  for (const [index, [x,y,z,color,scale,grassy]] of beds.entries()) {
    const plant = makePlant(77 + index * 69, color, grassy);
    plant.position.set(x,y,z);
    plant.scale.setScalar(scale);
    plant.rotation.y = index * .85;
    root.add(plant);
    plants.push(plant);
  }
  if (river) {
    for (const [index, [x,y,z,color,scale]] of [
      [-4.14,-1.63,-.28,'#f0658d',1.18],[-2.59,-2.14,1.02,'#ea4386',1.32],
      [-.65,-2.23,.19,'#fb8153',1.12],[1.97,-2.16,1.45,'#b269cf',1.08],[5.32,-1.74,.73,'#ffa737',1.29],
      [-4.99,-2.05,2.27,'#e17bc7',1.07],
    ].entries()) {
      const piece = coral(942 + index * 11, color);
      piece.position.set(x,y,z);
      piece.scale.setScalar(scale);
      root.add(piece);
    }
  }
  return { root, plants };
}

const decorationModels = new Map();

export function makeDecoration(kind) {
  if (!decorationModels.has(kind)) decorationModels.set(kind, buildDecoration(kind));
  const model = decorationModels.get(kind).clone(true);
  model.userData.kind = kind;
  return model;
}

function buildDecoration(kind) {
  if (kind === 'grass') {
    const group = makePlant(496, '#66ae79', true);
    group.scale.setScalar(.86);
    return group;
  }
  const root = new T.Group();
  if (kind === 'stone') {
    rock(root, .06, .21, 0, .40, .27, .28, .2, 0);
    rock(root, -.31, .14, .14, .26, .17, .25, -.25, 1);
  } else {
    const material = grit('#936d50');
    for (const [a,b,c] of [
      [[-.46,.05,.18],[-.16,.24,.12],[.42,.36,-.17]],
      [[-.13,.16,.08],[.06,.38,.02],[.22,.71,-.06]],
      [[.13,.22,.07],[.31,.25,.07],[.58,.52,.05]],
    ]) {
      const path = new T.QuadraticBezierCurve3(new T.Vector3(...a), new T.Vector3(...b), new T.Vector3(...c));
      root.add(new T.Mesh(new T.TubeGeometry(path, 10, .069, 7), material));
    }
  }
  return root;
}
