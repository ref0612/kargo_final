// Domain rules of the KARGO mockup, as plain functions over in-memory collections (same shape as data/*.json).
// This runs IN THE BROWSER for the demo. It is NOT a backend: it is the executable spec of the rules
// (state machine, permissions, validations) that the real backend must enforce server-side.
// ponytail: no auth, no concurrency, everything in memory; persistence is whatever `persist(names)` does (localStorage in the app).
export class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = (m) => new HttpError(400, m);
const forbidden = (m) => new HttpError(403, m);
const notFound = (m) => new HttpError(404, m);
const conflict = (m) => new HttpError(409, m);

// collection name -> [file, top-level key]
const FILES = {
  merchants: ['merchants.json', 'merchants'], users: ['users.json', 'users'], operators: ['operators.json', 'operators'],
  roles: ['roles.json', 'roles'], orders: ['orders.json', 'orders'], packages: ['packages.json', 'packages'],
  events: ['tracking_events.json', 'events'], invoices: ['invoices.json', 'invoices'],
};

export { CP, MERCHANT_STATE, FILES, rutValid, rutFormat, rutDV };

// Status machine: status -> { checkpoint scanned at this status, next status once the hand-over is confirmed }
const CP = {
  recoleccion_asignada: { cp: 'recoleccion', next: 'recolectada', scanPerm: 'escanear_bulto_recoleccion', signPerm: 'capturar_firma_entrega', point: 'origen', handoff: 'entrega' },
  recolectada: { cp: 'ingreso_bodega_op', next: 'en_bodega_operador', scanPerm: 'escanear_bulto_ingreso_bodega' },
  asignada_transporte: { cp: 'carga_bus', next: 'cargada_bus', scanPerm: 'escanear_bulto_carga_bus' },
  cargada_bus: { cp: 'entrega', next: 'entregada', scanPerm: 'escanear_bulto_entrega', signPerm: 'capturar_firma_recepcion', point: 'destino', handoff: 'recepcion' },
};
const PKG_STATUS = { recoleccion: 'recolectado', ingreso_bodega_op: 'en_bodega_operador', carga_bus: 'cargado_bus', entrega: 'entregado' };
// Merchant only ever sees 5 states; the 8 internal steps stay in the back office.
const MERCHANT_STATE = {
  creada: 'Creada', asignada_operador: 'Asignada', recoleccion_asignada: 'En recolección', recolectada: 'En tránsito',
  en_bodega_operador: 'En tránsito', asignada_transporte: 'En tránsito', cargada_bus: 'En tránsito', entregada: 'Entregada',
};

// ---- RUT (Chile) -----------------------------------------------------------
const rutClean = (r) => String(r || '').replace(/[.\-\s]/g, '').toUpperCase();
function rutDV(body) {
  let s = 0, m = 2;
  for (let i = body.length - 1; i >= 0; i--) { s += +body[i] * m; m = m === 7 ? 2 : m + 1; }
  const d = 11 - (s % 11);
  return d === 11 ? '0' : d === 10 ? 'K' : String(d);
}
function rutValid(r) {
  const c = rutClean(r);
  return /^\d{7,8}[\dK]$/.test(c) && rutDV(c.slice(0, -1)) === c.slice(-1);
}
function rutFormat(r) {
  const c = rutClean(r), b = c.slice(0, -1);
  return b.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + c.slice(-1);
}

