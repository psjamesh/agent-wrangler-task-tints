import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HuesStore } from './store.js';

async function saveTask(msg, host, update) {
  if (typeof msg.requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(msg.requestId)) return;
  let saved;
  try {
    const live = msg.taskId === host.tasks.adhocId || host.tasks.list().some(task => task.taskId === msg.taskId && !task.archived);
    if (!live) throw Error('Task is not on the board.');
    saved = update(host.stores.hues);
    await host.rebuild();
  } catch (error) {
    host.broadcast({ kind: 'saved', requestId: msg.requestId, ok: false, error: error.message });
    return;
  }
  host.broadcast({ kind: 'saved', requestId: msg.requestId, taskId: msg.taskId, ...saved, ok: true });
}

export default {
  id: 'hues',
  label: 'Task Tints',
  description: 'Tint tasks and their cards, with transparency relative to your theme.',
  author: 'Task Tints contributors',
  help: 'Open a task’s Colour… action to tint its background, cards and minimised pill. Transparency follows your theme, with gentler changes near the slider’s centre. Reset restores the theme. Turning Task Tints off keeps saved choices.',
  dir: path.dirname(fileURLToPath(import.meta.url)),
  defaultEnabled: true,
  requires: ['tasks:read', 'board:rebuild', 'board:broadcast'],
  engines: { wranglerApi: '^1.53.0' },
  settings: [{
    key: 'tintCards',
    type: 'toggle',
    label: 'Tint cards',
    help: 'Tints session cards and their rows with the task colour, and gives them a task-coloured border. On by default.',
  }, {
    key: 'tintSession',
    type: 'toggle',
    label: 'Tint session views',
    help: 'Washes the open session’s panel (header, terminal and chat) and diff view with its task’s colour. Tasks without a colour are untouched.',
  }],
  stores: { hues: () => new HuesStore() },
  handlers: [{
    type: 'hues-set',
    handler(msg, host) {
      return saveTask(msg, host, store => {
        store.set(msg.taskId, msg.colour);
        return { colour: msg.colour?.toLowerCase() ?? null };
      });
    },
  }, {
    type: 'hues-opacity-set',
    handler(msg, host) {
      return saveTask(msg, host, store => {
        store.setOpacity(msg.taskId, msg.adjustment);
        return { adjustment: msg.adjustment };
      });
    },
  }],
  graph({ host }) {
    try {
      host.stores.hues.prune(new Set([host.tasks.adhocId, ...host.tasks.list().map(task => task.taskId)]));
    } catch (error) {
      host.log?.('Could not clean up deleted task colours:', error.message);
    }
    return { hues: host.stores.hues.snapshot() };
  },
  onTaskDelete({ taskId, host }) { host.stores.hues.deleteTask(taskId); },
  client: 'public/client.js',
  styles: 'public/styles.css',
};
