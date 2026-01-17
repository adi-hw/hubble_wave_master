import { Client } from 'typesense';
import { TypesenseConfig } from './typesense.config';

export function createTypesenseClient(config: TypesenseConfig): Client {
  return new Client({
    nodes: [
      {
        host: config.host,
        port: config.port,
        protocol: config.protocol,
      },
    ],
    apiKey: config.apiKey,
    connectionTimeoutSeconds: config.connectionTimeoutSeconds,
  });
}
