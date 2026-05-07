import { AsyncLocalStorage } from 'node:async_hooks';
import { ConfigurableAgentTools, PolymarketAgentTools } from 'coordination-experiment';
import type { AgentTools, LLMClient, Market, MarketDetails, PricePoint, SearchResult, GenerateRequest, GenerateResponse } from 'coordination-experiment';
import { WEB_SEARCH_BACKEND } from './env.js';

const MAX_TOOL_CALLS = parseInt(process.env.MAX_TOOL_CALLS_PER_ROLE ?? '15', 10);

const BUDGET_EXHAUSTED_MSG =
  `Tool call budget exhausted (${MAX_TOOL_CALLS} calls reached). ` +
  `Stop calling tools and produce your final probability based on ` +
  `information already gathered.`;

// Per-generate()-call budget context, keyed by ALS so concurrent roles don't share state.
const budgetStorage = new AsyncLocalStorage<{ count: number; role: string }>();

export class BoundedTools implements AgentTools {
  constructor(private readonly inner: ConfigurableAgentTools) {}

  private checkAndCount(toolName: string): boolean {
    const ctx = budgetStorage.getStore();
    if (!ctx) return true; // no budget context — uncapped
    if (ctx.count >= MAX_TOOL_CALLS) {
      process.stderr.write(
        `[bounded-tools] ${ctx.role}: budget exhausted at ${MAX_TOOL_CALLS} calls (blocked: ${toolName})\n`,
      );
      return false;
    }
    ctx.count++;
    return true;
  }

  async getMarketDetails(index: number): Promise<MarketDetails> {
    if (!this.checkAndCount('getMarketDetails')) {
      return { question: '', description: BUDGET_EXHAUSTED_MSG } as MarketDetails;
    }
    return this.inner.getMarketDetails(index);
  }

  async getPriceHistory(index: number): Promise<PricePoint[]> {
    if (!this.checkAndCount('getPriceHistory')) {
      return [{ message: BUDGET_EXHAUSTED_MSG }] as unknown as PricePoint[];
    }
    try {
      return await this.inner.getPriceHistory(index);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('CLOB API returned 400')) {
        return {
          message:
            'Price history unavailable for this market (no CLOB data). ' +
            'Use the current YES price from getMarketDetails as the only ' +
            'price signal. Do not search for compensating data.',
          prices: [],
        } as unknown as PricePoint[];
      }
      throw err;
    }
  }

  async searchWeb(query: string): Promise<SearchResult[]> {
    if (!this.checkAndCount('searchWeb')) {
      return [{ title: 'Budget exhausted', url: '', snippet: BUDGET_EXHAUSTED_MSG }];
    }
    return this.inner.searchWeb(query);
  }
}

/**
 * Wraps an LLMClient to install a fresh per-call tool budget context before
 * each generate(). Each concurrent generate() gets its own ALS context so
 * parallel forecasters (e.g. IndependentEnsemble) don't share a counter.
 */
export class BudgetedLLMClient implements LLMClient {
  constructor(private readonly inner: LLMClient) {}

  generate(req: GenerateRequest): Promise<GenerateResponse> {
    const role =
      (req.metadata as { agentRole?: string } | undefined)?.agentRole ?? 'unknown';
    return budgetStorage.run({ count: 0, role }, () => this.inner.generate(req));
  }
}

export function buildConfigurableTools(markets: Market[]): BoundedTools {
  const polymarket = new PolymarketAgentTools(markets);
  // anthropic backend: disable local searchWeb — server-side web_search_20260209 handles it.
  // tavily backend: enable searchWeb → PolymarketAgentTools dispatches via Tavily HTTP API.
  const configurable = new ConfigurableAgentTools(polymarket, WEB_SEARCH_BACKEND === 'tavily');
  return new BoundedTools(configurable);
}
