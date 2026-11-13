import * as T from '../vendor/three-0.160.1.module.js';
import { characterArtwork, CHARACTER_ASPECT } from './aquarium-fish-characters.mjs?v=090';
import { fishWidth } from './aquarium-swim.mjs?v=090';

const textures = new Map();
const meshes = new Map();

function characterTexture(speciesId) {
  if (!textures.has(speciesId)) {
    const texture = new T.CanvasTexture(characterArtwork(speciesId));
    texture.anisotropy = 2;
    textures.set(speciesId, texture);
  }
  return textures.get(speciesId);
}

function geometry(name) {
  if (!meshes.has(name)) {
    const width = fishWidth(name) * 1.33;
    const height = width * CHARACTER_ASPECT;
    meshes.set(name, new T.PlaneGeometry(width, height, 16, 8));
  }
  return meshes.get(name);
}

export function makeCharacterFish(fish) {
  const material = new T.ShaderMaterial({
    side: T.DoubleSide, transparent: true, depthWrite: false, forceSinglePass: true,
    uniforms: {
      profile: { value: characterTexture(fish.speciesId) },
      clock: { value: 0 }, bite: { value: 0 }, depthTint: { value: 0 },
      glow: { value: fish.glow ? 1 : 0 },
      striped: { value: fish.alleles?.every(allele => allele === 'b') ? 1 : 0 },
    },
    vertexShader: `
      uniform float clock;
      uniform float bite;
      varying vec2 characterUV;
      void main() {
        characterUV = uv;
        vec3 p = position;
        float tail = 1.0 - smoothstep(0.07, 0.48, uv.x);
        p.x += tail * sin(clock*10.5 + uv.x*5.0) * .041;
        p.y += tail * sin(clock*8.2 + uv.x*5.0) * .031;
        p.y += smoothstep(.65,.97,uv.x)*sin(bite*3.14159)*.026;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D profile;
      uniform float depthTint;
      uniform float glow;
      uniform float striped;
      varying vec2 characterUV;
      void main() {
        vec4 pixel = texture2D(profile, characterUV);
        if (pixel.a < .08) discard;
        vec3 color = mix(pixel.rgb, pixel.rgb * vec3(.56,.82,.95) + vec3(.022,.085,.128), depthTint);
        float body = smoothstep(.41,.57,characterUV.x) * (1.0-smoothstep(.78,.94,characterUV.x));
        float bands = smoothstep(.21,.85,sin(characterUV.x*75.0+characterUV.y*4.0)) * body;
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
