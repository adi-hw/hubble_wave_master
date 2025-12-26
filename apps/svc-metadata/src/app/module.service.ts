import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleEntity } from '@hubblewave/instance-db';

@Injectable()
export class ModuleService {
  constructor(
    @InjectRepository(ModuleEntity)
    private readonly repo: Repository<ModuleEntity>
  ) {}

  async listModules() {
    return this.repo.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  async createModule(
    input: { name: string; slug: string; description?: string; route?: string; icon?: string; category?: string; sortOrder?: number }
  ) {
    const module = this.repo.create({
      ...input,
      sortOrder: input.sortOrder ?? 0,
    });
    return this.repo.save(module);
  }
}
