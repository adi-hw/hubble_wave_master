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
  CreateDecisionTableDto,
  DecisionTableService,
  EvaluateInput,
  UpdateDecisionTableDto,
  UpsertRowDto,
} from './decision-table.service';

@Controller('collections/:collectionId/decision-tables')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DecisionTableController {
  constructor(private readonly service: DecisionTableService) {}

  @Get()
  @RequirePermission(['metadata:collection:read', 'metadata:flow:manage'], 'any')
  async list(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const tables = await this.service.list(collectionId, includeInactive === 'true');
    return { data: tables };
  }

  @Get(':id')
  @RequirePermission(['metadata:collection:read', 'metadata:flow:manage'], 'any')
  async get(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const table = await this.service.get(id);
    if (table.collectionId !== collectionId) {
      throw new NotFoundException('Decision Table not found in this Collection');
    }
    return table;
  }

  @Post()
  @RequirePermission('metadata:flow:manage')
  async create(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() dto: CreateDecisionTableDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (!user?.id) throw new NotFoundException('User context missing');
    return this.service.create(collectionId, dto, user.id);
  }

  @Put(':id')
  @RequirePermission('metadata:flow:manage')
  async update(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDecisionTableDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (!user?.id) throw new NotFoundException('User context missing');
    const existing = await this.service.get(id);
    if (existing.collectionId !== collectionId) {
      throw new NotFoundException('Decision Table not found in this Collection');
    }
    return this.service.update(id, dto, user.id);
  }

  @Post(':id/publish')
  @RequirePermission('metadata:flow:manage')
  @HttpCode(HttpStatus.OK)
  async publish(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (!user?.id) throw new NotFoundException('User context missing');
    const existing = await this.service.get(id);
    if (existing.collectionId !== collectionId) {
      throw new NotFoundException('Decision Table not found in this Collection');
    }
    return this.service.publish(id, user.id);
  }

  @Delete(':id')
  @RequirePermission('metadata:flow:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const existing = await this.service.get(id);
    if (existing.collectionId !== collectionId) {
      throw new NotFoundException('Decision Table not found in this Collection');
    }
    await this.service.delete(id);
  }

  @Post(':id/rows')
  @RequirePermission('metadata:flow:manage')
  async createRow(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertRowDto,
  ) {
    const table = await this.service.get(id);
    if (table.collectionId !== collectionId) {
      throw new NotFoundException('Decision Table not found in this Collection');
    }
    return this.service.upsertRow(id, null, dto);
  }

  @Put(':id/rows/:rowId')
  @RequirePermission('metadata:flow:manage')
  async updateRow(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
    @Body() dto: UpsertRowDto,
  ) {
    const table = await this.service.get(id);
    if (table.collectionId !== collectionId) {
      throw new NotFoundException('Decision Table not found in this Collection');
    }
    return this.service.upsertRow(id, rowId, dto);
  }

  @Delete(':id/rows/:rowId')
  @RequirePermission('metadata:flow:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRow(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
  ): Promise<void> {
    const table = await this.service.get(id);
    if (table.collectionId !== collectionId) {
      throw new NotFoundException('Decision Table not found in this Collection');
    }
    await this.service.deleteRow(id, rowId);
  }

  /**
   * Evaluate the table against caller-supplied inputs. Used by the
   * Flow Action `MakeDecision` and by ad-hoc admin testing.
   * Requires `metadata:collection:read` since evaluation is observational
   * (no state mutation).
   */
  @Post(':id/evaluate')
  @RequirePermission(['metadata:collection:read', 'metadata:flow:manage'], 'any')
  @HttpCode(HttpStatus.OK)
  async evaluate(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EvaluateInput,
  ) {
    const table = await this.service.get(id);
    if (table.collectionId !== collectionId) {
      throw new NotFoundException('Decision Table not found in this Collection');
    }
    return this.service.evaluate(id, body);
  }

  /**
   * Editor-only evaluation against a draft table. Used by the
   * DecisionTableEditor's Test runner so authors can verify rows
   * before publish. Tighter gate than `evaluate`: requires
   * `metadata:flow:manage` (no `metadata:collection:read` fallback) so
   * runtime callers cannot skip the published-status check.
   */
  @Post(':id/evaluate-draft')
  @RequirePermission('metadata:flow:manage')
  @HttpCode(HttpStatus.OK)
  async evaluateDraft(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EvaluateInput,
  ) {
    const table = await this.service.get(id);
    if (table.collectionId !== collectionId) {
      throw new NotFoundException('Decision Table not found in this Collection');
    }
    return this.service.evaluateDraft(id, body);
  }
}
