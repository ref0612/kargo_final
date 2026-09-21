// Regenerates web/data/*.json: master data + a demo scenario run through the REAL domain rules (web/store.js) with a
// simulated clock, so the seeded orders (and the KPIs computed from them) are consistent by construction.
// Usage: npm run seed
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, rutDV, rutFormat, FILES } from '../web/store.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'data');
const rut = (body) => rutFormat(body + rutDV(String(body)));
const persona = (nombre, body, tel, cargo = '') => ({ nombre, rut: rut(body), telefono: tel, cargo });
const addr = (region, ciudad, comuna, direccion, codigo_postal) => ({ region, ciudad, comuna, direccion, codigo_postal });
const scribble = () => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120"><path d="M20 80 C50 10 70 110 100 50 S150 20 170 70 220 90 280 30" fill="none" stroke="#1a2420" stroke-width="3" stroke-linecap="round"/></svg>');

// ---- operators (also the Konnect catalog: the real onboarding is a prefetch from Konnect) ------------------------------
const svc = (id, servicio, bus_patente, origen, destino, salidas, duracion_h) => ({ id, servicio, bus_patente, origen, destino, salidas, duracion_h });
const team = (p, prefix) => [
  { id: `usr_d${prefix}`, nombre: p[0], rol: 'operador_despachador' }, { id: `usr_r${prefix}`, nombre: p[1], rol: 'operador_conductor_recoleccion' },
  { id: `usr_b${prefix}`, nombre: p[2], rol: 'operador_encargado_bodega' }, { id: `usr_c${prefix}`, nombre: p[3], rol: 'operador_conductor_bus' },
  { id: `usr_e${prefix}`, nombre: p[4], rol: 'operador_conductor_entrega' },
];
const OP_SUR = {
  id: 'op_transportes_sur', nombre: 'Transportes Sur Ltda.',
  vehiculos: [{ patente: 'FG-JI-98', tipo: 'Camión 3/4', costo_dia: 85000 }, { patente: 'HK-LM-45', tipo: 'Furgón', costo_dia: 60000 }, { patente: 'JK-LM-01', tipo: 'Camioneta', costo_dia: 45000 }],
  servicios: [
    svc('srv_sur_1', 'Interurbano Sur', 'AB-CD-12', 'Santiago', 'Temuco', ['07:00', '13:00', '19:30'], 9), svc('srv_sur_2', 'Expreso Araucanía', 'CD-EF-34', 'Santiago', 'Temuco', ['10:00', '22:00'], 8),
    svc('srv_sur_3', 'Costa Sur', 'EF-GH-56', 'Santiago', 'Concepción', ['06:30', '12:30', '18:00', '23:30'], 6), svc('srv_sur_4', 'Retorno Norte', 'GH-IJ-78', 'Concepción', 'Santiago', ['08:00', '14:00', '20:00'], 6),
    svc('srv_sur_5', 'Retorno Araucanía', 'IJ-KL-90', 'Temuco', 'Santiago', ['09:00', '15:00', '21:30'], 9), svc('srv_sur_6', 'Bío-Araucanía', 'KL-MN-12', 'Concepción', 'Temuco', ['11:00', '17:00'], 4),
  ],
  puntos_retiro: { Temuco: 'Terminal Temuco · Oficina Transportes Sur, andén 4', Santiago: 'Terminal Alameda · Of. Encomiendas Sur', Concepción: 'Terminal Collao · Of. Transportes Sur', default: 'Oficina Transportes Sur' },
};
const TEAM_SUR = [
  { id: 'usr_d05', nombre: 'Patricia Lagos', rol: 'operador_despachador' }, { id: 'usr_210', nombre: 'Héctor Ramos', rol: 'operador_conductor_recoleccion' },
  { id: 'usr_211', nombre: 'Sergio Muñoz', rol: 'operador_conductor_recoleccion' }, { id: 'usr_305', nombre: 'Camila Reyes', rol: 'operador_encargado_bodega' },
  { id: 'usr_301', nombre: 'Jorge Pino', rol: 'operador_conductor_bus' }, { id: 'usr_302', nombre: 'Daniel Araya', rol: 'operador_conductor_bus' },
  { id: 'usr_401', nombre: 'Felipe Lira', rol: 'operador_conductor_entrega' },
];
const OP_ANDES = {
  id: 'op_andes_cargo', nombre: 'Andes Cargo S.A.',
  vehiculos: [{ patente: 'RT-YU-11', tipo: 'Camión 3/4', costo_dia: 80000 }],
  servicios: [svc('srv_andes_1', 'Andes Norte', 'PL-OK-77', 'Santiago', 'Temuco', ['08:30', '16:30'], 9), svc('srv_andes_2', 'Andes Regreso', 'PL-OK-78', 'Temuco', 'Santiago', ['09:30', '17:30'], 9)],
  puntos_retiro: { default: 'Oficina Andes Cargo (terminal de la ciudad)' },
};
const TEAM_ANDES = [
  { id: 'usr_d06', nombre: 'Marcela Núñez', rol: 'operador_despachador' }, { id: 'usr_212', nombre: 'Tomás Vera', rol: 'operador_conductor_recoleccion' },
  { id: 'usr_306', nombre: 'Elena Campos', rol: 'operador_encargado_bodega' }, { id: 'usr_303', nombre: 'Raúl Godoy', rol: 'operador_conductor_bus' },
  { id: 'usr_402', nombre: 'Nicolás Paz', rol: 'operador_conductor_entrega' },
];
// not imported yet: available to import from the coordinator's "Operadores" screen
const KONNECT_NEW = [
  { id: 'op_patagonia_express', nombre: 'Patagonia Express Ltda.',
    vehiculos: [{ patente: 'PX-11-AA', tipo: 'Camión 3/4', costo_dia: 90000 }, { patente: 'PX-22-BB', tipo: 'Furgón', costo_dia: 58000 }],
    servicios: [svc('srv_pat_1', 'Patagonia Norte', 'PE-10-01', 'Santiago', 'Valdivia', ['20:00'], 12), svc('srv_pat_2', 'Patagonia Sur', 'PE-10-02', 'Valdivia', 'Santiago', ['19:00'], 12)],
    puntos_retiro: { default: 'Terminal Valdivia · Of. Patagonia Express' }, equipo: team(['Ignacio Mora', 'Bruno Salas', 'Paula Ortiz', 'Mario Rey', 'Claudio Pérez'], 'p') },
  { id: 'op_pacifico_cargo', nombre: 'Pacífico Cargo S.A.',
    vehiculos: [{ patente: 'PC-33-CC', tipo: 'Camión 3/4', costo_dia: 88000 }],
    servicios: [svc('srv_pac_1', 'Pacífico Costa', 'PC-20-01', 'Santiago', 'Valparaíso', ['07:30', '12:00', '18:30'], 2)],
    puntos_retiro: { default: 'Terminal Valparaíso · Of. Pacífico Cargo' }, equipo: team(['Rosa Duarte', 'Iván Lagos', 'Nora Vidal', 'Óscar Bravo', 'Luis Tapia'], 'q') },
];

