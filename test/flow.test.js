import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, rutValid, flowFor, FILES } from '../web/store.js';

const data = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'data');
// fresh store from the seeded JSON; `clock` is a mutable local date so time rules are deterministic
function fresh(start = new Date(2026, 8, 21, 10, 0)) {
  const db = {};
  for (const [n, [f]] of Object.entries(FILES)) db[n] = JSON.parse(fs.readFileSync(path.join(data, f), 'utf8'));
  const c = { d: new Date(start) };
  const S = createStore(db, () => {}, () => new Date(c.d));
  return { S, c, tick: (min) => { c.d = new Date(c.d.getTime() + min * 60e3); } };
}
const fails = (fn, re) => assert.throws(fn, (e) => re.test(e.message));
const SIG = 'data:image/svg+xml;utf8,<svg/>';

// creates a Falabella order SCL -> dest with n packages
function newOrder(S, destId = 'bod_tem_03', n = 2, extra = {}) {
  const m = S.list('merchants')[0], o = m.bodegas[0], d = m.bodegas.find((b) => b.id === destId);
  const pers = (b) => b.contactos.map(({ nombre, rut, telefono }) => ({ nombre, rut, telefono }));
  return S.createOrder(S.userById('usr_042'), { bodega_origen_id: o.id, bodega_destino_id: d.id, personas_autorizadas: { origen: pers(o), destino: pers(d) },
    paquetes: Array.from({ length: n }, (_, i) => ({ peso_kg: 2 + i, descripcion: 'Ropa', valor_declarado_clp: 10000 })), ...extra });
}
const codes = (S, id) => S.orderDetail(S.userById('usr_c01'), id).paquetes.filter((p) => p.status !== 'no_recolectado').map((p) => p.piece_code);
// scans every active package not yet scanned at the order's current checkpoint
const scanAll = (S, user, id) => {
  const o = S.orderDetail(S.userById('usr_c01'), id);
  o.paquetes.filter((p) => p.status !== 'no_recolectado' && !p.scan_history.some((s) => s.checkpoint === o.checkpoint_actual)).forEach((p) => S.scan(S.userById(user), id, { piece_code: p.piece_code }));
};

test('RUT validation', () => {
  assert.ok(rutValid('12.345.678-5'));
  assert.ok(!rutValid('12.345.678-9'));
});

test('merchant order validations', () => {
  const { S } = fresh(), m = S.list('merchants')[0], [origen, destino] = [m.bodegas[0], m.bodegas[2]];
  const pers = (b) => b.contactos.map(({ nombre, rut, telefono }) => ({ nombre, rut, telefono }));
  const body = { bodega_origen_id: origen.id, bodega_destino_id: destino.id, personas_autorizadas: { origen: pers(origen), destino: pers(destino) }, paquetes: [{ peso_kg: 2, descripcion: 'Ropa' }] };
  fails(() => S.createOrder(S.userById('usr_c01'), body), /no puede/);
  fails(() => S.createOrder(S.userById('usr_042'), { ...body, paquetes: [] }), /al menos un bulto/);
  fails(() => S.createOrder(S.userById('usr_042'), { ...body, personas_autorizadas: { ...body.personas_autorizadas, destino: [body.personas_autorizadas.destino[0]] } }), /al menos 2/);
  fails(() => S.createOrder(S.userById('usr_042'), { ...body, bodega_destino_id: origen.id }), /misma bodega/);
  fails(() => S.createOrder(S.userById('usr_042'), { ...body, bodega_destino_id: 'bod_rip_01' }), /registradas de tu cuenta/); // another merchant's warehouse
});

