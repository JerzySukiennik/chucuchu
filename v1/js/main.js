/* ¡Chucuchú! – game flow, 2D UI, power-ups, saving */
import { TOPICS, parseBank } from './questions.js';
import { createWorld } from './scene.js';
import * as sfx from './sfx.js';

const COLORS = ['#ff5fa2', '#ffc531', '#3fcf6e', '#3fa9f5', '#ff8a3d', '#9b6bff', '#2ed3c6', '#b5d83a'];
const NAMES = ['Los Toros', 'Las Tortillas', 'Los Flamencos', 'Las Paellas', 'Los Churros', 'Las Guitarras', 'Los Pingüinos', 'Las Piñatas'];
const DCOL = ['#46d17a', '#7ad455', '#b3d93c', '#e6cf35', '#ffc531', '#ffa63d', '#ff8a52', '#ff6fa8', '#c86cf0', '#8c62ff'];
const KIND = {
  '?': ['Elige', 'Wybierz odpowiedź'],
  '>': ['Traduce', 'Przetłumacz na hiszpański'],
  '_': ['Completa', 'Uzupełnij lukę'],
  '#': ['Números', 'Napisz liczbę słownie po hiszpańsku'],
  '~': ['Conjuga', 'Odmień czasownik'],
};
const POWER = {
  turbo: { icon: '🚀', name: 'Turbo', desc: 'Dobra odpowiedź w tej turze liczy się podwójnie.', color: '#ff8a3d', when: 'self' },
  minigun: { icon: '🔫', name: 'Minigun', desc: 'W tej turze pociąg strzela w piñaty przy torze: 6 pól przed sobą i po drodze. Każda trafiona to +1 pole.', color: '#ff5fa2', when: 'self' },
  mitad: { icon: '✂️', name: '50/50', desc: 'ABCD: znikają dwie złe odpowiedzi. Pytanie otwarte: podpowiedź z pierwszymi literami.', color: '#3fa9f5', when: 'self' },
  otra: { icon: '🔁', name: 'Otra vez', desc: 'Jak odpowiecie źle, macie drugą próbę.', color: '#3fcf6e', when: 'self' },
  semaforo: { icon: '🚦', name: 'Semáforo', desc: 'Wybrana drużyna traci swoją następną turę.', color: '#e6b81f', when: 'target' },
  robo: { icon: '🪨', name: 'Robo de carbón', desc: 'Zabieracie wybranej drużynie 3 pola i sami jedziecie 3 do przodu.', color: '#5d6385', when: 'target' },
  cambio: { icon: '🔀', name: 'Cambio de vía', desc: 'Zamieniacie się miejscami z pociągiem tuż przed Wami.', color: '#9b6bff', when: 'ahead' },
  escudo: { icon: '🛡️', name: 'Escudo', desc: 'Działa samo: blokuje następny atak na Waszą drużynę.', color: '#2ed3c6', when: 'passive' },
};
const WEIGHTS = { turbo: 3, minigun: 2, mitad: 3, otra: 2, semaforo: 2, robo: 2, cambio: 1, escudo: 2 };
const MAX_ITEMS = 4;
const REACH = 6;
const SAVE = 'chucuchu-save-1';
const CONF = 'chucuchu-cfg-1';
const BANK = parseBank(TOPICS);

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

let cfg = Object.assign({ teams: 5, rounds: 5, topics: [], timer: true, powerups: true, sound: 2, names: NAMES.slice(), colors: COLORS.slice() }, store.get(CONF) || {});
cfg.topics = (cfg.topics || []).filter(id => TOPICS.some(t => t.id === id));
let S = null;
let turn = null;
let phase = 'title';
let world = null;
let demoTimer = 0;
const T = { id: 0, left: 0, total: 0, last: 0 };

const saveCfg = () => store.set(CONF, cfg);
const save = () => S && store.set(SAVE, S);
const cur = () => S.teams[S.turn];
const modalOpen = () => $('#modal').classList.contains('show');

function overlay(html) {
  const o = $('#overlay');
  o.innerHTML = html;
  o.classList.toggle('show', !!html);
  world && world.setDim(!!html);
}
const clearOverlay = () => overlay('');

function modal(html) {
  const m = $('#modal');
  m.innerHTML = html;
  m.classList.toggle('show', !!html);
}
const closeModal = () => modal('');

function toast(msg) {
  const el = $('#toast');
  el.innerHTML = `<div>${msg}</div>`;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

function logo(small = false) {
  return `<div class="logo ${small ? 'small' : ''}">${[...'¡CHUCUCHÚ!'].map((ch, k) => `<span style="--c:${COLORS[k % COLORS.length]};--r:${(k % 2 ? 1 : -1) * (2 + ((k * 7) % 4))}deg;--k:${k}">${ch}</span>`).join('')}</div>`;
}

const ball = (color, cls = '') => `<span class="ball ${cls}" style="--c:${color}"></span>`;

function randItem() {
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, w] of Object.entries(WEIGHTS)) if ((r -= w) < 0) return k;
  return 'turbo';
}

function rankOf(teams) {
  return teams.map(t => 1 + teams.filter(o => o.pos > t.pos).length);
}

function pool(topics) {
  return BANK.filter(q => !topics.length || topics.includes(q.topic));
}

function pickQuestion(d) {
  const all = pool(S.topics);
  let fresh = all.filter(q => !S.used.includes(q.id));
  if (!fresh.length) {
    const ids = new Set(all.map(q => q.id));
    S.used = S.used.filter(id => !ids.has(id));
    fresh = all;
  }
  let best = Infinity;
  for (const q of fresh) best = Math.min(best, Math.abs(q.d - d));
  const cand = fresh.filter(q => Math.abs(q.d - d) === best);
  const q = cand[Math.floor(Math.random() * cand.length)];
  S.used.push(q.id);
  return q;
}

