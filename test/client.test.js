import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import client from '../public/client.js';

function fixture(t, colours = {}) {
  const dom = new JSDOM('<div id="grid"><div class="task-cell" data-taskid="t_release"><div class="task-head"><button class="task-actions-btn">Actions</button></div><div class="task-body-ext"><div id="host"></div></div></div><button class="switcher-pill" data-taskid="t_other">Other</button></div>', { pretendToBeVisual: true });
  const previous = globalThis.document;
  globalThis.document = dom.window.document;
  t.after(() => { globalThis.document = previous; dom.window.close(); });
  const contributions = new Map();
  const frames = [];
  let onMessage;
  const api = { send: frame => frames.push(frame), onMessage: fn => { onMessage = fn; } };
  client.register({ api, register: (slot, value) => contributions.set(slot, value) });
  const document = dom.window.document;
  const body = contributions.get('task.body');
  const host = document.getElementById('host');
  const ctx = { taskId: 't_release', adhocId: 'adhoc', container: host.parentElement };
  const graph = { hues: { colours } };
  body.mount(host, api, ctx);
  body.update(host, ctx, graph);
  const open = (currentGraph = graph) => contributions.get('task.action').items({ id: 't_release', name: 'Release', adhoc: false }, currentGraph, api)[0].run();
  return { document, window: dom.window, body, host, ctx, graph, frames, open, message: frame => onMessage(frame) };
}

test('Colour… opens a hexagonal wheel and Escape dismisses it without saving', t => {
  const f = fixture(t);
  f.open();
  const dialog = f.document.querySelector('.hues-picker');
  assert.ok(dialog?.hasAttribute('open'));
  assert.equal(dialog.querySelectorAll('.hues-swatch').length, 127);
  dialog.dispatchEvent(new f.window.Event('cancel', { cancelable: true }));
  assert.equal(f.document.querySelector('.hues-picker'), null);
  assert.deepEqual(f.frames, []);
});

test('selecting a section sends its colour and only its own successful acknowledgement closes the picker', t => {
  const f = fixture(t);
  f.open();
  f.document.querySelector('[data-colour="#ff0000"]').click();
  assert.equal(f.frames.length, 1);
  assert.equal(f.frames[0].type, 'hues-set');
  assert.equal(f.frames[0].taskId, 't_release');
  assert.equal(f.frames[0].colour, '#ff0000');
  f.message({ kind: 'saved', requestId: 'some-other-edit', ok: true });
  assert.ok(f.document.querySelector('.hues-picker'));
  f.body.update(f.host, f.ctx, { hues: { colours: { t_release: '#ff0000' } } });
  f.message({ kind: 'saved', requestId: f.frames[0].requestId, taskId: 't_release', colour: '#ff0000', ok: true });
  assert.equal(f.document.querySelector('.hues-picker'), null);
  assert.ok(f.document.querySelector('style[data-hues]').textContent.includes('t_release'));
});

test('Reset sends an explicit reset and a failed save keeps the picker and last confirmed colour', t => {
  const f = fixture(t, { t_release: '#ff0000' });
  f.open();
  assert.equal(f.document.querySelector('[data-colour="#ff0000"]').getAttribute('aria-pressed'), 'true');
  f.document.querySelector('.hues-reset').click();
  assert.equal(f.frames[0].colour, null);
  f.message({ kind: 'saved', requestId: f.frames[0].requestId, ok: false, error: 'Disk full' });
  assert.ok(f.document.querySelector('.hues-picker'));
  assert.equal(f.document.querySelector('[role="alert"]').textContent, 'Disk full');
  assert.equal(f.document.querySelector('[data-colour="#ff0000"]').getAttribute('aria-pressed'), 'true');
  assert.equal(f.document.querySelector('.hues-reset').disabled, false);
});

test('arrow keys move the single tab stop without saving; Enter commits the focused section', t => {
  const f = fixture(t);
  f.open();
  const initial = f.document.querySelector('.hues-swatch[tabindex="0"]');
  initial.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  const next = f.document.activeElement;
  assert.ok(next.matches('.hues-swatch'));
  assert.notEqual(next, initial);
  assert.equal(f.document.querySelectorAll('.hues-swatch[tabindex="0"]').length, 1);
  assert.equal(f.frames.length, 0);
  next.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  assert.equal(f.frames.length, 1);
});

test('a board rerender retains the picker and styling, while removing the final host cleans up', async t => {
  const f = fixture(t, { t_other: '#0000ff' });
  f.open();
  f.body.unmount(f.host);
  const next = f.document.createElement('div');
  f.document.querySelector('.task-body-ext').append(next);
  f.host.remove();
  f.body.mount(next, {}, f.ctx);
  f.body.update(next, f.ctx, f.graph);
  await Promise.resolve();
  assert.ok(f.document.querySelector('.hues-picker'));
  assert.equal(f.document.querySelectorAll('style[data-hues]').length, 1);
  assert.ok(f.document.querySelector('style[data-hues]').textContent.includes('t_other'));
  f.body.unmount(next);
  next.remove();
  await Promise.resolve();
  assert.equal(f.document.querySelector('.hues-picker'), null);
  assert.equal(f.document.querySelector('style[data-hues]'), null);
});

test('closing the picker returns focus to the current task button after a header rerender', t => {
  const f = fixture(t);
  f.open();
  const original = f.document.querySelector('.task-actions-btn');
  const replacement = original.cloneNode(true);
  original.replaceWith(replacement);
  f.document.querySelector('.hues-close').click();
  assert.equal(f.document.activeElement, replacement);
});

test('a delayed acknowledgement cannot overwrite a newer authoritative task colour', t => {
  const f = fixture(t);
  f.open();
  f.document.querySelector('[data-colour="#ff0000"]').click();
  const latest = { hues: { colours: { t_release: '#0000ff' } } };
  f.body.update(f.host, f.ctx, latest);
  const authoritativeStyles = f.document.querySelector('style[data-hues]').textContent;
  f.message({ kind: 'saved', requestId: f.frames[0].requestId, colour: '#ff0000', ok: true });
  assert.equal(f.document.querySelector('style[data-hues]').textContent, authoritativeStyles);
  f.open(latest);
  assert.equal(f.document.querySelector('[data-colour="#0000ff"]').getAttribute('aria-pressed'), 'true');
});

test('removing the edited task closes its picker while keeping other task tints', async t => {
  const f = fixture(t, { t_other: '#0000ff' });
  const other = f.document.createElement('div');
  f.document.getElementById('grid').append(other);
  f.body.mount(other, {}, { taskId: 't_other', adhocId: 'adhoc', container: other });
  f.open();
  f.body.unmount(f.host);
  f.document.querySelector('.task-cell').remove();
  await Promise.resolve();
  assert.equal(f.document.querySelector('.hues-picker'), null);
  assert.ok(f.document.querySelector('style[data-hues]').textContent.includes('t_other'));
});
