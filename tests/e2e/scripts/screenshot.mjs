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

export function redactScreenshot(raw, trees, secrets) {
  if (raw.length > 32 * 1024 * 1024 || raw.length < 24 || raw.readUInt32BE(16) * raw.readUInt32BE(20) > 20000000) throw Error('Unsupported screenshot');
  const image = PNG.sync.read(raw, { checkCRC: true });
  const rectangles = [];
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
    let hasInput = false;
    for (const node of nodes) {
      const attributes = node.attributes || {};
      const values = Object.values(attributes).filter(value => typeof value === 'string');
      const input = values.some(value => /e2e-login-(?:email|password)|EditText|(?:^|XCUIElementType)(?:Secure)?TextField|XCUIElementTypeTextView/i.test(value));
      const credential = values.some(value => secrets.filter(Boolean).some(secret => value.toLowerCase().includes(secret.toLowerCase())) || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(value));
      const keyboard = values.some(value => /(?:^|[.$])(?:XCUIElementType)?Keyboard|keyboard_view|inputmethod/i.test(value));
      if (!input && !credential && !keyboard) continue;
      const box = bounds(attributes.bounds);
      if (!box || box[2] <= box[0] || box[3] <= box[1]) throw Error('Cannot safely redact an element');
      hasInput ||= input;
      rectangles.push([Math.floor((box[0] - 4) * scaleX), Math.floor((box[1] - 4) * scaleY), Math.ceil((box[2] + 4) * scaleX), Math.ceil((box[3] + 4) * scaleY)]);
    }
    // Hide keyboard/autofill suggestions as well as the fields themselves.
    if (hasInput) rectangles.push([0, Math.floor(image.height * 0.55), image.width, image.height]);
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