function demoState() {
  return {
    rounds: cfg.rounds,
    teams: Array.from({ length: cfg.teams }, (_, i) => ({ name: cfg.names[i], color: cfg.colors[i], pos: 0, items: [], skip: 0 })),
  };
}

function showTitle() {
  phase = 'title';
  stopTimer();
  turn = null;
  closeModal();
  clearOverlay();
  document.body.className = 'is-title';
  $('#dock').innerHTML = '';
  $('#board').innerHTML = '';
  world.setup(demoState());
  world.setMode('title');
  world.setActive(-1);
  renderTitle();
}

function renderTitle() {
  const saved = store.get(SAVE);
  $('#title').innerHTML = `
    <div class="title-card card pop">
      ${logo()}
      <p class="tagline">Carrera de trenes en español</p>
      <div class="setrow"><span class="lbl ol">Equipos</span><input type="range" min="2" max="8" value="${cfg.teams}" data-input="teams"><b class="val ol" id="v-teams">${cfg.teams}</b><button class="btn sm" data-act="teams" style="--c:var(--grape)">✏️ Nazwy</button></div>
      <div class="setrow"><span class="lbl ol">Rondas</span><input type="range" min="1" max="12" value="${cfg.rounds}" data-input="rounds"><b class="val ol" id="v-rounds">${cfg.rounds}</b><span class="hint" id="v-hint"></span></div>
      <div class="lbl ol">Temas</div>
      <div class="topics" id="topics">${topicChips()}</div>
      <div class="actions">
        <button class="btn" data-act="options" style="--c:var(--sky)">⚙️ Opcje</button>
        ${saved && !saved.over ? '<button class="btn" data-act="resume" style="--c:var(--grape)">↻ Kontynuuj grę</button>' : ''}
        <button class="btn big" data-act="start" data-primary style="--c:var(--grass)">¡Vamos! <kbd>Spacja</kbd></button>
      </div>
    </div>`;
  updateHint();
}

function topicChips() {
  const mix = !cfg.topics.length;
  return `<button class="chip ${mix ? 'on' : ''}" data-act="topic" data-id=""><i>🎲</i>Mix<small>${BANK.length}</small></button>` + TOPICS.map(t => `<button class="chip ${cfg.topics.includes(t.id) ? 'on' : ''}" data-act="topic" data-id="${t.id}"><i>${t.icon}</i>${esc(t.name)}<small>${pool([t.id]).length}</small></button>`).join('');
}

function updateHint() {
  const el = $('#v-hint');
  if (!el) return;
  const need = cfg.teams * cfg.rounds;
  const have = pool(cfg.topics).length;
  el.textContent = `${need} pytań w grze · ${have} w bazie`;
}

function toggleTopic(id) {
  if (!id) cfg.topics = [];
  else if (!cfg.topics.length) cfg.topics = [id];
  else if (cfg.topics.includes(id)) cfg.topics = cfg.topics.filter(x => x !== id);
  else cfg.topics = [...cfg.topics, id];
  saveCfg();
  $('#topics').innerHTML = topicChips();
  updateHint();
}

function onInput(e) {
  const el = e.target.closest('[data-input]');
  if (!el) return;
  const k = el.dataset.input;
  cfg[k] = +el.value;
  $(`#v-${k}`).textContent = cfg[k];
  saveCfg();
  updateHint();
  clearTimeout(demoTimer);
  demoTimer = setTimeout(() => phase === 'title' && world.setup(demoState()), 120);
}

function makeCrates(len) {
  const out = [];
  for (let x = 6 + Math.floor(Math.random() * 3); x < len; x += 7 + Math.floor(Math.random() * 4)) out.push({ x, taken: [] });
  return out;
}

function makePinatas(len) {
  const out = [];
  for (let x = 2 + Math.floor(Math.random() * 2); x < len; x += 2 + Math.floor(Math.random() * 3)) out.push(x);
  return out;
}

function startGame(fromSave) {
  if (fromSave) {
    S = store.get(SAVE);
    if (!S) return;
  } else {
    const len = Math.min(300, Math.max(90, cfg.rounds * 20 + 30));
    S = {
      v: 1,
      round: 1,
      turn: 0,
      rounds: cfg.rounds,
      topics: cfg.topics.slice(),
      timer: cfg.timer,
      powerups: cfg.powerups,
      teams: Array.from({ length: cfg.teams }, (_, i) => ({ name: cfg.names[i], color: cfg.colors[i], pos: 0, items: [], skip: 0, ok: 0, bad: 0 })),
      crates: makeCrates(len),
      pinatas: makePinatas(len),
      shot: Array.from({ length: cfg.teams }, () => []),
      tiles: null,
      used: [],
      hist: [],
    };
  }
  phase = 'board';
  $('#title').innerHTML = '';
  document.body.className = 'is-game';
  world.setup(S);
  world.setMode('game');
  sfx.play('whistle', { vol: 0.7 });
  enterTurn(true);
}

function rollTiles() {
  if (!S.powerups) {
    S.tiles = null;
    return;
  }
  if (S.tiles && S.tiles.round === S.round) return;
  const ds = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).slice(0, 3);
  if (!ds.some(d => d >= 7)) ds[2] = 7 + Math.floor(Math.random() * 4);
  const map = {};
  [...new Set(ds)].forEach(d => (map[d] = randItem()));
  S.tiles = { round: S.round, map };
}

function enterTurn(banner) {
  phase = 'board';
  turn = null;
  stopTimer();
  clearOverlay();
  rollTiles();
  world.setActive(S.turn);
  renderHud();
  if (banner && S.turn === 0) roundBanner();
  save();
}

