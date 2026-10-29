import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import manifest from '../index.js';
import { HuesStore } from '../store.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.env.AW_SOURCE;
if (!source) throw Error('Set AW_SOURCE to an Agent Wrangler checkout.');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hues-preview-'));
const tasks = [{ taskId: 't_release', name: 'Release prep', archived: false }, { taskId: 't_research', name: 'Research', archived: false }];
const store = new HuesStore(path.join(directory, 'hues.json'));
const baseHost = { stores: { hues: store }, tasks: { adhocId: 'adhoc', list: () => tasks } };
store.set('t_release', '#0000ff');
store.set('t_research', '#ff0000');
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/state') {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(manifest.graph({ host: baseHost })));
      return;
    }
    if (url.pathname === '/control' && request.method === 'POST') {
      let body = '';
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 4096) throw Error('Request too large');
      }
      const frames = [];
      const host = { ...baseHost, rebuild: async () => {}, broadcast: frame => frames.push({ type: 'ext:hues', ...frame }) };
      const message = JSON.parse(body);
      const handler = manifest.handlers.find(entry => entry.type === message.type);
      if (!handler) throw Error('Unknown control');
      await handler.handler(message, host);
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ graph: manifest.graph({ host }), frames }));
      return;
    }
    if (/^\/theme\/(pink|pixel-cats|cyberpunk|dolphin|wrangler)$/.test(url.pathname)) {
      response.setHeader('Content-Type', 'application/json');
      response.end(fs.readFileSync(path.join(source, 'server/extensions/builtin/themes/themes', path.basename(url.pathname), 'theme.json')));
      return;
    }
    const base = url.pathname.startsWith('/host/') ? path.join(source, 'public') : root;
    const relative = url.pathname.startsWith('/host/') ? url.pathname.slice(6) : url.pathname === '/' ? 'test/preview.html' : url.pathname.slice(1);
    const file = path.resolve(base, relative);
    if (!file.startsWith(`${base}${path.sep}`) || !mime[path.extname(file)]) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('Content-Type', mime[path.extname(file)]);
    response.end(fs.readFileSync(file));
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain' }).end(error.message);
  }
});
server.listen(Number(process.env.HUES_PREVIEW_PORT || 43827), '127.0.0.1', () => process.stdout.write(`Task Tints preview: http://127.0.0.1:${server.address().port}\n`));
process.on('SIGINT', () => server.close(() => { fs.rmSync(directory, { recursive: true, force: true }); process.exit(0); }));
