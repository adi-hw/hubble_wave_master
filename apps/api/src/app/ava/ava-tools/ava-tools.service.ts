import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AVATool, AVAToolApprovalPolicy } from '@hubblewave/instance-db';

export type CreateAvaToolRequest = {
  code: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  permissionRequirements?: Record<string, unknown>;
  approvalPolicy?: AVAToolApprovalPolicy;
};

export type UpdateAvaToolRequest = Partial<Omit<CreateAvaToolRequest, 'code'>>;

@Injectable()
export class AvaToolsService {
  constructor(
    @InjectRepository(AVATool)
    private readonly toolRepo: Repository<AVATool>,
  ) {}

  async listTools(includeInactive = false) {
    return this.toolRepo.find({
      where: includeInactive ? {} : { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async createTool(request: CreateAvaToolRequest, actorId?: string) {
    this.assertValidCode(request.code);
    const existing = await this.toolRepo.findOne({ where: { code: request.code } });
    if (existing) {
      throw new BadRequestException(`AVA tool ${request.code} already exists`);
    }

    const tool = this.toolRepo.create({
      code: request.code,
      name: request.name.trim(),
      description: request.description?.trim() || null,
      inputSchema: this.ensureObject(request.inputSchema),
      outputSchema: this.ensureObject(request.outputSchema),
      permissionRequirements: this.ensureObject(request.permissionRequirements),
      approvalPolicy: request.approvalPolicy || 'always',
      metadata: { status: 'published' },
      isActive: true,
      createdBy: actorId || null,
      updatedBy: actorId || null,
    });
    return this.toolRepo.save(tool);
  }

  async updateTool(code: string, request: UpdateAvaToolRequest, actorId?: string) {
    const tool = await this.toolRepo.findOne({ where: { code } });
    if (!tool) {
      throw new NotFoundException(`AVA tool ${code} not found`);
    }

    if (request.name) {
      tool.name = request.name.trim();
    }
    if (request.description !== undefined) {
      tool.description = request.description?.trim() || null;
    }
    if (request.inputSchema) {
      tool.inputSchema = this.ensureObject(request.inputSchema);
    }
    if (request.outputSchema) {
      tool.outputSchema = this.ensureObject(request.outputSchema);
    }
    if (request.permissionRequirements) {
      tool.permissionRequirements = this.ensureObject(request.permissionRequirements);
    }
    if (request.approvalPolicy) {
      tool.approvalPolicy = request.approvalPolicy;
    }
    tool.updatedBy = actorId || null;
    return this.toolRepo.save(tool);
  }

  async publishTool(code: string, actorId?: string) {
    const tool = await this.toolRepo.findOne({ where: { code } });
    if (!tool) {
      throw new NotFoundException(`AVA tool ${code} not found`);
    }
    tool.isActive = true;
    tool.metadata = this.mergeMetadata(tool.metadata, 'published');
    tool.updatedBy = actorId || null;
    return this.toolRepo.save(tool);
  }

  private ensureObject(value?: Record<string, unknown>): Record<string, unknown> {
    if (!value) {
      return {};
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('schema must be an object');
    }
    return value;
  }

  private mergeMetadata(
    existing: Record<string, unknown> = {},
    status: 'draft' | 'published' | 'deprecated',
  ): Record<string, unknown> {
    return {
      ...existing,
      status,
    };
  }

  private assertValidCode(code: string) {
    if (!code || !/^[a-z0-9_]+$/.test(code)) {
      throw new BadRequestException('code must be lowercase letters, numbers, or underscore');
    }
  }
}
