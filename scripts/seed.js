// Regenerates web/data/*.json: base master data + a demo scenario run through the REAL domain rules (web/store.js),
// so the seeded orders are consistent by construction. Usage: npm run seed
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, rutDV, rutFormat, FILES } from '../web/store.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'data');
const rut = (body) => rutFormat(body + rutDV(String(body)));
const persona = (nombre, body, tel, cargo = '') => ({ nombre, rut: rut(body), telefono: tel, cargo });
const dir_ = (region, ciudad, comuna, direccion) => ({ region, ciudad, comuna, direccion });

const scribble = (color = '#1a2420') => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120"><path d="M20 80 C50 10 70 110 100 50 S150 20 170 70 220 90 280 30" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/></svg>`);

const db = {
  merchants: {
    _comment: 'B2B merchant account. bodegas feeds the origin dropdown (filtered by ciudad). contactos = default authorized persons (min 2), validated visually by crews against the RUT. Billing is monthly consolidated and ON HOLD.',
    merchants: [{
      id: 'mer_falabella', razon_social: 'Falabella Retail S.A.', rut: '90.749.000-1', plan: 'pro',
      facturacion: { modalidad: 'mensual_consolidada', dia_cierre: 1, referencia_default: null },
      bodegas: [
        { id: 'bod_scl_01', nombre: 'CD Pudahuel', ciudad: 'Santiago', es_origen_default: true, direccion: dir_('Metropolitana', 'Santiago', 'Quilicura', 'Av. Presidente Eduardo Frei Montalva 8301'),
          contactos: [persona('Juan Pérez', 12345678, '+56912345678', 'Jefe de bodega'), persona('Ana Rojas', 13876543, '+56911223344', 'Asistente de bodega')] },
        { id: 'bod_scl_02', nombre: 'CD Lo Aguirre', ciudad: 'Santiago', es_origen_default: false, direccion: dir_('Metropolitana', 'Santiago', 'Pudahuel', 'Ruta 68 km 12'),
          contactos: [persona('Luis Toro', 11222333, '+56922334455', 'Encargado'), persona('Marta Silva', 10998877, '+56933445566', 'Supervisora')] },
        { id: 'bod_tem_03', nombre: 'CD Temuco', ciudad: 'Temuco', es_origen_default: false, direccion: dir_('Araucanía', 'Temuco', 'Temuco', 'Manuel Montt 452'),
          contactos: [persona('María González', 14987654, '+56987654321', 'Encargada de recepción'), persona('Pedro Soto', 15234567, '+56988997766', 'Guardia de bodega')] },
        { id: 'bod_con_04', nombre: 'CD Concepción', ciudad: 'Concepción', es_origen_default: false, direccion: dir_('Biobío', 'Concepción', 'San Pedro de la Paz', 'Av. Los Carrera 1500'),
          contactos: [persona('Rosa Vega', 9876543, '+56944556677', 'Jefa de bodega'), persona('Iván Cortés', 16543210, '+56955667788', 'Asistente')] },
      ],
      created_at: '2025-01-10T09:00:00.000Z',
    }],
  },
  users: {
    _comment: 'DEMO users only (role switcher). No passwords: real auth belongs to the backend.',
    users: [
      { id: 'usr_042', nombre: 'Carla Mendoza (Falabella)', rol: 'merchant', merchant_id: 'mer_falabella' },
      { id: 'usr_c01', nombre: 'Andrés Fuentes', rol: 'coordinador_logistico' },
      { id: 'usr_d05', nombre: 'Patricia Lagos', rol: 'operador_despachador', operador_id: 'op_transportes_sur' },
      { id: 'usr_210', nombre: 'Héctor Ramos', rol: 'operador_conductor_recoleccion', operador_id: 'op_transportes_sur' },
      { id: 'usr_211', nombre: 'Sergio Muñoz', rol: 'operador_conductor_recoleccion', operador_id: 'op_transportes_sur' },
      { id: 'usr_305', nombre: 'Camila Reyes', rol: 'operador_encargado_bodega', operador_id: 'op_transportes_sur' },
      { id: 'usr_301', nombre: 'Jorge Pino', rol: 'operador_conductor_bus', operador_id: 'op_transportes_sur' },
      { id: 'usr_302', nombre: 'Daniel Araya', rol: 'operador_conductor_bus', operador_id: 'op_transportes_sur' },
      { id: 'usr_401', nombre: 'Felipe Lira', rol: 'operador_conductor_entrega', operador_id: 'op_transportes_sur' },
      { id: 'usr_d06', nombre: 'Marcela Núñez', rol: 'operador_despachador', operador_id: 'op_andes_cargo' },
      { id: 'usr_212', nombre: 'Tomás Vera', rol: 'operador_conductor_recoleccion', operador_id: 'op_andes_cargo' },
      { id: 'usr_306', nombre: 'Elena Campos', rol: 'operador_encargado_bodega', operador_id: 'op_andes_cargo' },
      { id: 'usr_303', nombre: 'Raúl Godoy', rol: 'operador_conductor_bus', operador_id: 'op_andes_cargo' },
      { id: 'usr_402', nombre: 'Nicolás Paz', rol: 'operador_conductor_entrega', operador_id: 'op_andes_cargo' },
    ],
  },
  operators: {
    operators: [
      { id: 'op_transportes_sur', nombre: 'Transportes Sur Ltda.',
        vehiculos: [{ patente: 'FG-JI-98', tipo: 'Camión 3/4' }, { patente: 'HK-LM-45', tipo: 'Furgón' }],
        servicios: [{ id: 'srv_sur_1', bus_patente: 'AB-CD-12', servicio: 'Interurbano Sur' }, { id: 'srv_sur_2', bus_patente: 'CD-EF-34', servicio: 'Expreso Araucanía' }] },
      { id: 'op_andes_cargo', nombre: 'Andes Cargo S.A.',
        vehiculos: [{ patente: 'RT-YU-11', tipo: 'Camión 3/4' }],
        servicios: [{ id: 'srv_andes_1', bus_patente: 'PL-OK-77', servicio: 'Andes Norte' }] },
    ],
  },
  roles: {
    _comment: 'Every physical hand-over needs scan + timestamp + user. Only pickup (origin) and delivery (destination) also need a signature of an authorized person.',
    roles: [
      { id: 'merchant', nombre: 'Merchant', nivel: 'cliente', permisos: ['crear_orden', 'ver_seguimiento', 'reportar_incidencia'], no_permitido: ['asignar_operador', 'escanear_bultos', 'editar_operacion'] },
      { id: 'coordinador_logistico', nombre: 'Coordinador Logístico', nivel: 'kargo', permisos: ['ver_ordenes_pendientes', 'asignar_operador_transporte'] },
      { id: 'operador_despachador', nombre: 'Despachador (Operador de Transporte)', nivel: 'operador', permisos: ['recibir_asignacion', 'designar_conductor_recoleccion', 'designar_movil_recoleccion'] },
      { id: 'operador_conductor_recoleccion', nombre: 'Conductor / Auxiliar de Recolección', nivel: 'operador', permisos: ['escanear_bulto_recoleccion', 'capturar_firma_entrega'] },
      { id: 'operador_encargado_bodega', nombre: 'Encargado Bodega Operador (WH1)', nivel: 'operador', permisos: ['escanear_bulto_ingreso_bodega', 'asignar_bus_servicio'] },
      { id: 'operador_conductor_bus', nombre: 'Conductor / Auxiliar de Bus', nivel: 'operador', permisos: ['escanear_bulto_carga_bus'] },
      { id: 'operador_conductor_entrega', nombre: 'Conductor / Auxiliar de Entrega', nivel: 'operador', permisos: ['escanear_bulto_entrega', 'capturar_firma_recepcion'] },
    ],
  },
  invoices: { _comment: 'ON HOLD: monthly consolidated invoicing, calculation basis undefined. Kept empty on purpose.', invoices: [] },
};

