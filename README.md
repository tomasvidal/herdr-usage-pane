# herdr-usage-pane

Plugin de [herdr](https://herdr.dev) que muestra en un pane cuánto llevás consumido de **Claude** y de **Codex**, en la ventana de **5 horas** y en la **semanal**, con el tiempo que falta para que se reinicie cada una, y qué tan adelantado o atrasado venís respecto de un consumo parejo. Abajo muestra el modelo y los tokens de contexto de la conversación de Claude de esa pestaña.

```
Claude  5h ━━━━━━━╌╌╌╌╌╌╌  47%  2h44m  +2     7d ━━━━╌╌╌╌╌╌╌╌╌╌  29%  1d18h  -46
Codex   5h ╌╌╌╌╌╌╌╌╌╌╌╌╌╌   0%  -             7d ╌╌╌╌╌╌╌╌╌╌╌╌╌╌   0%  5d17h  -18
Sesion  Sonnet 5.5  contexto ━━━╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ 149k/1M 15%
```

No consume tokens ni hace llamadas a ninguna API: lee datos que Claude y Codex ya guardan en tu máquina. Tampoco envía nada a ningún lado.

## Requisitos

- [herdr](https://herdr.dev) 0.9.0 o superior.
- [Node.js](https://nodejs.org) (probado con la 24) disponible en el `PATH`.
- Claude Code y/o Codex CLI, con un plan que tenga límites por ventana (Pro/Max en Claude, ChatGPT en Codex).
- Probado en Windows 11. En macOS y Linux debería andar, pero no lo probé.

## Instalación

1. Instalá el plugin:

   ```
   herdr plugin install tomasvidal/herdr-usage-pane
   ```

2. Conectá Claude. Esto agrega un `statusLine` a `~/.claude/settings.json`:

   ```
   herdr plugin action invoke setup-claude --plugin herdr-usage-pane
   ```

   - Hace un backup en `~/.claude/settings.json.bak-usage-pane`.
   - Si ya tenías un `statusLine`, se conserva y se sigue mostrando.
   - Copia el script a `~/.herdr-usage/statusline/` para que siga funcionando aunque se actualice el plugin.
   - Para deshacerlo: `herdr plugin action invoke unsetup-claude --plugin herdr-usage-pane`.

   Codex no necesita configuración.

3. Agregá un atajo a tu `config.toml` de herdr (en Windows: `%APPDATA%\herdr\config.toml`) y recargá con `herdr server reload-config`:

   ```toml
   [[keys.command]]
   key = "prefix+u"
   type = "plugin_action"
   command = "herdr-usage-pane.open"
   ```

   Podés cambiar `prefix+u` por la combinación que prefieras. Verificá que no choque con otra con `herdr config check`.

## Uso

Con el atajo (`Ctrl+B` y después `u`, si no cambiaste el prefix) se abre el pane en la pestaña actual, abajo y de 3 filas, sin robar el foco. Si lo apretás de nuevo, se cierra.

Sin atajo: `herdr plugin action invoke open --plugin herdr-usage-pane`.

Para tenerlo en varios workspaces hay que abrirlo en cada uno.

## De dónde salen los datos

- **Claude:** Claude Code le pasa sus límites (`rate_limits.five_hour` y `rate_limits.seven_day`) al `statusLine`. `bin/claude-statusline.js` los guarda en `~/.herdr-usage/claude.json`. Se actualiza mientras haya una sesión de Claude activa, y recién después de su primera respuesta. Si no tenés ninguna sesión abierta, se ve el último valor guardado.
- **Codex:** cada sesión guarda eventos `token_count` con `rate_limits` en `~/.codex/sessions/`. El pane lee el último evento con valores.
- Si una ventana ya se reinició, muestra 0 % y un `-` en lugar del tiempo.
- **Ritmo:** el `+N` / `-N` junto a cada ventana son los puntos porcentuales de diferencia contra un consumo parejo a lo largo de la ventana. Positivo es ir adelantado: ámbar si pasa de 10 y rojo si pasa de 25. Cuando faltan menos de 15 minutos para el reset, el tiempo se pone verde.
- **Sesión:** el `statusLine` también guarda, por sesión de Claude, el modelo y los tokens de contexto (`context_window`). El pane le pregunta a herdr qué sesión corre en su pestaña y muestra esa; si no la encuentra, muestra la que escribió último. La barra de contexto usa los mismos colores de aviso que las ventanas.
- Los números son lo **consumido**, igual que el `/usage` de Claude. La barra pasa a ámbar cuando queda menos de 25 % y a rojo cuando queda menos de 10 %.

## Opciones

Se configuran con variables de entorno:

| Variable | Efecto |
| --- | --- |
| `HERDR_USAGE_MODE=left` | Muestra lo disponible en vez de lo consumido |
| `HERDR_USAGE_BAR` | Estilo de las barras (pisa el de `config.json`) |
| `HERDR_USAGE_INTERVAL_MS` | Cada cuánto se refresca (default 5000) |
| `HERDR_USAGE_DIR` | Dónde se guarda el dato de Claude (default `~/.herdr-usage`) |
| `CODEX_HOME` | Carpeta de Codex (default `~/.codex`) |

### Estética de las barras

`node bin/usage.js --styles` muestra los estilos disponibles: `blocks`, `line`, `dashes`, `dots`, `segments`, `shade` y `ascii`. Para elegir uno:

```
node bin/usage.js --bar dashes
```

Se guarda en `~/.herdr-usage/config.json` y se aplica en vivo, sin reabrir el pane. También se puede forzar con la variable `HERDR_USAGE_BAR`.

Para probar sin herdr: `node bin/usage.js --once`.

## Límites conocidos

- Los datos de Claude vienen de un campo del statusline que puede cambiar entre versiones de Claude Code.
- Los límites de Codex salen de archivos de sesión que no son una API documentada, así que también podrían cambiar.
- herdr no permite fijar el alto de un split al abrirlo: `bin/open-pane.js` lo achica después con `pane resize` hasta dejarlo en 3 filas.
- `process.stdout.rows` no sigue los resizes del pane, así que el alto real se lee de `herdr pane list`.
- Con `HERDR_USAGE_MODE=left` no hay ningún texto que aclare que se muestra lo disponible.
- No hay forma de agregar un panel propio al sidebar de herdr desde un plugin.

## Desinstalar

```
herdr plugin action invoke unsetup-claude --plugin herdr-usage-pane
herdr plugin uninstall tomasvidal/herdr-usage-pane
```

Después borrá el bloque `[[keys.command]]` de tu `config.toml` y, si querés, la carpeta `~/.herdr-usage`.

## Licencia

MIT.
