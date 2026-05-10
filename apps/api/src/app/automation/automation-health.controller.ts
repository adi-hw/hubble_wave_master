import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@hubblewave/auth-guard';

@ApiTags('Health')
@Controller('automation/health')
export class AutomationHealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Automation service health check' })
  check() {
    return {
      status: 'ok',
      service: 'svc-automation',
      timestamp: new Date().toISOString(),
      dependencies: {},
    };
  }
}
