import { colourWheel, neighbour, taskStyles } from './colours.js';

export default {
  register(slots) {
    const doc = globalThis.document;
    const win = doc.defaultView;
    const api = slots.api;
    const cells = colourWheel();
    const hosts = new Set();
    const sheet = doc.createElement('style');
    sheet.dataset.hues = '';
    let colours = {};
    let adhocId = 'adhoc';
    let lastGraph;
    let picker;
    let pending;

    function renderStyles() {
      const css = taskStyles(colours, adhocId);
      if (sheet.textContent !== css) sheet.textContent = css;
    }

    function selection() {
      if (!picker) return;
      const saved = colours[picker.task.id];
      for (const button of picker.buttons) {
        const selected = button.dataset.colour === saved;
        button.setAttribute('aria-pressed', String(selected));
        button.querySelector('span').textContent = selected ? '✓' : '';
        button.disabled = Boolean(pending);
      }
      picker.reset.disabled = Boolean(pending) || !saved;
    }

    function receiveGraph(graph) {
      if (!graph || graph === lastGraph) return;
      lastGraph = graph;
      colours = { ...(graph.hues?.colours || {}) };
      renderStyles();
      selection();
    }

    function position() {
      if (!picker) return;
      const anchor = picker.anchor?.getBoundingClientRect();
      const bounds = picker.el.getBoundingClientRect();
      const width = bounds.width || 284;
      const height = bounds.height || 340;
      picker.el.style.left = `${Math.max(12, Math.min(anchor?.left ?? 12, win.innerWidth - width - 12))}px`;
      picker.el.style.top = `${Math.max(12, Math.min((anchor?.bottom ?? 12) + 8, win.innerHeight - height - 12))}px`;
    }

    function taskButton(task) {
      const tile = doc.querySelector(task.adhoc ? '.task-cell.no-task' : `.task-cell[data-taskid="${task.id}"]`);
      return tile?.querySelector('.task-actions-btn');
    }

    function closePicker() {
      if (!picker) return;
      const { anchor, task } = picker;
      picker.el.remove();
      picker = undefined;
      if (pending) win.clearTimeout(pending.timer);
      pending = undefined;
      win.removeEventListener('resize', position);
      (anchor?.isConnected ? anchor : taskButton(task))?.focus();
    }

    function failed(message) {
      if (!picker) return;
      if (pending) win.clearTimeout(pending.timer);
      pending = undefined;
      picker.status.setAttribute('role', 'alert');
      picker.status.textContent = message;
      selection();
    }

    function save(colour) {
      if (!picker || pending) return;
      const requestId = `hues-${win.crypto.randomUUID()}`;
      pending = { requestId, taskId: picker.task.id, colour, timer: win.setTimeout(() => failed('Could not confirm the save. Try again when connected.'), 10000) };
      picker.status.setAttribute('role', 'status');
      picker.status.textContent = 'Saving…';
      selection();
      try { api.send({ type: 'hues-set', requestId, taskId: picker.task.id, colour }); }
      catch { failed('Could not save the task colour.'); }
    }

    function openPicker(task) {
      closePicker();
      const anchor = taskButton(task);
      const el = doc.createElement('dialog');
      el.id = 'hues-modal';
      el.className = 'hues-picker';
      el.setAttribute('aria-labelledby', 'hues-title');
      const header = doc.createElement('div');
      header.className = 'hues-picker-head';
      const title = doc.createElement('h2');
      title.id = 'hues-title';
      title.textContent = 'Task colour';
      const close = doc.createElement('button');
      close.type = 'button';
      close.className = 'hues-close';
      close.setAttribute('aria-label', 'Close colour picker');
      close.textContent = '×';
      close.addEventListener('click', closePicker);
      header.append(title, close);
      const name = doc.createElement('p');
      name.className = 'hues-task-name';
      name.textContent = task.name || 'Unassigned';
      const wheel = doc.createElement('div');
      wheel.className = 'hues-wheel';
      wheel.setAttribute('role', 'group');
      wheel.setAttribute('aria-label', 'Colour wheel. Use arrow keys to move and Enter to choose.');
      const focusIndex = Math.max(0, cells.findIndex(cell => cell.colour === colours[task.id] || (!colours[task.id] && cell.q === 0 && cell.r === 0)));
      const buttons = cells.map((cell, index) => {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'hues-swatch';
        button.dataset.colour = cell.colour;
        button.style.left = `${cell.x / 250 * 100}%`;
        button.style.top = `${cell.y / 222 * 100}%`;
        button.style.setProperty('--hues-swatch', cell.colour);
        const brightness = [1, 3, 5].map(offset => parseInt(cell.colour.slice(offset, offset + 2), 16));
        button.style.setProperty('--hues-check', brightness[0] * .299 + brightness[1] * .587 + brightness[2] * .114 > 145 ? '#101820' : '#ffffff');
        button.title = `${cell.label} (${cell.colour})`;
        button.setAttribute('aria-label', button.title);
        button.tabIndex = index === focusIndex ? 0 : -1;
        button.append(doc.createElement('span'));
        button.addEventListener('click', () => save(cell.colour));
        button.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            save(cell.colour);
          } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) {
            event.preventDefault();
            const next = neighbour(cells, index, event.key);
            for (const candidate of buttons) candidate.tabIndex = -1;
            buttons[next].tabIndex = 0;
            buttons[next].focus();
          }
        });
        wheel.append(button);
        return button;
      });
      const reset = doc.createElement('button');
      reset.type = 'button';
      reset.className = 'hues-reset';
      reset.textContent = 'Reset';
      reset.title = 'Use the current theme’s colour';
      reset.addEventListener('click', () => save(null));
      const status = doc.createElement('p');
      status.className = 'hues-status';
      status.setAttribute('role', 'status');
      el.append(header, name, wheel, reset, status);
      picker = { el, task, anchor, buttons, reset, status };
      el.addEventListener('cancel', event => { event.preventDefault(); closePicker(); });
      el.addEventListener('click', event => {
        if (event.target !== el) return;
        const bounds = el.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closePicker();
      });
      doc.body.append(el);
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
      selection();
      position();
      win.addEventListener('resize', position);
      buttons[focusIndex].focus();
    }

    api.onMessage(frame => {
      if (frame.kind !== 'saved' || !pending || frame.requestId !== pending.requestId) return;
      if (!frame.ok) { failed(typeof frame.error === 'string' ? frame.error : 'Could not save the task colour.'); return; }
      closePicker();
    });

    slots.register('task.action', {
      id: 'colour',
      items(task, graph) {
        receiveGraph(graph);
        return [{ label: 'Colour…', run: () => openPicker(task) }];
      },
    });
    slots.register('task.body', {
      id: 'tint',
      mount(el, _api, ctx) {
        hosts.add(el);
        adhocId = ctx.adhocId;
        if (!sheet.isConnected) el.append(sheet);
      },
      update(_el, _ctx, graph) { receiveGraph(graph); },
      unmount(el) {
        hosts.delete(el);
        if (sheet.parentElement === el && hosts.size) hosts.values().next().value.append(sheet);
        queueMicrotask(() => {
          if (picker && !taskButton(picker.task)) closePicker();
          if (hosts.size) return;
          sheet.remove();
          closePicker();
        });
      },
    });
  },
};
