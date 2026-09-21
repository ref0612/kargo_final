import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DICT, setLang, tErr, tNote } from '../web/i18n.js';
import { CP, flowFor } from '../web/store.js';

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const src = fs.readFileSync(path.join(web, 'app.js'), 'utf8') + fs.readFileSync(path.join(web, 'index.html'), 'utf8');

test('ES and EN have exactly the same keys', () => {
  assert.deepEqual(Object.keys(DICT.es).sort(), Object.keys(DICT.en).sort());
});

test('every static t(key) / data-i18n key used by the UI exists', () => {
  const used = new Set([...src.matchAll(/\bt\('([\w.]+)'\s*[,)]/g)].map((m) => m[1]));
  [...src.matchAll(/data-i18n(?:-aria)?="([\w.]+)"/g)].forEach((m) => used.add(m[1]));
  // success toasts are passed as plain strings to run(fn, 'key')
  [...src.matchAll(/, '((?:[a-z]+)\.(?:ok|sent|resolved|allOk|manualOk|saved))'\)/g)].forEach((m) => used.add(m[1]));
  // keys passed as data (table headers, nav items) are quoted strings shaped like a key
  [...src.matchAll(/'((?:col|rec|fin|kpi|nav|k)\.[\w.]+)'/g)].forEach((m) => used.add(m[1]));
  const missing = [...used].filter((k) => !(k in DICT.es));
  assert.deepEqual(missing, []);
});

test('dynamic key families are complete', () => {
  const statuses = [...new Set([...flowFor('operador'), ...flowFor('retiro')])];
  const roles = ['merchant', 'coordinador_logistico', 'auditor', 'finanzas', 'operador_despachador', 'operador_conductor_recoleccion', 'operador_encargado_bodega', 'operador_conductor_bus', 'operador_conductor_entrega'];
  const cps = [...new Set(Object.values(CP).map((c) => c.cp))];
  const keys = [
    ...statuses.flatMap((s) => ['st.', 'act.'].map((p) => p + s)), ...roles.flatMap((r) => ['role.', 'guide.'].map((p) => p + r)),
    ...cps.flatMap((c) => ['cp.' + c, 'ev.bulto_escaneado_' + c, 'ev.traspaso_' + c]), ...[0, 1, 2, 3, 4].map((i) => 'ms.' + i),
    ...['orden_creada', 'orden_asignada_operador', 'orden_aceptada', 'orden_rechazada', 'recoleccion_asignada', 'asignada_transporte', 'riesgo_ventana_bus', 'conteo_ajustado', 'ultima_milla_asignada',
      'lista_para_retiro', 'incidencia_reportada', 'incidencia_resuelta', 'merchant_registrado', 'operador_importado'].map((e) => 'ev.' + e),
    'lm.operador', 'lm.retiro', 'acc.pendiente', 'acc.aceptada', 'acc.rechazada', 'inc.abierta', 'inc.resuelta', 'inc.conteo', 'inc.dano', 'inc.faltante', 'inc.otro', 'risk.riesgo_salida', 'risk.ventana_vencida',
    'w.s1', 'w.s2', 'w.s3', 'rec.declared', 'rec.picked', 'rec.inbound', 'rec.loaded', 'rec.destin', 'rec.delivered', 'rec.diff', 'rec.inc', 'fin.name', 'fin.period', 'fin.value', 'fin.kg',
  ];
  assert.deepEqual(keys.filter((k) => !(k in DICT.es)), []);
});

test('every event type the store can write has a label', () => {
  const storeSrc = fs.readFileSync(path.join(web, 'store.js'), 'utf8');
  const types = [...storeSrc.matchAll(/event\([^,]+, [^,]+, '([a-z_]+)'/g)].map((m) => m[1]).filter((x) => !x.endsWith('_')); // prefixes are built per checkpoint
  assert.ok(types.length >= 10);
  assert.deepEqual(types.filter((t) => !('ev.' + t in DICT.es)), []);
});

test('every domain error the store can throw has an English translation', () => {
  const storeSrc = fs.readFileSync(path.join(web, 'store.js'), 'utf8');
  const msgs = [...storeSrc.matchAll(/\b(?:bad|forbidden|notFound|conflict)\((['`])((?:(?!\1).)*)\1/g)].map((m) => m[2]);
  msgs.push('Merchant inexistente', 'Solo un merchant puede hacer esto');
  assert.ok(msgs.length > 45);
  setLang('en');
  const untranslated = msgs.map((m) => m.replace(/\$\{[^}]+\}/g, '7')).filter((m) => tErr(m) === m);
  setLang('es');
  assert.deepEqual(untranslated, []);
});

test('event notes translate', () => {
  setLang('en');
  const notes = { 'Asignada a Transportes Sur Ltda.': 'Assigned to Transportes Sur Ltda.', 'REGISTRO MANUAL: sin señal': 'MANUAL ENTRY: sin señal', 'Orden aceptada': 'Order accepted',
    'Rechazada: sin flota': 'Rejected: sin flota', 'Conteo ajustado: 3 → 4 (caja extra)': 'Count adjusted: 3 → 4 (caja extra)', 'Punto de retiro: Terminal': 'Pickup point: Terminal',
    'Resuelta: ok': 'Resolved: ok', 'Salida 19:30 supera la ventana de 2 h': 'Departure 19:30 exceeds the 2 h window' };
  for (const [es, en] of Object.entries(notes)) assert.equal(tNote(es), en);
  setLang('es');
});