// ---- master data --------------------------------------------------------------------------------------------------------
const db = {
  config: { _comment: 'Business rules used by KPIs and the bus window.', config: [{ sla_promesa_horas: 48, ventana_bus_horas: 2 }] },
  merchants: {
    _comment: 'B2B merchant accounts (registered by the KAM from the coordinator view). bodegas feeds the origin dropdown (filtered by ciudad). contactos = default authorized persons (min 2), validated visually by crews against the RUT. Billing ON HOLD.',
    merchants: [
      { id: 'mer_falabella', razon_social: 'Falabella Retail S.A.', rut: rut(90749000), plan: 'pro', facturacion: { modalidad: 'mensual_consolidada', dia_cierre: 1, referencia_default: null }, registrado_por: 'usr_c01', created_at: '2025-01-10T09:00:00.000Z',
        bodegas: [
          { id: 'bod_scl_01', nombre: 'CD Pudahuel', ciudad: 'Santiago', es_origen_default: true, direccion: addr('Metropolitana', 'Santiago', 'Quilicura', 'Av. Presidente Eduardo Frei Montalva 8301', '8730000'),
            contactos: [persona('Juan Pérez', 12345678, '+56912345678', 'Jefe de bodega'), persona('Ana Rojas', 13876543, '+56911223344', 'Asistente de bodega')] },
          { id: 'bod_scl_02', nombre: 'CD Lo Aguirre', ciudad: 'Santiago', es_origen_default: false, direccion: addr('Metropolitana', 'Santiago', 'Pudahuel', 'Ruta 68 km 12', '9020000'),
            contactos: [persona('Luis Toro', 11222333, '+56922334455', 'Encargado'), persona('Marta Silva', 10998877, '+56933445566', 'Supervisora')] },
          { id: 'bod_tem_03', nombre: 'CD Temuco', ciudad: 'Temuco', es_origen_default: false, direccion: addr('Araucanía', 'Temuco', 'Temuco', 'Manuel Montt 452', '4780000'),
            contactos: [persona('María González', 14987654, '+56987654321', 'Encargada de recepción'), persona('Pedro Soto', 15234567, '+56988997766', 'Guardia de bodega')] },
          { id: 'bod_con_04', nombre: 'CD Concepción', ciudad: 'Concepción', es_origen_default: false, direccion: addr('Biobío', 'Concepción', 'San Pedro de la Paz', 'Av. Los Carrera 1500', '4030000'),
            contactos: [persona('Rosa Vega', 9876543, '+56944556677', 'Jefa de bodega'), persona('Iván Cortés', 16543210, '+56955667788', 'Asistente')] },
        ] },
      { id: 'mer_ripley', razon_social: 'Ripley Corp S.A.', rut: rut(76123456), plan: 'basic', facturacion: { modalidad: 'mensual_consolidada', dia_cierre: 1, referencia_default: null }, registrado_por: 'usr_c01', created_at: '2025-06-02T10:00:00.000Z',
        bodegas: [
          { id: 'bod_rip_01', nombre: 'CD Renca', ciudad: 'Santiago', es_origen_default: true, direccion: addr('Metropolitana', 'Santiago', 'Renca', 'Av. Presidente Balmaceda 2300', '8640000'),
            contactos: [persona('Carolina Vidal', 15111222, '+56977001122', 'Jefa de bodega'), persona('Esteban Lara', 14222333, '+56977003344', 'Supervisor')] },
          { id: 'bod_rip_02', nombre: 'Tienda Temuco', ciudad: 'Temuco', es_origen_default: false, direccion: addr('Araucanía', 'Temuco', 'Temuco', 'Av. Alemania 671', '4780000'),
            contactos: [persona('Gabriela Núñez', 16333444, '+56977005566', 'Encargada'), persona('Rodrigo Mena', 15444555, '+56977007788', 'Bodeguero')] },
        ] },
    ],
  },
  users: {
    _comment: 'DEMO users only (role switcher). No passwords: real auth belongs to the backend.',
    users: [
      { id: 'usr_042', nombre: 'Carla Mendoza (Falabella)', rol: 'merchant', merchant_id: 'mer_falabella' },
      { id: 'usr_043', nombre: 'Tomás Ibarra (Ripley)', rol: 'merchant', merchant_id: 'mer_ripley' },
      { id: 'usr_c01', nombre: 'Andrés Fuentes', rol: 'coordinador_logistico' },
      { id: 'usr_a01', nombre: 'Valentina Rojas', rol: 'auditor' },
      { id: 'usr_f01', nombre: 'Diego Salas', rol: 'finanzas' },
      ...TEAM_SUR.map((m) => ({ ...m, operador_id: OP_SUR.id })), ...TEAM_ANDES.map((m) => ({ ...m, operador_id: OP_ANDES.id })),
    ],
  },
  operators: { _comment: 'Imported from Konnect (prefetch). servicios = the operator timetable (parrilla) used for bus suggestions.', operators: [{ ...OP_SUR, origen: 'konnect' }, { ...OP_ANDES, origen: 'konnect' }] },
  konnect: { _comment: 'Mock of the Konnect catalog. The coordinator imports an operator (fleet, timetable, team) from here.', operators: [{ ...OP_SUR, equipo: TEAM_SUR }, { ...OP_ANDES, equipo: TEAM_ANDES }, ...KONNECT_NEW] },
  roles: {
    _comment: 'Every physical hand-over needs scan + timestamp + user. Only pickup (origin) and final delivery also need a signature of an authorized person.',
    roles: [
      { id: 'merchant', nombre: 'Merchant', nivel: 'cliente', permisos: ['crear_orden', 'ver_seguimiento', 'reportar_incidencia'], no_permitido: ['asignar_operador', 'escanear_bultos', 'editar_operacion'] },
      { id: 'coordinador_logistico', nombre: 'Coordinador Logístico / Control Tower', nivel: 'kargo', permisos: ['ver_ordenes_pendientes', 'asignar_operador_transporte', 'registrar_merchant', 'importar_operador', 'ver_kpis', 'ver_conciliacion', 'resolver_incidencia'] },
      { id: 'operador_despachador', nombre: 'Despachador (Operador de Transporte)', nivel: 'operador', permisos: ['recibir_asignacion', 'designar_conductor_recoleccion', 'designar_movil_recoleccion', 'designar_ultima_milla'] },
      { id: 'operador_conductor_recoleccion', nombre: 'Conductor / Auxiliar de Recolección', nivel: 'operador', permisos: ['escanear_bulto_recoleccion', 'capturar_firma_entrega', 'ajustar_bultos_recoleccion', 'reportar_incidencia'] },
      { id: 'operador_encargado_bodega', nombre: 'Encargado Bodega Operador (WH1)', nivel: 'operador', permisos: ['escanear_bulto_ingreso_bodega', 'asignar_bus_servicio', 'escanear_bulto_ingreso_destino', 'marcar_lista_retiro', 'escanear_bulto_entrega_retiro', 'capturar_firma_recepcion', 'reportar_incidencia'] },
      { id: 'operador_conductor_bus', nombre: 'Conductor / Auxiliar de Bus', nivel: 'operador', permisos: ['escanear_bulto_carga_bus', 'reportar_incidencia'] },
      { id: 'operador_conductor_entrega', nombre: 'Conductor / Auxiliar de Entrega (última milla)', nivel: 'operador', permisos: ['escanear_bulto_entrega', 'capturar_firma_recepcion', 'reportar_incidencia'] },
      { id: 'auditor', nombre: 'Auditoría / Conciliación', nivel: 'kargo', permisos: ['ver_todo', 'ver_kpis', 'ver_conciliacion', 'resolver_incidencia'], no_permitido: ['editar_operacion'] },
      { id: 'finanzas', nombre: 'Finanzas', nivel: 'kargo', permisos: ['ver_todo', 'ver_finanzas'], no_permitido: ['editar_operacion'] },
    ],
  },
  invoices: { _comment: 'ON HOLD: monthly consolidated invoicing, calculation basis undefined. Kept empty on purpose.', invoices: [] },
};

