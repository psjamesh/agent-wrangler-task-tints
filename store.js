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

function validateTaskId(taskId) {
  if (typeof taskId !== 'string' || !taskIdPattern.test(taskId)) throw Error('Invalid task id.');
}

function validateColour(colour) {
  if (colour !== null && (typeof colour !== 'string' || !colourPattern.test(colour))) throw Error('Choose a six-digit RGB colour.');
  return colour?.toLowerCase() ?? null;
}

function validateOpacity(adjustment) {
  if (!Number.isInteger(adjustment) || adjustment < -100 || adjustment > 100) throw Error('Choose a transparency adjustment between -100 and 100.');
}

function isRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export class HuesStore {
  constructor(file = dataFile()) {
    this.file = file;
    this.colours = new Map();
    this.opacityAdjustments = new Map();
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (![1, 2].includes(saved?.version) || !isRecord(saved.colours)) throw Error('Invalid Hues state.');
      for (const [taskId, colour] of Object.entries(saved.colours)) {
        validateTaskId(taskId);
        if (colour === null) throw Error('Invalid saved task colour.');
        this.colours.set(taskId, validateColour(colour));
      }
      if (saved.version === 2) {
        if (!isRecord(saved.opacityAdjustments)) throw Error('Invalid saved task transparency.');
        for (const [taskId, adjustment] of Object.entries(saved.opacityAdjustments)) {
          validateTaskId(taskId);
          validateOpacity(adjustment);
          if (adjustment !== 0) this.opacityAdjustments.set(taskId, adjustment);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  snapshot() {
    return { colours: Object.fromEntries(this.colours), opacityAdjustments: Object.fromEntries(this.opacityAdjustments) };
  }

  set(taskId, colour) {
    validateTaskId(taskId);
    const canonical = validateColour(colour);
    if ((this.colours.get(taskId) ?? null) === canonical && (canonical !== null || !this.opacityAdjustments.has(taskId))) return false;
    const next = new Map(this.colours);
    const nextOpacity = new Map(this.opacityAdjustments);
    if (canonical === null) {
      next.delete(taskId);
      nextOpacity.delete(taskId);
    } else next.set(taskId, canonical);
    this.commit(next, nextOpacity);
    return true;
  }

  setOpacity(taskId, adjustment) {
    validateTaskId(taskId);
    validateOpacity(adjustment);
    if ((this.opacityAdjustments.get(taskId) ?? 0) === adjustment) return false;
    const next = new Map(this.opacityAdjustments);
    if (adjustment === 0) next.delete(taskId);
    else next.set(taskId, adjustment);
    this.commit(this.colours, next);
    return true;
  }

  prune(taskIds) {
    const next = new Map([...this.colours].filter(([taskId]) => taskIds.has(taskId)));
    const nextOpacity = new Map([...this.opacityAdjustments].filter(([taskId]) => taskIds.has(taskId)));
    if (next.size === this.colours.size && nextOpacity.size === this.opacityAdjustments.size) return false;
    this.commit(next, nextOpacity);
    return true;
  }

  commit(next, nextOpacity) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    let descriptor;
    try {
      descriptor = fs.openSync(temporary, 'wx', 0o600);
      fs.writeFileSync(descriptor, `${JSON.stringify({ version: 2, colours: Object.fromEntries(next), opacityAdjustments: Object.fromEntries(nextOpacity) }, null, 2)}\n`);
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = undefined;
      fs.renameSync(temporary, this.file);
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
      try { fs.unlinkSync(temporary); } catch {}
    }
    this.colours = next;
    this.opacityAdjustments = nextOpacity;
  }

  deleteTask(taskId) {
    return this.set(taskId, null);
  }
}
