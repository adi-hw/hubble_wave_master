import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LLMService } from '@hubblewave/ai';

@ApiTags('Health')
@Controller('api/health')
export class HealthController {
  constructor(private readonly llmService: LLMService) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    const timestamp = new Date().toISOString();

    try {
      const status = await this.llmService.getStatus();
      const avaRuntime = {
        status: status.available ? 'ok' : 'unreachable',
        provider: status.provider,
        model: status.defaultModel,
      };

      return {
        status: status.available ? 'ok' : 'degraded',
        service: 'svc-ava',
        timestamp,
        dependencies: {
          avaRuntime,
        },
      };
    } catch (error) {
      return {
        status: 'degraded',
        service: 'svc-ava',
        timestamp,
        dependencies: {
          avaRuntime: {
            status: 'unreachable',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      };
    }
  }
}