test('full chain, last mile by the operator: accept, count adjustment, bus window, hubs, signatures', () => {
  const { S, tick } = fresh(), U = (id) => S.userById(id);
  const o = newOrder(S, 'bod_tem_03', 3, { mpo: 'MPO-1' });
  assert.equal(o.status, 'creada'); assert.equal(o.bultos_declarados, 3);

  // coordinator assigns with modality; dispatcher must ACCEPT before designating the pickup
  fails(() => S.assign(U('usr_c01'), o.id, { operador_id: 'op_transportes_sur', ultima_milla: 'tercero' }), /Modalidad/);
  S.assign(U('usr_c01'), o.id, { operador_id: 'op_transportes_sur', ultima_milla: 'operador' });
  fails(() => S.pickup(U('usr_d05'), o.id, { conductor_id: 'usr_210', movil_patente: 'FG-JI-98' }), /pendiente de asignar recolección/);
  fails(() => S.accept(U('usr_d06'), o.id), /Orden no encontrada/); // other operator cannot see it
  tick(10); S.accept(U('usr_d05'), o.id);
  fails(() => S.accept(U('usr_d05'), o.id), /pendiente de aceptación/);
  fails(() => S.pickup(U('usr_d05'), o.id, { conductor_id: 'usr_210', movil_patente: 'ZZ-ZZ-99' }), /Móvil inválido/);
  S.pickup(U('usr_d05'), o.id, { conductor_id: 'usr_210', movil_patente: 'FG-JI-98' });

  // pickup: assigned driver only; count can be adjusted (reason required) and leaves an open incident; signature mandatory
  const c0 = codes(S, o.id);
  fails(() => S.scan(U('usr_211'), o.id, { piece_code: c0[0] }), /otro conductor/);
  fails(() => S.adjustCount(U('usr_211'), o.id, { add: 1, reason: 'x' }), /otro conductor/);
  fails(() => S.adjustCount(U('usr_210'), o.id, { add: 1 }), /motivo del ajuste/);
  fails(() => S.adjustCount(U('usr_210'), o.id, {}), /No hay cambios/);
  fails(() => S.adjustCount(U('usr_305'), o.id, { add: 1, reason: 'x' }), /no puede/);
  S.scan(U('usr_210'), o.id, { piece_code: c0[0] });
  fails(() => S.adjustCount(U('usr_210'), o.id, { remove: [c0[0]], reason: 'x' }), /ya fue escaneado/);
  const adj = S.adjustCount(U('usr_210'), o.id, { add: 2, remove: [c0[2]], reason: 'El merchant sumó 2 cajas y 1 no estaba lista', peso_kg: 3 });
  assert.equal(adj.activos, 4); assert.equal(adj.conteo.declarados, 3); assert.equal(adj.conteo.diferencia, 1);
  assert.ok(adj.paquetes.filter((p) => p.agregado_en_recoleccion).length === 2);
  assert.equal(adj.paquetes.find((p) => p.piece_code === c0[2]).status, 'no_recolectado');
  const inc = S.incidents(U('usr_c01')).find((i) => i.order_id === o.id);
  assert.equal(inc.tipo, 'conteo'); assert.equal(inc.estado, 'abierta'); assert.equal(inc.real, 4);
  scanAll(S, 'usr_210', o.id); // only the 4 active packages
  const rut = o.personas_autorizadas.origen[0].rut;
  fails(() => S.confirm(U('usr_210'), o.id, { persona_rut: rut, firma: SIG }), /cédula/);
  fails(() => S.confirm(U('usr_210'), o.id, { persona_rut: '11.111.111-1', id_verificado: true, firma: SIG }), /personas autorizadas/);
  fails(() => S.confirm(U('usr_210'), o.id, { persona_rut: rut, id_verificado: true }), /Firma inválida/);
  assert.equal(S.confirm(U('usr_210'), o.id, { persona_rut: rut, id_verificado: true, firma: SIG }).status, 'recolectada');
  assert.equal(S.orderDetail(U('usr_042'), o.id).conteo.recolectados, 4);

  // origin hub, then bus: suggestion from the operator timetable, 2h window
  tick(60); scanAll(S, 'usr_305', o.id); assert.equal(S.confirm(U('usr_305'), o.id, {}).status, 'en_bodega_operador');
  const opts = S.serviceOptions(U('usr_305'), o.id);
  assert.ok(opts.length >= 2 && opts.every((x, i) => i === 0 || x.salida_at >= opts[i - 1].salida_at)); assert.equal(opts[0].sugerido, true);
  fails(() => S.transport(U('usr_305'), o.id, { servicio_id: 'srv_andes_1', salida: '08:30', conductor_id: 'usr_301' }), /Servicio inválido/);
  fails(() => S.transport(U('usr_305'), o.id, { servicio_id: 'srv_sur_3', salida: '06:30', conductor_id: 'usr_301' }), /no cubre la ruta/);
  fails(() => S.transport(U('usr_305'), o.id, { servicio_id: opts[0].servicio_id, salida: '03:33', conductor_id: 'usr_301' }), /Salida inválida/);
  const t = S.transport(U('usr_305'), o.id, { servicio_id: opts[0].servicio_id, salida: opts[0].salida, conductor_id: 'usr_301' });
  assert.equal(t.operacion.transporte.riesgo_sla, !opts[0].en_ventana);

  // bus: only the assigned driver; loaded inside the window
  fails(() => S.scan(U('usr_302'), o.id, { piece_code: codes(S, o.id)[0] }), /otro conductor/);
  tick(30); scanAll(S, 'usr_301', o.id);
  assert.equal(S.confirm(U('usr_301'), o.id, {}).status, 'cargada_bus');
  assert.equal(S.orderDetail(U('usr_c01'), o.id).operacion.transporte.ventana_ok, true);

  // destination hub inbound scan (no bus unload scan), then last mile by the operator
  fails(() => S.markPickupReady(U('usr_305'), o.id), /aún no está en la bodega de destino/);
  tick(500); scanAll(S, 'usr_305', o.id); assert.equal(S.confirm(U('usr_305'), o.id, {}).status, 'en_bodega_destino');
  fails(() => S.markPickupReady(U('usr_305'), o.id), /última milla con operador/);
  fails(() => S.assignLastMile(U('usr_d05'), o.id, { conductor_id: 'usr_210', movil_patente: 'JK-LM-01' }), /Conductor de entrega inválido/);
  S.assignLastMile(U('usr_d05'), o.id, { conductor_id: 'usr_401', movil_patente: 'JK-LM-01' });
  fails(() => S.scan(U('usr_305'), o.id, { piece_code: codes(S, o.id)[0] }), /no puede/); // clerk cannot deliver in operator modality
  scanAll(S, 'usr_401', o.id);
  const done = S.confirm(U('usr_401'), o.id, { persona_rut: o.personas_autorizadas.destino[1].rut, id_verificado: true, firma: SIG });
  assert.equal(done.status, 'entregada'); assert.equal(done.estado_merchant, 'Entregada');
  assert.ok(done.handoff.entrega.firma_url && done.handoff.recepcion.firma_url);
  assert.deepEqual(done.timeline.map((x) => x.step), flowFor('operador'));
  assert.ok(done.timeline.every((x) => x.actor_id && x.at));
});

