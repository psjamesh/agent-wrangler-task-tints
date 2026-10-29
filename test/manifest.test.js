import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import manifest from '../index.js';
import { HuesStore } from '../store.js';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hues-handler-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const frames = [];
  let rebuilds = 0;
  const host = {
    stores: { hues: new HuesStore(path.join(dir, 'hues.json')) },
    tasks: { adhocId: 'adhoc', list: () => [{ taskId: 't_release', name: 'Release', archived: false }, { taskId: 't_archived', name: 'Old', archived: true }] },
    broadcast: frame => frames.push(frame),
    rebuild: async () => { rebuilds++; },
  };
  return { host, frames, rebuilds: () => rebuilds };
}

const save = (msg, host) => manifest.handlers.find(h => h.type === 'hues-set').handler(msg, host);

test('install-time and runtime manifests disclose the same extension', () => {
  const { wranglerExtension: declared } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
  for (const key of ['id', 'label', 'description', 'author', 'requires', 'engines']) assert.deepEqual(manifest[key], declared[key]);
});

test('a live task colour is persisted, rebuilt and acknowledged to the originating request', async t => {
  const { host, frames, rebuilds } = fixture(t);
  await save({ requestId: 'request-1', taskId: 't_release', colour: '#00AAFF' }, host);
  assert.deepEqual(manifest.graph({ host }), { hues: { colours: { t_release: '#00aaff' } } });
  assert.equal(rebuilds(), 1);
  assert.deepEqual(frames, [{ kind: 'saved', requestId: 'request-1', taskId: 't_release', colour: '#00aaff', ok: true }]);
});

test('unknown and archived tasks cannot be edited', async t => {
  const { host, frames, rebuilds } = fixture(t);
  for (const taskId of ['unknown', 't_archived']) await save({ requestId: taskId, taskId, colour: '#ff0000' }, host);
  assert.equal(frames.length, 2);
  assert.ok(frames.every(frame => frame.ok === false && typeof frame.error === 'string'));
  assert.equal(rebuilds(), 0);
  assert.deepEqual(host.stores.hues.snapshot().colours, {});
});

test('Unassigned can be coloured and Reset removes its colour', async t => {
  const { host, frames } = fixture(t);
  await save({ requestId: 'one', taskId: 'adhoc', colour: '#ff0000' }, host);
  await save({ requestId: 'two', taskId: 'adhoc', colour: null }, host);
  assert.deepEqual(manifest.graph({ host }), { hues: { colours: {} } });
  assert.equal(frames.at(-1).ok, true);
});

test('deleting a task removes its colour without affecting other tasks', t => {
  const { host } = fixture(t);
  host.stores.hues.set('t_release', '#ff0000');
  host.stores.hues.set('adhoc', '#0000ff');
  manifest.onTaskDelete({ taskId: 't_release', host });
  assert.deepEqual(host.stores.hues.snapshot().colours, { adhoc: '#0000ff' });
});

test('graph reconciliation drops tasks deleted while disabled and preserves archived colours', t => {
  const { host } = fixture(t);
  host.stores.hues.set('t_deleted', '#ff0000');
  host.stores.hues.set('t_archived', '#0000ff');
  host.stores.hues.set('adhoc', '#00ff00');
  assert.deepEqual(manifest.graph({ host }).hues.colours, { t_archived: '#0000ff', adhoc: '#00ff00' });
});

test('failed cleanup cannot prevent board graph generation or lose confirmed colours', t => {
  const { host } = fixture(t);
  const store = host.stores.hues;
  store.set('t_deleted', '#ff0000');
  store.set('t_release', '#0000ff');
  fs.unlinkSync(store.file);
  const directory = path.dirname(store.file);
  fs.rmdirSync(directory);
  fs.writeFileSync(directory, 'not a directory');
  assert.deepEqual(manifest.graph({ host }).hues.colours, { t_deleted: '#ff0000', t_release: '#0000ff' });
  assert.deepEqual(store.snapshot().colours, { t_deleted: '#ff0000', t_release: '#0000ff' });
});
