import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import {
  TenantDbService,
  ViewDefinition,
  ViewColumn,
  ViewType,
  SortConfig,
  FilterCondition,
  QuickFilter,
  RowAction,
  BoardConfig,
  CalendarConfig,
  TimelineConfig,
  FormLayout,
  FormSection,
  LayoutType,
  SavedFilter,
  UserViewPreference,
  CellFormatter,
  CellRenderer,
  AggregateFunction,
  ColumnAlignment,
} from '@eam-platform/tenant-db';
import { IsNull } from 'typeorm';

// View DTOs
export interface CreateViewDto {
  collectionId: string;
  code: string;
  label: string;
  description?: string;
  viewType?: ViewType;
  isDefault?: boolean;
  isPersonal?: boolean;
  ownerId?: string;
  roleIds?: string[];
  conditions?: FilterCondition[];
  sortConfig?: SortConfig[];
  groupBy?: string;
  pageSize?: number;
  quickFilters?: QuickFilter[];
  rowActions?: RowAction[];
  bulkActions?: RowAction[];
  boardConfig?: BoardConfig;
  calendarConfig?: CalendarConfig;
  timelineConfig?: TimelineConfig;
  sortOrder?: number;
}

export interface UpdateViewDto {
  label?: string;
  description?: string;
  isDefault?: boolean;
  roleIds?: string[];
  conditions?: FilterCondition[];
  sortConfig?: SortConfig[];
  groupBy?: string;
  pageSize?: number;
  quickFilters?: QuickFilter[];
  rowActions?: RowAction[];
  bulkActions?: RowAction[];
  boardConfig?: BoardConfig;
  calendarConfig?: CalendarConfig;
  timelineConfig?: TimelineConfig;
  sortOrder?: number;
}

export interface CreateViewColumnDto {
  viewId: string;
  propertyId?: string;
  propertyCode?: string;
  label?: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  isVisible?: boolean;
  isSortable?: boolean;
  isFilterable?: boolean;
  isResizable?: boolean;
  isFrozen?: boolean;
  isPinnedLeft?: boolean;
  isPinnedRight?: boolean;
  sortOrder?: number;
  alignment?: ColumnAlignment;
  formatter?: CellFormatter;
  formatterOptions?: Record<string, unknown>;
  cellRenderer?: CellRenderer;
  cellRendererOptions?: Record<string, unknown>;
  headerTooltip?: string;
  aggregateFunction?: AggregateFunction;
  wrapText?: boolean;
}

// Form Layout DTOs
export interface CreateFormLayoutDto {
  collectionId: string;
  code: string;
  label: string;
  description?: string;
  layoutType?: LayoutType;
  isDefault?: boolean;
  conditions?: FilterCondition[];
  roleIds?: string[];
  sections: FormSection[];
  sortOrder?: number;
}

export interface UpdateFormLayoutDto {
  label?: string;
  description?: string;
  isDefault?: boolean;
  conditions?: FilterCondition[];
  roleIds?: string[];
  sections?: FormSection[];
  sortOrder?: number;
}

@Injectable()
export class ViewService {
  constructor(private readonly tenantDb: TenantDbService) {}

  // View Repository helpers
  private async viewRepo(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return ds.getRepository(ViewDefinition);
  }

  private async columnRepo(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return ds.getRepository(ViewColumn);
  }

  private async formLayoutRepo(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return ds.getRepository(FormLayout);
  }

  private async savedFilterRepo(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return ds.getRepository(SavedFilter);
  }

  private async userPrefRepo(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return ds.getRepository(UserViewPreference);
  }

  // ============ VIEW DEFINITIONS ============

  async listAllViews(tenantId: string, userId?: string) {
    const repo = await this.viewRepo(tenantId);

    const qb = repo
      .createQueryBuilder('v')
      .where('v.deleted_at IS NULL')
      .andWhere('(v.is_personal = false OR v.owner_id = :userId)', { userId });

    return qb.orderBy('v.collection_id', 'ASC').addOrderBy('v.sort_order', 'ASC').addOrderBy('v.label', 'ASC').getMany();
  }

  async listViews(tenantId: string, collectionId: string, userId?: string) {
    const repo = await this.viewRepo(tenantId);

    const qb = repo
      .createQueryBuilder('v')
      .where('v.collection_id = :collectionId', { collectionId })
      .andWhere('v.deleted_at IS NULL')
      .andWhere('(v.is_personal = false OR v.owner_id = :userId)', { userId });

    return qb.orderBy('v.sort_order', 'ASC').addOrderBy('v.label', 'ASC').getMany();
  }

  async getView(tenantId: string, viewId: string) {
    const repo = await this.viewRepo(tenantId);
    const view = await repo.findOne({
      where: { id: viewId, deletedAt: IsNull() },
    });

    if (!view) {
      throw new NotFoundException(`View ${viewId} not found`);
    }

    return view;
  }

  async getViewWithColumns(tenantId: string, viewId: string) {
    const view = await this.getView(tenantId, viewId);
    const columns = await this.getViewColumns(tenantId, viewId);

    return { ...view, columns };
  }

