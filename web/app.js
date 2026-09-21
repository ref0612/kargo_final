// KARGO mockup UI. Vanilla JS, no build. State = web/store.js rules over web/data/*.json, persisted in localStorage.
// Two independent toggles: language (ES/EN) and view (mobile frame / desktop). Same DOM, layout switched by body[data-view].
// ponytail: full re-render on every action (fine at demo scale); Code 39 barcode instead of QR; window.prompt for manual-scan reason.
import { createStore, HttpError, rutValid, FILES, CP } from './store.js';
import { t, setLang, getLang, tErr, tNote } from './i18n.js';

const LS = { db: 'kargo-mock-db-v1', me: 'kargo-mock-me', lang: 'kargo-mock-lang', view: 'kargo-mock-view' };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (iso) => (iso ? new Date(iso).toLocaleString(getLang() === 'es' ? 'es-CL' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const num = (id) => 'OT-' + id.replace('ot_', '');
const pkgLabel = (n) => t(n === 1 ? 'pkg.one' : 'pkg.many', { n });
const initials = (name) => name.split(' (')[0].split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = (k, v) => { try { v === undefined ? localStorage.removeItem(LS[k]) : localStorage.setItem(LS[k], v); } catch { /* ignore */ } };
const load = (k) => { try { return localStorage.getItem(LS[k]); } catch { return null; } };

// ---- icons (Lucide-style, stroke) -------------------------------------------------------------
const P = {
  package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  warehouse: '<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect x="6" y="10" width="12" height="12"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  print: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="8"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
};
const ic = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[n]}</svg>`;

// ---- domain vocabulary ---------------------------------------------------------------------------
const STEPS = ['creada', 'asignada_operador', 'recoleccion_asignada', 'recolectada', 'en_bodega_operador', 'asignada_transporte', 'cargada_bus', 'entregada'];
const MS_IDX = { Creada: 0, Asignada: 1, 'En recolección': 2, 'En tránsito': 3, Entregada: 4 }; // store's merchant-facing labels
const ROLES = ['merchant', 'coordinador_logistico', 'operador_despachador', 'operador_conductor_recoleccion', 'operador_encargado_bodega', 'operador_conductor_bus', 'operador_conductor_entrega'];

let S, me, W = null, NB = null, sigDrawn = false, query = '', filter = 'all', lastKey = '', animateNow = false, viewPref = 'desktop';

// ---- boot / persistence -----------------------------------------------------------------------------
async function loadDb(reset) {
  if (!reset) { try { const s = load('db'); if (s) return JSON.parse(s); } catch { /* ignore */ } }
  const db = {};
  await Promise.all(Object.entries(FILES).map(async ([n, [f]]) => { db[n] = await (await fetch('data/' + f)).json(); }));
  return db;
}
const persist = () => { try { localStorage.setItem(LS.db, JSON.stringify(S.db)); } catch { toast(t('err.save'), 'err'); } };

async function boot(reset = false) {
  try {
    S = createStore(await loadDb(reset), persist);
  } catch {
    $('#view').innerHTML = `<div class="card" style="margin-top:24px"><h2>${t('err.load.title')}</h2><p class="muted" style="margin-top:8px">${t('err.load.body')}</p></div>`;
    return;
  }
  if (reset) { store('me'); W = NB = null; }
  const saved = load('me');
  me = S.userById(saved) ? saved : S.list('users')[0].id;
  buildWho();
  if (reset) go('#/'); else render(); // keep a deep link (#/order/...) on first load
}
const U = () => S.userById(me);
const roleName = (rol) => t('role.' + rol);

function buildWho() {
  const groups = {};
  S.list('users').forEach((u) => (groups[u.rol] = groups[u.rol] || []).push(u));
  $('#who').innerHTML = ROLES.filter((r) => groups[r]).map((rol) => `<optgroup label="${esc(roleName(rol))}">${groups[rol].map((u) => {
    const op = u.operador_id ? ' · ' + S.list('operators').find((o) => o.id === u.operador_id).nombre.split(' ')[0] : '';
    return `<option value="${u.id}" ${u.id === me ? 'selected' : ''}>${esc(u.nombre)}${esc(op)}</option>`;
  }).join('')}</optgroup>`).join('');
}
function switchUser(id) { me = id; store('me', id); W = NB = null; buildWho(); go('#/'); }

// ---- language + view toggles -----------------------------------------------------------------------------
const effView = () => (innerWidth < 700 ? 'mobile' : viewPref);
function applyStatic() {
  document.documentElement.lang = getLang();
  $$('[data-i18n]').forEach((e) => { e.textContent = t(e.dataset.i18n); });
  $$('[data-i18n-aria]').forEach((e) => e.setAttribute('aria-label', t(e.dataset.i18nAria)));
  $$('[data-ic]').forEach((e) => { e.innerHTML = ic(e.dataset.ic); });
  $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
  document.body.dataset.view = effView();
  $$('[data-viewmode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.viewmode === effView())));
}
function changeLang(l) { setLang(l); store('lang', l); applyStatic(); if (S) { buildWho(); render(); } }
function changeView(v) { viewPref = v; store('view', v); applyStatic(); render(); }
addEventListener('resize', (() => { let tm; return () => { clearTimeout(tm); tm = setTimeout(() => { if (S && document.body.dataset.view !== effView()) { applyStatic(); render(); } }, 150); }; })());

// ---- generic helpers -----------------------------------------------------------------------------------------
let toastT;
function toast(msg, kind = '') {
  const el = $('#toast'); el.textContent = msg; el.className = 'show ' + kind;
  clearTimeout(toastT); toastT = setTimeout(() => (el.className = ''), 3400);
}
function run(fn, ok) {
  try { const r = fn(); if (ok) toast(t(ok)); return r; } catch (e) {
    if (e instanceof HttpError) toast(tErr(e.message), 'err'); else { console.error(e); toast(t('err.unexpected'), 'err'); }
  } finally { render(); }
}
// Which orders is this user expected to act on right now?
function actionable(u, o) {
  const op = o.operacion;
  switch (u.rol) {
    case 'coordinador_logistico': return o.status === 'creada';
    case 'operador_despachador': return o.status === 'asignada_operador';
    case 'operador_conductor_recoleccion': return o.status === 'recoleccion_asignada' && op.recoleccion.conductor_id === u.id;
    case 'operador_encargado_bodega': return o.status === 'recolectada' || o.status === 'en_bodega_operador';
    case 'operador_conductor_bus': return o.status === 'asignada_transporte' && op.transporte.conductor_id === u.id;
    case 'operador_conductor_entrega': return o.status === 'cargada_bus';
    default: return false;
  }
}
const msIdx = (o) => MS_IDX[o.estado_merchant];
// merchant sees 5 states, everyone else the 8 internal steps
function steps(o, u) {
  return u.rol === 'merchant'
    ? { n: 5, idx: msIdx(o), labels: [0, 1, 2, 3, 4].map((i) => t('ms.' + i)) }
    : { n: 8, idx: STEPS.indexOf(o.status), labels: STEPS.map((s) => t('st.' + s)) };
}
const stageLabel = (o, u) => (u.rol === 'merchant' ? t('ms.' + msIdx(o)) : t('st.' + o.status));
const chip = (o, u = U()) => `<span class="chip s${msIdx(o)}">${esc(stageLabel(o, u))}</span>`;
const cityA = (o) => o.bodega_origen.direccion.ciudad;
const cityB = (o) => o.bodega_destino.direccion.ciudad;
const blk = (html, i, mo) => (html.trim() ? `<div class="${animateNow ? 'rise' : ''}" style="--i:${i};--mo:${mo}">${html}</div>` : '');
// navigate without double-rendering when the hash is already there (hashchange also renders)
function go(h) { if (location.hash === h || (h === '#/' && !location.hash)) render(); else location.hash = h; }

// Code 39 (hardware scanners read it like keyboard input). Real system: QR/Code128 from the backend.
const C39 = { 0: 'nnnwwnwnn', 1: 'wnnwnnnnw', 2: 'nnwwnnnnw', 3: 'wnwwnnnnn', 4: 'nnnwwnnnw', 5: 'wnnwwnnnn', 6: 'nnwwwnnnn', 7: 'nnnwnnwnw', 8: 'wnnwnnwnn', 9: 'nnwwnnwnn', A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn', K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn', U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn' };
function code39(text) {
  let x = 0, bars = '';
  for (const ch of '*' + text + '*') {
    [...C39[ch]].forEach((w, i) => { const wd = w === 'w' ? 3 : 1; if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${wd}" height="40"/>`; x += wd; });
    x += 1;
  }
  return `<svg viewBox="0 0 ${x} 40" preserveAspectRatio="none" role="img" aria-label="${esc(text)}">${bars}</svg>`;
}

