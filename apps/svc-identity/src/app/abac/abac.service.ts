import { Injectable } from '@nestjs/common';

type Context = Record<string, any>;

@Injectable()
export class AbacService {
  // private readonly logger = new Logger(AbacService.name);

  async isAllowed(
    _resource: string,
    _action: string,
    _context: Context,
    _resourceType: 'table' | 'field' | 'action' = 'action',
  ) {
    // Stub implementation: Allow all for now as AbacPolicy entity is missing/deprecated
    // TODO: Re-implement ABAC with AccessRules or new policy engine if needed.
    return true;
  }
}