// db = { merchants: <content of merchants.json>, users: ..., ... }; persist(names) is called after every mutation.
export function createStore(db, persist = () => {}) {
  for (const [name, [, key]] of Object.entries(FILES)) db[name] = db[name] || { [key]: [] };
  const list = (n) => db[n][FILES[n][1]];
  const save = (...names) => persist(names);
  const now = () => new Date().toISOString();

  const userById = (id) => list('users').find((u) => u.id === id);
  const operatorById = (id) => list('operators').find((o) => o.id === id);
  const roleOf = (u) => list('roles').find((r) => r.id === u.rol);
  const can = (u, p) => !!roleOf(u)?.permisos.includes(p);
  const need = (u, p) => { if (!can(u, p)) throw forbidden(`Tu rol no puede hacer esto (${p})`); };

  function pkgsOf(orderId) { return list('packages').filter((p) => p.order_id === orderId); }
  function nextNum(items) {
    return items.reduce((m, x) => Math.max(m, parseInt(String(x.id).replace(/\D/g, ''), 10) || 0), 0) + 1;
  }

  function event(order, pkg, type, user, note) {
    list('events').push({
      id: 'evt_' + (list('events').length + 1001), order_id: order.id, package_id: pkg ? pkg.id : null, type,
      actor_role: user.rol, actor_id: user.id, at: now(), note,
    });
  }
  function step(order, stepName, user) {
    order.status = stepName;
    order.timeline.push({ step: stepName, at: now(), actor_role: user.rol, actor_id: user.id });
  }
  const sameOperator = (u, o) => !!u.operador_id && u.operador_id === o.operacion.operador_id;

  function visible(user, o) {
    if (user.rol === 'merchant') return o.merchant_id === user.merchant_id;
    if (user.rol === 'coordinador_logistico') return true;
    return sameOperator(user, o);
  }

  function enrich(o) {
    const paquetes = pkgsOf(o.id);
    const c = CP[o.status];
    return {
      ...o, paquetes, estado_merchant: MERCHANT_STATE[o.status],
      checkpoint_actual: c ? c.cp : null,
      escaneados: c ? paquetes.filter((p) => p.scan_history.some((s) => s.checkpoint === c.cp)).length : 0,
    };
  }
  function getOrder(user, id) {
    const o = list('orders').find((x) => x.id === id);
    if (!o || !visible(user, o)) throw notFound('Orden no encontrada');
    return o;
  }

  // ---- reads ---------------------------------------------------------------
  function bootstrap(user) {
    const out = { user, permisos: roleOf(user).permisos, mensajes: MERCHANT_STATE };
    if (user.merchant_id) out.merchant = list('merchants').find((m) => m.id === user.merchant_id);
    if (user.operador_id) {
      const op = operatorById(user.operador_id);
      out.operator = { ...op, equipo: list('users').filter((u) => u.operador_id === op.id).map(({ id, nombre, rol }) => ({ id, nombre, rol })) };
    }
    if (user.rol === 'coordinador_logistico') out.operators = list('operators').map(({ id, nombre }) => ({ id, nombre }));
    return out;
  }
  const publicUsers = () => list('users').map(({ id, nombre, rol, merchant_id, operador_id }) => ({ id, nombre, rol, merchant_id, operador_id }));
  const listOrders = (user) => list('orders').filter((o) => visible(user, o)).map(enrich).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const orderDetail = (user, id) => enrich(getOrder(user, id));
  const events = (user, id) => { getOrder(user, id); return list('events').filter((e) => e.order_id === id); };

  // ---- merchant ------------------------------------------------------------
  function checkPersonas(arr, label) {
    if (!Array.isArray(arr) || arr.length < 2) throw bad(`${label}: se requieren al menos 2 personas autorizadas`);
    const seen = new Set();
    return arr.map((p) => {
      if (!p || !String(p.nombre || '').trim()) throw bad(`${label}: falta el nombre de una persona autorizada`);
      if (!rutValid(p.rut)) throw bad(`${label}: RUT inválido (${p.rut})`);
      if (!/^\+?\d{8,12}$/.test(String(p.telefono || '').replace(/[\s-]/g, ''))) throw bad(`${label}: teléfono inválido de ${p.nombre}`);
      const rut = rutFormat(p.rut);
      if (seen.has(rut)) throw bad(`${label}: RUT repetido (${rut})`);
      seen.add(rut);
      return { nombre: String(p.nombre).trim(), rut, telefono: String(p.telefono).replace(/[\s-]/g, '') };
    });
  }
  const merchantOf = (user) => {
    const m = list('merchants').find((x) => x.id === user.merchant_id);
    if (!m) throw forbidden('Solo un merchant puede hacer esto');
    return m;
  };

  function addBodega(user, b) {
    need(user, 'crear_orden');
    const m = merchantOf(user);
    const d = b.direccion || {};
    for (const [k, v] of Object.entries({ nombre: b.nombre, ciudad: b.ciudad, región: d.region, comuna: d.comuna, dirección: d.direccion })) {
      if (!String(v || '').trim()) throw bad(`Bodega: falta ${k}`);
    }
    const bodega = {
      id: 'bod_' + String(b.ciudad).toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '').slice(0, 5) + '_' + String(m.bodegas.length + 1).padStart(2, '0'),
      nombre: b.nombre.trim(), ciudad: b.ciudad.trim(), es_origen_default: m.bodegas.length === 0,
      direccion: { region: d.region, ciudad: b.ciudad.trim(), comuna: d.comuna, direccion: d.direccion },
      contactos: checkPersonas(b.contactos, 'Bodega').map((p, i) => ({ ...p, cargo: String(b.contactos[i].cargo || '') })),
    };
    m.bodegas.push(bodega);
    save('merchants');
    return bodega;
  }

  function createOrder(user, b) {
    need(user, 'crear_orden');
    const m = merchantOf(user);
    const origen = m.bodegas.find((x) => x.id === b.bodega_origen_id);
    const destino = m.bodegas.find((x) => x.id === b.bodega_destino_id);
    if (!origen || !destino) throw bad('Origen y destino deben ser bodegas registradas de tu cuenta');
    if (origen.id === destino.id) throw bad('Origen y destino no pueden ser la misma bodega');
    const pa = b.personas_autorizadas || {};
    const personas = { origen: checkPersonas(pa.origen, 'Origen'), destino: checkPersonas(pa.destino, 'Destino') };
    const items = b.paquetes;
    if (!Array.isArray(items) || !items.length) throw bad('Agrega al menos un bulto');
    if (items.length > 200) throw bad('Máximo 200 bultos por orden (usa varias órdenes)');
    items.forEach((p, i) => {
      if (!(Number(p.peso_kg) > 0)) throw bad(`Bulto ${i + 1}: peso inválido`);
      if (!String(p.descripcion || '').trim()) throw bad(`Bulto ${i + 1}: falta el contenido`);
      if (p.valor_declarado_clp != null && p.valor_declarado_clp !== '' && !(Number(p.valor_declarado_clp) >= 0)) throw bad(`Bulto ${i + 1}: valor inválido`);
    });

    const n = nextNum(list('orders'));
    const num = String(n).padStart(5, '0');
    const id = 'ot_' + num;
    const at = now();
    const pkgs = items.map((p, i) => ({
      id: `pkg_${num}_${i + 1}`, order_id: id, piece_code: `KARGO-${num}-${String(i + 1).padStart(3, '0')}`,
      descripcion: String(p.descripcion).trim(), peso_kg: Number(p.peso_kg),
      valor_declarado_clp: p.valor_declarado_clp === '' || p.valor_declarado_clp == null ? null : Number(p.valor_declarado_clp),
      status: 'pendiente', scan_history: [],
    }));
    const slim = ({ id, nombre, direccion }) => ({ id, nombre, direccion });
    const blank = { persona_autorizada: null, escaneado_por: null, firma_url: null, at: null };
    const order = {
      id, merchant_id: m.id, status: 'creada', created_by: user.id, created_at: at,
      bodega_origen: slim(origen), bodega_destino: slim(destino), personas_autorizadas: personas,
      referencia_cliente: String(b.referencia_cliente || '').trim() || null, facturable: true, periodo_facturacion: null,
      packages: pkgs.map((p) => p.id), bultos_total: pkgs.length,
      operacion: {
        coordinador_id: null, operador_id: null, asignado_operador_at: null,
        recoleccion: { conductor_id: null, movil_patente: null, asignado_at: null, completada_at: null },
        bodega_operador: { id: null, ingreso_at: null },
        transporte: { bus_patente: null, servicio: null, conductor_id: null, cargado_at: null },
        entrega: { completada_at: null },
      },
      handoff: { entrega: { ...blank }, recepcion: { ...blank } },
      timeline: [{ step: 'creada', at, actor_role: user.rol, actor_id: user.id }],
    };
    list('orders').push(order);
    list('packages').push(...pkgs);
    event(order, null, 'orden_creada', user, `OT-${num} creada - ${pkgs.length} bultos declarados`);
    save('orders', 'packages', 'events');
    return enrich(order);
  }

  // ---- coordinator / operator ----------------------------------------------
  function assign(user, id, b) {
    need(user, 'asignar_operador_transporte');
    const o = getOrder(user, id);
    if (o.status !== 'creada') throw conflict('La orden ya fue asignada');
    const op = operatorById(b.operador_id);
    if (!op) throw bad('Operador inexistente');
    Object.assign(o.operacion, { coordinador_id: user.id, operador_id: op.id, asignado_operador_at: now() });
    step(o, 'asignada_operador', user);
    event(o, null, 'orden_asignada_operador', user, `Asignada a ${op.nombre}`);
    save('orders', 'events');
    return enrich(o);
  }

  function pickup(user, id, b) {
    need(user, 'designar_conductor_recoleccion');
    const o = getOrder(user, id);
    if (o.status !== 'asignada_operador') throw conflict('La orden no está pendiente de asignar recolección');
    const op = operatorById(user.operador_id);
    const driver = userById(b.conductor_id);
    if (!driver || driver.rol !== 'operador_conductor_recoleccion' || driver.operador_id !== op.id) throw bad('Conductor inválido para tu operador');
    if (!op.vehiculos.some((v) => v.patente === b.movil_patente)) throw bad('Móvil inválido para tu operador');
    Object.assign(o.operacion.recoleccion, { conductor_id: driver.id, movil_patente: b.movil_patente, asignado_at: now() });
    step(o, 'recoleccion_asignada', user);
    event(o, null, 'recoleccion_asignada', user, `Conductor ${driver.id}, móvil ${b.movil_patente}`);
    save('orders', 'events');
    return enrich(o);
  }

  function transport(user, id, b) {
    need(user, 'asignar_bus_servicio');
    const o = getOrder(user, id);
    if (o.status !== 'en_bodega_operador') throw conflict('La carga aún no ingresa a bodega del operador');
    const op = operatorById(user.operador_id);
    const srv = op.servicios.find((s) => s.id === b.servicio_id);
    const driver = userById(b.conductor_id);
    if (!srv) throw bad('Servicio inválido para tu operador');
    if (!driver || driver.rol !== 'operador_conductor_bus' || driver.operador_id !== op.id) throw bad('Conductor de bus inválido');
    o.operacion.transporte = { bus_patente: srv.bus_patente, servicio: srv.servicio, conductor_id: driver.id, cargado_at: null };
    step(o, 'asignada_transporte', user);
    event(o, null, 'asignada_transporte', user, `Bus ${srv.bus_patente}, servicio ${srv.servicio}`);
    save('orders', 'events');
    return enrich(o);
  }

  // Permission + "this job is assigned to someone else" guard shared by scan and confirm.
  function checkAssigned(user, o, c) {
    need(user, c.scanPerm);
    if (c.cp === 'recoleccion' && user.id !== o.operacion.recoleccion.conductor_id) throw forbidden('Esta recolección está asignada a otro conductor');
    if (c.cp === 'carga_bus' && user.id !== o.operacion.transporte.conductor_id) throw forbidden('Este bus está asignado a otro conductor');
  }

  // One scan = one package at the checkpoint of the order's current status. Every hand-over needs all packages scanned.
  function scan(user, id, b) {
    const o = getOrder(user, id);
    const c = CP[o.status];
    if (!c) throw conflict('La orden no está en un paso que requiera escaneo');
    checkAssigned(user, o, c);
    const p = pkgsOf(o.id).find((x) => x.piece_code === String(b.piece_code || '').trim().toUpperCase());
    if (!p) throw notFound('Ese bulto no pertenece a esta orden');
    if (p.scan_history.some((s) => s.checkpoint === c.cp)) throw conflict('Bulto ya escaneado en este paso');
    const manual = !!b.manual;
    if (manual && !String(b.reason || '').trim()) throw bad('El registro manual requiere un motivo');
    p.scan_history.push({ checkpoint: c.cp, actor_id: user.id, actor_role: user.rol, at: now(), firma_url: null, ...(manual ? { manual: true, reason: b.reason.trim() } : {}) });
    p.status = PKG_STATUS[c.cp];
    event(o, p, 'bulto_escaneado_' + c.cp, user, manual ? `REGISTRO MANUAL: ${b.reason.trim()}` : p.piece_code);
    save('packages', 'events');
    return enrich(o);
  }

  // Mockup keeps the signature inline as a data URL (real system: upload the file, store its URL).
  function checkSignature(dataUrl) {
    const s = String(dataUrl || '');
    if (!/^data:image\/(png|svg\+xml)[;,]/.test(s) || s.length > 400000) throw bad('Firma inválida o demasiado grande');
    return s;
  }

  function confirm(user, id, b) {
    const o = getOrder(user, id);
    const c = CP[o.status];
    if (!c) throw conflict('No hay traspaso pendiente de confirmar');
    checkAssigned(user, o, c);
    const pk = pkgsOf(o.id);
    const missing = pk.filter((p) => !p.scan_history.some((s) => s.checkpoint === c.cp));
    if (missing.length) throw conflict(`Faltan ${missing.length} de ${pk.length} bultos por escanear`);
    let firma = null;
    if (c.signPerm) {
      need(user, c.signPerm);
      const persona = o.personas_autorizadas[c.point].find((p) => rutClean(p.rut) === rutClean(b.persona_rut));
      if (!persona) throw bad('Debes elegir una de las personas autorizadas');
      if (b.id_verificado !== true) throw bad('Confirma que verificaste el RUT contra la cédula');
      firma = checkSignature(b.firma);
      o.handoff[c.handoff] = { persona_autorizada: `${persona.nombre} (${persona.rut})`, escaneado_por: user.id, firma_url: firma, at: now() };
      pk.forEach((p) => { p.scan_history.find((s) => s.checkpoint === c.cp).firma_url = 'ref:handoff.' + c.handoff; });
    }
    const t = now();
    if (c.cp === 'recoleccion') o.operacion.recoleccion.completada_at = t;
    if (c.cp === 'ingreso_bodega_op') o.operacion.bodega_operador = { id: 'wh_' + o.operacion.operador_id, ingreso_at: t };
    if (c.cp === 'carga_bus') o.operacion.transporte.cargado_at = t;
    if (c.cp === 'entrega') o.operacion.entrega.completada_at = t;
    step(o, c.next, user);
    event(o, null, 'traspaso_' + c.cp, user, firma ? 'Firma capturada, RUT verificado visualmente' : 'Traspaso confirmado');
    save('orders', 'packages', 'events');
    return enrich(o);
  }

  // Who has to act next on an order — drives the "switch to next actor" button of the demo.
  function nextActor(o) {
    const byRole = (rol) => list('users').find((u) => u.rol === rol && u.operador_id === o.operacion.operador_id);
    const map = {
      creada: () => list('users').find((u) => u.rol === 'coordinador_logistico'),
      asignada_operador: () => byRole('operador_despachador'),
      recoleccion_asignada: () => userById(o.operacion.recoleccion.conductor_id),
      recolectada: () => byRole('operador_encargado_bodega'),
      en_bodega_operador: () => byRole('operador_encargado_bodega'),
      asignada_transporte: () => userById(o.operacion.transporte.conductor_id),
      cargada_bus: () => byRole('operador_conductor_entrega'),
    };
    const u = map[o.status] && map[o.status]();
    return u ? { id: u.id, nombre: u.nombre, rol: u.rol } : null;
  }

  return { db, list, save, bootstrap, publicUsers, userById, listOrders, orderDetail, events, addBodega, createOrder, assign, pickup, transport, scan, confirm, nextActor };
}
