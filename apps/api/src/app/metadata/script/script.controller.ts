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
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, RequestUser, Roles, RolesGuard } from '@hubblewave/auth-guard';
import { ScriptService, CreateScriptDto, UpdateScriptDto } from './script.service';

@Controller('collections/:collectionId/scripts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScriptController {
  constructor(private readonly scriptService: ScriptService) {}

  @Get()
  async list(@Param('collectionId', ParseUUIDPipe) collectionId: string) {
    return this.scriptService.listScripts(collectionId);
  }

  @Get(':id')
  async get(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const script = await this.scriptService.getScript(id);
    // IDOR protection: verify the script belongs to the collection in the route.
    // Use NotFoundException (not Forbidden) to avoid leaking existence.
    if (!script || script.collectionId !== collectionId) {
      throw new NotFoundException('Script not found');
    }
    return script;
  }

  @Post()
  @Roles('admin')
  async create(
    @CurrentUser() user: RequestUser,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() dto: CreateScriptDto,
  ) {
    return this.scriptService.createScript(collectionId, dto, user?.id);
  }

  @Put(':id')
  @Roles('admin')
  async update(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScriptDto,
  ) {
    const existing = await this.scriptService.getScript(id);
    if (!existing || existing.collectionId !== collectionId) {
      throw new NotFoundException('Script not found');
    }
    return this.scriptService.updateScript(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  async delete(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const existing = await this.scriptService.getScript(id);
    if (!existing || existing.collectionId !== collectionId) {
      throw new NotFoundException('Script not found');
    }
    await this.scriptService.deleteScript(id);
    return { deleted: true };
  }
}
