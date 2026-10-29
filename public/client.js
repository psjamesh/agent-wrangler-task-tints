import { colourWheel, neighbour, taskStyles } from './colours.js';

const paintbrush = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6 4 4 3-5a2.1 2.1 0 0 0-3-3Z"/><path d="m14 6-5 5 4 4 5-5"/><path d="M9 11c-4-1-3 5-7 6 3 4 10 3 11-2"/></svg>';

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
    let opacityAdjustments = {};
    let adhocId = 'adhoc';
    let lastGraph;
    let picker;
    let pending;

    function renderStyles() {
      const adjustments = picker?.draftOpacity === undefined ? opacityAdjustments : { ...opacityAdjustments, [picker.task.id]: picker.draftOpacity };
      const css = taskStyles(colours, adhocId, adjustments);
      if (sheet.textContent !== css) sheet.textContent = css;
    }

    function transparency() {
      const value = picker.draftOpacity ?? opacityAdjustments[picker.task.id] ?? 0;
      const label = value === 0 ? 'Theme default' : `${Math.abs(value)}% towards ${value < 0 ? 'transparent' : 'opaque'}`;
      picker.slider.value = String(value);
      picker.slider.setAttribute('aria-valuetext', label);
      picker.slider.disabled = Boolean(pending);
      picker.output.textContent = label;
      picker.reset.disabled = Boolean(pending) || (!colours[picker.task.id] && value === 0);
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
      transparency();
    }

    function receiveGraph(graph) {
      if (!graph || graph === lastGraph) return;
      lastGraph = graph;
      colours = { ...(graph.hues?.colours || {}) };
      opacityAdjustments = { ...(graph.hues?.opacityAdjustments || {}) };
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
      renderStyles();
      win.removeEventListener('resize', position);
      (anchor?.isConnected ? anchor : taskButton(task))?.focus();
    }

    function finishSave() {
      const focusSlider = pending?.focusSlider;
      if (pending) win.clearTimeout(pending.timer);
      pending = undefined;
      picker.draftOpacity = undefined;
      renderStyles();
      selection();
      if (focusSlider && (doc.activeElement === doc.body || doc.activeElement === picker.slider)) picker.slider.focus();
    }

    function failed(message) {
      if (!picker) return;
      finishSave();
      picker.status.setAttribute('role', 'alert');
      picker.status.textContent = message;
    }

    function save(type, fields, closeAfter = true) {
      if (!picker || pending) return;
      const requestId = `hues-${win.crypto.randomUUID()}`;
      pending = { requestId, closeAfter, focusSlider: doc.activeElement === picker.slider, timer: win.setTimeout(() => failed('Could not confirm the save. Try again when connected.'), 10000) };
      picker.status.setAttribute('role', 'status');
      picker.status.textContent = 'Saving…';
      selection();
      try { api.send({ type, requestId, taskId: picker.task.id, ...fields }); }
      catch { failed('Could not save the task appearance.'); }
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
        button.addEventListener('click', () => save('hues-set', { colour: cell.colour }));
        button.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            save('hues-set', { colour: cell.colour });
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
      const opacity = doc.createElement('div');
      opacity.className = 'hues-transparency';
      const opacityHead = doc.createElement('div');
      opacityHead.className = 'hues-transparency-head';
      const label = doc.createElement('label');
      label.htmlFor = 'hues-transparency';
      label.textContent = 'Transparency';
      const output = doc.createElement('output');
      output.htmlFor = 'hues-transparency';
      opacityHead.append(label, output);
      const slider = doc.createElement('input');
      slider.type = 'range';
      slider.id = 'hues-transparency';
      slider.min = '-100';
      slider.max = '100';
      slider.step = '1';
      slider.setAttribute('aria-describedby', 'hues-transparency-help');
      slider.addEventListener('input', () => {
        if (pending) return;
        picker.draftOpacity = Number(slider.value);
        renderStyles();
        transparency();
      });
      slider.addEventListener('change', () => {
        if (pending) return;
        const adjustment = Number(slider.value);
        if (adjustment === (opacityAdjustments[task.id] ?? 0)) {
          picker.draftOpacity = undefined;
          renderStyles();
          return;
        }
        picker.draftOpacity = adjustment;
        save('hues-opacity-set', { adjustment }, false);
      });
      const ends = doc.createElement('div');
      ends.className = 'hues-transparency-ends';
      for (const text of ['More transparent', 'More opaque']) {
        const end = doc.createElement('span');
        end.textContent = text;
        ends.append(end);
      }
      const help = doc.createElement('p');
      help.id = 'hues-transparency-help';
      help.textContent = 'Relative to the current theme. Centre uses its default.';
      opacity.append(opacityHead, slider, ends, help);
      const reset = doc.createElement('button');
      reset.type = 'button';
      reset.className = 'hues-reset';
      reset.textContent = 'Reset';
      reset.title = 'Use the current theme’s colour and transparency';
      reset.addEventListener('click', () => save('hues-set', { colour: null }));
      const status = doc.createElement('p');
      status.className = 'hues-status';
      status.setAttribute('role', 'status');
      el.append(header, name, wheel, opacity, reset, status);
      picker = { el, task, anchor, buttons, slider, output, reset, status };
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
      if (!frame.ok) { failed(typeof frame.error === 'string' ? frame.error : 'Could not save the task appearance.'); return; }
      if (pending.closeAfter) { closePicker(); return; }
      finishSave();
      picker.status.textContent = '';
    });

    slots.register('task.action', {
      id: 'colour',
      items(task, graph) {
        receiveGraph(graph);
        return [{ label: 'Colour…', icon: paintbrush, run: () => openPicker(task) }];
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
