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

function tint(source, colour) {
  const [r, g, b] = [1, 3, 5].map(offset => parseInt(colour.slice(offset, offset + 2), 16));
  return `rgb(from var(${source}) calc(r * 0.82 + ${r} * 0.18) calc(g * 0.82 + ${g} * 0.18) calc(b * 0.82 + ${b} * 0.18) / alpha)`;
}

export function taskStyles(colours = {}, adhocId = 'adhoc') {
  return Object.entries(colours).flatMap(([taskId, colour]) => {
    if (!validId.test(taskId) || typeof colour !== 'string' || !validColour.test(colour)) return [];
    const tile = taskId === adhocId ? '.task-cell.no-task' : `.task-cell[data-taskid="${taskId}"]`;
    return [
      `#grid ${tile}:not(.drop-target){background-color:${tint('--tile-bg', colour)}}`,
      `#grid .switcher-pill[data-taskid="${taskId}"]{background-color:${tint('--pill-idle-bg', colour)}}`,
    ];
  }).join('\n');
}
