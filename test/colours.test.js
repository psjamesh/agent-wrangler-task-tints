import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convert } from '@asamuzakjp/css-color';
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
  assert.equal((css.match(/\/ alpha\)/g) ?? []).length, 4);
});

test('generated tile and pill colours preserve opaque, translucent and zero theme alpha', () => {
  const expressions = [...taskStyles({ t_release: '#ff0000' }).matchAll(/background-color:([^}]+)/g)].map(match => match[1]);
  for (const alpha of [0, 0.42, 0.46, 0.5, 0.6, 0.7, 1]) {
    const customProperty = { '--tile-bg': `rgba(21, 27, 35, ${alpha})`, '--pill-idle-bg': `rgba(40, 20, 62, ${alpha})` };
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
