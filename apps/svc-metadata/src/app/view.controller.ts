import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@eam-platform/auth-guard';
import {
  ViewService,
  CreateViewDto,
  UpdateViewDto,
  CreateViewColumnDto,
  CreateFormLayoutDto,
  UpdateFormLayoutDto,
} from './view.service';
import { ViewType, FilterCondition, SortConfig } from '@eam-platform/tenant-db';

@Controller('views')
@UseGuards(JwtAuthGuard)
export class ViewController {
  constructor(private readonly viewService: ViewService) {}

  // ============ VIEW DEFINITIONS ============

  @Get()
  async listAllViews(@CurrentUser() user: RequestUser) {
    return this.viewService.listAllViews(user.tenantId, user.id);
  }

  @Get('collection/:collectionId')
  async listViews(
    @Param('collectionId') collectionId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.viewService.listViews(user.tenantId, collectionId, user.id);
  }

  @Get(':viewId')
  async getView(@Param('viewId') viewId: string, @CurrentUser() user: RequestUser) {
    return this.viewService.getView(user.tenantId, viewId);
  }

  @Get(':viewId/full')
  async getViewWithColumns(@Param('viewId') viewId: string, @CurrentUser() user: RequestUser) {
    return this.viewService.getViewWithColumns(user.tenantId, viewId);
  }

  @Get('collection/:collectionId/default')
  async getDefaultView(
    @Param('collectionId') collectionId: string,
    @Query('type') viewType: ViewType = 'list',
    @CurrentUser() user: RequestUser
  ) {
    return this.viewService.getDefaultView(user.tenantId, collectionId, viewType);
  }

  @Post()
  async createView(@Body() dto: CreateViewDto, @CurrentUser() user: RequestUser) {
    return this.viewService.createView(user.tenantId, dto, user.id);
  }

  @Put(':viewId')
  async updateView(
    @Param('viewId') viewId: string,
    @Body() dto: UpdateViewDto,
    @CurrentUser() user: RequestUser
  ) {
    return this.viewService.updateView(user.tenantId, viewId, dto, user.id);
  }

  @Delete(':viewId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteView(@Param('viewId') viewId: string, @CurrentUser() user: RequestUser) {
    await this.viewService.deleteView(user.tenantId, viewId, user.id);
  }

  // ============ VIEW COLUMNS ============

  @Get(':viewId/columns')
  async getViewColumns(@Param('viewId') viewId: string, @CurrentUser() user: RequestUser) {
    return this.viewService.getViewColumns(user.tenantId, viewId);
  }

  @Put(':viewId/columns')
  async setViewColumns(
    @Param('viewId') viewId: string,
    @Body() columns: CreateViewColumnDto[],
    @CurrentUser() user: RequestUser
  ) {
    return this.viewService.setViewColumns(user.tenantId, viewId, columns);
  }

  @Put(':viewId/columns/reorder')
  async reorderViewColumns(
    @Param('viewId') viewId: string,
    @Body() columnOrders: { id: string; sortOrder: number }[],
    @CurrentUser() user: RequestUser
  ) {
    return this.viewService.reorderViewColumns(user.tenantId, viewId, columnOrders);
  }

  // ============ FORM LAYOUTS ============

  @Get('forms/collection/:collectionId')
  async listFormLayouts(
    @Param('collectionId') collectionId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.viewService.listFormLayouts(user.tenantId, collectionId);
  }

  @Get('forms/:layoutId')
  async getFormLayout(@Param('layoutId') layoutId: string, @CurrentUser() user: RequestUser) {
    return this.viewService.getFormLayout(user.tenantId, layoutId);
  }

  @Get('forms/collection/:collectionId/default')
  async getDefaultFormLayout(
    @Param('collectionId') collectionId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.viewService.getDefaultFormLayout(user.tenantId, collectionId);
  }

  @Post('forms')
  async createFormLayout(@Body() dto: CreateFormLayoutDto, @CurrentUser() user: RequestUser) {
    return this.viewService.createFormLayout(user.tenantId, dto, user.id);
  }

  @Put('forms/:layoutId')
  async updateFormLayout(
    @Param('layoutId') layoutId: string,
    @Body() dto: UpdateFormLayoutDto,
    @CurrentUser() user: RequestUser
  ) {
    return this.viewService.updateFormLayout(user.tenantId, layoutId, dto, user.id);
  }

  @Delete('forms/:layoutId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFormLayout(@Param('layoutId') layoutId: string, @CurrentUser() user: RequestUser) {
    await this.viewService.deleteFormLayout(user.tenantId, layoutId, user.id);
  }

  // ============ SAVED FILTERS ============

  @Get('filters/collection/:collectionId')
  async listSavedFilters(
    @Param('collectionId') collectionId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.viewService.listSavedFilters(user.tenantId, collectionId, user.id);
  }

  @Post('filters')
  async createSavedFilter(
    @Body()
    dto: {
      collectionId: string;
      code: string;
      label: string;
      conditions: FilterCondition[];
      isPersonal?: boolean;
      icon?: string;
      color?: string;
    },
    @CurrentUser() user: RequestUser
  ) {
    return this.viewService.createSavedFilter(
      user.tenantId,
      { ...dto, ownerId: dto.isPersonal ? user.id : undefined },
      user.id
    );
  }

  @Post('filters/:filterId/use')
  @HttpCode(HttpStatus.OK)
  async incrementFilterUsage(
    @Param('filterId') filterId: string,
    @CurrentUser() user: RequestUser
  ) {
    await this.viewService.incrementFilterUsage(user.tenantId, filterId);
    return { success: true };
  }

  // ============ USER VIEW PREFERENCES ============

  @Get(':viewId/preferences')
  async getUserViewPreferences(@Param('viewId') viewId: string, @CurrentUser() user: RequestUser) {
    return this.viewService.getUserViewPreferences(user.tenantId, user.id, viewId);
  }

  @Put(':viewId/preferences')
  async saveUserViewPreferences(
    @Param('viewId') viewId: string,
    @Body()
    preferences: {
      columnOrder?: string[];
      columnWidths?: Record<string, number>;
      hiddenColumns?: string[];
      filters?: FilterCondition[];
      sortConfig?: SortConfig[];
    },
    @CurrentUser() user: RequestUser
  ) {
    return this.viewService.saveUserViewPreferences(user.tenantId, user.id, viewId, preferences);
  }

  @Delete(':viewId/preferences')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetUserViewPreferences(
    @Param('viewId') viewId: string,
    @CurrentUser() user: RequestUser
  ) {
    await this.viewService.resetUserViewPreferences(user.tenantId, user.id, viewId);
  }
}
