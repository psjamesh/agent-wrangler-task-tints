import { createSlots } from '/host/slots.js';
import { createClientExtensionLoader } from '/host/extensions.js';

let graph = await (await fetch('/state')).json();
let minimised = false;
let enabled = true;
const tasks = [{ id: 't_release', name: 'Release prep' }, { id: 't_research', name: 'Research' }];
const slots = createSlots({ document, handlerTypesFor: () => ['hues-set', 'hues-opacity-set'], version: '1.53.0' });
const api = { send: async frame => {
  const response = await fetch('/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(frame) });
  const result = await response.json();
  graph = result.graph;
  sync();
  for (const message of result.frames) slots.dispatchMessage(message);
} };
const loader = createClientExtensionLoader(slots, { document, api });
const assets = [{ id: 'hues', client: '/public/client.js', styles: '/public/styles.css' }];

function sync() {
  const entries = [...document.querySelectorAll('[data-task-body]')].map(host => ({ host, session: { taskId: host.dataset.taskBody, adhocId: 'adhoc', container: host } }));
  slots.syncHosts('task.body', entries, api, graph);
}

function open(task, event) {
  document.querySelector('.context-menu')?.remove();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${Math.max(12, Math.min(event.clientX, innerWidth - 180))}px`;
  menu.style.top = `${event.clientY}px`;
  for (const item of slots.taskMenuItems({ ...task, adhoc: false }, graph, api)) {
    const button = document.createElement('button');
    button.className = 'context-menu-item';
    button.innerHTML = item.icon;
    button.append(document.createTextNode(item.label));
    button.onclick = () => { menu.remove(); item.run(); };
    menu.append(button);
  }
  if (menu.childElementCount) document.body.append(menu);
}

function render() {
  const grid = document.getElementById('grid');
  grid.innerHTML = tasks.filter(task => task.id !== 't_release' || !minimised).map(task => `<section class="task-cell" data-taskid="${task.id}"><div class="task-head"><span class="task-name">${task.name}</span><button class="task-actions-btn" aria-label="${task.name} actions">⋮</button></div><div class="task-body"><div class="session-card working" role="button" tabindex="0"><span class="card-bar"><span>Busy</span></span><div class="card-name-row"><span class="card-name">${task.id === 't_release' ? 'Review release notes' : 'Explore the next idea'}</span></div><div class="card-loc">Working</div></div><div class="session-card needs-you" role="button" tabindex="0"><span class="card-bar"><span>Reply</span></span><div class="card-name-row"><span class="card-name">Check the details</span></div><div class="card-loc">Needs input</div></div><div class="task-body-ext" data-task-body="${task.id}"></div></div></section>`).join('') + `<div class="preview-tray">${minimised ? '<button class="switcher-pill" data-taskid="t_release">Release prep <span class="switcher-dot working"></span></button>' : ''}<button class="switcher-pill" data-taskid="t_research">Research <span class="switcher-dot needs-you"></span></button></div>`;
  for (const task of tasks) {
    const cell = grid.querySelector(`.task-cell[data-taskid="${task.id}"]`);
    cell?.querySelector('.task-actions-btn').addEventListener('click', event => open(task, event));
    cell?.addEventListener('contextmenu', event => { event.preventDefault(); open(task, event); });
  }
  for (const card of grid.querySelectorAll('.session-card')) card.addEventListener('click', () => {
    const selected = card.classList.contains('selected');
    for (const other of grid.querySelectorAll('.session-card')) other.classList.remove('selected');
    card.classList.toggle('selected', !selected);
  });
  grid.querySelector('.switcher-pill[data-taskid="t_release"]')?.addEventListener('click', () => { minimised = false; render(); });
  sync();
}

document.getElementById('theme').addEventListener('change', async event => {
  const theme = event.target.value;
  document.body.removeAttribute('style');
  document.body.classList.toggle('light', theme === 'light');
  if (theme === 'transparent') {
    document.body.style.setProperty('--tile-bg', 'rgba(20, 30, 40, 0)');
    document.body.style.setProperty('--pill-idle-bg', 'rgba(30, 40, 50, 0)');
    document.body.style.setProperty('--surface', 'rgba(20, 30, 40, 0)');
    document.body.style.setProperty('--surface-2', 'rgba(30, 40, 50, 0)');
  } else if (theme !== 'light' && theme !== 'dark') {
    const definition = await (await fetch(`/theme/${theme}`)).json();
    document.body.classList.toggle('light', definition.base === 'light');
    for (const [key, value] of Object.entries(definition.colors || {})) document.body.style.setProperty(`--${key}`, value);
  }
});
document.getElementById('toggle-hues').addEventListener('click', async event => {
  enabled = !enabled;
  if (enabled) await loader.load(assets);
  else loader.unload('hues');
  event.target.textContent = enabled ? 'Disable Task Tints' : 'Enable Task Tints';
  sync();
});
document.getElementById('minimise').addEventListener('click', () => { minimised = !minimised; render(); });
await loader.load(assets);
render();
document.body.dataset.ready = 'true';
