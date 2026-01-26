import type { SupportedChain } from '../config/index.js';

// Price data types
export interface PriceData {
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  marketCap: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdated: Date;
  chain?: SupportedChain;
  address?: string;
}

export interface TokenInfo {
  symbol: string;
  name: string;
  address?: string;
  chain?: SupportedChain;
  decimals?: number;
  logoUrl?: string;
}

// Security types
export interface ContractSecurity {
  address: string;
  chain: SupportedChain;
  isVerified: boolean;
  isProxy: boolean;
  hasOwnerFunction: boolean;
  hasMintFunction: boolean;
  hasPauseFunction: boolean;
  hasBlacklistFunction: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'unknown';
  riskFactors: string[];
  deployerAddress?: string;
  createdAt?: Date;
}

export interface DeployerInfo {
  address: string;
  chain: SupportedChain;
  contractsDeployed: number;
  rugPullCount: number;
  successfulProjects: number;
  firstActivity?: Date;
  lastActivity?: Date;
  riskLevel: 'low' | 'medium' | 'high' | 'unknown';
}

export interface WebsiteSimilarity {
  url: string;
  isReachable: boolean;
  title?: string;
  contentHash?: string;
  faviconHash?: string;
  similarTo?: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'unknown';
}

export interface TwitterCheck {
  handle: string;
  exists: boolean;
  accountAge?: number;
  isLimited: boolean;
  limitedReason?: string;
}

// Alert types
export interface Alert {
  id: number;
  groupId: number;
  tokenRef: string;
  chain: SupportedChain | null;
  direction: 'above' | 'below';
  targetPrice: number;
  cooldownMinutes: number;
  lastTriggeredAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

// Call types
export interface Call {
  id: number;
  groupId: number;
  userId: number;
  username?: string;
  tokenRef: string;
  chain: SupportedChain | null;
  callPrice: number;
  callTime: Date;
  notes?: string;
  currentPrice?: number;
  multiple?: number;
}

// Leaderboard types
export interface LeaderboardEntry {
  userId: number;
  username?: string;
  totalCalls: number;
  avgMultiple: number;
  bestMultiple: number;
  winRate: number;
}

// Group types
export interface GroupConfig {
  id: number;
  tgChatId: number;
  title?: string;
  defaultToken?: string;
  defaultChain?: SupportedChain;
  createdAt: Date;
}

// Watchlist types
export interface WatchlistItem {
  id: number;
  groupId: number;
  tokenRef: string;
  chain: SupportedChain | null;
  createdAt: Date;
}

// Provider interfaces
export interface PriceProvider {
  name: string;
  getPrice(symbolOrAddress: string, chain?: SupportedChain): Promise<PriceData | null>;
  searchToken(query: string): Promise<TokenInfo[]>;
  isHealthy(): Promise<boolean>;
}

export interface SecurityProvider {
  name: string;
  getContractSecurity(address: string, chain: SupportedChain): Promise<ContractSecurity | null>;
  getDeployerInfo(address: string, chain: SupportedChain): Promise<DeployerInfo | null>;
}

// Cache types
export interface CacheEntry<T> {
  data: T;
  fetchedAt: Date;
  ttlSeconds: number;
}
