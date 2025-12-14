import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  AVAGovernanceService,
  AuditQueryOptions,
} from '@eam-platform/ai';
import {
  TenantDbService,
  AVAActionType,
  AVAActionStatus,
} from '@eam-platform/tenant-db';
import { JwtAuthGuard, CurrentUser } from '@eam-platform/auth-guard';

interface UpdateGlobalSettingsDto {
  avaEnabled?: boolean;
  defaultRequiresConfirmation?: boolean;
  allowCreateActions?: boolean;
  allowUpdateActions?: boolean;
  allowDeleteActions?: boolean;
  allowExecuteActions?: boolean;
  globalRateLimitPerHour?: number;
  userRateLimitPerHour?: number;
  auditRetentionDays?: number;
  auditAllQueries?: boolean;
  readOnlyMode?: boolean;
  systemReadOnlyCollections?: string[];
  adminNotificationEmail?: string;
  notifyOnFailure?: boolean;
  notifyOnRevert?: boolean;
}

interface CreatePermissionConfigDto {
  collectionCode?: string;
  actionType: AVAActionType;
  isEnabled?: boolean;
  requiresConfirmation?: boolean;
  allowedRoles?: string[];
  excludedRoles?: string[];
  maxRecordsPerHour?: number;
  maxRecordsPerDay?: number;
  restrictedFields?: string[];
  readOnlyCollections?: string[];
  requiresApproval?: boolean;
  approverRoles?: string[];
  alwaysAudit?: boolean;
  notifyAdmin?: boolean;
  description?: string;
}

interface UpdatePermissionConfigDto extends Partial<CreatePermissionConfigDto> {}

interface RevertActionDto {
  reason?: string;
}

interface AuditQueryDto {
  userId?: string;
  actionType?: AVAActionType;
  status?: AVAActionStatus;
  targetCollection?: string;
  fromDate?: string;
  toDate?: string;
  isRevertible?: string;
  limit?: string;
  offset?: string;
}

@ApiTags('AVA Governance - Admin')
@ApiBearerAuth()
@Controller('api/ava/admin')
@UseGuards(JwtAuthGuard)
export class AVAGovernanceController {
  constructor(
    private governanceService: AVAGovernanceService,
    private tenantDbService: TenantDbService
  ) {}

  /**
   * Check if user has admin access
   */
  private requireAdmin(user: { role?: string }): void {
    const adminRoles = ['admin', 'itil_admin', 'tenant_admin', 'system_admin'];
    if (!user.role || !adminRoles.includes(user.role)) {
      throw new ForbiddenException('Admin access required');
    }
  }

  // ============== GLOBAL SETTINGS ==============

  @Get('settings')
  @ApiOperation({ summary: 'Get AVA global settings' })
  @ApiResponse({ status: 200, description: 'Global settings' })
  async getGlobalSettings(
    @CurrentUser() user: { tenantId: string; userId: string; role?: string }
  ) {
    this.requireAdmin(user);

    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);
    const settings = await this.governanceService.getGlobalSettings(dataSource);

    return { settings };
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update AVA global settings' })
  @ApiResponse({ status: 200, description: 'Updated settings' })
  async updateGlobalSettings(
    @CurrentUser() user: { tenantId: string; userId: string; role?: string },
    @Body() dto: UpdateGlobalSettingsDto
  ) {
    this.requireAdmin(user);

    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);
    const settings = await this.governanceService.updateGlobalSettings(
      dataSource,
      dto,
      user.userId
    );