// ---- scenario, run through the real rules with a simulated clock -----------------------------------------------------------
let clockMs = Date.now();
const clock = () => new Date(clockMs);
const at = (hoursAgo) => { clockMs = Date.now() - hoursAgo * 3600e3; };
const tick = (min) => { clockMs += min * 60e3; };
const S = createStore(db, () => {}, clock);
const u = (id) => S.userById(id);
const active = (o) => S.orderDetail(u('usr_c01'), o.id).paquetes.filter((p) => p.status !== 'no_recolectado').map((p) => p.piece_code);
const scanAll = (user, o) => active(o).forEach((c) => S.scan(u(user), o.id, { piece_code: c }));
const merch = (id) => db.merchants.merchants.find((m) => m.id === id);
const sig = (user, o, side, index = 0, extra = {}) => S.confirm(u(user), o.id, { persona_rut: o.personas_autorizadas[side][index].rut, id_verificado: true, firma: scribble(), ...extra });
const mk = (userId, mId, origen, destino, n, extra = {}) => {
  const m = merch(mId), pers = (id) => m.bodegas.find((b) => b.id === id).contactos.map(({ nombre, rut: r, telefono }) => ({ nombre, rut: r, telefono }));
  return S.createOrder(u(userId), { bodega_origen_id: origen, bodega_destino_id: destino, personas_autorizadas: { origen: pers(origen), destino: pers(destino) },
    paquetes: Array.from({ length: n }, (_, i) => ({ peso_kg: 3 + i, descripcion: ['Ropa', 'Calzado', 'Electrodomésticos', 'Textiles'][i % 4], valor_declarado_clp: 30000 + i * 5000 })), ...extra });
};
const toEnBodegaOperador = (o, op, mod, driver, vehicle) => {
  S.assign(u('usr_c01'), o.id, { operador_id: op.id, ultima_milla: mod }); tick(12);
  S.accept(u(op === OP_SUR ? 'usr_d05' : 'usr_d06'), o.id); tick(8);
  S.pickup(u(op === OP_SUR ? 'usr_d05' : 'usr_d06'), o.id, { conductor_id: driver, movil_patente: vehicle }); tick(35);
};
const busAssign = (o, clerk, busDriver, pickLast = false) => {
  const opts = S.serviceOptions(u(clerk), o.id), pick = pickLast ? opts[opts.length - 1] : opts[0];
  S.transport(u(clerk), o.id, { servicio_id: pick.servicio_id, salida: pick.salida, conductor_id: busDriver });
  return pick;
};

