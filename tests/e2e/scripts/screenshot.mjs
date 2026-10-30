// Native screenshots only. No generated/reconstructed UI; only opaque redaction.
import { PNG } from 'pngjs';

export function parseHierarchy(stdout) {
  const start = stdout.indexOf('{');
  if (start < 0) throw Error('Hierarchy unavailable');
  let depth = 0, quoted = false, escaped = false;
  for (let index = start; index < stdout.length; index++) {
    const char = stdout[index];
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; }
    else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) {
      const tree = JSON.parse(stdout.slice(start, index + 1));
      if (!tree.attributes || !Array.isArray(tree.children)) throw Error('Hierarchy unavailable');
      return tree;
    }
  }
  throw Error('Hierarchy unavailable');
}

function bounds(value) {
  const match = String(value || '').match(/^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/);
  return match ? match.slice(1).map(Number) : null;
}

export function authenticatedScreen(tree, appId) {
  const identifiers = [];
  const walk = node => { identifiers.push(node.attributes?.['resource-id']); for (const child of node.children || []) walk(child); };
  walk(tree);
  const contains = marker => identifiers.some(id => id === marker || id === `${appId}:id/${marker}`);
  return contains('e2e-leagues-loaded') && !contains('e2e-login-email') && !contains('e2e-login-password');
}

export function safeScreenState(tree, appId) {
  const nodes = [];
  const walk = node => { nodes.push(node); for (const child of node.children || []) walk(child); };
  walk(tree);
  const matches = (node, marker) => [marker, `${appId}:id/${marker}`].includes(node.attributes?.['resource-id']);
  const has = marker => nodes.some(node => matches(node, marker));
  const errors = nodes.filter(node => matches(node, 'e2e-auth-error'));
  // Native accessibility may put a Text node's content in a child. Inspect
  // only this designated error subtree, never neighboring credential inputs.
  const errorValues = node => [...['text', 'value', 'label', 'accessibilityText'].map(key => node.attributes?.[key]), ...(node.children || []).flatMap(errorValues)];
  const errorText = errors.flatMap(errorValues).filter(value => typeof value === 'string').join(' ');
  const categories = [['invalid-credentials', /invalid login credentials|invalid email or password\./i], ['invalid-backend-key', /invalid api key|invalid jwt/i], ['email-unconfirmed', /email not confirmed|check your inbox and confirm your email before signing in\./i], ['invalid-signup-email', /supabase rejected that signup email\./i], ['signup-email-unauthorized', /supabase is not allowed to send signup emails to that address yet\./i], ['secure-store-key', /invalid key provided to securestore/i], ['keychain-error', /no keychain is available|keychain error|(?:already exists|could not be found) in the keychain|unable to construct secaccesscontrol/i], ['session-data-invalid', /stored sign-in data is invalid/i], ['session-data-incomplete', /stored sign-in data is incomplete/i], ['session-data-too-large', /sign-in data is too large to store safely/i], ['missing-email', /email is required/i], ['missing-password', /password is required/i], ['network', /network request failed|fetch failed|timed out|unable to connect/i]];
  const authErrorCategory = !errors.length ? null : categories.find(([, pattern]) => pattern.test(errorText))?.[0] || 'other-auth-error';
  return { loginEmailPresent: has('e2e-login-email'), loginPasswordPresent: has('e2e-login-password'), submitPresent: has('e2e-login-submit'), serverLoaded: authenticatedScreen(tree, appId), leagueLoadErrorPresent: has('e2e-leagues-error'), authErrorCategory };
}

export function inspectLoginInputs(tree, appId, email, password) {
  const nodes = [];
  const walk = node => { nodes.push(node); for (const child of node.children || []) walk(child); };
  walk(tree);
  const valuesFor = field => {
    const found = nodes.filter(node => [`e2e-login-${field}`, `${appId}:id/e2e-login-${field}`].includes(node.attributes?.['resource-id']));
    if (found.length !== 1) return [];
    return ['text', 'value'].map(key => found[0].attributes?.[key]).filter(value => typeof value === 'string');
  };
  const emailMatches = !!email && valuesFor('email').some(value => value === email);
  const values = valuesFor('password');
  const exact = !!password && values.some(value => value === password);
  const masked = !!password && values.some(value => /^[\u2022\u25cf\u2219\u00b7*]+$/u.test(value));
  // A mask proves populated input, not the identity of the hidden password.
  return { emailMatches, passwordPresent: exact || masked, passwordEvidence: exact ? 'private-exact-match' : masked ? 'native-mask-nonempty' : 'empty-or-unverifiable', passed: emailMatches && (exact || masked) };
}