    return { settings };
  }

  // ============== PERMISSION CONFIGURATIONS ==============

  @Get('permissions')
  @ApiOperation({ summary: 'Get all AVA permission configurations' })
  @ApiResponse({ status: 200, description: 'Permission configurations' })
  async getPermissionConfigs(
    @CurrentUser() user: { tenantId: string; userId: string; role?: string }
  ) {
    this.requireAdmin(user);

    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);
    const permissions = await this.governanceService.getPermissionConfigs(dataSource);

    return { permissions };
  }

  @Post('permissions')
  @ApiOperation({ summary: 'Create a new permission configuration' })
  @ApiResponse({ status: 201, description: 'Created permission configuration' })
  async createPermissionConfig(
    @CurrentUser() user: { tenantId: string; userId: string; role?: string },
    @Body() dto: CreatePermissionConfigDto
  ) {
    this.requireAdmin(user);

    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);
    const permission = await this.governanceService.createPermissionConfig(
      dataSource,
      dto,
      user.userId
    );

    return { permission };
  }

  @Put('permissions/:id')
  @ApiOperation({ summary: 'Update a permission configuration' })
  @ApiResponse({ status: 200, description: 'Updated permission configuration' })
  async updatePermissionConfig(
    @CurrentUser() user: { tenantId: string; userId: string; role?: string },
    @Param('id') id: string,
    @Body() dto: UpdatePermissionConfigDto
  ) {
    this.requireAdmin(user);

    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);
    const permission = await this.governanceService.updatePermissionConfig(
      dataSource,
      id,
      dto,
      user.userId
    );

    if (!permission) {
      return { error: 'Permission configuration not found' };
    }

    return { permission };
  }

  @Delete('permissions/:id')
  @ApiOperation({ summary: 'Delete a permission configuration' })
  @ApiResponse({ status: 200, description: 'Deleted' })
  async deletePermissionConfig(
    @CurrentUser() user: { tenantId: string; userId: string; role?: string },
    @Param('id') id: string
  ) {
    this.requireAdmin(user);

    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);
    const deleted = await this.governanceService.deletePermissionConfig(dataSource, id);

    return { success: deleted };
  }

  // ============== AUDIT TRAIL ==============

  @Get('audit')
  @ApiOperation({ summary: 'Get AVA audit trail' })
  @ApiResponse({ status: 200, description: 'Audit trail entries' })
  async getAuditTrail(
    @CurrentUser() user: { tenantId: string; userId: string; role?: string },
    @Query() query: AuditQueryDto
  ) {
    this.requireAdmin(user);

    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);

    const options: AuditQueryOptions = {
      userId: query.userId,
      actionType: query.actionType,
      status: query.status,
      targetCollection: query.targetCollection,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
      isRevertible: query.isRevertible === 'true' ? true : query.isRevertible === 'false' ? false : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    };

    const { entries, total } = await this.governanceService.getAuditTrail(dataSource, options);

    return { entries, total, limit: options.limit, offset: options.offset };
  }

  @Get('audit/stats')
  @ApiOperation({ summary: 'Get AVA audit statistics' })
  @ApiResponse({ status: 200, description: 'Audit statistics' })
  async getAuditStats(
    @CurrentUser() user: { tenantId: string; userId: string; role?: string },
    @Query('fromDate') fromDate?: string
  ) {
    this.requireAdmin(user);

    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);
    const stats = await this.governanceService.getAuditStats(
      dataSource,
      fromDate ? new Date(fromDate) : undefined
    );

    return { stats };
  }

  @Get('audit/revertible')
  @ApiOperation({ summary: 'Get revertible AVA actions' })
  @ApiResponse({ status: 200, description: 'Revertible actions' })
  async getRevertibleActions(
    @CurrentUser() user: { tenantId: string; userId: string; role?: string },
    @Query('userId') targetUserId?: string,
    @Query('limit') limit?: string
  ) {
    this.requireAdmin(user);

    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);
    const actions = await this.governanceService.getRevertibleActions(dataSource, {
      userId: targetUserId,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return { actions };
  }

  @Post('audit/:id/revert')
  @ApiOperation({ summary: 'Revert an AVA action' })
  @ApiResponse({ status: 200, description: 'Revert result' })
  async revertAction(
    @CurrentUser() user: { tenantId: string; userId: string; role?: string },
    @Param('id') auditId: string,
    @Body() dto: RevertActionDto
  ) {
    this.requireAdmin(user);

    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);
    const result = await this.governanceService.revertAction(
      dataSource,
      auditId,
      user.userId,
      dto.reason
    );

    return result;
  }

  // ============== USER-FACING AUDIT (own actions) ==============

  @Get('my-actions')
  @ApiOperation({ summary: 'Get current user\'s AVA action history' })
  @ApiResponse({ status: 200, description: 'User action history' })
  async getMyActions(
    @CurrentUser() user: { tenantId: string; userId: string },
    @Query('limit') limit?: string
  ) {
    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);
    const actions = await this.governanceService.getUserAuditTrail(
      dataSource,
      user.userId,
      limit ? parseInt(limit, 10) : 20
    );

    return { actions };
  }

  @Get('my-revertible')
  @ApiOperation({ summary: 'Get current user\'s revertible actions' })
  @ApiResponse({ status: 200, description: 'User\'s revertible actions' })
  async getMyRevertibleActions(
    @CurrentUser() user: { tenantId: string; userId: string },
    @Query('limit') limit?: string
  ) {
    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);
    const actions = await this.governanceService.getRevertibleActions(dataSource, {
      userId: user.userId,
      limit: limit ? parseInt(limit, 10) : 10,
    });

    return { actions };
  }

  @Post('my-actions/:id/revert')
  @ApiOperation({ summary: 'Revert own AVA action' })
  @ApiResponse({ status: 200, description: 'Revert result' })
  async revertMyAction(
    @CurrentUser() user: { tenantId: string; userId: string },
    @Param('id') auditId: string,
    @Body() dto: RevertActionDto
  ) {
    const dataSource = await this.tenantDbService.getDataSource(user.tenantId);

    // First verify this action belongs to the user
    const userActions = await this.governanceService.getUserAuditTrail(
      dataSource,
      user.userId,
      100
    );

    const ownAction = userActions.find((a) => a.id === auditId);
    if (!ownAction) {
      throw new ForbiddenException('You can only revert your own actions');
    }

    const result = await this.governanceService.revertAction(
      dataSource,
      auditId,
      user.userId,
      dto.reason
    );

    return result;
  }
}
