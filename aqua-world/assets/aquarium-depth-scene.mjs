import * as T from '../vendor/three-0.160.1.module.js';
import { createLandscape, makeDecoration, WATERLINE, FLOOR } from './aquarium-depth-landscape.mjs';
import { makeFish } from './aquarium-depth-fish.mjs';
import { AquariumScene as DaylightScene } from './aquarium-daylight-scene.mjs';

const waterVertex = `
  varying vec2 coordinate;
  varying vec3 positionInWorld;
  void main() {
    coordinate = uv;
    positionInWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const waveCode = `
  float waves(vec2 p, float time) {
    return sin(p.x*3.9 + p.y*5.8 + time) + .52*sin(p.x*10.7 - p.y*4.1 - time*1.17)
      + .26*sin(p.x*18.7 + p.y*15.1 + time*1.52) + .18*sin(p.x*36.2 - p.y*25.1 - time);
  }
`;
const waterFragment = `
  uniform float clock;
  uniform vec3 lowColor;
  uniform vec3 highColor;
  varying vec3 positionInWorld;
  ${waveCode}
  void main() {
    vec2 p = positionInWorld.xy;
    float level = clamp((p.y + 2.65) / 5.7, 0.0, 1.0);
    vec3 water = mix(lowColor, highColor, pow(level, 1.46));
    float glow = exp(-0.12 * length((p - vec2(2.7,2.7)) * vec2(1.1, 1.67)));
    float shine = exp(-1.08 * abs((p.x - 2.7) + (2.65 - p.y)*.36)) * glow;
    float shafts = .58 + .21 * sin(p.x*2.74 - p.y*1.21 + clock*.19)
      + .19 * sin(p.x*5.08 + p.y*2.8 - clock*.32);
    water += vec3(.043,.159,.231) * shine * shafts;
    float beam = max(0.0, 1.0 - abs((p.x + .95) + (p.y-2.25)*.46) * .36);
    water += vec3(.012,.058,.075) * beam * level;
    water += .004*waves(p*.7, clock*.25);
    gl_FragColor = vec4(water, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const surfaceFragment = `
  uniform float clock;
  varying vec3 positionInWorld;
  ${waveCode}
  void main() {
    vec2 p = positionInWorld.xz;
    float wave = waves(p * vec2(.31,.46), clock * .71);
    float trace = pow(1.0-abs(sin(wave * 2.15 + sin(p.y*3.15 - clock*.67))), 4.1);
    float sparkle = pow(max(0.0, wave * .45), 4.1);
    vec3 color = vec3(.042,.166,.268) + vec3(.080,.28,.41)*trace + vec3(.36,.49,.54)*sparkle;
    float edge = smoothstep(-6.75,-3.55,p.y);
    gl_FragColor = vec4(color, edge);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function buildWater(scene) {
  const clock = { value: 0 };
  const background = new T.Mesh(new T.PlaneGeometry(28, 15), new T.ShaderMaterial({
    vertexShader: waterVertex, fragmentShader: waterFragment, uniforms: {
      clock, lowColor: { value: new T.Color('#102c45') }, highColor: { value: new T.Color('#3086b1') },
    },
  }));
  background.position.set(0, 0, -9.62);
  scene.add(background);
  const surface = new T.Mesh(new T.PlaneGeometry(26, 17), new T.ShaderMaterial({
    vertexShader: waterVertex, fragmentShader: surfaceFragment, side: T.DoubleSide, uniforms: { clock },
    transparent: true, depthWrite: false, forceSinglePass: true,
  }));
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(0, WATERLINE, -2.15);
  scene.add(surface);
  return { clock, background };
}

function bubbles() {
  const count = 54;
  const positions = new Float32Array(count * 3);
  const diameters = new Float32Array(count);
  for (let index = 0; index < count; index++) diameters[index] = .053 + (index % 9) * .011;
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('diameter', new T.BufferAttribute(diameters, 1));
  const material = new T.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `
      attribute float diameter;
      void main() {
        vec4 point = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * point;
        gl_PointSize = clamp(diameter * 840.0 / -point.z, 2.0, 12.0);
      }
    `,
    fragmentShader: `
      void main() {
        vec2 p = gl_PointCoord - .5;
        float r = length(p);
        float edge = smoothstep(.29,.39,r) * (1.0-smoothstep(.43,.49,r));
        float spark = pow(max(0.0, 1.0 - length(p-vec2(-.16,-.17))*6.5), 2.1);
        gl_FragColor = vec4(.75, .93, 1.0, edge*.42 + spark*.68);
      }
    `,
  });
  const points = new T.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

function swimSeed(id) {
  let value = 0;
  for (const char of id) value = (Math.imul(value, 31) + char.codePointAt(0)) >>> 0;
  return value;
}

function addLights(scene) {
  scene.add(new T.HemisphereLight('#def3ff', '#c5a885', 1.63));
  const sunlight = new T.DirectionalLight('#fff1cf', 2.30);
  sunlight.position.set(-2.1, 6.3, 4.2);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  Object.assign(sunlight.shadow.camera, { left: -8, right: 8, top: 5.6, bottom: -5.6, near: .5, far: 20 });
  sunlight.shadow.bias = -.00025;
  sunlight.shadow.normalBias = .04;
  scene.add(sunlight);
  const rim = new T.DirectionalLight('#83bfff', .85);
  rim.position.set(4, 1.5, -3);
  scene.add(rim);
}

export class AquariumScene {
  landscapes = new Map();
  fish = new Map();
  decor = new Map();
  lastFrame = 0;
  feedTime = -10_000;
  ray = new T.Raycaster();
  screen = new T.Vector2();
  projection = new T.Vector3();
  decorPlane = new T.Plane(new T.Vector3(0, 0, 1), 0);
  floorPlane = new T.Plane(new T.Vector3(0, 1, 0), -FLOOR - .025);
  drawPoint = new T.Vector3();

  constructor(parent, stage) {
    try {
      this.renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      stage.dataset.renderEngine = 'canvas';
      return new DaylightScene(parent, stage);
    }
    this.stage = stage;
    stage.dataset.renderEngine = 'webgl';
    this.renderer.setSize(1152, 648, false);
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    parent.append(this.renderer.domElement);

    this.scene = new T.Scene();
    this.scene.fog = new T.FogExp2('#236b98', .034);
    this.camera = new T.PerspectiveCamera(33, 16 / 9, .08, 45);
    this.camera.position.set(0, .70, 11.35);
    this.camera.lookAt(0, -.13, 0);
    this.camera.updateMatrixWorld();
    addLights(this.scene);
    this.water = buildWater(this.scene);
    this.bubbles = bubbles();
    this.scene.add(this.bubbles);

    const border = new T.RingGeometry(.46, .48, 42);
    this.selection = new T.Mesh(border, new T.MeshBasicMaterial({
      color: '#f9e4a6', transparent: true, opacity: .85, depthWrite: false, side: T.DoubleSide,
    }));
    this.selection.visible = false;
    this.scene.add(this.selection);
    this.pellets = new T.InstancedMesh(new T.SphereGeometry(.027, 7, 5), new T.MeshStandardMaterial({ color: '#d19c59' }), 9);
    this.stamp = new T.Object3D();
    this.pellets.frustumCulled = false;
    this.scene.add(this.pellets);
    this.renderer.setAnimationLoop(time => this.draw(time));
  }

  setView(tank, fishId, lowPower, decorId) {
    if (this.tank?.id !== tank.id) {
      if (this.landscape) this.scene.remove(this.landscape.root);
      const key = tank.id === 'river' ? 'river' : 'studio';
      if (!this.landscapes.has(key)) this.landscapes.set(key, createLandscape(key));
      this.landscape = this.landscapes.get(key);
      this.scene.add(this.landscape.root);
      this.water.background.material.uniforms.highColor.value.set(key === 'river' ? '#3184b7' : '#4a96b6');
      this.renderer.shadowMap.needsUpdate = true;
      this.preview = undefined;
    }
    if (lowPower !== this.lowPower) {
      this.renderer.setSize(lowPower ? 768 : 1152, lowPower ? 432 : 648, false);
    }
    this.tank = tank;
    this.selectedFish = fishId;
    this.selectedDecor = decorId;
    this.lowPower = lowPower;
    this.syncFish();
    this.syncDecor();
  }

  syncFish() {
    const living = this.tank.fish.filter(item => item.diedAt === null);
    const next = new Set(living.map(item => item.id));
    for (const [id, model] of this.fish) {
      if (next.has(id)) continue;
      this.scene.remove(model.root);
      this.fish.delete(id);
    }
    for (const item of living) {
      if (this.fish.has(item.id)) continue;
      const model = makeFish(item);
      this.fish.set(item.id, { ...model, seed: swimSeed(item.id) });
      this.scene.add(model.root);
    }
  }

  syncDecor() {
    const next = new Map(this.tank.decorations.map(item => [item.id, item.kind]));
    for (const [id, model] of this.decor) {
      if (next.get(id) === model.userData.kind) continue;
      this.scene.remove(model);
      this.decor.delete(id);
    }
    for (const item of this.tank.decorations) {
      if (this.decor.has(item.id)) continue;
      const model = makeDecoration(item.kind);
      this.decor.set(item.id, model);
      this.scene.add(model);
    }
  }

  setPreview(item) { this.preview = item; }

  feed(id) {
    this.feedTime = this.lastFrame;
    this.feedId = id;
  }

  pointer(x, y) {
    this.screen.set(x * 2 - 1, 1 - y * 2);
    this.ray.setFromCamera(this.screen, this.camera);
  }

  fishAt(x, y) {
    this.pointer(x, y);
    const hit = this.ray.intersectObjects([...this.fish.values()].map(fish => fish.body), false)[0];
    if (hit) return hit.object.userData.fishId;
    let best = .082;
    let id;
    for (const [key, fish] of this.fish) {
      this.projection.copy(fish.root.position).project(this.camera);
      const distance = Math.hypot((this.projection.x - this.screen.x) * 1.65, this.projection.y - this.screen.y);
      if (distance < best) { best = distance; id = key; }
    }
    return id;
  }

  decorAt(x, y) {
    this.pointer(x, y);
    const hit = this.ray.intersectObjects([...this.decor.values()], true)[0];
    if (hit) {
      let target = hit.object;
      while (target.parent !== this.scene) target = target.parent;
      for (const [id, root] of this.decor) if (root === target) return this.tank.decorations.find(item => item.id === id);
    }
    return this.tank?.decorations.findLast(item => Math.abs(item.x - x) < .06 && y < item.y + .03 && y > item.y - .15);
  }

  moveDecor() {
    for (const item of this.tank.decorations) {
      const model = this.decor.get(item.id);
      const point = this.preview?.id === item.id ? this.preview : item;
      this.pointer(point.x, point.y);
      this.ray.ray.intersectPlane(this.decorPlane, this.drawPoint);
      if (this.drawPoint.y < FLOOR) this.ray.ray.intersectPlane(this.floorPlane, this.drawPoint);
      model.position.copy(this.drawPoint);
      model.visible = true;
      model.rotation.z = item.kind === 'grass' ? Math.sin(this.lastFrame * .0014 + point.x * 10) * .031 : 0;
      if (item.id === this.selectedDecor) {
        this.selection.position.copy(model.position).add(new T.Vector3(0,.24,.10));
        this.selection.scale.setScalar(1.13);
        this.selection.visible = true;
      }
    }
  }

  moveFish(seconds, attraction) {
    for (const [id, model] of this.fish) {
      const { root, tail, pectorals, seed } = model;
      const phase = seconds * (.34 + (seed % 13) * .014) + seed % 601 / 97;
      const radius = 3.25 + seed % 8 * .22;
      const offset = ((seed >>> 5) % 7 - 3) * .32;
      const x = Math.sin(phase) * radius;
      const y = offset + Math.sin(phase * 1.34 + seed % 9) * .26 + .29;
      const z = Math.cos(phase) * 1.33 + .25;
      const feed = !this.feedId || this.feedId === id ? attraction : 0;
      root.position.set(x * (1 - feed) + .27 * feed, y * (1 - feed) + 1.43 * feed, z);
      root.rotation.y = Math.atan2(Math.sin(phase) * 1.33, Math.cos(phase) * radius);
      root.rotation.z = Math.cos(phase * 1.34) * .05;
      tail.rotation.y = Math.sin(seconds * 7.9 + seed % 43) * .31;
      pectorals.forEach((fin, index) => { fin.rotation.x = Math.cos(seconds * 6.2 + index) * .24; });
      if (id === this.selectedFish && !this.selectedDecor) {
        this.selection.position.copy(root.position).add(new T.Vector3(0,0,.30));
        this.selection.scale.setScalar(1.16);
        this.selection.visible = true;
      }
    }
  }

  draw(time) {
    if (!this.tank || time - this.lastFrame < (this.lowPower ? 75 : 32)) return;
    this.lastFrame = time;
    const seconds = time / 1_000;
    this.water.clock.value = this.lowPower ? 0 : seconds;
    this.selection.visible = false;
    this.selection.quaternion.copy(this.camera.quaternion);
    this.moveDecor();
    this.landscape.plants.forEach((plant, index) => {
      plant.rotation.z = this.lowPower ? 0 : Math.sin(seconds * .98 + index * .75) * .022;
    });

    const progress = (time - this.feedTime) / 2_200;
    this.pellets.visible = progress >= 0 && progress < 1;
    if (this.pellets.visible) {
      for (let index = 0; index < this.pellets.count; index++) {
        this.stamp.position.set((index - 4) * .11 + .24, WATERLINE - .14 - progress * 1.72 + (index % 3) * .08, .63);
        this.stamp.updateMatrix();
        this.pellets.setMatrixAt(index, this.stamp.matrix);
      }
      this.pellets.instanceMatrix.needsUpdate = true;
    }
    this.moveFish(seconds, this.pellets.visible ? Math.sin(Math.PI * progress) * .42 : 0);
    const moving = this.bubbles.geometry.attributes.position;
    const count = this.lowPower ? 18 : moving.count;
    this.bubbles.geometry.setDrawRange(0, count);
    for (let index = 0; index < count; index++) {
      const depth = ((index * .123 + seconds * (.105 + index % 5 * .009)) % 1);
      const stream = index % 5;
      const x = stream === 0 ? -4.87 : stream === 4 ? 4.33 : 2.02;
      moving.setXYZ(index, x + Math.sin(seconds * 1.22 + index * 2.44) * (.08 + depth * .21),
        FLOOR + .26 + depth * 4.82, -.65 + (index % 7) * .17);
    }
    moving.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
    this.stage.dataset.scene = this.tank.id === 'river' ? 'river' : 'studio';
  }
}
