// Never replace an existing drive or remove a mapping owned by someone else.
export function chooseBuildDrive(used) {
  return ['X:', 'Y:', 'Z:', 'R:', 'Q:'].find(drive => !used.has(drive)) || null;
}

export function parseMappings(output) {
  const mappings = new Map();
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z]):\\:\s*=>\s*(.+?)\s*$/i);
    if (match) mappings.set(`${match[1].toUpperCase()}:`, match[2].replaceAll('/', '\\').replace(/\\+$/, '').toLowerCase());
  }
  return mappings;
}
