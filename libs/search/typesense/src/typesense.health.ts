import { Client } from 'typesense';

export async function checkTypesenseHealth(
  client: Client
): Promise<{ ok: boolean }> {
  const response = await client.health.retrieve();
  return { ok: response.ok === true };
}
