'use strict';
// node bin/setup-claude.js [--uninstall]
// Configura (o deshace) el statusLine de Claude Code en ~/.claude/settings.json.
//
// El script del statusLine se copia a ~/.herdr-usage/statusline/ y settings.json
// apunta ahi: la carpeta del plugin puede cambiar al actualizarlo, esa no.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DATA_DIR, readJson, writeJsonAtomic } = require('../lib/common');

const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const CONFIG = path.join(DATA_DIR, 'config.json');
const STABLE = path.join(DATA_DIR, 'statusline');
const stableScript = path.join(STABLE, 'bin', 'claude-statusline.js').replace(/\\/g, '/');
const command = `node "${stableScript}"`;

// Reconoce un statusLine nuestro aunque apunte a otra carpeta (version anterior).
const isOurs = (cmd) => typeof cmd === 'string' && cmd.includes('claude-statusline.js');

function installStableCopy() {
  const root = path.resolve(__dirname, '..');
  const files = ['bin/claude-statusline.js', 'lib/common.js', 'lib/claude.js'];
  for (const f of files) {
    const dest = path.join(STABLE, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(root, f), dest);
  }
}

const settings = readJson(SETTINGS, null);
if (settings === null && fs.existsSync(SETTINGS)) {
  console.error(`No pude parsear ${SETTINGS}; no toco nada.`);
  process.exit(1);
}
const current = settings || {};
const config = readJson(CONFIG, {});
const currentCmd = current.statusLine && current.statusLine.command;

if (process.argv.includes('--uninstall')) {
  if (isOurs(currentCmd)) {
    if (config.previous) current.statusLine = { type: 'command', command: config.previous };
    else delete current.statusLine;
    fs.writeFileSync(SETTINGS, JSON.stringify(current, null, 2) + '\n');
    writeJsonAtomic(CONFIG, { ...config, previous: null });
    fs.rmSync(STABLE, { recursive: true, force: true });
    console.log('statusLine restaurado.');
  } else {
    console.log('El statusLine actual no es el de herdr-usage-pane; no toco nada.');
  }
  process.exit(0);
}

installStableCopy();

if (currentCmd === command) {
  console.log('Ya estaba configurado (copia del script actualizada).');
  process.exit(0);
}

// Un statusLine ajeno se conserva y se sigue mostrando junto al nuestro.
if (currentCmd && !isOurs(currentCmd)) {
  writeJsonAtomic(CONFIG, { ...config, previous: currentCmd });
  console.log(`Statusline previo conservado: ${currentCmd}`);
}

// El backup se hace una sola vez: conserva el settings.json original.
const backup = `${SETTINGS}.bak-usage-pane`;
if (fs.existsSync(SETTINGS) && !fs.existsSync(backup)) fs.copyFileSync(SETTINGS, backup);
current.statusLine = { type: 'command', command };
fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
fs.writeFileSync(SETTINGS, JSON.stringify(current, null, 2) + '\n');
console.log(`statusLine configurado en ${SETTINGS}`);
console.log('Los datos de Claude aparecen despues de la primera respuesta de una sesion.');