// ---- route map (schematic of Chile, zoomed to the network in use) -----------------------------------------------
const GEO = { arica: [-18.48, -70.31], iquique: [-20.21, -70.15], antofagasta: [-23.65, -70.4], calama: [-22.46, -68.93], copiapo: [-27.37, -70.33], 'la serena': [-29.9, -71.25], valparaiso: [-33.05, -71.62], santiago: [-33.45, -70.67], rancagua: [-34.17, -70.74], talca: [-35.43, -71.66], chillan: [-36.61, -72.1], concepcion: [-36.83, -73.05], temuco: [-38.74, -72.59], valdivia: [-39.81, -73.25], osorno: [-40.57, -73.13], 'puerto montt': [-41.47, -72.94], coyhaique: [-45.57, -72.07], 'punta arenas': [-53.16, -70.91] };
const COAST = [[-18, -70.3], [-20, -70.2], [-23.6, -70.45], [-27, -70.9], [-30, -71.5], [-33, -71.6], [-34.5, -72], [-36, -72.8], [-37.5, -73.6], [-38.7, -73.5], [-40, -73.7], [-41.5, -73.9], [-43, -74], [-45, -74.5], [-48, -75.5], [-53, -74.5]];
const ANDES = [[-18, -69.5], [-20, -68.7], [-23.6, -67.8], [-27, -68.6], [-30, -70], [-33, -70], [-34.5, -70.3], [-36, -71], [-38, -71.3], [-40, -71.6], [-41.5, -71.8], [-43, -71.7], [-45, -71.9], [-48, -72.8], [-53, -71.5]];
const ckey = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function interp(tab, lat) {
  for (let i = 0; i < tab.length - 1; i++) {
    const [a, al] = tab[i], [b, bl] = tab[i + 1];
    if (lat <= a && lat >= b) return al + (bl - al) * ((a - lat) / (a - b));
  }
  return lat > tab[0][0] ? tab[0][1] : tab[tab.length - 1][1];
}
function routeMap(orders, extra = []) {
  const shown = {};
  const edges = orders.map((o) => ({ o, a: ckey(cityA(o)), b: ckey(cityB(o)) })).filter((e) => GEO[e.a] && GEO[e.b] && e.a !== e.b);
  const names = new Set(edges.flatMap((e) => [e.a, e.b]));
  extra.forEach((c) => { if (GEO[ckey(c)]) names.add(ckey(c)); });
  orders.forEach((o) => { shown[ckey(cityA(o))] = cityA(o); shown[ckey(cityB(o))] = cityB(o); });
  extra.forEach((c) => { shown[ckey(c)] = c; });
  if (!names.size) return null;
  const lats = [...names].map((k) => GEO[k][0]);
  let hi = Math.max(...lats) + 1.5, lo = Math.min(...lats) - 1.5;
  if (hi - lo < 7) { const m = (hi + lo) / 2; hi = m + 3.5; lo = m - 3.5; }
  const Wd = 340, Ht = 400, samples = [];
  for (let l = hi; l >= lo - 0.001; l -= 0.25) samples.push(l);
  const coast = samples.map((l) => interp(COAST, l)), andes = samples.map((l) => interp(ANDES, l));
  const lonMin = Math.min(...coast) - 0.5, lonMax = Math.max(...andes) + 0.5;
  const sc = Math.min(Ht / (hi - lo), Wd / ((lonMax - lonMin) * 0.82));
  const ox = (Wd - (lonMax - lonMin) * 0.82 * sc) / 2, oy = (Ht - (hi - lo) * sc) / 2;
  const X = (lon) => ox + (lon - lonMin) * 0.82 * sc, Y = (lat) => oy + (hi - lat) * sc;
  const pt = (l, lon) => `${X(lon).toFixed(1)},${Y(l).toFixed(1)}`;
  const land = `M${samples.map((l, i) => pt(l, coast[i])).join(' L')} L${samples.map((l, i) => pt(l, andes[i])).reverse().join(' L')}Z`;
  const grid = []; for (let l = Math.ceil(lo / 2) * 2; l <= hi; l += 2) grid.push(`<line x1="0" x2="${Wd}" y1="${Y(l).toFixed(1)}" y2="${Y(l).toFixed(1)}" stroke="#C9D8EC" stroke-width=".7" stroke-dasharray="2 5"/>`);
  const seen = {}, paths = [], dots = [], active = new Set();
  const noAnim = reduced();
  edges.forEach((e, i) => {
    const [la, lna] = GEO[e.a], [lb, lnb] = GEO[e.b];
    const x1 = X(lna), y1 = Y(la), x2 = X(lnb), y2 = Y(lb);
    const pair = [e.a, e.b].sort().join('|'); seen[pair] = (seen[pair] || 0) + 1;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len; if (nx < 0) { nx = -nx; ny = -ny; }
    const bulge = 22 + (seen[pair] - 1) * 16, cx = (x1 + x2) / 2 + nx * bulge, cy = (y1 + y2) / 2 + ny * bulge;
    const d = `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
    const idx = STEPS.indexOf(e.o.status), transit = idx >= 3 && idx <= 6, fin = idx === 7;
    if (!fin) { active.add(e.a); active.add(e.b); }
    paths.push(`<path id="rp${i}" d="${d}" fill="none" stroke="${fin ? '#9AB3D4' : transit ? '#FFD2B5' : '#8AA0BC'}" stroke-width="${transit ? 5 : 2.4}" stroke-linecap="round" ${!fin && !transit ? 'stroke-dasharray="3 6"' : ''}/>`);
    if (transit) {
      paths.push(`<path d="${d}" fill="none" stroke="#FF7A2F" stroke-width="2.6" stroke-linecap="round" class="route-live"/>`);
      dots.push(noAnim
        ? `<circle cx="${((x1 + x2) / 2 + cx) / 2 | 0}" cy="${((y1 + y2) / 2 + cy) / 2 | 0}" r="6" fill="#FF7A2F" stroke="#fff" stroke-width="2.5"/>`
        : `<circle r="6.5" fill="#FF7A2F" stroke="#fff" stroke-width="2.5"><animateMotion dur="${6 + (i % 3)}s" repeatCount="indefinite" rotate="auto"><mpath href="#rp${i}"/></animateMotion></circle>`);
    }
  });
  const cities = [...names].map((k) => {
    const [la, lo2] = GEO[k], x = X(lo2), y = Y(la), left = x > Wd * 0.6;
    return `${active.has(k) ? `<circle class="city-ring" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="#FF7A2F" opacity=".5"/>` : ''}
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="#fff" stroke="#0B1B2E" stroke-width="2.5"/>
      <text x="${(x + (left ? -12 : 12)).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${left ? 'end' : 'start'}" font-size="12.5" font-weight="700" fill="#0B1B2E" style="paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round">${esc(shown[k] || k)}</text>`;
  }).join('');
  const svg = `<svg viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="${esc(t('map.aria', { n: edges.length, c: names.size }))}">
    <defs><pattern id="dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1" fill="#C3D3E9"/></pattern></defs>
    ${grid.join('')}<path d="${land}" fill="#F9FBFE" stroke="#BFD0E6" stroke-width="1.5" stroke-linejoin="round"/><path d="${land}" fill="url(#dots)"/>
    ${paths.join('')}${cities}${dots.join('')}</svg>`;
  return { svg, routes: edges.length };
}
function mapCard(orders, u) {
  const extra = u.rol === 'merchant' ? S.bootstrap(u).merchant.bodegas.map((b) => b.ciudad) : [];
  const m = routeMap(orders, extra);
  return `<div class="card"><div class="card-h"><div><h2>${t('map.title')}</h2><div class="small muted">${t('map.sub')}</div></div>${ic('pin')}</div>
    ${m ? `<div class="map">${m.svg}</div><div class="legend"><span><i></i>${t('map.transit')}</span><span><i class="p"></i>${t('map.pending')}</span><span><i class="d"></i>${t('map.done')}</span></div>` : `<p class="muted">${t('map.empty')}</p>`}</div>`;
}

// ---- components -------------------------------------------------------------------------------------------------------
function rail(o, u) {
  const { n, idx, labels } = steps(o, u), fin = o.status === 'entregada';
  return `<ol class="rail" aria-label="${t('rail.aria')}">${labels.map((l, i) => {
    const c = fin ? (i === n - 1 ? 'done fin' : 'done') : i < idx ? 'done' : i === idx ? 'now' : '';
    return `<li class="${c}" ${i === idx ? 'aria-current="step"' : ''}><span class="dot">${c.includes('done') ? ic('check') : ''}</span><span class="lbl">${esc(l)}</span></li>`;
  }).join('')}</ol><p class="rail-cap">${t('live.step', { n: idx + 1, t: n })} · ${esc(labels[idx])}</p>`;
}
function routeBlock(o, u) {
  const { n, idx } = steps(o, u), fin = o.status === 'entregada', pct = n > 1 ? (idx / (n - 1)) * 100 : 0;
  return `<div class="live-route"><div><div class="cn">${esc(cityA(o))}</div><div class="wh">${esc(o.bodega_origen.nombre)}</div></div>
    <div class="track"><span class="fill" style="width:${pct}%"></span><span class="truck ${fin ? 'done' : ''}" style="left:${pct}%">${ic(fin ? 'check' : 'truck')}</span></div>
    <div class="to"><div class="cn">${esc(cityB(o))}</div><div class="wh">${esc(o.bodega_destino.nombre)}</div></div></div>${rail(o, u)}`;
}
function liveCard(o, u) {
  if (!o) return `<div class="card"><div class="card-h"><h2>${t('live.title')}</h2></div><p class="muted">${t('live.none')}</p></div>`;
  return `<div class="card"><div class="card-h"><h2>${t('live.title')}</h2>${chip(o, u)}</div>${routeBlock(o, u)}
    <div class="row between" style="margin-top:18px;gap:12px"><span class="mono small muted">${num(o.id)} · ${pkgLabel(o.bultos_total)}</span><a class="btn sm" href="#/order/${o.id}">${t('w.viewOrder')}${ic('arrow', 'sm')}</a></div></div>`;
}
function orderCard(o, todo) {
  const u = U(), { n, idx } = steps(o, u), fin = o.status === 'entregada';
  const segs = Array.from({ length: n }, (_, i) => `<i class="${fin ? 'fin' : i < idx ? 'on' : i === idx ? 'cur' : ''}"></i>`).join('');
  return `<a class="ocard ${todo ? 'todo' : ''}" href="#/order/${o.id}">
    <div class="oc-top"><span class="oc-code">${num(o.id)}</span>${chip(o, u)}</div>
    <div class="rt"><span class="city">${esc(cityA(o))}</span><span class="line"></span><span class="city">${esc(cityB(o))}</span></div>
    <div class="oc-meta"><span>${esc(o.bodega_origen.nombre)} → ${esc(o.bodega_destino.nombre)}</span><span>${pkgLabel(o.bultos_total)}</span><span>${fmt(o.created_at)}</span>${o.referencia_cliente ? `<span class="mono">${esc(o.referencia_cliente)}</span>` : ''}</div>
    <div class="prog" aria-hidden="true">${segs}</div>
    ${todo ? `<div class="oc-todo">${ic('arrow', 'sm')}${t('todo.badge')}</div>` : ''}</a>`;
}
function ordersTable(orders, u) {
  return `<div class="tblwrap"><table class="tbl"><thead><tr><th>${t('col.ot')}</th><th>${t('col.route')}</th><th>${t('col.pkgs')}</th><th>${t('col.status')}</th><th>${t('col.created')}</th><th>${t('col.ref')}</th></tr></thead><tbody>
    ${orders.map((o) => `<tr data-href="#/order/${o.id}" class="${actionable(u, o) ? 'todo' : ''}"><td><a class="mono" href="#/order/${o.id}">${num(o.id)}</a></td>
      <td><b>${esc(cityA(o))} → ${esc(cityB(o))}</b><div class="small muted">${esc(o.bodega_origen.nombre)} → ${esc(o.bodega_destino.nombre)}</div></td>
      <td class="mono">${o.bultos_total}</td><td>${chip(o, u)}</td><td class="small">${fmt(o.created_at)}</td><td class="small mono muted">${esc(o.referencia_cliente || '—')}</td></tr>`).join('')}</tbody></table></div>`;
}
const EV_ICON = (e) => (/^bulto_escaneado/.test(e.type) ? [/^REGISTRO MANUAL/.test(e.note) ? 'man' : 'scan', 'scan'] : /^traspaso/.test(e.type) ? ['sign', 'pen'] : e.type === 'orden_creada' ? ['', 'plus'] : /asignad/.test(e.type) ? ['', e.type === 'orden_asignada_operador' ? 'user' : 'truck'] : ['', 'check']);
function feedCard(u, orders) {
  const items = orders.flatMap((o) => S.events(u, o.id)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  return `<div class="card"><div class="card-h"><h2>${t('feed.title')}</h2></div>${items.length ? `<ul class="feed">${items.map((e) => {
    const [cls, icon] = EV_ICON(e), who = S.userById(e.actor_id);
    return `<li><span class="fi ${cls}">${ic(icon, 'sm')}</span><div><b>${t('ev.' + e.type)}</b><span class="s">${num(e.order_id)} · ${esc(who ? who.nombre.split(' (')[0] : e.actor_id)} · ${fmt(e.at)}</span>${/^REGISTRO MANUAL/.test(e.note) ? `<span class="s">${esc(tNote(e.note))}</span>` : ''}</div></li>`;
  }).join('')}</ul>` : `<p class="muted">${t('feed.empty')}</p>`}</div>`;
}
function hero(u, orders) {
  const active = orders.filter((o) => o.status !== 'entregada').length, done = orders.length - active, todo = orders.filter((o) => actionable(u, o)).length;
  const kp = (n, l, hot) => `<div class="hkpi ${hot ? 'hot' : ''}"><b data-count="${n}">${n}</b><span>${l}</span></div>`;
  const merchant = u.rol === 'merchant';
  return `<section class="hero"><div><span class="eyebrow">${esc(roleName(u.rol))}</span><h1>${t('hi', { name: esc(u.nombre.split(' (')[0].split(' ')[0]) })}</h1>
    <p>${merchant ? t('hero.merchant') : t('guide.' + u.rol)}</p>${merchant ? `<a class="btn" href="#/new">${ic('plus')}${t('cta.new')}</a>` : ''}</div>
    <div class="hero-kpis">${merchant ? kp(orders.length, t('kpi.orders')) + kp(active, t('kpi.active'), true) + kp(done, t('kpi.delivered')) : kp(todo, t('kpi.todo'), todo > 0) + kp(active, t('kpi.active')) + kp(done, t('kpi.delivered'))}</div></section>`;
}

// ---- views ---------------------------------------------------------------------------------------------------------------
function featured(orders, u) {
  const act = orders.filter((o) => o.status !== 'entregada');
  if (u.rol === 'merchant') return [...act].sort((a, b) => msIdx(b) - msIdx(a))[0];
  return orders.find((o) => actionable(u, o)) || act[0];
}
function dashboard() {
  const u = U(), orders = S.listOrders(u), merchant = u.rol === 'merchant';
  const todo = orders.filter((o) => actionable(u, o)), rest = orders.filter((o) => !actionable(u, o));
  const list = merchant
    ? `<div class="card"><div class="card-h"><h2>${t('orders.recent')}</h2><a class="link" href="#/orders">${t('orders.viewAll')}</a></div><div class="olist">${orders.slice(0, 4).map((o) => orderCard(o)).join('') || `<p class="muted">${t('orders.none')}</p>`}</div></div>`
    : `<div class="card"><div class="card-h"><h2>${t('todo.title', { n: todo.length })}</h2></div><div class="olist">${todo.map((o) => orderCard(o, true)).join('') || `<p class="muted">${t('todo.none')}</p>`}</div></div>
       ${rest.length ? `<div class="card"><div class="card-h"><h2>${t('others.title', { n: rest.length })}</h2></div><div class="olist">${rest.map((o) => orderCard(o)).join('')}</div></div>` : ''}`;
  return `<div class="dash">${blk(hero(u, orders), 0, 0)}
    <div class="cols"><div class="col">${blk(liveCard(featured(orders, u), u), 1, 1)}${blk(list, 2, 2)}</div>
    <div class="col">${blk(mapCard(orders, u), 3, 3)}${blk(feedCard(u, orders), 4, 4)}</div></div></div>`;
}

function ordersView() {
  const u = U(), all = S.listOrders(u), q = query.trim().toLowerCase();
  const shown = all.filter((o) => (filter === 'all' || (filter === 'active') === (o.status !== 'entregada')) && (!q || (num(o.id) + cityA(o) + cityB(o) + o.bodega_origen.nombre + o.bodega_destino.nombre + (o.referencia_cliente || '')).toLowerCase().includes(q)));
  const chips = [['all', 'f.all'], ['active', 'f.active'], ['delivered', 'f.delivered']].map(([f, k]) => `<button class="fchip" type="button" data-act="filter" data-f="${f}" aria-pressed="${filter === f}">${t(k)}</button>`).join('');
  return `<div class="card">${blk(`<div class="frow"><label class="search"><span class="sr">${t('orders.search')}</span>${ic('search')}<input id="q" type="search" placeholder="${esc(t('orders.search'))}" value="${esc(query)}"></label>${chips}</div>`, 0, 0)}
    ${shown.length ? `<div class="only-desktop">${ordersTable(shown, u)}</div><div class="olist only-mobile">${shown.map((o) => orderCard(o, actionable(u, o))).join('')}</div>` : `<p class="muted">${t('orders.none')}</p>`}</div>`;
}

function actionPanel(o, u) {
  const c = CP[o.status];
  if (u.rol === 'coordinador_logistico' && o.status === 'creada') {
    return `<form class="card stack" data-form="assign"><h2>${t('assign.title')}</h2>
      <label class="f">${t('assign.op')}<select name="operador_id">${S.bootstrap(u).operators.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></label>
      <button class="btn block">${ic('check')}${t('assign.btn')}</button></form>`;
  }
  if (u.rol === 'operador_despachador' && o.status === 'asignada_operador') {
    const op = S.bootstrap(u).operator;
    return `<form class="card stack" data-form="pickup"><h2>${t('pickup.title')}</h2>
      <label class="f">${t('pickup.driver')}<select name="conductor_id">${op.equipo.filter((e) => e.rol === 'operador_conductor_recoleccion').map((e) => `<option value="${e.id}">${esc(e.nombre)}</option>`).join('')}</select></label>
      <label class="f">${t('pickup.vehicle')}<select name="movil_patente">${op.vehiculos.map((v) => `<option value="${v.patente}">${v.patente} · ${esc(v.tipo)}</option>`).join('')}</select></label>
      <button class="btn block">${ic('truck')}${t('pickup.btn')}</button></form>`;
  }
  if (u.rol === 'operador_encargado_bodega' && o.status === 'en_bodega_operador') {
    const op = S.bootstrap(u).operator;
    return `<form class="card stack" data-form="transport"><h2>${t('transport.title')}</h2>
      <label class="f">${t('transport.service')}<select name="servicio_id">${op.servicios.map((s) => `<option value="${s.id}">${esc(s.servicio)} · ${s.bus_patente}</option>`).join('')}</select></label>
      <label class="f">${t('transport.driver')}<select name="conductor_id">${op.equipo.filter((e) => e.rol === 'operador_conductor_bus').map((e) => `<option value="${e.id}">${esc(e.nombre)}</option>`).join('')}</select></label>
      <button class="btn block">${ic('truck')}${t('transport.btn')}</button></form>`;
  }
  return c && actionable(u, o) ? scanPanel(o, c) : '';
}

function scanPanel(o, c) {
  const pend = o.paquetes.filter((p) => !p.scan_history.some((s) => s.checkpoint === c.cp));
  const done = o.escaneados === o.paquetes.length;
  const persons = c.signPerm ? o.personas_autorizadas[c.point] : null;
  return `<div class="card stack"><div class="row between"><h2>${t('scan.title', { cp: t('cp.' + c.cp) })}</h2><span class="pill ${done ? 'scan' : ''}">${o.escaneados}/${o.paquetes.length}</span></div>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${o.paquetes.length}" aria-valuenow="${o.escaneados}"><i style="width:${(o.escaneados / o.paquetes.length) * 100}%"></i></div>
    ${pend.length ? `<form class="scanbox" data-form="scan"><input name="piece_code" placeholder="${esc(t('scan.placeholder'))}" autocomplete="off" autocapitalize="characters" aria-label="${esc(t('scan.aria'))}" autofocus><button class="btn blue">${ic('scan')}<span>${t('scan.btn')}</span></button></form>
      <div class="row between small"><span class="muted">${t('scan.sim')}</span><button class="link" data-act="scan-all" type="button">${t('scan.all')}</button></div>` : ''}
    <div>${o.paquetes.map((p) => {
      const s = p.scan_history.find((x) => x.checkpoint === c.cp);
      return `<div class="pkg"><span><span class="code">${p.piece_code}</span><br><span class="d">${esc(p.descripcion)} · ${p.peso_kg} ${t('unit.kg')}</span></span>
        <span class="r">${s ? `<span class="pill ${s.manual ? 'manual' : 'scan'}">${ic('check', 'sm')}${s.manual ? t('pkg.manual') : t('pkg.scanned')}</span>`
            : `<button class="link" data-act="manual" data-code="${p.piece_code}" type="button">${t('scan.manual')}</button><button class="btn sm ghost" data-act="scan-one" data-code="${p.piece_code}" type="button">${t('scan.btn')}</button>`}</span></div>`;
    }).join('')}</div>
    ${done ? `<form class="stack" data-form="confirm">
      ${persons ? `<h3 class="h3">${t(c.point === 'origen' ? 'confirm.origin' : 'confirm.dest')}</h3>
        ${persons.map((p, i) => `<label class="persona"><input type="radio" name="persona_rut" value="${p.rut}" ${i === 0 ? 'checked' : ''}><span><b>${esc(p.nombre)}</b><br><span class="mono small">${p.rut}</span> · <span class="small">${esc(p.telefono)}</span></span></label>`).join('')}
        <label class="check"><input type="checkbox" name="id_verificado"><span>${t('confirm.idcheck')}</span></label>
        <div><div class="row between small" style="margin-bottom:6px"><span class="muted">${t('confirm.sig')}</span><button class="link" data-act="sig-clear" type="button">${t('confirm.clear')}</button></div><canvas class="sig" id="sig" aria-label="${esc(t('sig.aria'))}"></canvas></div>` : ''}
      <button class="btn block">${ic('shield')}${t('confirm.btn')}</button></form>` : `<p class="small muted">${t('scan.needAll')}</p>`}
  </div>`;
}

function orderView(id) {
  const u = U();
  let o; try { o = S.orderDetail(u, id); } catch { return `<div class="card" style="margin-top:8px">${t('ord.notfound')} <a class="link" href="#/">${t('back')}</a></div>`; }
  const merchant = u.rol === 'merchant', next = o.status !== 'entregada' ? S.nextActor(o) : null;
  const sigs = ['entrega', 'recepcion'].filter((k) => o.handoff[k].firma_url), evs = S.events(u, o.id);
  const head = `<div class="card"><div class="row between" style="margin-bottom:14px"><div><div class="h3">${t('sec.progress')}</div><h2 class="mono" style="font-size:22px">${num(o.id)}</h2></div>${chip(o, u)}</div>${routeBlock(o, u)}
    <div class="small muted" style="margin-top:16px;line-height:1.6">${esc(o.bodega_origen.direccion.direccion)}, ${esc(o.bodega_origen.direccion.comuna)}<br>${esc(o.bodega_destino.direccion.direccion)}, ${esc(o.bodega_destino.direccion.comuna)}<br>
    ${pkgLabel(o.bultos_total)} · ${t('ord.created', { date: fmt(o.created_at) })}${o.referencia_cliente ? ' · ' + t('ord.ref', { ref: esc(o.referencia_cliente) }) : ''}${o.operacion.operador_id ? '<br>' + t('ord.operator', { name: esc(S.list('operators').find((p) => p.id === o.operacion.operador_id).nombre) }) : ''}</div></div>`;
  const custody = !merchant ? `<div class="card"><h3 class="h3" style="margin-bottom:14px">${t('sec.custody')}</h3><ul class="tl">${STEPS.map((s, i) => {
    const tt = o.timeline.find((x) => x.step === s), who = tt ? S.userById(tt.actor_id) : null, cur = STEPS.indexOf(o.status), fin = o.status === 'entregada';
    return `<li class="${fin && i === 7 ? 'fin done' : i < cur || (fin && i <= cur) ? 'done' : i === cur ? 'now' : 'todo'}">${t('st.' + s)}<small>${tt ? `${fmt(tt.at)} · ${esc(who ? who.nombre.split(' (')[0] : tt.actor_role)}` : t('act.' + s)}</small></li>`;
  }).join('')}</ul></div>` : '';
  const pk = `<div class="card"><div class="card-h"><h2>${t('sec.packages')}</h2><span class="pill">${o.paquetes.length}</span></div>${o.paquetes.map((p) => `<div class="pkg"><span><span class="code">${p.piece_code}</span><br><span class="d">${esc(p.descripcion)} · ${p.peso_kg} ${t('unit.kg')}</span></span>
      <span class="r">${p.scan_history.length ? p.scan_history.map((s) => `<span class="pill ${s.manual ? 'manual' : 'scan'}">${t('cp.' + s.checkpoint)}</span>`).join('') : `<span class="pill">${t('pkg.pending')}</span>`}</span></div>`).join('')}
      <a class="btn ghost sm" style="margin-top:12px" href="#/labels/${o.id}">${ic('print', 'sm')}${t('labels.btn')}</a></div>`;
  const hint = next && next.id !== me ? `<div class="hint">${ic('user')}<span>${t('ord.next', { name: `<b>${esc(next.nombre.split(' (')[0])}</b>`, role: esc(roleName(next.rol)) })} <button class="link" data-act="switch" data-id="${next.id}">${t('ord.switchTo')}</button></span></div>` : '';
  const auth = `<div class="card stack"><h3 class="h3">${t('sec.authorized')}</h3>${['origen', 'destino'].map((k) => `<div><b>${t(k === 'origen' ? 'sec.origin' : 'sec.dest')}</b>${o.personas_autorizadas[k].map((p) => `<div class="small muted" style="margin-top:3px">${esc(p.nombre)} · <span class="mono">${p.rut}</span> · ${esc(p.telefono)}</div>`).join('')}</div>`).join('')}</div>`;
  const sg = sigs.length ? `<div class="card stack"><h3 class="h3">${t('sec.signatures')}</h3>${sigs.map((k) => `<div><b>${t(k === 'entrega' ? 'sig.origin' : 'sig.dest')}</b><div class="small muted">${esc(o.handoff[k].persona_autorizada)} · ${fmt(o.handoff[k].at)}</div><img class="sigimg" alt="" src="${o.handoff[k].firma_url}"></div>`).join('')}</div>` : '';
  const ev = `<details class="card"><summary style="font-weight:600;cursor:pointer">${t('sec.events')} (${evs.length})</summary><ul class="feed" style="margin-top:12px">${evs.map((e) => `<li><div><b>${t('ev.' + e.type)}</b><span class="s">${fmt(e.at)} · ${esc((S.userById(e.actor_id) || {}).nombre || e.actor_id)}<br>${esc(tNote(e.note))}</span></div></li>`).join('')}</ul></details>`;
  const back = `<div style="padding-bottom:14px"><a class="btn ghost sm" href="#/${merchant ? 'orders' : ''}">${ic('back', 'sm')}${t('back')}</a></div>`;
  return `${back}<div class="dash"><div class="cols"><div class="col">${blk(head, 0, 1)}${blk(custody, 2, 4)}${blk(pk, 3, 5)}</div>
    <div class="col">${blk(hint, 1, 0)}${blk(actionPanel(o, u), 1, 2)}${blk(auth, 3, 6)}${blk(sg, 4, 7)}${blk(ev, 5, 8)}</div></div></div>`;
}

function labels(id) {
  let o; try { o = S.orderDetail(U(), id); } catch { return `<div class="card">${t('ord.notfound')}</div>`; }
  return `<div class="row between noprint" style="padding-bottom:12px"><a class="btn ghost sm" href="#/order/${o.id}">${ic('back', 'sm')}${t('back')}</a><button class="btn sm" data-act="print">${ic('print', 'sm')}${t('lab.print')}</button></div>
    <p class="small muted noprint" style="padding-bottom:14px">${t('lab.hint')}</p>
    <div class="labels">${o.paquetes.map((p, i) => `<div class="label"><div class="row between"><span class="big">${num(o.id)}</span><span class="small">${t('lab.pkgOf', { i: i + 1, n: o.paquetes.length })}</span></div>
      ${code39(p.piece_code)}<div class="mono" style="text-align:center;font-weight:600">${p.piece_code}</div>
      <div class="small">${esc(o.bodega_origen.nombre)} → <b>${esc(o.bodega_destino.nombre)}</b><br>${esc(o.bodega_destino.direccion.direccion)}, ${esc(o.bodega_destino.direccion.comuna)}<br>${esc(p.descripcion)} · ${p.peso_kg} ${t('unit.kg')}</div></div>`).join('')}</div>`;
}

// ---- merchant: wizard -------------------------------------------------------------------------------------------------------------
const bodegas = () => S.bootstrap(U()).merchant.bodegas;
const bodegaById = (id) => bodegas().find((b) => b.id === id);
const blankPerson = () => ({ nombre: '', rut: '', telefono: '' });
const newW = () => {
  const bs = bodegas(), def = bs.find((b) => b.es_origen_default) || bs[0];
  return { step: 1, ciudad: def.ciudad, origen: def.id, destino: '', ref: '', filled: {}, personas: { origen: [], destino: [] }, paquetes: [{ descripcion: '', peso_kg: '', valor: '' }], done: null };
};
const fld = (label, attr, val, extra = '') => `<label class="f">${label}<input ${attr} value="${esc(val)}" ${extra}></label>`;
const personRow = (side, i, p) => `<div class="prow">${fld(t('w.name'), `data-bind="personas.${side}.${i}.nombre" autocomplete="off"`, p.nombre)}
  ${fld(t('w.rut'), `data-bind="personas.${side}.${i}.rut" data-rutcheck autocomplete="off"`, p.rut, p.rut && !rutValid(p.rut) ? 'class="bad"' : '')}
  ${fld(t('w.phone'), `data-bind="personas.${side}.${i}.telefono" inputmode="tel" autocomplete="off"`, p.telefono)}</div>`;
const blankNB = () => ({ nombre: '', ciudad: '', direccion: { region: '', comuna: '', direccion: '' }, contactos: [{ nombre: '', rut: '', telefono: '' }, { nombre: '', rut: '', telefono: '' }] });
const nbv = (k) => k.split('.').reduce((a, x) => a?.[x], NB) ?? '';
function bodegaForm() {
  const i = (lbl, k, extra = '') => fld(t(lbl), `data-bindnb="${k}"`, nbv(k), extra);
  return `<div class="card stack"><h2>${t('nb.title')}</h2>${i('nb.name', 'nombre')}
    <div class="grid2">${i('nb.city', 'ciudad')}${i('nb.region', 'direccion.region')}</div><div class="grid2">${i('nb.comuna', 'direccion.comuna')}${i('nb.street', 'direccion.direccion')}</div>
    <h3 class="h3">${t('nb.people')}</h3>${NB.contactos.map((_, n) => `<div class="prow">${fld(t('w.name'), `data-bindnb="contactos.${n}.nombre"`, nbv(`contactos.${n}.nombre`))}${fld(t('w.rut'), `data-bindnb="contactos.${n}.rut"`, nbv(`contactos.${n}.rut`))}${fld(t('w.phone'), `data-bindnb="contactos.${n}.telefono" inputmode="tel"`, nbv(`contactos.${n}.telefono`))}</div>`).join('')}
    <div class="row"><button class="btn ghost" data-act="nb-cancel" type="button">${t('nb.cancel')}</button><button class="btn" data-act="nb-save" type="button">${t('nb.save')}</button></div></div>`;
}
function wizSummary() {
  const o = bodegaById(W.origen), d = bodegaById(W.destino);
  const kg = W.paquetes.reduce((s, p) => s + (Number(String(p.peso_kg).replace(',', '.')) || 0), 0);
  const ok = (a) => a.filter((p) => p.nombre && rutValid(p.rut)).length;
  return `<div class="card"><h2 style="margin-bottom:8px">${t('w.sumTitle')}</h2>
    <div class="kv"><span class="muted">${t('w.sumRoute')}</span><b>${esc(o.ciudad)} → ${d ? esc(d.ciudad) : t('w.sumEmpty')}</b></div>
    <div class="kv"><span class="muted">${t('w.sumPeople')}</span><b>${W.step > 1 ? `${ok(W.personas.origen)} + ${ok(W.personas.destino)}` : t('w.sumEmpty')}</b></div>
    <div class="kv"><span class="muted">${t('w.sumPkgs')}</span><b>${W.paquetes.length}</b></div>
    <div class="kv"><span class="muted">${t('w.sumWeight')}</span><b class="mono">${kg.toFixed(1)} ${t('unit.kg')}</b></div>
    <p class="helper" style="margin-top:8px">${t('w.summary')}</p></div>`;
}
function wizard() {
  if (!W) W = newW();
  if (W.done) return `<div class="card stack done-card"><span class="done-ic">${ic('check', 'lg')}</span><h2 style="font-size:22px">${t('w.doneTitle', { code: num(W.done.id) })}</h2>
    <p class="muted">${pkgLabel(W.done.bultos_total)} · ${esc(W.done.bodega_origen.nombre)} → ${esc(W.done.bodega_destino.nombre)}.<br>${t('w.doneBody')}</p>
    <div class="stack" style="width:100%;max-width:340px"><a class="btn" href="#/labels/${W.done.id}">${ic('print')}${t('w.printLabels')}</a><a class="btn ghost" href="#/order/${W.done.id}">${t('w.viewOrder')}</a><button class="btn ghost" data-act="w-new">${t('w.another')}</button></div></div>`;
  const bs = bodegas(), cities = [...new Set(bs.map((b) => b.ciudad))];
  const stepper = `<div class="stepper" role="list">${[1, 2, 3].map((n) => `<div class="st ${n === W.step ? 'on' : n < W.step ? 'done' : ''}" role="listitem" ${n === W.step ? 'aria-current="step"' : ''}><b>${n < W.step ? ic('check', 'sm') : n}</b><span>${t('w.s' + n)}</span></div>`).join('')}</div>`;
  let body = '';
  if (W.step === 1) {
    const inCity = bs.filter((b) => b.ciudad === W.ciudad), dest = bs.filter((b) => b.id !== W.origen);
    body = `<div class="card stack"><h3 class="h3">${t('w.origin')}</h3>
      ${bs.length === 1 ? `<div class="row">${ic('warehouse')}<div><b>${esc(bs[0].nombre)}</b><div class="small muted">${esc(bs[0].direccion.direccion)}, ${esc(bs[0].ciudad)}</div></div></div>` : `<div class="grid2">
        <label class="f">${t('w.city')}<select data-change="w-ciudad">${cities.map((c) => `<option ${c === W.ciudad ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        <label class="f">${t('w.originWh')}<select data-change="w-origen">${inCity.map((b) => `<option value="${b.id}" ${b.id === W.origen ? 'selected' : ''}>${esc(b.nombre)}</option>`).join('')}</select></label></div>`}</div>
      <div class="card stack"><h3 class="h3">${t('w.destination')}</h3>
      <label class="f">${t('w.destWh')}<select data-change="w-destino"><option value="">${t('w.select')}</option>${dest.map((b) => `<option value="${b.id}" ${b.id === W.destino ? 'selected' : ''}>${esc(b.ciudad)} · ${esc(b.nombre)}</option>`).join('')}<option value="__new">${t('w.newWh')}</option></select></label></div>
      ${NB ? bodegaForm() : ''}
      <div class="card">${fld(t('w.ref'), 'data-bind="ref" autocomplete="off"', W.ref, `placeholder="${esc(t('w.refPh'))}"`)}</div>`;
  } else if (W.step === 2) {
    body = `<p class="helper">${t('w.persHelp')}</p>${['origen', 'destino'].map((side) => `<div class="card stack"><h3 class="h3">${t(side === 'origen' ? 'w.hands' : 'w.receives', { name: esc(bodegaById(side === 'origen' ? W.origen : W.destino).nombre) })}</h3>
        ${W.personas[side].map((p, i) => personRow(side, i, p)).join('')}<div><button class="link" data-act="w-add-person" data-side="${side}" type="button">+ ${t('w.addPerson')}</button></div></div>`).join('')}`;
  } else {
    body = `${W.paquetes.map((p, i) => `<div class="card stack"><div class="row between"><h3 class="h3">${t('w.pkg', { n: i + 1 })}</h3><span><button class="link" data-act="w-dup" data-i="${i}" type="button">${t('w.dup')}</button>${W.paquetes.length > 1 ? ` · <button class="link" data-act="w-del" data-i="${i}" type="button">${t('w.del')}</button>` : ''}</span></div>
      <div class="prow">${fld(t('w.content'), `data-bind="paquetes.${i}.descripcion" autocomplete="off"`, p.descripcion)}${fld(t('w.weight'), `data-bind="paquetes.${i}.peso_kg" inputmode="decimal"`, p.peso_kg)}${fld(t('w.value'), `data-bind="paquetes.${i}.valor" inputmode="numeric"`, p.valor)}</div></div>`).join('')}
      <button class="btn ghost" data-act="w-add-pkg" type="button">${ic('plus')}${t('w.addPkg')}</button>`;
  }
  const nav = `<div class="row">${W.step > 1 ? `<button class="btn ghost" data-act="w-back" type="button">${t('w.back')}</button>` : ''}<button class="btn" style="flex:1" data-act="${W.step === 3 ? 'w-submit' : 'w-next'}" type="button">${W.step === 3 ? t('w.create') : t('w.next')}${ic('arrow')}</button></div>`;
  return `${stepper}<div class="wz" style="margin-top:14px"><div class="stack">${body}${nav}</div><div class="only-desktop sticky" id="wsum">${wizSummary()}</div></div>`;
}

function account() {
  const m = S.bootstrap(U()).merchant;
  return `<div class="stack"><div class="card row between" style="gap:16px"><div><h2 style="font-size:20px">${esc(m.razon_social)}</h2><div class="small muted">RUT ${m.rut} · ${t('acc.plan', { plan: esc(m.plan) })}<br>${t('acc.billing')}</div></div><span class="avatar" style="width:52px;height:52px;border-radius:16px">${ic('warehouse')}</span></div>
    <div class="row between"><h2>${t('acc.myWh', { n: m.bodegas.length })}</h2>${NB ? '' : `<button class="btn sm" data-act="nb-open">${ic('plus', 'sm')}${t('acc.add')}</button>`}</div>
    ${NB ? bodegaForm() : ''}
    <div class="whgrid">${m.bodegas.map((b) => `<div class="card"><div class="row between"><b>${esc(b.nombre)}</b>${b.es_origen_default ? `<span class="pill scan">${t('acc.default')}</span>` : ''}</div>
      <div class="small muted" style="margin:4px 0 10px">${ic('pin', 'sm')} ${esc(b.direccion.direccion)}, ${esc(b.direccion.comuna)} · ${esc(b.ciudad)}</div>
      ${b.contactos.map((c) => `<div class="small" style="margin-top:6px">${ic('user', 'sm')} ${esc(c.nombre)} · <span class="mono">${c.rut}</span> · ${esc(c.telefono)}</div>`).join('')}</div>`).join('')}</div></div>`;
}

// ---- shell: sidebar / top / tab bar / router ---------------------------------------------------------------------------------------------
function navItems(u) {
  const todo = S.listOrders(u).filter((o) => actionable(u, o)).length;
  return u.rol === 'merchant'
    ? [['', 'dash', 'nav.dashboard'], ['orders', 'list', 'nav.orders'], ['new', 'plus', 'nav.new', 'cta'], ['account', 'warehouse', 'nav.account']]
    : [['', 'dash', 'nav.tasks', '', todo], ['all', 'list', 'nav.all']];
}
function render() {
  const u = U(), merchant = u.rol === 'merchant';
  let [route, arg] = location.hash.replace(/^#\/?/, '').split('/');
  if (route === 'all' && merchant) route = 'orders';
  if (route === 'orders' && !merchant) route = 'all';
  if ((route === 'new' || route === 'account') && !merchant) route = '';
  const key = [route, arg, me, getLang(), document.body.dataset.view].join('|');
  animateNow = key !== lastKey; lastKey = key;
  const active = route === 'order' || route === 'labels' ? (merchant ? 'orders' : '') : route;
  const items = navItems(u);
  const label = (k) => (k === 'nav.new' ? t('cta.new') : t(k));

  $('#side').innerHTML = `<div class="logo"><span class="mark">${ic('truck')}</span><span>kargo<b>.</b>cl</span></div><div class="nav-l">${t('nav.aria')}</div>
    <nav aria-label="${esc(t('nav.aria'))}">${items.map(([r, i, k, , badge]) => `<a href="#/${r}" class="${r === active ? 'on' : ''}" ${r === active ? 'aria-current="page"' : ''}>${ic(i)}<span>${label(k)}</span>${badge ? `<span class="badge">${badge}</span>` : ''}</a>`).join('')}</nav>
    <div class="side-user"><span class="avatar">${initials(u.nombre)}</span><div><b>${esc(u.nombre.split(' (')[0])}</b><span>${esc(roleName(u.rol))}</span></div></div>`;

  const titles = { '': merchant ? t('nav.dashboard') : t('nav.tasks'), orders: t('orders.all'), all: t('orders.all'), new: t('w.title'), account: t('nav.account'), order: arg ? num(arg) : '', labels: arg ? num(arg) : '' };
  $('#top').innerHTML = `<div class="tt"><div class="crumb">${esc(roleName(u.rol))}</div><h1>${esc(titles[route] ?? '')}</h1></div>
    <div class="logo"><span class="mark">${ic('truck')}</span><span>kargo<b>.</b>cl</span></div>
    <div class="row">${merchant && route !== 'new' ? `<a class="btn only-desktop flex" href="#/new">${ic('plus')}${t('cta.new')}</a>` : ''}<div class="row only-mobile" style="gap:10px"><div class="whos" style="text-align:right;font-size:12px;line-height:1.2;color:var(--muted)"><b style="display:block;color:var(--ink);font-size:13px">${esc(u.nombre.split(' (')[0].split(' ')[0])}</b>${esc(roleName(u.rol).split(' ')[0])}</div><span class="avatar">${initials(u.nombre)}</span></div></div>`;

  $('#tabbar').innerHTML = items.map(([r, i, k, cls, badge]) => cls === 'cta'
    ? `<a href="#/${r}" class="cta" aria-label="${esc(label(k))}"><span class="plus">${ic(i, 'lg')}</span><span>${t(k)}</span></a>`
    : `<a href="#/${r}" class="${r === active ? 'on' : ''}" ${r === active ? 'aria-current="page"' : ''}>${ic(i)}<span>${t(k)}</span>${badge ? `<span class="badge" aria-label="${badge}">${badge}</span>` : ''}</a>`).join('');
  $('#tabbar').setAttribute('aria-label', t('nav.aria'));

  const views = { '': dashboard, orders: ordersView, all: ordersView, order: () => orderView(arg), labels: () => labels(arg), new: wizard, account };
  $('#view').innerHTML = (views[route] || dashboard)();
  initSignature();
  countUp();
  const f = $('#view form[data-form=scan] input'); if (f && animateNow === false) f.focus({ preventScroll: true });
}
function countUp() {
  if (!animateNow || reduced() || document.documentElement.classList.contains('still')) return;
  $$('[data-count]').forEach((el) => {
    const n = +el.dataset.count; if (!n) return;
    const t0 = performance.now();
    el.textContent = '0';
    const tick = (now) => { const p = Math.min(1, (now - t0) / 800); el.textContent = Math.round(n * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}
addEventListener('hashchange', () => { const v = $('#view'); v.scrollTop = 0; render(); v.focus({ preventScroll: true }); });

// ---- signature pad ------------------------------------------------------------------------------------------------------------------------
function initSignature() {
  const cv = $('#sig'); sigDrawn = false;
  if (!cv) return;
  const r = cv.getBoundingClientRect(); cv.width = r.width * 2; cv.height = r.height * 2;
  const g = cv.getContext('2d'); g.scale(2, 2); g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#0B1B2E';
  let down = false;
  const pt = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  cv.onpointerdown = (e) => { down = true; try { cv.setPointerCapture(e.pointerId); } catch { /* synthetic events */ } g.beginPath(); g.moveTo(...pt(e)); };
  cv.onpointermove = (e) => { if (!down) return; g.lineTo(...pt(e)); g.stroke(); sigDrawn = true; };
  cv.onpointerup = () => { down = false; };
}

// ---- events -----------------------------------------------------------------------------------------------------------------------------------------
const setPath = (obj, path, val) => { const k = path.split('.'); const last = k.pop(); k.reduce((a, x) => a[x], obj)[last] = val; };
const currentId = () => location.hash.split('/')[2];

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.id === 'q') { query = el.value; const p = el.selectionStart; render(); const q = $('#q'); q.focus(); q.setSelectionRange(p, p); return; }
  if (el.dataset.bind && W) { setPath(W, el.dataset.bind, el.value); const s = $('#wsum'); if (s) s.innerHTML = wizSummary(); }
  if (el.dataset.bindnb && NB) setPath(NB, el.dataset.bindnb, el.value);
  if (el.dataset.rutcheck !== undefined) el.classList.toggle('bad', !!el.value && !rutValid(el.value));
});
document.addEventListener('change', (e) => {
  const el = e.target, a = el.dataset.change;
  if (el.id === 'who') return switchUser(el.value);
  if (a === 'w-ciudad') { W.ciudad = el.value; W.origen = bodegas().find((b) => b.ciudad === el.value).id; if (W.destino === W.origen) W.destino = ''; render(); }
  if (a === 'w-origen') { W.origen = el.value; if (W.destino === W.origen) W.destino = ''; render(); }
  if (a === 'w-destino') { if (el.value === '__new') { NB = blankNB(); W.destino = ''; } else W.destino = el.value; render(); }
});

const forms = {
  assign: (f) => run(() => S.assign(U(), currentId(), { operador_id: f.get('operador_id') }), 'assign.ok'),
  pickup: (f) => run(() => S.pickup(U(), currentId(), { conductor_id: f.get('conductor_id'), movil_patente: f.get('movil_patente') }), 'pickup.ok'),
  transport: (f) => run(() => S.transport(U(), currentId(), { servicio_id: f.get('servicio_id'), conductor_id: f.get('conductor_id') }), 'transport.ok'),
  scan: (f) => run(() => S.scan(U(), currentId(), { piece_code: f.get('piece_code') }), 'scan.ok'),
  confirm: (f) => {
    if ($('#sig') && !sigDrawn) return toast(t('confirm.needSig'), 'err');
    const firma = $('#sig') ? $('#sig').toDataURL('image/png') : undefined;
    run(() => S.confirm(U(), currentId(), { persona_rut: f.get('persona_rut'), id_verificado: f.get('id_verificado') === 'on', firma }), 'confirm.ok');
  },
};
document.addEventListener('submit', (e) => { const fn = forms[e.target.dataset.form]; if (!fn) return; e.preventDefault(); fn(new FormData(e.target)); });

const ORDER = () => S.orderDetail(U(), currentId());
const acts = {
  switch: (el) => switchUser(el.dataset.id),
  print: () => window.print(),
  filter: (el) => { filter = el.dataset.f; render(); },
  'sig-clear': () => initSignature(),
  'scan-one': (el) => run(() => S.scan(U(), currentId(), { piece_code: el.dataset.code }), 'scan.ok'),
  'scan-all': () => run(() => { const o = ORDER(); o.paquetes.filter((p) => !p.scan_history.some((s) => s.checkpoint === o.checkpoint_actual)).forEach((p) => S.scan(U(), currentId(), { piece_code: p.piece_code })); }, 'scan.allOk'),
  manual: (el) => { const reason = prompt(t('scan.manualPrompt')); if (reason) run(() => S.scan(U(), currentId(), { piece_code: el.dataset.code, manual: true, reason }), 'scan.manualOk'); },
  'w-back': () => { W.step--; render(); },
  'w-next': () => {
    if (W.step === 1) {
      if (!W.destino) return toast(t('w.pickDest'), 'err');
      const fill = (side, id) => { if (W.filled[side] !== id) { W.personas[side] = bodegaById(id).contactos.map(({ nombre, rut, telefono }) => ({ nombre, rut, telefono })); W.filled[side] = id; } };
      fill('origen', W.origen); fill('destino', W.destino);
    }
    W.step++; render();
  },
  'w-add-person': (el) => { W.personas[el.dataset.side].push(blankPerson()); render(); },
  'w-add-pkg': () => { W.paquetes.push({ descripcion: '', peso_kg: '', valor: '' }); render(); },
  'w-dup': (el) => { W.paquetes.splice(+el.dataset.i + 1, 0, { ...W.paquetes[+el.dataset.i] }); render(); },
  'w-del': (el) => { W.paquetes.splice(+el.dataset.i, 1); render(); },
  'w-new': () => { W = newW(); render(); },
  'w-submit': () => {
    const clean = (arr) => arr.filter((p) => p.nombre || p.rut || p.telefono);
    try {
      W.done = S.createOrder(U(), {
        bodega_origen_id: W.origen, bodega_destino_id: W.destino, referencia_cliente: W.ref,
        personas_autorizadas: { origen: clean(W.personas.origen), destino: clean(W.personas.destino) },
        paquetes: W.paquetes.map((p) => ({ descripcion: p.descripcion, peso_kg: Number(String(p.peso_kg).replace(',', '.')), valor_declarado_clp: p.valor === '' ? null : Number(p.valor) })),
      });
      toast(t('w.created'));
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
      toast(tErr(e.message), 'err');
      if (/^(Origen|Destino):/.test(e.message)) W.step = 2; else if (/^Bulto|bulto/.test(e.message)) W.step = 3;
    }
    render();
  },
  'nb-open': () => { NB = blankNB(); render(); },
  'nb-cancel': () => { NB = null; render(); },
  'nb-save': () => run(() => { const b = S.addBodega(U(), NB); NB = null; if (W) W.destino = b.id; }, 'nb.saved'),
};
document.addEventListener('click', (e) => {
  const lg = e.target.closest('[data-lang]'); if (lg) return changeLang(lg.dataset.lang);
  const vm = e.target.closest('[data-viewmode]'); if (vm) return changeView(vm.dataset.viewmode);
  const a = e.target.closest('[data-act]'); if (a) return acts[a.dataset.act]?.(a);
  const row = e.target.closest('tr[data-href]'); if (row && !e.target.closest('a')) location.hash = row.dataset.href;
});
$('#reset').addEventListener('click', () => { if (confirm(t('demo.resetConfirm'))) boot(true); });

// ---- init ---------------------------------------------------------------------------------------------------------------------------------------------
// Deep links for demos: ?as=usr_c01&lang=en&view=mobile (they also become the saved preference)
const qp = new URLSearchParams(location.search);
if (qp.get('lang')) store('lang', qp.get('lang'));
if (['mobile', 'desktop'].includes(qp.get('view'))) store('view', qp.get('view'));
if (qp.get('as')) store('me', qp.get('as'));
if (qp.get('still')) document.documentElement.classList.add('still'); // no animation (for screenshots)
setLang(load('lang') === 'en' ? 'en' : 'es');
viewPref = load('view') || (innerWidth >= 900 ? 'desktop' : 'mobile');
applyStatic();
boot();
