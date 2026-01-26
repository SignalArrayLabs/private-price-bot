import { createHash } from 'crypto';
import type { WebsiteSimilarity, TwitterCheck } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export class WebsiteChecker {
  name = 'WebsiteChecker';

  async checkWebsite(url: string): Promise<WebsiteSimilarity> {
    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return {
        url,
        isReachable: false,
        riskLevel: 'unknown',
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PrivatePriceBot/1.0)',
        },
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          url,
          isReachable: false,
          riskLevel: 'unknown',
        };
      }

      const html = await response.text();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : undefined;

      // Generate content hash (simplified - just hash the text content)
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 10000); // Limit for hashing

      const contentHash = createHash('sha256')
        .update(textContent)
        .digest('hex')
        .substring(0, 16);

      // Try to get favicon hash
      let faviconHash: string | undefined;
      try {
        const faviconUrl = new URL('/favicon.ico', parsedUrl.origin).toString();
        const faviconResponse = await fetch(faviconUrl, {
          signal: AbortSignal.timeout(5000),
        });

        if (faviconResponse.ok) {
          const faviconBuffer = await faviconResponse.arrayBuffer();
          faviconHash = createHash('sha256')
            .update(Buffer.from(faviconBuffer))
            .digest('hex')
            .substring(0, 16);
        }
      } catch {
        // Favicon fetch failed, not critical
      }

      // Check for common scam indicators
      const riskFactors: string[] = [];
      const htmlLower = html.toLowerCase();

      if (htmlLower.includes('airdrop') && htmlLower.includes('connect wallet')) {
        riskFactors.push('Contains airdrop and wallet connect (potential phishing)');
      }

      if (htmlLower.includes('presale') && htmlLower.includes('limited time')) {
        riskFactors.push('Urgency language with presale (potential scam)');
      }

      // Check for recently registered domain indicators
      const suspiciousPatterns = [
        'cloudflare.com/cdn-cgi/',
        'just launched',
        'act now',
        '100x guaranteed',
      ];

      for (const pattern of suspiciousPatterns) {
        if (htmlLower.includes(pattern.toLowerCase())) {
          riskFactors.push(`Contains suspicious pattern: "${pattern}"`);
        }
      }

      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high' | 'unknown' = 'low';
      if (riskFactors.length >= 2) {
        riskLevel = 'high';
      } else if (riskFactors.length === 1) {
        riskLevel = 'medium';
      }

      return {
        url,
        isReachable: true,
        title,
        contentHash,
        faviconHash,
        similarTo: [], // Would require a database of known sites
        riskLevel,
      };
    } catch (error) {
      logger.debug({ url, error }, 'Website check failed');
      return {
        url,
        isReachable: false,
        riskLevel: 'unknown',
      };
    }
  }

  // Twitter check - very limited in free mode without API access
  async checkTwitter(handle: string): Promise<TwitterCheck> {
    // Clean handle
    const cleanHandle = handle.replace(/^@/, '').trim();

    if (!cleanHandle || cleanHandle.length > 15) {
      return {
        handle: cleanHandle,
        exists: false,
        isLimited: true,
        limitedReason: 'Invalid handle format',
      };
    }

    // In free mode, we can only do very basic checks
    // Twitter API v2 requires authentication for most endpoints
    return {
      handle: cleanHandle,
      exists: true, // We cannot verify without API access
      isLimited: true,
      limitedReason: 'Twitter API access required for full verification. Free mode can only validate handle format.',
    };
  }
}
