import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  JwtAuthGuard,
  PermissionsGuard,
  RequestUser,
  RequirePermission,
} from '@hubblewave/auth-guard';
import {
  CreateGuidedProcessDto,
  GuidedProcessService,
  UpdateGuidedProcessDto,
} from './guided-process.service';

@Controller('collections/:collectionId/guided-processes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GuidedProcessController {
  constructor(private readonly service: GuidedProcessService) {}

  @Get()
  @RequirePermission(['collection.read', 'metadata.flows.edit'], 'any')
  async list(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const processes = await this.service.list(collectionId, includeInactive === 'true');
    return { data: processes };
  }

  @Get(':id')
  @RequirePermission(['collection.read', 'metadata.flows.edit'], 'any')
  async get(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const process = await this.service.get(id);
    if (process.collectionId !== collectionId) {
      throw new NotFoundException('Guided Process not found in this Collection');
    }
    return process;
  }

  @Post()
  @RequirePermission('metadata.flows.edit')
  async create(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() dto: CreateGuidedProcessDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (!user?.id) throw new NotFoundException('User context missing');
    return this.service.create(collectionId, dto, user.id);
  }

  @Put(':id')
  @RequirePermission('metadata.flows.edit')
  async update(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGuidedProcessDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (!user?.id) throw new NotFoundException('User context missing');
    const existing = await this.service.get(id);
    if (existing.collectionId !== collectionId) {
      throw new NotFoundException('Guided Process not found in this Collection');
    }
    return this.service.update(id, dto, user.id);
  }

  @Put(':id/structure')
  @RequirePermission('metadata.flows.edit')
  async replaceStructure(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { stages: CreateGuidedProcessDto['stages'] },
    @CurrentUser() user: RequestUser,
  ) {
    if (!user?.id) throw new NotFoundException('User context missing');
    const existing = await this.service.get(id);
    if (existing.collectionId !== collectionId) {
      throw new NotFoundException('Guided Process not found in this Collection');
    }
    return this.service.replaceStructure(id, dto.stages, user.id);
  }

  @Post(':id/publish')
  @RequirePermission('metadata.flows.edit')
  @HttpCode(HttpStatus.OK)
  async publish(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (!user?.id) throw new NotFoundException('User context missing');
    const existing = await this.service.get(id);
    if (existing.collectionId !== collectionId) {
      throw new NotFoundException('Guided Process not found in this Collection');
    }
    return this.service.publish(id, user.id);
  }

  @Delete(':id')
  @RequirePermission('metadata.flows.edit')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const existing = await this.service.get(id);
    if (existing.collectionId !== collectionId) {
      throw new NotFoundException('Guided Process not found in this Collection');
    }
    await this.service.delete(id);
  }
}
