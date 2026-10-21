'use strict';
const { spawnSync } = require('child_process');

// Contexto de este pane segun herdr: { sessionId, rows } o null.
//  - sessionId: la sesion de Claude que corre en la misma pestana, para mostrar la
//    conversacion de esta pestana y no la que escribio ultimo.
//  - rows: alto real en filas. process.stdout.rows no sigue los resizes de herdr, asi
//    que sirve solo como valor inicial.
function ownPaneContext() {
  const r = spawnSync('herdr', ['pane', 'list'], { encoding: 'utf8', windowsHide: true, timeout: 2000 });
  let panes;
  try {
    panes = JSON.parse(r.stdout).result.panes;
  } catch {
    return null;
  }
  const me = panes.find((p) => p.pane_id === process.env.HERDR_PANE_ID);
  const tabId = process.env.HERDR_TAB_ID || (me && me.tab_id);
  const claude = tabId && panes.find((p) => p.tab_id === tabId && p.agent === 'claude' && p.agent_session);
  return {
    sessionId: claude ? claude.agent_session.value : null,
    rows: me && me.scroll ? me.scroll.viewport_rows : null,
  };
}

// Ajusta el alto del pane a `rows` filas de contenido (el rect incluye 2 de borde).
// El resize de herdr es un delta del ratio del split, no de filas; se apunta al ratio
// exacto (no a "una fila mas") porque el redondeo de filas hace saltar de a dos.
function fitPaneRows(paneId, rows) {
  const run = (args) => spawnSync('herdr', args, { encoding: 'utf8', windowsHide: true, timeout: 2000 });
  for (let i = 0; i < 4; i++) {
    let layout;
    try {
      layout = JSON.parse(run(['pane', 'layout', '--pane', paneId]).stdout).result.layout;
    } catch {
      return;
    }
    const pane = layout.panes.find((p) => p.pane_id === paneId);
    if (!pane || pane.rect.height === rows + 2) return;
    // Split vertical mas cercano que termina donde termina el pane.
    const bottom = pane.rect.y + pane.rect.height;
    const split = layout.splits
      .filter((s) => s.direction === 'down' && s.rect.y + s.rect.height === bottom)
      .sort((x, y) => x.rect.height - y.rect.height)[0];
    if (!split) return;
    const delta = (split.rect.height - (rows + 2)) / split.rect.height - split.ratio;
    // delta > 0: el divisor baja y el pane se achica; delta < 0: sube y crece.
    run(['pane', 'resize', '--direction', delta > 0 ? 'down' : 'up', '--amount', String(Math.abs(delta)),
      '--pane', paneId]);
  }
}

module.exports = { ownPaneContext, fitPaneRows };