// 1  delivered, last mile by operator, count adjusted at pickup (+1 box) and the incident resolved by Audit
at(36);
const o1 = mk('usr_042', 'mer_falabella', 'bod_scl_01', 'bod_con_04', 3, { referencia_cliente: 'OC-48270', mpo: 'MPO-770' }); tick(20);
toEnBodegaOperador(o1, OP_SUR, 'operador', 'usr_210', 'FG-JI-98');
S.adjustCount(u('usr_210'), o1.id, { add: 1, reason: 'El merchant entregó una caja extra que no estaba declarada', descripcion: 'Ropa', peso_kg: 4 });
scanAll('usr_210', o1); sig('usr_210', o1, 'origen'); tick(60);
scanAll('usr_305', o1); S.confirm(u('usr_305'), o1.id, {}); tick(25);
busAssign(o1, 'usr_305', 'usr_301'); tick(45);
scanAll('usr_301', o1); S.confirm(u('usr_301'), o1.id, {}); tick(6 * 60);
scanAll('usr_305', o1); S.confirm(u('usr_305'), o1.id, {}); tick(30);
S.assignLastMile(u('usr_d05'), o1.id, { conductor_id: 'usr_401', movil_patente: 'JK-LM-01' }); tick(50);
scanAll('usr_401', o1); sig('usr_401', o1, 'destino', 1);
S.resolveIncident(u('usr_a01'), S.incidents(u('usr_a01')).find((i) => i.order_id === o1.id).id, { nota: 'Merchant confirma la caja adicional. Se corrige el conteo declarado.' });