const fileOf = Object.fromEntries(Object.entries(FILES).map(([n, [f]]) => [n, f]));
const writeAll = (names = Object.keys(db)) => names.forEach((n) => fs.writeFileSync(path.join(dir, fileOf[n]), JSON.stringify(db[n], null, 2) + '\n'));
const S = createStore(db, () => {});
const u = (id) => S.userById(id);
const codes = (o) => S.orderDetail(u('usr_c01'), o.id).paquetes.map((p) => p.piece_code);
const scanAll = (user, o) => codes(o).forEach((c) => S.scan(user, o.id, { piece_code: c }));

const mk = (origen, destino, n, extra = {}) => {
  const m = db.merchants.merchants[0];
  const pers = (id) => m.bodegas.find((b) => b.id === id).contactos.map(({ nombre, rut, telefono }) => ({ nombre, rut, telefono }));
  return S.createOrder(u('usr_042'), {
    bodega_origen_id: origen, bodega_destino_id: destino, personas_autorizadas: { origen: pers(origen), destino: pers(destino) },
    paquetes: Array.from({ length: n }, (_, i) => ({ peso_kg: 3 + i, descripcion: ['Ropa', 'Calzado', 'Electrodomésticos', 'Textiles'][i % 4], valor_declarado_clp: 30000 + i * 5000 })), ...extra,
  });
};

// ot_00121 creada | 122 asignada | 123 recolección asignada | 124 en bodega operador | 125 asignada a otro operador
mk('bod_scl_01', 'bod_tem_03', 3, { referencia_cliente: 'OC-48290' });
const o2 = mk('bod_scl_01', 'bod_con_04', 2, { referencia_cliente: 'OC-48291' });
S.assign(u('usr_c01'), o2.id, { operador_id: 'op_transportes_sur' });
const o3 = mk('bod_scl_01', 'bod_tem_03', 4, { referencia_cliente: 'OC-48292' });
S.assign(u('usr_c01'), o3.id, { operador_id: 'op_transportes_sur' });
S.pickup(u('usr_d05'), o3.id, { conductor_id: 'usr_210', movil_patente: 'FG-JI-98' });
const o4 = mk('bod_con_04', 'bod_scl_01', 3, { referencia_cliente: 'OC-48280' });
S.assign(u('usr_c01'), o4.id, { operador_id: 'op_transportes_sur' });
S.pickup(u('usr_d05'), o4.id, { conductor_id: 'usr_211', movil_patente: 'HK-LM-45' });
scanAll(u('usr_211'), o4);
S.confirm(u('usr_211'), o4.id, { persona_rut: db.merchants.merchants[0].bodegas[3].contactos[0].rut, id_verificado: true, firma: scribble() });
scanAll(u('usr_305'), o4);
S.confirm(u('usr_305'), o4.id, {});
const o5 = mk('bod_scl_02', 'bod_tem_03', 2, { referencia_cliente: 'OC-48295' });
S.assign(u('usr_c01'), o5.id, { operador_id: 'op_andes_cargo' });

writeAll();
console.log(`Seeded ${db.orders.orders.length} orders, ${db.packages.packages.length} packages, ${db.events.events.length} events into web/data/`);
