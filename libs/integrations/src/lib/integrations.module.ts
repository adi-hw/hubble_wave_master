import { Module, Global } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  NotificationTemplate,
  NotificationChannel,
  NotificationDelivery,
  InAppNotification,
} from '@hubblewave/instance-db';
import { NotificationService } from './notification.service';
import { HttpClientService } from './http-client.service';
import { WebhookService } from './webhook.service';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    TypeOrmModule.forFeature([
      NotificationTemplate,
      NotificationChannel,
      NotificationDelivery,
      InAppNotification,
    ]),
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
