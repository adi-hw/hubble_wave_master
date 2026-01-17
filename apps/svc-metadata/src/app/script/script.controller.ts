import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';
import { ScriptService, CreateScriptDto, UpdateScriptDto } from './script.service';

@Controller('collections/:collectionId/scripts')
@UseGuards(JwtAuthGuard)
export class ScriptController {
  constructor(private readonly scriptService: ScriptService) {}

  @Get()
  async list(@Param('collectionId', ParseUUIDPipe) collectionId: string) {
    return this.scriptService.listScripts(collectionId);
  }

  @Get(':id')
  async get(
    @Param('collectionId', ParseUUIDPipe) _collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scriptService.getScript(id);
  }

  @Post()
  async create(
    @CurrentUser() user: RequestUser,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() dto: CreateScriptDto,
  ) {
    return this.scriptService.createScript(collectionId, dto, user?.id);
  }

  @Put(':id')
  async update(
    @Param('collectionId', ParseUUIDPipe) _collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScriptDto,
  ) {
    return this.scriptService.updateScript(id, dto);
  }

  @Delete(':id')
  async delete(
    @Param('collectionId', ParseUUIDPipe) _collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.scriptService.deleteScript(id);
    return { deleted: true };
  }
}
