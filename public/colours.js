function rgb(hue, saturation) {
  const channel = offset => {
    const phase = (offset + hue / 60) % 6;
    const value = 1 - saturation + saturation * (1 - Math.max(0, Math.min(phase, 4 - phase, 1)));
    return Math.round(value * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`;
}

export function colourWheel() {
  const cells = [];
  for (let r = -6; r <= 6; r++) {
    for (let q = -6; q <= 6; q++) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) > 6) continue;
      const dx = q + r / 2;
      const dy = Math.sqrt(3) * r / 2;
      const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const saturation = Math.min(1, Math.hypot(dx, dy) / 6);
      cells.push({ q, r, x: 125 + Math.sqrt(3) * 11 * dx, y: 111 + 16.5 * r, colour: rgb(hue, saturation), label: saturation === 0 ? 'White' : `Hue ${Math.round(hue)}°, saturation ${Math.round(saturation * 100)}%` });
    }
  }
  return cells;
}

export function neighbour(cells, index, key) {
  if (key === 'Home') return cells.findIndex(cell => cell.q === 0 && cell.r === 0);
  const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
  if (!delta) return index;
  const current = cells[index];
  const next = cells.findIndex(cell => cell.q === current.q + delta[0] && cell.r === current.r + delta[1]);
  return next === -1 ? index : next;
}

const validId = /^[a-zA-Z0-9_-]{1,120}$/;
const validColour = /^#[0-9a-f]{6}$/i;

export function opacityEffect(adjustment) {
  return Math.sign(adjustment) * (adjustment / 100) ** 2;
}

function tint(source, colour, adjustment, strength = 0.18) {
  let channels = 'r g b';
  if (colour) {
    const [r, g, b] = [1, 3, 5].map(offset => parseInt(colour.slice(offset, offset + 2), 16));
    channels = `calc(r * ${1 - strength} + ${r} * ${strength}) calc(g * ${1 - strength} + ${g} * ${strength}) calc(b * ${1 - strength} + ${b} * ${strength})`;
  }
  const effect = opacityEffect(adjustment);
  const alpha = effect < 0 ? `calc(alpha * ${1 + effect})`
    : effect > 0 ? `calc(alpha + (1 - alpha) * ${effect})` : 'alpha';
  return `rgb(from ${source} ${channels} / ${alpha})`;
}

const sessionPanes = [['#panel', 'var(--tile-bg)'], ['#term', 'var(--term-bg)'], ['.chat-stream-wrap', 'var(--term-bg)'], ['.chat-composer', 'var(--tile-bg)'], ['.diff-panel', 'var(--term-bg)']];

export function taskStyles(colours = {}, adhocId = 'adhoc', opacityAdjustments = {}, { session = 0, cards = true } = {}) {
  const rules = [...new Set([...Object.keys(colours), ...Object.keys(opacityAdjustments)])].flatMap(taskId => {
    if (!validId.test(taskId)) return [];
    const colour = typeof colours[taskId] === 'string' && validColour.test(colours[taskId]) ? colours[taskId] : undefined;
    const value = opacityAdjustments[taskId];
    const adjustment = Number.isInteger(value) && value >= -100 && value <= 100 ? value : 0;
    if (!colour && !adjustment) return [];
    const tile = taskId === adhocId ? '.task-cell.no-task' : `.task-cell[data-taskid="${taskId}"]`;
    return [
      `#grid ${tile}:not(.drop-target){background-color:${tint('var(--tile-bg)', colour, adjustment)}}`,
      `#grid .switcher-pill[data-taskid="${taskId}"]{background-color:${tint('var(--pill-idle-bg)', colour, adjustment)}}`,
      ...cards ? [
        `#grid ${tile} :is(.session-card,.worker-row,.subagent-row,.snoozed-row){background-color:${tint('var(--surface)', colour, adjustment)}}`,
        `#grid ${tile} :is(.session-card,.worker-row,.subagent-row):hover{background-color:${tint('var(--surface-2)', colour, adjustment)}}`,
        ...colour ? [`#grid ${tile} :is(.session-card,.worker-row,.subagent-row,.snoozed-row){border-color:color-mix(in srgb, ${colour} 30%, var(--border-muted))}`] : [],
      ] : [],
      ...colour && session ? sessionPanes.map(([pane, source]) => `body:has(#grid ${tile} :is(.session-card,.worker-row,.subagent-row).selected) ${pane}{background-color:${tint(source, colour, 0, session / 100)}}`) : [],
    ];
  });
  return rules.join('\n');
}
