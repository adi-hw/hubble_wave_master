import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'svc-workflow',
      timestamp: new Date().toISOString(),
    };
  }
}
