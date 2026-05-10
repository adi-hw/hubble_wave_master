import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Like, IsNull } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '@hubblewave/instance-db';

// ============================================================================
// DTOs
// ============================================================================

export interface UserListOptions {
  q?: string;
  status?: UserStatus;
  department?: string;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}

export interface UserListResult {
  data: UserDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UserDto {
  id: string;
  displayName: string;
  workEmail: string;
  employeeId?: string;
  title?: string;
  department?: string;
  status: UserStatus;
  isAdmin: boolean;
  invitedAt?: string;
  activatedAt?: string;
  lastLoginAt?: string;
  avatarUrl?: string;
}

export interface CreateUserDto {
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  employeeId?: string;
  title?: string;
  department?: string;
  location?: string;
  workPhone?: string;
  mobilePhone?: string;
}

export interface UpdateUserDto {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  employeeId?: string;
  title?: string;
  department?: string;
  location?: string;
  workPhone?: string;
  mobilePhone?: string;
  avatarUrl?: string;
}

export interface InviteUserDto {
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  department?: string;
  sendEmail?: boolean;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  // ==========================================================================
  // User Search
  // ==========================================================================

  async searchUsers(query: string) {
    return this.usersRepo.find({
      where: [
        { email: Like(`%${query}%`), deletedAt: IsNull() },
        { displayName: Like(`%${query}%`), deletedAt: IsNull() },
      ],
      take: 20,
      select: ['id', 'email', 'displayName', 'status'],
    });
  }

  // ==========================================================================
  // User List with Pagination
  // ==========================================================================

  async listUsers(options: UserListOptions = {}): Promise<UserListResult> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const query = this.usersRepo.createQueryBuilder('user');

    // Exclude deleted unless specifically requested
    if (!options.includeDeleted) {
      query.andWhere('user.deletedAt IS NULL');
    }

    // Search filter
    if (options.q) {
      query.andWhere(
        '(user.email ILIKE :q OR user.displayName ILIKE :q OR user.firstName ILIKE :q OR user.lastName ILIKE :q OR user.employeeId ILIKE :q)',
        { q: `%${options.q}%` },
      );
    }

    // Status filter
    if (options.status) {
      query.andWhere('user.status = :status', { status: options.status });
    }

    // Department filter
    if (options.department) {
      query.andWhere('user.department = :department', {
        department: options.department,
      });
    }

    // Get total count
    const total = await query.getCount();

    // Apply pagination and ordering
    query
      .orderBy('user.displayName', 'ASC')
      .skip(skip)
      .take(pageSize);

    const users = await query.getMany();

    return {
      data: users.map((u) => this.toUserDto(u)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ==========================================================================
  // User CRUD
  // ==========================================================================

  async getUserById(userId: string): Promise<User> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    return user;
  }

  async getUserDto(userId: string): Promise<UserDto> {
    const user = await this.getUserById(userId);
    return this.toUserDto(user);
  }

  async createUser(dto: CreateUserDto, createdBy?: string): Promise<User> {
    // Check for duplicate email
    const existing = await this.usersRepo.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException(`User with email "${dto.email}" already exists`);
    }

    const user = this.usersRepo.create({
      email: dto.email,
      displayName: dto.displayName,
      firstName: dto.firstName,
      lastName: dto.lastName,
      employeeId: dto.employeeId,
      title: dto.title,
      department: dto.department,
      location: dto.location,
      workPhone: dto.workPhone,
      mobilePhone: dto.mobilePhone,
      status: 'invited' as UserStatus,
      invitedAt: new Date(),
      invitedBy: createdBy,
    });

    const saved = await this.usersRepo.save(user);
    this.logger.log(`Created user: ${saved.email}`);

    return saved;
  }

  async updateUser(userId: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.getUserById(userId);

    if (dto.displayName !== undefined) user.displayName = dto.displayName;
    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.employeeId !== undefined) user.employeeId = dto.employeeId;
    if (dto.title !== undefined) user.title = dto.title;
    if (dto.department !== undefined) user.department = dto.department;
    if (dto.location !== undefined) user.location = dto.location;
    if (dto.workPhone !== undefined) user.workPhone = dto.workPhone;
    if (dto.mobilePhone !== undefined) user.mobilePhone = dto.mobilePhone;
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;

    await this.usersRepo.save(user);
    this.logger.log(`Updated user: ${userId}`);

    return user;
  }

  // ==========================================================================
  // User Status Management
  // ==========================================================================

  async deactivateUser(userId: string, deactivatedBy?: string, reason?: string): Promise<User> {
    const user = await this.getUserById(userId);

    if (user.status === 'inactive') {
      throw new BadRequestException('User is already inactive');
    }

    user.status = 'inactive' as UserStatus;
    user.deactivatedAt = new Date();
    user.deactivatedBy = deactivatedBy;
    user.deactivationReason = reason;

    await this.usersRepo.save(user);
    this.logger.log(`Deactivated user: ${userId}`);

    return user;
  }

