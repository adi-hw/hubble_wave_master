import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RequestContext, TenantRequest } from '@hubblewave/auth-guard';
import { CreateRecordDto, UpdateRecordDto, ListRecordsDto, BulkUpdateDto, BulkDeleteDto } from '@hubblewave/shared-types';
import { DataService } from './data.service';

@Controller('data')
@UseGuards(JwtAuthGuard)
export class DataController {
  constructor(private readonly dataService: DataService) {}

  @Get(':table')
  async list(
    @Param('table') tableCode: string,
    @Query() query: ListRecordsDto,
    @Req() req: TenantRequest
  ) {
    const ctx: RequestContext = req.context;
    return this.dataService.list(ctx, tableCode, query);
  }

  @Get(':table/:id')
  async getOne(
    @Param('table') tableCode: string,
    @Param('id') id: string,
    @Req() req: TenantRequest
  ) {
    const ctx: RequestContext = req.context;
    return this.dataService.getOne(ctx, tableCode, id);
  }

  @Post(':table')
  async create(
    @Param('table') tableCode: string,
    @Body() body: CreateRecordDto,
    @Req() req: TenantRequest
  ) {
    const ctx: RequestContext = req.context;
    return this.dataService.create(ctx, tableCode, body.data);
  }

  @Patch(':table/bulk')
  async bulkUpdate(
    @Param('table') tableCode: string,
    @Body() body: BulkUpdateDto,
    @Req() req: TenantRequest
  ) {
    const ctx: RequestContext = req.context;
    return this.dataService.bulkUpdate(ctx, tableCode, body.ids, body.updates as Record<string, any>);
  }

  @Patch(':table/:id')
  async update(
    @Param('table') tableCode: string,
    @Param('id') id: string,
    @Body() body: UpdateRecordDto,
    @Req() req: TenantRequest
  ) {
    const ctx: RequestContext = req.context;
    return this.dataService.update(ctx, tableCode, id, body.data || {});
  }

  @Delete(':table/bulk')
  async bulkDelete(
    @Param('table') tableCode: string,
    @Body() body: BulkDeleteDto,
    @Req() req: TenantRequest
  ) {
    const ctx: RequestContext = req.context;
    return this.dataService.bulkDelete(ctx, tableCode, body.ids);
  }

  @Delete(':table/:id')
  async delete(
    @Param('table') tableCode: string,
    @Param('id') id: string,
    @Req() req: TenantRequest
  ) {
    const ctx: RequestContext = req.context;
    return this.dataService.delete(ctx, tableCode, id);
  }
}
