/* ¡Chucuchú! – toy 3D world: lanes, trains, power-up crates, decorations, camera framing, projected labels */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';

const GAP = 3.6;
const PITCH = 0.8;
const TRACK_Y = 0.52;
const SKY = 0xbde3ff;
const CITIES = ['Sevilla', 'Córdoba', 'Granada', 'Murcia', 'Valencia', 'Barcelona', 'Zaragoza', 'Pamplona', 'Bilbao', 'Santander', 'Oviedo', 'Santiago', 'Salamanca', 'Madrid', 'Toledo', 'Cáceres', 'Huelva', 'Cádiz', 'Málaga', 'Almería', 'Alicante', 'Tarragona', 'Girona', 'Lleida', 'Teruel', 'Cuenca', 'Segovia'];
const ITEM_COLORS = { turbo: 0xff8a3d, mitad: 0x3fa9f5, otra: 0x3fcf6e, semaforo: 0xffc531, robo: 0x4a4f66, cambio: 0x9b6bff, escudo: 0x2ed3c6 };
const CRATE_COLORS = ['#ff5fa2', '#ffc531', '#3fcf6e', '#3fa9f5', '#ff8a3d', '#9b6bff'];
const CONFETTI = [0xff5fa2, 0xffc531, 0x3fcf6e, 0x3fa9f5, 0xff8a3d, 0x9b6bff, 0xffffff];
const WHITE = new THREE.Color(0xffffff);
const GREY = new THREE.Color(0x9aa0b4);

