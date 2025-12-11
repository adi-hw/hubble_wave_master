import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, RequestContext, RolesGuard, Roles } from '@eam-platform/auth-guard';
import { TenantDbService, PlatformScript, ScriptExecutionLog } from '@eam-platform/tenant-db';
import type { ScriptType, ExecutionContext } from '@eam-platform/tenant-db';

interface CreateScriptDto {
  code: string;
  name: string;
  description?: string;
  scriptType: ScriptType;
  executionContext: ExecutionContext;
  targetTable?: string;
  targetField?: string;
  scriptContent: string;
  scriptLanguage?: 'javascript' | 'typescript';
  executionOrder?: number;
  isAsync?: boolean;
  timeoutMs?: number;
  conditionExpression?: Record<string, any>;
  isActive?: boolean;
}

type UpdateScriptDto = Partial<CreateScriptDto>;

@Controller('studio/scripts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('tenant_admin', 'platform_admin')
export class StudioScriptsController {
  constructor(private readonly tenantDb: TenantDbService) {}

  @Get()
  async listScripts(
    @Query('type') scriptType: string,
    @Query('table') targetTable: string,
    @Query('active') active: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<PlatformScript>(ctx.tenantId, PlatformScript);

    const where: any = { tenantId: ctx.tenantId };
    if (scriptType) where.scriptType = scriptType;
    if (targetTable) where.targetTable = targetTable;
    if (active !== undefined) where.isActive = active === 'true';

    const scripts = await repo.find({
      where,
      order: { executionOrder: 'ASC', createdAt: 'DESC' },
    });

    return {
      items: scripts.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        description: s.description,
        scriptType: s.scriptType,
        executionContext: s.executionContext,
        targetTable: s.targetTable,
        targetField: s.targetField,
        scriptLanguage: s.scriptLanguage,
        executionOrder: s.executionOrder,
        isAsync: s.isAsync,
        timeoutMs: s.timeoutMs,
        isActive: s.isActive,
        isSystem: s.isSystem,
        source: s.source,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    };
  }

  @Get(':id')
  async getScript(@Param('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<PlatformScript>(ctx.tenantId, PlatformScript);
    const script = await repo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    return script;
  }

  @Post()
  async createScript(@Body() body: CreateScriptDto, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<PlatformScript>(ctx.tenantId, PlatformScript);

    // Check for duplicate code
    const existing = await repo.findOne({ where: { code: body.code, tenantId: ctx.tenantId } });
    if (existing) {
      throw new ForbiddenException(`Script with code "${body.code}" already exists`);
    }

    const script = repo.create({
      tenantId: ctx.tenantId,
      code: body.code,
      name: body.name,
      description: body.description,
      scriptType: body.scriptType,
      executionContext: body.executionContext,
      targetTable: body.targetTable,
      targetField: body.targetField,
      scriptContent: body.scriptContent,
      scriptLanguage: body.scriptLanguage || 'javascript',
      executionOrder: body.executionOrder || 100,
      isAsync: body.isAsync || false,
      timeoutMs: body.timeoutMs || 5000,
      conditionExpression: body.conditionExpression,
      source: 'tenant' as const,
      isActive: body.isActive !== false,
      isSystem: false,
      createdBy: ctx.userId,
    });

    return repo.save(script);
  }

  @Patch(':id')
  async updateScript(@Param('id') id: string, @Body() body: UpdateScriptDto, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<PlatformScript>(ctx.tenantId, PlatformScript);
    const script = await repo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    if (script.isSystem) {
      throw new ForbiddenException('Cannot modify system scripts');
    }

    // Check for duplicate code if changing
    if (body.code && body.code !== script.code) {
      const existing = await repo.findOne({ where: { code: body.code, tenantId: ctx.tenantId } });
      if (existing) {
        throw new ForbiddenException(`Script with code "${body.code}" already exists`);
      }
    }

    const updated = repo.merge(script, {
      ...body,
      updatedBy: ctx.userId,
    });

    return repo.save(updated);
  }

  @Delete(':id')
  async deleteScript(@Param('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<PlatformScript>(ctx.tenantId, PlatformScript);
    const script = await repo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    if (script.isSystem) {
      throw new ForbiddenException('Cannot delete system scripts');
    }

    await repo.remove(script);
    return { success: true };
  }

  @Post(':id/toggle')
  async toggleScript(@Param('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<PlatformScript>(ctx.tenantId, PlatformScript);
    const script = await repo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    script.isActive = !script.isActive;
    script.updatedBy = ctx.userId;

    return repo.save(script);
  }

  @Get(':id/logs')
  async getScriptLogs(
    @Param('id') id: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<ScriptExecutionLog>(ctx.tenantId, ScriptExecutionLog);
    const logs = await repo.find({
      where: { scriptId: id, tenantId: ctx.tenantId },
      order: { executedAt: 'DESC' },
      take: parseInt(limit, 10) || 50,
      skip: parseInt(offset, 10) || 0,
    });

    return { items: logs };
  }
}
