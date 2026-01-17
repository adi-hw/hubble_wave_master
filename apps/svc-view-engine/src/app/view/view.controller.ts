import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, InstanceRequest, extractContext } from '@hubblewave/auth-guard';
import { ViewService } from './view.service';
import type { ResolvedView, ViewResolveInput } from './view.types';

@Controller('views')
@UseGuards(JwtAuthGuard)
export class ViewController {
  constructor(private readonly viewService: ViewService) {}

  @Get('resolve')
  async resolve(
    @Query('route') route: string | undefined,
    @Query('kind') kind: ViewResolveInput['kind'],
    @Query('collection') collection: string | undefined,
    @Req() req: InstanceRequest,
  ): Promise<ResolvedView> {
    const authContext = extractContext(req);
    const context = await this.viewService.buildContext(authContext.userId, authContext.roles || []);
    return this.viewService.resolveView({ route, kind, collection }, context, authContext);
  }
}
