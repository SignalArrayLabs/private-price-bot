import type { PriceData, TokenInfo, PriceProvider } from '../../types/index.js';
import type { SupportedChain } from '../../config/index.js';
import { logger, logProviderCall } from '../../utils/logger.js';

export abstract class BasePriceProvider implements PriceProvider {
  abstract name: string;
  protected lastError: Error | null = null;
  protected isDown = false;
  protected downSince: Date | null = null;
  protected backoffMs = 1000;
  protected maxBackoffMs = 60000;

  abstract getPrice(symbolOrAddress: string, chain?: SupportedChain): Promise<PriceData | null>;
  abstract searchToken(query: string): Promise<TokenInfo[]>;

  async isHealthy(): Promise<boolean> {
    return !this.isDown;
  }

  protected markDown(error: Error): void {
    this.isDown = true;
    this.downSince = new Date();
    this.lastError = error;
    this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
    logger.warn({ provider: this.name, error: error.message }, 'Provider marked as down');
  }

  protected markUp(): void {
    if (this.isDown) {
      logger.info({ provider: this.name }, 'Provider recovered');
    }
    this.isDown = false;
    this.downSince = null;
    this.lastError = null;
    this.backoffMs = 1000;
  }

  protected async fetchWithTimeout<T>(
    url: string,
    options: RequestInit = {},
    timeoutMs = 10000
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as T;
      logProviderCall(this.name, url, true, Date.now() - startTime);
      this.markUp();
      return data;
    } catch (error) {
      logProviderCall(this.name, url, false, Date.now() - startTime);
      if (error instanceof Error) {
        this.markDown(error);
        throw error;
      }
      throw new Error('Unknown fetch error');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  protected isAddress(value: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(value);
  }

  protected normalizeSymbol(symbol: string): string {
    return symbol.toUpperCase().trim();
  }
}
