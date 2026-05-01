/**
 * Print address and MATIC balance for each foreflow agent wallet.
 * Missing keys are reported as (not set) rather than throwing.
 *
 * Usage: node dist/ops/check_wallets.js
 */

import { createPublicClient, http, formatUnits } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { AGENT_SLUGS } from '../shared/env.js';

// Uses Polygon mainnet for balance checks; Amoy has no faucet balance to show.
const client = createPublicClient({ chain: polygon, transport: http() });

console.log(`Chain   : Polygon mainnet (balance check)`);
console.log('');

for (const slug of AGENT_SLUGS) {
  const envKey = `FOREFLOW_${slug}_AGENT_KEY`;
  const privateKey = process.env[envKey];
  if (!privateKey) {
    console.log(`${slug.padEnd(14)} (${envKey} not set)`);
    continue;
  }
  try {
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const balance = await client.getBalance({ address: account.address });
    const maticStr = parseFloat(formatUnits(balance, 18)).toFixed(4);
    console.log(`${slug.padEnd(14)} ${account.address}  ${maticStr} MATIC`);
  } catch (err) {
    console.error(`${slug.padEnd(14)} ERROR: ${err}`);
    process.exitCode = 1;
  }
}
