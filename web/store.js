// Domain rules of the KARGO mockup, as plain functions over in-memory collections (same shape as web/data/*.json).
// This runs IN THE BROWSER for the demo. It is NOT a backend: it is the executable spec of the rules
// (state machine, permissions, validations, KPIs) that the real backend must enforce server-side.
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
  events: ['tracking_events.json', 'events'], incidents: ['incidents.json', 'incidents'], konnect: ['konnect.json', 'operators'],
  config: ['config.json', 'config'], invoices: ['invoices.json', 'invoices'],
};

// Status machine: status -> { checkpoint scanned at this status, next status once the hand-over is confirmed }.
// Statuses without an entry need a plain action instead of a scan (accept, designate, assign bus, assign last mile...).
const CP = {
  recoleccion_asignada: { cp: 'recoleccion', next: 'recolectada', scanPerm: 'escanear_bulto_recoleccion', signPerm: 'capturar_firma_entrega', point: 'origen', handoff: 'entrega' },
  recolectada: { cp: 'ingreso_bodega_op', next: 'en_bodega_operador', scanPerm: 'escanear_bulto_ingreso_bodega' },
  asignada_transporte: { cp: 'carga_bus', next: 'cargada_bus', scanPerm: 'escanear_bulto_carga_bus' },
  cargada_bus: { cp: 'ingreso_bodega_destino', next: 'en_bodega_destino', scanPerm: 'escanear_bulto_ingreso_destino' },
  ultima_milla_asignada: { cp: 'entrega', next: 'entregada', scanPerm: 'escanear_bulto_entrega', signPerm: 'capturar_firma_recepcion', point: 'destino', handoff: 'recepcion' },
  lista_retiro: { cp: 'entrega', next: 'entregada', scanPerm: 'escanear_bulto_entrega_retiro', signPerm: 'capturar_firma_recepcion', point: 'destino', handoff: 'recepcion' },
};
const PKG_STATUS = { recoleccion: 'recolectado', ingreso_bodega_op: 'en_bodega_operador', carga_bus: 'cargado_bus', ingreso_bodega_destino: 'en_bodega_destino', entrega: 'entregado' };
// Merchant only ever sees 5 states; the internal steps stay in the back office.
const MERCHANT_STATE = {
  creada: 'Creada', asignada_operador: 'Asignada', aceptada: 'Asignada', recoleccion_asignada: 'En recolección', recolectada: 'En tránsito',
  en_bodega_operador: 'En tránsito', asignada_transporte: 'En tránsito', cargada_bus: 'En tránsito', en_bodega_destino: 'En tránsito',
  ultima_milla_asignada: 'En tránsito', lista_retiro: 'En tránsito', entregada: 'Entregada',
};
// Ordered internal steps; the last-mile step depends on the modality chosen by the coordinator.
const FLOW_BASE = ['creada', 'asignada_operador', 'aceptada', 'recoleccion_asignada', 'recolectada', 'en_bodega_operador', 'asignada_transporte', 'cargada_bus', 'en_bodega_destino'];
const flowFor = (modalidad) => [...FLOW_BASE, modalidad === 'retiro' ? 'lista_retiro' : 'ultima_milla_asignada', 'entregada'];
const MODALIDADES = ['operador', 'retiro'];
const INCIDENT_TYPES = ['conteo', 'dano', 'faltante', 'otro'];

export { CP, MERCHANT_STATE, FILES, FLOW_BASE, flowFor, MODALIDADES, INCIDENT_TYPES, rutValid, rutFormat, rutDV };

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

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const HOUR = 3600e3;
const ratio = (n, d) => ({ n, d, pct: d ? Math.round((n / d) * 100) : null });
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
// next occurrence of HH:MM (local time) at or after `from`
function nextDeparture(hhmm, from) {
  const [h, m] = hhmm.split(':').map(Number), d = new Date(from);
  d.setHours(h, m, 0, 0);
  if (d < from) d.setDate(d.getDate() + 1);
  return d;
}
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

