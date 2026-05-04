/**
 * Health Controller
 * HubbleWave Platform - Phase 2
 */

import { Controller, Get } from '@nestjs/common';
import { Public } from '@hubblewave/auth-guard';

@Controller('health')
export class HealthController {
  @Public()
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
