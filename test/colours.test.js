import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convert } from '@asamuzakjp/css-color';
import { JSDOM } from 'jsdom';
import { colourWheel, neighbour, taskStyles } from '../public/colours.js';

test('the wheel has a unique honeycomb layout with a neutral centre and full-spectrum edge', () => {
  const cells = colourWheel();
  assert.equal(cells.length, 127);
  assert.equal(new Set(cells.map(cell => `${cell.q},${cell.r}`)).size, 127);
  for (const [q, r, colour] of [[0, 0, '#ffffff'], [6, 0, '#ff0000'], [0, 6, '#ffff00'], [0, -6, '#0000ff']]) {
    assert.equal(cells.find(cell => cell.q === q && cell.r === r).colour, colour);
  }
  assert.ok(cells.every(cell => /^#[0-9a-f]{6}$/.test(cell.colour) && cell.x > 0 && cell.x < 250 && cell.y > 0 && cell.y < 222));
});

test('arrow keys move between neighbouring sections and stop at the wheel edge', () => {
  const cells = colourWheel();
  const centre = cells.findIndex(cell => cell.q === 0 && cell.r === 0);
  const right = neighbour(cells, centre, 'ArrowRight');
  assert.deepEqual([cells[right].q, cells[right].r], [1, 0]);
  assert.equal(neighbour(cells, right, 'ArrowLeft'), centre);
  const edge = cells.findIndex(cell => cell.q === 6 && cell.r === 0);
  assert.equal(neighbour(cells, edge, 'ArrowRight'), edge);
  assert.equal(neighbour(cells, edge, 'Home'), centre);
});

test('task CSS excludes malformed ids and colours instead of interpolating them', () => {
  assert.equal(taskStyles({ 'x"]{}': '#ff0000', t_release: 'red', t_other: '#12345678' }), '');
  const css = taskStyles({ t_release: '#ff0000', adhoc: '#0000ff' });
  assert.ok(css.includes('.task-cell[data-taskid="t_release"]'));
  assert.ok(css.includes('.switcher-pill[data-taskid="t_release"]'));
  assert.ok(css.includes('.task-cell.no-task'));
  assert.ok(css.includes('var(--tile-bg)'));
  assert.ok(css.includes('var(--pill-idle-bg)'));
});

test('generated task, card and pill colours preserve opaque, translucent and zero default alpha', () => {
  const expressions = [...taskStyles({ t_release: '#ff0000' }).matchAll(/background-color:([^}]+)/g)].map(match => match[1]);
  for (const alpha of [0, 0.42, 0.46, 0.5, 0.6, 0.7, 1]) {
    const customProperty = { '--tile-bg': `rgba(21, 27, 35, ${alpha})`, '--pill-idle-bg': `rgba(40, 20, 62, ${alpha})`, '--surface': `rgba(21, 27, 35, ${alpha})`, '--surface-2': `rgba(40, 20, 62, ${alpha})`, '--blue': `rgba(60, 70, 80, ${alpha})` };
    for (const expression of expressions) assert.equal(convert.colorToRgb(expression, { customProperty })[3], alpha);
  }
});

test('the same saved hue blends with the current theme RGB when theme variables change', () => {
  const expression = taskStyles({ t_release: '#ff0000' }).match(/background-color:([^}]+)/)[1];
  for (const [source, expected] of [
    ['rgba(20,30,40,0.5)', [62.3, 24.6, 32.8, 0.5]],
    ['#f3f4f6', [245.16, 200.08, 201.72, 1]],
  ]) {
    const actual = convert.colorToRgb(expression, { customProperty: { '--tile-bg': source } });
    for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(actual[channel] - expected[channel]) < 0.003);
    assert.equal(actual[3], expected[3]);
  }
});

test('opacity favours the theme around the centre while retaining the full endpoint range', () => {
  for (const [alpha, adjustment, expected] of [[0.5, -25, 0.46875], [0.5, 25, 0.53125], [0.5, -50, 0.375], [0.8, -50, 0.6], [0.5, 50, 0.625], [0.8, 50, 0.85], [0, -50, 0], [0, 50, 0.25], [1, -50, 0.75], [1, 50, 1], [0.42, -100, 0], [0.42, 100, 1]]) {
    const expressions = [...taskStyles({ t_release: '#ff0000' }, 'adhoc', { t_release: adjustment }).matchAll(/background-color:([^}]+)/g)].map(match => match[1]);
    for (const expression of expressions) {
      const result = convert.colorToRgb(expression, { customProperty: { '--tile-bg': `rgba(20,30,40,${alpha})`, '--pill-idle-bg': `rgba(60,70,80,${alpha})`, '--surface': `rgba(20,30,40,${alpha})`, '--surface-2': `rgba(60,70,80,${alpha})`, '--blue': `rgba(80,90,100,${alpha})` } });
      assert.ok(Math.abs(result[3] - expected) < 0.00051, `${alpha} with ${adjustment}: ${result[3]} instead of ${expected}`);
    }
  }
});

test('opacity can change independently while retaining theme RGB', () => {
  const css = taskStyles({}, 'adhoc', { t_release: -50 });
  const expression = css.match(/background-color:([^}]+)/)?.[1];
  assert.ok(expression);
  const result = convert.colorToRgb(expression, { customProperty: { '--tile-bg': 'rgba(20,30,40,0.8)' } });
  for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(result[channel] - [20, 30, 40][channel]) < 0.003);
  assert.equal(result[3], 0.6);
});

