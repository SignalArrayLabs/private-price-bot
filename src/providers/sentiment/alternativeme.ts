import { logger } from '../../utils/logger.js';
import type { FearGreedData } from '../../types/index.js';

interface AlternativeMeResponse {
  name: string;
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
    time_until_update?: string;
  }>;
  metadata: {
    error: string | null;
  };
}

// In-memory cache for FGI (updates once daily, so long TTL is fine)
let cachedFGI: { data: FearGreedData; expiry: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function getFearGreedIndex(): Promise<FearGreedData | null> {
  // Check cache first
  if (cachedFGI && cachedFGI.expiry > Date.now()) {
    return cachedFGI.data;
  }

  try {
    // Fetch current and yesterday's values
    const url = 'https://api.alternative.me/fng/?limit=2';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PrivatePriceBot/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn({ status: response.status }, 'FGI API returned non-OK status');
      return null;
    }

    const data = await response.json() as AlternativeMeResponse;

    if (data.metadata?.error || !data.data || data.data.length === 0) {
      logger.warn({ error: data.metadata?.error }, 'FGI API returned error');
      return null;
    }

    const current = data.data[0];
    const previous = data.data.length > 1 ? data.data[1] : null;

    const fgiData: FearGreedData = {
      value: parseInt(current.value, 10),
      classification: current.value_classification,
      timestamp: new Date(parseInt(current.timestamp, 10) * 1000),
      previousValue: previous ? parseInt(previous.value, 10) : undefined,
      previousClassification: previous?.value_classification,
    };

    // Cache the result
    cachedFGI = {
      data: fgiData,
      expiry: Date.now() + CACHE_TTL_MS,
    };

    return fgiData;
  } catch (error) {
    logger.warn({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Failed to fetch FGI');
    return null;
  }
}

// Clear FGI cache (useful for testing)
export function clearFGICache(): void {
  cachedFGI = null;
}
