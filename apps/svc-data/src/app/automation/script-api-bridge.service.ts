import { Injectable } from '@nestjs/common';
import { ExecutionContext } from '../../types/automation.types';

@Injectable()
export class ScriptApiBridgeService {
  // TODO: Add DataSource injection when implementing database operations in scripts

  /**
   * Create a safe API object for the script execution context
   */
  createApi(_context: ExecutionContext) {
    return {
      log: {
        info: (message: string) => console.log(`[Script Info]: ${message}`),
        warn: (message: string) => console.warn(`[Script Warn]: ${message}`),
        error: (message: string) => console.error(`[Script Error]: ${message}`),
      },
      utils: {
        uuid: () => crypto.randomUUID(),
        now: () => new Date().toISOString(),
      },
      // In a real implementation, we would expose safe Database wrappers here.
      // For this sprint's scope, we primarily focus on logic execution and modifying the current record
      // which is passed directly in the context.
      data: {
        // Placeholder for future data API
        getRecord: async (_collection: string, _id: string) => {
           // We would implement safe fetching here
           return null;
        }
      }
    };
  }
}
