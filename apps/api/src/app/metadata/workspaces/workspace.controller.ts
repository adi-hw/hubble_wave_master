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
 * Workspace API. ADR-12 permission slug `metadata:workspace:manage`
 * gates write operations. Reads accept `metadata:collection:read` OR the edit
 * slug so non-admin viewers can browse workspaces; admin bypass via
 * PermissionsGuard's internal logic stays intact.
 */
/**
 * A caller is in editor scope when they hold metadata:workspace:manage
 * directly OR are a platform admin (PermissionsGuard's admin bypass
 * flips request.user.permissions to a wildcard, but admin role is
 * also reflected on user.roles). Editor scope is what unlocks
 * draft / inactive workspace reads.
 */
const hasEditorScope = (user?: RequestUser): boolean => {
  if (!user) return false;
  if ((user.roleCodes ?? []).includes('admin') || (user.roleCodes ?? []).includes('super_admin')) {
    return true;
  }
  return (user.permissionCodes ?? []).includes('metadata:workspace:manage');
};

@Controller('workspaces')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkspaceController {
  constructor(private readonly service: WorkspaceService) {}

  @Get()
  @RequirePermission(['metadata:collection:read', 'metadata:workspace:manage'], 'any')
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
  @RequirePermission(['metadata:collection:read', 'metadata:workspace:manage'], 'any')
  async get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: RequestUser) {
    return this.service.get(id, hasEditorScope(user));
  }

  @Post()
  @RequirePermission('metadata:workspace:manage')
  async create(@Body() dto: CreateWorkspaceDto, @CurrentUser() user?: RequestUser) {
    return this.service.create(dto, user?.id);
  }

  @Put(':id')
  @RequirePermission('metadata:workspace:manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkspaceDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.service.update(id, dto, user?.id);
  }

  @Post(':id/publish')
  @RequirePermission('metadata:workspace:manage')
  async publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: RequestUser) {
    return this.service.publish(id, user?.id);
  }

  @Post(':id/deprecate')
  @RequirePermission('metadata:workspace:manage')
  async deprecate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: RequestUser) {
    return this.service.deprecate(id, user?.id);
  }

  @Post(':id/toggle')
  @RequirePermission('metadata:workspace:manage')
  async toggleActive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: RequestUser) {
    return this.service.toggleActive(id, user?.id);
  }

  @Delete(':id')
  @RequirePermission('metadata:workspace:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.delete(id);
  }

  // ─────────────────────────────────────────────────────────────────
  // Pages
  // ─────────────────────────────────────────────────────────────────

  @Post(':id/pages')
  @RequirePermission('metadata:workspace:manage')
  async createPage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertPageDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.service.upsertPage(id, null, dto, user?.id);
  }

  @Put(':id/pages/:pageId')
  @RequirePermission('metadata:workspace:manage')
  async updatePage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: UpsertPageDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.service.upsertPage(id, pageId, dto, user?.id);
  }

  @Delete(':id/pages/:pageId')
  @RequirePermission('metadata:workspace:manage')
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
  @RequirePermission(['metadata:collection:read', 'metadata:workspace:manage'], 'any')
  async listVariants(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.service.listVariants(id, hasEditorScope(user));
  }

  @Put(':id/pages/:pageId/variants')
  @RequirePermission('metadata:workspace:manage')
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
  @RequirePermission(['metadata:collection:read', 'metadata:workspace:manage'], 'any')
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
          roles: user?.roleCodes ?? [],
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
