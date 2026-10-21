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

// Tokens de contexto de la conversacion actual: lo que el ultimo request mando al modelo.
function toContext(cw) {
  const u = cw && cw.current_usage;
  if (!u) return null;
  const tokens =
    (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
  return { tokens, size: cw.context_window_size ?? null };
}

// Resumen de la sesion para el pane: proyecto, modelo, costo, lineas y contexto.
function toSession(input, prevSession) {
  const dir = (input.workspace && input.workspace.current_dir) || input.cwd || '';
  const cost = input.cost || {};
  return {
    name: path.basename(dir) || '?',
    model: (input.model && input.model.display_name) || null,
    cost: cost.total_cost_usd ?? null,
    durationMs: cost.total_duration_ms ?? null,
    added: cost.total_lines_added ?? null,
    removed: cost.total_lines_removed ?? null,
    context: toContext(input.context_window) || (prevSession && prevSession.context) || null,
    updatedAt: Date.now() / 1000,
  };
}

const SESSION_TTL_SEC = 3600;

const rl = input.rate_limits;
const sid = input.session_id;
if (rl || sid) {
  const prev = readJson(CLAUDE_FILE, {});
  const now = Date.now() / 1000;
  // Se descartan las sesiones que hace rato no escriben (ya cerradas).
  const sessions = {};
  for (const [id, s] of Object.entries(prev.sessions || {})) {
    if (now - (s.updatedAt || 0) < SESSION_TTL_SEC) sessions[id] = s;
  }
  if (sid) sessions[sid] = toSession(input, sessions[sid]);
  const five = toWindow(rl && rl.five_hour) || prev.five_hour || null;
  const seven = toWindow(rl && rl.seven_day) || prev.seven_day || null;
  try {
    writeJsonAtomic(CLAUDE_FILE, {
      five_hour: five,
      seven_day: seven,
      sessions,
      // updatedAt marca la frescura de los rate limits, no la de las sesiones
      updatedAt: rl ? now : prev.updatedAt ?? null,
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