const cache = new Map();
const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
const rbox = (w, h, d, r = 0.08) => memo(`r${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 2, r));
const cyl = (a, b, h, s = 18) => memo(`c${a}|${b}|${h}|${s}`, () => new THREE.CylinderGeometry(a, b, h, s));
const sph = (r, w = 18, h = 12) => memo(`s${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h));
const cone = (r, h, s = 16) => memo(`k${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
const box = (w, h, d) => memo(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0, ...o });
const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const laneZ = (i, n) => (i - (n - 1) / 2) * GAP;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const M = {
  navy: std(0x262c5e, { roughness: 0.5 }),
  dark: std(0x1b1f45, { roughness: 0.7 }),
  tire: std(0x23232c, { roughness: 0.6 }),
  gold: std(0xffc531, { roughness: 0.3 }),
  cream: std(0xfff3d6),
  white: std(0xffffff),
  glass: std(0x2f3c86, { roughness: 0.15 }),
  lamp: std(0xfff3b0, { emissive: 0xffe680, emissiveIntensity: 1.2 }),
  wood: std(0xe9b878, { roughness: 0.65 }),
  groove: std(0xb07a45, { roughness: 0.8 }),
  tick: std(0xffffff, { roughness: 0.6 }),
  coal: std(0x2a2a33, { roughness: 0.9 }),
  inst: std(0xffffff, { roughness: 0.55 }),
  instSoft: std(0xffffff, { roughness: 0.85 }),
  flame: std(0xffa53d, { emissive: 0xff7a1a, emissiveIntensity: 1.6, roughness: 0.4 }),
  shield: std(0x8fe6ff, { transparent: true, opacity: 0.3, depthWrite: false, emissive: 0x2ed3c6, emissiveIntensity: 0.35, roughness: 0.1 }),
  redOn: std(0xff4f6d, { emissive: 0xff2244, emissiveIntensity: 1.8 }),
  ambOff: std(0x6b5a2a),
  greenOff: std(0x2a5a3a),
  glow: new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.55, depthWrite: false }),
  flash: new THREE.MeshBasicMaterial({ color: 0xfff2a0 }),
  tracer: new THREE.MeshBasicMaterial({ color: 0xffe04a }),
  gun: std(0x3a3f63, { roughness: 0.35, metalness: 0.3 }),
};
const PINATA = [0xff5fa2, 0xffc531, 0x3fcf6e, 0x3fa9f5, 0xff8a3d, 0x9b6bff, 0x2ed3c6];
const SPIKES = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0.7, 0.7, 0], [-0.7, 0.7, 0]];

export function createWorld(canvas, labelsEl, frameEl) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 80, 200);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 600);
  const probe = new THREE.PerspectiveCamera(30, 1, 0.5, 600);

  scene.add(new THREE.HemisphereLight(0xfff4dc, 0x77b860, 1.1));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { near: 1, far: 220 });
  scene.add(sun, sun.target);
  let shadowSpan = 0;

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 700), std(0x95d66e, { roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(250, 0, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  const root = new THREE.Group();
  scene.add(root);
  const dummy = new THREE.Object3D();
  const tmpC = new THREE.Color();
  const v = new THREE.Vector3();

  const checkerTex = canvasTex(64, 256, (g, w, h) => {
    const s = 32;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      g.fillStyle = ((x + y) / s) % 2 ? '#262c5e' : '#ffffff';
      g.fillRect(x, y, s, s);
    }
  });
  const checkerMat = std(0xffffff, { map: checkerTex, roughness: 0.6 });
  const crateMats = [];
  const crateMat = k => {
    if (!crateMats[k]) {
      const tex = canvasTex(128, 128, g => {
        g.fillStyle = CRATE_COLORS[k];
        g.fillRect(0, 0, 128, 128);
        g.lineWidth = 9;
        g.strokeStyle = 'rgba(255,255,255,.9)';
        g.beginPath();
        g.roundRect(11, 11, 106, 106, 18);
        g.stroke();
        g.font = '86px "Lilita One", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.lineWidth = 14;
        g.strokeStyle = '#262c5e';
        g.strokeText('?', 64, 70);
        g.fillStyle = '#ffffff';
        g.fillText('?', 64, 70);
      });
      crateMats[k] = std(0xffffff, { map: tex, roughness: 0.35 });
    }
    return crateMats[k];
  };

  const SMOKE_N = 110;
  const smoke = new THREE.InstancedMesh(sph(0.34, 12, 8), std(0xffffff, { roughness: 0.95 }), SMOKE_N);
  smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  smoke.frustumCulled = false;
  const puffs = Array.from({ length: SMOKE_N }, (_, k) => {
    smoke.setColorAt(k, WHITE);
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    smoke.setMatrixAt(k, dummy.matrix);
    return { life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vz: 0, s: 1 };
  });
  let puffIdx = 0;
  scene.add(smoke);

  const CONF_N = 260;
  const confetti = new THREE.InstancedMesh(box(0.17, 0.17, 0.04), std(0xffffff, { roughness: 0.5 }), CONF_N);
  confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  confetti.frustumCulled = false;
  const bits = Array.from({ length: CONF_N }, (_, k) => {
    confetti.setColorAt(k, tmpC.set(CONFETTI[k % CONFETTI.length]));
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    confetti.setMatrixAt(k, dummy.matrix);
    return { life: 0, p: new THREE.Vector3(), vel: new THREE.Vector3(), r: new THREE.Euler(), rv: new THREE.Vector3() };
  });
  let bitIdx = 0;
  scene.add(confetti);

  const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.5), M.glow);
  glow.rotation.x = -Math.PI / 2;
  glow.visible = false;
  scene.add(glow);

  let owned = [];
  const own = m => (owned.push(m), m);
  let trains = [];
  let labels = [];
  let floats = [];
  let spinners = [];
  let n = 0;
  let len = 130;
  let backZ = 0;
  let frontZ = 0;
  let mode = 'title';
  let activeIdx = -1;
  let view = { x: 0, y: 0, w: 100, h: 100, W: 100, H: 100 };
  const cam = { x: 10, z: 0, d: 60, push: 0, snap: true };
  const tweens = [];
  let clock = 0;
  let dim = false;

  function tween(dur, fn) {
    return new Promise(res => tweens.push({ t: 0, dur, fn, res }));
  }

  function instanced(geo, mat, items, shadow = true) {
    if (!items.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach((it, k) => {
      dummy.position.set(it.p[0], it.p[1], it.p[2]);
      dummy.rotation.set(...(it.r || [0, 0, 0]));
      dummy.scale.set(...(it.s || [1, 1, 1]));
      dummy.updateMatrix();
      m.setMatrixAt(k, dummy.matrix);
      if (it.c !== undefined) m.setColorAt(k, tmpC.set(it.c));
    });
    m.castShadow = shadow;
    m.receiveShadow = true;
    root.add(m);
    return m;
  }

  function addLabel(cls, html, pos, train = null) {
    const el = document.createElement('div');
    el.className = `lbl3d ${cls}`;
    el.innerHTML = html;
    labelsEl.append(el);
    const L = { el, x: pos[0], y: pos[1], z: pos[2], train, vis: true };
    labels.push(L);
    return L;
  }

  function clear() {
    tweens.length = 0;
    [...root.children].forEach(c => {
      root.remove(c);
      if (c.isInstancedMesh) c.dispose();
    });
    owned.forEach(m => m.dispose());
    owned = [];
    labels.forEach(L => L.el.remove());
    floats.forEach(F => F.el.remove());
    labels = [];
    floats = [];
    spinners = [];
    trains = [];
    glow.visible = false;
  }

  function buildLanes(teams) {
    const beds = [], tracks = [], grooves = [], ticks = [], lines = [], checks = [], stops = [], studs = [];
    const bedLen = len + 9;
    teams.forEach((t, i) => {
      const z = laneZ(i, n);
      const col = new THREE.Color(t.color).lerp(WHITE, 0.6).getHex();
      beds.push({ p: [bedLen / 2 - 5.6, 0.18, z], c: col });
      tracks.push({ p: [(len + 7) / 2 - 4.8, 0.44, z] });
      grooves.push({ p: [(len + 7) / 2 - 4.8, 0.52, z - 0.34] }, { p: [(len + 7) / 2 - 4.8, 0.52, z + 0.34] });
      for (let x = 1; x <= len; x++) {
        const big = x % 5 === 0;
        ticks.push({ p: [x, 0.37, z + 0.95], s: [big ? 1.4 : 1, 1, big ? 1.6 : 1], c: big ? 0x262c5e : 0xffffff });
      }
      for (let x = 10; x <= len; x += 10) lines.push({ p: [x, 0.366, z] });
      checks.push({ p: [0.32, 0.367, z], r: [-Math.PI / 2, 0, 0] });
      for (const x of [-5.1, len + 2.7]) {
        stops.push({ p: [x, 0.82, z] });
        studs.push({ p: [x + (x < 0 ? 0.3 : -0.3), 0.86, z - 0.42], r: [0, 0, Math.PI / 2] }, { p: [x + (x < 0 ? 0.3 : -0.3), 0.86, z + 0.42], r: [0, 0, Math.PI / 2] });
      }
    });
    instanced(own(new RoundedBoxGeometry(bedLen, 0.36, 2.5, 2, 0.16)), M.inst, beds, false);
    instanced(own(new THREE.BoxGeometry(len + 7, 0.16, 1.32)), M.wood, tracks);
    instanced(own(new THREE.BoxGeometry(len + 7, 0.022, 0.18)), M.groove, grooves, false);
    instanced(box(0.08, 0.03, 0.36), M.tick, ticks, false);
    instanced(box(0.16, 0.012, 2.5), M.white, lines, false);
    instanced(new THREE.PlaneGeometry(0.64, 2.5), checkerMat, checks, false);
    instanced(rbox(0.5, 0.6, 1.5, 0.1), M.navy, stops);
    instanced(cyl(0.12, 0.12, 0.3, 12), M.gold, studs);
  }

  function buildDecor(teams) {
    const R = rng(n * 131 + len * 7 + 3);
    const trunks = [], crowns = [], cypress = [], bushes = [], flowers = [], hBody = [], hRoof = [];
    const sBody = [], sRoof = [], sDoor = [], poles = [], flags = [];
    const stationZ = backZ - 3.8;
    const greens = [0x46b85a, 0x3aa856, 0x5cc964, 0x2f9a58, 0x6fd16a];
    const pastel = [0xffe3b3, 0xffd1dc, 0xd7ecff, 0xe4ffd6, 0xf1e1ff, 0xfff1a8];
    const roofs = [0xe8704f, 0xd9603f, 0xf08a5d, 0x6c7ad9];
    for (let c = 0; c * 10 <= len; c++) {
      const x = c * 10;
      sBody.push({ p: [x, 0.75, stationZ], c: pastel[c % pastel.length] });
      sRoof.push({ p: [x, 2.0, stationZ], r: [0, Math.PI / 4, 0], s: [1, 1, 0.64], c: roofs[c % 2] });
      sDoor.push({ p: [x, 0.5, stationZ + 0.86] });
      poles.push({ p: [x + 1.9, 1.0, stationZ + 0.3] });
      flags.push({ p: [x + 2.22, 1.62, stationZ + 0.3], c: 0xe8394d }, { p: [x + 2.22, 1.48, stationZ + 0.3], s: [1, 1.2, 1], c: 0xffc531 }, { p: [x + 2.22, 1.34, stationZ + 0.3], c: 0xe8394d });
    }
    for (let x = -18; x < len + 26; x += 1.5 + R() * 2.4) {
      const z = backZ - 6 - R() * 11;
      const kind = R();
      if (kind < 0.42) {
        const s = 0.75 + R() * 0.6;
        trunks.push({ p: [x, 0.45 * s, z], s: [s, s, s] });
        crowns.push({ p: [x, 1.25 * s, z], s: [s, s * 0.95, s], c: greens[(R() * greens.length) | 0] });
      } else if (kind < 0.66) {
        const s = 0.8 + R() * 0.7;
        cypress.push({ p: [x, 1.2 * s, z], s: [s * 0.9, s, s * 0.9], c: 0x2f8a4e });
      } else if (kind < 0.8) {
        const s = 0.8 + R() * 0.4;
        hBody.push({ p: [x, 0.55 * s, z], s: [s, s, s], c: pastel[(R() * pastel.length) | 0] });
        hRoof.push({ p: [x, 1.45 * s, z], s: [s, s, s], r: [0, Math.PI / 4, 0], c: roofs[(R() * roofs.length) | 0] });
      } else {
        const s = 0.6 + R() * 0.6;
        bushes.push({ p: [x, 0.3 * s, z], s: [s * 1.3, s * 0.8, s], c: greens[(R() * greens.length) | 0] });
      }
    }
    for (let x = -18; x < len + 26; x += 0.9 + R() * 1.6) {
      const z = frontZ + 2.6 + R() * 6;
      if (R() < 0.55) {
        const s = 0.45 + R() * 0.45;
        bushes.push({ p: [x, 0.25 * s, z], s: [s * 1.3, s * 0.75, s], c: greens[(R() * greens.length) | 0] });
      } else {
        for (let k = 0; k < 3; k++) flowers.push({ p: [x + (R() - 0.5) * 0.8, 0.12, z + (R() - 0.5) * 0.8], c: CONFETTI[(R() * 6) | 0] });
      }
    }
    instanced(cyl(0.14, 0.18, 0.9, 8), own(std(0x9a6a3f, { roughness: 0.8 })), trunks);
    instanced(sph(0.8, 14, 10), M.inst, crowns);
    instanced(cone(0.5, 2.4, 10), M.inst, cypress);
    instanced(sph(0.5, 12, 8), M.instSoft, bushes);
    instanced(sph(0.11, 8, 6), M.inst, flowers, false);
    instanced(rbox(1.3, 1.1, 1.3, 0.08), M.inst, hBody);
    instanced(cone(1.15, 0.8, 4), M.inst, hRoof);
    instanced(rbox(3.0, 1.5, 1.7, 0.12), M.inst, sBody);
    instanced(cone(2.3, 1.0, 4), M.inst, sRoof);
    instanced(rbox(0.6, 1.0, 0.1, 0.04), M.navy, sDoor);
    instanced(cyl(0.05, 0.05, 2.0, 8), M.white, poles);
    instanced(box(0.6, 0.12, 0.03), M.inst, flags);
    for (let x = 18; x < len + 10; x += 28 + R() * 10) {
      const z = backZ - 9 - R() * 4;
      const mill = new THREE.Group();
      mill.position.set(x, 0, z);
      const bodyM = new THREE.Mesh(cyl(0.55, 0.85, 2.8, 14), M.white);
      bodyM.position.y = 1.4;
      bodyM.castShadow = true;
      const cap = new THREE.Mesh(cone(0.78, 1.0, 14), M.navy);
      cap.position.y = 3.3;
      cap.castShadow = true;
      const hub = new THREE.Group();
      hub.position.set(0, 2.6, 0.75);
      for (let k = 0; k < 2; k++) {
        const blade = new THREE.Mesh(box(0.28, 3.4, 0.05), M.cream);
        blade.rotation.z = k * Math.PI / 2;
        blade.castShadow = true;
        hub.add(blade);
      }
      const nub = new THREE.Mesh(sph(0.16), M.gold);
      hub.add(nub);
      mill.add(bodyM, cap, hub);
      root.add(mill);
      spinners.push({ o: hub, sp: 0.5 + R() * 0.5 });
    }
    for (let c = 0; c * 10 <= len; c++) {
      const name = CITIES[c % CITIES.length];
      addLabel('city', `<div><span>${name}</span><b>${c * 10}</b></div>`, [c * 10, 3.25, stationZ]);
    }
    addLabel('start', '<div>Salida</div>', [0.3, 0.6, frontZ + 1.9]);
  }

  function buildTrain(team, i) {
    const z = laneZ(i, n);
    const g = new THREE.Group();
    g.position.set(0, TRACK_Y, z);
    const body = new THREE.Group();
    g.add(body);
    const col = new THREE.Color(team.color);
    const cm = own(std(col));
    const cm2 = own(std(col.clone().lerp(WHITE, 0.32)));
    const put = (geo, m, x, y, zz = 0, rz = 0, parent = body) => {
      const o = new THREE.Mesh(geo, m);
      o.position.set(x, y, zz);
      o.rotation.z = rz;
      o.castShadow = true;
      parent.add(o);
      return o;
    };
    put(rbox(2.1, 0.28, 0.96), M.navy, -1.05, 0.46);
    put(cyl(0.42, 0.42, 1.25, 22), cm, -0.72, 0.98, 0, Math.PI / 2);
    put(cyl(0.45, 0.45, 0.1, 22), M.gold, -0.08, 0.98, 0, Math.PI / 2);
    put(sph(0.13), M.lamp, -0.14, 1.5);
    put(cyl(0.14, 0.17, 0.5, 14), M.navy, -0.42, 1.58);
    put(cyl(0.27, 0.15, 0.2, 14), M.navy, -0.42, 1.92);
    put(sph(0.2), M.gold, -0.98, 1.42);
    put(rbox(0.9, 1.0, 1.06, 0.12), cm, -1.62, 1.12);
    put(rbox(0.46, 0.36, 1.08, 0.06), M.glass, -1.58, 1.3);
    put(rbox(1.12, 0.14, 1.28, 0.06), M.cream, -1.62, 1.68);
    put(rbox(0.26, 0.22, 0.98, 0.06), M.gold, 0.04, 0.3);
    put(box(0.5, 0.08, 0.12), M.navy, -2.35, 0.42);
    put(rbox(1.7, 0.24, 0.94), M.navy, -3.4, 0.44);
    put(rbox(1.62, 0.56, 0.98, 0.1), cm2, -3.4, 0.86);
    put(rbox(1.36, 0.06, 0.74, 0.03), M.dark, -3.4, 1.13);
    const wheels = [];
    for (const [x, r] of [[-0.38, 0.26], [-0.98, 0.26], [-1.62, 0.34], [-2.9, 0.24], [-3.9, 0.24]]) {
      for (const s of [-1, 1]) {
        const w = new THREE.Group();
        w.position.set(x, r, s * 0.54);
        body.add(w);
        const tire = new THREE.Mesh(cyl(r, r, 0.14, 20), M.tire);
        tire.rotation.x = Math.PI / 2;
        tire.castShadow = true;
        w.add(tire);
        if (s > 0) {
          const bar = new THREE.Mesh(box(r * 1.5, 0.08, 0.17), M.gold);
          w.add(bar);
        }
        wheels.push({ w, r });
      }
    }
    const cargo = [-3.96, -3.58, -3.2, -2.82].map(x => {
      const c = put(rbox(0.34, 0.34, 0.34, 0.07), own(std(0xffffff)), x, 1.32);
      c.visible = false;
      return c;
    });
    const gun = new THREE.Group();
    gun.position.set(-1.62, 1.78, 0);
    gun.visible = false;
    body.add(gun);
    put(cyl(0.16, 0.22, 0.16, 14), M.navy, 0, 0.06, 0, 0, gun);
    const yaw = new THREE.Group();
    yaw.position.y = 0.3;
    gun.add(yaw);
    put(rbox(0.36, 0.3, 0.56, 0.06), M.gun, 0, 0, 0.05, 0, yaw);
    put(rbox(0.12, 0.2, 0.26, 0.04), cm, 0, 0.2, 0.12, 0, yaw);
    const barrels = new THREE.Group();
    barrels.position.z = -0.3;
    yaw.add(barrels);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const b = new THREE.Mesh(cyl(0.036, 0.036, 0.72, 8), M.gun);
      b.rotation.x = Math.PI / 2;
      b.position.set(Math.cos(a) * 0.085, Math.sin(a) * 0.085, -0.32);
      b.castShadow = true;
      barrels.add(b);
    }
    const ring = new THREE.Mesh(cyl(0.13, 0.13, 0.06, 14), M.gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.z = -0.6;
    barrels.add(ring);
    const flash = new THREE.Mesh(sph(0.17, 10, 8), M.flash);
    flash.position.z = -0.95;
    flash.visible = false;
    yaw.add(flash);
    const rocket = new THREE.Group();
    rocket.position.set(-3.4, 1.82, 0);
    rocket.visible = false;
    body.add(rocket);
    put(cyl(0.2, 0.2, 1.1, 16), M.white, 0, 0, 0, Math.PI / 2, rocket);
    put(cone(0.2, 0.42, 16), cm, 0.76, 0, 0, -Math.PI / 2, rocket);
    put(box(0.36, 0.42, 0.04), cm, -0.42, 0.14, 0, 0, rocket);
    put(box(0.36, 0.04, 0.56), cm, -0.42, -0.02, 0, 0, rocket);
    const flame = put(cone(0.17, 0.7, 12), M.flame, -0.92, 0, 0, Math.PI / 2, rocket);
    flame.castShadow = false;
    const shield = new THREE.Mesh(sph(1, 26, 16), M.shield);
    shield.scale.set(3.0, 1.5, 1.35);
    shield.position.set(-2.0, 1.0, 0);
    shield.visible = false;
    g.add(shield);
    const sema = new THREE.Group();
    sema.position.set(1.0, 0, -0.95);
    sema.visible = false;
    g.add(sema);
    put(cyl(0.06, 0.06, 2.0, 10), M.navy, 0, 1.0, 0, 0, sema);
    put(rbox(0.42, 0.95, 0.3, 0.08), M.navy, 0, 2.15, 0, 0, sema);
    put(sph(0.12), M.redOn, 0, 2.42, 0.16, 0, sema);
    put(sph(0.12), M.ambOff, 0, 2.15, 0.16, 0, sema);
    put(sph(0.12), M.greenOff, 0, 1.88, 0.16, 0, sema);
    root.add(g);
    const tr = { g, body, wheels, cargo, rocket, flame, shield, sema, gun, yaw, barrels, flash, aim: 0, spinT: 0, flashT: 0, x: team.pos || 0, z, crates: [], moving: false, hopT: 0, sadT: 0, puffT: Math.random(), color: team.color };
    g.position.x = tr.x;
    tr.tag = addLabel('tag', '', [0, 0, 0], tr);
    return tr;
  }

  function buildCrates(state) {
    trains.forEach((tr, i) => {
      tr.crates = [];
      state.crates.forEach((c, k) => {
        if (c.taken.includes(i)) return;
        const m = new THREE.Mesh(rbox(0.8, 0.8, 0.8, 0.14), crateMat(k % CRATE_COLORS.length));
        m.position.set(c.x, TRACK_Y + 2.45, tr.z);
        m.castShadow = true;
        root.add(m);
        tr.crates.push({ x: c.x, mesh: m, taken: false, popped: false, ph: k * 1.7 + i * 0.6 });
      });
    });
  }

  let pins = new Map();
  let pinMeshes = null;

  function buildPinatas(state) {
    pins = new Map();
    const bodies = [], spikes = [], sticks = [];
    trains.forEach((tr, i) => {
      const shot = (state.shot && state.shot[i]) || [];
      state.pinatas.forEach((x, k) => {
        if (shot.includes(x)) return;
        const z = tr.z + 1.8;
        const c1 = PINATA[(k + i * 2) % PINATA.length], c2 = PINATA[(k + i * 2 + 3) % PINATA.length];
        const e = { x, z, b: bodies.length, s: [], k: sticks.length, alive: true };
        bodies.push({ p: [x, 1.0, z], c: c1 });
        SPIKES.forEach(d => {
          e.s.push(spikes.length);
          const dir = new THREE.Vector3(...d).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          const r = new THREE.Euler().setFromQuaternion(q);
          spikes.push({ p: [x + dir.x * 0.38, 1.0 + dir.y * 0.38, z + dir.z * 0.38], r: [r.x, r.y, r.z], c: c2 });
        });
        sticks.push({ p: [x, 0.38, z], s: [1, 0.76, 1] });
        pins.set(`${i}|${x}`, e);
      });
    });
    pinMeshes = {
      b: instanced(sph(0.3, 14, 10), M.inst, bodies),
      s: instanced(cone(0.1, 0.3, 8), M.inst, spikes),
      k: instanced(cyl(0.035, 0.035, 1.0, 6), M.navy, sticks),
    };
    if (pinMeshes.b) {
      pinMeshes.b.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      pinMeshes.s.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      pinMeshes.k.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
  }

  function scaleInstance(mesh, idx, s) {
    mesh.getMatrixAt(idx, dummy.matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    dummy.matrix.compose(dummy.position, dummy.quaternion, dummy.scale);
    mesh.setMatrixAt(idx, dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }

  function popPinata(i, x) {
    const e = pins.get(`${i}|${x}`);
    if (!e || !e.alive || !pinMeshes.b) return;
    e.alive = false;
    burst(x, 1.1, e.z, 34, 0.9);
    floatAt(x, 1.9, e.z, '+1', 'good small');
    tween(0.25, p => {
      const s = p < 0.3 ? 1 + p * 1.2 : Math.max(0.0001, 1.36 * (1 - (p - 0.3) / 0.7));
      scaleInstance(pinMeshes.b, e.b, s);
      e.s.forEach(k => scaleInstance(pinMeshes.s, k, s));
      if (p >= 1) scaleInstance(pinMeshes.k, e.k, 0.0001);
    });
  }

  const tracers = [];
  function fireAt(i, x) {
    const tr = trains[i];
    const e = pins.get(`${i}|${x}`);
    if (!tr || !e) return Promise.resolve();
    const gx = tr.x - 1.62, gy = tr.g.position.y + 2.08, gz = tr.z;
    tr.aim = Math.atan2(-(x - gx), -(e.z - gz));
    tr.spinT = 0.5;
    tr.flashT = 0.07;
    const from = new THREE.Vector3(gx - Math.sin(tr.aim) * 0.9, gy, gz - Math.cos(tr.aim) * 0.9);
    const to = new THREE.Vector3(x, 1.05, e.z);
    const t = new THREE.Mesh(box(0.06, 0.06, 1), M.tracer);
    t.position.copy(from).lerp(to, 0.5);
    t.lookAt(to);
    t.scale.z = from.distanceTo(to);
    scene.add(t);
    tracers.push({ m: t, life: 0.09 });
    return new Promise(res => setTimeout(() => { popPinata(i, x); res(); }, 90));
  }

  const setMinigun = (i, on) => { if (trains[i]) trains[i].gun.visible = on; };

  function setup(state) {
    clear();
    n = state.teams.length;
    len = Math.min(300, Math.max(90, (state.rounds || 5) * 20 + 30));
    backZ = laneZ(0, n);
    frontZ = laneZ(n - 1, n);
    buildLanes(state.teams);
    buildDecor(state.teams);
    trains = state.teams.map((t, i) => buildTrain(t, i));
    pins = new Map();
    pinMeshes = null;
    if (state.pinatas && state.powerups !== false) buildPinatas(state);
    if (state.crates && state.powerups !== false) buildCrates(state);
    state.teams.forEach((t, i) => {
      setItems(i, t.items || []);
      setSkip(i, (t.skip || 0) > 0);
    });
    updateTags(state.teams);
    setActive(state.turn ?? -1);
    cam.snap = true;
  }

  function updateTags(teams) {
    teams.forEach((t, i) => {
      const tr = trains[i];
      if (!tr) return;
      tr.tag.el.innerHTML = `<div style="--c:${t.color}" title="${escapeHtml(t.name)}"><b>${t.pos}</b></div>`;
      tr.tag.el.classList.toggle('on', i === activeIdx);
    });
  }

  function setActive(i) {
    activeIdx = i;
    trains.forEach((tr, k) => tr.tag.el.classList.toggle('on', k === i));
    glow.visible = i >= 0 && !!trains[i];
  }

  function setItems(i, items) {
    const tr = trains[i];
    if (!tr) return;
    const show = items.filter(k => k !== 'escudo');
    tr.cargo.forEach((c, k) => {
      c.visible = k < show.length;
      if (c.visible) c.material.color.setHex(ITEM_COLORS[show[k]] || 0xffffff);
    });
    tr.shield.visible = items.includes('escudo');
  }

  const setSkip = (i, on) => { if (trains[i]) trains[i].sema.visible = on; };
  const setTurbo = (i, on) => { if (trains[i]) trains[i].rocket.visible = on; };

  function puff(x, y, z, s = 1, grey = false) {
    puffIdx = (puffIdx + 1) % SMOKE_N;
    const p = puffs[puffIdx];
    p.max = p.life = 1.3 + Math.random() * 0.5;
    Object.assign(p, { x, y, z, s, vx: -0.5 - Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.4 });
    smoke.setColorAt(puffIdx, grey ? GREY : WHITE);
    smoke.instanceColor.needsUpdate = true;
  }

  function burst(x, y, z, count = 30, power = 1) {
    for (let k = 0; k < count; k++) {
      bitIdx = (bitIdx + 1) % CONF_N;
      const b = bits[bitIdx];
      b.life = 1.4 + Math.random() * 0.8;
      b.p.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const sp = (2 + Math.random() * 4) * power;
      b.vel.set(Math.cos(a) * sp, 4 + Math.random() * 5 * power, Math.sin(a) * sp * 0.6);
      b.rv.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
    }
  }

  function move(i, from, to, onCross, onStep) {
    const tr = trains[i];
    if (!tr || from === to) return Promise.resolve();
    const dist = Math.abs(to - from);
    const dur = Math.min(3.4, 0.8 + dist * 0.17);
    let prev = from;
    tr.moving = true;
    return tween(dur, p => {
      const x = from + (to - from) * easeIO(p);
      if (to > from) {
        for (const c of tr.crates) {
          if (!c.taken && c.x > prev - 1e-6 && c.x > from && c.x <= x + 1e-6) {
            c.taken = true;
            onCross && onCross(c.x);
          }
        }
      }
      for (const w of tr.wheels) w.w.rotation.z -= (x - tr.x) / w.r;
      tr.x = x;
      prev = x;
      onStep && onStep(x);
      tr.body.position.y = Math.abs(Math.sin(p * dur * 13)) * 0.05;
      if (p >= 1) {
        tr.moving = false;
        tr.body.position.y = 0;
      }
    });
  }

  function takeCrate(i, x) {
    const tr = trains[i];
    const c = tr && tr.crates.find(c => Math.abs(c.x - x) < 1e-6 && !c.popped);
    if (!c) return;
    c.popped = true;
    const m = c.mesh;
    const y0 = m.position.y;
    burst(m.position.x, y0, m.position.z, 28);
    tween(0.4, p => {
      const s = p < 0.35 ? 1 + p * 1.8 : 1.63 * (1 - (p - 0.35) / 0.65);
      m.scale.setScalar(Math.max(0.001, s));
      m.position.y = y0 + p * 0.8;
    }).then(() => root.remove(m));
  }

  function shieldBlock(i) {
    const tr = trains[i];
    if (!tr) return Promise.resolve();
    tr.shield.visible = true;
    burst(tr.x - 2, TRACK_Y + 2, tr.z, 20, 0.7);
    return tween(0.9, p => {
      const s = 1 + Math.sin(p * Math.PI) * 0.45;
      tr.shield.scale.set(3.0 * s, 1.5 * s, 1.35 * s);
    }).then(() => tr.shield.scale.set(3.0, 1.5, 1.35));
  }

  function steal(from, to) {
    const a = trains[from], b = trains[to];
    if (!a || !b) return Promise.resolve();
    const pieces = Array.from({ length: 7 }, () => {
      const m = new THREE.Mesh(rbox(0.28, 0.22, 0.26, 0.05), M.coal);
      m.castShadow = true;
      root.add(m);
      return m;
    });
    const sx = a.x - 3.4, sz = a.z, ex = b.x - 3.4, ez = b.z;
    return tween(1.1, p => pieces.forEach((m, k) => {
      const q = Math.min(1, Math.max(0, p * 1.45 - k * 0.07));
      m.position.set(sx + (ex - sx) * q + ((k % 3) - 1) * 0.22, TRACK_Y + 1.4 + Math.sin(q * Math.PI) * 3.4, sz + (ez - sz) * q + (((k >> 1) % 2) - 0.5) * 0.3);
      m.rotation.set(q * 9, q * 6, 0);
    })).then(() => pieces.forEach(m => root.remove(m)));
  }

  function swap(a, b, pa, pb) {
    const A = trains[a], B = trains[b];
    if (!A || !B) return Promise.resolve();
    const ax = A.x, bx = B.x;
    return tween(1.6, p => {
      const lift = p < 0.25 ? easeIO(p / 0.25) : p > 0.75 ? 1 - easeIO((p - 0.75) / 0.25) : 1;
      const k = p < 0.25 ? 0 : p > 0.75 ? 1 : easeIO((p - 0.25) / 0.5);
      A.x = ax + (pa - ax) * k;
      B.x = bx + (pb - bx) * k;
      A.g.position.y = B.g.position.y = TRACK_Y + lift * 1.8;
      A.g.rotation.z = Math.sin(p * Math.PI * 4) * 0.07 * lift;
      B.g.rotation.z = -A.g.rotation.z;
      if (p >= 1) A.g.rotation.z = B.g.rotation.z = 0;
    });
  }

  function sad(i) {
    const tr = trains[i];
    if (!tr) return;
    tr.sadT = 1;
    for (let k = 0; k < 3; k++) puff(tr.x - 0.42, TRACK_Y + 2.1 + k * 0.2, tr.z, 1.1, true);
  }

  function celebrate(list) {
    let k = 0;
    const id = setInterval(() => {
      list.forEach(i => {
        const tr = trains[i];
        if (!tr) return;
        burst(tr.x - 2, TRACK_Y + 3.2, tr.z, 45, 1.1);
        tr.hopT = 0.6;
      });
      if (++k >= 7) clearInterval(id);
    }, 650);
  }

  function floatAt(x, y, z, text, cls = '', follow = null) {
    const el = document.createElement('div');
    el.className = `lbl3d float ${cls}`;
    el.innerHTML = `<div>${text}</div>`;
    labelsEl.append(el);
    floats.push({ el, x, y, z, life: 1.8, vis: true, follow });
  }

  function float(i, text, cls = '') {
    const tr = trains[i];
    if (tr) floatAt(tr.x - 1.3, TRACK_Y + 2.1, tr.z, text, cls, tr);
  }

  function fit(x0, x1, z0, z1) {
    const { x: rx, y: ry, w: rw, h: rh, W, H } = view;
    const tx = (x0 + x1) / 2, tz = (z0 + z1) / 2;
    const px = rw * 0.03, py = rh * 0.04;
    let lo = 4, hi = 600;
    for (let k = 0; k < 22; k++) {
      const mid = (lo + hi) / 2;
      place(probe, tx, tz, mid);
      let ok = true;
      for (let c = 0; c < 8 && ok; c++) {
        v.set(c & 1 ? x1 : x0, c & 4 ? 2.6 : 0, c & 2 ? z1 : z0).project(probe);
        const sx = (v.x + 1) * 0.5 * W, sy = (1 - v.y) * 0.5 * H;
        if (v.z > 1 || sx < rx + px || sx > rx + rw - px || sy < ry + py || sy > ry + rh - py) ok = false;
      }
      if (ok) hi = mid;
      else lo = mid;
    }
    return { x: tx, z: tz, d: hi };
  }

  function place(c, tx, tz, d) {
    c.position.set(tx, Math.sin(PITCH) * d, tz + Math.cos(PITCH) * d);
    c.lookAt(tx, 0, tz);
    c.updateMatrixWorld();
  }

  function wanted() {
    const z0 = backZ - 1.5, z1 = frontZ + 1.7;
    if (!trains.length) return fit(-4, 26, -5, 5);
    if (mode === 'title') {
      const c = 13 + Math.sin(clock * 0.08) * 10;
      return fit(c - 15, c + 15, z0, z1);
    }
    let lo = Infinity, hi = -Infinity;
    for (const t of trains) {
      lo = Math.min(lo, t.x);
      hi = Math.max(hi, t.x);
    }
    const x0 = Math.max(-5.2, lo - 5.2);
    const x1 = Math.max(hi + 6, x0 + 24);
    return fit(x0, x1, z0, z1);
  }

  function offset(c) {
    const { x, y, w, h, W, H } = view;
    const cx = x + w / 2, cy = y + h / 2;
    const fw = 2 * Math.max(cx, W - cx), fh = 2 * Math.max(cy, H - cy);
    c.aspect = fw / fh;
    c.setViewOffset(fw, fh, fw / 2 - cx, fh / 2 - cy, W, H);
  }

  function layout() {
    const W = window.innerWidth, H = window.innerHeight;
    renderer.setSize(W, H, false);
    const r = frameEl.getBoundingClientRect();
    view = { x: r.left, y: r.top, w: Math.max(80, r.width), h: Math.max(80, r.height), W, H };
    offset(camera);
    offset(probe);
  }

  function step(dt) {
    clock += dt;
    for (let k = tweens.length - 1; k >= 0; k--) {
      const tw = tweens[k];
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.dur);
      tw.fn(p, dt);
      if (p >= 1) {
        tweens.splice(k, 1);
        tw.res();
      }
    }
    let anyMoving = false;
    trains.forEach((tr, i) => {
      if (tr.moving) anyMoving = true;
      tr.g.position.x = tr.x;
      if (tr.hopT > 0) {
        tr.hopT = Math.max(0, tr.hopT - dt);
        tr.g.position.y = TRACK_Y + Math.sin((1 - tr.hopT / 0.6) * Math.PI) * 0.9;
      }
      if (tr.sadT > 0) {
        tr.sadT = Math.max(0, tr.sadT - dt);
        tr.body.rotation.x = Math.sin(clock * 30) * 0.07 * tr.sadT;
      }
      tr.puffT -= dt;
      const rate = tr.moving ? 0.07 : i === activeIdx ? 0.55 : 2.4;
      if (tr.puffT <= 0) {
        tr.puffT = rate * (0.8 + Math.random() * 0.4);
        puff(tr.x - 0.42, tr.g.position.y + 1.62, tr.z, tr.moving ? 1 : 0.75);
      }
      if (tr.rocket.visible) {
        const f = tr.moving ? 1.1 + Math.sin(clock * 45) * 0.35 : 0.45 + Math.sin(clock * 12) * 0.08;
        tr.flame.scale.set(1, f, 1);
      }
      if (tr.shield.visible) tr.shield.rotation.y = clock * 0.6;
      if (tr.gun.visible) {
        if (tr.spinT > 0) tr.spinT = Math.max(0, tr.spinT - dt);
        else tr.aim = damp(tr.aim, Math.PI * 0.75 + Math.sin(clock * 0.8) * 0.4, 2, dt);
        tr.yaw.rotation.y = damp(tr.yaw.rotation.y, tr.aim, 18, dt);
        tr.barrels.rotation.z += dt * (tr.spinT > 0 ? 40 : 1.5);
        tr.flashT = Math.max(0, tr.flashT - dt);
        tr.flash.visible = tr.flashT > 0;
        tr.flash.scale.setScalar(0.7 + Math.random() * 0.6);
      }
      for (const c of tr.crates) {
        if (c.popped) continue;
        c.mesh.rotation.y = clock * 1.1 + c.ph;
        c.mesh.position.y = TRACK_Y + 2.45 + Math.sin(clock * 2.2 + c.ph) * 0.14;
      }
    });
    for (const s of spinners) s.o.rotation.z -= dt * s.sp;
    for (let k = tracers.length - 1; k >= 0; k--) {
      tracers[k].life -= dt;
      if (tracers[k].life <= 0) {
        scene.remove(tracers[k].m);
        tracers.splice(k, 1);
      }
    }
    if (activeIdx >= 0 && trains[activeIdx]) {
      const tr = trains[activeIdx];
      glow.position.set(tr.x - 2.0, 0.375, tr.z);
      glow.material.opacity = 0.4 + Math.sin(clock * 4) * 0.18;
    }

    const live = smoke.count;
    for (let k = 0; k < live; k++) {
      const p = puffs[k];
      if (p.life <= 0) continue;
      p.life -= dt;
      const t = 1 - Math.max(0, p.life) / p.max;
      const sc = p.life <= 0 ? 0 : p.s * (t < 0.18 ? t / 0.18 : 1 - Math.pow((t - 0.18) / 0.82, 2)) * (0.6 + t * 0.9);
      p.y += dt * 1.25;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(Math.max(0, sc));
      dummy.updateMatrix();
      smoke.setMatrixAt(k, dummy.matrix);
    }
    smoke.instanceMatrix.needsUpdate = true;
    for (let k = 0; k < CONF_N; k++) {
      const b = bits[k];
      if (b.life <= 0) continue;
      b.life -= dt;
      b.vel.y -= 11 * dt;
      b.vel.multiplyScalar(1 - 0.9 * dt);
      b.p.addScaledVector(b.vel, dt);
      if (b.p.y < 0.4) {
        b.p.y = 0.4;
        b.vel.set(0, 0, 0);
      }
      b.r.x += b.rv.x * dt;
      b.r.y += b.rv.y * dt;
      b.r.z += b.rv.z * dt;
      dummy.position.copy(b.p);
      dummy.rotation.copy(b.r);
      dummy.scale.setScalar(b.life <= 0 ? 0 : Math.min(1, b.life * 2));
      dummy.updateMatrix();
      confetti.setMatrixAt(k, dummy.matrix);
    }
    confetti.instanceMatrix.needsUpdate = true;

    const w = wanted();
    if (cam.snap) {
      Object.assign(cam, { x: w.x, z: w.z, d: w.d, snap: false });
    } else {
      cam.x = damp(cam.x, w.x, 2.4, dt);
      cam.z = damp(cam.z, w.z, 2.4, dt);
      cam.d = damp(cam.d, w.d, 2.0, dt);
    }
    cam.push = damp(cam.push, anyMoving && mode === 'game' ? 0.07 : 0, 2.5, dt);
    const d = cam.d * (1 - cam.push);
    place(camera, cam.x, cam.z, d);
    scene.fog.near = d * 1.15;
    scene.fog.far = d * 2.8;
    sun.position.set(cam.x - 22, 44, cam.z + 26);
    sun.target.position.set(cam.x, 0, cam.z);
    const span = Math.ceil(d * 0.85 / 8) * 8;
    if (span !== shadowSpan) {
      shadowSpan = span;
      Object.assign(sun.shadow.camera, { left: -span, right: span, top: span * 0.7, bottom: -span * 0.7 });
      sun.shadow.camera.updateProjectionMatrix();
    }

    for (let k = floats.length - 1; k >= 0; k--) {
      const F = floats[k];
      F.life -= dt;
      F.y += dt * 1.1;
      if (F.follow) {
        F.x = F.follow.x - 1.3;
        F.z = F.follow.z;
      }
      if (F.life <= 0) {
        F.el.remove();
        floats.splice(k, 1);
      }
    }
  }

  function project(L) {
    if (L.train) v.set(L.train.x - 4.8, L.train.g.position.y + 0.85, L.train.z);
    else v.set(L.x, L.y, L.z);
    v.project(camera);
    const vis = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
    if (vis !== L.vis) {
      L.vis = vis;
      L.el.style.visibility = vis ? 'visible' : 'hidden';
    }
    if (vis) L.el.style.transform = `translate3d(${((v.x + 1) * 0.5 * view.W).toFixed(1)}px,${((1 - v.y) * 0.5 * view.H).toFixed(1)}px,0)`;
  }

  let last = performance.now(), acc = 0, skip = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    if (dim && !tweens.length && (++skip % 3)) return;
    const dt = Math.min(0.06, acc);
    acc = 0;
    step(dt);
    renderer.render(scene, camera);
    labels.forEach(project);
    floats.forEach(project);
  }

  window.addEventListener('resize', layout);
  document.addEventListener('fullscreenchange', layout);
  layout();
  requestAnimationFrame(loop);

  return {
    setup,
    layout,
    setMode(m) { mode = m; layout(); },
    setDim(on) { dim = on; },
    setActive,
    updateTags,
    setItems,
    setSkip,
    setTurbo,
    setMinigun,
    fireAt,
    move,
    takeCrate,
    shieldBlock,
    steal,
    swap,
    sad,
    celebrate,
    float,
    wait: ms => new Promise(r => setTimeout(r, ms)),
    stats: () => renderer.info.render,
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
