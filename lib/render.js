'use strict';
const { windowView, fmtDuration } = require('./common');

// Paleta tomada del config de herdr (tema oscuro tipo Tokyo Night).
const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `\x1b[38;2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m`;
};
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  fill: rgb('#7aa2f7'), // azul de la barra
  warn: rgb('#c78a1f'), // ambar: queda poco
  crit: rgb('#c04a4a'), // rojo: casi sin cupo
  track: rgb('#414868'), // fondo de la barra
  text: rgb('#e9e9f0'),
  label: rgb('#a8abbd'),
  muted: rgb('#8b8e9c'),
};

const visibleLen = (s) => s.replace(/\x1b\[[0-9;]*m/g, '').length;
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - visibleLen(s)));

// El color depende de cuanto queda, sin importar si se muestra usado o libre.
function fillColor(leftPct) {
  if (leftPct < 10) return C.crit;
  if (leftPct < 25) return C.warn;
  return C.fill;
}

// mode 'used' (default): barra y % = lo consumido. mode 'left': lo disponible.
function bar(shownPct, leftPct, width) {
  const filled = Math.round((shownPct / 100) * width);
  return fillColor(leftPct) + '█'.repeat(filled) + C.track + '█'.repeat(width - filled) + C.reset;
}

// Una celda: "5h ████░░ 38%  2h13m". Sin dato: barra vacia.
function cell(label, win, barWidth, mode, nowSec) {
  const head = `${C.label}${label}${C.reset}`;
  const v = windowView(win, nowSec);
  if (!v) return `${head} ${C.track}${'█'.repeat(barWidth)}${C.reset} ${C.muted}--${C.reset}`;
  const left = 100 - v.usedPct;
  const shown = mode === 'left' ? left : v.usedPct;
  const pct = `${Math.round(shown)}%`.padStart(4);
  const reset = (v.expired ? '-' : fmtDuration(v.resetsAt - nowSec)).padEnd(6);
  return `${head} ${bar(shown, left, barWidth)} ${C.text}${pct}${C.reset}  ${C.muted}${reset}${C.reset}`;
}

// usage = { claude, codex } con { primary, secondary, updatedAt } o null.
function render(usage, cols, mode = 'used', nowSec = Date.now() / 1000) {
  const rows = [
    ['Claude', usage.claude],
    ['Codex', usage.codex],
  ];
  const stale = rows
    .filter(([, u]) => u && u.updatedAt && nowSec - u.updatedAt >= 300)
    .map(([name, u]) => `${name.toLowerCase()} ${fmtDuration(nowSec - u.updatedAt)}`);
  const staleNote = stale.length ? ` ${C.muted}· dato de hace ${stale.join(', ')}${C.reset}` : '';
  const what = mode === 'left' ? 'disponible' : 'consumido';
  const lines = [`${C.bold}${C.label}Uso${C.reset} ${C.muted}${what}${C.reset}${staleNote}`];
  const name = (n) => `${C.bold}${C.text}${n}${C.reset}`;

  // Modo ancho: un proveedor por fila con las dos ventanas lado a lado.
  const cellW = Math.floor((cols - 11) / 2);
  const barW = Math.min(20, cellW - 17);
  if (barW >= 6) {
    for (const [n, u] of rows) {
      const head = pad(name(n), 7);
      if (!u) {
        lines.push(`${head} ${C.muted}sin datos${C.reset}`);
        continue;
      }
      const a = pad(cell('5h', u.primary, barW, mode, nowSec), cellW);
      const b = cell('7d', u.secondary, barW, mode, nowSec);
      lines.push(`${head} ${a}  ${b}`);
    }
    return lines;
  }

  // Modo angosto: una ventana por fila.
  const nb = Math.max(4, Math.min(16, cols - 24));
  for (const [n, u] of rows) {
    if (!u) {
      lines.push(`${name(n)} ${C.muted}sin datos${C.reset}`);
      continue;
    }
    lines.push(name(n));
    lines.push(' ' + cell('5h', u.primary, nb, mode, nowSec));
    lines.push(' ' + cell('7d', u.secondary, nb, mode, nowSec));
  }
  return lines;
}

module.exports = { render };
