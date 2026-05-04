import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  UpsertPageDto,
  WorkspaceService,
} from './workspace.service';
import type { PanelLayout, WorkspaceVariantScope } from '@hubblewave/instance-db';

/**
 * Workspace API. ADR-12 permission slug `metadata.workspaces.edit`
 * gates write operations. Reads accept `collection.read` OR the edit
 * slug so non-admin viewers can browse workspaces; admin bypass via
 * PermissionsGuard's internal logic stays intact.
 */
/**
 * A caller is in editor scope when they hold metadata.workspaces.edit
 * directly OR are a platform admin (PermissionsGuard's admin bypass
 * flips request.user.permissions to a wildcard, but admin role is
 * also reflected on user.roles). Editor scope is what unlocks
 * draft / inactive workspace reads.
 */
const hasEditorScope = (user?: RequestUser): boolean => {
  if (!user) return false;
  if ((user.roles ?? []).includes('admin') || (user.roles ?? []).includes('super_admin')) {
    return true;
  }
  return (user.permissions ?? []).includes('metadata.workspaces.edit');
};

@Controller('workspaces')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkspaceController {
  constructor(private readonly service: WorkspaceService) {}

  @Get()
  @RequirePermission(['collection.read', 'metadata.workspaces.edit'], 'any')
  async list(
    @Query('applicationId') applicationId?: string,
    @Query('includeInactive') includeInactive?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    const editorScope = hasEditorScope(user);
    const data = await this.service.list(
      applicationId,
      includeInactive === 'true' && editorScope,
      editorScope,
    );
    return { data };
  }

  @Get(':id')
  @RequirePermission(['collection.read', 'metadata.workspaces.edit'], 'any')
  async get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: RequestUser) {
    return this.service.get(id, hasEditorScope(user));
  }

  @Post()
  @RequirePermission('metadata.workspaces.edit')
  async create(@Body() dto: CreateWorkspaceDto, @CurrentUser() user?: RequestUser) {
    return this.service.create(dto, user?.id);
  }

  @Put(':id')
  @RequirePermission('metadata.workspaces.edit')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkspaceDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.service.update(id, dto, user?.id);
  }

  @Post(':id/publish')
  @RequirePermission('metadata.workspaces.edit')
  async publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: RequestUser) {
    return this.service.publish(id, user?.id);
  }

  @Post(':id/deprecate')
  @RequirePermission('metadata.workspaces.edit')
  async deprecate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: RequestUser) {
    return this.service.deprecate(id, user?.id);
  }

  @Post(':id/toggle')
  @RequirePermission('metadata.workspaces.edit')
  async toggleActive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: RequestUser) {
    return this.service.toggleActive(id, user?.id);
  }

  @Delete(':id')
  @RequirePermission('metadata.workspaces.edit')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.delete(id);
  }

  // ─────────────────────────────────────────────────────────────────
  // Pages
  // ─────────────────────────────────────────────────────────────────

  @Post(':id/pages')
  @RequirePermission('metadata.workspaces.edit')
  async createPage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertPageDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.service.upsertPage(id, null, dto, user?.id);
  }

  @Put(':id/pages/:pageId')
  @RequirePermission('metadata.workspaces.edit')
  async updatePage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: UpsertPageDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.service.upsertPage(id, pageId, dto, user?.id);
  }

  @Delete(':id/pages/:pageId')
  @RequirePermission('metadata.workspaces.edit')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @CurrentUser() user?: RequestUser,
  ) {
    await this.service.deletePage(id, pageId, user?.id);
  }

  // ─────────────────────────────────────────────────────────────────
  // Variants
  // ─────────────────────────────────────────────────────────────────

  @Get(':id/variants')
  @RequirePermission(['collection.read', 'metadata.workspaces.edit'], 'any')
  async listVariants(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.service.listVariants(id, hasEditorScope(user));
  }

  @Put(':id/pages/:pageId/variants')
  @RequirePermission('metadata.workspaces.edit')
  async upsertVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: {
      scope: WorkspaceVariantScope;
      scopeRef?: string;
      priority?: number;
      layout: PanelLayout[];
    },
    @CurrentUser() user?: RequestUser,
  ) {
    return this.service.upsertVariant(id, pageId, dto, user?.id);
  }

  @Get(':id/pages/:pageId/resolved-layout')
  @RequirePermission(['collection.read', 'metadata.workspaces.edit'], 'any')
  async resolveLayout(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return {
      layout: await this.service.resolvePageLayout(
        id,
        pageId,
        {
          userId: user?.id,
          roles: user?.roles ?? [],
          // Callers that do not supply group membership receive no
          // group-variant match — group-scoped variants are resolved
          // only when the actor includes its group set explicitly.
          groups: [],
        },
        hasEditorScope(user),
      ),
    };
  }
}
