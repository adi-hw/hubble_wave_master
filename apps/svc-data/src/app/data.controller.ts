import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RequestContext, InstanceRequest } from '@hubblewave/auth-guard';
import { CreateRecordDto, UpdateRecordDto, ListRecordsDto, BulkUpdateDto, BulkDeleteDto } from '@hubblewave/shared-types';
import { DataService } from './data.service';

@Controller('data')
@UseGuards(JwtAuthGuard)
export class DataController {
  constructor(private readonly dataService: DataService) {}

  @Get(':collection')
  async list(
    @Param('collection') collectionCode: string,
    @Query() query: ListRecordsDto,
    @Req() req: InstanceRequest
  ) {
    const ctx: RequestContext = req.context;
    return this.dataService.list(ctx, collectionCode, query);
  }

  @Get(':collection/:id')
  async getOne(
    @Param('collection') collectionCode: string,
    @Param('id') id: string,
    @Req() req: InstanceRequest
  ) {
    const ctx: RequestContext = req.context;
    return this.dataService.getOne(ctx, collectionCode, id);
  }

  @Post(':collection')
  async create(
    @Param('collection') collectionCode: string,
    @Body() body: CreateRecordDto,
    @Req() req: InstanceRequest
  ) {
    const ctx: RequestContext = req.context;
    return this.dataService.create(ctx, collectionCode, body.data);
  }

  @Patch(':collection/bulk')
  async bulkUpdate(
    @Param('collection') collectionCode: string,
    @Body() body: BulkUpdateDto,
    @Req() req: InstanceRequest
  ) {
    const ctx: RequestContext = req.context;
    return this.dataService.bulkUpdate(ctx, collectionCode, body.ids, body.updates as Record<string, any>);
  }

  @Patch(':collection/:id')
  async update(
    @Param('collection') collectionCode: string,
    @Param('id') id: string,
    @Body() body: UpdateRecordDto,
    @Req() req: InstanceRequest
  ) {
    const ctx: RequestContext = req.context;
    return this.dataService.update(ctx, collectionCode, id, body.data || {});
  }

  @Delete(':collection/bulk')
  async bulkDelete(
    @Param('collection') collectionCode: string,
    @Body() body: BulkDeleteDto,
    @Req() req: InstanceRequest
  ) {
    const ctx: RequestContext = req.context;
    return this.dataService.bulkDelete(ctx, collectionCode, body.ids);
  }

  @Delete(':collection/:id')
  async delete(
    @Param('collection') collectionCode: string,
    @Param('id') id: string,
    @Req() req: InstanceRequest
  ) {
    const ctx: RequestContext = req.context;
    return this.dataService.delete(ctx, collectionCode, id);
  }
}