function tileBonus() {
  if (!S.powerups || !S.tiles) return '';
  const list = Object.entries(S.tiles.map).sort((a, b) => a[0] - b[0]);
  return `<div class="bonus-row"><span>🎁 Bonusy</span>${list.map(([d, k]) => `<b style="--dc:${DCOL[d - 1]}" title="Trudność ${d}: ${POWER[k].name}"><em>${d}</em>${POWER[k].icon}</b>`).join('')}</div>`;
}

function renderHud() {
  const ranks = rankOf(S.teams);
  $('#board').innerHTML = `<div class="board-title"><span class="ol">Ronda</span><b>${Math.min(S.round, S.rounds)}</b><small>/ ${S.rounds}</small></div>` + S.teams.map((t, i) => `
    <div class="row ${i === S.turn && phase !== 'end' ? 'on' : ''}" style="--c:${t.color}">
      <span class="rank r${ranks[i]}">${ranks[i]}</span>${ball(t.color)}
      <span class="nm"><span>${esc(t.name)}</span><span class="its">${t.items.map(k => `<i title="${POWER[k].name}">${POWER[k].icon}</i>`).join('')}${t.skip ? '<i title="Semáforo">🚦</i>' : ''}</span></span>
      <b class="pts">${t.pos}</b>
    </div>`).join('');
  const t = cur();
  $('#dock').innerHTML = phase === 'end' ? '' : `
    <div class="dock card" style="--c:${t.color}">
      ${ball(t.color, 'big')}
      <div class="who"><small>Turno de</small><b>${esc(t.name)}</b></div>
      ${tileBonus()}
      <button class="btn big" data-act="go" data-primary style="--c:var(--grass)">¡Vamos! <kbd>Spacja</kbd></button>
    </div>`;
  world.updateTags(S.teams);
}

