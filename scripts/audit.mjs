/**
 * Catalog-level checks that per-artifact validation cannot make.
 *
 * `ways validate` proves each file is schema-valid on its own. These are the invariants that only
 * hold across the whole catalog — and the reason they matter is that `ways doctor` EXECUTES a
 * binding's `check` commands on a consumer's machine:
 *
 *   1. every Binding points at a contract this catalog actually defines (no dangling profiles);
 *   2. every `check` passes the CLI's own no-shell allowlist (`parseCheck`) — a check that is not
 *      allowlisted silently never runs, so it would be a lie dressed as validation;
 *   3. `coversOperations` only names operations its contract declares (a typo would claim coverage
 *      that does not exist);
 *   4. no two Bindings claim the same `{contract, impl}` — that pair is a Binding's identity.
 */

import { loadCatalog, parseCheck } from '@incu/ways';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { contracts, bindings } = loadCatalog(root, 'ways.dev');
const problems = [];

if (contracts.length === 0) problems.push('no contracts found — is the catalog layout intact?');

const byRef = new Map(contracts.map((c) => [c.ref, c]));

for (const b of bindings) {
  const where = `{${b.contract}, ${b.impl}}`;
  const contract = byRef.get(b.contract);
  if (!contract) {
    problems.push(`${where}: contract not defined in this catalog`);
    continue;
  }
  const declared = contract.operations.map((o) => o.name);
  for (const op of b.coversOperations ?? []) {
    if (!declared.includes(op)) {
      problems.push(`${where}: coversOperations names "${op}", which ${b.contract} does not declare`);
    }
  }
  for (const req of [...(b.requires?.cli ?? []), ...(b.requires?.env ?? [])]) {
    if (req.check && !parseCheck(req.check)) {
      problems.push(`${where}: check "${req.check}" is not allowlisted (no shell) — it would never run`);
    }
  }
}

const pairs = new Map();
for (const b of bindings) {
  const key = `${b.contract} ${b.impl}`;
  if (pairs.has(key)) problems.push(`duplicate Binding identity {${b.contract}, ${b.impl}}`);
  pairs.set(key, true);
}

// Report
for (const c of contracts.sort((a, b) => a.ref.localeCompare(b.ref))) {
  const ops = c.operations.map((o) => o.name);
  const impls = bindings.filter((b) => b.contract === c.ref);
  const rendered = impls
    .map((b) => {
      const missing = ops.filter((o) => !(b.coversOperations ?? []).includes(o));
      return b.impl + (missing.length ? ` (missing: ${missing.join(', ')})` : '');
    })
    .sort()
    .join(', ');
  console.log(`${c.ref}  ${ops.length} operation(s)`);
  console.log(`   ${rendered || '⚠ no binding — nothing can satisfy this contract yet'}`);
  console.log(`   ${relative(root, c.path)}`);
}
console.log(`\n${contracts.length} contract(s) · ${bindings.length} binding(s)`);

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('✓ catalog is coherent');