test('last mile = recipient pickup: clerk marks ready, authorized person signs at the pickup point', () => {
  const { S, tick } = fresh(), U = (id) => S.userById(id);
  const o = newOrder(S, 'bod_tem_03', 2);
  S.assign(U('usr_c01'), o.id, { operador_id: 'op_transportes_sur', ultima_milla: 'retiro' }); S.accept(U('usr_d05'), o.id);
  S.pickup(U('usr_d05'), o.id, { conductor_id: 'usr_211', movil_patente: 'HK-LM-45' });
  scanAll(S, 'usr_211', o.id); S.confirm(U('usr_211'), o.id, { persona_rut: o.personas_autorizadas.origen[0].rut, id_verificado: true, firma: SIG });
  scanAll(S, 'usr_305', o.id); S.confirm(U('usr_305'), o.id, {});
  const opt = S.serviceOptions(U('usr_305'), o.id)[0]; S.transport(U('usr_305'), o.id, { servicio_id: opt.servicio_id, salida: opt.salida, conductor_id: 'usr_302' });
  tick(20); scanAll(S, 'usr_302', o.id); S.confirm(U('usr_302'), o.id, {});
  scanAll(S, 'usr_305', o.id); S.confirm(U('usr_305'), o.id, {});
  fails(() => S.assignLastMile(U('usr_d05'), o.id, { conductor_id: 'usr_401', movil_patente: 'JK-LM-01' }), /retiro del destinatario/);
  const r = S.markPickupReady(U('usr_305'), o.id);
  assert.equal(r.status, 'lista_retiro'); assert.match(r.operacion.ultima_milla.punto_retiro, /Temuco/);
  assert.equal(r.estado_merchant, 'En tránsito');
  scanAll(S, 'usr_305', o.id);
  fails(() => S.confirm(U('usr_305'), o.id, { persona_rut: o.personas_autorizadas.destino[0].rut, id_verificado: true }), /Firma inválida/);
  assert.equal(S.confirm(U('usr_305'), o.id, { persona_rut: o.personas_autorizadas.destino[0].rut, id_verificado: true, firma: SIG }).status, 'entregada');
  assert.deepEqual(S.orderDetail(U('usr_c01'), o.id).timeline.map((x) => x.step), flowFor('retiro'));
});

