/**
 * Delegation Service
 * HubbleWave Platform - Phase 1
 *
 * Service for temporary authority delegation between users.
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Delegation, DelegationStatus, User, AuditLog } from '@hubblewave/instance-db';

export interface CreateDelegationDto {
  delegateId: string;
  name: string;
  reason?: string;
  delegatedPermissions: string[];
  delegatedRoles?: string[];
  scopeRestrictions?: {
    collections?: string[];
    recordFilters?: Record<string, unknown>;
  };
  startsAt: Date;
  endsAt: Date;
  requiresApproval?: boolean;
}

export interface DelegationWithUsers extends Delegation {
  delegator?: User;
  delegate?: User;
}

@Injectable()
export class DelegationService {
  private readonly logger = new Logger(DelegationService.name);

  constructor(
    @InjectRepository(Delegation)
    private readonly delegationRepo: Repository<Delegation>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  /**
   * Create a new delegation
   */
  async createDelegation(
    delegatorId: string,
    dto: CreateDelegationDto,
  ): Promise<Delegation> {
    // Validate delegator
    const delegator = await this.userRepo.findOne({
      where: { id: delegatorId },
    });
    if (!delegator) {
      throw new NotFoundException('Delegator not found');
    }

    // Validate delegate
    const delegate = await this.userRepo.findOne({
      where: { id: dto.delegateId },
    });
    if (!delegate) {
      throw new NotFoundException('Delegate not found');
    }

    // Cannot delegate to yourself
    if (delegatorId === dto.delegateId) {
      throw new BadRequestException('Cannot delegate to yourself');
    }

    // Validate dates
    const now = new Date();
    if (dto.startsAt < now) {
      throw new BadRequestException('Start date cannot be in the past');
    }
    if (dto.endsAt <= dto.startsAt) {
      throw new BadRequestException('End date must be after start date');
    }

    // Check for overlapping delegations
    const overlapping = await this.delegationRepo.findOne({
      where: {
        delegatorId,
        delegateId: dto.delegateId,
        status: 'active' as DelegationStatus,
      },
    });
    if (overlapping) {
      throw new BadRequestException(
        'An active delegation already exists for this delegate',
      );
    }

    // Create delegation
    const delegation = this.delegationRepo.create({
      delegatorId,
      delegateId: dto.delegateId,
      name: dto.name,
      reason: dto.reason,
      status: dto.requiresApproval ? 'pending' : 'active',
      delegatedPermissions: dto.delegatedPermissions,
      delegatedRoles: dto.delegatedRoles || [],
      scopeRestrictions: dto.scopeRestrictions,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      requiresApproval: dto.requiresApproval || false,
    });

    await this.delegationRepo.save(delegation);

    // Audit log
    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        userId: delegatorId,
        action: 'delegation.create',
        collectionCode: 'delegation',
        recordId: delegation.id,
        newValues: {
          delegateId: dto.delegateId,
          delegateEmail: delegate.email,
          name: dto.name,
          permissions: dto.delegatedPermissions,
          startsAt: dto.startsAt.toISOString(),
          endsAt: dto.endsAt.toISOString(),
        },
      }),
    );

    this.logger.log(
      `Delegation created: ${delegator.email} -> ${delegate.email} (${dto.name})`,
    );

    return delegation;
  }

  /**
   * Approve a pending delegation (for delegations requiring approval)
   */
  async approveDelegation(
    delegationId: string,
    approverId: string,
  ): Promise<Delegation> {
    const delegation = await this.delegationRepo.findOne({
      where: { id: delegationId, status: 'pending' },
      relations: ['delegator', 'delegate'],
    });

    if (!delegation) {
      throw new NotFoundException('Pending delegation not found');
    }

    // In production, verify approver has authority

    delegation.status = 'active';
    delegation.approvedBy = approverId;
    delegation.approvedAt = new Date();

    await this.delegationRepo.save(delegation);

    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        userId: approverId,
        action: 'delegation.approve',
        collectionCode: 'delegation',
        recordId: delegation.id,
        newValues: {
          delegatorId: delegation.delegatorId,
          delegateId: delegation.delegateId,
        },
      }),
    );

    this.logger.log(`Delegation ${delegationId} approved by ${approverId}`);

    return delegation;
  }

  /**
   * Revoke a delegation
   */
  async revokeDelegation(
    delegationId: string,
    revokerId: string,
    reason?: string,
  ): Promise<Delegation> {
    const delegation = await this.delegationRepo.findOne({
      where: { id: delegationId },
      relations: ['delegator', 'delegate'],
    });

    if (!delegation) {
      throw new NotFoundException('Delegation not found');
    }

    // Only delegator or admin can revoke
    if (delegation.delegatorId !== revokerId) {
      // In production, also check for admin permission
      throw new ForbiddenException('Not authorized to revoke this delegation');
    }

    delegation.status = 'revoked';
    delegation.revokedBy = revokerId;
    delegation.revokedAt = new Date();
    delegation.revocationReason = reason;

    await this.delegationRepo.save(delegation);

    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        userId: revokerId,
        action: 'delegation.revoke',
        collectionCode: 'delegation',
        recordId: delegation.id,
        newValues: {
          delegatorId: delegation.delegatorId,
          delegateId: delegation.delegateId,
          reason,
        },
      }),
    );

    this.logger.log(`Delegation ${delegationId} revoked by ${revokerId}`);

    return delegation;
  }

  /**
   * Get active delegations for a user (as delegate)
   */
  async getActiveDelegationsForUser(userId: string): Promise<Delegation[]> {
    const now = new Date();

    return this.delegationRepo.find({
      where: {
        delegateId: userId,
        status: 'active',
        startsAt: LessThan(now) as any,
        endsAt: MoreThan(now) as any,
      },
      relations: ['delegator'],
      order: { endsAt: 'ASC' },
    });
  }

  /**
   * Get delegations created by a user (as delegator)
   */
  async getDelegationsCreatedByUser(
    userId: string,
    includeExpired: boolean = false,
  ): Promise<Delegation[]> {
    const query = this.delegationRepo.createQueryBuilder('delegation')
      .leftJoinAndSelect('delegation.delegate', 'delegate')
      .where('delegation.delegatorId = :userId', { userId });

    if (!includeExpired) {
      query.andWhere('delegation.status IN (:...statuses)', {
        statuses: ['pending', 'active'],
      });
    }

    return query.orderBy('delegation.createdAt', 'DESC').getMany();
  }

  /**
   * Get effective permissions for a user including delegations
   */
  async getEffectivePermissions(
    userId: string,
  ): Promise<{ permissions: string[]; roles: string[]; delegations: Delegation[] }> {
    const delegations = await this.getActiveDelegationsForUser(userId);

    const permissions = new Set<string>();
    const roles = new Set<string>();

    for (const delegation of delegations) {
      for (const perm of delegation.delegatedPermissions) {
        permissions.add(perm);
      }
      for (const role of delegation.delegatedRoles) {
        roles.add(role);
      }
    }

    return {
      permissions: Array.from(permissions),
      roles: Array.from(roles),
      delegations,
    };
  }

  /**
   * Check if a user has a specific permission through delegation
   */
  async hasPermissionThroughDelegation(
    userId: string,
    permission: string,
  ): Promise<{ hasPermission: boolean; delegation?: Delegation }> {
    const now = new Date();

    const delegation = await this.delegationRepo.findOne({
      where: {
        delegateId: userId,
        status: 'active',
        startsAt: LessThan(now) as any,
        endsAt: MoreThan(now) as any,
      },
      relations: ['delegator'],
    });

    if (!delegation) {
      return { hasPermission: false };
    }

    // Check if the specific permission is delegated
    if (delegation.delegatedPermissions.includes(permission)) {
      return { hasPermission: true, delegation };
    }

    // Check for wildcard permissions (e.g., 'records.*' matches 'records.create')
    for (const perm of delegation.delegatedPermissions) {
      if (perm.endsWith('.*')) {
        const prefix = perm.slice(0, -2);
        if (permission.startsWith(prefix)) {
          return { hasPermission: true, delegation };
        }
      }
    }

    return { hasPermission: false };
  }

  /**
   * Expire delegations that have passed their end date
   */
  async expireDelegations(): Promise<number> {
    const now = new Date();

    const result = await this.delegationRepo.update(
      {
        status: 'active',
        endsAt: LessThan(now) as any,
      },
      { status: 'expired' },
    );

    if (result.affected && result.affected > 0) {
      this.logger.log(`Expired ${result.affected} delegations`);
    }

    return result.affected || 0;
  }

  /**
   * Activate delegations that have reached their start date
   */
  async activatePendingDelegations(): Promise<number> {
    const now = new Date();

    const result = await this.delegationRepo.update(
      {
        status: 'pending',
        requiresApproval: false,
        startsAt: LessThan(now) as any,
      },
      { status: 'active' },
    );

    return result.affected || 0;
  }

  /**
   * Get delegation by ID
   */
  async getDelegation(delegationId: string): Promise<Delegation | null> {
    return this.delegationRepo.findOne({
      where: { id: delegationId },
      relations: ['delegator', 'delegate', 'approver'],
    });
  }

  /**
   * List delegations with filters
   */
  async listDelegations(options: {
    delegatorId?: string;
    delegateId?: string;
    status?: DelegationStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ delegations: Delegation[]; total: number }> {
    const query = this.delegationRepo.createQueryBuilder('delegation')
      .leftJoinAndSelect('delegation.delegator', 'delegator')
      .leftJoinAndSelect('delegation.delegate', 'delegate');

    if (options.delegatorId) {
      query.andWhere('delegation.delegatorId = :delegatorId', {
        delegatorId: options.delegatorId,
      });
    }

    if (options.delegateId) {
      query.andWhere('delegation.delegateId = :delegateId', {
        delegateId: options.delegateId,
      });
    }

    if (options.status) {
      query.andWhere('delegation.status = :status', { status: options.status });
    }

    query.orderBy('delegation.createdAt', 'DESC');

    const total = await query.getCount();

    if (options.limit) {
      query.take(options.limit);
    }
    if (options.offset) {
      query.skip(options.offset);
    }

    const delegations = await query.getMany();

    return { delegations, total };
  }
}