  async getDefaultView(tenantId: string, collectionId: string, viewType: ViewType = 'list') {
    const repo = await this.viewRepo(tenantId);

    const view = await repo.findOne({
      where: {
        collectionId,
        viewType,
        isDefault: true,
        deletedAt: IsNull(),
      },
    });

    if (!view) {
      // Return first non-personal view of this type
      return repo.findOne({
        where: {
          collectionId,
          viewType,
          isPersonal: false,
          deletedAt: IsNull(),
        },
        order: { sortOrder: 'ASC' },
      });
    }

    return view;
  }

  async createView(tenantId: string, dto: CreateViewDto, createdBy?: string) {
    const repo = await this.viewRepo(tenantId);

    // Check for duplicate code
    const existing = await repo.findOne({
      where: { collectionId: dto.collectionId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`View '${dto.code}' already exists`);
    }

    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await repo.update(
        { collectionId: dto.collectionId, viewType: dto.viewType || 'list', isDefault: true },
        { isDefault: false }
      );
    }

    const view = repo.create({
      ...dto,
      viewType: dto.viewType ?? 'list',
      isDefault: dto.isDefault ?? false,
      isPersonal: dto.isPersonal ?? false,
      roleIds: dto.roleIds ?? [],
      conditions: dto.conditions ?? [],
      sortConfig: dto.sortConfig ?? [],
      pageSize: dto.pageSize ?? 20,
      quickFilters: dto.quickFilters ?? [],
      rowActions: dto.rowActions ?? [],
      bulkActions: dto.bulkActions ?? [],
      sortOrder: dto.sortOrder ?? 0,
      metadata: {},
      savedFilters: [],
      createdBy,
      updatedBy: createdBy,
    });

    return repo.save(view);
  }

  async updateView(tenantId: string, viewId: string, dto: UpdateViewDto, updatedBy?: string) {
    const repo = await this.viewRepo(tenantId);
    const view = await this.getView(tenantId, viewId);

    if (view.isSystem) {
      throw new ConflictException('Cannot modify system views');
    }

    // If setting as default, unset other defaults
    if (dto.isDefault && !view.isDefault) {
      await repo.update(
        { collectionId: view.collectionId, viewType: view.viewType, isDefault: true },
        { isDefault: false }
      );
    }

    Object.assign(view, dto, {
      updatedBy,
      version: view.version + 1,
    });

    return repo.save(view);
  }

  async deleteView(tenantId: string, viewId: string, deletedBy?: string) {
    const repo = await this.viewRepo(tenantId);
    const view = await this.getView(tenantId, viewId);

    if (view.isSystem) {
      throw new ConflictException('Cannot delete system views');
    }

    view.deletedAt = new Date();
    view.updatedBy = deletedBy;

    return repo.save(view);
  }

  // ============ VIEW COLUMNS ============

  async getViewColumns(tenantId: string, viewId: string) {
    const repo = await this.columnRepo(tenantId);

    return repo.find({
      where: { viewId },
      order: { sortOrder: 'ASC' },
    });
  }

  async setViewColumns(tenantId: string, viewId: string, columns: CreateViewColumnDto[]) {
    const repo = await this.columnRepo(tenantId);

    // Delete existing columns
    await repo.delete({ viewId });

    // Create new columns
    const newColumns = columns.map((col, idx) =>
      repo.create({
        ...col,
        viewId,
        sortOrder: col.sortOrder ?? idx * 10,
        isVisible: col.isVisible ?? true,
        isSortable: col.isSortable ?? true,
        isFilterable: col.isFilterable ?? true,
        isResizable: col.isResizable ?? true,
        isFrozen: col.isFrozen ?? false,
        isPinnedLeft: col.isPinnedLeft ?? false,
        isPinnedRight: col.isPinnedRight ?? false,
        alignment: col.alignment ?? 'left',
        formatterOptions: col.formatterOptions ?? {},
        cellRendererOptions: col.cellRendererOptions ?? {},
        wrapText: col.wrapText ?? false,
      })
    );

    return repo.save(newColumns);
  }

  async reorderViewColumns(tenantId: string, viewId: string, columnOrders: { id: string; sortOrder: number }[]) {
    const repo = await this.columnRepo(tenantId);

    await Promise.all(
      columnOrders.map(({ id, sortOrder }) => repo.update({ id, viewId }, { sortOrder }))
    );

    return this.getViewColumns(tenantId, viewId);
  }

  // ============ FORM LAYOUTS ============

