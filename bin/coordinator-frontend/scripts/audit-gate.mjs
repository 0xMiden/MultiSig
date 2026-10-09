// Fails CI on any high or critical advisory in production dependencies,
// except the ones listed (with a reason) in audit-allowlist.json.
// An allowlist entry past its reviewBy date fails too, so exceptions get revisited.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const allowlist = JSON.parse(readFileSync(new URL('./audit-allowlist.json', import.meta.url), 'utf8'));
let report;
try {
  report = execFileSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8', maxBuffer: 64 << 20 });
} catch (error) {
  report = error.stdout; // npm audit exits non-zero when it finds anything
}
const { vulnerabilities = {} } = JSON.parse(report);

// Advisories appear as objects in `via`; string entries just point at another package.
const advisories = new Map();
for (const vuln of Object.values(vulnerabilities)) {
  for (const via of vuln.via) {
    if (typeof via === 'object' && ['high', 'critical'].includes(via.severity)) {
      const id = via.url.split('/').pop();
      advisories.set(id, { id, severity: via.severity, pkg: via.name, title: via.title });
    }
  }
}

const today = new Date().toISOString().slice(0, 10);
const failures = [];
for (const advisory of advisories.values()) {
  const allowed = allowlist[advisory.id];
  if (!allowed) failures.push(`${advisory.severity} ${advisory.id} ${advisory.pkg}: ${advisory.title}`);
  else if (allowed.reviewBy < today) failures.push(`allowlist entry ${advisory.id} expired on ${allowed.reviewBy}; review it`);
  else console.log(`allowed ${advisory.id} (${advisory.pkg}) until ${allowed.reviewBy}: ${allowed.reason}`);
}
for (const id of Object.keys(allowlist)) {
  if (!advisories.has(id)) console.log(`note: ${id} no longer reported; remove it from audit-allowlist.json`);
}

if (failures.length) {
  console.error(`High/critical advisories in production dependencies:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`audit gate: ${advisories.size} high/critical advisor${advisories.size === 1 ? 'y' : 'ies'}, all allowlisted`);
