/**
 * Notifications Health Controller
 * HubbleWave Platform - Phase 2
 */

import { Controller, Get } from '@nestjs/common';
import { Public } from '@hubblewave/auth-guard';

@Controller('notifications/health')
export class NotificationsHealthController {
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'notifications',
      timestamp: new Date().toISOString(),
      dependencies: {},
    };
  }
}
