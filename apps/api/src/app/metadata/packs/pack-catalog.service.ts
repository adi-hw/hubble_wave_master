import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type CatalogResponse = {
  pack: {
    code: string;
    name: string;
    description?: string | null;
    publisher?: string;
    license?: string | null;
  };
  release: {
    releaseId: string;
    manifestRevision: number;
    compatibility?: Record<string, unknown> | null;
    assets?: Record<string, unknown> | null;
    isInstallableByClient: boolean;
  };
};

type ArtifactBundle = {
  packCode: string;
  releaseId: string;
  manifest: Record<string, unknown>;
  artifactUrl: string;
  expiresInSeconds: number;
};

@Injectable()
export class PackCatalogService {
  constructor(private readonly configService: ConfigService) {}

  async listCatalog(): Promise<CatalogResponse[]> {
    return this.requestCatalog<CatalogResponse[]>('/catalog/packs');
  }

  async fetchArtifactBundle(packCode: string, releaseId: string): Promise<ArtifactBundle> {
    const path = `/catalog/packs/${encodeURIComponent(packCode)}/releases/${encodeURIComponent(releaseId)}/artifact`;
    return this.requestCatalog<ArtifactBundle>(path);
  }

  private async requestCatalog<T>(path: string): Promise<T> {
    const baseUrl = this.resolveControlPlaneBaseUrl();
    const token = this.resolveInstanceToken();
    const url = `${baseUrl}${path}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const detail = await this.safeRead(response);
      throw new BadRequestException(detail || `Control plane request failed (${response.status})`);
    }

    return response.json() as Promise<T>;
  }

  private resolveControlPlaneBaseUrl(): string {
    const baseUrl = this.configService.get<string>('CONTROL_PLANE_API_URL') || 'http://localhost:3100/api';
    return baseUrl.replace(/\/$/, '');
  }

  private resolveInstanceToken(): string {
    const token = this.configService.get<string>('CONTROL_PLANE_INSTANCE_TOKEN');
    if (!token) {
      throw new BadRequestException('CONTROL_PLANE_INSTANCE_TOKEN is not configured');
    }
    return token;
  }

  private async safeRead(response: Response): Promise<string | null> {
    try {
      const text = await response.text();
      return text ? text.slice(0, 300) : null;
    } catch {
      return null;
    }
  }
}