  async reactivateUser(userId: string): Promise<User> {
    const user = await this.getUserById(userId);

    if (user.status !== 'inactive') {
      throw new BadRequestException('User is not inactive');
    }

    user.status = 'active' as UserStatus;
    user.deactivatedAt = undefined;
    user.deactivatedBy = undefined;
    user.deactivationReason = undefined;

    await this.usersRepo.save(user);
    this.logger.log(`Reactivated user: ${userId}`);

    return user;
  }

  async suspendUser(userId: string, suspendedBy?: string, reason?: string, expiresAt?: Date): Promise<User> {
    const user = await this.getUserById(userId);

    if (user.status === 'suspended') {
      throw new BadRequestException('User is already suspended');
    }

    user.status = 'suspended' as UserStatus;
    user.suspendedAt = new Date();
    user.suspendedBy = suspendedBy;
    user.suspensionReason = reason;
    user.suspensionExpiresAt = expiresAt;

    await this.usersRepo.save(user);
    this.logger.log(`Suspended user: ${userId}`);

    return user;
  }

  async unsuspendUser(userId: string): Promise<User> {
    const user = await this.getUserById(userId);

    if (user.status !== 'suspended') {
      throw new BadRequestException('User is not suspended');
    }

    user.status = 'active' as UserStatus;
    user.suspendedAt = undefined;
    user.suspendedBy = undefined;
    user.suspensionReason = undefined;
    user.suspensionExpiresAt = undefined;

    await this.usersRepo.save(user);
    this.logger.log(`Unsuspended user: ${userId}`);

    return user;
  }

  async unlockUser(userId: string): Promise<User> {
    const user = await this.getUserById(userId);

    if (user.status !== 'locked') {
      throw new BadRequestException('User is not locked');
    }

    user.status = 'active' as UserStatus;
    user.lockedUntil = undefined;
    user.failedLoginAttempts = 0;
    user.lastFailedLoginAt = undefined;

    await this.usersRepo.save(user);
    this.logger.log(`Unlocked user: ${userId}`);

    return user;
  }

  async deleteUser(userId: string, deletedBy?: string): Promise<void> {
    const user = await this.getUserById(userId);

    if (user.isSystemUser) {
      throw new BadRequestException('Cannot delete system user');
    }

    // Soft delete
    user.status = 'deleted' as UserStatus;
    user.deletedAt = new Date();
    user.deletedBy = deletedBy;

    await this.usersRepo.save(user);
    this.logger.log(`Deleted user: ${userId}`);
  }

  async restoreUser(userId: string): Promise<User> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    if (user.status !== 'deleted') {
      throw new BadRequestException('User is not deleted');
    }

    user.status = 'active' as UserStatus;
    user.deletedAt = undefined;
    user.deletedBy = undefined;

    await this.usersRepo.save(user);
    this.logger.log(`Restored user: ${userId}`);

    return user;
  }

  // ==========================================================================
  // Invite User
  // ==========================================================================

  async inviteUser(dto: InviteUserDto, invitedBy?: string): Promise<User> {
    const user = await this.createUser(
      {
        email: dto.email,
        displayName: dto.displayName,
        firstName: dto.firstName,
        lastName: dto.lastName,
        title: dto.title,
        department: dto.department,
      },
      invitedBy,
    );

    // Generate activation token
    const activationToken = this.generateActivationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    user.activationToken = activationToken;
    user.activationTokenExpiresAt = expiresAt;
    await this.usersRepo.save(user);

    return user;
  }

  async resendInvitation(userId: string): Promise<User> {
    const user = await this.getUserById(userId);

    if (user.status !== 'invited') {
      throw new BadRequestException('User is not in invited status');
    }

    // Regenerate activation token
    const activationToken = this.generateActivationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    user.activationToken = activationToken;
    user.activationTokenExpiresAt = expiresAt;
    await this.usersRepo.save(user);

    this.logger.log(`Resent invitation for user: ${userId}`);

    return user;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private toUserDto(user: User): UserDto {
    return {
      id: user.id,
      displayName: user.displayName,
      workEmail: user.email,
      employeeId: user.employeeId || undefined,
      title: user.title || undefined,
      department: user.department || undefined,
      status: user.status,
      isAdmin: user.isAdmin || false,
      invitedAt: user.invitedAt?.toISOString(),
      activatedAt: user.activatedAt?.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString(),
      avatarUrl: user.avatarUrl || undefined,
    };
  }

  private generateActivationToken(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15) +
      Date.now().toString(36)
    );
  }
}
