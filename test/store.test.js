import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { HuesStore, dataFile } from '../store.js';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hues-store-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'hues.json');
  return { dir, file, store: new HuesStore(file) };
}

test('task colours persist across store instances and snapshots cannot mutate them', t => {
  const { file, store } = fixture(t);
  store.set('t_release', '#AABBCC');
  const snapshot = store.snapshot();
  snapshot.colours.t_release = '#000000';
  assert.deepEqual(new HuesStore(file).snapshot(), { colours: { t_release: '#aabbcc' }, opacityAdjustments: {} });
  assert.deepEqual(store.snapshot(), { colours: { t_release: '#aabbcc' }, opacityAdjustments: {} });
});

test('editing another task preserves existing colours', t => {
  const { store } = fixture(t);
  store.set('t_release', '#ff0000');
  store.set('t_research', '#0000ff');
  assert.deepEqual(store.snapshot().colours, { t_release: '#ff0000', t_research: '#0000ff' });
});

test('Reset removes only the selected task and deletion removes its saved colour', t => {
  const { file, store } = fixture(t);
  store.set('t_release', '#ff0000');
  store.set('t_research', '#0000ff');
  store.set('t_release', null);
  assert.deepEqual(new HuesStore(file).snapshot().colours, { t_research: '#0000ff' });
  store.deleteTask('t_research');
  assert.deepEqual(new HuesStore(file).snapshot().colours, {});
});

test('invalid task ids and non-RGB colour values leave state and disk unchanged', t => {
  const { file, store } = fixture(t);
  store.set('t_release', '#112233');
  const saved = fs.readFileSync(file, 'utf8');
  for (const id of ['', '../task', 'x"]{}', null, 42]) assert.throws(() => store.set(id, '#ff0000'));
  for (const colour of ['red', '#abc', '#12345678', 'url(example.com)', undefined, 42]) assert.throws(() => store.set('t_release', colour));
  assert.equal(fs.readFileSync(file, 'utf8'), saved);
  assert.deepEqual(store.snapshot().colours, { t_release: '#112233' });
});

test('a failed disk write leaves the last confirmed in-memory colour intact', t => {
  const { dir, file, store } = fixture(t);
  store.set('t_release', '#112233');
  fs.unlinkSync(file);
  fs.rmdirSync(dir);
  fs.writeFileSync(dir, 'not a directory');
  assert.throws(() => store.set('t_release', '#ff0000'));
  assert.deepEqual(store.snapshot().colours, { t_release: '#112233' });
});

test('invalid persisted data is reported without overwriting the file', t => {
  const { file } = fixture(t);
  fs.writeFileSync(file, '{broken');
  assert.throws(() => new HuesStore(file));
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
});

test('data paths respect isolated installations and home expansion', () => {
  assert.equal(dataFile('/tmp/hues-installation'), '/tmp/hues-installation/hues.json');
  assert.equal(dataFile('~/example'), path.join(os.homedir(), 'example', 'hues.json'));
  assert.equal(dataFile('~'), path.join(os.homedir(), 'hues.json'));
});

test('existing colour-only state loads without changing theme transparency', t => {
  const { file } = fixture(t);
  fs.writeFileSync(file, JSON.stringify({ version: 1, colours: { t_release: '#aabbcc' } }));
  const store = new HuesStore(file);
  assert.deepEqual(store.snapshot(), { colours: { t_release: '#aabbcc' }, opacityAdjustments: {} });
  store.setOpacity('t_release', -50);
  assert.deepEqual(new HuesStore(file).snapshot(), { colours: { t_release: '#aabbcc' }, opacityAdjustments: { t_release: -50 } });
});

test('colour and opacity edits preserve each other and other tasks', t => {
  const { file, store } = fixture(t);
  store.set('t_release', '#ff0000');
  store.setOpacity('t_release', -50);
  store.setOpacity('t_research', 40);
  store.set('t_release', '#0000ff');
  assert.deepEqual(new HuesStore(file).snapshot(), { colours: { t_release: '#0000ff' }, opacityAdjustments: { t_release: -50, t_research: 40 } });
  store.setOpacity('t_release', 0);
  assert.deepEqual(store.snapshot().colours, { t_release: '#0000ff' });
  assert.deepEqual(store.snapshot().opacityAdjustments, { t_research: 40 });
});

test('Reset and deletion remove both hue and opacity, including opacity-only tasks', t => {
  const { store } = fixture(t);
  store.set('t_release', '#ff0000');
  store.setOpacity('t_release', -50);
  store.setOpacity('t_research', 40);
  store.set('t_release', null);
  assert.deepEqual(store.snapshot(), { colours: {}, opacityAdjustments: { t_research: 40 } });
  store.deleteTask('t_research');
  assert.deepEqual(store.snapshot(), { colours: {}, opacityAdjustments: {} });
});

test('invalid opacity adjustments leave confirmed state and disk unchanged', t => {
  const { file, store } = fixture(t);
  store.setOpacity('t_release', -50);
  const saved = fs.readFileSync(file, 'utf8');
  for (const adjustment of [-101, 101, 0.5, '50', null, undefined, NaN, Infinity]) assert.throws(() => store.setOpacity('t_release', adjustment));
  assert.equal(fs.readFileSync(file, 'utf8'), saved);
  assert.deepEqual(store.snapshot().opacityAdjustments, { t_release: -50 });
});

test('a failed opacity write preserves the last confirmed adjustment', t => {
  const { dir, file, store } = fixture(t);
  store.setOpacity('t_release', -50);
  fs.unlinkSync(file);
  fs.rmdirSync(dir);
  fs.writeFileSync(dir, 'not a directory');
  assert.throws(() => store.setOpacity('t_release', 50));
  assert.deepEqual(store.snapshot().opacityAdjustments, { t_release: -50 });
});

test('pruning removes opacity-only deleted tasks and preserves existing ones', t => {
  const { store } = fixture(t);
  store.setOpacity('t_deleted', -50);
  store.setOpacity('t_archived', 25);
  store.prune(new Set(['t_archived']));
  assert.deepEqual(store.snapshot(), { colours: {}, opacityAdjustments: { t_archived: 25 } });
});