export function redactScreenshot(raw, trees, secrets, { showLoginInputs = false, appId } = {}) {
  if (raw.length > 32 * 1024 * 1024 || raw.length < 24 || raw.readUInt32BE(16) * raw.readUInt32BE(20) > 20000000) throw Error('Unsupported screenshot');
  const image = PNG.sync.read(raw, { checkCRC: true });
  const rectangles = [];
  const fieldsByTree = [];
  const blankets = [];
  for (const tree of trees) {
    const nodes = [];
    const walk = node => { nodes.push(node); for (const child of node.children || []) walk(child); };
    walk(tree);
    const viewports = nodes.map(node => bounds(node.attributes?.bounds)).filter(box => {
      if (!box || box[0] !== 0 || box[1] !== 0 || box[2] <= 0 || box[3] <= 0) return false;
      const scale = image.width / box[2];
      return scale >= 1 && scale <= 4 && Math.abs(scale - Math.round(scale)) < 0.005 && Math.abs(image.height / box[3] - scale) < 0.005;
    }).sort((a, b) => b[2] * b[3] - a[2] * a[3]);
    if (!viewports.length) throw Error('Cannot verify screenshot coordinates');
    const viewport = viewports[0], scaleX = image.width / viewport[2], scaleY = image.height / viewport[3];
    const fieldBoxes = new Map();
    const markerFor = node => ['email', 'password'].find(field => [
      `e2e-login-${field}`, `${appId}:id/e2e-login-${field}`,
    ].includes(node.attributes?.['resource-id']));
    const containsSecret = values => values.some(value => secrets.filter(Boolean).some(secret => value.toLowerCase().includes(secret.toLowerCase())));
    const safeField = node => {
      if (!showLoginInputs) return null;
      const field = markerFor(node);
      const attributes = node.attributes || {};
      const values = Object.values(attributes).filter(value => typeof value === 'string');
      if (!field || containsSecret(values)) return null;
      if (field === 'password') {
        const displayed = [attributes.text, attributes.value].filter(value => typeof value === 'string' && value.length);
        // Preserve native mask pixels only. A secure flag alone cannot prove
        // that the last typed character or a revealed password is hidden.
        if (!displayed.length || !displayed.every(value => /^[\u2022\u25cf\u2219\u00b7*]+$/u.test(value))) return null;
      }
      return field;
    };
    let hasInput = false;
    for (const node of nodes) {
      const attributes = node.attributes || {};
      const values = Object.values(attributes).filter(value => typeof value === 'string');
      const input = values.some(value => /e2e-login-(?:email|password)|EditText|(?:^|XCUIElementType)(?:Secure)?TextField|XCUIElementTypeTextView/i.test(value));
      const credential = containsSecret(values) || values.some(value => /[^\s@]+@[^\s@]+\.[^\s@]+/.test(value));
      const keyboard = values.some(value => /(?:^|[.$])(?:XCUIElementType)?Keyboard|keyboard_view|inputmethod/i.test(value));
      if (!input && !credential && !keyboard) continue;
      const box = bounds(attributes.bounds);
      if (!box || box[2] <= box[0] || box[3] <= box[1]) throw Error('Cannot safely redact an element');
      hasInput ||= input;
      const field = !keyboard && safeField(node);
      if (field && nodes.filter(candidate => markerFor(candidate) === field).length === 1) {
        fieldBoxes.set(field, [Math.ceil(box[0] * scaleX), Math.ceil(box[1] * scaleY), Math.floor(box[2] * scaleX), Math.floor(box[3] * scaleY)]);
        continue;
      }
      rectangles.push([Math.floor((box[0] - 4) * scaleX), Math.floor((box[1] - 4) * scaleY), Math.ceil((box[2] + 4) * scaleX), Math.ceil((box[3] + 4) * scaleY)]);
    }
    // Hide keyboard/autofill suggestions as well as the fields themselves.
    if (hasInput) blankets.push([0, Math.floor(image.height * 0.55), image.width, image.height]);
    fieldsByTree.push(fieldBoxes);
  }
  // Reveal a field only at the same verified location in both inspections.
  // Keep explicit secret/keyboard masks even where they overlap a field.
  const visible = new Map();
  for (const field of ['email', 'password']) {
    const box = fieldsByTree[0]?.get(field);
    if (trees.length >= 2 && box && fieldsByTree.every(fields => JSON.stringify(fields.get(field)) === JSON.stringify(box))) visible.set(field, box);
  }
  for (const fields of fieldsByTree) for (const [field, box] of fields) if (!visible.has(field)) rectangles.push(box);
  for (const blanket of blankets) {
    let pieces = [blanket];
    for (const hole of visible.values()) pieces = pieces.flatMap(box => {
      const [left, top, right, bottom] = [Math.max(box[0], hole[0]), Math.max(box[1], hole[1]), Math.min(box[2], hole[2]), Math.min(box[3], hole[3])];
      if (left >= right || top >= bottom) return [box];
      return [[box[0], box[1], box[2], top], [box[0], bottom, box[2], box[3]], [box[0], top, left, bottom], [right, top, box[2], bottom]].filter(piece => piece[0] < piece[2] && piece[1] < piece[3]);
    });
    rectangles.push(...pieces);
  }
  for (const [left, top, right, bottom] of rectangles) {
    for (let y = Math.max(0, top); y < Math.min(image.height, bottom); y++) {
      for (let x = Math.max(0, left); x < Math.min(image.width, right); x++) {
        const index = (y * image.width + x) * 4;
        image.data[index] = image.data[index + 1] = image.data[index + 2] = 0;
        image.data[index + 3] = 255;
      }
    }
  }
  // Re-encode pixels, discarding native image metadata and the unredacted file.
  return { png: PNG.sync.write(image), redactions: rectangles.length };
}
