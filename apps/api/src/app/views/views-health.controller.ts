/**
 * Views Health Controller
 * HubbleWave Platform - Phase 2
 */

import { Controller, Get } from '@nestjs/common';
import { Public } from '@hubblewave/auth-guard';

@Controller('views/health')
export class ViewsHealthController {
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'views',
      timestamp: new Date().toISOString(),
      dependencies: {},
    };
  }
}