test('dispatcher can reject with a reason; the order returns to the coordinator', () => {
  const { S } = fresh(), U = (id) => S.userById(id);
  const o = newOrder(S);
  S.assign(U('usr_c01'), o.id, { operador_id: 'op_andes_cargo' });
  fails(() => S.reject(U('usr_d06'), o.id, {}), /motivo del rechazo/);
  const r = S.reject(U('usr_d06'), o.id, { reason: 'Sin flota disponible hoy' });
  assert.equal(r.status, 'creada'); assert.equal(r.operacion.operador_id, null); assert.equal(r.operacion.aceptacion.rechazos.length, 1);
  fails(() => S.accept(U('usr_d06'), o.id), /Orden no encontrada/);
  S.assign(U('usr_c01'), o.id, { operador_id: 'op_transportes_sur' }); // coordinator re-assigns
  assert.equal(S.orderDetail(U('usr_c01'), o.id).status, 'asignada_operador');
});

test('bus window: a departure more than 2h after assignment is flagged as SLA risk', () => {
  const { S } = fresh(new Date(2026, 8, 21, 9, 0)), U = (id) => S.userById(id);
  const o = newOrder(S);
  S.assign(U('usr_c01'), o.id, { operador_id: 'op_transportes_sur' }); S.accept(U('usr_d05'), o.id);
  S.pickup(U('usr_d05'), o.id, { conductor_id: 'usr_210', movil_patente: 'FG-JI-98' });
  scanAll(S, 'usr_210', o.id); S.confirm(U('usr_210'), o.id, { persona_rut: o.personas_autorizadas.origen[0].rut, id_verificado: true, firma: SIG });
  scanAll(S, 'usr_305', o.id); S.confirm(U('usr_305'), o.id, {});
  const opts = S.serviceOptions(U('usr_305'), o.id); // 09:00 -> departures 10:00 (in window), 13:00, 19:30, 22:00, ...
  assert.deepEqual(opts.map((x) => [x.salida, x.en_ventana]).slice(0, 3), [['10:00', true], ['13:00', false], ['19:30', false]]);
  const late = S.transport(U('usr_305'), o.id, { servicio_id: 'srv_sur_1', salida: '19:30', conductor_id: 'usr_301' });
  assert.equal(late.operacion.transporte.riesgo_sla, true);
  assert.ok(S.events(U('usr_c01'), o.id).some((e) => e.type === 'riesgo_ventana_bus'));
  assert.ok(S.kpis(U('usr_c01')).riesgos.some((r) => r.id === o.id));
});

