'use strict';
// Pane de herdr: refresca el uso de Claude y Codex cada pocos segundos.
//   node bin/usage.js          -> loop continuo
//   node bin/usage.js --once   -> una sola impresion (para probar)
// HERDR_USAGE_MODE=left muestra lo disponible en vez de lo consumido.
const { readClaudeUsage } = require('../lib/claude');
const { readCodexUsage } = require('../lib/codex');
const { render, BAR_STYLES } = require('../lib/render');
const { ownPaneContext } = require('../lib/herdr');
const { DATA_DIR, readJson, writeJsonAtomic } = require('../lib/common');
const path = require('path');

const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// node bin/usage.js --bar <estilo>: guarda la estetica de las barras (se aplica en vivo).
// node bin/usage.js --styles: muestra todos los estilos para elegir.
const barArg = process.argv.indexOf('--bar');
if (barArg !== -1) {
  const name = process.argv[barArg + 1];
  if (!BAR_STYLES[name]) {
    console.error(`Estilos: ${Object.keys(BAR_STYLES).join(', ')}`);
    process.exit(1);
  }
  writeJsonAtomic(CONFIG_FILE, { ...readJson(CONFIG_FILE, {}), bar: name });
  console.log(`Barras: ${name}`);
  process.exit(0);
}
if (process.argv.includes('--styles')) {
  for (const [name, [on, off]] of Object.entries(BAR_STYLES)) {
    console.log(`${name.padEnd(9)} ${on.repeat(12)}${off.repeat(8)}  60%`);
  }
  process.exit(0);
}

const once = process.argv.includes('--once');
const mode = process.env.HERDR_USAGE_MODE === 'left' ? 'left' : 'used';
const INTERVAL_MS = Number(process.env.HERDR_USAGE_INTERVAL_MS) || 5000;

function snapshot(own) {
  const safe = (fn) => {
    try {
      return fn();
    } catch {
      return null;
    }
  };
  const claude = safe(readClaudeUsage);
  // La conversacion de la pestana de este pane va primera; si no se encuentra,
  // queda la que escribio ultimo.
  const mine = own && own.sessionId;
  if (mine && claude) claude.sessions.sort((a, b) => (b.id === mine) - (a.id === mine));
  return { claude, codex: safe(readCodexUsage) };
}

function frame() {
  const cols = process.stdout.columns || 100;
  // El alto sale de herdr: process.stdout.rows no se entera de los resizes del pane.
  const own = ownPaneContext();
  const rows = (own && own.rows) || process.stdout.rows || Infinity;
  const bar = process.env.HERDR_USAGE_BAR || readJson(CONFIG_FILE, {}).bar;
  // Lo ultimo que se escribe es lo que se recorta: si el pane es bajo, la fila de
  // sesion cede lugar y las barras de 5h/7d nunca scrollean fuera de pantalla.
  const lines = render(snapshot(own), cols, mode, Date.now() / 1000, { rows, bar }).slice(0, rows);
  return lines.map((l) => l + '\x1b[K').join('\n');
}

if (once) {
  console.log(frame());
  process.exit(0);
}

const out = process.stdout;
const restore = () => out.write('\x1b[?25h\x1b[?1049l');
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
process.on('exit', restore);

out.write('\x1b[?1049h\x1b[?25l');
const tick = () => out.write('\x1b[H' + frame() + '\x1b[J');
tick();
setInterval(tick, INTERVAL_MS);
out.on('resize', () => {
  out.write('\x1b[2J');
  tick();
});