test('invalid opacity-only input cannot reach the stylesheet', () => {
  for (const adjustment of [101, -101, NaN, Infinity, '0);color:red']) assert.equal(taskStyles({}, 'adhoc', { t_release: adjustment }), '');
});

test('task tint reaches its own cards and child rows while leaving other tasks alone', t => {
  const dom = new JSDOM('<div id="grid"><div class="task-cell" data-taskid="t_release"><div class="session-card"><span class="card-bar"></span><div class="subagent-row"></div></div><div class="worker-row"></div><div class="snoozed-row"></div></div><div class="task-cell" data-taskid="t_other"><div class="session-card" id="other"></div></div><div class="task-cell no-task"><div class="session-card" id="unassigned"></div></div></div><div class="session-card" id="outside"></div>');
  t.after(() => dom.window.close());
  const sheet = dom.window.document.createElement('style');
  sheet.textContent = taskStyles({ t_release: '#ff0000', adhoc: '#0000ff' });
  dom.window.document.head.append(sheet);
  const rules = [...sheet.sheet.cssRules];
  const backgrounds = element => rules.filter(rule => element.matches(rule.selectorText)).map(rule => rule.style.getPropertyValue('background-color')).filter(Boolean);
  for (const element of dom.window.document.querySelectorAll('[data-taskid="t_release"] .session-card, [data-taskid="t_release"] .worker-row, [data-taskid="t_release"] .subagent-row, [data-taskid="t_release"] .snoozed-row, #unassigned')) assert.ok(backgrounds(element).length, element.className);
  for (const element of dom.window.document.querySelectorAll('#other, #outside, .card-bar')) assert.equal(backgrounds(element).length, 0, element.className);
});

test('card bodies keep the task hue when selected while hover uses the theme hover surface', t => {
  const dom = new JSDOM('<style></style><div id="grid"><div class="task-cell" data-taskid="t_release"><div class="session-card"></div></div></div>');
  t.after(() => dom.window.close());
  const sheet = dom.window.document.querySelector('style');
  sheet.textContent = taskStyles({ t_release: '#ff0000' });
  const rules = [...sheet.sheet.cssRules];
  const card = dom.window.document.querySelector('.session-card');
  const fills = () => rules.filter(rule => card.matches(rule.selectorText) && rule.style.getPropertyValue('background-color'));
  const normal = fills().at(-1);
  card.classList.add('selected');
  const selected = fills().at(-1);
  const hover = rules.find(rule => rule.selectorText.includes('.session-card') && rule.selectorText.endsWith(':hover'));
  const customProperty = { '--surface': 'rgba(20,30,40,0.5)', '--surface-2': 'rgba(60,70,80,0.8)', '--blue': '#0064c8', '--selected-tint': '20%' };
  for (const [state, rule, expected] of [
    ['normal', normal, [62.3, 24.6, 32.8, 0.5]],
    ['hover', hover, [95.1, 57.4, 65.6, 0.8]],
    ['selected', selected, [62.3, 24.6, 32.8, 0.5]],
  ]) {
    assert.ok(rule, `missing ${state || 'normal'} card fill`);
    const actual = convert.colorToRgb(rule.style.getPropertyValue('background-color'), { customProperty });
    for (let channel = 0; channel < 4; channel++) assert.ok(Math.abs(actual[channel] - expected[channel]) < 0.01, `${state} channel ${channel}: ${actual[channel]}`);
  }
});

test('tinted cards and rows get a task-coloured border; untinted opacity-only tasks keep theme borders', () => {
  const css = taskStyles({ t_release: '#ff0000' }, 'adhoc', { t_other: 40 });
  assert.match(css, /\.task-cell\[data-taskid="t_release"\] :is\(\.session-card,\.worker-row,\.subagent-row,\.snoozed-row\)\{border-color:color-mix\(in srgb, #ff0000 30%, var\(--border-muted\)\)\}/);
  assert.doesNotMatch(css, /t_other"\] :is\([^)]*\)\{border-color/);
});

test('session tint is off by default and tints the session header, terminal, chat and diff backgrounds for the selected card of a coloured task', () => {
  assert.doesNotMatch(taskStyles({ t_release: '#ff0000' }), /chat-stream-wrap/);
  assert.doesNotMatch(taskStyles({}, 'adhoc', { t_release: 20 }, { session: 10 }), /chat-stream-wrap/);
  const css = taskStyles({ t_release: '#ff0000' }, 'adhoc', {}, { session: 12 });
  const selected = 'body:has(#grid .task-cell[data-taskid="t_release"] :is(.session-card,.worker-row,.subagent-row).selected)';
  for (const [pane, source] of [['#panel', 'var(--tile-bg)'], ['#term', 'var(--term-bg)'], ['.chat-stream-wrap', 'var(--term-bg)'], ['.chat-composer', 'var(--tile-bg)'], ['.diff-panel', 'var(--term-bg)']]) {
    const rule = css.split('\n').find(line => line.startsWith(`${selected} ${pane}{`));
    assert.ok(rule, pane);
    assert.ok(rule.includes(`rgb(from ${source} `) && rule.includes('255 * 0.12') && rule.endsWith('/ alpha)}'), rule);
  }
  assert.doesNotMatch(css, /::after/);
});

test('card tinting can be switched off while tiles and pills keep their tint', () => {
  const css = taskStyles({ t_release: '#ff0000' }, 'adhoc', {}, { cards: false });
  assert.doesNotMatch(css, /session-card/);
  assert.match(css, /task-cell\[data-taskid="t_release"\]:not\(\.drop-target\)/);
  assert.match(css, /switcher-pill/);
  assert.match(taskStyles({ t_release: '#ff0000' }), /session-card/);
});
