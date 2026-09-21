// KARGO mockup UI. Vanilla JS, no build. State = web/store.js rules over data/*.json, persisted in localStorage.
// ponytail: full re-render on every action (fine at demo scale); Code 39 barcode instead of QR; window.prompt for manual-scan reason.
import { createStore, HttpError, rutValid, FILES, CP } from './store.js';

const LS_DB = 'kargo-mock-db-v1', LS_ME = 'kargo-mock-me';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const num = (id) => 'OT-' + id.replace('ot_', '');

const ROLE_GUIDE = {
  merchant: 'Tu trabajo termina al crear la orden. Aquí solo ves el avance, sin la complejidad operativa.',
  coordinador_logistico: 'Recibes las órdenes creadas y las asignas a un operador de transporte.',
  operador_despachador: 'Recibes la asignación y designas conductor y móvil para la recolección.',
  operador_conductor_recoleccion: 'Vas a la bodega de origen, escaneas cada bulto y recibes la firma de una persona autorizada.',
  operador_encargado_bodega: 'Escaneas cada bulto al ingresar a tu bodega y luego asignas el bus / servicio.',
  operador_conductor_bus: 'Escaneas cada bulto al cargarlo al bus que te asignaron.',
  operador_conductor_entrega: 'En destino escaneas cada bulto y recibes la firma de una persona autorizada.',
};
const STATUS = {
  creada: 'Creada', asignada_operador: 'Asignada a operador', recoleccion_asignada: 'Recolección asignada', recolectada: 'Recolectada en origen',
  en_bodega_operador: 'En bodega del operador', asignada_transporte: 'Asignada a bus', cargada_bus: 'Cargada en bus', entregada: 'Entregada',
};
const STEP_ACTOR = { creada: 'Merchant', asignada_operador: 'Coordinador', recoleccion_asignada: 'Despachador', recolectada: 'Conductor de recolección', en_bodega_operador: 'Encargado de bodega', asignada_transporte: 'Encargado de bodega', cargada_bus: 'Conductor de bus', entregada: 'Conductor de entrega' };
const SIMPLE = ['Creada', 'Asignada', 'En recolección', 'En tránsito', 'Entregada'];
const CP_LABEL = { recoleccion: 'Recolección', ingreso_bodega_op: 'Ingreso a bodega', carga_bus: 'Carga a bus', entrega: 'Entrega' };

let S, me, W = null, NB = null, sigDrawn = false, query = '';

// ---- boot / persistence ---------------------------------------------------
async function loadDb(reset) {
  if (!reset) { try { const s = localStorage.getItem(LS_DB); if (s) return JSON.parse(s); } catch { /* ignore */ } }
  const db = {};
  await Promise.all(Object.entries(FILES).map(async ([n, [f]]) => { db[n] = await (await fetch('/data/' + f)).json(); }));
  return db;
}
const persist = () => { try { localStorage.setItem(LS_DB, JSON.stringify(S.db)); } catch { toast('No se pudo guardar el estado local', 'err'); } };

async function boot(reset = false) {
  try {
    S = createStore(await loadDb(reset), persist);
  } catch {
    $('#view').innerHTML = '<div class="card"><h2>No se pudieron leer los datos</h2><p class="soft">Abre el mockup con <span class="mono">npm start</span> (o <span class="mono">python -m http.server</span> desde la raíz) y entra a <span class="mono">http://localhost:3000</span>. Los navegadores bloquean leer JSON desde un archivo suelto.</p></div>';
    return;
  }
  if (reset) { localStorage.removeItem(LS_ME); W = NB = null; }
  const saved = localStorage.getItem(LS_ME);
  me = S.userById(saved) ? saved : S.list('users')[0].id;
  buildWho();
  location.hash = '#/';
  render();
}
const U = () => S.userById(me);
const roleName = (rol) => S.list('roles').find((r) => r.id === rol)?.nombre || rol;

function buildWho() {
  const groups = {};
  S.list('users').forEach((u) => (groups[u.rol] = groups[u.rol] || []).push(u));
  $('#who').innerHTML = Object.entries(groups).map(([rol, us]) => `<optgroup label="${esc(roleName(rol))}">${us.map((u) => {
    const op = u.operador_id ? ' · ' + S.list('operators').find((o) => o.id === u.operador_id).nombre.split(' ')[0] : '';
    return `<option value="${u.id}" ${u.id === me ? 'selected' : ''}>${esc(u.nombre)}${esc(op)}</option>`;
  }).join('')}</optgroup>`).join('');
}
function switchUser(id) {
  me = id; localStorage.setItem(LS_ME, id); W = NB = null; buildWho(); location.hash = '#/'; render();
}

