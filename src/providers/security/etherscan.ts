import { BaseSecurityProvider } from './base.js';
import type { ContractSecurity, DeployerInfo } from '../../types/index.js';
import type { SupportedChain } from '../../config/index.js';
import { config, CHAIN_CONFIG } from '../../config/index.js';

interface EtherscanSourceCodeResponse {
  status: string;
  message: string;
  result: Array<{
    SourceCode: string;
    ABI: string;
    ContractName: string;
    CompilerVersion: string;
    OptimizationUsed: string;
    Runs: string;
    ConstructorArguments: string;
    EVMVersion: string;
    Library: string;
    LicenseType: string;
    Proxy: string;
    Implementation: string;
    SwarmSource: string;
  }>;
}

interface EtherscanTxListResponse {
  status: string;
  message: string;
  result: Array<{
    blockNumber: string;
    timeStamp: string;
    hash: string;
    from: string;
    to: string;
    contractAddress: string;
    value: string;
    isError: string;
  }>;
}

interface EtherscanContractCreationResponse {
  status: string;
  message: string;
  result: Array<{
    contractAddress: string;
    contractCreator: string;
    txHash: string;
  }>;
}

export class EtherscanProvider extends BaseSecurityProvider {
  name = 'Etherscan';

  private getApiKey(chain: SupportedChain): string | undefined {
    switch (chain) {
      case 'ethereum':
        return config.etherscanApiKey;
      case 'bsc':
        return config.bscscanApiKey;
      case 'polygon':
        return config.polygonscanApiKey;
      default:
        return undefined;
    }
  }

  private getApiUrl(chain: SupportedChain): string {
    return CHAIN_CONFIG[chain].explorerApiUrl;
  }

  async getContractSecurity(address: string, chain: SupportedChain): Promise<ContractSecurity | null> {
    if (!this.isValidAddress(address)) {
      return null;
    }

    const apiUrl = this.getApiUrl(chain);
    const apiKey = this.getApiKey(chain);

    try {
      // Get contract source code and verification status
      const sourceUrl = `${apiUrl}?module=contract&action=getsourcecode&address=${address}${apiKey ? `&apikey=${apiKey}` : ''}`;
      const sourceResponse = await this.fetchWithTimeout<EtherscanSourceCodeResponse>(sourceUrl);

      if (sourceResponse.status !== '1' || !sourceResponse.result?.[0]) {
        return null;
      }

      const contractInfo = sourceResponse.result[0];
      const isVerified = Boolean(contractInfo.SourceCode && contractInfo.SourceCode !== '');
      const isProxy = contractInfo.Proxy === '1' || Boolean(contractInfo.Implementation);

      // Analyze ABI for risk factors
      const abiRisks = this.analyzeAbiForRisks(contractInfo.ABI || '');

      // Get contract creation info
      let deployerAddress: string | undefined;
      let createdAt: Date | undefined;

      try {
        const creationUrl = `${apiUrl}?module=contract&action=getcontractcreation&contractaddresses=${address}${apiKey ? `&apikey=${apiKey}` : ''}`;
        const creationResponse = await this.fetchWithTimeout<EtherscanContractCreationResponse>(creationUrl);

        if (creationResponse.status === '1' && creationResponse.result?.[0]) {
          deployerAddress = creationResponse.result[0].contractCreator;
        }
      } catch {
        // Contract creation info is optional
      }

      const factors = {
        isVerified,
        isProxy,
        ...abiRisks,
      };

      return {
        address: address.toLowerCase(),
        chain,
        isVerified,
        isProxy,
        hasOwnerFunction: abiRisks.hasOwnerFunction,
        hasMintFunction: abiRisks.hasMintFunction,
        hasPauseFunction: abiRisks.hasPauseFunction,
        hasBlacklistFunction: abiRisks.hasBlacklistFunction,
        riskLevel: this.calculateRiskLevel(factors),
        riskFactors: this.generateRiskFactors(factors),
        deployerAddress,
        createdAt,
      };
    } catch {
      return null;
    }
  }

  async getDeployerInfo(address: string, chain: SupportedChain): Promise<DeployerInfo | null> {
    if (!this.isValidAddress(address)) {
      return null;
    }

    const apiUrl = this.getApiUrl(chain);
    const apiKey = this.getApiKey(chain);

    try {
      // Get transactions from this address (contract deployments are to null address)
      const txUrl = `${apiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc${apiKey ? `&apikey=${apiKey}` : ''}`;
      const txResponse = await this.fetchWithTimeout<EtherscanTxListResponse>(txUrl);

      if (txResponse.status !== '1' || !txResponse.result) {
        return {
          address: address.toLowerCase(),
          chain,
          contractsDeployed: 0,
          rugPullCount: 0,
          successfulProjects: 0,
          riskLevel: 'unknown',
        };
      }

      // Count contract deployments (transactions where 'to' is empty or contract creation)
      const deployments = txResponse.result.filter(
        tx => tx.to === '' || tx.contractAddress !== ''
      );

      // Get first and last activity
      let firstActivity: Date | undefined;
      let lastActivity: Date | undefined;

      if (txResponse.result.length > 0) {
        const timestamps = txResponse.result.map(tx => parseInt(tx.timeStamp, 10) * 1000);
        firstActivity = new Date(Math.min(...timestamps));
        lastActivity = new Date(Math.max(...timestamps));
      }

      // Calculate risk level based on deployment patterns
      const contractsDeployed = deployments.length;
      let riskLevel: 'low' | 'medium' | 'high' | 'unknown' = 'unknown';

      if (contractsDeployed === 0) {
        riskLevel = 'unknown';
      } else if (contractsDeployed <= 3) {
        riskLevel = 'low';
      } else if (contractsDeployed <= 10) {
        riskLevel = 'medium';
      } else {
        riskLevel = 'high'; // Many deployments could indicate serial deployer
      }

      return {
        address: address.toLowerCase(),
        chain,
        contractsDeployed,
        rugPullCount: 0, // Would need external data source for this
        successfulProjects: 0, // Would need external data source for this
        firstActivity,
        lastActivity,
        riskLevel,
      };
    } catch {
      return null;
    }
  }

  async isHealthy(): Promise<boolean> {
    if (this.isDown) {
      if (this.downSince && Date.now() - this.downSince.getTime() < this.backoffMs) {
        return false;
      }
    }

    try {
      const apiUrl = this.getApiUrl('ethereum');
      const url = `${apiUrl}?module=stats&action=ethprice`;
      await this.fetchWithTimeout<{ status: string }>(url, {}, 5000);
      return true;
    } catch {
      return false;
    }
  }
}
