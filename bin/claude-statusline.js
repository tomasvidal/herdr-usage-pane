'use strict';
// Se usa como `statusLine` de Claude Code: recibe el JSON de la sesion por stdin,
// guarda los rate limits para el pane y imprime la linea de estado.
const path = require('path');
const { spawnSync } = require('child_process');
const { DATA_DIR, readJson, writeJsonAtomic } = require('../lib/common');
const { CLAUDE_FILE } = require('../lib/claude');

function readStdin() {
  try {
    return require('fs').readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function toWindow(w) {
  if (!w || typeof w.used_percentage !== 'number') return null;
  return { usedPct: w.used_percentage, resetsAt: w.resets_at ?? null };
}

const raw = readStdin();
let input = {};
try {
  input = JSON.parse(raw);
} catch {
  // sin JSON valido solo se encadena la linea previa
}

const rl = input.rate_limits;
if (rl) {
  const prev = readJson(CLAUDE_FILE, {});
  const five = toWindow(rl.five_hour) || prev.five_hour || null;
  const seven = toWindow(rl.seven_day) || prev.seven_day || null;
  try {
    writeJsonAtomic(CLAUDE_FILE, {
      five_hour: five,
      seven_day: seven,
      updatedAt: Date.now() / 1000,
    });
  } catch {
    // el statusline nunca debe romper la sesion de Claude
  }
}

// Si ya habia un statusLine antes de instalar esto, lo seguimos mostrando.
const config = readJson(path.join(DATA_DIR, 'config.json'), {});
if (config.previous) {
  const r = spawnSync(config.previous, { shell: true, input: raw, encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
} else if (rl && rl.five_hour && rl.seven_day) {
  const f = (w) => `${Math.round(w.used_percentage)}%`;
  process.stdout.write(`5h ${f(rl.five_hour)} · 7d ${f(rl.seven_day)}`);
}
