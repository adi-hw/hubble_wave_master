import { z } from 'zod';

const protocolSchema = z.enum(['http', 'https']);

export interface TypesenseConfig {
  host: string;
  port: number;
  protocol: z.infer<typeof protocolSchema>;
  apiKey: string;
  connectionTimeoutSeconds: number;
}

export function loadTypesenseConfig(
  env: Record<string, string | undefined> = process.env
): TypesenseConfig {
  const isProd = env.NODE_ENV === 'production';
  const host = env.TYPESENSE_HOST || 'localhost';
  const port = parseInt(env.TYPESENSE_PORT || '8108', 10);
  const protocol = protocolSchema.parse(env.TYPESENSE_PROTOCOL || 'http');
  const apiKey = env.TYPESENSE_API_KEY || '';
  const connectionTimeoutSeconds = parseInt(env.TYPESENSE_TIMEOUT || '5', 10);

  if (isProd && !apiKey) {
    throw new Error('TYPESENSE_API_KEY must be set in production');
  }

  return {
    host,
    port,
    protocol,
    apiKey,
    connectionTimeoutSeconds,
  };
}
