/**
 * Health Controller
 * HubbleWave Platform - Phase 2
 */

import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'svc-view-engine',
      timestamp: new Date().toISOString(),
      dependencies: {},
    };
  }
}
