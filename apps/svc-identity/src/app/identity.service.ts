import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  async createInstance(_slug: string, _name: string) {
    this.logger.warn('Multi-instance creation disabled; single-instance deployment in use.');
    return { status: 'disabled' };
  }
}
