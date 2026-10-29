import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const taskIdPattern = /^[a-zA-Z0-9_-]{1,120}$/;
const colourPattern = /^#[0-9a-f]{6}$/i;

export function dataFile(configured = process.env.AW_DATA_DIR) {
  const base = configured === '~' ? os.homedir()
    : configured?.startsWith('~/') ? path.join(os.homedir(), configured.slice(2))
      : configured || path.join(os.homedir(), '.agent-wrangler');
  return path.resolve(base, 'hues.json');
}

function validate(taskId, colour) {
  if (typeof taskId !== 'string' || !taskIdPattern.test(taskId)) throw Error('Invalid task id.');
  if (colour !== null && (typeof colour !== 'string' || !colourPattern.test(colour))) throw Error('Choose a six-digit RGB colour.');
  return colour?.toLowerCase() ?? null;
}

export class HuesStore {
  constructor(file = dataFile()) {
    this.file = file;
    this.colours = new Map();
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (saved?.version !== 1 || !saved.colours || typeof saved.colours !== 'object' || Array.isArray(saved.colours)) throw Error('Invalid Hues state.');
      for (const [taskId, colour] of Object.entries(saved.colours)) {
        if (colour === null) throw Error('Invalid saved task colour.');
        this.colours.set(taskId, validate(taskId, colour));
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  snapshot() {
    return { colours: Object.fromEntries(this.colours) };
  }

  set(taskId, colour) {
    const canonical = validate(taskId, colour);
    if ((this.colours.get(taskId) ?? null) === canonical) return false;
    const next = new Map(this.colours);
    if (canonical === null) next.delete(taskId);
    else next.set(taskId, canonical);
    this.commit(next);
    return true;
  }

  prune(taskIds) {
    const next = new Map([...this.colours].filter(([taskId]) => taskIds.has(taskId)));
    if (next.size === this.colours.size) return false;
    this.commit(next);
    return true;
  }

  commit(next) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    let descriptor;
    try {
      descriptor = fs.openSync(temporary, 'wx', 0o600);
      fs.writeFileSync(descriptor, `${JSON.stringify({ version: 1, colours: Object.fromEntries(next) }, null, 2)}\n`);
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = undefined;
      fs.renameSync(temporary, this.file);
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
      try { fs.unlinkSync(temporary); } catch {}
    }
    this.colours = next;
  }

  deleteTask(taskId) {
    return this.set(taskId, null);
  }
}
