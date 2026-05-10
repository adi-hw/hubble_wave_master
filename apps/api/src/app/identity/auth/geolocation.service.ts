import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface GeoLocation {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
  org?: string;
  isVpn?: boolean;
  isProxy?: boolean;
  isTor?: boolean;
}

/**
 * Geolocation service for IP-based location lookup.
 * Uses free IP geolocation APIs with fallback.
 */
@Injectable()
export class GeolocationService {
  private readonly logger = new Logger(GeolocationService.name);
  private readonly enabled: boolean;
  private readonly cache = new Map<string, { data: GeoLocation; timestamp: number }>();
  private readonly cacheTtl = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.enabled = this.configService.get<string>('GEOLOCATION_ENABLED', 'true') !== 'false';
    if (this.enabled) {
      this.logger.log('Geolocation service enabled');
    }
  }

  /**
   * Look up geolocation for an IP address
   */
  async lookup(ip: string): Promise<GeoLocation | null> {
    if (!this.enabled) {
      return null;
    }

    // Skip private/local IPs
    if (this.isPrivateIp(ip)) {
      return {
        ip,
        city: 'Local',
        country: 'Local Network',
        countryCode: 'LO',
      };
    }

    // Check cache
    const cached = this.cache.get(ip);
    if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
      return cached.data;
    }

    // Try primary provider (ip-api.com - free, no API key needed)
    try {
      const result = await this.lookupIpApi(ip);
      if (result) {
        this.cache.set(ip, { data: result, timestamp: Date.now() });
        return result;
      }
    } catch (error) {
      this.logger.warn(`Primary geolocation lookup failed for ${ip}:`, error);
    }

    // Try fallback provider (ipapi.co - free tier)
    try {
      const result = await this.lookupIpApiCo(ip);
      if (result) {
        this.cache.set(ip, { data: result, timestamp: Date.now() });
        return result;
      }
    } catch (error) {
      this.logger.warn(`Fallback geolocation lookup failed for ${ip}:`, error);
    }

    return null;
  }

  /**
   * Primary provider: ip-api.com (free, 45 requests/minute)
   */
  private async lookupIpApi(ip: string): Promise<GeoLocation | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,timezone,isp,org,proxy,query`, {
          timeout: 5000,
        })
      );

      const data = response.data;

      if (data.status !== 'success') {
        return null;
      }

      return {
        ip: data.query || ip,
        city: data.city,
        region: data.regionName,
        country: data.country,
        countryCode: data.countryCode,
        timezone: data.timezone,
        isp: data.isp,
        org: data.org,
        isProxy: data.proxy,
      };
    } catch {
      return null;
    }
  }

  /**
   * Fallback provider: ipapi.co (free tier: 1000 requests/day)
   */
  private async lookupIpApiCo(ip: string): Promise<GeoLocation | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`https://ipapi.co/${ip}/json/`, {
          timeout: 5000,
        })
      );

      const data = response.data;

      if (data.error) {
        return null;
      }

      return {
        ip: data.ip || ip,
        city: data.city,
        region: data.region,
        country: data.country_name,
        countryCode: data.country_code,
        timezone: data.timezone,
        latitude: data.latitude,
        longitude: data.longitude,
        isp: data.org,
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if IP is private/local
   */
  private isPrivateIp(ip: string): boolean {
    // IPv4 private ranges
    if (ip.startsWith('10.') ||
        ip.startsWith('172.16.') || ip.startsWith('172.17.') || ip.startsWith('172.18.') ||
        ip.startsWith('172.19.') || ip.startsWith('172.20.') || ip.startsWith('172.21.') ||
        ip.startsWith('172.22.') || ip.startsWith('172.23.') || ip.startsWith('172.24.') ||
        ip.startsWith('172.25.') || ip.startsWith('172.26.') || ip.startsWith('172.27.') ||
        ip.startsWith('172.28.') || ip.startsWith('172.29.') || ip.startsWith('172.30.') ||
        ip.startsWith('172.31.') ||
        ip.startsWith('192.168.') ||
        ip === '127.0.0.1' ||
        ip === 'localhost' ||
        ip === '::1') {
      return true;
    }

    return false;
  }

  /**
   * Format location for display
   */
  formatLocation(geo: GeoLocation | null): string {
    if (!geo) return 'Unknown';

    const parts: string[] = [];
    if (geo.city) parts.push(geo.city);
    if (geo.region && geo.region !== geo.city) parts.push(geo.region);
    if (geo.country) parts.push(geo.country);

    return parts.length > 0 ? parts.join(', ') : 'Unknown';
  }

  /**
   * Check if location seems suspicious (VPN, proxy, Tor)
   */
  isSuspicious(geo: GeoLocation): boolean {
    return !!(geo.isVpn || geo.isProxy || geo.isTor);
  }

  /**
   * Clear the cache (for testing or memory management)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; enabled: boolean } {
    return {
      size: this.cache.size,
      enabled: this.enabled,
    };
  }
}
