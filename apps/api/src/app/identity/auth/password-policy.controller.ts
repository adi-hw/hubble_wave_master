import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { PasswordPolicy } from '@hubblewave/instance-db';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermission } from '@hubblewave/auth-guard';
import { SkipAbac } from '../abac/abac.guard';

/**
 * Canon §28 / W2 Stream 3 Task 20 — password policy administration
 * is gated by `@RequirePermission('system:configure')`. The
 * pre-Stream-3 class-level `@Roles('admin')` was redundant once the
 * capability model expressed the same authority.
 */
@Controller('admin/auth/password-policy')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('system:configure')
@SkipAbac()
export class PasswordPolicyController {
  constructor(
    @InjectRepository(PasswordPolicy) private readonly passwordPolicyRepo: Repository<PasswordPolicy>,
  ) {}

  @Get()
  async getPolicy() {
    return this.passwordPolicyRepo.findOne({ where: {} });
  }

  @Post()
  async savePolicy(@Body() policy: Partial<PasswordPolicy>) {
    let existing = await this.passwordPolicyRepo.findOne({ where: {} });

    if (existing) {
      existing = this.passwordPolicyRepo.merge(existing, policy);
      return this.passwordPolicyRepo.save(existing);
    } else {
      const newPolicy = this.passwordPolicyRepo.create({ ...policy });
      return this.passwordPolicyRepo.save(newPolicy);
    }
  }
}
