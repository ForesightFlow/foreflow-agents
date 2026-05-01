import {
  getActiveRounds,
  getRound,
  getMarkets,
  summarizeMarket,
  computeCommitHash,
  generateSalt,
  hashContent,
  gaslessCommit,
  gaslessReveal,
  postReasoning,
  getRevealQueue,
  saveRevealQueue,
} from 'foresight-arena';
import type { CoordinationConfig, CoordinationConfigParams } from 'coordination-experiment';
import type { AgentAccount } from './env.js';
import { DRY_RUN, LEAD_TIME_SECONDS, MODE } from './env.js';
import { buildAnthropicClient } from './llm.js';
import { buildConfigurableTools } from './tools.js';
import { summariesToMarkets, probToBasisPoints } from './translate.js';

const DEFAULT_PARAMS: CoordinationConfigParams = {
  agentCount: 3,
  maxInternalRounds: 3,
  convergenceTolerance: 0.05,
  maxTokensPerMarket: 40_000,
  maxTokensPerCall: 8_000,
  temperature: 0.7,
};

// --------------------------------------------------------------------------
// Discover: drain the reveal queue
// --------------------------------------------------------------------------

async function discover(account: AgentAccount | null): Promise<void> {
  const queue = getRevealQueue();
  if (queue.length === 0) return;

  const now = Math.floor(Date.now() / 1000);
  const remaining = [];

  for (const entry of queue) {
    const round = await getRound(entry.roundId);
    if (!round || round.invalidated || now >= Number(round.revealDeadline)) {
      console.log(`[discover] round=${entry.roundId} expired/invalidated — dropping`);
      continue;
    }
    if (now < Number(round.revealStart)) {
      remaining.push(entry);
      continue;
    }

    if (!account || DRY_RUN) {
      console.log(`[discover] dry-run: would reveal round=${entry.roundId} predictions=[${entry.predictions.join(',')}]`);
      remaining.push(entry);
      continue;
    }

    try {
      const result = await gaslessReveal({
        roundId: entry.roundId,
        predictions: entry.predictions,
        salt: entry.salt,
        account,
      });
      console.log(`[discover] revealed round=${entry.roundId} tx=${result.txHash}`);

      if (entry.reasoning && entry.reasoning.length > 0) {
        try {
          await postReasoning({
            roundId: entry.roundId,
            agent: account.address,
            reasoning: entry.reasoning,
          });
          console.log(`[discover] posted reasoning for round=${entry.roundId}`);
        } catch (e) {
          console.warn(`[discover] postReasoning failed (non-fatal): ${e}`);
        }
      }
    } catch (err) {
      const msg = String(err);
      if (msg.includes('Already revealed')) {
        console.log(`[discover] round=${entry.roundId} already revealed — dropping`);
      } else {
        console.error(`[discover] reveal failed for round=${entry.roundId}:`, err);
        remaining.push(entry);
      }
    }
  }

  saveRevealQueue(remaining);
}

// --------------------------------------------------------------------------
// Predict: LLM → commit for rounds within LEAD_TIME_SECONDS
// --------------------------------------------------------------------------

async function predict(
  config: CoordinationConfig,
  account: AgentAccount | null,
  params: CoordinationConfigParams,
): Promise<void> {
  const rounds = await getActiveRounds();
  const now = Math.floor(Date.now() / 1000);
  const queue = getRevealQueue();

  for (const round of rounds) {
    const timeToCommit = Number(round.commitDeadline) - now;
    if (timeToCommit <= 0 || timeToCommit > LEAD_TIME_SECONDS) continue;

    if (queue.some((e) => e.roundId === Number(round.roundId))) {
      console.log(`[${config.name}] round=${round.roundId} already committed — skipping`);
      continue;
    }

    const rawMarkets = await getMarkets(round.conditionIds);
    const summaries = rawMarkets.map((m, i) => summarizeMarket(m, i));
    const markets = summariesToMarkets(round.conditionIds, summaries);

    // Single LLM client + tools pair shared across all markets in this round.
    const tools = buildConfigurableTools(markets);
    const llm = buildAnthropicClient(tools);

    const predictions: number[] = [];
    const reasoning: string[] = [];

    for (const market of markets) {
      console.log(
        `[${config.name}] round=${round.roundId} market[${market.index}] "${market.question}"`,
      );
      try {
        const result = await config.predict({ market, tools, llm, params });
        const bp = probToBasisPoints(result.probability);
        predictions.push(bp);
        const lastCall = result.trace.calls[result.trace.calls.length - 1];
        reasoning.push(lastCall?.response.text ?? '');
        console.log(`  p=${result.probability.toFixed(4)} bp=${bp}`);
      } catch (err) {
        console.error(`  predict failed for market[${market.index}]:`, err);
        predictions.push(5_000); // 50% fallback — failure is logged, not hidden
        reasoning.push('');
      }
    }

    const salt = generateSalt();
    const commitHash = computeCommitHash(Number(round.roundId), predictions, salt);
    const reasoningHash = hashContent(reasoning);

    console.log(
      `[${config.name}] round=${round.roundId} predictions=[${predictions.join(',')}] commitHash=${commitHash.slice(0, 12)}...`,
    );

    if (!account || DRY_RUN) {
      console.log(`[${config.name}] dry-run: skipping on-chain commit for round=${round.roundId}`);
      continue;
    }

    try {
      const result = await gaslessCommit({
        roundId: Number(round.roundId),
        commitHash,
        reasoningHash,
        account,
      });
      console.log(`[${config.name}] committed round=${round.roundId} tx=${result.txHash}`);

      const updatedQueue = getRevealQueue();
      updatedQueue.push({
        roundId: Number(round.roundId),
        predictions,
        salt,
        reasoning,
        committedAt: new Date().toISOString(),
      });
      saveRevealQueue(updatedQueue);
    } catch (err) {
      console.error(`[${config.name}] gaslessCommit failed for round=${round.roundId}:`, err);
    }
  }
}

// --------------------------------------------------------------------------
// Public entry point
// --------------------------------------------------------------------------

export async function runAgentLoop(
  config: CoordinationConfig,
  account: AgentAccount | null,
  params?: Partial<CoordinationConfigParams>,
): Promise<void> {
  const mergedParams: CoordinationConfigParams = { ...DEFAULT_PARAMS, ...params };

  console.log(
    `[${config.name}] mode=${MODE} dry_run=${DRY_RUN} account=${account?.address ?? '(none — dry-run only)'}`,
  );

  if (MODE === 'discover' || MODE === 'all') {
    await discover(account);
  }
  if (MODE === 'predict' || MODE === 'all') {
    await predict(config, account, mergedParams);
  }
}