function roundBanner() {
  const last = S.round === S.rounds;
  const el = $('#banner');
  el.innerHTML = `<div class="ribbon"><b class="ol">${last ? '¡Última ronda!' : `Ronda ${S.round}`}</b><small>${last ? `Ronda ${S.round} z ${S.rounds}` : `z ${S.rounds}`}</small></div>`;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

function pushHist() {
  const snap = JSON.stringify({ ...S, hist: [] });
  S.hist.push(snap);
  if (S.hist.length > 30) S.hist.shift();
}

function onGo() {
  if (phase !== 'board') return;
  pushHist();
  const t = cur();
  turn = { d: 0, q: null, mods: {}, retried: false, opts: null, revealed: false, done: false, won: false, gained: [], tile: null };
  if (t.skip > 0) return showSkip();
  if (S.powerups && t.items.some(k => POWER[k].when !== 'passive')) return showPowerups();
  showDifficulty();
}

function teamHead(t) {
  const m = turn ? Object.keys(turn.mods).map(k => `<span class="mod" style="--pc:${POWER[k].color}">${POWER[k].icon} ${POWER[k].name}</span>`).join('') : '';
  return `<div class="thead">${ball(t.color)}<b class="ol">${esc(t.name)}</b><span class="mods">${m}</span></div>`;
}

function showSkip() {
  phase = 'skip';
  const t = cur();
  sfx.play('boing');
  overlay(`<div class="card ov-card narrow pop" style="--c:${t.color}">
    <div class="big-ico">🚦</div>
    <h2 class="ol">¡Semáforo rojo!</h2>
    <p class="lead"><b>${esc(t.name)}</b> traci tę turę.</p>
    <div class="actions"><button class="btn big" data-act="skipOk" data-primary style="--c:var(--sky)">Dalej <kbd>Spacja</kbd></button></div>
  </div>`);
}

function skipOk() {
  if (phase !== 'skip') return;
  const t = cur();
  t.skip = Math.max(0, t.skip - 1);
  world.setSkip(S.turn, t.skip > 0);
  nextTurn();
}

function ahead(i) {
  const me = S.teams[i].pos;
  let best = -1;
  S.teams.forEach((o, j) => {
    if (j !== i && o.pos > me && (best < 0 || o.pos < S.teams[best].pos)) best = j;
  });
  return best;
}

function pcard(k, idx) {
  const p = POWER[k];
  const dis = p.when === 'passive' ? 'Działa samo' : k === 'cambio' && ahead(S.turn) < 0 ? 'Jesteście pierwsi' : '';
  return `<button class="pcard" style="--pc:${p.color}" data-act="usePower" data-i="${idx}" ${dis ? 'disabled' : ''}>
    <span class="pico">${p.icon}</span><b>${p.name}</b><span class="pdesc">${p.desc}</span>${dis ? `<em>${dis}</em>` : `<kbd>${idx + 1}</kbd>`}
  </button>`;
}

function showPowerups() {
  phase = 'powerup';
  const t = cur();
  overlay(`<div class="card ov-card pop" style="--c:${t.color}">
    ${teamHead(t)}
    <h2 class="ol">¿Usáis un power-up?</h2>
    <p class="sub">Jeden na turę. Resztę możecie zachować na później.</p>
    <div class="pcards">${t.items.map((k, idx) => pcard(k, idx)).join('')}</div>
    <div class="actions"><button class="btn" data-act="noPower" data-primary style="--c:#8a93ad">Nie teraz <kbd>Spacja</kbd></button></div>
  </div>`);
}

async function usePower(idx) {
  if (phase !== 'powerup') return;
  const i = S.turn, t = cur(), k = t.items[idx], p = POWER[k];
  if (!p || p.when === 'passive') return;
  if (p.when === 'self') {
    t.items.splice(idx, 1);
    turn.mods[k] = true;
    world.setItems(i, t.items);
    sfx.play('powerup');
    renderHud();
    if (k === 'turbo') world.setTurbo(i, true);
    if (k === 'minigun') return activateMinigun();
    toast(`${p.icon} ${p.name}!`);
    return showDifficulty();
  }
  if (k === 'cambio') {
    const j = ahead(i);
    if (j < 0) return;
    return doAttack(idx, j);
  }
  showTarget(idx);
}

function showTarget(idx) {
  phase = 'target';
  const t = cur(), k = t.items[idx], p = POWER[k];
  overlay(`<div class="card ov-card pop" style="--c:${t.color}">
    ${teamHead(t)}
    <h2 class="ol">${p.icon} ${p.name}: na kogo?</h2>
    <div class="targets">${S.teams.map((o, j) => j === S.turn ? '' : `
      <button class="tcard" style="--c:${o.color}" data-act="target" data-i="${idx}" data-j="${j}">
        ${ball(o.color, 'big')}<b>${esc(o.name)}</b><small>pole ${o.pos}${o.items.includes('escudo') ? ' · 🛡️ ma Escudo' : ''}</small><kbd>${j + 1}</kbd>
      </button>`).join('')}</div>
    <div class="actions"><button class="btn" data-act="backPower" style="--c:#8a93ad">← Wróć</button></div>
  </div>`);
}

async function doAttack(idx, j) {
  if (phase !== 'target' && phase !== 'powerup') return;
  const i = S.turn, t = S.teams[i], o = S.teams[j], k = t.items[idx];
  t.items.splice(idx, 1);
  world.setItems(i, t.items);
  clearOverlay();
  phase = 'anim';
  if (o.items.includes('escudo')) {
    o.items.splice(o.items.indexOf('escudo'), 1);
    sfx.play('boing');
    toast(`🛡️ ${esc(o.name)}: Escudo blokuje atak!`);
    await world.shieldBlock(j);
    world.setItems(j, o.items);
  } else if (k === 'semaforo') {
    o.skip += 1;
    world.setSkip(j, true);
    sfx.play('boing');
    toast(`🚦 ${esc(o.name)} traci następną turę`);
    await world.wait(1000);
  } else if (k === 'robo') {
    const a = Math.min(3, o.pos);
    sfx.play('squeak');
    await world.steal(j, i);
    const oFrom = o.pos, tFrom = t.pos;
    o.pos -= a;
    t.pos += a;
    toast(`🪨 ${esc(o.name)} −${a}, ${esc(t.name)} +${a}`);
    const h = sfx.play('chug', { vol: 0.45 });
    const [, got] = await Promise.all([world.move(j, oFrom, o.pos), moveWithCrates(i, tFrom, t.pos, false)]);
    sfx.stop(h);
    turn.gained.push(...got);
  } else if (k === 'cambio') {
    const pa = t.pos, pb = o.pos;
    t.pos = pb;
    o.pos = pa;
    sfx.play('toot');
    toast(`🔀 Zamiana z ${esc(o.name)}!`);
    await world.swap(i, j, t.pos, o.pos);
  }
  renderHud();
  showDifficulty();
}

function targetsFor(i, lo, hi) {
  return S.pinatas.filter(x => x > lo && x <= hi && !S.shot[i].includes(x));
}

async function activateMinigun() {
  const i = S.turn, t = cur();
  clearOverlay();
  phase = 'anim';
  world.setMinigun(i, true);
  toast('🔫 ¡Minigun!');
  await world.wait(500);
  const xs = targetsFor(i, t.pos, t.pos + REACH);
  if (xs.length) {
    sfx.play('minigun', { vol: 0.55 });
    for (const x of xs) {
      S.shot[i].push(x);
      sfx.play('pew', { vol: 0.8, rate: 0.9 + Math.random() * 0.2 });
      await world.fireAt(i, x);
      await world.wait(170);
    }
    await world.wait(250);
    await bonusMove(i, xs.length);
  } else toast('🔫 Na razie brak piñat w zasięgu, strzelamy w trakcie jazdy');
  showDifficulty();
}

async function bonusMove(i, n) {
  const t = S.teams[i];
  const from = t.pos;
  t.pos += n;
  world.float(i, `+${n} 🎯`, 'good');
  const got = await moveWithCrates(i, from, t.pos, false);
  turn && turn.gained.push(...got);
  renderHud();
}

async function moveWithCrates(i, from, to, shooting) {
  const t = S.teams[i];
  const got = [];
  let hits = 0;
  const onCross = !S.powerups ? null : x => {
    const c = S.crates.find(c => c.x === x);
    if (c && !c.taken.includes(i)) c.taken.push(i);
    world.takeCrate(i, x);
    sfx.play('pop');
    if (t.items.length < MAX_ITEMS) {
      const k = randItem();
      t.items.push(k);
      got.push(k);
      world.setItems(i, t.items);
      sfx.play('powerup', { vol: 0.7 });
    } else toast(`Bagażnik pełny (max ${MAX_ITEMS} power-upy)`);
  };
  const onStep = !shooting ? null : x => {
    for (const px of targetsFor(i, from, x + REACH)) {
      S.shot[i].push(px);
      hits++;
      sfx.play('pew', { vol: 0.8, rate: 0.9 + Math.random() * 0.2 });
      world.fireAt(i, px);
    }
  };
  await world.move(i, from, to, onCross, onStep);
  if (hits) {
    await world.wait(350);
    const more = await bonusMoveInner(i, hits);
    got.push(...more);
  }
  return got;
}

async function bonusMoveInner(i, n) {
  const t = S.teams[i];
  const from = t.pos;
  t.pos += n;
  world.float(i, `+${n} 🎯`, 'good');
  return moveWithCrates(i, from, t.pos, false);
}

function showDifficulty() {
  phase = 'difficulty';
  const t = cur(), m = turn.mods, mult = m.turbo ? 2 : 1;
  const tiles = (S.powerups && S.tiles && S.tiles.map) || {};
  overlay(`<div class="card ov-card wide pop" style="--c:${t.color}">
    ${teamHead(t)}
    <h2 class="ol">¿Qué dificultad?</h2>
    <p class="sub">Im trudniej, tym dalej. Zła odpowiedź = pociąg stoi.${Object.keys(tiles).length ? ' Kafle z 🎁 dają power-up za dobrą odpowiedź.' : ''}</p>
    <div class="dgrid">${Array.from({ length: 10 }, (_, k) => {
      const d = k + 1, bonus = tiles[d];
      return `<button class="dtile ${bonus ? 'has-bonus' : ''}" style="--c:${DCOL[k]}" data-act="diff" data-d="${d}">
        <b>${d}</b><span>+${d * mult}</span>${bonus ? `<i class="gift" title="${POWER[bonus].name}">${POWER[bonus].icon}</i>` : ''}<kbd>${d % 10}</kbd>
      </button>`;
    }).join('')}</div>
    <div class="dlegend"><span>Fácil</span><span>Medio</span><span>Difícil</span></div>
  </div>`);
}

function askQuestion(d) {
  if (phase !== 'difficulty' && phase !== 'question') return;
  const q = pickQuestion(d);
  turn.d = d;
  turn.q = q;
  turn.tile = (S.powerups && S.tiles && S.tiles.map[d]) || null;
  turn.revealed = false;
  turn.done = false;
  turn.won = false;
  turn.timeout = false;
  turn.opts = q.abcd ? shuffle(q.a.map((txt, k) => ({ txt, ok: k === 0, out: false, picked: false }))) : null;
  if (q.abcd && turn.mods.mitad) shuffle(turn.opts.filter(o => !o.ok)).slice(0, 2).forEach(o => (o.out = true));
  phase = 'question';
  sfx.play('bell', { vol: 0.35 });
  renderQuestion(true);
  startTimer();
}

const fmtPrompt = s => esc(s).replace(/_{3,}/g, '<span class="gap"></span>');
const hintOf = s => s.replace(/\p{L}+/gu, w => w[0] + '_'.repeat(w.length - 1));

function renderQuestion(first = false) {
  const t = cur(), q = turn.q, [chip, instr] = KIND[q.type];
  const gain = turn.d * (turn.mods.turbo ? 2 : 1);
  const locked = turn.done || turn.revealed;
  let body;
  if (q.abcd) {
    body = `<div class="answers">${turn.opts.map((o, k) => {
      const cls = o.out ? 'out' : locked ? (o.ok ? 'good' : o.picked ? 'bad' : 'dim') : o.picked ? 'bad' : '';
      return `<button class="ans ${cls}" data-act="pick" data-k="${k}" ${o.out || locked || o.picked ? 'disabled' : ''}><i>${'ABCD'[k]}</i><span>${esc(o.txt)}</span></button>`;
    }).join('')}</div>`;
  } else if (turn.revealed) {
    body = `<div class="open"><div class="reveal ${first ? '' : 'pop-s'}"><div class="answer">${esc(q.a[0])}</div>${q.a.length > 1 ? `<div class="alts">Też dobrze: ${q.a.slice(1).map(esc).join(' · ')}</div>` : ''}</div></div>`;
  } else {
    body = `<div class="open">${turn.mods.mitad ? `<div class="hint">Podpowiedź: <span>${esc(hintOf(q.a[0]))}</span></div>` : ''}<button class="btn big" data-act="reveal" data-primary style="--c:var(--grape)">👁 Pokaż odpowiedź <kbd>Spacja</kbd></button></div>`;
  }
  const judge = turn.revealed && !turn.done ? `<div class="judge">
      <button class="btn big" data-act="judge" data-ok="0" style="--c:var(--berry)">✗ Źle <kbd>N</kbd></button>
      <button class="btn big" data-act="judge" data-ok="1" style="--c:var(--grass)">✓ Dobrze <kbd>T</kbd></button>
    </div>` : '';
  const result = turn.done ? `<div class="result ${turn.won ? 'win' : 'lose'}">
      <b class="ol">${turn.won ? `¡Correcto! +${gain}` : turn.timeout ? '¡Se acabó el tiempo!' : '¡Incorrecto!'}</b>
      ${turn.won && turn.tile ? `<span class="got">🎁 ${POWER[turn.tile].icon} ${POWER[turn.tile].name}</span>` : ''}
      ${!turn.won && !q.abcd && !turn.revealed ? `<span class="got">Poprawnie: ${esc(q.a[0])}</span>` : ''}
      <button class="btn big" data-act="continue" data-primary style="--c:${turn.won ? 'var(--grass)' : 'var(--sky)'}">Dalej <kbd>Spacja</kbd></button>
    </div>` : '';
  const long = q.q.length > 70 ? 'xlong' : q.q.length > 42 ? 'long' : '';
  overlay(`<div class="card qcard ${first ? 'pop' : ''}" style="--c:${t.color}">
    <div class="qhead">
      ${ball(t.color)}<b class="ol">${esc(t.name)}</b>
      <span class="mods">${Object.keys(turn.mods).map(k => `<span class="mod" style="--pc:${POWER[k].color}">${POWER[k].icon} ${POWER[k].name}</span>`).join('')}${turn.tile ? `<span class="mod gift" style="--pc:#ffffff">🎁 ${POWER[turn.tile].icon}</span>` : ''}</span>
      <span class="dbadge" style="--dc:${DCOL[turn.d - 1]}">${turn.d}</span><span class="gain ol">+${gain}</span>
    </div>
    <div class="timer ${S.timer ? '' : 'off'}"><i id="tbar"></i><span id="tnum"></span></div>
    <div class="qbody">
      <div class="qmeta"><span class="chip-k">${chip}</span><span>${instr}</span></div>
      <div class="prompt ${q.type === '#' ? 'num' : ''} ${long}">${fmtPrompt(q.q)}</div>
      ${body}${judge}${result}
    </div>
  </div>`);
  renderTimer();
}

function startTimer() {
  stopTimer();
  if (!S.timer) return;
  T.total = T.left = 15 + 3 * turn.d;
  T.last = performance.now();
  T.id = setInterval(tickTimer, 100);
  renderTimer();
}

function stopTimer() {
  clearInterval(T.id);
  T.id = 0;
}

function tickTimer() {
  const now = performance.now();
  const dt = (now - T.last) / 1000;
  T.last = now;
  if (modalOpen()) return;
  const before = Math.ceil(T.left);
  T.left = Math.max(0, T.left - dt);
  const after = Math.ceil(T.left);
  if (after !== before && after <= 5 && after > 0) sfx.play('tick', { vol: 0.9 });
  renderTimer();
  if (T.left <= 0) {
    stopTimer();
    timeUp();
  }
}

function renderTimer() {
  const bar = $('#tbar'), num = $('#tnum');
  if (!bar || !turn) return;
  const running = T.id && !turn.done && !turn.revealed;
  const k = T.total ? T.left / T.total : 1;
  bar.style.transform = `scaleX(${running || turn.timeout ? k : 1})`;
  bar.parentElement.classList.toggle('low', running && T.left <= 5);
  bar.parentElement.classList.toggle('idle', !running);
  num.textContent = running ? Math.ceil(T.left) : '';
}

function timeUp() {
  if (phase !== 'question' || turn.done || turn.revealed) return;
  turn.timeout = true;
  turn.revealed = true;
  sfx.play('boing');
  toast('⏰ ¡Se acabó el tiempo! Oceńcie, czy zdążyli.');
  renderQuestion();
}

function pick(k) {
  if (phase !== 'question' || !turn.opts) return;
  const o = turn.opts[k];
  if (!o || turn.done || turn.revealed || o.out || o.picked) return;
  o.picked = true;
  if (o.ok) return finish(true);
  if (turn.mods.otra && !turn.retried) {
    turn.retried = true;
    sfx.play('wrong', { vol: 0.5 });
    toast('🔁 ¡Otra vez! Druga próba');
    renderQuestion();
    startTimer();
    return;
  }
  finish(false);
}

function reveal() {
  if (phase !== 'question' || turn.done || turn.revealed) return;
  turn.revealed = true;
  stopTimer();
  sfx.play('pop');
  renderQuestion();
}

function judge(ok) {
  if (phase !== 'question' || turn.done || !turn.revealed) return;
  if (ok) return finish(true);
  if (turn.mods.otra && !turn.retried) {
    turn.retried = true;
    sfx.play('wrong', { vol: 0.5 });
    toast('🔁 ¡Otra vez! Nowe pytanie, ta sama trudność');
    askQuestion(turn.d);
    return;
  }
  finish(false);
}

function finish(won) {
  stopTimer();
  turn.done = true;
  turn.won = won;
  const t = cur();
  if (won) t.ok++;
  else t.bad++;
  sfx.play(won ? 'correct' : 'wrong', { vol: won ? 1 : 0.7 });
  renderQuestion();
}

async function cont() {
  if (phase !== 'question' || !turn || !turn.done) return;
  phase = 'moving';
  const i = S.turn, t = cur();
  clearOverlay();
  if (turn.won) {
    if (turn.tile) {
      if (t.items.length < MAX_ITEMS) {
        t.items.push(turn.tile);
        turn.gained.push(turn.tile);
        world.setItems(i, t.items);
      } else toast(`Bagażnik pełny (max ${MAX_ITEMS} power-upy)`);
    }
    const gain = turn.d * (turn.mods.turbo ? 2 : 1);
    const from = t.pos;
    t.pos += gain;
    world.float(i, `+${gain}`, 'good');
    sfx.play('toot');
    const h = sfx.play('chug', { vol: 0.5 });
    const got = await moveWithCrates(i, from, t.pos, !!turn.mods.minigun);
    sfx.stop(h);
    turn.gained.push(...got);
    renderHud();
  } else {
    world.float(i, '✗', 'bad');
    world.sad(i);
    sfx.play('toot', { rate: 0.7, vol: 0.6 });
    await world.wait(1000);
  }
  if (turn.gained.length) return showReward(turn.gained);
  nextTurn();
}

function showReward(list) {
  phase = 'reward';
  const t = cur();
  sfx.play('powerup');
  overlay(`<div class="card ov-card pop" style="--c:${t.color}">
    ${teamHead(t)}
    <h2 class="ol">¡Power-up${list.length > 1 ? 's' : ''}!</h2>
    <div class="pcards">${list.map(k => `<div class="pcard flip" style="--pc:${POWER[k].color}"><span class="pico">${POWER[k].icon}</span><b>${POWER[k].name}</b><span class="pdesc">${POWER[k].desc}</span></div>`).join('')}</div>
    <div class="actions"><button class="btn big" data-act="reward" data-primary style="--c:var(--grass)">¡Genial! <kbd>Spacja</kbd></button></div>
  </div>`);
}

function nextTurn() {
  if (!S) return;
  world.setTurbo(S.turn, false);
  world.setMinigun(S.turn, false);
  turn = null;
  S.turn++;
  if (S.turn >= S.teams.length) {
    S.turn = 0;
    S.round++;
  }
  if (S.round > S.rounds) return endGame();
  enterTurn(S.turn === 0);
}

function endGame() {
  stopTimer();
  closeModal();
  clearOverlay();
  phase = 'end';
  turn = null;
  S.over = true;
  S.round = Math.min(S.round, S.rounds);
  save();
  document.body.className = 'is-game is-end';
  world.setActive(-1);
  world.setMode('end');
  renderHud();
  const ranks = rankOf(S.teams);
  const order = S.teams.map((t, i) => ({ ...t, i, rank: ranks[i] })).sort((a, b) => b.pos - a.pos);
  const winners = order.filter(o => o.rank === 1).map(o => o.i);
  world.celebrate(winners);
  sfx.play('fanfare');
  setTimeout(() => sfx.play('applause', { vol: 0.8 }), 1500);
  const podium = order.slice(0, 3);
  const slots = [podium[1], podium[0], podium[2]];
  overlay(`<div class="card ov-card wide end pop">
    <h2 class="ol">¡Fin del viaje!</h2>
    <div class="podium">${slots.map((o, k) => o ? `
      <div class="step s${o.rank > 3 ? 3 : o.rank}" style="--c:${o.color}">
        ${ball(o.color, 'big')}<b>${esc(o.name)}</b><span class="pts ol">${o.pos}</span>
        <div class="block"><em class="ol">${o.rank}</em></div>
      </div>` : `<div class="step empty ${k === 0 ? 's2' : 's3'}"></div>`).join('')}</div>
    <div class="rest">${order.map(o => `<div class="rrow" style="--c:${o.color}"><span class="rank r${o.rank}">${o.rank}</span>${ball(o.color)}<span class="nm">${esc(o.name)}</span><span class="st">✓ ${o.ok} · ✗ ${o.bad}</span><b>${o.pos}</b></div>`).join('')}</div>
    <div class="actions">
      <button class="btn" data-act="home" style="--c:var(--sky)">🏠 Menu</button>
      <button class="btn big" data-act="rematch" data-primary style="--c:var(--grass)">¡Revancha! <kbd>Spacja</kbd></button>
    </div>
  </div>`);
}

function openMenu() {
  if (!S || phase === 'title') return;
  const canUndo = S.hist.length > 0 && phase !== 'end';
  modal(`<div class="card modal-card pop">
    <h2 class="ol">Menú</h2>
    <div class="menu-list">
      <button class="btn" data-act="closeModal" data-primary style="--c:var(--grass)">▶ Wróć do gry <kbd>Spacja</kbd></button>
      <button class="btn" data-act="undo" style="--c:var(--grape)" ${canUndo ? '' : 'disabled'}>↩ Cofnij turę</button>
      <button class="btn" data-act="teams" style="--c:var(--sky)">✏️ Drużyny i pola</button>
      <button class="btn" data-act="options" style="--c:var(--sky)">⚙️ Opcje</button>
      <button class="btn" data-act="fs" style="--c:var(--sky)">⛶ Pełny ekran <kbd>F</kbd></button>
      ${phase !== 'end' ? '<button class="btn" data-act="endNow" style="--c:var(--tang)">🏁 Zakończ grę teraz</button>' : ''}
      <button class="btn" data-act="newGame" style="--c:#8a93ad">🏠 Nowa gra</button>
    </div>
    <p class="keys"><kbd>Spacja</kbd> dalej · <kbd>1</kbd>–<kbd>0</kbd> trudność · <kbd>A</kbd>–<kbd>D</kbd> odpowiedź · <kbd>T</kbd>/<kbd>N</kbd> dobrze/źle · <kbd>M</kbd> menu · <kbd>F</kbd> pełny ekran</p>
  </div>`);
}

function undo() {
  if (!S || !S.hist.length) return;
  const hist = S.hist;
  const snap = JSON.parse(hist.pop());
  S = Object.assign(snap, { hist });
  stopTimer();
  closeModal();
  world.setup(S);
  enterTurn(false);
  toast('↩ Cofnięto turę');
}

function openTeams() {
  const inGame = !!S && phase !== 'title';
  const list = inGame ? S.teams : Array.from({ length: cfg.teams }, (_, i) => ({ name: cfg.names[i], color: cfg.colors[i] }));
  modal(`<div class="card modal-card pop">
    <h2 class="ol">Equipos</h2>
    <div class="team-rows">${list.map((t, i) => `
      <div class="team-row">
        <button class="swatch" data-act="swatch" data-i="${i}" style="--c:${t.color}" title="Zmień kolor"></button>
        <input class="name-in" data-i="${i}" value="${esc(t.name)}" maxlength="18" spellcheck="false">
        ${inGame ? `<label class="pos-in">pole <input type="number" min="0" max="999" data-pos="${i}" value="${t.pos}"></label>` : ''}
      </div>`).join('')}</div>
    <div class="actions">
      ${inGame ? '' : '<button class="btn sm" data-act="resetNames" style="--c:var(--grape)">Domyślne</button>'}
      <button class="btn sm" data-act="closeModal" style="--c:#8a93ad">Anuluj</button>
      <button class="btn sm" data-act="saveTeams" data-primary style="--c:var(--grass)">✓ Okay</button>
    </div>
  </div>`);
}

function cycleSwatch(el) {
  const c = getComputedStyle(el).getPropertyValue('--c').trim();
  const next = COLORS[(COLORS.indexOf(c) + 1) % COLORS.length];
  el.style.setProperty('--c', next);
}

function resetNames() {
  document.querySelectorAll('.name-in').forEach((el, i) => (el.value = NAMES[i]));
  document.querySelectorAll('.swatch').forEach((el, i) => el.style.setProperty('--c', COLORS[i]));
}

function saveTeams() {
  const inGame = !!S && phase !== 'title';
  const names = [...document.querySelectorAll('.name-in')].map((el, i) => el.value.trim() || NAMES[i]);
  const colors = [...document.querySelectorAll('.swatch')].map(el => getComputedStyle(el).getPropertyValue('--c').trim());
  names.forEach((n, i) => {
    cfg.names[i] = n;
    cfg.colors[i] = colors[i];
  });
  saveCfg();
  closeModal();
  if (inGame) {
    const pos = [...document.querySelectorAll('[data-pos]')].map(el => Math.max(0, Math.round(+el.value || 0)));
    S.teams.forEach((t, i) => {
      t.name = names[i];
      t.color = colors[i];
      if (!isNaN(pos[i])) t.pos = pos[i];
    });
    world.setup(S);
    if (phase === 'end') {
      world.setActive(-1);
      renderHud();
    } else enterTurn(false);
    save();
  } else world.setup(demoState());
}

function openOptions() {
  const row = (label, k, opts) => `<div class="opt-row"><span>${label}</span><div class="seg">${opts.map(([v, txt]) => `<button class="${String(cfg[k]) === String(v) ? 'on' : ''}" data-act="opt" data-k="${k}" data-v="${v}">${txt}</button>`).join('')}</div></div>`;
  modal(`<div class="card modal-card pop">
    <h2 class="ol">Opciones</h2>
    ${row('Czas na odpowiedź', 'timer', [[true, 'Wł.'], [false, 'Wył.']])}
    ${row('Power-upy', 'powerups', [[true, 'Wł.'], [false, 'Wył.']])}
    ${row('Dźwięk', 'sound', [[0, 'Wył.'], [1, 'Cicho'], [2, 'Średnio'], [3, 'Głośno']])}
    <p class="note">Czas: 15 s + 3 s za każdy poziom trudności (1 → 18 s, 10 → 45 s).</p>
    <div class="actions"><button class="btn" data-act="fs" style="--c:var(--sky)">⛶ Pełny ekran</button><button class="btn" data-act="closeModal" data-primary style="--c:var(--grass)">✓ Gotowe</button></div>
  </div>`);
}

function setOpt(k, raw) {
  const v = raw === 'true' ? true : raw === 'false' ? false : +raw;
  cfg[k] = v;
  saveCfg();
  if (k === 'sound') {
    sfx.setLevel(v);
    sfx.play('click');
  }
  if (S && phase !== 'title') {
    if (k === 'timer') {
      S.timer = v;
      if (!v) stopTimer();
      if (phase === 'question') renderQuestion();
    }
    if (k === 'powerups') {
      S.powerups = v;
      rollTiles();
      world.setup(S);
      if (phase === 'board') renderHud();
    }
    save();
  }
  openOptions();
}

function toggleFS() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

const ACT = {
  start: () => phase === 'title' && startGame(false),
  resume: () => phase === 'title' && startGame(true),
  teams: openTeams,
  options: openOptions,
  topic: el => toggleTopic(el.dataset.id),
  swatch: cycleSwatch,
  resetNames,
  saveTeams,
  closeModal,
  go: onGo,
  skipOk,
  noPower: () => phase === 'powerup' && showDifficulty(),
  usePower: el => usePower(+el.dataset.i),
  target: el => doAttack(+el.dataset.i, +el.dataset.j),
  backPower: () => phase === 'target' && showPowerups(),
  diff: el => phase === 'difficulty' && askQuestion(+el.dataset.d),
  pick: el => pick(+el.dataset.k),
  reveal,
  judge: el => judge(el.dataset.ok === '1'),
  continue: cont,
  reward: () => phase === 'reward' && nextTurn(),
  undo,
  menu: openMenu,
  fs: toggleFS,
  endNow: () => { closeModal(); endGame(); },
  newGame: () => { closeModal(); showTitle(); },
  rematch: () => { if (phase === 'end') { clearOverlay(); startGame(false); } },
  home: showTitle,
  opt: el => setOpt(el.dataset.k, el.dataset.v),
};

function onClick(e) {
  sfx.init();
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (modalOpen() && !el.closest('#modal')) return;
  sfx.play('click', { vol: 0.5 });
  ACT[el.dataset.act]?.(el);
}

function topPrimary() {
  if (modalOpen()) return $('#modal [data-primary]:not(:disabled)');
  if ($('#overlay').classList.contains('show')) return $('#overlay [data-primary]:not(:disabled)');
  return $('#dock [data-primary]') || $('#title [data-primary]');
}

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  const tgt = e.target;
  if (tgt.tagName === 'INPUT' && tgt.type !== 'range') {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('#modal [data-primary]')?.click();
    }
    return;
  }
  sfx.init();
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') {
    const b = topPrimary();
    e.preventDefault();
    if (b) b.click();
    return;
  }
  if (k === 'escape') {
    if (modalOpen()) closeModal();
    return;
  }
  if (k === 'f') return toggleFS();
  if (k === 'm') {
    if (modalOpen()) closeModal();
    else openMenu();
    return;
  }
  if (modalOpen()) return;
  if (phase === 'difficulty' && /^[0-9]$/.test(k)) return askQuestion(k === '0' ? 10 : +k);
  if (phase === 'powerup' && /^[1-4]$/.test(k)) return $(`#overlay [data-act="usePower"][data-i="${+k - 1}"]:not(:disabled)`)?.click();
  if (phase === 'target' && /^[1-8]$/.test(k)) return $(`#overlay [data-act="target"][data-j="${+k - 1}"]`)?.click();
  if (phase === 'question') {
    const idx = 'abcd'.indexOf(k);
    if (idx >= 0 && turn.opts) return pick(idx);
    if (k === 't' || k === 'y') return $('#overlay [data-act="judge"][data-ok="1"]')?.click();
    if (k === 'n') return $('#overlay [data-act="judge"][data-ok="0"]')?.click();
  }
}

async function init() {
  try {
    await Promise.all([document.fonts.load('40px "Lilita One"'), document.fonts.load('500 40px Fredoka'), document.fonts.load('40px "Lilita One"', 'ąęłńóśźżÁÉÍÓÚÑ')]);
  } catch {}
  world = createWorld($('#scene'), $('#labels'), $('#frame'));
  sfx.setLevel(cfg.sound);
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  document.addEventListener('input', onInput);
  showTitle();
  document.body.classList.add('ready');
  window.__chucuchu = { get S() { return S; }, get phase() { return phase; }, get turn() { return turn; }, world, renderHud: () => renderHud() };
}

init();
