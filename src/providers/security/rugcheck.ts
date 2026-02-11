import { createHash } from 'crypto';
import type { ContractSecurity } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}

interface RugCheckHolder {
  address: string;
  pct: number;
  insider: boolean;
}

interface RugCheckResponse {
  mint: string;
  creator: string;
  token: {
    mintAuthority: string | null;
    freezeAuthority: string | null;
    supply: number;
    decimals: number;
  };
  tokenMeta: {
    name: string;
    symbol: string;
    mutable: boolean;
  };
  topHolders: RugCheckHolder[];
}

export class RugCheckProvider {
  private baseUrl = 'https://api.rugcheck.xyz/v1';

  async getContractSecurity(address: string): Promise<ContractSecurity | null> {
    logger.info({ address }, '[RUGCHECK] Starting security scan');

    try {
      const url = `${this.baseUrl}/tokens/${address}/report`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PrivatePriceBot/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn({ address, status: response.status }, '[RUGCHECK] API returned non-OK');
        return null;
      }

      const rawBody = await response.text();
      const bodyHash = sha256(rawBody);
      const serverDate = response.headers.get('date') || 'no-date';

      logger.info({
        address,
        responseSize: rawBody.length,
        bodyHash,
        serverDate,
      }, '[RUGCHECK] API response received');

      const data = JSON.parse(rawBody) as RugCheckResponse;

      // Calculate risk factors
      const riskFactors: string[] = [];
      let riskLevel: 'low' | 'medium' | 'high' | 'unknown' = 'low';

      // Check authorities
      const hasMintAuthority = data.token.mintAuthority !== null;
      const hasFreezeAuthority = data.token.freezeAuthority !== null;

      if (hasMintAuthority) {
        riskFactors.push('⚠️ Mint authority enabled (can mint new tokens)');
        riskLevel = 'medium';
      }

      if (hasFreezeAuthority) {
        riskFactors.push('⚠️ Freeze authority enabled (can freeze accounts)');
        riskLevel = 'medium';
      }

      if (data.tokenMeta?.mutable) {
        riskFactors.push('⚠️ Metadata is mutable (can change token info)');
        if (riskLevel === 'low') riskLevel = 'medium';
      }

      // Check holder concentration
      if (data.topHolders && data.topHolders.length > 0) {
        const topHolder = data.topHolders[0];
        if (topHolder.pct > 50) {
          riskFactors.push(`🔴 Top holder owns ${topHolder.pct.toFixed(1)}% (>50%)`);
          riskLevel = 'high';
        } else if (topHolder.pct > 20) {
          riskFactors.push(`⚠️ Top holder owns ${topHolder.pct.toFixed(1)}% (>20%)`);
          if (riskLevel === 'low') riskLevel = 'medium';
        }

        // Check for insider holdings
        const insiderCount = data.topHolders.filter(h => h.insider).length;
        if (insiderCount > 0) {
          const insiderPct = data.topHolders
            .filter(h => h.insider)
            .reduce((sum, h) => sum + h.pct, 0);
          riskFactors.push(`⚠️ ${insiderCount} insider wallets hold ${insiderPct.toFixed(1)}%`);
          if (riskLevel === 'low') riskLevel = 'medium';
        }
      }

      // If no risk factors, add positive indicators
      if (riskFactors.length === 0) {
        riskFactors.push('✅ No mint authority');
        riskFactors.push('✅ No freeze authority');
        riskFactors.push('✅ Metadata immutable');
      }

      const result: ContractSecurity = {
        address,
        chain: 'solana',
        isVerified: true,
        isProxy: false,
        hasOwnerFunction: hasMintAuthority || hasFreezeAuthority,
        hasMintFunction: hasMintAuthority,
        hasPauseFunction: hasFreezeAuthority,
        hasBlacklistFunction: false,
        riskLevel,
        riskFactors,
        deployerAddress: data.creator || undefined,
        createdAt: undefined,
      };

      logger.info({
        address,
        riskLevel,
        riskFactorCount: riskFactors.length,
      }, '[RUGCHECK] Security scan complete');

      return result;
    } catch (error) {
      logger.error({
        address,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, '[RUGCHECK] Security scan failed');
      return null;
    }
  }
}
