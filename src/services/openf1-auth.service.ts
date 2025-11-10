import axios from 'axios';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Token information returned from OpenF1 OAuth2
 */
interface TokenInfo {
  access_token: string;
  token_type: string;
  expires_in: number; // seconds
  refresh_token?: string;
  scope?: string;
}

/**
 * Cached token with expiry tracking
 */
interface CachedToken {
  accessToken: string;
  expiresAt: number; // timestamp in milliseconds
  refreshToken?: string;
}

/**
 * OpenF1 Authentication Service
 * 
 * ⚠️ IMPORTANT: This service is ONLY required for real-time MQTT streaming,
 * which requires a paid OpenF1 account (https://openf1.org/pricing).
 * 
 * ALL HISTORICAL REST API DATA IS FREE and does not require authentication!
 * 
 * Manages OAuth2 authentication for OpenF1 API access
 * Handles token caching, expiry, and automatic refresh
 */
export class OpenF1AuthService {
  private static instance: OpenF1AuthService;
  private tokenCache: CachedToken | null = null;
  private readonly TOKEN_BUFFER_SECONDS = 60; // Refresh 60s before expiry
  private readonly OAUTH_URL = 'https://api.openf1.org/oauth/token';
  
  private constructor() {}
  
  /**
   * Get singleton instance
   */
  public static getInstance(): OpenF1AuthService {
    if (!OpenF1AuthService.instance) {
      OpenF1AuthService.instance = new OpenF1AuthService();
    }
    return OpenF1AuthService.instance;
  }
  
  /**
   * Get valid access token
   * Returns cached token if valid, otherwise fetches new one
   * 
   * ⚠️ Only needed for MQTT streaming (paid account required)
   * Historical REST API data works WITHOUT authentication!
   */
  public async getAccessToken(): Promise<string> {
    // Check if we have valid credentials configured
    if (!config.openf1Username || !config.openf1Password) {
      throw new Error('OpenF1 credentials not configured. MQTT streaming requires a paid account. Apply at https://openf1.org/pricing. Historical REST API data is FREE and works without credentials.');
    }
    
    // Check if cached token is still valid
    if (this.isTokenValid()) {
      logger.debug('Using cached OpenF1 access token');
      return this.tokenCache!.accessToken;
    }
    
    // Token expired or doesn't exist - fetch new one
    logger.info('Fetching new OpenF1 access token');
    return await this.fetchNewToken();
  }
  
  /**
   * Check if cached token is valid and not expired
   */
  private isTokenValid(): boolean {
    if (!this.tokenCache) {
      return false;
    }
    
    const now = Date.now();
    const bufferMs = this.TOKEN_BUFFER_SECONDS * 1000;
    
    // Token is valid if it hasn't expired (with buffer)
    return this.tokenCache.expiresAt > (now + bufferMs);
  }
  
  /**
   * Fetch new access token from OpenF1 OAuth2 endpoint
   */
  private async fetchNewToken(): Promise<string> {
    try {
      const response = await axios.post<TokenInfo>(
        this.OAUTH_URL,
        {
          grant_type: 'password',
          username: config.openf1Username,
          password: config.openf1Password,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        }
      );
      
      const tokenInfo = response.data;
      
      // Cache the token
      const expiresAt = Date.now() + (tokenInfo.expires_in * 1000);
      this.tokenCache = {
        accessToken: tokenInfo.access_token,
        expiresAt,
        refreshToken: tokenInfo.refresh_token,
      };
      
      logger.info('Successfully authenticated with OpenF1', {
        expiresIn: tokenInfo.expires_in,
        expiresAt: new Date(expiresAt).toISOString(),
      });
      
      return tokenInfo.access_token;
    } catch (error) {
      logger.error('Failed to fetch OpenF1 access token', { error });
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Invalid OpenF1 credentials. Check OPENF1_USERNAME and OPENF1_PASSWORD.');
        }
        if (error.response?.status === 429) {
          throw new Error('OpenF1 rate limit exceeded. Try again later.');
        }
      }
      
      throw new Error(`Failed to authenticate with OpenF1: ${error}`);
    }
  }
  
  /**
   * Manually invalidate cached token (e.g., on 401 response)
   */
  public invalidateToken(): void {
    logger.info('Invalidating cached OpenF1 token');
    this.tokenCache = null;
  }
  
  /**
   * Check if authentication is enabled
   */
  public isAuthEnabled(): boolean {
    return !!(config.openf1Username && config.openf1Password);
  }
  
  /**
   * Get token expiry information for debugging
   */
  public getTokenInfo(): { hasToken: boolean; expiresAt?: string; isValid: boolean } {
    if (!this.tokenCache) {
      return { hasToken: false, isValid: false };
    }
    
    return {
      hasToken: true,
      expiresAt: new Date(this.tokenCache.expiresAt).toISOString(),
      isValid: this.isTokenValid(),
    };
  }
}

// Export singleton instance
export const openf1Auth = OpenF1AuthService.getInstance();
