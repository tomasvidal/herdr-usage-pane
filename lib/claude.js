'use strict';
const path = require('path');
const { DATA_DIR, readJson } = require('./common');

const CLAUDE_FILE = path.join(DATA_DIR, 'claude.json');

// Lo escribe bin/claude-statusline.js; { five_hour, seven_day, sessions: { [id]: {...} }, updatedAt }.
function readClaudeUsage() {
  const d = readJson(CLAUDE_FILE);
  if (!d) return null;
  return {
    primary: d.five_hour || null,
    secondary: d.seven_day || null,
    sessions: Object.entries(d.sessions || {})
      .map(([id, s]) => ({ ...s, id }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    updatedAt: d.updatedAt || null,
  };
}

module.exports = { CLAUDE_FILE, readClaudeUsage };
