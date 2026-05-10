import { Controller, Get } from '@nestjs/common';
import { Public } from '@hubblewave/auth-guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SsoProvider } from '@hubblewave/instance-db';

@Controller('identity/auth/sso')
export class SsoConfigController {
  constructor(
    @InjectRepository(SsoProvider)
    private readonly ssoProviderRepo: Repository<SsoProvider>,
  ) {}

  @Public()
  @Get('config')
  async getConfig() {
    const providers = await this.ssoProviderRepo.find({
      where: { enabled: true },
      select: ['id', 'name', 'type', 'slug', 'buttonText', 'buttonIconUrl'],
    });

    return {
      enabled: providers.length > 0,
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        slug: p.slug,
        buttonText: p.buttonText || `Sign in with ${p.name}`,
        buttonIconUrl: p.buttonIconUrl,
      })),
    };
  }
}
