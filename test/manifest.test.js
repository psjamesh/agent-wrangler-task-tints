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
const saveOpacity = (msg, host) => manifest.handlers.find(h => h.type === 'hues-opacity-set').handler(msg, host);

test('install-time and runtime manifests disclose the same extension', () => {
  const { wranglerExtension: declared } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
  for (const key of ['id', 'label', 'description', 'author', 'requires', 'engines']) assert.deepEqual(manifest[key], declared[key]);
});

test('a live task colour is persisted, rebuilt and acknowledged to the originating request', async t => {
  const { host, frames, rebuilds } = fixture(t);
  await save({ requestId: 'request-1', taskId: 't_release', colour: '#00AAFF' }, host);
  assert.deepEqual(manifest.graph({ host }), { hues: { colours: { t_release: '#00aaff' }, opacityAdjustments: {} } });
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
  assert.deepEqual(manifest.graph({ host }), { hues: { colours: {}, opacityAdjustments: {} } });
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

test('opacity controls persist independently, rebuild the graph and acknowledge the request', async t => {
  const { host, frames, rebuilds } = fixture(t);
  await save({ requestId: 'colour', taskId: 't_release', colour: '#ff0000' }, host);
  await saveOpacity({ requestId: 'opacity', taskId: 't_release', adjustment: -50 }, host);
  await saveOpacity({ requestId: 'adhoc-opacity', taskId: 'adhoc', adjustment: 25 }, host);
  assert.deepEqual(manifest.graph({ host }).hues, { colours: { t_release: '#ff0000' }, opacityAdjustments: { t_release: -50, adhoc: 25 } });
  assert.equal(rebuilds(), 3);
  assert.deepEqual(frames.at(-1), { kind: 'saved', requestId: 'adhoc-opacity', taskId: 'adhoc', adjustment: 25, ok: true });
  await save({ requestId: 'reset', taskId: 't_release', colour: null }, host);
  assert.deepEqual(manifest.graph({ host }).hues, { colours: {}, opacityAdjustments: { adhoc: 25 } });
});

test('opacity controls reject unknown tasks and invalid values without rebuilding', async t => {
  const { host, frames, rebuilds } = fixture(t);
  for (const taskId of ['unknown', 't_archived']) await saveOpacity({ requestId: taskId, taskId, adjustment: -50 }, host);
  await saveOpacity({ requestId: 'invalid', taskId: 't_release', adjustment: 101 }, host);
  assert.equal(frames.length, 3);
  assert.ok(frames.every(frame => frame.ok === false));
  assert.equal(rebuilds(), 0);
  assert.deepEqual(host.stores.hues.snapshot(), { colours: {}, opacityAdjustments: {} });
});

test('card and session-view tinting are toggle settings', () => {
  assert.deepEqual(manifest.settings.map(({ key, type }) => ({ key, type })), [{ key: 'tintCards', type: 'toggle' }, { key: 'tintSession', type: 'toggle' }]);
});
