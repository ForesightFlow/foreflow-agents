/**
 * JSONL event emission for the foreflow-agents-engine receiving pipe.
 *
 * Engine's spawn.ts reads each line of agent stdout. Lines that start
 * with '{' are parsed as AgentEvent; all other lines are forwarded to
 * the engine's own stdout as-is. The two output streams coexist: keep
 * using console.log for human-readable logs and emitEvent() for
 * machine-readable events.
 *
 * Schema is kept in sync with:
 *   foreflow-agents-engine/src/events/types.ts
 */

export interface PredictionStartedEvent {
  kind: 'prediction_started';
  timestamp: number;
  agentName: string;
  configuration: string;
  roundId: string;
  marketId: string;
  marketQuestion: string;
  marketCategory?: string;
  marketBaseline?: number;
  modelId: string;
}

export interface LlmCallEvent {
  kind: 'llm_call';
  timestamp: number;
  predictionRef: { roundId: string; marketId: string };
  callIndex: number;
  agentRole: string;
  systemPrompt: string;
  userPrompt: string;
  responseText: string;
  toolCalls?: unknown[];
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs?: number;
}

export interface PredictionCompleteEvent {
  kind: 'prediction_complete';
  timestamp: number;
  predictionRef: { roundId: string; marketId: string };
  probability: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
}

export interface PredictionFailedEvent {
  kind: 'prediction_failed';
  timestamp: number;
  predictionRef: { roundId: string; marketId: string };
  reason: string;
}

export interface CommittedEvent {
  kind: 'committed';
  timestamp: number;
  predictionRef: { roundId: string; marketId: string };
  txHash: string;
  salt: string;
}

export interface RevealedEvent {
  kind: 'revealed';
  timestamp: number;
  predictionRef: { roundId: string; marketId: string };
  txHash: string;
}

export type AgentEvent =
  | PredictionStartedEvent
  | LlmCallEvent
  | PredictionCompleteEvent
  | PredictionFailedEvent
  | CommittedEvent
  | RevealedEvent;

/** Emit one compact JSON line on stdout. */
export function emitEvent(event: AgentEvent): void {
  process.stdout.write(JSON.stringify(event) + '\n');
}

export function emitPredictionStarted(
  agentName: string,
  configuration: string,
  roundId: string,
  marketId: string,
  marketQuestion: string,
  options?: {
    marketCategory?: string;
    marketBaseline?: number;
    modelId?: string;
  },
): void {
  emitEvent({
    kind: 'prediction_started',
    timestamp: Math.floor(Date.now() / 1000),
    agentName,
    configuration,
    roundId,
    marketId,
    marketQuestion,
    marketCategory: options?.marketCategory,
    marketBaseline: options?.marketBaseline,
    modelId: options?.modelId ?? 'claude-opus-4-6',
  });
}

export function emitLlmCall(
  roundId: string,
  marketId: string,
  callIndex: number,
  agentRole: string,
  systemPrompt: string,
  userPrompt: string,
  responseText: string,
  toolCalls: unknown[] | undefined,
  inputTokens: number,
  outputTokens: number,
  costUsd: number,
  durationMs?: number,
): void {
  emitEvent({
    kind: 'llm_call',
    timestamp: Math.floor(Date.now() / 1000),
    predictionRef: { roundId, marketId },
    callIndex,
    agentRole,
    systemPrompt,
    userPrompt,
    responseText,
    toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
    inputTokens,
    outputTokens,
    costUsd,
    durationMs,
  });
}

export function emitPredictionComplete(
  roundId: string,
  marketId: string,
  probability: number,
  totalInputTokens: number,
  totalOutputTokens: number,
  totalCostUsd: number,
): void {
  emitEvent({
    kind: 'prediction_complete',
    timestamp: Math.floor(Date.now() / 1000),
    predictionRef: { roundId, marketId },
    probability,
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd,
  });
}

export function emitPredictionFailed(
  roundId: string,
  marketId: string,
  reason: string,
): void {
  emitEvent({
    kind: 'prediction_failed',
    timestamp: Math.floor(Date.now() / 1000),
    predictionRef: { roundId, marketId },
    reason,
  });
}

export function emitCommitted(
  roundId: string,
  marketId: string,
  txHash: string,
  salt: string,
): void {
  emitEvent({
    kind: 'committed',
    timestamp: Math.floor(Date.now() / 1000),
    predictionRef: { roundId, marketId },
    txHash,
    salt,
  });
}

export function emitRevealed(
  roundId: string,
  marketId: string,
  txHash: string,
): void {
  emitEvent({
    kind: 'revealed',
    timestamp: Math.floor(Date.now() / 1000),
    predictionRef: { roundId, marketId },
    txHash,
  });
}
