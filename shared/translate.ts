import type { Market } from 'coordination-experiment';
import type { SdkMarketSummary } from 'foresight-arena';

/**
 * Convert SDK market summaries (Polymarket Gamma shape) into the Market[] type
 * expected by coordination-experiment configs.
 *
 * This is the only integration-seam between the two libraries.
 */
export function summariesToMarkets(
  conditionIds: string[],
  summaries: SdkMarketSummary[],
): Market[] {
  return summaries.map((s, i) => ({
    index: i,
    question: s.error
      ? `Market ${i} (metadata unavailable)`
      : (s.question ?? `Market ${i}`),
    description: s.tags?.join(', ') ?? '',
    conditionId: conditionIds[i],
    midPrice: s.currentYesPrice ?? undefined,
    resolutionDate: s.endDate ?? undefined,
  }));
}

/** Convert probability in [0, 1] to uint16 basis points (0–10000). */
export function probToBasisPoints(p: number): number {
  return Math.round(Math.max(0, Math.min(1, p)) * 10_000);
}
