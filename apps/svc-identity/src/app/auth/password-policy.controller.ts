import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { PasswordPolicy } from '@hubblewave/instance-db';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@Controller('admin/auth/password-policy')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
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
