import type { ContractSecurity, DeployerInfo, SecurityProvider } from '../../types/index.js';
import type { SupportedChain } from '../../config/index.js';
import { logger, logProviderCall } from '../../utils/logger.js';

export abstract class BaseSecurityProvider implements SecurityProvider {
  abstract name: string;
  protected lastError: Error | null = null;
  protected isDown = false;
  protected downSince: Date | null = null;
  protected backoffMs = 1000;
  protected maxBackoffMs = 60000;

  abstract getContractSecurity(address: string, chain: SupportedChain): Promise<ContractSecurity | null>;
  abstract getDeployerInfo(address: string, chain: SupportedChain): Promise<DeployerInfo | null>;

  async isHealthy(): Promise<boolean> {
    return !this.isDown;
  }

  protected markDown(error: Error): void {
    this.isDown = true;
    this.downSince = new Date();
    this.lastError = error;
    this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
    logger.warn({ provider: this.name, error: error.message }, 'Security provider marked as down');
  }

  protected markUp(): void {
    if (this.isDown) {
      logger.info({ provider: this.name }, 'Security provider recovered');
    }
    this.isDown = false;
    this.downSince = null;
    this.lastError = null;
    this.backoffMs = 1000;
  }

  protected async fetchWithTimeout<T>(
    url: string,
    options: RequestInit = {},
    timeoutMs = 15000
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

  protected isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  // Analyze ABI for risk factors
  protected analyzeAbiForRisks(abi: string): {
    hasOwnerFunction: boolean;
    hasMintFunction: boolean;
    hasPauseFunction: boolean;
    hasBlacklistFunction: boolean;
  } {
    const abiLower = abi.toLowerCase();

    return {
      hasOwnerFunction: abiLower.includes('owner') || abiLower.includes('onlyowner'),
      hasMintFunction: abiLower.includes('mint') && !abiLower.includes('mint:'),
      hasPauseFunction: abiLower.includes('pause') || abiLower.includes('unpause'),
      hasBlacklistFunction: abiLower.includes('blacklist') || abiLower.includes('blocklist'),
    };
  }

  // Calculate risk level based on factors
  protected calculateRiskLevel(factors: {
    isVerified: boolean;
    isProxy: boolean;
    hasOwnerFunction: boolean;
    hasMintFunction: boolean;
    hasPauseFunction: boolean;
    hasBlacklistFunction: boolean;
  }): 'low' | 'medium' | 'high' | 'unknown' {
    if (!factors.isVerified) {
      return 'high';
    }

    let riskScore = 0;

    if (factors.isProxy) riskScore += 2;
    if (factors.hasOwnerFunction) riskScore += 1;
    if (factors.hasMintFunction) riskScore += 2;
    if (factors.hasPauseFunction) riskScore += 1;
    if (factors.hasBlacklistFunction) riskScore += 2;

    if (riskScore >= 5) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  // Generate risk factors list
  protected generateRiskFactors(factors: {
    isVerified: boolean;
    isProxy: boolean;
    hasOwnerFunction: boolean;
    hasMintFunction: boolean;
    hasPauseFunction: boolean;
    hasBlacklistFunction: boolean;
  }): string[] {
    const riskFactors: string[] = [];

    if (!factors.isVerified) {
      riskFactors.push('Contract source code is not verified');
    }
    if (factors.isProxy) {
      riskFactors.push('Proxy contract - implementation can be changed');
    }
    if (factors.hasOwnerFunction) {
      riskFactors.push('Owner can modify contract state');
    }
    if (factors.hasMintFunction) {
      riskFactors.push('Mint function allows token creation');
    }
    if (factors.hasPauseFunction) {
      riskFactors.push('Contract can be paused');
    }
    if (factors.hasBlacklistFunction) {
      riskFactors.push('Blacklist function can block addresses');
    }

    return riskFactors;
  }
}
