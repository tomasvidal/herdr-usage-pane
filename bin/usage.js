'use strict';
// Pane de herdr: refresca el uso de Claude y Codex cada pocos segundos.
//   node bin/usage.js          -> loop continuo
//   node bin/usage.js --once   -> una sola impresion (para probar)
// HERDR_USAGE_MODE=left muestra lo disponible en vez de lo consumido.
const { readClaudeUsage } = require('../lib/claude');
const { readCodexUsage } = require('../lib/codex');
const { render } = require('../lib/render');

const once = process.argv.includes('--once');
const mode = process.env.HERDR_USAGE_MODE === 'left' ? 'left' : 'used';
const INTERVAL_MS = Number(process.env.HERDR_USAGE_INTERVAL_MS) || 5000;

function snapshot() {
  const safe = (fn) => {
    try {
      return fn();
    } catch {
      return null;
    }
  };
  return { claude: safe(readClaudeUsage), codex: safe(readCodexUsage) };
}

function frame() {
  const cols = process.stdout.columns || 100;
  const lines = render(snapshot(), cols, mode);
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
