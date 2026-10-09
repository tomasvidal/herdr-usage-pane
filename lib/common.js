'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

// Donde el statusline de Claude deja el ultimo dato conocido.
const DATA_DIR = process.env.HERDR_USAGE_DIR || path.join(os.homedir(), '.herdr-usage');

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, data) {
  ensureDir();
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file);
}

// Normaliza una ventana de rate limit a { usedPct, resetsAt (epoch s) }.
// Si la ventana ya se reseteo, el uso real es 0 hasta la proxima respuesta.
function windowView(win, nowSec = Date.now() / 1000) {
  if (!win || typeof win.usedPct !== 'number') return null;
  const expired = typeof win.resetsAt === 'number' && win.resetsAt <= nowSec;
  return {
    usedPct: expired ? 0 : Math.min(100, Math.max(0, win.usedPct)),
    resetsAt: win.resetsAt ?? null,
    expired,
  };
}

function fmtDuration(sec) {
  if (sec == null) return '';
  if (sec <= 0) return 'ahora';
  const m = Math.floor(sec / 60);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return `${d}d${h}h`;
  if (h > 0) return `${h}h${String(mm).padStart(2, '0')}m`;
  return `${mm}m`;
}

module.exports = { DATA_DIR, ensureDir, readJson, writeJsonAtomic, windowView, fmtDuration };
