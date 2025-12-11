import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async search(@Req() req: any, @Query('q') query: string) {
    const tenantId = req.user.tenantId;
    return this.usersService.searchUsers(tenantId, query || '');
  }
}