// db = { merchants: <content of merchants.json>, users: ..., ... }; persist(names) is called after every mutation.
// clock is injectable so time rules (2h bus window, KPIs) are testable.
export function createStore(db, persist = () => {}, clock = () => new Date()) {
  for (const [name, [, key]] of Object.entries(FILES)) db[name] = db[name] || { [key]: [] };
  const list = (n) => db[n][FILES[n][1]];
  const save = (...names) => persist(names);
  const nowD = () => clock();
  const now = () => nowD().toISOString();
  const cfg = () => ({ sla_promesa_horas: 48, ventana_bus_horas: 2, ...(list('config')[0] || {}) });

  const userById = (id) => list('users').find((u) => u.id === id);
  const operatorById = (id) => list('operators').find((o) => o.id === id);
  const roleOf = (u) => list('roles').find((r) => r.id === u.rol);
  const can = (u, p) => !!roleOf(u)?.permisos.includes(p);
  const need = (u, p) => { if (!can(u, p)) throw forbidden(`Tu rol no puede hacer esto (${p})`); };

  const pkgsOf = (orderId) => list('packages').filter((p) => p.order_id === orderId);
  const activePkgs = (orderId) => pkgsOf(orderId).filter((p) => p.status !== 'no_recolectado');
  const nextNum = (items) => items.reduce((m, x) => Math.max(m, parseInt(String(x.id).replace(/\D/g, ''), 10) || 0), 0) + 1;

  function event(order, pkg, type, user, note) {
    list('events').push({
      id: 'evt_' + (list('events').length + 1001), order_id: order ? order.id : null, package_id: pkg ? pkg.id : null, type,
      actor_role: user.rol, actor_id: user.id, at: now(), note,
    });
  }
  function step(order, stepName, user) {
    order.status = stepName;
    order.timeline.push({ step: stepName, at: now(), actor_role: user.rol, actor_id: user.id });
  }
  const sameOperator = (u, o) => !!u.operador_id && u.operador_id === o.operacion.operador_id;
  const SEES_ALL = ['coordinador_logistico', 'auditor', 'finanzas'];
  const visible = (user, o) => (user.rol === 'merchant' ? o.merchant_id === user.merchant_id : SEES_ALL.includes(user.rol) || sameOperator(user, o));

  function enrich(o) {
    const paquetes = pkgsOf(o.id), act = paquetes.filter((p) => p.status !== 'no_recolectado');
    const c = CP[o.status];
    return {
      ...o, paquetes, activos: act.length, estado_merchant: MERCHANT_STATE[o.status], flujo: flowFor(o.operacion.ultima_milla.modalidad),
      checkpoint_actual: c ? c.cp : null,
      escaneados: c ? act.filter((p) => p.scan_history.some((s) => s.checkpoint === c.cp)).length : 0,
      incidencias_abiertas: list('incidents').filter((i) => i.order_id === o.id && i.estado === 'abierta').length,
    };
  }
  function getOrder(user, id) {
    const o = list('orders').find((x) => x.id === id);
    if (!o || !visible(user, o)) throw notFound('Orden no encontrada');
    return o;
  }

  // ---- reads ---------------------------------------------------------------
  function bootstrap(user) {
    const out = { user, permisos: roleOf(user).permisos, mensajes: MERCHANT_STATE, config: cfg() };
    if (user.merchant_id) out.merchant = list('merchants').find((m) => m.id === user.merchant_id);
    if (user.operador_id) {
      const op = operatorById(user.operador_id);
      out.operator = { ...op, equipo: list('users').filter((u) => u.operador_id === op.id).map(({ id, nombre, rol }) => ({ id, nombre, rol })) };
    }
    if (user.rol === 'coordinador_logistico') {
      out.operators = list('operators').map(({ id, nombre }) => ({ id, nombre }));
      out.merchants = list('merchants').map((m) => ({ id: m.id, razon_social: m.razon_social }));
    }
    if (['finanzas', 'auditor'].includes(user.rol)) out.merchants = list('merchants').map((m) => ({ id: m.id, razon_social: m.razon_social }));
    return out;
  }
  const publicUsers = () => list('users').map(({ id, nombre, rol, merchant_id, operador_id }) => ({ id, nombre, rol, merchant_id, operador_id }));
  const listOrders = (user) => list('orders').filter((o) => visible(user, o)).map(enrich).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const orderDetail = (user, id) => enrich(getOrder(user, id));
  const events = (user, id) => { getOrder(user, id); return list('events').filter((e) => e.order_id === id); };

  // ---- merchant onboarding (KAM, inside the coordinator view) + merchant self service ------------------
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
  function merchantOf(user, merchantId) {
    const id = user.merchant_id || (can(user, 'registrar_merchant') ? merchantId : null);
    const m = list('merchants').find((x) => x.id === id);
    if (!m) throw forbidden(user.merchant_id || can(user, 'registrar_merchant') ? 'Merchant inexistente' : 'Solo un merchant puede hacer esto');
    return m;
  }

  function registerMerchant(user, b) {
    need(user, 'registrar_merchant');
    if (!String(b.razon_social || '').trim()) throw bad('Falta la razón social');
    if (!rutValid(b.rut)) throw bad('RUT de empresa inválido');
    if (list('merchants').some((m) => rutClean(m.rut) === rutClean(b.rut))) throw conflict('Ya existe un merchant con ese RUT');
    if (!String(b.contacto_nombre || '').trim()) throw bad('Falta el nombre del contacto');
    const n = nextNum(list('merchants').map((m, i) => ({ id: String(i + 1) })));
    const id = 'mer_' + slug(b.razon_social).slice(0, 12) + '_' + n;
    const merchant = {
      id, razon_social: String(b.razon_social).trim(), rut: rutFormat(b.rut), plan: b.plan === 'pro' ? 'pro' : 'basic',
      facturacion: { modalidad: 'mensual_consolidada', dia_cierre: 1, referencia_default: null }, bodegas: [], created_at: now(), registrado_por: user.id,
    };
    const u = { id: 'usr_m' + String(list('users').length + 1).padStart(3, '0'), nombre: `${String(b.contacto_nombre).trim()} (${merchant.razon_social.split(' ')[0]})`, rol: 'merchant', merchant_id: id };
    list('merchants').push(merchant); list('users').push(u);
    event(null, null, 'merchant_registrado', user, `Merchant registrado: ${merchant.razon_social}`);
    save('merchants', 'users', 'events');
    return { merchant, user: u };
  }

  function addBodega(user, b, merchantId) {
    if (!user.merchant_id) need(user, 'registrar_merchant'); else need(user, 'crear_orden');
    const m = merchantOf(user, merchantId);
    const d = b.direccion || {};
    for (const [k, v] of Object.entries({ nombre: b.nombre, ciudad: b.ciudad, región: d.region, comuna: d.comuna, dirección: d.direccion })) {
      if (!String(v || '').trim()) throw bad(`Bodega: falta ${k}`);
    }
    if (b.codigo_postal && !/^\d{7}$/.test(String(b.codigo_postal).trim())) throw bad('Bodega: código postal inválido (7 dígitos)');
    const bodega = {
      id: 'bod_' + slug(b.ciudad).slice(0, 5) + '_' + String(list('merchants').reduce((s, x) => s + x.bodegas.length, 0) + 1).padStart(2, '0'),
      nombre: b.nombre.trim(), ciudad: b.ciudad.trim(), es_origen_default: m.bodegas.length === 0,
      direccion: { region: d.region, ciudad: b.ciudad.trim(), comuna: d.comuna, direccion: d.direccion, codigo_postal: String(b.codigo_postal || '').trim() || null },
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

    const num = String(nextNum(list('orders'))).padStart(5, '0');
    const id = 'ot_' + num;
    const at = now();
    const pkgs = items.map((p, i) => ({
      id: `pkg_${num}_${i + 1}`, order_id: id, piece_code: `KARGO-${num}-${String(i + 1).padStart(3, '0')}`,
      descripcion: String(p.descripcion).trim(), peso_kg: Number(p.peso_kg),
      valor_declarado_clp: p.valor_declarado_clp === '' || p.valor_declarado_clp == null ? null : Number(p.valor_declarado_clp),
      status: 'pendiente', scan_history: [],
    }));
    const slim = ({ id: i, nombre, direccion }) => ({ id: i, nombre, direccion });
    const blank = { persona_autorizada: null, escaneado_por: null, firma_url: null, at: null };
    const order = {
      id, merchant_id: m.id, status: 'creada', created_by: user.id, created_at: at,
      bodega_origen: slim(origen), bodega_destino: slim(destino), personas_autorizadas: personas,
      referencia_cliente: String(b.referencia_cliente || '').trim() || null, mpo: String(b.mpo || '').trim() || null,
      facturable: true, periodo_facturacion: null,
      packages: pkgs.map((p) => p.id), bultos_declarados: pkgs.length, bultos_total: pkgs.length,
      conteo: { declarados: pkgs.length, recolectados: null, diferencia: 0, motivo: null, por: null, at: null },
      operacion: {
        coordinador_id: null, operador_id: null, asignado_operador_at: null,
        aceptacion: { estado: null, at: null, rechazos: [] },
        recoleccion: { conductor_id: null, movil_patente: null, asignado_at: null, completada_at: null },
        bodega_operador: { id: null, ingreso_at: null },
        transporte: { servicio_id: null, bus_patente: null, servicio: null, salida: null, salida_at: null, asignado_at: null, conductor_id: null, cargado_at: null, riesgo_sla: false, ventana_ok: null },
        bodega_destino_operador: { ingreso_at: null },
        ultima_milla: { modalidad: 'operador', conductor_id: null, movil_patente: null, asignado_at: null, punto_retiro: null, lista_at: null },
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

  // ---- coordinator: assign (with last-mile modality) ----------------------------------------------------
  function assign(user, id, b) {
    need(user, 'asignar_operador_transporte');
    const o = getOrder(user, id);
    if (o.status !== 'creada') throw conflict('La orden ya fue asignada');
    const op = operatorById(b.operador_id);
    if (!op) throw bad('Operador inexistente');
    const modalidad = b.ultima_milla || 'operador';
    if (!MODALIDADES.includes(modalidad)) throw bad('Modalidad de última milla inválida');
    Object.assign(o.operacion, { coordinador_id: user.id, operador_id: op.id, asignado_operador_at: now() });
    o.operacion.aceptacion = { estado: 'pendiente', at: null, rechazos: o.operacion.aceptacion.rechazos };
    o.operacion.ultima_milla.modalidad = modalidad;
    step(o, 'asignada_operador', user);
    event(o, null, 'orden_asignada_operador', user, `Asignada a ${op.nombre}`);
    save('orders', 'events');
    return enrich(o);
  }

  // ---- dispatcher: accept / reject / designate pickup / designate last mile -------------------------------
  function accept(user, id) {
    need(user, 'recibir_asignacion');
    const o = getOrder(user, id);
    if (o.status !== 'asignada_operador') throw conflict('La orden no está pendiente de aceptación');
    o.operacion.aceptacion = { ...o.operacion.aceptacion, estado: 'aceptada', at: now() };
    step(o, 'aceptada', user);
    event(o, null, 'orden_aceptada', user, 'Orden aceptada');
    save('orders', 'events');
    return enrich(o);
  }
  function reject(user, id, b) {
    need(user, 'recibir_asignacion');
    const o = getOrder(user, id);
    if (o.status !== 'asignada_operador') throw conflict('La orden no está pendiente de aceptación');
    const reason = String(b.reason || '').trim();
    if (!reason) throw bad('Indica el motivo del rechazo');
    o.operacion.aceptacion.rechazos.push({ operador_id: o.operacion.operador_id, por: user.id, motivo: reason, at: now() });
    o.operacion.aceptacion.estado = 'rechazada';
    Object.assign(o.operacion, { coordinador_id: null, operador_id: null, asignado_operador_at: null });
    step(o, 'creada', user);
    event(o, null, 'orden_rechazada', user, `Rechazada: ${reason}`);
    save('orders', 'events');
    return enrich(o);
  }
  function pickup(user, id, b) {
    need(user, 'designar_conductor_recoleccion');
    const o = getOrder(user, id);
    if (o.status !== 'aceptada') throw conflict('La orden no está pendiente de asignar recolección');
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
  function assignLastMile(user, id, b) {
    need(user, 'designar_ultima_milla');
    const o = getOrder(user, id);
    if (o.status !== 'en_bodega_destino') throw conflict('La orden aún no está en la bodega de destino');
    if (o.operacion.ultima_milla.modalidad !== 'operador') throw conflict('Esta orden usa retiro del destinatario');
    const op = operatorById(user.operador_id);
    const driver = userById(b.conductor_id);
    if (!driver || driver.rol !== 'operador_conductor_entrega' || driver.operador_id !== op.id) throw bad('Conductor de entrega inválido');
    if (!op.vehiculos.some((v) => v.patente === b.movil_patente)) throw bad('Móvil inválido para tu operador');
    Object.assign(o.operacion.ultima_milla, { conductor_id: driver.id, movil_patente: b.movil_patente, asignado_at: now() });
    step(o, 'ultima_milla_asignada', user);
    event(o, null, 'ultima_milla_asignada', user, `Conductor ${driver.id}, móvil ${b.movil_patente}`);
    save('orders', 'events');
    return enrich(o);
  }

  // ---- warehouse clerk: bus assignment with timetable suggestion (2h window) ---------------------------------
  function serviceOptions(user, id) {
    need(user, 'asignar_bus_servicio');
    const o = getOrder(user, id);
    const op = operatorById(user.operador_id), from = nowD(), win = cfg().ventana_bus_horas * HOUR;
    const a = o.bodega_origen.direccion.ciudad, z = o.bodega_destino.direccion.ciudad;
    const opts = op.servicios.filter((s) => s.origen === a && s.destino === z)
      .flatMap((s) => s.salidas.map((h) => ({ servicio_id: s.id, servicio: s.servicio, bus_patente: s.bus_patente, salida: h, salida_at: nextDeparture(h, from) })))
      .sort((x, y) => x.salida_at - y.salida_at).slice(0, 8)
      .map((x, i) => ({ ...x, salida_at: x.salida_at.toISOString(), en_ventana: new Date(x.salida_at) - from <= win, sugerido: i === 0 }));
    return opts;
  }
  function transport(user, id, b) {
    need(user, 'asignar_bus_servicio');
    const o = getOrder(user, id);
    if (o.status !== 'en_bodega_operador') throw conflict('La carga aún no ingresa a bodega del operador');
    const op = operatorById(user.operador_id);
    const srv = op.servicios.find((s) => s.id === b.servicio_id);
    const driver = userById(b.conductor_id);
    if (!srv) throw bad('Servicio inválido para tu operador');
    if (!serviceOptions(user, id).length) throw bad('No hay servicios en la parrilla para esa ruta');
    if (srv.origen !== o.bodega_origen.direccion.ciudad || srv.destino !== o.bodega_destino.direccion.ciudad) throw bad('Ese servicio no cubre la ruta de la orden');
    if (!HHMM.test(b.salida || '') || !srv.salidas.includes(b.salida)) throw bad('Salida inválida para ese servicio');
    if (!driver || driver.rol !== 'operador_conductor_bus' || driver.operador_id !== op.id) throw bad('Conductor de bus inválido');
    const t0 = nowD(), salidaAt = nextDeparture(b.salida, t0), risk = salidaAt - t0 > cfg().ventana_bus_horas * HOUR;
    o.operacion.transporte = { servicio_id: srv.id, bus_patente: srv.bus_patente, servicio: srv.servicio, salida: b.salida, salida_at: salidaAt.toISOString(), asignado_at: t0.toISOString(), conductor_id: driver.id, cargado_at: null, riesgo_sla: risk, ventana_ok: null };
    step(o, 'asignada_transporte', user);
    event(o, null, 'asignada_transporte', user, `Bus ${srv.bus_patente}, servicio ${srv.servicio}`);
    if (risk) event(o, null, 'riesgo_ventana_bus', user, `Salida ${b.salida} supera la ventana de ${cfg().ventana_bus_horas} h`);
    save('orders', 'events');
    return enrich(o);
  }
  function markPickupReady(user, id) {
    need(user, 'marcar_lista_retiro');
    const o = getOrder(user, id);
    if (o.status !== 'en_bodega_destino') throw conflict('La orden aún no está en la bodega de destino');
    if (o.operacion.ultima_milla.modalidad !== 'retiro') throw conflict('Esta orden usa última milla con operador');
    const op = operatorById(user.operador_id), city = o.bodega_destino.direccion.ciudad;
    const punto = (op.puntos_retiro && (op.puntos_retiro[city] || op.puntos_retiro.default)) || `Oficina ${op.nombre} (${city})`;
    Object.assign(o.operacion.ultima_milla, { punto_retiro: punto, lista_at: now() });
    step(o, 'lista_retiro', user);
    event(o, null, 'lista_para_retiro', user, `Punto de retiro: ${punto}`);
    save('orders', 'events');
    return enrich(o);
  }

  // ---- pickup driver: adjust box count (allowed; leaves a variance record + incident, new labels are printed) ------
  function adjustCount(user, id, b) {
    need(user, 'ajustar_bultos_recoleccion');
    const o = getOrder(user, id);
    if (o.status !== 'recoleccion_asignada') throw conflict('Solo se puede ajustar la cantidad durante la recolección');
    if (user.id !== o.operacion.recoleccion.conductor_id) throw forbidden('Esta recolección está asignada a otro conductor');
    const add = b.add === undefined || b.add === '' ? 0 : Number(b.add), remove = Array.isArray(b.remove) ? b.remove : [];
    if (!Number.isInteger(add) || add < 0 || add > 50) throw bad('Cantidad a agregar inválida');
    if (!add && !remove.length) throw bad('No hay cambios que aplicar');
    const reason = String(b.reason || '').trim();
    if (!reason) throw bad('Indica el motivo del ajuste de bultos');
    const pk = pkgsOf(o.id);
    remove.forEach((code) => {
      const p = pk.find((x) => x.piece_code === String(code).trim().toUpperCase() && x.status !== 'no_recolectado');
      if (!p) throw notFound('Ese bulto no pertenece a esta orden');
      if (p.scan_history.length) throw conflict('Ese bulto ya fue escaneado, no se puede quitar');
      p.status = 'no_recolectado'; p.motivo = reason;
    });
    const num = o.id.replace('ot_', ''), first = pk.find((x) => x.status !== 'no_recolectado') || pk[0];
    let idx = Math.max(...pk.map((p) => parseInt(p.piece_code.slice(-3), 10)));
    for (let k = 0; k < add; k++) {
      idx += 1;
      const p = { id: `pkg_${num}_${idx}`, order_id: o.id, piece_code: `KARGO-${num}-${String(idx).padStart(3, '0')}`, descripcion: String(b.descripcion || '').trim() || (first ? first.descripcion : 'Agregado en recolección'),
        peso_kg: Number(b.peso_kg) || 0, valor_declarado_clp: null, status: 'pendiente', scan_history: [], agregado_en_recoleccion: true };
      list('packages').push(p); o.packages.push(p.id);
    }
    const n = activePkgs(o.id).length;
    o.bultos_total = n;
    o.conteo = { declarados: o.bultos_declarados, recolectados: n, diferencia: n - o.bultos_declarados, motivo: reason, por: user.id, at: now() };
    let inc = list('incidents').find((i) => i.order_id === o.id && i.tipo === 'conteo' && i.estado === 'abierta');
    if (!inc) { inc = { id: 'inc_' + String(list('incidents').length + 1).padStart(3, '0'), order_id: o.id, tipo: 'conteo', estado: 'abierta', creada_por: user.id, at: now(), foto: null, resolucion: null }; list('incidents').push(inc); }
    Object.assign(inc, { detalle: reason, esperado: o.bultos_declarados, real: n });
    event(o, null, 'conteo_ajustado', user, `Conteo ajustado: ${o.bultos_declarados} → ${n} (${reason})`);
    save('orders', 'packages', 'events', 'incidents');
    return enrich(o);
  }

  // ---- incidents -----------------------------------------------------------------------------------------------------------
  const okPhoto = (f) => { if (!f) return null; if (!/^data:image\/(jpeg|png);base64,/.test(f) || f.length > 300000) throw bad('Foto inválida o demasiado grande'); return f; };
  function reportIncident(user, id, b) {
    need(user, 'reportar_incidencia');
    const o = getOrder(user, id);
    if (!INCIDENT_TYPES.includes(b.tipo)) throw bad('Tipo de incidencia inválido');
    const detalle = String(b.detalle || '').trim();
    if (!detalle) throw bad('Describe la incidencia');
    const inc = { id: 'inc_' + String(list('incidents').length + 1).padStart(3, '0'), order_id: o.id, tipo: b.tipo, estado: 'abierta', creada_por: user.id, at: now(), detalle, foto: okPhoto(b.foto), esperado: null, real: null, resolucion: null };
    list('incidents').push(inc);
    event(o, null, 'incidencia_reportada', user, `Incidencia (${b.tipo}): ${detalle}`);
    save('incidents', 'events');
    return inc;
  }
  function resolveIncident(user, incId, b) {
    need(user, 'resolver_incidencia');
    const inc = list('incidents').find((i) => i.id === incId);
    if (!inc) throw notFound('Incidencia no encontrada');
    const o = getOrder(user, inc.order_id);
    if (inc.estado === 'resuelta') throw conflict('La incidencia ya está resuelta');
    const nota = String(b.nota || '').trim();
    if (!nota) throw bad('Indica la nota de resolución');
    Object.assign(inc, { estado: 'resuelta', resolucion: { por: user.id, at: now(), nota } });
    event(o, null, 'incidencia_resuelta', user, `Resuelta: ${nota}`);
    save('incidents', 'events');
    return inc;
  }
  const incidents = (user) => list('incidents').filter((i) => { const o = list('orders').find((x) => x.id === i.order_id); return o && visible(user, o); }).sort((a, b) => b.at.localeCompare(a.at));

  // ---- scans and hand-overs ----------------------------------------------------------------------------------------------
  // Permission + "this job is assigned to someone else" guard shared by scan and confirm.
  function checkAssigned(user, o, c) {
    need(user, c.scanPerm);
    if (c.cp === 'recoleccion' && user.id !== o.operacion.recoleccion.conductor_id) throw forbidden('Esta recolección está asignada a otro conductor');
    if (c.cp === 'carga_bus' && user.id !== o.operacion.transporte.conductor_id) throw forbidden('Este bus está asignado a otro conductor');
    if (o.status === 'ultima_milla_asignada' && user.id !== o.operacion.ultima_milla.conductor_id) throw forbidden('Esta entrega está asignada a otro conductor');
  }

  // One scan = one package at the checkpoint of the order's current status. Every hand-over needs all packages scanned.
  function scan(user, id, b) {
    const o = getOrder(user, id);
    const c = CP[o.status];
    if (!c) throw conflict('La orden no está en un paso que requiera escaneo');
    checkAssigned(user, o, c);
    const p = activePkgs(o.id).find((x) => x.piece_code === String(b.piece_code || '').trim().toUpperCase());
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
    const pk = activePkgs(o.id);
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
    if (c.cp === 'recoleccion') { o.operacion.recoleccion.completada_at = t; o.conteo.recolectados = pk.length; o.conteo.diferencia = pk.length - o.bultos_declarados; o.bultos_total = pk.length; }
    if (c.cp === 'ingreso_bodega_op') o.operacion.bodega_operador = { id: 'wh_' + o.operacion.operador_id, ingreso_at: t };
    if (c.cp === 'carga_bus') { const tr = o.operacion.transporte; tr.cargado_at = t; tr.ventana_ok = new Date(t) - new Date(tr.asignado_at) <= cfg().ventana_bus_horas * HOUR; }
    if (c.cp === 'ingreso_bodega_destino') o.operacion.bodega_destino_operador = { ingreso_at: t };
    if (c.cp === 'entrega') o.operacion.entrega.completada_at = t;
    step(o, c.next, user);
    event(o, null, 'traspaso_' + c.cp, user, firma ? 'Firma capturada, RUT verificado visualmente' : 'Traspaso confirmado');
    save('orders', 'packages', 'events');
    return enrich(o);
  }

  // ---- Konnect prefetch (operator onboarding) ------------------------------------------------------------------------------------
  const konnectCatalog = (user) => { need(user, 'importar_operador'); return list('konnect').map((k) => ({ ...k, importado: list('operators').some((o) => o.id === k.id) })); };
  function importOperator(user, konnectId) {
    need(user, 'importar_operador');
    const k = list('konnect').find((x) => x.id === konnectId);
    if (!k) throw notFound('Operador no existe en Konnect');
    if (operatorById(k.id)) throw conflict('El operador ya fue importado');
    const { equipo, ...op } = k;
    list('operators').push({ ...op, origen: 'konnect', importado_at: now() });
    (equipo || []).forEach((m) => { if (!userById(m.id)) list('users').push({ id: m.id, nombre: m.nombre, rol: m.rol, operador_id: k.id }); });
    event(null, null, 'operador_importado', user, `Operador importado desde Konnect: ${k.nombre}`);
    save('operators', 'users', 'events');
    return operatorById(k.id);
  }

  // ---- KPIs (Control Tower), reconciliation (Audit) and period report (Finance) ----------------------------------------------------
  function kpis(user) {
    need(user, 'ver_kpis');
    const os = list('orders').filter((o) => visible(user, o)), c = cfg(), t = nowD();
    const picked = os.filter((o) => o.operacion.recoleccion.completada_at), assignedOnce = os.filter((o) => o.operacion.operador_id);
    const asignaciones = os.reduce((s, o) => s + (o.operacion.operador_id ? 1 : 0) + o.operacion.aceptacion.rechazos.length, 0);
    const ptat = os.filter((o) => o.operacion.bodega_operador.ingreso_at && o.operacion.asignado_operador_at).map((o) => (new Date(o.operacion.bodega_operador.ingreso_at) - new Date(o.operacion.asignado_operador_at)) / HOUR);
    const inbound = os.filter((o) => o.operacion.bodega_operador.ingreso_at);
    const delivered = os.filter((o) => o.operacion.entrega.completada_at);
    const R = delivered.map((o) => (new Date(o.operacion.entrega.completada_at) - new Date(o.created_at)) / HOUR / c.sla_promesa_horas);
    const loaded = os.filter((o) => o.operacion.transporte.cargado_at);
    const lots = {}; os.filter((o) => o.mpo).forEach((o) => (lots[o.mpo] = lots[o.mpo] || []).push(o));
    const lotList = Object.values(lots), lotsPicked = lotList.filter((l) => l.some((o) => o.operacion.recoleccion.completada_at));
    const vehCost = (pat) => (list('operators').flatMap((o) => o.vehiculos).find((v) => v.patente === pat) || {}).costo_dia || 0;
    const usedVeh = [...new Set(picked.map((o) => o.operacion.recoleccion.movil_patente))], cost = usedVeh.reduce((s, p) => s + vehCost(p), 0);
    const boxesPicked = picked.reduce((s, o) => s + o.conteo.recolectados, 0);
    const riesgos = os.filter((o) => o.status === 'asignada_transporte').map((o) => {
      const tr = o.operacion.transporte;
      return { id: o.id, motivo: t - new Date(tr.asignado_at) > c.ventana_bus_horas * HOUR ? 'ventana_vencida' : tr.riesgo_sla ? 'riesgo_salida' : null };
    }).filter((r) => r.motivo);
    return {
      ordenes: os.length, asignaciones,
      ssp: ratio(picked.length, assignedOnce.length), aceptacion: ratio(os.filter((o) => o.operacion.aceptacion.estado === 'aceptada').length, asignaciones),
      ptat_horas: avg(ptat) == null ? null : Math.round(avg(ptat) * 10) / 10,
      adherencia: ratio(picked.reduce((s, o) => s + o.conteo.recolectados, 0), picked.reduce((s, o) => s + o.bultos_declarados, 0)),
      inbound: ratio(inbound.reduce((s, o) => s + activePkgs(o.id).filter((p) => p.scan_history.some((x) => x.checkpoint === 'ingreso_bodega_op')).length, 0), inbound.reduce((s, o) => s + o.conteo.recolectados, 0)),
      nivel_servicio: { ...ratio(R.filter((r) => r <= 1).length, delivered.length), r_prom: avg(R) == null ? null : Math.round(avg(R) * 100) / 100 },
      ventana_bus: ratio(loaded.filter((o) => o.operacion.transporte.ventana_ok).length, loaded.length),
      mpo: ratio(lotList.filter((l) => l.every((o) => o.status === 'entregada') && l.some((o) => o.operacion.recoleccion.completada_at)).length, lotsPicked.length),
      cps_recoleccion: boxesPicked && cost ? Math.round(cost / boxesPicked) : null,
      riesgos, incidencias_abiertas: incidents(user).filter((i) => i.estado === 'abierta').length,
    };
  }
  function reconciliation(user) {
    need(user, 'ver_conciliacion');
    const cnt = (o, cp) => activePkgs(o.id).filter((p) => p.scan_history.some((s) => s.checkpoint === cp)).length;
    return list('orders').filter((o) => visible(user, o) && o.operacion.operador_id).map((o) => ({
      id: o.id, estado: o.status, declarados: o.bultos_declarados, recolectados: o.conteo.recolectados,
      ingreso_op: cnt(o, 'ingreso_bodega_op'), cargados: cnt(o, 'carga_bus'), ingreso_destino: cnt(o, 'ingreso_bodega_destino'), entregados: cnt(o, 'entrega'),
      dif_conteo: o.conteo.recolectados == null ? 0 : o.conteo.diferencia, incidencias_abiertas: list('incidents').filter((i) => i.order_id === o.id && i.estado === 'abierta').length,
    }));
  }
  function finance(user, q = {}) {
    need(user, 'ver_finanzas');
    const from = q.from ? new Date(q.from + 'T00:00:00') : new Date(0), to = q.to ? new Date(q.to + 'T23:59:59.999') : new Date(8.64e15);
    const rows = list('orders').filter((o) => visible(user, o) && (!q.merchant_id || o.merchant_id === q.merchant_id) && new Date(o.created_at) >= from && new Date(o.created_at) <= to).map((o) => {
      const pk = activePkgs(o.id), m = list('merchants').find((x) => x.id === o.merchant_id), op = o.operacion.operador_id ? operatorById(o.operacion.operador_id) : null;
      return { id: o.id, merchant_id: o.merchant_id, merchant: m ? m.razon_social : o.merchant_id, origen: o.bodega_origen.direccion.ciudad, destino: o.bodega_destino.direccion.ciudad, bultos: pk.length,
        peso_kg: Math.round(pk.reduce((s, p) => s + (p.peso_kg || 0), 0) * 10) / 10, valor_declarado_clp: pk.reduce((s, p) => s + (p.valor_declarado_clp || 0), 0), estado: o.status, creada: o.created_at,
        entregada: o.operacion.entrega.completada_at, operador: op ? op.nombre : null, referencia: o.referencia_cliente, periodo: o.created_at.slice(0, 7) };
    }).sort((a, b) => b.creada.localeCompare(a.creada));
    const group = (key, name) => Object.values(rows.reduce((m, r) => { const g = (m[r[key]] = m[r[key]] || { clave: r[key], nombre: r[name] || '—', ordenes: 0, bultos: 0, peso_kg: 0, valor_declarado_clp: 0, entregadas: 0 }); g.ordenes++; g.bultos += r.bultos; g.peso_kg = Math.round((g.peso_kg + r.peso_kg) * 10) / 10; g.valor_declarado_clp += r.valor_declarado_clp; g.entregadas += r.estado === 'entregada' ? 1 : 0; return m; }, {}));
    return { rows, por_merchant: group('merchant_id', 'merchant'), por_operador: group('operador', 'operador'), totales: { ordenes: rows.length, bultos: rows.reduce((s, r) => s + r.bultos, 0), peso_kg: Math.round(rows.reduce((s, r) => s + r.peso_kg, 0) * 10) / 10, entregadas: rows.filter((r) => r.estado === 'entregada').length } };
  }

  // Who has to act next on an order — drives the "switch to next actor" button of the demo.
  function nextActor(o) {
    const opId = o.operacion.operador_id, byRole = (rol) => list('users').find((u) => u.rol === rol && u.operador_id === opId);
    const lm = o.operacion.ultima_milla;
    const map = {
      creada: () => list('users').find((u) => u.rol === 'coordinador_logistico'),
      asignada_operador: () => byRole('operador_despachador'),
      aceptada: () => byRole('operador_despachador'),
      recoleccion_asignada: () => userById(o.operacion.recoleccion.conductor_id),
      recolectada: () => byRole('operador_encargado_bodega'),
      en_bodega_operador: () => byRole('operador_encargado_bodega'),
      asignada_transporte: () => userById(o.operacion.transporte.conductor_id),
      cargada_bus: () => byRole('operador_encargado_bodega'),
      en_bodega_destino: () => (lm.modalidad === 'retiro' ? byRole('operador_encargado_bodega') : byRole('operador_despachador')),
      ultima_milla_asignada: () => userById(lm.conductor_id),
      lista_retiro: () => byRole('operador_encargado_bodega'),
    };
    const u = map[o.status] && map[o.status]();
    return u ? { id: u.id, nombre: u.nombre, rol: u.rol } : null;
  }

  return {
    db, list, save, bootstrap, publicUsers, userById, listOrders, orderDetail, events, registerMerchant, addBodega, createOrder, assign, accept, reject, pickup,
    assignLastMile, serviceOptions, transport, markPickupReady, adjustCount, reportIncident, resolveIncident, incidents, scan, confirm, konnectCatalog, importOperator,
    kpis, reconciliation, finance, nextActor,
  };
}
