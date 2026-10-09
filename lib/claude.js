'use strict';
const path = require('path');
const { DATA_DIR, readJson } = require('./common');

const CLAUDE_FILE = path.join(DATA_DIR, 'claude.json');

// Lo escribe bin/claude-statusline.js; { five_hour, seven_day, updatedAt }.
function readClaudeUsage() {
  const d = readJson(CLAUDE_FILE);
  if (!d) return null;
  return {
    primary: d.five_hour || null,
    secondary: d.seven_day || null,
    updatedAt: d.updatedAt || null,
  };
}

module.exports = { CLAUDE_FILE, readClaudeUsage };
