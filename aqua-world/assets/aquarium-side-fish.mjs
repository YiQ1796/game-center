import * as T from '../vendor/three-0.160.1.module.js';
import { drawFishModel } from './aquarium-fish-daylight.mjs';
import { fishWidth } from './aquarium-swim.mjs';

const species = ['guppy', 'neon', 'betta'];
const artwork = new Map();
const meshes = new Map();

function fallback(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 116;
  drawFishModel(canvas.getContext('2d'), { speciesId: name }, { x: 130, y: 58 }, 1, 0, false);
  return canvas;
}

for (const name of species) {
  const image = fallback(name);
  const texture = new T.CanvasTexture(image);
  texture.anisotropy = 2;
  artwork.set(name, { image, texture });
}
export const readyProfiles = Promise.all(species.map(async name => {
  const image = new Image();
  image.src = new URL('./fish-profiles/' + name + '.webp', import.meta.url).href;
  try {
    await image.decode();
    const plate = artwork.get(name);
    plate.image = image;
    plate.texture.image = image;
    plate.texture.needsUpdate = true;
    return true;
  } catch {
    return false;
  }
}));

function geometry(name) {
  if (!meshes.has(name)) {
    const width = fishWidth(name) * 1.20;
    const height = width * { guppy: 104 / 163, neon: 139 / 303, betta: 141 / 274 }[name];
    meshes.set(name, new T.PlaneGeometry(width, height, 16, 8));
  }
  return meshes.get(name);
}

export function makeSideFish(fish) {
  const material = new T.ShaderMaterial({
    side: T.DoubleSide, transparent: true, depthWrite: false, forceSinglePass: true,
    uniforms: {
      profile: { value: artwork.get(fish.speciesId).texture },
      clock: { value: 0 }, bite: { value: 0 }, depthTint: { value: 0 },
      glow: { value: fish.glow ? 1 : 0 },
      striped: { value: fish.alleles?.every(allele => allele === 'b') ? 1 : 0 },
    },
    vertexShader: `
      uniform float clock;
      uniform float bite;
      varying vec2 photoUV;
      void main() {
        photoUV = uv;
        vec3 p = position;
        float tail = 1.0 - smoothstep(0.05, 0.52, uv.x);
        p.x += tail * sin(clock*10.5 + uv.x*5.0) * .027;
        p.y += tail * sin(clock*8.2 + uv.x*5.0) * .027;
        p.y += smoothstep(.65,.97,uv.x)*sin(bite*3.14159)*.026;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D profile;
      uniform float depthTint;
      uniform float glow;
      uniform float striped;
      varying vec2 photoUV;
      void main() {
        vec4 pixel = texture2D(profile, photoUV);
        if (pixel.a < .08) discard;
        vec3 color = mix(pixel.rgb, pixel.rgb * vec3(.56,.82,.95) + vec3(.022,.085,.128), depthTint);
        float body = smoothstep(.41,.57,photoUV.x) * (1.0-smoothstep(.78,.94,photoUV.x));
        float bands = smoothstep(.21,.85,sin(photoUV.x*75.0+photoUV.y*4.0)) * body;
        color *= 1.0 - .18*striped*bands;
        color += vec3(.02,.10,.11) * glow * body;
        gl_FragColor = vec4(color, pixel.a);
      }
    `,
  });
  const root = new T.Group();
  const body = new T.Mesh(geometry(fish.speciesId), material);
  body.userData.fishId = fish.id;
  root.add(body);
  return { root, body, material };
}

export function drawSidePreview(canvas, speciesId) {
  const ctx = canvas.getContext('2d');
  const draw = () => {
    const source = artwork.get(speciesId).image;
    const fit = Math.min((canvas.width - 18) / source.width, (canvas.height - 8) / source.height);
    const width = source.width * fit, height = source.height * fit;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  };
  draw();
  void readyProfiles.then(draw);
}