// 2  delivered, last mile = recipient pickup (Ripley)
at(30);
const o2 = mk('usr_043', 'mer_ripley', 'bod_rip_02', 'bod_rip_01', 2, { referencia_cliente: 'PO-9932', mpo: 'MPO-802' }); tick(15);
toEnBodegaOperador(o2, OP_SUR, 'retiro', 'usr_211', 'HK-LM-45');
scanAll('usr_211', o2); sig('usr_211', o2, 'origen'); tick(50);
scanAll('usr_305', o2); S.confirm(u('usr_305'), o2.id, {}); tick(20);
busAssign(o2, 'usr_305', 'usr_302'); tick(50);
scanAll('usr_302', o2); S.confirm(u('usr_302'), o2.id, {}); tick(7 * 60);
scanAll('usr_305', o2); S.confirm(u('usr_305'), o2.id, {}); tick(20);
S.markPickupReady(u('usr_305'), o2.id); tick(90);
scanAll('usr_305', o2); sig('usr_305', o2, 'destino');

// 3  loaded on the bus, waiting for the destination hub inbound scan
at(22);
const o3 = mk('usr_042', 'mer_falabella', 'bod_scl_01', 'bod_tem_03', 2, { referencia_cliente: 'OC-48281', mpo: 'MPO-771' }); tick(10);
toEnBodegaOperador(o3, OP_SUR, 'operador', 'usr_210', 'FG-JI-98');
scanAll('usr_210', o3); sig('usr_210', o3, 'origen'); tick(45);
scanAll('usr_305', o3); S.confirm(u('usr_305'), o3.id, {}); tick(20);
busAssign(o3, 'usr_305', 'usr_301'); tick(40);
scanAll('usr_301', o3); S.confirm(u('usr_301'), o3.id, {});

