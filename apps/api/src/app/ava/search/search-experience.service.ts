import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { SearchExperience, SearchScope } from '@hubblewave/instance-db';
import { RequestContext } from '@hubblewave/auth-guard';

@Injectable()
export class SearchExperienceService {
  constructor(
    @InjectRepository(SearchExperience)
    private readonly experienceRepo: Repository<SearchExperience>,
  ) {}

  async listForContext(context: RequestContext): Promise<SearchExperience[]> {
    const roles = Array.isArray(context.roles) ? context.roles.filter(Boolean) : [];
    const groups = this.resolveGroups(context);
    const userId = context.userId;

    const where: FindOptionsWhere<SearchExperience>[] = [
      { scope: 'system' as SearchScope, isActive: true },
      { scope: 'instance' as SearchScope, isActive: true },
      { scope: 'personal' as SearchScope, scopeKey: userId, isActive: true },
    ];

    if (roles.length > 0) {
      where.push({ scope: 'role' as SearchScope, scopeKey: In(roles), isActive: true });
    }
    if (groups.length > 0) {
      where.push({ scope: 'group' as SearchScope, scopeKey: In(groups), isActive: true });
    }

    return this.experienceRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  private resolveGroups(context: RequestContext): string[] {
    const raw = context.attributes?.groups;
    if (Array.isArray(raw)) {
      return raw.map((value) => String(value)).filter(Boolean);
    }
    return [];
  }
}
