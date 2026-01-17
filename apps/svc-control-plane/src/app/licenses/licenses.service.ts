import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { License } from '@hubblewave/control-plane-db';
import { randomUUID } from 'crypto';
import { CreateLicenseDto, UpdateLicenseStatusDto, ValidateLicenseDto } from './licenses.dto';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class LicensesService {
  constructor(
    @InjectRepository(License)
    private readonly licenseRepo: Repository<License>,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async findAll(customerId?: string) {
    return this.licenseRepo.find({
      where: {
        customerId: customerId || undefined,
        revokedAt: IsNull(),
      },
      relations: ['customer'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const license = await this.licenseRepo.findOne({ where: { id } });
    if (!license) {
      throw new NotFoundException('License not found');
    }
    return license;
  }

  private generateLicenseKey(customerId: string, type: string) {
    const suffix = randomUUID().split('-')[0].toUpperCase();
    return `HW-${type.toUpperCase()}-${customerId.slice(0, 6).toUpperCase()}-${suffix}`;
  }

  private signLicense(payload: Record<string, unknown>): string {
    const secret = this.configService.get<string>('CONTROL_PLANE_LICENSE_SECRET');
    if (!secret) {
      throw new InternalServerErrorException('CONTROL_PLANE_LICENSE_SECRET not configured');
    }
    const data = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(data).digest('base64url');
  }

  private verifyLicense(payload: Record<string, unknown>, signature: string): boolean {
    const expected = this.signLicense(payload);
    // constant-time compare
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  async create(dto: CreateLicenseDto, actor?: string) {
    const licenseKey = this.generateLicenseKey(dto.customerId, dto.licenseType);
    const license = this.licenseRepo.create({
      customerId: dto.customerId,
      licenseKey,
      licenseType: dto.licenseType,
      status: 'active',
      maxUsers: dto.maxUsers,
      maxAssets: dto.maxAssets,
      features: dto.features || [],
      issuedAt: new Date(),
      expiresAt: new Date(dto.expiresAt),
      signature: '', // populated below
      metadata: {},
      createdBy: actor,
    });

    const payload = {
      licenseKey,
      licenseType: license.licenseType,
      maxUsers: license.maxUsers,
      maxAssets: license.maxAssets,
      expiresAt: license.expiresAt,
    };
    license.signature = this.signLicense(payload);

    const saved = await this.licenseRepo.save(license);
    await this.auditService.log('license.created', `License issued: ${licenseKey}`, {
      customerId: dto.customerId,
      actor: actor || 'system',
      target: saved.id,
      targetType: 'license',
      metadata: { licenseType: license.licenseType, maxUsers: license.maxUsers, maxAssets: license.maxAssets },
    });
    return saved;
  }

  async updateStatus(id: string, dto: UpdateLicenseStatusDto, actor?: string) {
    const license = await this.findOne(id);
    license.status = dto.status;
    if (dto.status === 'revoked') {
      license.revokedAt = new Date();
      license.revokedBy = actor;
      license.revokeReason = dto.revokeReason;
    }
    const saved = await this.licenseRepo.save(license);
    await this.auditService.log('license.updated', `License ${license.licenseKey} status ${dto.status}`, {
      customerId: license.customerId,
      actor: actor || 'system',
      target: license.id,
      targetType: 'license',
      metadata: { status: dto.status, reason: dto.revokeReason },
    });
    return saved;
  }

  async validate(dto: ValidateLicenseDto) {
    const license = await this.licenseRepo.findOne({ where: { licenseKey: dto.licenseKey } });
    if (!license) {
      return { valid: false, reason: 'NOT_FOUND' };
    }
    if (license.status !== 'active') {
      return { valid: false, reason: `STATUS_${license.status.toUpperCase()}` };
    }
    if (license.expiresAt && license.expiresAt < new Date()) {
      return { valid: false, reason: 'EXPIRED' };
    }
    const payload = {
      licenseKey: license.licenseKey,
      licenseType: license.licenseType,
      maxUsers: license.maxUsers,
      maxAssets: license.maxAssets,
      expiresAt: license.expiresAt,
    };
    const validSignature = license.signature ? this.verifyLicense(payload, license.signature) : false;
    if (!validSignature) {
      return { valid: false, reason: 'INVALID_SIGNATURE' };
    }
    return { valid: true, license };
  }

  async ensureActiveLicenseForCustomer(customerId: string) {
    const license = await this.licenseRepo.findOne({
      where: { customerId, status: 'active' },
      order: { expiresAt: 'DESC' },
    });
    if (!license) {
      throw new NotFoundException('No active license for customer');
    }
    if (license.expiresAt && license.expiresAt < new Date()) {
      throw new NotFoundException('License expired for customer');
    }
    const payload = {
      licenseKey: license.licenseKey,
      licenseType: license.licenseType,
      maxUsers: license.maxUsers,
      maxAssets: license.maxAssets,
      expiresAt: license.expiresAt,
    };
    const validSignature = license.signature ? this.verifyLicense(payload, license.signature) : false;
    if (!validSignature) {
      throw new NotFoundException('Invalid license signature for customer');
    }
    return license;
  }

  async getLatestLicenseForCustomer(customerId: string) {
    const license = await this.licenseRepo.findOne({
      where: { customerId },
      order: { expiresAt: 'DESC', createdAt: 'DESC' },
    });
    if (!license) {
      throw new NotFoundException('No license found for customer');
    }
    return license;
  }
}
