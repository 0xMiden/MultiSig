// Generates the eval-free protobuf codec the History page uses (`src/lib/history/proto/miden_node.js`
// + `.d.ts`) from the node's JSON descriptor, keeping only the messages reachable from the calls
// the page makes. See `src/lib/history/proto/README.md`.
//
// Why static code: protobufjs's reflection runtime (`Root.fromJSON`) builds encoders and decoders
// with `new Function(...)`, which the console's production CSP (no 'unsafe-eval') forbids.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const protoDir = join(here, '..', 'src', 'lib', 'history', 'proto');
const descriptor = JSON.parse(readFileSync(join(protoDir, 'miden_node.json'), 'utf8'));

/** The messages `nodeRpc.ts` encodes or decodes; everything they reference is kept. */
const ROOTS = [
  'miden.node.v1.StatusRequest',
  'miden.node.v1.StatusResponse',
  'miden.node.v1.SyncTransactionsRequest',
  'miden.node.v1.SyncTransactionsResponse',
];
const SCALARS = new Set([
  'double', 'float', 'int32', 'int64', 'uint32', 'uint64', 'sint32', 'sint64',
  'fixed32', 'fixed64', 'sfixed32', 'sfixed64', 'bool', 'string', 'bytes',
]);

// Index every message and enum by its fully qualified name.
const byName = new Map();
function index(ns, path) {
  for (const [name, entry] of Object.entries(ns.nested ?? {})) {
    const full = [...path, name];
    if (entry.fields || entry.values) byName.set(full.join('.'), { entry, path: full });
    index(entry, full);
  }
}
index(descriptor, []);

// protobufjs resolves a relative type name by walking up from the referencing scope.
function resolve(typeName, scope) {
  for (let depth = scope.length; depth >= 0; depth--) {
    const candidate = [...scope.slice(0, depth), typeName].join('.');
    if (byName.has(candidate)) return candidate;
  }
  throw new Error(`cannot resolve ${typeName} from ${scope.join('.')}`);
}

const keep = new Set();
const queue = [...ROOTS];
while (queue.length) {
  const name = queue.shift();
  if (keep.has(name)) continue;
  if (!byName.has(name)) throw new Error(`unknown root ${name}`);
  keep.add(name);
  const { entry, path } = byName.get(name);
  for (const field of Object.values(entry.fields ?? {})) {
    for (const t of [field.type, field.keyType]) {
      if (t && !SCALARS.has(t)) queue.push(resolve(t, path));
    }
  }
}

// Rebuild the descriptor with only the kept entries and the namespaces that lead to them.
function prune(ns, path) {
  const nested = {};
  for (const [name, entry] of Object.entries(ns.nested ?? {})) {
    const full = [...path, name];
    const isType = entry.fields || entry.values;
    const inner = prune(entry, full);
    if (keep.has(full.join('.'))) {
      const copy = { ...entry };
      if (inner) copy.nested = inner.nested; else delete copy.nested;
      nested[name] = copy;
    } else if (!isType && inner) {
      nested[name] = { ...entry, nested: inner.nested };
    }
  }
  return Object.keys(nested).length ? { nested } : null;
}
const pruned = prune(descriptor, []) ?? { nested: {} };

const tmp = mkdtempSync(join(tmpdir(), 'history-proto-'));
try {
  const prunedPath = join(tmp, 'pruned.json');
  writeFileSync(prunedPath, JSON.stringify(pruned));
  const js = join(protoDir, 'miden_node.js');
  const dts = join(protoDir, 'miden_node.d.ts');
  const bin = join(here, '..', 'node_modules', '.bin');
  execFileSync(join(bin, 'pbjs'), [
    '-t', 'static-module', '-w', 'es6', '--no-service', '--no-verify', '--no-delimited', '-o', js, prunedPath,
  ], { stdio: 'inherit' });
  execFileSync(join(bin, 'pbts'), ['-o', dts, js], { stdio: 'inherit' });
  console.log(`kept ${keep.size} types -> ${js}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