// ---- helpers ----------------------------------------------------------------
let toastT;
function toast(msg, kind = '') {
  const t = $('#toast'); t.textContent = msg; t.className = 'show ' + kind;
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = ''), 3200);
}
function run(fn, ok) {
  try { const r = fn(); if (ok) toast(ok); return r; } catch (e) {
    if (e instanceof HttpError) toast(e.message, 'err'); else { console.error(e); toast('Error inesperado', 'err'); }
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
const chip = (o, u = U()) => {
  const label = u.rol === 'merchant' ? o.estado_merchant : STATUS[o.status];
  return `<span class="chip c-${o.estado_merchant.split(' ')[0]}">${esc(label)}</span>`;
};

// Code 39 (hardware scanners read it like keyboard input). Real system: print QR/Code128 from the backend.
const C39 = { 0: 'nnnwwnwnn', 1: 'wnnwnnnnw', 2: 'nnwwnnnnw', 3: 'wnwwnnnnn', 4: 'nnnwwnnnw', 5: 'wnnwwnnnn', 6: 'nnwwwnnnn', 7: 'nnnwnnwnw', 8: 'wnnwnnwnn', 9: 'nnwwnnwnn', A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn', K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn', U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn' };
function code39(text) {
  let x = 0, bars = '';
  for (const ch of '*' + text + '*') {
    [...C39[ch]].forEach((w, i) => { const wd = w === 'w' ? 3 : 1; if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${wd}" height="40"/>`; x += wd; });
    x += 1;
  }
  return `<svg viewBox="0 0 ${x} 40" preserveAspectRatio="none" aria-label="${esc(text)}">${bars}</svg>`;
}

// ---- views ------------------------------------------------------------------
function orderCard(o, todo) {
  const u = U();
  return `<a class="card order ${todo ? 'todo' : ''}" href="#/order/${o.id}">
    <div class="row between"><span class="code">${num(o.id)}</span>${chip(o, u)}</div>
    <div class="route">${esc(o.bodega_origen.nombre)} <i>→</i> ${esc(o.bodega_destino.nombre)}</div>
    <div class="small soft">${o.bultos_total} bulto${o.bultos_total > 1 ? 's' : ''} · ${fmt(o.created_at)}${o.referencia_cliente ? ' · ' + esc(o.referencia_cliente) : ''}</div>
    ${todo ? '<div class="small" style="margin-top:6px;color:var(--accent);font-weight:700">Te toca actuar →</div>' : ''}
  </a>`;
}

function home() {
  const u = U(), orders = S.listOrders(u);
  const guide = `<div class="guide"><b>${esc(roleName(u.rol))}.</b> ${esc(ROLE_GUIDE[u.rol])}</div>`;
  if (u.rol === 'merchant') {
    const q = query.trim().toLowerCase();
    const shown = orders.filter((o) => !q || (num(o.id) + o.bodega_destino.nombre + o.bodega_origen.nombre + (o.referencia_cliente || '')).toLowerCase().includes(q));
    const active = orders.filter((o) => o.status !== 'entregada').length;
    return `${guide}
      <div class="kpis"><div class="kpi"><b>${orders.length}</b><span>Órdenes</span></div><div class="kpi"><b>${active}</b><span>En curso</span></div><div class="kpi"><b>${orders.length - active}</b><span>Entregadas</span></div></div>
      <input id="q" type="search" placeholder="Buscar OT, bodega o referencia" value="${esc(query)}" aria-label="Buscar">
      ${shown.map((o) => orderCard(o)).join('') || '<p class="soft">Sin resultados.</p>'}`;
  }
  const todo = orders.filter((o) => actionable(u, o)), rest = orders.filter((o) => !actionable(u, o));
  return `${guide}
    <h3>Te toca actuar (${todo.length})</h3>
    ${todo.map((o) => orderCard(o, true)).join('') || '<p class="soft">Nada pendiente para este usuario. Cambia de usuario arriba para seguir el flujo.</p>'}
    <h3>Otras órdenes (${rest.length})</h3>
    ${rest.map((o) => orderCard(o)).join('') || '<p class="soft">Sin otras órdenes.</p>'}`;
}

function timeline(o, u) {
  if (u.rol === 'merchant') {
    const idx = SIMPLE.indexOf(o.estado_merchant);
    return `<ul class="tl">${SIMPLE.map((s, i) => `<li class="${i < idx || (i === idx && o.status === 'entregada') ? 'done' : i === idx ? 'now' : 'todo'}">${s}</li>`).join('')}</ul>`;
  }
  const order = Object.keys(STATUS), at = Object.fromEntries(o.timeline.map((t) => [t.step, t]));
  const cur = order.indexOf(o.status);
  return `<ul class="tl">${order.map((s, i) => {
    const t = at[s], who = t ? S.userById(t.actor_id) : null;
    return `<li class="${i < cur || (i === cur && s === 'entregada') ? 'done' : i === cur ? 'now' : 'todo'}">${STATUS[s]}${t ? `<small>${fmt(t.at)} · ${esc(who ? who.nombre : t.actor_role)}</small>` : `<small>${STEP_ACTOR[s]}</small>`}</li>`;
  }).join('')}</ul>`;
}

function actionPanel(o, u) {
  const c = CP[o.status];
  if (u.rol === 'coordinador_logistico' && o.status === 'creada') {
    return `<form class="card stack" data-form="assign"><h2>Asignar a operador</h2>
      <label class="f">Operador de transporte<select name="operador_id">${S.bootstrap(u).operators.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></label>
      <button class="btn">Asignar orden</button></form>`;
  }
  if (u.rol === 'operador_despachador' && o.status === 'asignada_operador') {
    const op = S.bootstrap(u).operator;
    return `<form class="card stack" data-form="pickup"><h2>Designar recolección</h2>
      <label class="f">Conductor<select name="conductor_id">${op.equipo.filter((e) => e.rol === 'operador_conductor_recoleccion').map((e) => `<option value="${e.id}">${esc(e.nombre)}</option>`).join('')}</select></label>
      <label class="f">Móvil<select name="movil_patente">${op.vehiculos.map((v) => `<option value="${v.patente}">${v.patente} · ${esc(v.tipo)}</option>`).join('')}</select></label>
      <button class="btn">Designar conductor y móvil</button></form>`;
  }
  if (u.rol === 'operador_encargado_bodega' && o.status === 'en_bodega_operador') {
    const op = S.bootstrap(u).operator;
    return `<form class="card stack" data-form="transport"><h2>Asignar bus / servicio</h2>
      <label class="f">Servicio<select name="servicio_id">${op.servicios.map((s) => `<option value="${s.id}">${esc(s.servicio)} · ${s.bus_patente}</option>`).join('')}</select></label>
      <label class="f">Conductor / auxiliar de bus<select name="conductor_id">${op.equipo.filter((e) => e.rol === 'operador_conductor_bus').map((e) => `<option value="${e.id}">${esc(e.nombre)}</option>`).join('')}</select></label>
      <button class="btn">Asignar transporte</button></form>`;
  }
  if (c && actionable(u, o)) return scanPanel(o, u, c);
  return '';
}

function scanPanel(o, u, c) {
  const pend = o.paquetes.filter((p) => !p.scan_history.some((s) => s.checkpoint === c.cp));
  const done = o.escaneados === o.paquetes.length;
  const persons = c.signPerm ? o.personas_autorizadas[c.point] : null;
  return `<div class="card stack"><div class="row between"><h2>Escanear: ${CP_LABEL[c.cp]}</h2><span class="chip ${done ? 'scan' : 'pend'}">${o.escaneados}/${o.paquetes.length}</span></div>
    <div class="bar"><i style="width:${(o.escaneados / o.paquetes.length) * 100}%"></i></div>
    ${pend.length ? `<form class="row" data-form="scan"><input name="piece_code" placeholder="Escanea o escribe el código" autocomplete="off" autocapitalize="characters" aria-label="Código del bulto" autofocus><button class="btn small">Escanear</button></form>
      <div class="row between small"><span class="soft">Sin lector: toca un bulto para simularlo.</span><button class="link" data-act="scan-all" type="button">Escanear todos (demo)</button></div>` : ''}
    <div>${o.paquetes.map((p) => {
      const s = p.scan_history.find((x) => x.checkpoint === c.cp);
      return `<div class="pkg"><span><span class="mono">${p.piece_code}</span><br><span class="small soft">${esc(p.descripcion)} · ${p.peso_kg} kg</span></span>
        ${s ? `<span class="chip ${s.manual ? 'manual' : 'scan'}">${s.manual ? 'Manual' : '✓ Escaneado'}</span>`
            : `<span class="row"><button class="link" data-act="manual" data-code="${p.piece_code}" type="button">Manual</button><button class="btn small" data-act="scan-one" data-code="${p.piece_code}" type="button">Escanear</button></span>`}</div>`;
    }).join('')}</div>
    ${done ? `<form class="stack" data-form="confirm">
      ${persons ? `<h3>Persona autorizada que ${c.point === 'origen' ? 'entrega' : 'recibe'}</h3>
        ${persons.map((p, i) => `<label class="persona"><input type="radio" name="persona_rut" value="${p.rut}" ${i === 0 ? 'checked' : ''}><span><b>${esc(p.nombre)}</b><br><span class="mono small">${p.rut}</span> · <span class="small">${esc(p.telefono)}</span></span></label>`).join('')}
        <label class="check"><input type="checkbox" name="id_verificado"><span>Verifiqué el RUT contra la cédula de identidad</span></label>
        <div><div class="row between small"><span class="soft">Firma electrónica</span><button class="link" data-act="sig-clear" type="button">Limpiar</button></div><canvas class="sig" id="sig" aria-label="Área de firma"></canvas></div>` : ''}
      <button class="btn">Confirmar traspaso</button></form>` : '<p class="small soft">Debes escanear todos los bultos para confirmar el traspaso.</p>'}
  </div>`;
}

function orderView(id) {
  const u = U();
  let o; try { o = S.orderDetail(u, id); } catch { return '<div class="card">Orden no encontrada. <a href="#/">Volver</a></div>'; }
  const next = o.status !== 'entregada' ? S.nextActor(o) : null;
  const sigs = ['entrega', 'recepcion'].filter((k) => o.handoff[k].firma_url);
  return `<a href="#/" class="small">← Volver</a>
    <div class="card"><div class="row between"><h2>${num(o.id)}</h2>${chip(o, u)}</div>
      <div class="route">${esc(o.bodega_origen.nombre)} <i>→</i> ${esc(o.bodega_destino.nombre)}</div>
      <div class="small soft">${esc(o.bodega_origen.direccion.direccion)}, ${esc(o.bodega_origen.direccion.comuna)}<br>${esc(o.bodega_destino.direccion.direccion)}, ${esc(o.bodega_destino.direccion.comuna)}</div>
      <div class="small" style="margin-top:8px">${o.bultos_total} bultos · Creada ${fmt(o.created_at)}${o.referencia_cliente ? ' · Ref. ' + esc(o.referencia_cliente) : ''}${o.operacion.operador_id ? '<br>Operador: ' + esc(S.list('operators').find((p) => p.id === o.operacion.operador_id).nombre) : ''}</div></div>
    ${next && next.id !== me ? `<div class="hint">Siguiente: <b>${esc(next.nombre)}</b> (${esc(roleName(next.rol))}). <button class="link" data-act="switch" data-id="${next.id}">Ver como esta persona</button></div>` : ''}
    ${actionPanel(o, u)}
    <div class="card"><h3 style="margin-bottom:10px">${u.rol === 'merchant' ? 'Avance' : 'Cadena de custodia'}</h3>${timeline(o, u)}</div>
    <div class="card"><h3>Bultos</h3>${o.paquetes.map((p) => `<div class="pkg"><span><span class="mono">${p.piece_code}</span><br><span class="small soft">${esc(p.descripcion)} · ${p.peso_kg} kg</span></span>
      <span class="small" style="text-align:right">${p.scan_history.length ? p.scan_history.map((s) => `<span class="chip ${s.manual ? 'manual' : 'scan'}">${CP_LABEL[s.checkpoint]}</span>`).join(' ') : '<span class="chip pend">Pendiente</span>'}</span></div>`).join('')}
      <a class="btn ghost small" style="margin-top:8px" href="#/labels/${o.id}">Ver / imprimir etiquetas</a></div>
    <div class="card stack"><h3>Autorizados</h3>${['origen', 'destino'].map((k) => `<div><b>${k === 'origen' ? 'Origen' : 'Destino'}</b>${o.personas_autorizadas[k].map((p) => `<div class="small">${esc(p.nombre)} · <span class="mono">${p.rut}</span> · ${esc(p.telefono)}</div>`).join('')}</div>`).join('')}</div>
    ${sigs.length ? `<div class="card stack"><h3>Firmas capturadas</h3>${sigs.map((k) => `<div><b>${k === 'entrega' ? 'Entrega en origen' : 'Recepción en destino'}</b><div class="small soft">${esc(o.handoff[k].persona_autorizada)} · ${fmt(o.handoff[k].at)}</div><img class="sigimg" alt="Firma" src="${o.handoff[k].firma_url}"></div>`).join('')}</div>` : ''}
    <details class="card"><summary>Registro de eventos (${S.events(u, o.id).length})</summary>${S.events(u, o.id).map((e) => `<div class="ev"><span class="mono">${fmt(e.at)}</span> · ${esc(e.type.replaceAll('_', ' '))}<br><span class="soft">${esc((S.userById(e.actor_id) || {}).nombre || e.actor_id)} — ${esc(e.note)}</span></div>`).join('')}</details>`;
}

function labels(id) {
  let o; try { o = S.orderDetail(U(), id); } catch { return '<div class="card">Orden no encontrada.</div>'; }
  return `<div class="row between noprint"><a href="#/order/${o.id}" class="small">← Volver</a><button class="btn small" data-act="print">Imprimir</button></div>
    <p class="small soft noprint">Un código por bulto. Se escanea en cada traspaso (Code 39; en el sistema real, QR/Code128 generado por el backend).</p>
    <div class="labels">${o.paquetes.map((p, i) => `<div class="label"><div class="row between"><span class="big">${num(o.id)}</span><span class="small">Bulto ${i + 1}/${o.paquetes.length}</span></div>
      ${code39(p.piece_code)}<div class="mono" style="text-align:center;font-weight:700">${p.piece_code}</div>
      <div class="small">${esc(o.bodega_origen.nombre)} → <b>${esc(o.bodega_destino.nombre)}</b><br>${esc(o.bodega_destino.direccion.direccion)}, ${esc(o.bodega_destino.direccion.comuna)}<br>${esc(p.descripcion)} · ${p.peso_kg} kg</div></div>`).join('')}</div>`;
}

// ---- merchant: wizard -----------------------------------------------------------
const bodegas = () => S.bootstrap(U()).merchant.bodegas;
const bodegaById = (id) => bodegas().find((b) => b.id === id);
const blankPerson = () => ({ nombre: '', rut: '', telefono: '' });
const newW = () => {
  const bs = bodegas(), def = bs.find((b) => b.es_origen_default) || bs[0];
  return { step: 1, ciudad: def.ciudad, origen: def.id, destino: '', ref: '', filled: {}, personas: { origen: [], destino: [] }, paquetes: [{ descripcion: '', peso_kg: '', valor: '' }], done: null };
};
const personRow = (side, i, p) => `<div class="person-row">
  <input data-bind="personas.${side}.${i}.nombre" placeholder="Nombre completo" value="${esc(p.nombre)}" aria-label="Nombre">
  <div class="grid2"><input data-bind="personas.${side}.${i}.rut" placeholder="RUT 12.345.678-5" value="${esc(p.rut)}" aria-label="RUT" class="${p.rut && !rutValid(p.rut) ? 'bad' : ''}" data-rutcheck>
  <input data-bind="personas.${side}.${i}.telefono" placeholder="+56 9 1234 5678" inputmode="tel" value="${esc(p.telefono)}" aria-label="Teléfono"></div></div>`;

function bodegaForm() {
  const b = NB;
  const inp = (k, ph, extra = '') => `<input data-bindnb="${k}" placeholder="${ph}" value="${esc(k.split('.').reduce((a, x) => a?.[x], b) ?? '')}" ${extra}>`;
  return `<div class="card stack"><h2>Bodega nueva</h2>
    ${inp('nombre', 'Nombre (ej. CD Valparaíso)')}
    <div class="grid2">${inp('ciudad', 'Ciudad')}${inp('direccion.region', 'Región')}</div>
    <div class="grid2">${inp('direccion.comuna', 'Comuna')}${inp('direccion.direccion', 'Calle y número')}</div>
    <h3>Personas autorizadas (mín. 2)</h3>
    ${b.contactos.map((_, i) => `<div class="person-row">${inp(`contactos.${i}.nombre`, 'Nombre')}<div class="grid2">${inp(`contactos.${i}.rut`, 'RUT')}${inp(`contactos.${i}.telefono`, 'Teléfono', 'inputmode="tel"')}</div></div>`).join('')}
    <div class="row"><button class="btn ghost" data-act="nb-cancel" type="button">Cancelar</button><button class="btn" data-act="nb-save" type="button">Guardar bodega</button></div></div>`;
}
const blankNB = () => ({ nombre: '', ciudad: '', direccion: { region: '', comuna: '', direccion: '' }, contactos: [{ nombre: '', rut: '', telefono: '' }, { nombre: '', rut: '', telefono: '' }] });

function wizard() {
  if (!W) W = newW();
  if (W.done) return `<div class="card stack" style="text-align:center"><div style="font-size:42px">✅</div><h2>${num(W.done.id)} creada</h2>
    <p class="soft">${W.done.bultos_total} bultos · ${esc(W.done.bodega_origen.nombre)} → ${esc(W.done.bodega_destino.nombre)}.<br>Quedó en estado <b>Creada</b>, a la espera del Coordinador Logístico.</p>
    <a class="btn" href="#/labels/${W.done.id}">Imprimir etiquetas</a><a class="btn ghost" href="#/order/${W.done.id}">Ver orden</a><button class="btn ghost" data-act="w-new">Crear otra</button></div>`;
  const bs = bodegas(), cities = [...new Set(bs.map((b) => b.ciudad))];
  const head = `<div class="steps">${[1, 2, 3].map((n) => `<span class="${n <= W.step ? 'on' : ''}"></span>`).join('')}</div><div class="row between"><h2>Nueva encomienda</h2><span class="small soft">Paso ${W.step} de 3</span></div>`;
  let body = '';
  if (W.step === 1) {
    const inCity = bs.filter((b) => b.ciudad === W.ciudad);
    const dest = bs.filter((b) => b.id !== W.origen);
    body = `<div class="card stack"><h3>Origen</h3>
      ${bs.length === 1 ? `<div><b>${esc(bs[0].nombre)}</b><div class="small soft">${esc(bs[0].direccion.direccion)}, ${esc(bs[0].ciudad)}</div></div>` : `
        <label class="f">Ciudad de origen<select data-change="w-ciudad">${cities.map((c) => `<option ${c === W.ciudad ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        <label class="f">Bodega de origen<select data-bind="origen" data-change="w-origen">${inCity.map((b) => `<option value="${b.id}" ${b.id === W.origen ? 'selected' : ''}>${esc(b.nombre)}</option>`).join('')}</select></label>`}</div>
      <div class="card stack"><h3>Destino</h3>
      <label class="f">Bodega de destino<select data-change="w-destino"><option value="">Selecciona…</option>${dest.map((b) => `<option value="${b.id}" ${b.id === W.destino ? 'selected' : ''}>${esc(b.ciudad)} · ${esc(b.nombre)}</option>`).join('')}<option value="__new">＋ Registrar bodega nueva…</option></select></label></div>
      ${NB ? bodegaForm() : ''}
      <div class="card"><label class="f">Referencia interna / OC (opcional)<input data-bind="ref" value="${esc(W.ref)}" placeholder="Ej. OC-48291"></label></div>`;
  } else if (W.step === 2) {
    body = `<p class="small soft">Mínimo 2 por punto. El conductor comparará el RUT con la cédula al escanear y firmar: es la única verificación de identidad.</p>
      ${['origen', 'destino'].map((side) => `<div class="card stack"><h3>${side === 'origen' ? 'Entrega en ' + esc(bodegaById(W.origen).nombre) : 'Recibe en ' + esc(bodegaById(W.destino).nombre)}</h3>
        ${W.personas[side].map((p, i) => personRow(side, i, p)).join('')}
        <button class="link" data-act="w-add-person" data-side="${side}" type="button">＋ Agregar otra persona</button></div>`).join('')}`;
  } else {
    const kg = W.paquetes.reduce((s, p) => s + (Number(p.peso_kg) || 0), 0);
    body = `${W.paquetes.map((p, i) => `<div class="card stack"><div class="row between"><h3>Bulto ${i + 1}</h3><span><button class="link" data-act="w-dup" data-i="${i}" type="button">Duplicar</button>${W.paquetes.length > 1 ? ` · <button class="link" data-act="w-del" data-i="${i}" type="button">Quitar</button>` : ''}</span></div>
      <input data-bind="paquetes.${i}.descripcion" placeholder="Contenido (ej. Ropa)" value="${esc(p.descripcion)}" aria-label="Contenido">
      <div class="grid2"><input data-bind="paquetes.${i}.peso_kg" inputmode="decimal" placeholder="Peso aprox. kg" value="${esc(p.peso_kg)}" aria-label="Peso"><input data-bind="paquetes.${i}.valor" inputmode="numeric" placeholder="Valor $ (opcional)" value="${esc(p.valor)}" aria-label="Valor declarado"></div></div>`).join('')}
      <button class="btn ghost" data-act="w-add-pkg" type="button">＋ Agregar bulto</button>
      <div class="hint">${W.paquetes.length} bulto${W.paquetes.length > 1 ? 's' : ''} · ${kg.toFixed(1)} kg. Al confirmar se genera un código imprimible por bulto.</div>`;
  }
  return `${head}${body}<div class="row">${W.step > 1 ? '<button class="btn ghost" data-act="w-back" type="button">Atrás</button>' : ''}<button class="btn" data-act="${W.step === 3 ? 'w-submit' : 'w-next'}" type="button">${W.step === 3 ? 'Crear orden' : 'Continuar'}</button></div>`;
}

function account() {
  const m = S.bootstrap(U()).merchant;
  return `<div class="card"><h2>${esc(m.razon_social)}</h2><div class="small soft">RUT ${m.rut} · Plan ${esc(m.plan)}<br>Facturación mensual consolidada (módulo en pausa)</div></div>
    <div class="row between"><h3>Mis bodegas (${m.bodegas.length})</h3>${NB ? '' : '<button class="btn small" data-act="nb-open">＋ Agregar</button>'}</div>
    ${NB ? bodegaForm() : ''}
    ${m.bodegas.map((b) => `<div class="card"><div class="row between"><b>${esc(b.nombre)}</b>${b.es_origen_default ? '<span class="chip scan">Origen por defecto</span>' : ''}</div>
      <div class="small soft">${esc(b.direccion.direccion)}, ${esc(b.direccion.comuna)} · ${esc(b.ciudad)}</div>
      ${b.contactos.map((c) => `<div class="small" style="margin-top:4px">👤 ${esc(c.nombre)} · <span class="mono">${c.rut}</span> · ${esc(c.telefono)}</div>`).join('')}</div>`).join('')}`;
}

// ---- router -----------------------------------------------------------------------
function render() {
  const u = U();
  $('#top').innerHTML = `<div class="logo">kargo<b>.</b>cl</div><div class="who"><b>${esc(u.nombre.split(' (')[0])}</b>${esc(roleName(u.rol))}</div>`;
  const [route, arg] = location.hash.replace(/^#\/?/, '').split('/');
  const merchant = u.rol === 'merchant';
  const nav = merchant
    ? [['', '📦', 'Órdenes'], ['new', '＋', 'Nueva', 'cta'], ['account', '🏬', 'Cuenta']]
    : [['', '📋', 'Tareas'], ['all', '🗂️', 'Todas']];
  $('#nav').innerHTML = nav.map(([r, i, l, k]) => `<a href="#/${r}" class="${k || ''} ${route === r || (r === '' && ['order', 'labels'].includes(route)) ? 'on' : ''}"><span class="i">${i}</span>${l}</a>`).join('');
  let html;
  if (route === 'order') html = orderView(arg);
  else if (route === 'labels') html = labels(arg);
  else if (route === 'new' && merchant) html = wizard();
  else if (route === 'account' && merchant) html = account();
  else if (route === 'all' && !merchant) html = S.listOrders(u).map((o) => orderCard(o)).join('') || '<p class="soft">Sin órdenes.</p>';
  else html = home();
  $('#view').innerHTML = html;
  initSignature();
  const f = $('#view form[data-form=scan] input'); if (f) f.focus({ preventScroll: true });
}
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });

// ---- signature pad ------------------------------------------------------------------
function initSignature() {
  const cv = $('#sig'); sigDrawn = false;
  if (!cv) return;
  const r = cv.getBoundingClientRect(); cv.width = r.width * 2; cv.height = r.height * 2;
  const g = cv.getContext('2d'); g.scale(2, 2); g.lineWidth = 2.4; g.lineCap = 'round'; g.strokeStyle = '#1A2420';
  let down = false;
  const pt = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  cv.onpointerdown = (e) => { down = true; cv.setPointerCapture(e.pointerId); g.beginPath(); g.moveTo(...pt(e)); };
  cv.onpointermove = (e) => { if (!down) return; g.lineTo(...pt(e)); g.stroke(); sigDrawn = true; };
  cv.onpointerup = () => { down = false; };
}

// ---- events ---------------------------------------------------------------------------
const setPath = (obj, path, val) => { const k = path.split('.'); const last = k.pop(); k.reduce((a, x) => a[x], obj)[last] = val; };

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'q') { query = t.value; const p = t.selectionStart; render(); const q = $('#q'); q.focus(); q.setSelectionRange(p, p); return; }
  if (t.dataset.bind && W) setPath(W, t.dataset.bind, t.value);
  if (t.dataset.bindnb && NB) setPath(NB, t.dataset.bindnb, t.value);
  if (t.dataset.rutcheck !== undefined) t.classList.toggle('bad', !!t.value && !rutValid(t.value));
});
document.addEventListener('change', (e) => {
  const t = e.target, a = t.dataset.change;
  if (t.id === 'who') return switchUser(t.value);
  if (a === 'w-ciudad') { W.ciudad = t.value; W.origen = bodegas().find((b) => b.ciudad === t.value).id; if (W.destino === W.origen) W.destino = ''; render(); }
  if (a === 'w-origen') { W.origen = t.value; if (W.destino === W.origen) W.destino = ''; render(); }
  if (a === 'w-destino') { if (t.value === '__new') { NB = blankNB(); W.destino = ''; } else W.destino = t.value; render(); }
});

const forms = {
  assign: (f) => run(() => S.assign(U(), currentId(), { operador_id: f.get('operador_id') }), 'Orden asignada'),
  pickup: (f) => run(() => S.pickup(U(), currentId(), { conductor_id: f.get('conductor_id'), movil_patente: f.get('movil_patente') }), 'Recolección designada'),
  transport: (f) => run(() => S.transport(U(), currentId(), { servicio_id: f.get('servicio_id'), conductor_id: f.get('conductor_id') }), 'Transporte asignado'),
  scan: (f) => run(() => S.scan(U(), currentId(), { piece_code: f.get('piece_code') }), 'Bulto escaneado'),
  confirm: (f) => {
    const needSig = !!f.get('persona_rut') || !!$('#sig');
    if (needSig && !sigDrawn) return toast('Falta la firma', 'err');
    const firma = $('#sig') ? $('#sig').toDataURL('image/png') : undefined;
    run(() => S.confirm(U(), currentId(), { persona_rut: f.get('persona_rut'), id_verificado: f.get('id_verificado') === 'on', firma }), 'Traspaso confirmado');
  },
};
const currentId = () => location.hash.split('/')[2];
document.addEventListener('submit', (e) => {
  const fn = forms[e.target.dataset.form]; if (!fn) return;
  e.preventDefault(); fn(new FormData(e.target));
});

const ORDER = () => S.orderDetail(U(), currentId());
const acts = {
  switch: (t) => switchUser(t.dataset.id),
  print: () => window.print(),
  'sig-clear': () => initSignature(),
  'scan-one': (t) => run(() => S.scan(U(), currentId(), { piece_code: t.dataset.code }), 'Bulto escaneado'),
  'scan-all': () => run(() => ORDER().paquetes.filter((p) => !p.scan_history.some((s) => s.checkpoint === ORDER().checkpoint_actual)).forEach((p) => S.scan(U(), currentId(), { piece_code: p.piece_code })), 'Todos los bultos escaneados'),
  manual: (t) => { const reason = prompt('Motivo del registro manual (ej. etiqueta dañada, sin señal):'); if (reason) run(() => S.scan(U(), currentId(), { piece_code: t.dataset.code, manual: true, reason }), 'Registro manual guardado'); },
  'w-back': () => { W.step--; render(); },
  'w-next': () => {
    if (W.step === 1) {
      if (!W.destino) return toast('Elige la bodega de destino', 'err');
      if (W.filled.origen !== W.origen) { W.personas.origen = bodegaById(W.origen).contactos.map(({ nombre, rut, telefono }) => ({ nombre, rut, telefono })); W.filled.origen = W.origen; }
      if (W.filled.destino !== W.destino) { W.personas.destino = bodegaById(W.destino).contactos.map(({ nombre, rut, telefono }) => ({ nombre, rut, telefono })); W.filled.destino = W.destino; }
    }
    W.step++; render();
  },
  'w-add-person': (t) => { W.personas[t.dataset.side].push(blankPerson()); render(); },
  'w-add-pkg': () => { W.paquetes.push({ descripcion: '', peso_kg: '', valor: '' }); render(); },
  'w-dup': (t) => { W.paquetes.splice(+t.dataset.i + 1, 0, { ...W.paquetes[+t.dataset.i] }); render(); },
  'w-del': (t) => { W.paquetes.splice(+t.dataset.i, 1); render(); },
  'w-new': () => { W = newW(); render(); },
  'w-submit': () => {
    const clean = (arr) => arr.filter((p) => p.nombre || p.rut || p.telefono);
    try {
      W.done = S.createOrder(U(), {
        bodega_origen_id: W.origen, bodega_destino_id: W.destino, referencia_cliente: W.ref,
        personas_autorizadas: { origen: clean(W.personas.origen), destino: clean(W.personas.destino) },
        paquetes: W.paquetes.map((p) => ({ descripcion: p.descripcion, peso_kg: Number(String(p.peso_kg).replace(',', '.')), valor_declarado_clp: p.valor === '' ? null : Number(p.valor) })),
      });
      toast('Orden creada');
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
      toast(e.message, 'err');
      if (/^(Origen|Destino):/.test(e.message)) W.step = 2; else if (/^Bulto|bulto/.test(e.message)) W.step = 3;
    }
    render();
  },
  'nb-open': () => { NB = blankNB(); render(); },
  'nb-cancel': () => { NB = null; render(); },
  'nb-save': () => run(() => {
    const b = S.addBodega(U(), NB); NB = null;
    if (W) W.destino = b.id;
  }, 'Bodega registrada'),
};
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  acts[t.dataset.act]?.(t);
});
$('#reset').addEventListener('click', () => { if (confirm('¿Volver a los datos iniciales de la demo?')) boot(true); });

boot();
