import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientScript, ClientScriptTrigger, AutomationConditionType } from '@hubblewave/instance-db';

export interface CreateScriptDto {
  name: string;
  description?: string;
  trigger: ClientScriptTrigger;
  watchProperty?: string;
  conditionType?: AutomationConditionType;
  condition?: Record<string, unknown>;
  actions?: any[];
  executionOrder?: number;
  isActive?: boolean;
}

export interface UpdateScriptDto extends Partial<CreateScriptDto> {}

@Injectable()
export class ScriptService {
  constructor(
    @InjectRepository(ClientScript)
    private readonly scriptRepo: Repository<ClientScript>,
  ) {}

  async listScripts(collectionId: string): Promise<ClientScript[]> {
    return this.scriptRepo.find({
      where: { collectionId },
      order: { executionOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async getScript(scriptId: string): Promise<ClientScript> {
    const script = await this.scriptRepo.findOne({
      where: { id: scriptId },
    });

    if (!script) {
      throw new NotFoundException(`Script ${scriptId} not found`);
    }

    return script;
  }

  async createScript(
    collectionId: string,
    dto: CreateScriptDto,
    userId?: string,
  ): Promise<ClientScript> {
    const script = this.scriptRepo.create({
      collectionId,
      name: dto.name,
      description: dto.description,
      trigger: dto.trigger,
      watchProperty: dto.watchProperty,
      conditionType: dto.conditionType ?? 'always',
      condition: dto.condition,
      actions: dto.actions ?? [],
      executionOrder: dto.executionOrder ?? 100,
      isActive: dto.isActive ?? true,
      createdBy: userId,
    } as Partial<ClientScript>);

    return this.scriptRepo.save(script);
  }

  async updateScript(
    scriptId: string,
    dto: UpdateScriptDto,
  ): Promise<ClientScript> {
    const script = await this.getScript(scriptId);

    if (dto.name !== undefined) script.name = dto.name;
    if (dto.description !== undefined) script.description = dto.description;
    if (dto.trigger !== undefined) script.trigger = dto.trigger;
    if (dto.watchProperty !== undefined) script.watchProperty = dto.watchProperty;
    if (dto.conditionType !== undefined) script.conditionType = dto.conditionType as any;
    if (dto.condition !== undefined) script.condition = dto.condition;
    if (dto.actions !== undefined) script.actions = dto.actions;
    if (dto.executionOrder !== undefined) script.executionOrder = dto.executionOrder;
    if (dto.isActive !== undefined) script.isActive = dto.isActive;

    return this.scriptRepo.save(script);
  }

  async deleteScript(scriptId: string): Promise<void> {
    const script = await this.getScript(scriptId);
    await this.scriptRepo.remove(script);
  }
}
