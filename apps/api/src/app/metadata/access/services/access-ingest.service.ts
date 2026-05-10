import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import {
  CollectionAccessRule,
  CollectionDefinition,
  Group,
  PropertyAccessRule,
  PropertyDefinition,
  Role,
  User,
} from '@hubblewave/instance-db';
import type { AccessConditionData, MaskingStrategy } from '@hubblewave/authorization';

type AccessAsset = {
  collections?: AccessCollectionAsset[];
  fields?: AccessFieldAsset[];
};

type AccessCollectionAsset = {
  collection_code: string;
  rules: AccessCollectionRule[];
};

type AccessFieldAsset = {
  collection_code: string;
  property_code: string;
  rules: AccessFieldRule[];
};

type AccessPrincipal = {
  type: 'everyone' | 'role' | 'group' | 'user';
  role_code?: string;
  group_code?: string;
  user_email?: string;
  role_id?: string;
  group_id?: string;
  user_id?: string;
};

type AccessCollectionRule = {
  key: string;
  name: string;
  description?: string;
  principal: AccessPrincipal;
  permissions?: {
    read?: boolean;
    create?: boolean;
    update?: boolean;
    delete?: boolean;
  };
  conditions?: AccessConditionData;
  priority?: number;
  is_active?: boolean;
};

type AccessFieldRule = {
  key: string;
  principal: AccessPrincipal;
  permissions?: {
    read?: boolean;
    write?: boolean;
  };
  masking?: MaskingStrategy;
  conditions?: AccessConditionData;
  priority?: number;
  is_active?: boolean;
};

@Injectable()
export class AccessIngestService {
  async applyAsset(
    manager: EntityManager,
    rawAsset: unknown,
    context: { packCode: string; releaseId: string; actorId?: string; status?: 'published' | 'deprecated' },
  ): Promise<void> {
    const asset = this.parseAsset(rawAsset);
    const collectionRepo = manager.getRepository(CollectionDefinition);
    const propertyRepo = manager.getRepository(PropertyDefinition);
    const roleRepo = manager.getRepository(Role);
    const groupRepo = manager.getRepository(Group);
    const userRepo = manager.getRepository(User);
    const collectionRuleRepo = manager.getRepository(CollectionAccessRule);
    const propertyRuleRepo = manager.getRepository(PropertyAccessRule);

    for (const entry of asset.collections ?? []) {
      const collection = await this.resolveCollection(collectionRepo, entry.collection_code);
      for (const rule of entry.rules) {
        const principal = await this.resolvePrincipal(rule.principal, roleRepo, groupRepo, userRepo);
        const existing = await this.findCollectionRule(collectionRuleRepo, collection.id, rule.key);
        if (existing) {
          this.assertOwnership(existing.metadata, context.packCode, rule.key);
          existing.name = rule.name;
          existing.description = rule.description;
          existing.roleId = principal.roleId;
          existing.groupId = principal.groupId;
          existing.userId = principal.userId;
          existing.canRead = rule.permissions?.read ?? false;
          existing.canCreate = rule.permissions?.create ?? false;
          existing.canUpdate = rule.permissions?.update ?? false;
          existing.canDelete = rule.permissions?.delete ?? false;
          existing.conditions = (rule.conditions as Record<string, unknown> | undefined) ?? undefined;
          existing.priority = rule.priority ?? 100;
          existing.isActive = rule.is_active ?? true;
          existing.metadata = this.mergeMetadata(existing.metadata, context);
          await collectionRuleRepo.save(existing);
          continue;
        }

        const created = collectionRuleRepo.create({
          collectionId: collection.id,
          name: rule.name,
          description: rule.description,
          roleId: principal.roleId,
          groupId: principal.groupId,
          userId: principal.userId,
          canRead: rule.permissions?.read ?? false,
          canCreate: rule.permissions?.create ?? false,
          canUpdate: rule.permissions?.update ?? false,
          canDelete: rule.permissions?.delete ?? false,
          conditions: (rule.conditions as Record<string, unknown> | undefined) ?? undefined,
          priority: rule.priority ?? 100,
          isActive: rule.is_active ?? true,
          createdBy: context.actorId || undefined,
          ruleKey: rule.key,
          metadata: this.mergeMetadata({}, context),
        } as Partial<CollectionAccessRule>);
        await collectionRuleRepo.save(created);
      }
    }

    for (const entry of asset.fields ?? []) {
      const collection = await this.resolveCollection(collectionRepo, entry.collection_code);
      const property = await this.resolveProperty(propertyRepo, collection.id, entry.property_code);
      for (const rule of entry.rules) {
        const principal = await this.resolvePrincipal(rule.principal, roleRepo, groupRepo, userRepo);
        const existing = await this.findPropertyRule(propertyRuleRepo, property.id, rule.key);
        if (existing) {
          this.assertOwnership(existing.metadata, context.packCode, rule.key);
          existing.roleId = principal.roleId;
          existing.groupId = principal.groupId;
          existing.userId = principal.userId;
          existing.canRead = rule.permissions?.read ?? true;
          existing.canWrite = rule.permissions?.write ?? true;
          existing.maskingStrategy = rule.masking ?? 'NONE';
          existing.conditions = (rule.conditions as Record<string, unknown> | undefined) ?? undefined;
          existing.priority = rule.priority ?? 100;
          existing.isActive = rule.is_active ?? true;
          existing.metadata = this.mergeMetadata(existing.metadata, context);
          await propertyRuleRepo.save(existing);
          continue;
        }

        const created = propertyRuleRepo.create({
          propertyId: property.id,
          roleId: principal.roleId,
          groupId: principal.groupId,
          userId: principal.userId,
          canRead: rule.permissions?.read ?? true,
          canWrite: rule.permissions?.write ?? true,
          maskingStrategy: rule.masking ?? 'NONE',
          conditions: (rule.conditions as Record<string, unknown> | undefined) ?? undefined,
          priority: rule.priority ?? 100,
          isActive: rule.is_active ?? true,
          createdBy: context.actorId || undefined,
          ruleKey: rule.key,
          metadata: this.mergeMetadata({}, context),
        } as Partial<PropertyAccessRule>);
        await propertyRuleRepo.save(created);
      }
    }
  }

