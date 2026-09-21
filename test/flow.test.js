import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, rutValid, FILES } from '../web/store.js';

const data = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'data');
const fresh = () => {
  const db = {};
  for (const [n, [f]] of Object.entries(FILES)) db[n] = JSON.parse(fs.readFileSync(path.join(data, f), 'utf8'));
  return createStore(db);
};
const fails = (fn, re) => assert.throws(fn, (e) => re.test(e.message));
const SIG = 'data:image/svg+xml;utf8,<svg/>';

test('RUT validation', () => {
  assert.ok(rutValid('12.345.678-5'));
  assert.ok(!rutValid('12.345.678-9'));
});

test('full chain of custody, merchant to delivered', () => {
  const S = fresh();
  const U = (id) => S.userById(id);
  const m = S.list('merchants')[0];
  const [origen, destino] = [m.bodegas[0], m.bodegas[2]];
  const pers = (b) => b.contactos.map(({ nombre, rut, telefono }) => ({ nombre, rut, telefono }));
  const body = { bodega_origen_id: origen.id, bodega_destino_id: destino.id, personas_autorizadas: { origen: pers(origen), destino: pers(destino) },
    paquetes: [{ peso_kg: 2, descripcion: 'Ropa' }, { peso_kg: 5, descripcion: 'Calzado', valor_declarado_clp: 10000 }] };

  // merchant validations
  fails(() => S.createOrder(U('usr_c01'), body), /no puede/);
  fails(() => S.createOrder(U('usr_042'), { ...body, paquetes: [] }), /al menos un bulto/);
  fails(() => S.createOrder(U('usr_042'), { ...body, personas_autorizadas: { ...body.personas_autorizadas, destino: [body.personas_autorizadas.destino[0]] } }), /al menos 2/);
  fails(() => S.createOrder(U('usr_042'), { ...body, bodega_destino_id: origen.id }), /misma bodega/);

  const o = S.createOrder(U('usr_042'), body);
  assert.equal(o.status, 'creada');
  assert.equal(o.estado_merchant, 'Creada');

  // roles cannot skip steps or act out of turn
  fails(() => S.pickup(U('usr_d05'), o.id, { conductor_id: 'usr_210', movil_patente: 'FG-JI-98' }), /no encuentra|no encontrada|Orden no/);
  S.assign(U('usr_c01'), o.id, { operador_id: 'op_transportes_sur' });
  fails(() => S.assign(U('usr_c01'), o.id, { operador_id: 'op_transportes_sur' }), /ya fue asignada/);
  fails(() => S.pickup(U('usr_d06'), o.id, { conductor_id: 'usr_212', movil_patente: 'RT-YU-11' }), /Orden no encontrada/); // other operator can't see it
  fails(() => S.pickup(U('usr_d05'), o.id, { conductor_id: 'usr_210', movil_patente: 'ZZ-ZZ-99' }), /Móvil inválido/);
  S.pickup(U('usr_d05'), o.id, { conductor_id: 'usr_210', movil_patente: 'FG-JI-98' });

  // pickup: assigned driver only, every package scanned, then signature + ID check
  const codes = S.orderDetail(U('usr_c01'), o.id).paquetes.map((p) => p.piece_code);
  fails(() => S.scan(U('usr_211'), o.id, { piece_code: codes[0] }), /otro conductor/);
  fails(() => S.scan(U('usr_210'), o.id, { piece_code: 'KARGO-99999-001' }), /no pertenece/);
  S.scan(U('usr_210'), o.id, { piece_code: codes[0] });
  fails(() => S.scan(U('usr_210'), o.id, { piece_code: codes[0] }), /ya escaneado/);
  fails(() => S.confirm(U('usr_210'), o.id, {}), /Faltan 1 de 2/);
  fails(() => S.scan(U('usr_210'), o.id, { piece_code: codes[1], manual: true }), /motivo/);
  S.scan(U('usr_210'), o.id, { piece_code: codes[1], manual: true, reason: 'Etiqueta dañada' });
  const rut = origen.contactos[0].rut;
  fails(() => S.confirm(U('usr_210'), o.id, { persona_rut: rut, firma: SIG }), /cédula/);
  fails(() => S.confirm(U('usr_210'), o.id, { persona_rut: '11.111.111-1', id_verificado: true, firma: SIG }), /personas autorizadas/);
  fails(() => S.confirm(U('usr_210'), o.id, { persona_rut: rut, id_verificado: true }), /Firma inválida/);
  assert.equal(S.confirm(U('usr_210'), o.id, { persona_rut: rut, id_verificado: true, firma: SIG }).status, 'recolectada');

  // operator warehouse: scan, then assign bus
  codes.forEach((c) => S.scan(U('usr_305'), o.id, { piece_code: c }));
  assert.equal(S.confirm(U('usr_305'), o.id, {}).status, 'en_bodega_operador');
  fails(() => S.transport(U('usr_305'), o.id, { servicio_id: 'srv_andes_1', conductor_id: 'usr_301' }), /Servicio inválido/);
  S.transport(U('usr_305'), o.id, { servicio_id: 'srv_sur_1', conductor_id: 'usr_301' });

  // bus: only the assigned driver
  fails(() => S.scan(U('usr_302'), o.id, { piece_code: codes[0] }), /otro conductor/);
  codes.forEach((c) => S.scan(U('usr_301'), o.id, { piece_code: c }));
  assert.equal(S.confirm(U('usr_301'), o.id, {}).status, 'cargada_bus');

  // delivery: scan + destination authorized person + signature
  codes.forEach((c) => S.scan(U('usr_401'), o.id, { piece_code: c }));
  const done = S.confirm(U('usr_401'), o.id, { persona_rut: destino.contactos[1].rut, id_verificado: true, firma: SIG });
  assert.equal(done.status, 'entregada');
  assert.equal(done.estado_merchant, 'Entregada');
  assert.ok(done.handoff.entrega.firma_url && done.handoff.recepcion.firma_url);

  // audit trail: every step attributed and ordered
  assert.deepEqual(done.timeline.map((t) => t.step), ['creada', 'asignada_operador', 'recoleccion_asignada', 'recolectada', 'en_bodega_operador', 'asignada_transporte', 'cargada_bus', 'entregada']);
  assert.ok(done.timeline.every((t) => t.actor_id && t.at));
  assert.ok(S.events(U('usr_042'), o.id).some((e) => /REGISTRO MANUAL/.test(e.note)));
});

test('merchant only sees its own orders; nextActor points to the right person', () => {
  const S = fresh();
  assert.equal(S.listOrders(S.userById('usr_042')).length, 5);
  assert.equal(S.listOrders(S.userById('usr_d06')).length, 1); // Andes operator sees only its order
  const o = S.listOrders(S.userById('usr_c01')).find((x) => x.status === 'recoleccion_asignada');
  assert.equal(S.nextActor(o).id, 'usr_210');
});
