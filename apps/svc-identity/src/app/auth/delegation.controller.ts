/**
 * Delegation Controller
 * HubbleWave Platform - Phase 1
 *
 * REST endpoints for temporary authority delegation between users.
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/permission.decorator';
import { DelegationService, CreateDelegationDto } from './delegation.service';

interface RequestWithUser {
  user: {
    sub: string;
    username: string;
  };
}

@Controller('auth/delegations')
@UseGuards(JwtAuthGuard)
export class DelegationController {
  constructor(private readonly delegationService: DelegationService) {}

  /**
   * Create a new delegation
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createDelegation(
    @Request() req: RequestWithUser,
    @Body() body: CreateDelegationDto,
  ) {
    const delegation = await this.delegationService.createDelegation(
      req.user.sub,
      body,
    );

    return {
      success: true,
      delegation: {
        id: delegation.id,
        name: delegation.name,
        status: delegation.status,
        delegateId: delegation.delegateId,
        delegatedPermissions: delegation.delegatedPermissions,
        delegatedRoles: delegation.delegatedRoles,
        startsAt: delegation.startsAt,
        endsAt: delegation.endsAt,
        createdAt: delegation.createdAt,
      },
    };
  }

  /**
   * Get delegations I've created (as delegator)
   */
  @Get('created')
  async getDelegationsCreated(
    @Request() req: RequestWithUser,
    @Query('includeExpired') includeExpired?: string,
  ) {
    const delegations = await this.delegationService.getDelegationsCreatedByUser(
      req.user.sub,
      includeExpired === 'true',
    );

    return {
      delegations: delegations.map(d => ({
        id: d.id,
        name: d.name,
        status: d.status,
        delegate: d.delegate ? {
          id: d.delegate.id,
          email: d.delegate.email,
          displayName: d.delegate.displayName,
        } : undefined,
        delegatedPermissions: d.delegatedPermissions,
        delegatedRoles: d.delegatedRoles,
        startsAt: d.startsAt,
        endsAt: d.endsAt,
        createdAt: d.createdAt,
      })),
    };
  }

  /**
   * Get delegations I've received (as delegate)
   */
  @Get('received')
  async getDelegationsReceived(@Request() req: RequestWithUser) {
    const delegations = await this.delegationService.getActiveDelegationsForUser(
      req.user.sub,
    );

    return {
      delegations: delegations.map(d => ({
        id: d.id,
        name: d.name,
        status: d.status,
        delegator: d.delegator ? {
          id: d.delegator.id,
          email: d.delegator.email,
          displayName: d.delegator.displayName,
        } : undefined,
        delegatedPermissions: d.delegatedPermissions,
        delegatedRoles: d.delegatedRoles,
        startsAt: d.startsAt,
        endsAt: d.endsAt,
      })),
    };
  }

  /**
   * Get effective permissions (own + delegated)
   */
  @Get('effective-permissions')
  async getEffectivePermissions(@Request() req: RequestWithUser) {
    const result = await this.delegationService.getEffectivePermissions(
      req.user.sub,
    );

    return {
      delegatedPermissions: result.permissions,
      delegatedRoles: result.roles,
      activeDelegations: result.delegations.map(d => ({
        id: d.id,
        name: d.name,
        delegatorId: d.delegatorId,
        endsAt: d.endsAt,
      })),
    };
  }

  /**
   * Approve a pending delegation (for delegations requiring approval)
   */
  @Post(':delegationId/approve')
  @UseGuards(PermissionGuard)
  @RequirePermission('delegations.approve')
  @HttpCode(HttpStatus.OK)
  async approveDelegation(
    @Request() req: RequestWithUser,
    @Param('delegationId') delegationId: string,
  ) {
    const delegation = await this.delegationService.approveDelegation(
      delegationId,
      req.user.sub,
    );

    return {
      success: true,
      delegation: {
        id: delegation.id,
        status: delegation.status,
        approvedAt: delegation.approvedAt,
      },
    };
  }

  /**
   * Revoke a delegation
   */
  @Delete(':delegationId')
  async revokeDelegation(
    @Request() req: RequestWithUser,
    @Param('delegationId') delegationId: string,
    @Body() body: { reason?: string },
  ) {
    const delegation = await this.delegationService.revokeDelegation(
      delegationId,
      req.user.sub,
      body.reason,
    );

    return {
      success: true,
      delegation: {
        id: delegation.id,
        status: delegation.status,
        revokedAt: delegation.revokedAt,
      },
    };
  }

  /**
   * Get delegation by ID
   */
  @Get(':delegationId')
  async getDelegation(
    @Request() req: RequestWithUser,
    @Param('delegationId') delegationId: string,
  ) {
    const delegation = await this.delegationService.getDelegation(delegationId);

    if (!delegation) {
      return { found: false };
    }

    // Only delegator, delegate, or admin can view
    if (
      delegation.delegatorId !== req.user.sub &&
      delegation.delegateId !== req.user.sub
    ) {
      return { found: false };
    }

    return {
      found: true,
      delegation: {
        id: delegation.id,
        name: delegation.name,
        reason: delegation.reason,
        status: delegation.status,
        delegator: delegation.delegator ? {
          id: delegation.delegator.id,
          email: delegation.delegator.email,
          displayName: delegation.delegator.displayName,
        } : undefined,
        delegate: delegation.delegate ? {
          id: delegation.delegate.id,
          email: delegation.delegate.email,
          displayName: delegation.delegate.displayName,
        } : undefined,
        delegatedPermissions: delegation.delegatedPermissions,
        delegatedRoles: delegation.delegatedRoles,
        scopeRestrictions: delegation.scopeRestrictions,
        startsAt: delegation.startsAt,
        endsAt: delegation.endsAt,
        createdAt: delegation.createdAt,
        approvedAt: delegation.approvedAt,
        revokedAt: delegation.revokedAt,
        revocationReason: delegation.revocationReason,
      },
    };
  }

  /**
   * List all delegations (admin view)
   */
  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission('delegations.admin')
  async listDelegations(
    @Query('delegatorId') delegatorId?: string,
    @Query('delegateId') delegateId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.delegationService.listDelegations({
      delegatorId,
      delegateId,
      status: status as 'pending' | 'active' | 'expired' | 'revoked' | undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return {
      delegations: result.delegations.map(d => ({
        id: d.id,
        name: d.name,
        status: d.status,
        delegator: d.delegator ? {
          id: d.delegator.id,
          email: d.delegator.email,
          displayName: d.delegator.displayName,
        } : undefined,
        delegate: d.delegate ? {
          id: d.delegate.id,
          email: d.delegate.email,
          displayName: d.delegate.displayName,
        } : undefined,
        startsAt: d.startsAt,
        endsAt: d.endsAt,
        createdAt: d.createdAt,
      })),
      total: result.total,
    };
  }
}
