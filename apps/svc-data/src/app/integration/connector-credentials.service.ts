import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

@Injectable()
export class ConnectorCredentialsService {
  private readonly client: SecretsManagerClient;
  private readonly secretPrefix?: string;

  constructor(private readonly configService: ConfigService) {
    const region =
      this.configService.get<string>('CONNECTOR_SECRETS_REGION') ||
      this.configService.get<string>('AWS_REGION');
    if (!region) {
      throw new Error('CONNECTOR_SECRETS_REGION or AWS_REGION is required for connector credentials');
    }
    this.client = new SecretsManagerClient({ region });
    this.secretPrefix = this.configService.get<string>('CONNECTOR_CREDENTIALS_SECRET_PREFIX') || undefined;
  }

  async resolveCredentials(credentialRef: string): Promise<Record<string, unknown>> {
    if (!credentialRef) {
      throw new Error('credentialRef is required');
    }
    if (this.secretPrefix && !credentialRef.startsWith(this.secretPrefix)) {
      throw new Error('Credential reference is outside the allowed prefix');
    }

    const response = await this.client.send(
      new GetSecretValueCommand({ SecretId: credentialRef }),
    );
    const secretString = this.extractSecretString(response);
    const parsed = this.parseSecret(secretString);
    return parsed;
  }

  private extractSecretString(response: { SecretString?: string; SecretBinary?: Uint8Array }): string {
    if (response.SecretString) {
      return response.SecretString;
    }
    if (response.SecretBinary) {
      return Buffer.from(response.SecretBinary).toString('utf8');
    }
    throw new Error('Secret value is empty');
  }

  private parseSecret(value: string): Record<string, unknown> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      throw new Error('Credential secret must be valid JSON');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Credential secret must be a JSON object');
    }
    return parsed as Record<string, unknown>;
  }
}
