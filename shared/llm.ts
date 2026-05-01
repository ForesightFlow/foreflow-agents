import { AnthropicClient } from 'coordination-experiment';
import type { AgentTools } from 'coordination-experiment';
import { ANTHROPIC_API_KEY } from './env.js';

// Rates as of 2026-04-27 — verify before each production run.
const DEFAULT_MODEL_ID = 'claude-opus-4-6';
const INPUT_USD_PER_MILLION = 5;
const OUTPUT_USD_PER_MILLION = 25;

export function buildAnthropicClient(tools?: AgentTools): AnthropicClient {
  return new AnthropicClient({
    modelId: DEFAULT_MODEL_ID,
    inputUsdPerMillion: INPUT_USD_PER_MILLION,
    outputUsdPerMillion: OUTPUT_USD_PER_MILLION,
    apiKey: ANTHROPIC_API_KEY,
    tools,
  });
}
