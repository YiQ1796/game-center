import * as T from '../vendor/three-0.160.1.module.js';

const forms = {
  guppy: { size: 1.18, depth: .13, halfHeight: .17, length: .49, tailLength: .45, tailHeight: .26,
    top: '#bc642d', flank: '#fa9a4e', belly: '#f3d79b', fin: '#ed5029', tips: '#ffb13f' },
  neon: { size: .80, depth: .10, halfHeight: .13, length: .49, tailLength: .27, tailHeight: .15,
    top: '#386b84', flank: '#6bc8ce', belly: '#cde5db', fin: '#78adba', tips: '#a0cfd6' },
  betta: { size: 1.31, depth: .15, halfHeight: .20, length: .49, tailLength: .55, tailHeight: .32,
    top: '#424781', flank: '#6c70db', belly: '#adabd9', fin: '#743baf', tips: '#c781e9' },
};

const eyeball = new T.SphereGeometry(.045, 12, 8);
const pupil = new T.SphereGeometry(.029, 10, 7);
const glint = new T.SphereGeometry(.010, 6, 4);
const irisMaterial = new T.MeshStandardMaterial({ color: '#edbd63', roughness: .37 });
const pupilMaterial = new T.MeshStandardMaterial({ color: '#0b1425', roughness: .25 });
const glintMaterial = new T.MeshBasicMaterial({ color: '#ffffff' });
const bodyMaterial = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: .34, metalness: .11, clearcoat: .34 });
bodyMaterial.onBeforeCompile = shader => {
  shader.vertexShader = 'varying vec3 fishSurface;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n fishSurface = position;');
  shader.fragmentShader = 'varying vec3 fishSurface;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n float lattice = sin(fishSurface.x*194.0+sin(fishSurface.y*118.0)*1.45) * sin(fishSurface.y*151.0); diffuseColor.rgb *= .91 + .13 * smoothstep(-.8,.8,lattice);');
};
const profiles = new Map();
const finModels = new Map();

