/**
 * Pre-flight check: verifies all required env vars and SDK availability.
 * Exits with code 1 if any required check fails.
 *
 * Usage: node dist/ops/healthcheck.js
 */

import { isRegistered } from 'foresight-arena';
import { privateKeyToAccount } from 'viem/accounts';
import { ANTHROPIC_API_KEY, AGENT_SLUGS, DRY_RUN } from '../shared/env.js';

let ok = true;
function pass(msg: string): void { console.log(`[OK]   ${msg}`); }
function fail(msg: string): void { console.error(`[FAIL] ${msg}`); ok = false; }
function warn(msg: string): void { console.warn(`[WARN] ${msg}`); }

// Anthropic API key
if (ANTHROPIC_API_KEY) {
  pass(`ANTHROPIC_API_KEY is set (${ANTHROPIC_API_KEY.slice(0, 12)}...)`);
} else {
  fail('ANTHROPIC_API_KEY is not set');
}

// Wallet keys + on-chain registration check
for (const slug of AGENT_SLUGS) {
  const envKey = `FOREFLOW_${slug}_AGENT_KEY`;
  const key = process.env[envKey];
  if (!key) {
    if (DRY_RUN) {
      warn(`${envKey} not set — dry-run only for ${slug}`);
    } else {
      fail(`${envKey} is not set — required for live mode`);
    }
    continue;
  }
  try {
    const account = privateKeyToAccount(key as `0x${string}`);
    const registered = await isRegistered(account.address);
    if (registered) {
      pass(`FOREFLOW_${slug}_AGENT_KEY => ${account.address} (registered)`);
    } else {
      warn(`FOREFLOW_${slug}_AGENT_KEY => ${account.address} (NOT registered — run foreflow-agents-engine register-all)`);
    }
  } catch (err) {
    fail(`${envKey}: ${err}`);
  }
}

console.log('');
console.log(`Dry-run: ${DRY_RUN}`);
console.log(`Status : ${ok ? 'READY' : 'NOT READY'}`);
if (!ok) process.exit(1);
