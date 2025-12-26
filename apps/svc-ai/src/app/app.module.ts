import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AIModule } from '@hubblewave/ai';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { AuthGuardModule } from '@hubblewave/auth-guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatController } from './chat.controller';
import { EmbeddingController } from './embedding.controller';
import { AVAController } from './ava.controller';
import { AVAGovernanceController } from './ava-governance.controller';

import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    InstanceDbModule,
    AIModule,
    AuthGuardModule,
  ],
  controllers: [
    AppController,
    HealthController,
    ChatController,
    EmbeddingController,
    AVAController,
    AVAGovernanceController,
  ],
  providers: [AppService],
})
export class AppModule {}