function fishBody(speciesId, style, striped, glow) {
  const positions = [], colors = [], indices = [];
  const rounds = 32, sides = 24;
  const top = new T.Color(style.top), flank = new T.Color(style.flank), belly = new T.Color(style.belly);
  const red = new T.Color('#ff4f49'), electric = new T.Color('#58effb'), apricot = new T.Color('#9a533c');
  const finish = new T.Color();
  for (let ring = 0; ring <= rounds; ring++) {
    const p = ring / rounds;
    const shape = Math.max(.01, Math.sin(Math.PI * p) ** .59) * (.68 + p * .42);
    const x = (p * 2 - 1) * style.length;
    for (let side = 0; side <= sides; side++) {
      const angle = side / sides * Math.PI * 2;
      const vertical = Math.cos(angle);
      positions.push(x, vertical * shape * style.halfHeight, Math.sin(angle) * shape * style.depth);
      finish.copy(flank).lerp(vertical >= 0 ? top : belly, Math.abs(vertical) ** 1.4 * .86);
      const metallicSpeck = .92 + .10 * Math.sin(ring * 2.54 + side * 6.3) * Math.cos(ring * 1.7 + side * 2.4);
      finish.multiplyScalar(metallicSpeck);
      if (speciesId === 'neon') {
        if (vertical > .05 && vertical < .68 && p > .08 && p < .91) finish.lerp(electric, .92);
        if (vertical < -.13 && vertical > -.75 && p > .03 && p < .60) finish.lerp(red, .94);
      }
      if (speciesId === 'guppy' && ring > 5 && ring < 23 && Math.abs(vertical) < .72
        && Math.sin(ring * 2.72 + side * 4.3) > .78) finish.lerp(apricot, .57);
      if (striped && Math.abs(vertical) < .81 && Math.sin(p * 42 + vertical * .80) > .64) finish.lerp(top, .76);
      if (glow) finish.lerp(electric, .33 + .15 * Math.sin(ring * .2));
      colors.push(finish.r, finish.g, finish.b);
      if (ring < rounds && side < sides) {
        const current = ring * (sides + 1) + side;
        const next = current + sides + 1;
        indices.push(current, next + 1, next, current, current + 1, next + 1);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function fin(style, silhouette, opacity = .76) {
  const positions = [], colors = [], indices = [], ribs = [];
  const root = new T.Color(style.fin), edge = new T.Color(style.tips), paint = new T.Color();
  const rings = 10, rays = 18;
  const point = (length, ray) => {
    const [x,y,z] = silhouette(ray);
    return [x * length, y * length, z * length + Math.sin(length * Math.PI) * y * .14];
  };
  for (let row = 0; row <= rings; row++) {
    const radius = Math.max(.003, row / rings);
    for (let ray = 0; ray <= rays; ray++) {
      positions.push(...point(radius, ray / rays));
      paint.copy(root).lerp(edge, radius * .78).multiplyScalar(.79 + .16 * Math.sin(ray * 3) + .22 * radius);
      colors.push(paint.r, paint.g, paint.b);
      if (row < rings && ray < rays) {
        const a = row * (rays + 1) + ray, b = a + rays + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  for (let ray = 1; ray < rays; ray += 2) {
    for (let step = 0; step < 5; step++) {
      ribs.push(...point(.07 + step * .17, ray / rays), ...point(.24 + step * .17, ray / rays));
    }
  }
  const surface = new T.BufferGeometry();
  surface.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  surface.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  surface.setIndex(indices);
  surface.computeVertexNormals();
  const lines = new T.BufferGeometry();
  lines.setAttribute('position', new T.Float32BufferAttribute(ribs, 3));
  const group = new T.Group();
  group.add(new T.Mesh(surface, new T.MeshPhysicalMaterial({
    vertexColors: true, side: T.DoubleSide, transparent: true, opacity, depthWrite: false,
    roughness: .42, clearcoat: .26, forceSinglePass: true,
  })));
  group.add(new T.LineSegments(lines, new T.LineBasicMaterial({
    color: style.tips, transparent: true, opacity: .28, depthWrite: false,
  })));
  return group;
}

function buildFins(style, speciesId) {
  const tail = fin(style, ray => {
    const edge = (ray - .5) * 2;
    const fork = speciesId === 'neon' ? .12 * (1 - Math.abs(edge)) : 0;
    return [-style.tailLength * (1 - .27 * edge * edge) + fork,
      edge * style.tailHeight * (1 - Math.abs(edge) * .09),
      Math.sin(ray * 18.5) * .025];
  });
  tail.position.set(-style.length + .027, 0, 0);
  const dorsal = fin(style, ray => [-.31 + ray * .43, .03 + Math.sin(ray * Math.PI) * (speciesId === 'betta' ? .31 : .19), .018]);
  dorsal.position.set(.01, style.halfHeight * .67, 0);
  const anal = fin(style, ray => [-.38 + ray * .46, -.04 - Math.sin(ray * Math.PI) * (speciesId === 'betta' ? .29 : .10), -.014], .70);
  anal.position.set(-.02, -style.halfHeight * .65, 0);
  const fins = new T.Group();
  fins.add(tail, dorsal, anal);
  for (const sign of [-1, 1]) {
    const paddle = fin(style, ray => [-.24 + ray * .25, -.04 - Math.sin(ray * Math.PI) * .14, sign * (.031 + .13 * Math.sin(ray * Math.PI))], .56);
    paddle.position.set(.14, -.028, sign * style.depth * .64);
    fins.add(paddle);
  }
  return { fins };
}

export function makeFish(fish) {
  const style = forms[fish.speciesId];
  const striped = fish.alleles?.every(allele => allele === 'b') ?? false;
  const key = fish.speciesId + ':' + striped + ':' + Boolean(fish.glow);
  if (!profiles.has(key)) profiles.set(key, fishBody(fish.speciesId, style, striped, fish.glow));
  const root = new T.Group();
  root.scale.setScalar(style.size);
  const body = new T.Mesh(profiles.get(key), bodyMaterial);
  body.userData.fishId = fish.id;
  root.add(body);
  for (const sign of [-1, 1]) {
    const eye = new T.Mesh(eyeball, irisMaterial);
    const black = new T.Mesh(pupil, pupilMaterial);
    const light = new T.Mesh(glint, glintMaterial);
    eye.position.set(.31, .046, sign * style.depth * .71);
    black.position.copy(eye.position).add(new T.Vector3(.013,.002,sign * .030));
    light.position.copy(black.position).add(new T.Vector3(.006,.014,sign * .022));
    root.add(eye, black, light);
  }
  if (!finModels.has(fish.speciesId)) finModels.set(fish.speciesId, buildFins(style, fish.speciesId).fins);
  const fins = finModels.get(fish.speciesId).clone(true);
  const [tail, , , ...pectorals] = fins.children;
  root.add(fins);
  return { root, body, tail, pectorals };
}

let preview;

export function drawFishPreview(canvas, speciesId) {
  if (preview === undefined) {
    try {
      const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setSize(240, 108, false);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.setClearColor('#000000', 0);
      const scene = new T.Scene();
      const camera = new T.OrthographicCamera(-1.35, 1.35, .61, -.61, .05, 10);
      camera.position.set(-.20, .03, 4);
      camera.lookAt(-.20, .03, 0);
      const lamp = new T.DirectionalLight('#fff4dd', 2.6);
      lamp.position.set(2.2, 3, 3.5);
      scene.add(lamp, new T.HemisphereLight('#d6f3ff', '#a283a3', 1.6));
      preview = { renderer, scene, camera, models: new Map() };
    } catch {
      preview = null;
    }
  }
  if (!preview) return false;
  const { renderer, scene, camera, models } = preview;
  if (!models.has(speciesId)) {
    const { root } = makeFish({ speciesId });
    root.rotation.y = -.18;
    models.set(speciesId, root);
  }
  const root = models.get(speciesId);
  scene.add(root);
  renderer.render(scene, camera);
  canvas.getContext('2d').drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
  scene.remove(root);
  return true;
}
