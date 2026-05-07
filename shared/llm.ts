import Anthropic from '@anthropic-ai/sdk';
import { AnthropicClient } from 'coordination-experiment';
import type { AgentTools, LLMClient, GenerateRequest, GenerateResponse, ToolCall } from 'coordination-experiment';
import { ANTHROPIC_API_KEY, WEB_SEARCH_BACKEND } from './env.js';

// Rates as of 2026-04-27 — verify before each production run.
export const DEFAULT_MODEL_ID = 'claude-opus-4-6';
const INPUT_USD_PER_MILLION = 5;
const OUTPUT_USD_PER_MILLION = 25;

// ---------------------------------------------------------------------------
// Anthropic native web_search client
// ---------------------------------------------------------------------------
// Used when WEB_SEARCH_BACKEND=anthropic (default).
//
// Differences from coordination-experiment's AnthropicClient:
//   1. Strips 'searchWeb' from custom tools — server-side web_search replaces it.
//   2. Appends native web_search_20260209 tool to every request (GA, no beta header).
//   3. Handles server_tool_use blocks transparently — no local dispatch needed.
//
// Docs: https://docs.anthropic.com/en/docs/build-with-claude/tool-use/web-search-tool

// Latest GA version of the Anthropic native web search tool.
const NATIVE_WEB_SEARCH_TOOL: Anthropic.WebSearchTool20260209 = {
  type: 'web_search_20260209',
  name: 'web_search',
  max_uses: 10,
};

class AnthropicNativeSearchClient implements LLMClient {
  private readonly sdk: Anthropic;
  private readonly tools?: AgentTools;

  constructor(tools?: AgentTools) {
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required');
    this.sdk = new Anthropic({ apiKey: ANTHROPIC_API_KEY, maxRetries: 0 });
    this.tools = tools;
  }

  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    const startedAt = Date.now();

    // Build Anthropic tool list: standard tools (minus searchWeb) + native web_search.
    const customTools: Anthropic.Tool[] = (req.tools ?? [])
      .filter((t) => t.name !== 'searchWeb')
      .map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Anthropic.Tool['input_schema'],
      }));
    const allTools: Anthropic.ToolUnion[] = [...customTools, NATIVE_WEB_SEARCH_TOOL];

    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: req.userPrompt }];
    const recordedToolCalls: ToolCall[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let finalText = '';

    for (;;) {
      const response = await this.callWithRetry({
        model: DEFAULT_MODEL_ID,
        system: req.systemPrompt,
        messages,
        tools: allTools,
        max_tokens: req.maxTokens ?? 1024,
        temperature: req.temperature,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      if (response.stop_reason !== 'tool_use') {
        finalText = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
        break;
      }

      // Append full assistant turn (includes server_tool_use + tool_use blocks).
      messages.push({
        role: 'assistant',
        content: response.content as unknown as Anthropic.ContentBlockParam[],
      });

      // Execute only custom tool_use blocks; server_tool_use (native web_search) is
      // already resolved server-side and requires no local dispatch.
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const tb = block as Anthropic.ToolUseBlock;
        let result: unknown;
        try {
          result = await this.executeTool(tb.name, tb.input as Record<string, unknown>);
        } catch (err) {
          result = { error: String(err) };
        }
        recordedToolCalls.push({
          toolName: tb.name,
          arguments: tb.input as Record<string, unknown>,
          result,
        });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tb.id,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    const durationMs = Date.now() - startedAt;
    const costUsd =
      (totalInputTokens * INPUT_USD_PER_MILLION + totalOutputTokens * OUTPUT_USD_PER_MILLION) /
      1_000_000;

    return {
      text: finalText,
      toolCalls: recordedToolCalls,
      usage: {
        promptTokens: totalInputTokens,
        completionTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      },
      costUsd,
      modelId: DEFAULT_MODEL_ID,
      durationMs,
    };
  }

  private async callWithRetry(
    params: Anthropic.MessageCreateParamsNonStreaming,
  ): Promise<Anthropic.Message> {
    const BASE_MS = 2_000;
    const maxRetries = 6;
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.sdk.messages.create(params);
      } catch (err) {
        const is429 = err instanceof Anthropic.APIError && err.status === 429;
        if (is429 && attempt < maxRetries) {
          const retryAfterSec = Number(
            (err as { headers?: { get?: (k: string) => string | null } }).headers?.get?.(
              'retry-after',
            ) ?? 0,
          );
          const cap = Math.min(BASE_MS * Math.pow(2, attempt), 60_000);
          const delayMs = retryAfterSec > 0 ? retryAfterSec * 1000 : Math.random() * cap;
          process.stderr.write(
            `[AnthropicClient] 429 rate-limited, retry ${attempt + 1}/${maxRetries} in ${Math.round(delayMs / 1000)}s\n`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        throw err;
      }
    }
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.tools) throw new Error(`Tool "${name}" called but no AgentTools provided`);
    switch (name) {
      case 'getMarketDetails': return this.tools.getMarketDetails(args['index'] as number);
      case 'getPriceHistory': return this.tools.getPriceHistory(args['index'] as number);
      default: throw new Error(`Unknown tool: "${name}"`);
    }
  }
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Build the LLM client for the active web_search backend.
 *
 * anthropic (default): AnthropicNativeSearchClient — injects web_search_20260209 as a
 *   server-side tool; Tavily not required.
 * tavily: coordination-experiment AnthropicClient — searchWeb dispatched locally via
 *   PolymarketAgentTools → Tavily HTTP API.
 */
export function buildAnthropicClient(tools?: AgentTools): LLMClient {
  if (WEB_SEARCH_BACKEND === 'anthropic') {
    return new AnthropicNativeSearchClient(tools);
  }
  return new AnthropicClient({
    modelId: DEFAULT_MODEL_ID,
    inputUsdPerMillion: INPUT_USD_PER_MILLION,
    outputUsdPerMillion: OUTPUT_USD_PER_MILLION,
    apiKey: ANTHROPIC_API_KEY,
    tools,
  });
}