test('incidents: crew reports, only coordinator/audit resolve', () => {
  const { S } = fresh(), U = (id) => S.userById(id);
  const o = S.listOrders(U('usr_c01')).find((x) => x.status === 'en_bodega_operador');
  fails(() => S.reportIncident(U('usr_305'), o.id, { tipo: 'robo', detalle: 'x' }), /Tipo de incidencia/);
  fails(() => S.reportIncident(U('usr_305'), o.id, { tipo: 'dano', detalle: ' ' }), /Describe/);
  fails(() => S.reportIncident(U('usr_305'), o.id, { tipo: 'dano', detalle: 'x', foto: 'data:text/plain;base64,AAAA' }), /Foto inválida/);
  const inc = S.reportIncident(U('usr_305'), o.id, { tipo: 'faltante', detalle: 'Falta una caja' });
  fails(() => S.resolveIncident(U('usr_305'), inc.id, { nota: 'ok' }), /no puede/);
  fails(() => S.resolveIncident(U('usr_a01'), inc.id, {}), /nota de resolución/);
  assert.equal(S.resolveIncident(U('usr_a01'), inc.id, { nota: 'Encontrada en otro pallet' }).estado, 'resuelta');
  fails(() => S.resolveIncident(U('usr_c01'), inc.id, { nota: 'otra' }), /ya está resuelta/);
});

test('onboarding: KAM registers merchants and adds warehouses; operators are imported from Konnect', () => {
  const { S } = fresh(), U = (id) => S.userById(id);
  fails(() => S.registerMerchant(U('usr_042'), { razon_social: 'X', rut: '76.123.456-K', contacto_nombre: 'Y' }), /no puede/);
  fails(() => S.registerMerchant(U('usr_c01'), { razon_social: 'Viña Demo SpA', rut: '11.111.111-2', contacto_nombre: 'Ana' }), /RUT de empresa inválido/);
  fails(() => S.registerMerchant(U('usr_c01'), { razon_social: 'Otra', rut: S.list('merchants')[0].rut, contacto_nombre: 'Ana' }), /Ya existe/);
  const { merchant, user } = S.registerMerchant(U('usr_c01'), { razon_social: 'Viña Demo SpA', rut: '76.543.210-3', contacto_nombre: 'Ana Silva', plan: 'pro' });
  assert.equal(user.rol, 'merchant'); assert.equal(merchant.bodegas.length, 0);
  const contactos = [{ nombre: 'Uno', rut: '12.345.678-5', telefono: '+56911111111' }, { nombre: 'Dos', rut: '13.876.543-1', telefono: '+56922222222' }];
  const b = S.addBodega(U('usr_c01'), { nombre: 'Bodega Curicó', ciudad: 'Curicó', direccion: { region: 'Maule', comuna: 'Curicó', direccion: 'Ruta 5 km 190' }, codigo_postal: '3340000', contactos }, merchant.id);
  assert.equal(b.direccion.codigo_postal, '3340000');
  fails(() => S.addBodega(U('usr_c01'), { nombre: 'X', ciudad: 'Y', direccion: { region: 'a', comuna: 'b', direccion: 'c' }, codigo_postal: '12', contactos }, merchant.id), /código postal/);
  fails(() => S.addBodega(U('usr_c01'), { nombre: 'X', ciudad: 'Y', direccion: { region: 'a', comuna: 'b', direccion: 'c' }, contactos }, 'mer_nope'), /Merchant inexistente/);

  const cat = S.konnectCatalog(U('usr_c01'));
  assert.ok(cat.find((k) => k.id === 'op_transportes_sur').importado); assert.ok(!cat.find((k) => k.id === 'op_pacifico_cargo').importado);
  fails(() => S.konnectCatalog(U('usr_042')), /no puede/);
  fails(() => S.importOperator(U('usr_c01'), 'op_transportes_sur'), /ya fue importado/);
  fails(() => S.importOperator(U('usr_c01'), 'op_nope'), /no existe en Konnect/);
  const op = S.importOperator(U('usr_c01'), 'op_pacifico_cargo');
  assert.equal(op.origen, 'konnect'); assert.ok(S.list('users').filter((x) => x.operador_id === op.id).length >= 5);
  assert.ok(S.bootstrap(U('usr_c01')).operators.some((x) => x.id === op.id));
});

