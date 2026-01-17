import { Injectable, Logger } from '@nestjs/common';
import { ExecutionContext } from '../../types/automation.types';

@Injectable()
export class ScriptApiBridgeService {
  private readonly logger = new Logger(ScriptApiBridgeService.name);

  /**
   * Create a safe API object for the script execution context
   */
  createApi(_context: ExecutionContext) {
    return {
      log: {
        info: (message: string) => this.logger.log(`[Script Info]: ${message}`),
        warn: (message: string) => this.logger.warn(`[Script Warn]: ${message}`),
        error: (message: string) => this.logger.error(`[Script Error]: ${message}`),
      },
      utils: {
        uuid: () => crypto.randomUUID(),
        now: () => new Date().toISOString(),
      },
      // Data API for cross-collection lookups. Enable via automation permissions.
      data: {
        getRecord: async (_collection: string, _id: string) => {
           // Cross-collection lookups require explicit permission configuration
           return null;
        }
      }
    };
  }
}
