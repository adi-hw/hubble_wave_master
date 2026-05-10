import { Controller, Get } from '@nestjs/common';
import { Public } from '@hubblewave/auth-guard';

@Controller('metadata/health')
export class MetadataHealthController {
  @Public()
  @Get()
  health() {
    return {
      status: 'ok',
      service: 'svc-metadata',
      timestamp: new Date().toISOString(),
      dependencies: {},
    };
  }
}
