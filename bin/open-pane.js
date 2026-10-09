'use strict';
// Interruptor del pane "usage": si ya hay uno en la pestana actual lo cierra,
// si no lo abre como split inferior, sin robar el foco, y lo achica a una barra
// baja (herdr no deja fijar el alto al abrir un split).
const { spawnSync } = require('child_process');

const PLUGIN = 'herdr-usage-pane';

function herdr(args) {
  return spawnSync('herdr', args, { encoding: 'utf8', windowsHide: true });
}

function json(r) {
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

// Pane de referencia: el que invoca, o el que tiene el foco en la UI.
function targetPane(panes) {
  if (process.env.HERDR_PANE_ID) return panes.find((p) => p.pane_id === process.env.HERDR_PANE_ID);
  return panes.find((p) => p.focused);
}

const listed = json(herdr(['pane', 'list']));
const panes = (listed && listed.result && listed.result.panes) || [];
const target = targetPane(panes);

const existing = target
  ? panes.filter((p) => p.label === 'Usage' && p.tab_id === target.tab_id)
  : [];
if (existing.length) {
  for (const p of existing) herdr(['pane', 'close', p.pane_id]);
  process.exit(0);
}

const args = [
  'plugin', 'pane', 'open',
  '--plugin', PLUGIN,
  '--entrypoint', 'usage',
  '--placement', 'split',
  '--direction', 'down',
  '--no-focus',
];
if (target) args.push('--target-pane', target.pane_id);

const r = herdr(args);
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
if (r.status !== 0) process.exit(r.status ?? 1);

const opened = json(r);
const paneId = opened && opened.result.plugin_pane.pane.pane_id;
if (paneId) herdr(['pane', 'resize', '--direction', 'down', '--amount', '0.45', '--pane', paneId]);
