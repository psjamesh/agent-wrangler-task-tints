import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HuesStore } from './store.js';

export default {
  id: 'hues',
  label: 'Task Tints',
  description: 'Choose a hue for task backgrounds and minimised tasks without losing theme transparency.',
  author: 'Task Tints contributors',
  help: 'Open a task’s Colour… action to choose a hexagon on the colour wheel. Reset restores the current theme. Turning Task Tints off keeps saved colours.',
  dir: path.dirname(fileURLToPath(import.meta.url)),
  defaultEnabled: true,
  requires: ['tasks:read', 'board:rebuild', 'board:broadcast'],
  engines: { wranglerApi: '^1.53.0' },
  stores: { hues: () => new HuesStore() },
  handlers: [{
    type: 'hues-set',
    async handler(msg, host) {
      if (typeof msg.requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(msg.requestId)) return;
      try {
        const live = msg.taskId === host.tasks.adhocId || host.tasks.list().some(task => task.taskId === msg.taskId && !task.archived);
        if (!live) throw Error('Task is not on the board.');
        host.stores.hues.set(msg.taskId, msg.colour);
        await host.rebuild();
      } catch (error) {
        host.broadcast({ kind: 'saved', requestId: msg.requestId, ok: false, error: error.message });
        return;
      }
      host.broadcast({ kind: 'saved', requestId: msg.requestId, taskId: msg.taskId, colour: msg.colour?.toLowerCase() ?? null, ok: true });
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