// 4  bus assigned with a departure beyond the 2h window (risk) and never loaded -> shows in Control Tower
at(12);
const o4 = mk('usr_042', 'mer_falabella', 'bod_con_04', 'bod_scl_01', 2, { referencia_cliente: 'OC-48285' }); tick(10);
toEnBodegaOperador(o4, OP_SUR, 'operador', 'usr_211', 'HK-LM-45');
scanAll('usr_211', o4); sig('usr_211', o4, 'origen'); tick(40);
scanAll('usr_305', o4); S.confirm(u('usr_305'), o4.id, {}); tick(15);
busAssign(o4, 'usr_305', 'usr_302', true);

// 5  at destination hub, recipient pickup modality, waiting for "ready for pickup" (Ripley)
at(26);
const o5 = mk('usr_043', 'mer_ripley', 'bod_rip_01', 'bod_rip_02', 3, { referencia_cliente: 'PO-9940' }); tick(10);
toEnBodegaOperador(o5, OP_SUR, 'retiro', 'usr_210', 'FG-JI-98');
scanAll('usr_210', o5); sig('usr_210', o5, 'origen'); tick(45);
scanAll('usr_305', o5); S.confirm(u('usr_305'), o5.id, {}); tick(20);
busAssign(o5, 'usr_305', 'usr_301'); tick(40);
scanAll('usr_301', o5); S.confirm(u('usr_301'), o5.id, {}); tick(8 * 60);
scanAll('usr_305', o5); S.confirm(u('usr_305'), o5.id, {});

// 6  at the operator hub waiting for bus assignment, with an open damage incident
at(8);
const o6 = mk('usr_042', 'mer_falabella', 'bod_con_04', 'bod_scl_01', 3, { referencia_cliente: 'OC-48280' }); tick(10);
toEnBodegaOperador(o6, OP_SUR, 'operador', 'usr_211', 'HK-LM-45');
scanAll('usr_211', o6); sig('usr_211', o6, 'origen'); tick(40);
scanAll('usr_305', o6); S.confirm(u('usr_305'), o6.id, {}); tick(5);
S.reportIncident(u('usr_305'), o6.id, { tipo: 'dano', detalle: 'Una caja llegó con el embalaje dañado; se registra al ingresar a bodega.' });

// 7  pickup assigned (the pickup driver can adjust the box count here)
at(6);
const o7 = mk('usr_042', 'mer_falabella', 'bod_scl_01', 'bod_tem_03', 4, { referencia_cliente: 'OC-48292', mpo: 'MPO-771' }); tick(10);
toEnBodegaOperador(o7, OP_SUR, 'operador', 'usr_210', 'FG-JI-98');

// 8  assigned to Sur, waiting for the dispatcher to accept
at(4);
const o8 = mk('usr_042', 'mer_falabella', 'bod_scl_01', 'bod_con_04', 2, { referencia_cliente: 'OC-48291' }); tick(10);
S.assign(u('usr_c01'), o8.id, { operador_id: OP_SUR.id, ultima_milla: 'operador' });

// 9  assigned to Andes, waiting for the dispatcher to accept
at(3.5);
const o9 = mk('usr_042', 'mer_falabella', 'bod_scl_02', 'bod_tem_03', 2, { referencia_cliente: 'OC-48295' }); tick(10);
S.assign(u('usr_c01'), o9.id, { operador_id: OP_ANDES.id, ultima_milla: 'operador' });

// 10 just created, waiting for the coordinator
at(1);
mk('usr_042', 'mer_falabella', 'bod_scl_01', 'bod_tem_03', 3, { referencia_cliente: 'OC-48290', mpo: 'MPO-771' });

// ---- write ----------------------------------------------------------------------------------------------------------------------
fs.mkdirSync(dir, { recursive: true });
const fileOf = Object.fromEntries(Object.entries(FILES).map(([n, [f]]) => [n, f]));
Object.keys(db).forEach((n) => fs.writeFileSync(path.join(dir, fileOf[n]), JSON.stringify(db[n], null, 2) + '\n'));
console.log(`Seeded ${db.orders.orders.length} orders, ${db.packages.packages.length} packages, ${db.events.events.length} events, ${db.incidents.incidents.length} incidents into web/data/`);
