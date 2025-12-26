import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

export interface HttpRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface HttpResponse<T = unknown> {
  success: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  data?: T;
  error?: string;
  duration?: number;
}

export interface IntegrationConfig {
  id: string;
  name: string;
  baseUrl: string;
  authType: 'none' | 'basic' | 'bearer' | 'api_key' | 'oauth2';
  authConfig?: {
    username?: string;
    password?: string;
    token?: string;
    apiKey?: string;
    apiKeyHeader?: string;
    clientId?: string;
    clientSecret?: string;
    tokenUrl?: string;
    scopes?: string[];
  };
  defaultHeaders?: Record<string, string>;
  timeout?: number;
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
    retryOn: number[];
  };
}

@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);
  private integrationConfigs: Map<string, IntegrationConfig> = new Map();
  private tokenCache: Map<string, { token: string; expiresAt: Date }> = new Map();

  constructor(
    private readonly eventEmitter: EventEmitter2
  ) {
    this.logger.debug(`HttpClientService initialized`);
  }

  /**
   * Register an integration configuration
   */
  registerIntegration(config: IntegrationConfig): void {
    const key = config.id;
    this.integrationConfigs.set(key, config);
  }

  /**
   * Make an HTTP request
   */
  async request<T = unknown>(
    config: HttpRequestConfig,
    integrationId?: string
  ): Promise<HttpResponse<T>> {
    const startTime = Date.now();
    let attempt = 0;
    const maxRetries = config.retries ?? 0;

    while (attempt <= maxRetries) {
      try {
        const result = await this.executeRequest<T>(config, integrationId);
        result.duration = Date.now() - startTime;

        // Log successful request
        this.eventEmitter.emit('integration.request.success', {
          integrationId,
          url: config.url,
          method: config.method,
          status: result.status,
          duration: result.duration,
        });

        return result;
      } catch (error: any) {
        attempt++;

        if (attempt > maxRetries) {
          const result: HttpResponse<T> = {
            success: false,
            error: error.message,
            duration: Date.now() - startTime,
          };

          // Log failed request
          this.eventEmitter.emit('integration.request.failed', {
            integrationId,
            url: config.url,
            method: config.method,
            error: error.message,
            attempts: attempt,
            duration: result.duration,
          });

          return result;
        }

        // Wait before retry
        const delay = config.retryDelay ?? 1000;
        await this.sleep(delay * attempt);
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  }

  /**
   * Execute a single HTTP request
   */
  private async executeRequest<T>(
    config: HttpRequestConfig,
    integrationId?: string
  ): Promise<HttpResponse<T>> {
    let url = config.url;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    // Apply integration config if specified
    if (integrationId) {
      const integration = this.integrationConfigs.get(integrationId);
      if (integration) {
        // Prepend base URL if config URL is relative
        if (!url.startsWith('http')) {
          url = `${integration.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
        }

        // Apply default headers
        Object.assign(headers, integration.defaultHeaders);

        // Apply authentication
        await this.applyAuth(headers, integration);
      }
    }

    const controller = new AbortController();
    const timeout = config.timeout ?? 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: config.method,
        headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      const contentType = response.headers.get('content-type');
      let data: T | undefined;

      if (contentType?.includes('application/json')) {
        const text = await response.text();
        if (text) {
          data = JSON.parse(text) as T;
        }
      } else {
        data = (await response.text()) as unknown as T;
      }

      // Extract response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Apply authentication to request headers
   */
  private async applyAuth(headers: Record<string, string>, config: IntegrationConfig): Promise<void> {
    switch (config.authType) {
      case 'basic':
        if (config.authConfig?.username && config.authConfig?.password) {
          const credentials = Buffer.from(
            `${config.authConfig.username}:${config.authConfig.password}`
          ).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;

      case 'bearer':
        if (config.authConfig?.token) {
          headers['Authorization'] = `Bearer ${config.authConfig.token}`;
        }
        break;

      case 'api_key':
        if (config.authConfig?.apiKey) {
          const headerName = config.authConfig.apiKeyHeader || 'X-API-Key';
          headers[headerName] = config.authConfig.apiKey;
        }
        break;

      case 'oauth2':
        const token = await this.getOAuth2Token(config);
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        break;
    }
  }

  /**
   * Get OAuth2 token (with caching)
   */
  private async getOAuth2Token(config: IntegrationConfig): Promise<string | undefined> {
    const cacheKey = config.id;
    const cached = this.tokenCache.get(cacheKey);

    if (cached && cached.expiresAt > new Date()) {
      return cached.token;
    }

    if (!config.authConfig?.tokenUrl || !config.authConfig?.clientId || !config.authConfig?.clientSecret) {
      return undefined;
    }

    try {
      const response = await fetch(config.authConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: config.authConfig.clientId,
          client_secret: config.authConfig.clientSecret,
          scope: config.authConfig.scopes?.join(' ') || '',
        }),
      });

      if (!response.ok) {
        throw new Error(`OAuth2 token request failed: ${response.status}`);
      }

      const data = (await response.json()) as {
        access_token: string;
        expires_in?: number;
      };

      const expiresIn = data.expires_in || 3600;
      const expiresAt = new Date(Date.now() + (expiresIn - 60) * 1000);

      this.tokenCache.set(cacheKey, {
        token: data.access_token,
        expiresAt,
      });

      return data.access_token;
    } catch (error: any) {
      this.logger.error(`OAuth2 token error: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Convenience methods
   */
  async get<T = unknown>(
    url: string,
    options?: Partial<HttpRequestConfig>
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'GET', ...options });
  }

  async post<T = unknown>(
    url: string,
    body?: unknown,
    options?: Partial<HttpRequestConfig>
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'POST', body, ...options });
  }

  async put<T = unknown>(
    url: string,
    body?: unknown,
    options?: Partial<HttpRequestConfig>
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'PUT', body, ...options });
  }

  async patch<T = unknown>(
    url: string,
    body?: unknown,
    options?: Partial<HttpRequestConfig>
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'PATCH', body, ...options });
  }

  async delete<T = unknown>(
    url: string,
    options?: Partial<HttpRequestConfig>
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'DELETE', ...options });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============ Event Handlers ============

  @OnEvent('api.call')
  async handleApiCall(payload: any): Promise<void> {
    const result = await this.request({
      url: payload.endpoint,
      method: payload.method || 'POST',
      headers: payload.headers,
      body: payload.body,
      timeout: payload.timeout,
    });

    if (payload.callback) {
      payload.callback(result.success ? null : new Error(result.error), result.data);
    }

    // Emit result event
    this.eventEmitter.emit('api.call.completed', {
      endpoint: payload.endpoint,
      success: result.success,
      status: result.status,
      duration: result.duration,
    });
  }

  @OnEvent('http.request')
  async handleHttpRequest(payload: any): Promise<void> {
    const result = await this.request({
      url: payload.url,
      method: payload.method || 'GET',
      headers: payload.headers,
      body: payload.body,
      timeout: payload.timeout,
    });

    if (payload.callback) {
      payload.callback(result.success ? null : new Error(result.error), result.data);
    }
  }
}
