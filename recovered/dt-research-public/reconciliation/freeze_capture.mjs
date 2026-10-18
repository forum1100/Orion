#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [,, inputPath, outputPath = 'capture_freeze_manifest.json'] = process.argv;
if (!inputPath) {
  console.error('Usage: node freeze_capture.mjs <file-or-directory> [manifest.json]');
  process.exit(2);
}

const sha256 = file => {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(file));
  return h.digest('hex');
};

function filesUnder(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [path.resolve(target)];
  const out = [];
  for (const entry of fs.readdirSync(target, {withFileTypes: true})) {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(child));
    else if (entry.isFile()) out.push(path.resolve(child));
  }
  return out.sort();
}
const root = path.resolve(inputPath);
const files = filesUnder(root).filter(f => path.resolve(f) !== path.resolve(outputPath));
const records = files.map(file => ({
  path: path.relative(path.dirname(root), file).replaceAll('\\', '/'),
  size_bytes: fs.statSync(file).size,
  sha256: sha256(file)
}));

const manifest = {
  schema: 'dt.capture.freeze.v1',
  frozen_at: new Date().toISOString(),
  input: root,
  file_count: records.length,
  total_bytes: records.reduce((n, r) => n + r.size_bytes, 0),
  files: records
};

const stablePayload = JSON.stringify({
  schema: manifest.schema,
  file_count: manifest.file_count,
  total_bytes: manifest.total_bytes,
  files: manifest.files
});
manifest.inventory_sha256 = crypto.createHash('sha256').update(stablePayload).digest('hex');

fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({
  file_count: manifest.file_count,
  total_bytes: manifest.total_bytes,
  inventory_sha256: manifest.inventory_sha256,
  manifest: outputPath
}, null, 2));