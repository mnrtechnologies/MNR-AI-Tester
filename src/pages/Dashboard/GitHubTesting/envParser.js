/**
 * envParser.js — turn a pasted .env file into {KEY: value}.
 *
 * Written because entering variables one field at a time is unusable for a
 * real .env: they routinely run to a dozen-plus entries, and people already
 * have the file — they should be able to paste it whole.
 *
 * Follows dotenv's actual behaviour, which has several traps worth naming:
 *   - Split on the FIRST "=" only. Values legitimately contain "=" (a Mongo
 *     URI ends "?retryWrites=true&w=majority"), and splitting on every "="
 *     mangles exactly the connection strings people most need to paste.
 *   - Strip inline comments (`LLM_PROVIDER=openai   # "openai" or ...`) only
 *     when the "#" follows whitespace and the value is unquoted. A bare "#"
 *     inside a value — a URL fragment, a password containing "#" — must
 *     survive, or credentials get silently truncated.
 *   - Honour surrounding quotes and strip them, keeping everything inside
 *     verbatim, comments included.
 *   - Tolerate a leading `export `, which many exported .env files carry.
 */

/** Values that look like secrets start hidden in the editor. */
const SECRET_HINT = /(KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL|AUTH|URI|DSN|CONN)/i;

/** Whether a variable name suggests its value is sensitive. */
export function isSecretKey(key) {
  return SECRET_HINT.test(key || '');
}

export function parseEnvFile(text) {
  const out = {};
  if (!text) return out;

  for (const rawLine of String(text).split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;      // blank or full-line comment
    if (line.startsWith('export ')) line = line.slice(7).trim();

    const eq = line.indexOf('=');
    if (eq <= 0) continue;                            // no key, or "=value"

    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(key)) continue;  // not a plausible env name

    let value = line.slice(eq + 1).trim();

    const quoted =
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1);

    if (quoted) {
      value = value.slice(1, -1);
    } else {
      // Inline comment only when "#" is preceded by whitespace — so a "#"
      // that is part of the value itself is preserved.
      const hash = value.search(/\s#/);
      if (hash !== -1) value = value.slice(0, hash);
      value = value.trim();
    }

    out[key] = value;
  }

  return out;
}

/** Short, safe rendering of a value for the confirmation list. */
export function maskValue(key, value) {
  if (!value) return '(empty)';
  if (!SECRET_HINT.test(key)) {
    return value.length > 42 ? `${value.slice(0, 42)}…` : value;
  }
  if (value.length <= 8) return '•'.repeat(value.length);
  return `${value.slice(0, 4)}${'•'.repeat(8)}${value.slice(-4)}`;
}
