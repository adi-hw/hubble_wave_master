import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  AVACard,
  AVAPromptPolicy,
  AVATopic,
  AVATool,
  AVAToolApprovalPolicy,
} from '@hubblewave/instance-db';

type AvaAsset = {
  tools?: AvaToolAsset[];
  topics?: AvaTopicAsset[];
  cards?: AvaCardAsset[];
  prompt_policies?: AvaPromptPolicyAsset[];
};

type AvaToolAsset = {
  code: string;
  name: string;
  description?: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  permission_requirements?: Record<string, unknown>;
  approval_policy?: AVAToolApprovalPolicy;
  metadata?: Record<string, unknown>;
};

type AvaTopicAsset = {
  code: string;
  name: string;
  description?: string;
  routing_rules?: Record<string, unknown>;
  response_formats?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type AvaCardAsset = {
  code: string;
  name: string;
  description?: string;
  layout?: Record<string, unknown>;
  action_bindings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type AvaPromptPolicyAsset = {
  code: string;
  name: string;
  description?: string;
  policy?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AvaIngestService {
  async applyAsset(
    manager: EntityManager,
    rawAsset: unknown,
    context: { packCode: string; releaseId: string; actorId?: string; status?: 'draft' | 'published' | 'deprecated' },
  ): Promise<void> {
    const asset = this.parseAsset(rawAsset);
    const toolRepo = manager.getRepository(AVATool);
    const topicRepo = manager.getRepository(AVATopic);
    const cardRepo = manager.getRepository(AVACard);
    const policyRepo = manager.getRepository(AVAPromptPolicy);

    for (const tool of asset.tools || []) {
      const existing = await toolRepo.findOne({ where: { code: tool.code } });
      if (existing) {
        this.assertPackOwnership(existing.metadata, context.packCode, 'tool', tool.code);
        existing.name = tool.name;
        existing.description = tool.description || null;
        existing.inputSchema = tool.input_schema || {};
        existing.outputSchema = tool.output_schema || {};
        existing.permissionRequirements = tool.permission_requirements || {};
        existing.approvalPolicy = tool.approval_policy || 'always';
        existing.metadata = this.mergeMetadata(tool.metadata, context, existing.metadata);
        existing.isActive = true;
        existing.updatedBy = context.actorId;
        await toolRepo.save(existing);
      } else {
        const created = toolRepo.create({
          code: tool.code,
          name: tool.name,
          description: tool.description || null,
          inputSchema: tool.input_schema || {},
          outputSchema: tool.output_schema || {},
          permissionRequirements: tool.permission_requirements || {},
          approvalPolicy: tool.approval_policy || 'always',
          metadata: this.mergeMetadata(tool.metadata, context),
          isActive: true,
          createdBy: context.actorId,
          updatedBy: context.actorId,
        });
        await toolRepo.save(created);
      }
    }

    for (const topic of asset.topics || []) {
      const existing = await topicRepo.findOne({ where: { code: topic.code } });
      if (existing) {
        this.assertPackOwnership(existing.metadata, context.packCode, 'topic', topic.code);
        existing.name = topic.name;
        existing.description = topic.description || null;
        existing.routingRules = topic.routing_rules || {};
        existing.responseFormats = topic.response_formats || {};
        existing.metadata = this.mergeMetadata(topic.metadata, context, existing.metadata);
        existing.isActive = true;
        existing.updatedBy = context.actorId;
        await topicRepo.save(existing);
      } else {
        const created = topicRepo.create({
          code: topic.code,
          name: topic.name,
          description: topic.description || null,
          routingRules: topic.routing_rules || {},
          responseFormats: topic.response_formats || {},
          metadata: this.mergeMetadata(topic.metadata, context),
          isActive: true,
          createdBy: context.actorId,
          updatedBy: context.actorId,
        });
        await topicRepo.save(created);
      }
    }

    for (const card of asset.cards || []) {
      const existing = await cardRepo.findOne({ where: { code: card.code } });
      if (existing) {
        this.assertPackOwnership(existing.metadata, context.packCode, 'card', card.code);
        existing.name = card.name;
        existing.description = card.description || null;
        existing.layout = card.layout || {};
        existing.actionBindings = card.action_bindings || {};
        existing.metadata = this.mergeMetadata(card.metadata, context, existing.metadata);
        existing.isActive = true;
        existing.updatedBy = context.actorId;
        await cardRepo.save(existing);
      } else {
        const created = cardRepo.create({
          code: card.code,
          name: card.name,
          description: card.description || null,
          layout: card.layout || {},
          actionBindings: card.action_bindings || {},
          metadata: this.mergeMetadata(card.metadata, context),
          isActive: true,
          createdBy: context.actorId,
          updatedBy: context.actorId,
        });
        await cardRepo.save(created);
      }
    }

    for (const policy of asset.prompt_policies || []) {
      const existing = await policyRepo.findOne({ where: { code: policy.code } });
      if (existing) {
        this.assertPackOwnership(existing.metadata, context.packCode, 'prompt_policy', policy.code);
        existing.name = policy.name;
        existing.description = policy.description || null;
        existing.policy = policy.policy || {};
        existing.metadata = this.mergeMetadata(policy.metadata, context, existing.metadata);
        existing.isActive = true;
        existing.updatedBy = context.actorId;
        await policyRepo.save(existing);
      } else {
        const created = policyRepo.create({
          code: policy.code,
          name: policy.name,
          description: policy.description || null,
          policy: policy.policy || {},
          metadata: this.mergeMetadata(policy.metadata, context),
          isActive: true,
          createdBy: context.actorId,
          updatedBy: context.actorId,
        });
        await policyRepo.save(created);
      }
    }
  }

  async deactivateAsset(
    manager: EntityManager,
    rawAsset: unknown,
    context: { packCode: string; releaseId: string; actorId?: string },
  ): Promise<void> {
    const asset = this.parseAsset(rawAsset);
    const toolRepo = manager.getRepository(AVATool);
    const topicRepo = manager.getRepository(AVATopic);
    const cardRepo = manager.getRepository(AVACard);
    const policyRepo = manager.getRepository(AVAPromptPolicy);

    for (const tool of asset.tools || []) {
      const existing = await toolRepo.findOne({ where: { code: tool.code } });
      if (!existing) {
        continue;
      }
      this.assertPackOwnership(existing.metadata, context.packCode, 'tool', tool.code);
      existing.isActive = false;
      existing.metadata = this.mergeMetadata(tool.metadata, { ...context, status: 'deprecated' }, existing.metadata);
      existing.updatedBy = context.actorId;
      await toolRepo.save(existing);
    }

    for (const topic of asset.topics || []) {
      const existing = await topicRepo.findOne({ where: { code: topic.code } });
      if (!existing) {
        continue;
      }
      this.assertPackOwnership(existing.metadata, context.packCode, 'topic', topic.code);
      existing.isActive = false;
      existing.metadata = this.mergeMetadata(topic.metadata, { ...context, status: 'deprecated' }, existing.metadata);
      existing.updatedBy = context.actorId;
      await topicRepo.save(existing);
    }

    for (const card of asset.cards || []) {
      const existing = await cardRepo.findOne({ where: { code: card.code } });
      if (!existing) {
        continue;
      }
      this.assertPackOwnership(existing.metadata, context.packCode, 'card', card.code);
      existing.isActive = false;
      existing.metadata = this.mergeMetadata(card.metadata, { ...context, status: 'deprecated' }, existing.metadata);
      existing.updatedBy = context.actorId;
      await cardRepo.save(existing);
    }

    for (const policy of asset.prompt_policies || []) {
      const existing = await policyRepo.findOne({ where: { code: policy.code } });
      if (!existing) {
        continue;
      }
      this.assertPackOwnership(existing.metadata, context.packCode, 'prompt_policy', policy.code);
      existing.isActive = false;
      existing.metadata = this.mergeMetadata(policy.metadata, { ...context, status: 'deprecated' }, existing.metadata);
      existing.updatedBy = context.actorId;
      await policyRepo.save(existing);
    }
  }

  private parseAsset(raw: unknown): AvaAsset {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('AVA asset must be an object');
    }
    const asset = raw as AvaAsset;
    const hasContent =
      (asset.tools && asset.tools.length) ||
      (asset.topics && asset.topics.length) ||
      (asset.cards && asset.cards.length) ||
      (asset.prompt_policies && asset.prompt_policies.length);
    if (!hasContent) {
      throw new BadRequestException('AVA asset must include tools, topics, cards, or prompt_policies');
    }

    this.validateTools(asset.tools || []);
    this.validateTopics(asset.topics || []);
    this.validateCards(asset.cards || []);
    this.validatePolicies(asset.prompt_policies || []);

    return asset;
  }

  private validateTools(tools: AvaToolAsset[]): void {
    const seen = new Set<string>();
    for (const tool of tools) {
      if (!tool.code || typeof tool.code !== 'string') {
        throw new BadRequestException('AVA tool code is required');
      }
      if (!this.isValidCode(tool.code)) {
        throw new BadRequestException(`AVA tool code ${tool.code} is invalid`);
      }
      if (seen.has(tool.code)) {
        throw new BadRequestException(`Duplicate AVA tool code ${tool.code}`);
      }
      seen.add(tool.code);
      if (!tool.name || typeof tool.name !== 'string') {
        throw new BadRequestException(`AVA tool ${tool.code} is missing name`);
      }
    }
  }

  private validateTopics(topics: AvaTopicAsset[]): void {
    const seen = new Set<string>();
    for (const topic of topics) {
      if (!topic.code || typeof topic.code !== 'string') {
        throw new BadRequestException('AVA topic code is required');
      }
      if (!this.isValidCode(topic.code)) {
        throw new BadRequestException(`AVA topic code ${topic.code} is invalid`);
      }
      if (seen.has(topic.code)) {
        throw new BadRequestException(`Duplicate AVA topic code ${topic.code}`);
      }
      seen.add(topic.code);
      if (!topic.name || typeof topic.name !== 'string') {
        throw new BadRequestException(`AVA topic ${topic.code} is missing name`);
      }
    }
  }

  private validateCards(cards: AvaCardAsset[]): void {
    const seen = new Set<string>();
    for (const card of cards) {
      if (!card.code || typeof card.code !== 'string') {
        throw new BadRequestException('AVA card code is required');
      }
      if (!this.isValidCode(card.code)) {
        throw new BadRequestException(`AVA card code ${card.code} is invalid`);
      }
      if (seen.has(card.code)) {
        throw new BadRequestException(`Duplicate AVA card code ${card.code}`);
      }
      seen.add(card.code);
      if (!card.name || typeof card.name !== 'string') {
        throw new BadRequestException(`AVA card ${card.code} is missing name`);
      }
    }
  }

  private validatePolicies(policies: AvaPromptPolicyAsset[]): void {
    const seen = new Set<string>();
    for (const policy of policies) {
      if (!policy.code || typeof policy.code !== 'string') {
        throw new BadRequestException('AVA prompt policy code is required');
      }
      if (!this.isValidCode(policy.code)) {
        throw new BadRequestException(`AVA prompt policy code ${policy.code} is invalid`);
      }
      if (seen.has(policy.code)) {
        throw new BadRequestException(`Duplicate AVA prompt policy code ${policy.code}`);
      }
      seen.add(policy.code);
      if (!policy.name || typeof policy.name !== 'string') {
        throw new BadRequestException(`AVA prompt policy ${policy.code} is missing name`);
      }
    }
  }

  private mergeMetadata(
    incoming: Record<string, unknown> | undefined,
    context: { packCode: string; releaseId: string; status?: 'draft' | 'published' | 'deprecated' },
    existing: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const existingStatus = (existing as { status?: string }).status;
    const status = context.status || (existingStatus as 'draft' | 'published' | 'deprecated' | undefined) || 'draft';
    return {
      ...existing,
      ...incoming,
      status,
      pack: {
        code: context.packCode,
        release_id: context.releaseId,
      },
    };
  }

  private assertPackOwnership(
    metadata: Record<string, unknown>,
    packCode: string,
    entityType: 'tool' | 'topic' | 'card' | 'prompt_policy',
    entityCode: string,
  ): void {
    const existingPack = (metadata as { pack?: { code?: string } }).pack?.code;
    if (existingPack && existingPack !== packCode) {
      throw new ConflictException(
        `${entityType} ${entityCode} is owned by pack ${existingPack}`,
      );
    }
  }

  private isValidCode(value: string): boolean {
    return /^[a-z0-9_]+$/.test(value);
  }
}
