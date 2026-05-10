import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@hubblewave/auth-guard';

@ApiTags('Health')
@Controller('analytics/health')
export class AnalyticsHealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  check() {
    return {
      status: 'ok',
      service: 'analytics',
      timestamp: new Date().toISOString(),
      dependencies: {},
    };
  }
}
