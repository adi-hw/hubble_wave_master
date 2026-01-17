/**
 * Integration Module
 * HubbleWave Platform - Phase 5
 *
 * Provides API management, webhooks, external connectors, and data sync.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  IntegrationApiKey,
  OAuthClient,
  OAuthAuthorizationCode,
  OAuthAccessToken,
  OAuthRefreshToken,
  WebhookSubscription,
  WebhookDelivery,
  ExternalConnector,
  ConnectorConnection,
  PropertyMapping,
  CollectionDefinition,
  PropertyDefinition,
  AuditLog,
  ImportJob,
  ExportJob,
  SyncConfiguration,
  SyncRun,
  ApiRequestLog,
} from '@hubblewave/instance-db';

import { WebhookService } from './webhook.service';
import { ApiKeyService } from './api-key.service';
import { OAuth2Service } from './oauth2.service';
import { ImportExportService } from './import-export.service';
import { ConnectorService } from './connector.service';
import { ConnectorCredentialsService } from './connector-credentials.service';
import { WebhookController } from './webhook.controller';
import { ApiKeyController } from './api-key.controller';
import { OAuth2Controller } from './oauth2.controller';
import { ImportExportController } from './import-export.controller';
import { ConnectorController } from './connector.controller';
import { EventOutboxService } from '../events/event-outbox.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntegrationApiKey,
      OAuthClient,
      OAuthAuthorizationCode,
      OAuthAccessToken,
      OAuthRefreshToken,
      WebhookSubscription,
      WebhookDelivery,
      ExternalConnector,
      ConnectorConnection,
      PropertyMapping,
      CollectionDefinition,
      PropertyDefinition,
      AuditLog,
      ImportJob,
      ExportJob,
      SyncConfiguration,
      SyncRun,
      ApiRequestLog,
    ]),
  ],
  controllers: [
    WebhookController,
    ApiKeyController,
    OAuth2Controller,
    ImportExportController,
    ConnectorController,
  ],
  providers: [
    WebhookService,
    ApiKeyService,
    OAuth2Service,
    ImportExportService,
    ConnectorCredentialsService,
    ConnectorService,
    EventOutboxService,
  ],
  exports: [
    WebhookService,
    ApiKeyService,
    OAuth2Service,
    ImportExportService,
    ConnectorCredentialsService,
    ConnectorService,
    EventOutboxService,
  ],
})
export class IntegrationModule {}
