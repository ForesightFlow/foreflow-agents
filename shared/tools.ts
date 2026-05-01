import { ConfigurableAgentTools, PolymarketAgentTools } from 'coordination-experiment';
import type { Market } from 'coordination-experiment';

// Web search is ENABLED for all live agents.
// Contrast with Phase 1A historical sandbox where web search is OFF (no-leakage requirement).
export function buildConfigurableTools(markets: Market[]): ConfigurableAgentTools {
  const polymarket = new PolymarketAgentTools(markets);
  return new ConfigurableAgentTools(polymarket, true);
}
