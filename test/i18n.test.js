import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DICT, setLang, tErr, tNote } from '../web/i18n.js';
import { CP } from '../web/store.js';

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const src = fs.readFileSync(path.join(web, 'app.js'), 'utf8') + fs.readFileSync(path.join(web, 'index.html'), 'utf8');

test('ES and EN have exactly the same keys', () => {
  assert.deepEqual(Object.keys(DICT.es).sort(), Object.keys(DICT.en).sort());
});

test('every static t(key) / data-i18n key used by the UI exists', () => {
  const used = new Set([...src.matchAll(/\bt\('([\w.]+)'\s*[,)]/g)].map((m) => m[1]));
  [...src.matchAll(/data-i18n(?:-aria)?="([\w.]+)"/g)].forEach((m) => used.add(m[1]));
  [...src.matchAll(/'((?:assign|pickup|transport|scan|confirm|nb)\.ok|scan\.allOk|scan\.manualOk|nb\.saved|w\.created)'/g)].forEach((m) => used.add(m[1]));
  const missing = [...used].filter((k) => !(k in DICT.es));
  assert.deepEqual(missing, []);
});

test('dynamic key families are complete', () => {
  const steps = ['creada', 'asignada_operador', 'recoleccion_asignada', 'recolectada', 'en_bodega_operador', 'asignada_transporte', 'cargada_bus', 'entregada'];
  const roles = ['merchant', 'coordinador_logistico', 'operador_despachador', 'operador_conductor_recoleccion', 'operador_encargado_bodega', 'operador_conductor_bus', 'operador_conductor_entrega'];
  const cps = Object.values(CP).map((c) => c.cp);
  const keys = [
    ...steps.flatMap((s) => ['st.', 'act.'].map((p) => p + s)), ...roles.flatMap((r) => ['role.', 'guide.'].map((p) => p + r)),
    ...cps.flatMap((c) => ['cp.' + c, 'ev.bulto_escaneado_' + c, 'ev.traspaso_' + c]), ...[0, 1, 2, 3, 4].map((i) => 'ms.' + i),
    'ev.orden_creada', 'ev.orden_asignada_operador', 'ev.recoleccion_asignada', 'ev.asignada_transporte', 'w.s1', 'w.s2', 'w.s3',
  ];
  assert.deepEqual(keys.filter((k) => !(k in DICT.es)), []);
});

test('every domain error the store can throw has an English translation', () => {
  const storeSrc = fs.readFileSync(path.join(web, 'store.js'), 'utf8');
  const msgs = [...storeSrc.matchAll(/\b(?:bad|forbidden|notFound|conflict)\((['`])((?:(?!\1).)*)\1/g)].map((m) => m[2]);
  assert.ok(msgs.length > 25);
  setLang('en');
  const untranslated = msgs.map((m) => m.replace(/\$\{[^}]+\}/g, '7')).filter((m) => tErr(m) === m);
  setLang('es');
  assert.deepEqual(untranslated, []);
});

test('event notes translate', () => {
  setLang('en');
  assert.equal(tNote('Asignada a Transportes Sur Ltda.'), 'Assigned to Transportes Sur Ltda.');
  assert.equal(tNote('REGISTRO MANUAL: sin señal'), 'MANUAL ENTRY: sin señal');
  setLang('es');
});