test('roles: audit and finance are read-only across the network; merchants and operators are scoped', () => {
  const { S } = fresh(), U = (id) => S.userById(id);
  const all = S.listOrders(U('usr_c01')).length;
  assert.equal(S.listOrders(U('usr_a01')).length, all); assert.equal(S.listOrders(U('usr_f01')).length, all);
  assert.ok(S.listOrders(U('usr_042')).every((o) => o.merchant_id === 'mer_falabella'));
  assert.ok(S.listOrders(U('usr_d06')).every((o) => o.operacion.operador_id === 'op_andes_cargo'));
  const oid = S.listOrders(U('usr_c01'))[0].id;
  fails(() => S.assign(U('usr_f01'), oid, { operador_id: 'op_transportes_sur' }), /no puede/);
  fails(() => S.accept(U('usr_a01'), oid), /no puede/);
  fails(() => S.kpis(U('usr_f01')), /no puede/); fails(() => S.finance(U('usr_a01')), /no puede/); fails(() => S.reconciliation(U('usr_f01')), /no puede/);
});

test('KPIs, reconciliation and finance are computed from the seeded scenario', () => {
  const { S } = fresh(new Date()), U = (id) => S.userById(id);
  const k = S.kpis(U('usr_c01'));
  assert.equal(k.ordenes, 10);
  assert.ok(k.ssp.d >= 8 && k.ssp.n >= 5 && k.ssp.pct > 0);
  assert.equal(k.adherencia.d < k.adherencia.n, true); // one order was picked with +1 box
  assert.equal(k.inbound.pct, 100);
  assert.ok(k.nivel_servicio.d >= 2 && k.nivel_servicio.pct === 100);
  assert.ok(k.ventana_bus.d >= 4); assert.ok(k.riesgos.length >= 1); assert.ok(k.incidencias_abiertas >= 1);
  assert.ok(k.mpo.d >= 1);
  const rec = S.reconciliation(U('usr_a01'));
  assert.ok(rec.some((r) => r.dif_conteo === 1 && r.entregados === 4)); assert.ok(rec.some((r) => r.incidencias_abiertas > 0));
  const f = S.finance(U('usr_f01'), {});
  assert.equal(f.totales.ordenes, 10); assert.equal(f.por_merchant.length, 2);
  assert.equal(S.finance(U('usr_f01'), { merchant_id: 'mer_ripley' }).totales.ordenes, 2);
  assert.equal(S.finance(U('usr_f01'), { from: '2999-01-01' }).totales.ordenes, 0); // date filter
  assert.ok(S.finance(U('usr_f01'), {}).rows.every((r) => r.periodo.length === 7));
});

test('nextActor points to the right person for every state', () => {
  const { S } = fresh(), U = (id) => S.userById(id);
  const by = (st) => S.listOrders(U('usr_c01')).find((x) => x.status === st);
  assert.equal(S.nextActor(by('recoleccion_asignada')).id, 'usr_210');
  assert.equal(S.nextActor(by('creada')).rol, 'coordinador_logistico');
  assert.equal(S.nextActor(by('asignada_operador')).rol, 'operador_despachador');
  assert.equal(S.nextActor(by('en_bodega_operador')).rol, 'operador_encargado_bodega');
  assert.equal(S.nextActor(by('cargada_bus')).rol, 'operador_encargado_bodega'); // destination inbound
  assert.equal(S.nextActor(by('en_bodega_destino')).rol, 'operador_encargado_bodega'); // seeded order uses "retiro"
});
