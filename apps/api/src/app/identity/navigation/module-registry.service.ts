import { Injectable } from '@nestjs/common';

@Injectable()
export class ModuleRegistryService {
  async getModulesByKeys(_keys: string[]) {
    return new Map<string, unknown>();
  }

  async searchModules(_query?: string, _limit?: number) {
    return [];
  }
}
