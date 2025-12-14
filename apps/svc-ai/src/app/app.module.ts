import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AIModule } from '@eam-platform/ai';
import { TenantDbModule } from '@eam-platform/tenant-db';
import { AuthGuardModule } from '@eam-platform/auth-guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatController } from './chat.controller';
import { EmbeddingController } from './embedding.controller';
import { AVAController } from './ava.controller';
import { AVAGovernanceController } from './ava-governance.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    TenantDbModule,
    AIModule,
    AuthGuardModule,
  ],
  controllers: [
    AppController,
    ChatController,
    EmbeddingController,
    AVAController,
    AVAGovernanceController,
  ],
  providers: [AppService],
})
export class AppModule {}
