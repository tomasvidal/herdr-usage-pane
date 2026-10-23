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
  ok: rgb('#9ece6a'), // verde: el reset esta por llegar
  track: rgb('#414868'), // fondo de la barra
  text: rgb('#e9e9f0'),
  label: rgb('#a8abbd'),
  muted: rgb('#8b8e9c'),
};

const WINDOW_SEC = { '5h': 5 * 3600, '7d': 7 * 86400 };
const RESET_SOON_SEC = 15 * 60;

const visibleLen = (s) => s.replace(/\x1b\[[0-9;]*m/g, '').length;
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - visibleLen(s)));

// El color depende de cuanto queda, sin importar si se muestra usado o libre.
function fillColor(leftPct) {
  if (leftPct < 10) return C.crit;
  if (leftPct < 25) return C.warn;
  return C.fill;
}

// Estetica de las barras: [parte llena, parte vacia]. Se elige con `bar` en config.json
// (node bin/usage.js --bar <nombre>); la vacia va siempre en el color apagado.
const BAR_STYLES = {
  blocks: ['█', '█'],
  line: ['━', '─'],
  dashes: ['━', '╌'],
  dots: ['●', '·'],
  segments: ['▰', '▱'],
  shade: ['█', '░'],
  ascii: ['=', '-'],
};
let barStyle = BAR_STYLES.blocks;

// mode 'used' (default): barra y % = lo consumido. mode 'left': lo disponible.
function bar(shownPct, leftPct, width) {
  const filled = Math.round((shownPct / 100) * width);
  const [on, off] = barStyle;
  return fillColor(leftPct) + on.repeat(filled) + C.track + off.repeat(width - filled) + C.reset;
}

// Puntos porcentuales de diferencia contra un consumo parejo a lo largo de la ventana.
// Positivo = vas adelantado y te quedas sin cupo antes del reset.
function paceDiff(v, lenSec, nowSec) {
  if (v.expired || v.resetsAt == null) return null;
  const elapsed = lenSec - (v.resetsAt - nowSec);
  if (elapsed <= 0) return null;
  const ideal = Math.min(100, (elapsed / lenSec) * 100);
  return v.usedPct - ideal;
}

function paceText(diff) {
  if (diff == null) return ''.padEnd(4);
  const n = Math.round(diff);
  const color = diff > 25 ? C.crit : diff > 10 ? C.warn : C.muted;
  return `${color}${(n >= 0 ? '+' : '-') + Math.abs(n)}`.padEnd(4 + color.length) + C.reset;
}

// Una celda: "5h ████░░ 38%  2h13m +8". Sin dato: barra vacia.
function cell(label, win, barWidth, mode, nowSec) {
  const head = `${C.label}${label}${C.reset}`;
  const v = windowView(win, nowSec);
  if (!v) return `${head} ${C.track}${barStyle[1].repeat(barWidth)}${C.reset} ${C.muted}--${C.reset}`;
  const left = 100 - v.usedPct;
  const shown = mode === 'left' ? left : v.usedPct;
  const pct = `${Math.round(shown)}%`.padStart(4);
  const remaining = v.resetsAt - nowSec;
  const soon = !v.expired && remaining < RESET_SOON_SEC;
  const resetColor = soon ? C.bold + C.ok : C.muted;
  const reset = (v.expired ? '-' : fmtDuration(remaining)).padEnd(6);
  const pace = paceText(paceDiff(v, WINDOW_SEC[label], nowSec));
  return `${head} ${bar(shown, left, barWidth)} ${C.text}${pct}${C.reset}  ${resetColor}${reset}${C.reset} ${pace}`;
}

const fmtTokens = (n) => {
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
};

// "████░░░░ 45k/200k 23%" del contexto de una sesion; sin tamano solo los tokens.
function contextView(ctx, barWidth) {
  if (!ctx || typeof ctx.tokens !== 'number') return `${C.muted}sin dato${C.reset}`;
  if (!ctx.size) return `${C.text}${fmtTokens(ctx.tokens)}${C.reset}`;
  const pct = Math.min(100, (ctx.tokens / ctx.size) * 100);
  const amount = `${fmtTokens(ctx.tokens)}/${fmtTokens(ctx.size)}`;
  return `${bar(pct, 100 - pct, barWidth)} ${C.text}${amount}${C.reset} ${C.muted}${Math.round(pct)}%${C.reset}`;
}

// "Sonnet 5.5  contexto ████ 98k/1M 10%" de la conversacion que se muestra (la primera).
function sessionText(sessions, barW) {
  const s = sessions && sessions[0];
  if (!s) return '';
  return `${C.text}${s.model || '--'}${C.reset}  ${C.label}contexto${C.reset} ${contextView(s.context, barW)}`;
}

// usage = { claude, codex } con { primary, secondary, sessions, updatedAt } o null.
// opts.bar: nombre de BAR_STYLES. Sin titulo (el pane ya se llama Usage): Claude, Codex
// y, al final, el modelo y el contexto de la conversacion.
function render(usage, cols, mode = 'used', nowSec = Date.now() / 1000, opts = {}) {
  barStyle = BAR_STYLES[opts.bar] || BAR_STYLES.blocks;
  const rows = [
    ['Claude', usage.claude],
    ['Codex', usage.codex],
  ];
  const name = (n) => `${C.bold}${C.text}${n}${C.reset}`;
  const sessions = usage.claude && usage.claude.sessions;
  const sessionRow = sessions && sessions.length
    ? [`${pad(name('Sesion'), 7)} ${sessionText(sessions, Math.max(4, Math.min(20, cols - 40)))}`]
    : usage.claude && usage.claude.noSession
      ? [`${pad(name('Sesion'), 7)} ${C.muted}sin Claude en esta pestaña${C.reset}`]
      : [];
  const lines = [];

  // Modo ancho: un proveedor por fila con las dos ventanas lado a lado.
  const cellW = Math.floor((cols - 11) / 2);
  const barW = Math.min(20, cellW - 22);
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
    return lines.concat(sessionRow);
  }

  // Modo angosto: una ventana por fila.
  const nb = Math.max(4, Math.min(16, cols - 30));
  for (const [n, u] of rows) {
    if (!u) {
      lines.push(`${name(n)} ${C.muted}sin datos${C.reset}`);
      continue;
    }
    lines.push(name(n));
    lines.push(' ' + cell('5h', u.primary, nb, mode, nowSec));
    lines.push(' ' + cell('7d', u.secondary, nb, mode, nowSec));
  }
  return lines.concat(sessionRow);
}

module.exports = { render, BAR_STYLES };
