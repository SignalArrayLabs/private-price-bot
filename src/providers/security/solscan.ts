import type { ContractSecurity, DeployerInfo } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

interface SolscanTokenMeta {
  tokenAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  holder: number;
  supply: number;
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
}

export class SolscanProvider {
  private baseUrl = 'https://public-api.solscan.io';

  async getContractSecurity(address: string): Promise<ContractSecurity | null> {
    try {
      // Fetch token metadata
      const metaUrl = `${this.baseUrl}/token/meta?tokenAddress=${address}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(metaUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PrivatePriceBot/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.debug({ address, status: response.status }, 'Solscan API returned non-OK status');
        return null;
      }

      const data = await response.json() as SolscanTokenMeta;

      // Calculate risk factors
      const riskFactors: string[] = [];
      let riskLevel: 'low' | 'medium' | 'high' | 'unknown' = 'low';

      // Check authorities
      const hasMintAuthority = data.mintAuthority !== null && data.mintAuthority !== undefined;
      const hasFreezeAuthority = data.freezeAuthority !== null && data.freezeAuthority !== undefined;

      if (hasMintAuthority) {
        riskFactors.push('Mint authority enabled (owner can mint new tokens)');
        riskLevel = 'medium';
      }

      if (hasFreezeAuthority) {
        riskFactors.push('Freeze authority enabled (owner can freeze accounts)');
        riskLevel = 'medium';
      }

      // Check holder concentration
      // Note: Would need additional API call to get holder data
      // For now, just return basic security info

      return {
        address,
        chain: 'solana',
        isVerified: true, // Solscan only indexes real tokens
        isProxy: false, // Solana doesn't have proxy contracts like EVM
        hasOwnerFunction: hasMintAuthority || hasFreezeAuthority,
        hasMintFunction: hasMintAuthority,
        hasPauseFunction: hasFreezeAuthority,
        hasBlacklistFunction: false, // Not applicable to Solana token standard
        riskLevel,
        riskFactors,
        deployerAddress: data.mintAuthority || undefined,
        createdAt: undefined, // Would need additional API call
      };
    } catch (error) {
      logger.warn({
        address,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to fetch Solana token security');
      return null;
    }
  }

  async getDeployerInfo(address: string): Promise<DeployerInfo | null> {
    // Solscan doesn't provide deployer history in the same way as EVM chains
    // This would require more complex analysis
    logger.debug({ address }, 'Deployer info not available for Solana');
    return null;
  }
}
