import { Injectable } from '@nestjs/common';
import { Like } from 'typeorm';
import { UserAccount } from '@eam-platform/platform-db';
import { TenantDbService } from '@eam-platform/tenant-db';

@Injectable()
export class UsersService {
  constructor(
    private readonly tenantDbService: TenantDbService
  ) {}

  async searchUsers(tenantId: string, query: string) {
    const usersRepo = await this.tenantDbService.getRepository(tenantId, UserAccount);
    return usersRepo.find({
      where: [
        { primaryEmail: Like(`%${query}%`) },
        { displayName: Like(`%${query}%`) },
      ],
      take: 20,
      select: ['id', 'primaryEmail', 'displayName', 'status'],
    });
  }
}
