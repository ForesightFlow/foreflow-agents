import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateKeyToAccount } from 'viem/accounts';

// Dev convenience: load .env from repo root if present.
// In production, set env vars directly (Docker, systemd, etc.).
const rootDir = join(fileURLToPath(import.meta.url), '..', '..', '..');
const envPath = join(rootDir, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
    }
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

// --------------------------------------------------------------------------
// Run mode — matches Foresight Arena's llm-benchmark convention
// --------------------------------------------------------------------------

export type AgentMode = 'discover' | 'predict' | 'all';
const VALID_MODES: ReadonlyArray<AgentMode> = ['discover', 'predict', 'all'];
const rawMode = (process.env.MODE ?? 'all').toLowerCase();
if (!(VALID_MODES as ReadonlyArray<string>).includes(rawMode)) {
  throw new ConfigError(`MODE="${rawMode}" is not valid. Accepted: discover | predict | all`);
}
/** discover: process reveal queue. predict: LLM + commit. all: both. */
export const MODE: AgentMode = rawMode as AgentMode;

// --------------------------------------------------------------------------
// Timing
// --------------------------------------------------------------------------

/** Predict fires when a round's commitDeadline is within this many seconds. */
export const LEAD_TIME_SECONDS = parseInt(process.env.LEAD_TIME_SECONDS ?? '600', 10);

// --------------------------------------------------------------------------
// Dry-run gate — safe default: never broadcast without explicit opt-in
// --------------------------------------------------------------------------

export const DRY_RUN: boolean =
  !process.argv.includes('--live') && process.env.DRY_RUN !== 'false';

// --------------------------------------------------------------------------
// Anthropic — required for predict/all modes
// --------------------------------------------------------------------------

export const ANTHROPIC_API_KEY: string = (() => {
  const v = process.env.ANTHROPIC_API_KEY;
  if (!v) throw new ConfigError('ANTHROPIC_API_KEY is not set. Check .env.example.');
  return v;
})();

// --------------------------------------------------------------------------
// Per-agent wallets
// --------------------------------------------------------------------------

export type AgentSlug = 'ENSEMBLE' | 'DEBATE' | 'ORCHESTRATOR' | 'PIPELINE' | 'CONSENSUS';

export const AGENT_SLUGS: ReadonlyArray<AgentSlug> = [
  'ENSEMBLE',
  'DEBATE',
  'ORCHESTRATOR',
  'PIPELINE',
  'CONSENSUS',
];

export type AgentAccount = ReturnType<typeof privateKeyToAccount>;

/**
 * Load the per-agent private key and return a viem PrivateKeyAccount.
 * - In dry-run mode: returns null if key is absent (no wallet needed to test predictions).
 * - In live mode: throws ConfigError if key is absent.
 *
 * Keys are registered by the foreflow-agents-engine register-all command.
 */
export function loadAgentAccount(slug: AgentSlug): AgentAccount | null {
  const envKey = `FOREFLOW_${slug}_AGENT_KEY`;
  const privateKey = process.env[envKey];
  if (!privateKey) {
    if (DRY_RUN) {
      return null;
    }
    throw new ConfigError(
      `${envKey} is not set. Register your agent first using the foreflow-agents-engine ` +
        `register-all command, then set ${envKey} in your .env file.`,
    );
  }
  return privateKeyToAccount(privateKey as `0x${string}`);
}