  async deactivateAsset(
    manager: EntityManager,
    rawAsset: unknown,
    context: { packCode: string; releaseId: string; actorId?: string },
  ): Promise<void> {
    const asset = this.parseAsset(rawAsset);
    const collectionRuleRepo = manager.getRepository(CollectionAccessRule);
    const propertyRuleRepo = manager.getRepository(PropertyAccessRule);
    const collectionRepo = manager.getRepository(CollectionDefinition);
    const propertyRepo = manager.getRepository(PropertyDefinition);

    for (const entry of asset.collections ?? []) {
      const collection = await this.resolveCollection(collectionRepo, entry.collection_code);
      for (const rule of entry.rules) {
        const existing = await this.findCollectionRule(collectionRuleRepo, collection.id, rule.key);
        if (!existing) {
          continue;
        }
        this.assertOwnership(existing.metadata, context.packCode, rule.key);
        existing.isActive = false;
        existing.metadata = this.mergeMetadata(existing.metadata, {
          packCode: context.packCode,
          releaseId: context.releaseId,
          status: 'deprecated',
        });
        await collectionRuleRepo.save(existing);
      }
    }

    for (const entry of asset.fields ?? []) {
      const collection = await this.resolveCollection(collectionRepo, entry.collection_code);
      const property = await this.resolveProperty(propertyRepo, collection.id, entry.property_code);
      for (const rule of entry.rules) {
        const existing = await this.findPropertyRule(propertyRuleRepo, property.id, rule.key);
        if (!existing) {
          continue;
        }
        this.assertOwnership(existing.metadata, context.packCode, rule.key);
        existing.isActive = false;
        existing.metadata = this.mergeMetadata(existing.metadata, {
          packCode: context.packCode,
          releaseId: context.releaseId,
          status: 'deprecated',
        });
        await propertyRuleRepo.save(existing);
      }
    }
  }

