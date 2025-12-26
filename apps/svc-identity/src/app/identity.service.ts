import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  async createTenant(_slug: string, _name: string) {
    this.logger.warn('Multi-tenant creation disabled; single-instance deployment in use.');
    return { status: 'disabled' };
  }
}
