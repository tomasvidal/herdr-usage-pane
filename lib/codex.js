'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const SESSIONS = path.join(CODEX_HOME, 'sessions');
const TAIL_BYTES = 1024 * 1024;
const MAX_FILES = 20;

const memo = new Map(); // archivo -> { key, result }

function listDesc(dir) {
  try {
    return fs.readdirSync(dir).sort().reverse();
  } catch {
    return [];
  }
}

// Rollouts del mas nuevo al mas viejo: sessions/AAAA/MM/DD/rollout-*.jsonl
function recentRollouts() {
  const out = [];
  for (const y of listDesc(SESSIONS)) {
    for (const m of listDesc(path.join(SESSIONS, y))) {
      for (const d of listDesc(path.join(SESSIONS, y, m))) {
        const dir = path.join(SESSIONS, y, m, d);
        for (const f of listDesc(dir)) {
          if (f.startsWith('rollout-') && f.endsWith('.jsonl')) out.push(path.join(dir, f));
          if (out.length >= MAX_FILES) return out;
        }
      }
    }
  }
  return out;
}

function readTail(file, size) {
  const start = Math.max(0, size - TAIL_BYTES);
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    return buf.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function toWindow(w) {
  if (!w || typeof w.used_percent !== 'number') return null;
  return { usedPct: w.used_percent, resetsAt: w.resets_at ?? null };
}

// Ultimo evento token_count con limites no nulos dentro de un rollout.
function lastRateLimits(file) {
  const st = fs.statSync(file);
  const key = `${st.mtimeMs}:${st.size}`;
  const hit = memo.get(file);
  if (hit && hit.key === key) return hit.result;

  let result = null;
  const lines = readTail(file, st.size).split('\n');
  for (let i = lines.length - 1; i >= 0 && !result; i--) {
    const line = lines[i];
    if (!line.includes('"rate_limits"') || !line.includes('"primary":{')) continue;
    try {
      const ev = JSON.parse(line);
      const rl = ev.payload && ev.payload.rate_limits;
      const primary = toWindow(rl && rl.primary);
      const secondary = toWindow(rl && rl.secondary);
      if (primary || secondary) {
        result = {
          primary,
          secondary,
          plan: rl.plan_type || null,
          updatedAt: Date.parse(ev.timestamp) / 1000 || st.mtimeMs / 1000,
        };
      }
    } catch {
      // linea cortada por el limite del tail: se ignora
    }
  }
  memo.set(file, { key, result });
  return result;
}

// { primary: 5h, secondary: semanal, updatedAt } o null si no hay datos.
function readCodexUsage() {
  for (const file of recentRollouts()) {
    try {
      const r = lastRateLimits(file);
      if (r) return r;
    } catch {
      // archivo en uso o borrado: se prueba el siguiente
    }
  }
  return null;
}

module.exports = { readCodexUsage };