  private parseAsset(raw: unknown): AccessAsset {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Access asset must be an object');
    }
    const payload = raw as AccessAsset;
    if (!payload.collections && !payload.fields) {
      throw new BadRequestException('Access asset must include collections or fields');
    }
    if (payload.collections) {
      payload.collections.forEach((collection, index) => {
        if (!collection.collection_code) {
          throw new BadRequestException(`collections[${index}] must include collection_code`);
        }
        if (!Array.isArray(collection.rules) || collection.rules.length === 0) {
          throw new BadRequestException(`collections[${index}] must include rules`);
        }
        collection.rules.forEach((rule, ruleIndex) => {
          this.validateRuleKey(rule.key, `collections[${index}].rules[${ruleIndex}].key`);
          if (!rule.name) {
            throw new BadRequestException(`collections[${index}].rules[${ruleIndex}] missing name`);
          }
          this.validatePrincipal(rule.principal, `collections[${index}].rules[${ruleIndex}]`);
        });
      });
    }
    if (payload.fields) {
      payload.fields.forEach((field, index) => {
        if (!field.collection_code || !field.property_code) {
          throw new BadRequestException(`fields[${index}] must include collection_code and property_code`);
        }
        if (!Array.isArray(field.rules) || field.rules.length === 0) {
          throw new BadRequestException(`fields[${index}] must include rules`);
        }
        field.rules.forEach((rule, ruleIndex) => {
          this.validateRuleKey(rule.key, `fields[${index}].rules[${ruleIndex}].key`);
          this.validatePrincipal(rule.principal, `fields[${index}].rules[${ruleIndex}]`);
        });
      });
    }
    return payload;
  }

  private validateRuleKey(key: string, path: string) {
    if (!key || typeof key !== 'string') {
      throw new BadRequestException(`${path} is required`);
    }
    if (!/^[a-z0-9_]+$/.test(key)) {
      throw new BadRequestException(`${path} must be lowercase letters, numbers, or underscore`);
    }
  }

  private validatePrincipal(principal: AccessPrincipal | undefined, path: string) {
    if (!principal) {
      throw new BadRequestException(`${path} must include principal`);
    }
    if (!['everyone', 'role', 'group', 'user'].includes(principal.type)) {
      throw new BadRequestException(`${path} principal.type is invalid`);
    }
  }

  private async resolveCollection(
    repo: Repository<CollectionDefinition>,
    code: string
  ): Promise<CollectionDefinition> {
    const collection = await repo.findOne({ where: { code } });
    if (!collection) {
      throw new BadRequestException(`Unknown collection ${code}`);
    }
    return collection;
  }

  private async resolveProperty(
    repo: Repository<PropertyDefinition>,
    collectionId: string,
    code: string
  ): Promise<PropertyDefinition> {
    const property = await repo.findOne({ where: { collectionId, code } });
    if (!property) {
      throw new BadRequestException(`Unknown property ${code}`);
    }
    return property;
  }

  private async resolvePrincipal(
    principal: AccessPrincipal,
    roleRepo: Repository<Role>,
    groupRepo: Repository<Group>,
    userRepo: Repository<User>,
  ): Promise<{ roleId: string | null; groupId: string | null; userId: string | null }> {
    if (principal.type === 'everyone') {
      return { roleId: null, groupId: null, userId: null };
    }

    if (principal.type === 'role') {
      const roleId = principal.role_id
        ? principal.role_id
        : principal.role_code
          ? (await roleRepo.findOne({ where: { code: principal.role_code } }))?.id
          : null;
      if (!roleId) {
        throw new BadRequestException('principal role not found');
      }
      return { roleId, groupId: null, userId: null };
    }

    if (principal.type === 'group') {
      const groupId = principal.group_id
        ? principal.group_id
        : principal.group_code
          ? (await groupRepo.findOne({ where: { code: principal.group_code } }))?.id
          : null;
      if (!groupId) {
        throw new BadRequestException('principal group not found');
      }
      return { roleId: null, groupId, userId: null };
    }

    const userId = principal.user_id
      ? principal.user_id
      : principal.user_email
        ? (await userRepo.findOne({ where: { email: principal.user_email } }))?.id
        : null;
    if (!userId) {
      throw new BadRequestException('principal user not found');
    }
    return { roleId: null, groupId: null, userId };
  }

  private async findCollectionRule(
    repo: Repository<CollectionAccessRule>,
    collectionId: string,
    ruleKey: string
  ): Promise<CollectionAccessRule | null> {
    return repo.findOne({ where: { collectionId, ruleKey } });
  }

  private async findPropertyRule(
    repo: Repository<PropertyAccessRule>,
    propertyId: string,
    ruleKey: string
  ): Promise<PropertyAccessRule | null> {
    return repo.findOne({ where: { propertyId, ruleKey } });
  }

  private assertOwnership(metadata: Record<string, unknown>, packCode: string, ruleKey: string) {
    const existingPack = (metadata as { pack?: { code?: string } }).pack?.code;
    if (existingPack && existingPack !== packCode) {
      throw new ConflictException(`Rule ${ruleKey} is owned by pack ${existingPack}`);
    }
  }

  private mergeMetadata(
    existing: Record<string, unknown>,
    context: { packCode: string; releaseId: string; status?: 'published' | 'deprecated' }
  ): Record<string, unknown> {
    return {
      ...existing,
      status: context.status || (existing as { status?: string }).status || 'published',
      pack: {
        code: context.packCode,
        release_id: context.releaseId,
      },
    };
  }
}