  async listFormLayouts(tenantId: string, collectionId: string) {
    const repo = await this.formLayoutRepo(tenantId);

    return repo.find({
      where: { collectionId, deletedAt: IsNull() },
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
  }

  async getFormLayout(tenantId: string, layoutId: string) {
    const repo = await this.formLayoutRepo(tenantId);
    const layout = await repo.findOne({
      where: { id: layoutId, deletedAt: IsNull() },
    });

    if (!layout) {
      throw new NotFoundException(`Form layout ${layoutId} not found`);
    }

    return layout;
  }

  async getDefaultFormLayout(tenantId: string, collectionId: string) {
    const repo = await this.formLayoutRepo(tenantId);

    const layout = await repo.findOne({
      where: { collectionId, isDefault: true, deletedAt: IsNull() },
    });

    if (!layout) {
      return repo.findOne({
        where: { collectionId, deletedAt: IsNull() },
        order: { sortOrder: 'ASC' },
      });
    }

    return layout;
  }

  async createFormLayout(tenantId: string, dto: CreateFormLayoutDto, createdBy?: string) {
    const repo = await this.formLayoutRepo(tenantId);

    const existing = await repo.findOne({
      where: { collectionId: dto.collectionId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Form layout '${dto.code}' already exists`);
    }

    if (dto.isDefault) {
      await repo.update(
        { collectionId: dto.collectionId, isDefault: true },
        { isDefault: false }
      );
    }

    const layout = repo.create({
      ...dto,
      layoutType: dto.layoutType ?? 'standard',
      isDefault: dto.isDefault ?? false,
      conditions: dto.conditions ?? [],
      roleIds: dto.roleIds ?? [],
      sortOrder: dto.sortOrder ?? 0,
      headerConfig: {},
      footerConfig: {},
      sidebarConfig: {},
      actionsConfig: {},
      relatedLists: [],
      metadata: {},
      createdBy,
      updatedBy: createdBy,
    });

    return repo.save(layout);
  }

  async updateFormLayout(tenantId: string, layoutId: string, dto: UpdateFormLayoutDto, updatedBy?: string) {
    const repo = await this.formLayoutRepo(tenantId);
    const layout = await this.getFormLayout(tenantId, layoutId);

    if (layout.isSystem) {
      throw new ConflictException('Cannot modify system form layouts');
    }

    if (dto.isDefault && !layout.isDefault) {
      await repo.update(
        { collectionId: layout.collectionId, isDefault: true },
        { isDefault: false }
      );
    }

    Object.assign(layout, dto, {
      updatedBy,
      version: layout.version + 1,
    });

    return repo.save(layout);
  }

  async deleteFormLayout(tenantId: string, layoutId: string, deletedBy?: string) {
    const repo = await this.formLayoutRepo(tenantId);
    const layout = await this.getFormLayout(tenantId, layoutId);

    if (layout.isSystem) {
      throw new ConflictException('Cannot delete system form layouts');
    }

    layout.deletedAt = new Date();
    layout.updatedBy = deletedBy;

    return repo.save(layout);
  }

  // ============ SAVED FILTERS ============

  async listSavedFilters(tenantId: string, collectionId: string, userId?: string) {
    const repo = await this.savedFilterRepo(tenantId);

    return repo
      .createQueryBuilder('f')
      .where('f.collection_id = :collectionId', { collectionId })
      .andWhere('f.deleted_at IS NULL')
      .andWhere('(f.is_personal = false OR f.owner_id = :userId)', { userId })
      .orderBy('f.sort_order', 'ASC')
      .addOrderBy('f.usage_count', 'DESC')
      .getMany();
  }

  async createSavedFilter(
    tenantId: string,
    dto: {
      collectionId: string;
      code: string;
      label: string;
      conditions: FilterCondition[];
      isPersonal?: boolean;
      ownerId?: string;
      icon?: string;
      color?: string;
    },
    createdBy?: string
  ) {
    const repo = await this.savedFilterRepo(tenantId);

    const filter = repo.create({
      ...dto,
      isPersonal: dto.isPersonal ?? false,
      roleIds: [],
      sortOrder: 0,
      usageCount: 0,
      createdBy,
      updatedBy: createdBy,
    });

    return repo.save(filter);
  }

  async incrementFilterUsage(tenantId: string, filterId: string) {
    const repo = await this.savedFilterRepo(tenantId);
    await repo.increment({ id: filterId }, 'usageCount', 1);
    await repo.update({ id: filterId }, { lastUsedAt: new Date() });
  }

  // ============ USER VIEW PREFERENCES ============

  async getUserViewPreferences(tenantId: string, userId: string, viewId: string) {
    const repo = await this.userPrefRepo(tenantId);

    return repo.findOne({
      where: { userId, viewId },
    });
  }

  async saveUserViewPreferences(
    tenantId: string,
    userId: string,
    viewId: string,
    preferences: Partial<{
      columnOrder: string[];
      columnWidths: Record<string, number>;
      hiddenColumns: string[];
      filters: FilterCondition[];
      sortConfig: SortConfig[];
    }>
  ) {
    const repo = await this.userPrefRepo(tenantId);

    let pref = await repo.findOne({ where: { userId, viewId } });

    if (pref) {
      Object.assign(pref, preferences);
    } else {
      pref = repo.create({
        userId,
        viewId,
        columnOrder: preferences.columnOrder ?? [],
        columnWidths: preferences.columnWidths ?? {},
        hiddenColumns: preferences.hiddenColumns ?? [],
        filters: preferences.filters ?? [],
        sortConfig: preferences.sortConfig ?? [],
      });
    }

    return repo.save(pref);
  }

  async resetUserViewPreferences(tenantId: string, userId: string, viewId: string) {
    const repo = await this.userPrefRepo(tenantId);
    await repo.delete({ userId, viewId });
    return { reset: true };
  }
}
