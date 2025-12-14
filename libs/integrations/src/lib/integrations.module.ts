import { Module, Global } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TenantDbModule } from '@eam-platform/tenant-db';
import { NotificationService } from './notification.service';
import { HttpClientService } from './http-client.service';
import { WebhookService } from './webhook.service';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    TenantDbModule,
  ],
  providers: [
    NotificationService,
    HttpClientService,
    WebhookService,
  ],
  exports: [
    NotificationService,
    HttpClientService,
    WebhookService,
  ],
})
export class IntegrationsModule {}
