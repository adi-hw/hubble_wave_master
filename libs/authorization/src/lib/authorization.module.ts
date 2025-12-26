import { Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { AbacService } from './abac.service';

@Module({
  imports: [],
  providers: [
    AuthorizationService,
    AbacService,
    // Fallback provider to satisfy any legacy InjectRepository(AbacPolicy) tokens
    {
      provide: 'AbacPolicyRepository',
      useValue: {
        find: async () => [],
      },
    },
    {
      provide: 'control-plane_AbacPolicyRepository',
      useValue: {
        find: async () => [],
      },
    },
  ],
  exports: [AuthorizationService, AbacService],
})
export class AuthorizationModule {}
