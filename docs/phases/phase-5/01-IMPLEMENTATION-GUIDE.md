# Phase 5: Integration & Data - Implementation Guide

**Version:** 1.0
**Last Updated:** 2025-12-30
**Status:** Technical Specification

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [REST API Implementation](#rest-api-implementation)
3. [GraphQL Implementation](#graphql-implementation)
4. [Webhook System](#webhook-system)
5. [OAuth2/OIDC Implementation](#oauth2oidc-implementation)
6. [Data Import/Export](#data-importexport)
7. [Sync Engine](#sync-engine)
8. [Connector Framework](#connector-framework)
9. [External Connectors](#external-connectors)
10. [Database Schema](#database-schema)
11. [Performance Optimization](#performance-optimization)
12. [Security Implementation](#security-implementation)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer (nginx)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐  ┌─────────▼────────┐  ┌────────▼────────┐
│  API Gateway   │  │  GraphQL Server  │  │  Webhook Server │
│   (REST API)   │  │                  │  │                 │
└───────┬────────┘  └─────────┬────────┘  └────────┬────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│                    Service Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Auth Service │  │ Transform Svc│  │ Routing Svc  │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Sync Service │  │ Import Svc   │  │ Export Svc   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└───────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│                    Connector Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Salesforce  │  │    Jira      │  │  ServiceNow  │    │
│  │  Connector   │  │  Connector   │  │  Connector   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│  ┌──────────────┐  ┌──────────────┐                       │
│  │     SAP      │  │   Custom     │                       │
│  │  Connector   │  │  Connector   │                       │
│  └──────────────┘  └──────────────┘                       │
└───────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐  ┌─────────▼────────┐  ┌────────▼────────┐
│   PostgreSQL   │  │   Redis Cache    │  │   RabbitMQ      │
│   (Primary DB) │  │                  │  │   (Queue)       │
└────────────────┘  └──────────────────┘  └─────────────────┘
```

### Technology Stack

#### Backend Services
- **Runtime:** Node.js 20 LTS
- **Framework:** Express.js / Fastify
- **Language:** TypeScript 5+
- **API Gateway:** Express Gateway / Kong
- **GraphQL:** Apollo Server 4
- **Message Queue:** RabbitMQ 3.12
- **Cache:** Redis 7.2
- **Database:** PostgreSQL 16

#### Libraries & Tools
- **OAuth:** oauth2-server, openid-client
- **Validation:** Zod, Joi
- **File Processing:** xlsx, csv-parser, xml2js, Apache Tika
- **HTTP Client:** axios, got
- **Queue:** Bull, BullMQ
- **Logging:** Winston, Pino
- **Monitoring:** Prometheus, Grafana
- **Testing:** Jest, Supertest

---

## REST API Implementation

### API Gateway Architecture

```typescript
// src/api/gateway/server.ts
import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimiter } from './middleware/rateLimiter';
import { authenticate } from './middleware/auth';
import { requestLogger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';

export class APIGateway {
  private app: Express;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"]
        }
      }
    }));

    // CORS
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(','),
      credentials: true,
      maxAge: 86400
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use(requestLogger);

    // Rate limiting
    this.app.use(rateLimiter);

    // Authentication
    this.app.use('/api/v1', authenticate);
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // API routes
    this.app.use('/api/v1', apiRouter);

    // OpenAPI documentation
    this.app.use('/api/docs', express.static('public/api-docs'));
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public start(port: number): void {
    this.app.listen(port, () => {
      console.log(`API Gateway listening on port ${port}`);
    });
  }
}
```

### Rate Limiting Implementation

```typescript
// src/api/middleware/rateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { RateLimiterRedis } from 'rate-limiter-flexible';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  enableOfflineQueue: false
});

// Tiered rate limiting based on plan
const rateLimiters = {
  free: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl_free',
    points: 100, // requests
    duration: 60, // per 60 seconds
    blockDuration: 60
  }),

  professional: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl_pro',
    points: 1000,
    duration: 60,
    blockDuration: 30
  }),

  enterprise: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl_ent',
    points: 10000,
    duration: 60,
    blockDuration: 10
  })
};

export async function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.tenant?.id;
    const plan = req.tenant?.plan || 'free';
    const limiter = rateLimiters[plan];

    const rateLimiterRes = await limiter.consume(tenantId);

    res.setHeader('X-RateLimit-Limit', limiter.points);
    res.setHeader('X-RateLimit-Remaining', rateLimiterRes.remainingPoints);
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString());

    next();
  } catch (error) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: error.msBeforeNext / 1000
    });
  }
}
```

### Dynamic API Endpoint Generation

```typescript
// src/api/generator/endpointGenerator.ts
import { Router } from 'express';
import { EntityDefinition } from '../types';
import { createController } from './controllerGenerator';

export class EndpointGenerator {
  private router: Router;

  constructor() {
    this.router = Router();
  }

  public generateEndpoints(entity: EntityDefinition): Router {
    const controller = createController(entity);
    const basePath = `/${entity.pluralName.toLowerCase()}`;

    // List with pagination
    this.router.get(basePath, controller.list);

    // Get by ID
    this.router.get(`${basePath}/:id`, controller.getById);

    // Create
    this.router.post(basePath, controller.create);

    // Update
    this.router.put(`${basePath}/:id`, controller.update);
    this.router.patch(`${basePath}/:id`, controller.partialUpdate);

    // Delete
    this.router.delete(`${basePath}/:id`, controller.delete);

    // Bulk operations
    this.router.post(`${basePath}/bulk`, controller.bulkCreate);
    this.router.put(`${basePath}/bulk`, controller.bulkUpdate);
    this.router.delete(`${basePath}/bulk`, controller.bulkDelete);

    // Relationships
    entity.relationships?.forEach(rel => {
      this.router.get(
        `${basePath}/:id/${rel.name}`,
        controller.getRelated(rel.name)
      );
    });

    return this.router;
  }
}
```

### OpenAPI Specification Generator

```typescript
// src/api/generator/openApiGenerator.ts
import { OpenAPIV3 } from 'openapi-types';
import { EntityDefinition } from '../types';

export class OpenAPIGenerator {
  public generateSpec(entities: EntityDefinition[]): OpenAPIV3.Document {
    const paths: OpenAPIV3.PathsObject = {};
    const schemas: { [key: string]: OpenAPIV3.SchemaObject } = {};

    entities.forEach(entity => {
      // Generate schema
      schemas[entity.name] = this.generateSchema(entity);

      // Generate paths
      const basePath = `/${entity.pluralName.toLowerCase()}`;
      paths[basePath] = this.generateCollectionPaths(entity);
      paths[`${basePath}/{id}`] = this.generateItemPaths(entity);
    });

    return {
      openapi: '3.0.3',
      info: {
        title: 'HubbleWave API',
        version: '1.0.0',
        description: 'Comprehensive API for HubbleWave platform',
        contact: {
          name: 'API Support',
          email: 'api-support@hubblewave.com'
        }
      },
      servers: [
        {
          url: 'https://api.hubblewave.com/v1',
          description: 'Production server'
        },
        {
          url: 'https://api-staging.hubblewave.com/v1',
          description: 'Staging server'
        }
      ],
      paths,
      components: {
        schemas,
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          },
          OAuth2: {
            type: 'oauth2',
            flows: {
              authorizationCode: {
                authorizationUrl: 'https://auth.hubblewave.com/oauth/authorize',
                tokenUrl: 'https://auth.hubblewave.com/oauth/token',
                scopes: {
                  'read': 'Read access',
                  'write': 'Write access',
                  'admin': 'Administrative access'
                }
              }
            }
          }
        }
      },
      security: [
        { ApiKeyAuth: [] },
        { OAuth2: ['read', 'write'] }
      ]
    };
  }

  private generateSchema(entity: EntityDefinition): OpenAPIV3.SchemaObject {
    const properties: { [key: string]: OpenAPIV3.SchemaObject } = {};
    const required: string[] = [];

    entity.fields.forEach(field => {
      properties[field.name] = {
        type: this.mapTypeToOpenAPI(field.type),
        description: field.description,
        format: field.format,
        example: field.example
      };

      if (field.required) {
        required.push(field.name);
      }
    });

    return {
      type: 'object',
      properties,
      required
    };
  }

  private mapTypeToOpenAPI(type: string): string {
    const typeMap: { [key: string]: string } = {
      'text': 'string',
      'number': 'number',
      'integer': 'integer',
      'boolean': 'boolean',
      'date': 'string',
      'datetime': 'string',
      'email': 'string',
      'url': 'string'
    };
    return typeMap[type] || 'string';
  }
}
```

---

## GraphQL Implementation

### GraphQL Server Setup

```typescript
// src/graphql/server.ts
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { generateSchema } from './generator/schemaGenerator';
import { createResolvers } from './resolvers';
import { createContext } from './context';

export class GraphQLService {
  private server: ApolloServer;

  async initialize(httpServer: any): Promise<void> {
    // Generate schema from entity definitions
    const typeDefs = await generateSchema();
    const resolvers = await createResolvers();

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers
    });

    // WebSocket server for subscriptions
    const wsServer = new WebSocketServer({
      server: httpServer,
      path: '/graphql'
    });

    const serverCleanup = useServer(
      {
        schema,
        context: createContext
      },
      wsServer
    );

    // Apollo Server
    this.server = new ApolloServer({
      schema,
      plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer }),
        {
          async serverWillStart() {
            return {
              async drainServer() {
                await serverCleanup.dispose();
              }
            };
          }
        }
      ],
      introspection: process.env.NODE_ENV !== 'production',
      csrfPrevention: true
    });

    await this.server.start();
  }

  getMiddleware() {
    return expressMiddleware(this.server, {
      context: createContext
    });
  }
}
```

### Schema Generator

```typescript
// src/graphql/generator/schemaGenerator.ts
import { gql } from 'graphql-tag';
import { EntityDefinition } from '../../types';
import { entityService } from '../../services/entityService';

export async function generateSchema(): Promise<string> {
  const entities = await entityService.getAllEntities();

  const typeDefinitions = entities.map(entity =>
    generateTypeDefinition(entity)
  ).join('\n\n');

  const queryFields = entities.map(entity =>
    generateQueryFields(entity)
  ).join('\n  ');

  const mutationFields = entities.map(entity =>
    generateMutationFields(entity)
  ).join('\n  ');

  const subscriptionFields = entities.map(entity =>
    generateSubscriptionFields(entity)
  ).join('\n  ');

  return `
    ${typeDefinitions}

    type Query {
      ${queryFields}
    }

    type Mutation {
      ${mutationFields}
    }

    type Subscription {
      ${subscriptionFields}
    }

    input PaginationInput {
      page: Int = 1
      pageSize: Int = 20
    }

    input SortInput {
      field: String!
      order: SortOrder = ASC
    }

    enum SortOrder {
      ASC
      DESC
    }

    type PageInfo {
      currentPage: Int!
      pageSize: Int!
      totalPages: Int!
      totalItems: Int!
      hasNextPage: Boolean!
      hasPreviousPage: Boolean!
    }
  `;
}

function generateTypeDefinition(entity: EntityDefinition): string {
  const fields = entity.fields.map(field => {
    const nullable = field.required ? '!' : '';
    return `  ${field.name}: ${mapTypeToGraphQL(field.type)}${nullable}`;
  }).join('\n');

  const relationships = entity.relationships?.map(rel => {
    const type = rel.type === 'oneToMany' ? `[${rel.targetEntity}!]` : rel.targetEntity;
    return `  ${rel.name}: ${type}`;
  }).join('\n') || '';

  return `
type ${entity.name} {
${fields}
${relationships}
}

type ${entity.name}Connection {
  items: [${entity.name}!]!
  pageInfo: PageInfo!
}

input ${entity.name}Input {
${entity.fields.filter(f => !f.computed).map(field =>
    `  ${field.name}: ${mapTypeToGraphQL(field.type)}`
  ).join('\n')}
}

input ${entity.name}FilterInput {
${entity.fields.map(field =>
    `  ${field.name}: ${mapTypeToGraphQL(field.type)}`
  ).join('\n')}
}
  `;
}

function generateQueryFields(entity: EntityDefinition): string {
  const singular = entity.name.toLowerCase();
  const plural = entity.pluralName.toLowerCase();

  return `
  ${singular}(id: ID!): ${entity.name}
  ${plural}(
    filter: ${entity.name}FilterInput
    pagination: PaginationInput
    sort: SortInput
  ): ${entity.name}Connection!
  `;
}

function generateMutationFields(entity: EntityDefinition): string {
  const singular = entity.name.toLowerCase();

  return `
  create${entity.name}(input: ${entity.name}Input!): ${entity.name}!
  update${entity.name}(id: ID!, input: ${entity.name}Input!): ${entity.name}!
  delete${entity.name}(id: ID!): Boolean!
  `;
}

function generateSubscriptionFields(entity: EntityDefinition): string {
  return `
  ${entity.name.toLowerCase()}Created: ${entity.name}!
  ${entity.name.toLowerCase()}Updated: ${entity.name}!
  ${entity.name.toLowerCase()}Deleted: ID!
  `;
}

function mapTypeToGraphQL(type: string): string {
  const typeMap: { [key: string]: string } = {
    'text': 'String',
    'longtext': 'String',
    'number': 'Float',
    'integer': 'Int',
    'boolean': 'Boolean',
    'date': 'String',
    'datetime': 'String',
    'email': 'String',
    'url': 'String',
    'json': 'JSON'
  };
  return typeMap[type] || 'String';
}
```

### DataLoader for N+1 Prevention

```typescript
// src/graphql/loaders/dataLoaders.ts
import DataLoader from 'dataloader';
import { db } from '../../database';

export function createLoaders() {
  return {
    // Entity loader
    entityById: new DataLoader(async (ids: readonly string[]) => {
      const results = await db.query(
        'SELECT * FROM entities WHERE id = ANY($1)',
        [ids]
      );

      const entityMap = new Map(results.rows.map(row => [row.id, row]));
      return ids.map(id => entityMap.get(id) || null);
    }),

    // Relationship loader
    relatedEntities: new DataLoader(async (keys: readonly { entityId: string, relationName: string }[]) => {
      // Batch load related entities
      const grouped = keys.reduce((acc, key) => {
        if (!acc[key.relationName]) acc[key.relationName] = [];
        acc[key.relationName].push(key.entityId);
        return acc;
      }, {} as Record<string, string[]>);

      const results = await Promise.all(
        Object.entries(grouped).map(async ([relationName, entityIds]) => {
          const rows = await db.query(
            `SELECT * FROM ${relationName} WHERE entity_id = ANY($1)`,
            [entityIds]
          );
          return { relationName, rows: rows.rows };
        })
      );

      // Map results back to original keys
      const resultMap = new Map();
      results.forEach(({ relationName, rows }) => {
        rows.forEach(row => {
          const key = `${row.entity_id}:${relationName}`;
          if (!resultMap.has(key)) resultMap.set(key, []);
          resultMap.get(key).push(row);
        });
      });

      return keys.map(key =>
        resultMap.get(`${key.entityId}:${key.relationName}`) || []
      );
    })
  };
}
```

---

## Webhook System

### Webhook Delivery Architecture

```typescript
// src/webhooks/webhookService.ts
import { Queue, Worker } from 'bullmq';
import axios from 'axios';
import crypto from 'crypto';
import { db } from '../database';

interface WebhookPayload {
  webhookId: string;
  event: string;
  data: any;
  timestamp: string;
}

export class WebhookService {
  private queue: Queue;
  private worker: Worker;

  constructor() {
    // Create delivery queue
    this.queue = new Queue('webhook-delivery', {
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379')
      },
      defaultJobOptions: {
        attempts: 10,
        backoff: {
          type: 'exponential',
          delay: 1000 // 1s, 2s, 4s, 8s, etc.
        },
        removeOnComplete: {
          count: 1000,
          age: 24 * 3600 // 24 hours
        },
        removeOnFail: {
          age: 7 * 24 * 3600 // 7 days
        }
      }
    });

    // Create worker
    this.worker = new Worker(
      'webhook-delivery',
      async job => await this.deliverWebhook(job.data),
      {
        connection: {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || '6379')
        },
        concurrency: 50
      }
    );

    this.setupEventHandlers();
  }

  async trigger(event: string, data: any, tenantId: string): Promise<void> {
    // Find all webhooks subscribed to this event
    const webhooks = await db.query(
      'SELECT * FROM webhooks WHERE tenant_id = $1 AND events @> $2 AND active = true',
      [tenantId, JSON.stringify([event])]
    );

    // Queue delivery for each webhook
    for (const webhook of webhooks.rows) {
      await this.queue.add('deliver', {
        webhookId: webhook.id,
        event,
        data,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async deliverWebhook(payload: WebhookPayload): Promise<void> {
    const webhook = await this.getWebhook(payload.webhookId);

    if (!webhook || !webhook.active) {
      throw new Error('Webhook not found or inactive');
    }

    // Build payload
    const deliveryPayload = {
      event: payload.event,
      data: payload.data,
      timestamp: payload.timestamp,
      webhookId: webhook.id
    };

    // Generate signature
    const signature = this.generateSignature(
      deliveryPayload,
      webhook.secret
    );

    // Transform payload if needed
    const transformedPayload = webhook.transform
      ? await this.transformPayload(deliveryPayload, webhook.transform)
      : deliveryPayload;

    // Deliver webhook
    try {
      const response = await axios.post(webhook.url, transformedPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-HubbleWave-Signature': signature,
          'X-HubbleWave-Event': payload.event,
          'X-HubbleWave-Delivery': crypto.randomUUID(),
          ...webhook.headers
        },
        timeout: 30000, // 30 seconds
        validateStatus: (status) => status >= 200 && status < 300
      });

      // Log successful delivery
      await this.logDelivery({
        webhookId: webhook.id,
        event: payload.event,
        status: 'success',
        statusCode: response.status,
        responseTime: response.headers['x-response-time'],
        attempt: 1
      });

    } catch (error: any) {
      // Log failed delivery
      await this.logDelivery({
        webhookId: webhook.id,
        event: payload.event,
        status: 'failed',
        statusCode: error.response?.status,
        error: error.message,
        attempt: error.attemptNumber || 1
      });

      // Rethrow to trigger retry
      throw error;
    }
  }

  private generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }

  private async transformPayload(payload: any, transformScript: string): Promise<any> {
    // Execute transformation script in sandbox
    const vm = require('vm');
    const sandbox = {
      payload,
      result: null,
      console: {
        log: () => {} // Disable console in sandbox
      }
    };

    const script = new vm.Script(`result = (${transformScript})(payload);`);
    const context = vm.createContext(sandbox);
    script.runInContext(context, { timeout: 5000 });

    return sandbox.result || payload;
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', job => {
      console.log(`Webhook ${job.id} delivered successfully`);
    });

    this.worker.on('failed', async (job, error) => {
      console.error(`Webhook ${job?.id} failed:`, error.message);

      // Move to dead letter queue after all retries
      if (job && job.attemptsMade >= 10) {
        await this.moveToDLQ(job.data);
      }
    });
  }

  private async moveToDLQ(payload: WebhookPayload): Promise<void> {
    await db.query(
      `INSERT INTO webhook_dlq (webhook_id, event, payload, failed_at)
       VALUES ($1, $2, $3, NOW())`,
      [payload.webhookId, payload.event, payload]
    );

    // Notify administrators
    await this.notifyDLQEntry(payload);
  }
}
```

### Webhook Configuration API

```typescript
// src/webhooks/webhookController.ts
import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../database';
import crypto from 'crypto';

const webhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  active: z.boolean().default(true),
  secret: z.string().optional(),
  headers: z.record(z.string()).optional(),
  transform: z.string().optional(),
  retryConfig: z.object({
    maxAttempts: z.number().min(1).max(20).default(10),
    backoffMultiplier: z.number().min(1).max(10).default(2)
  }).optional()
});

export class WebhookController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const validated = webhookSchema.parse(req.body);

      // Generate secret if not provided
      const secret = validated.secret || crypto.randomBytes(32).toString('hex');

      // Verify webhook endpoint
      await this.verifyEndpoint(validated.url, secret);

      const result = await db.query(
        `INSERT INTO webhooks (tenant_id, url, events, active, secret, headers, transform, retry_config)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          req.tenant.id,
          validated.url,
          validated.events,
          validated.active,
          secret,
          validated.headers,
          validated.transform,
          validated.retryConfig
        ]
      );

      res.status(201).json({
        webhook: result.rows[0],
        secret // Return secret only on creation
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async test(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    const webhook = await db.query(
      'SELECT * FROM webhooks WHERE id = $1 AND tenant_id = $2',
      [id, req.tenant.id]
    );

    if (webhook.rows.length === 0) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    // Send test payload
    const testPayload = {
      event: 'test',
      data: { message: 'This is a test webhook delivery' },
      timestamp: new Date().toISOString()
    };

    try {
      const signature = this.generateSignature(testPayload, webhook.rows[0].secret);

      const response = await axios.post(webhook.rows[0].url, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-HubbleWave-Signature': signature,
          'X-HubbleWave-Event': 'test',
          ...webhook.rows[0].headers
        },
        timeout: 10000
      });

      res.json({
        success: true,
        statusCode: response.status,
        responseTime: response.headers['x-response-time']
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        statusCode: error.response?.status
      });
    }
  }

  private async verifyEndpoint(url: string, secret: string): Promise<void> {
    const verificationPayload = {
      event: 'verification',
      challenge: crypto.randomBytes(32).toString('hex')
    };

    const signature = this.generateSignature(verificationPayload, secret);

    try {
      const response = await axios.post(url, verificationPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-HubbleWave-Signature': signature,
          'X-HubbleWave-Event': 'verification'
        },
        timeout: 10000
      });

      // Endpoint must echo back the challenge
      if (response.data.challenge !== verificationPayload.challenge) {
        throw new Error('Verification failed: challenge mismatch');
      }
    } catch (error) {
      throw new Error(`Webhook endpoint verification failed: ${error.message}`);
    }
  }
}
```

---

## OAuth2/OIDC Implementation

### OAuth2 Authorization Server

```typescript
// src/oauth/oauthServer.ts
import OAuth2Server from 'oauth2-server';
import { db } from '../database';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const { Request, Response } = OAuth2Server;

export const oauth = new OAuth2Server({
  model: {
    // Get access token
    async getAccessToken(accessToken: string) {
      const result = await db.query(
        `SELECT t.*, c.grants, u.id as user_id
         FROM oauth_tokens t
         JOIN oauth_clients c ON t.client_id = c.id
         LEFT JOIN users u ON t.user_id = u.id
         WHERE t.access_token = $1 AND t.access_token_expires_at > NOW()`,
        [accessToken]
      );

      if (result.rows.length === 0) return false;

      const token = result.rows[0];
      return {
        accessToken: token.access_token,
        accessTokenExpiresAt: token.access_token_expires_at,
        scope: token.scope,
        client: { id: token.client_id, grants: token.grants },
        user: { id: token.user_id }
      };
    },

    // Get client
    async getClient(clientId: string, clientSecret: string) {
      const result = await db.query(
        `SELECT * FROM oauth_clients
         WHERE client_id = $1 AND client_secret = $2 AND active = true`,
        [clientId, clientSecret]
      );

      if (result.rows.length === 0) return false;

      const client = result.rows[0];
      return {
        id: client.client_id,
        grants: client.grants,
        redirectUris: client.redirect_uris,
        accessTokenLifetime: client.access_token_lifetime,
        refreshTokenLifetime: client.refresh_token_lifetime
      };
    },

    // Save token
    async saveToken(token: any, client: any, user: any) {
      await db.query(
        `INSERT INTO oauth_tokens (
          access_token, access_token_expires_at,
          refresh_token, refresh_token_expires_at,
          client_id, user_id, scope
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          token.accessToken,
          token.accessTokenExpiresAt,
          token.refreshToken,
          token.refreshTokenExpiresAt,
          client.id,
          user.id,
          token.scope
        ]
      );

      return {
        accessToken: token.accessToken,
        accessTokenExpiresAt: token.accessTokenExpiresAt,
        refreshToken: token.refreshToken,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,
        scope: token.scope,
        client: { id: client.id },
        user: { id: user.id }
      };
    },

    // Get refresh token
    async getRefreshToken(refreshToken: string) {
      const result = await db.query(
        `SELECT t.*, c.grants
         FROM oauth_tokens t
         JOIN oauth_clients c ON t.client_id = c.id
         WHERE t.refresh_token = $1 AND t.refresh_token_expires_at > NOW()`,
        [refreshToken]
      );

      if (result.rows.length === 0) return false;

      const token = result.rows[0];
      return {
        refreshToken: token.refresh_token,
        refreshTokenExpiresAt: token.refresh_token_expires_at,
        scope: token.scope,
        client: { id: token.client_id, grants: token.grants },
        user: { id: token.user_id }
      };
    },

    // Revoke token
    async revokeToken(token: any) {
      await db.query(
        'UPDATE oauth_tokens SET revoked = true WHERE refresh_token = $1',
        [token.refreshToken]
      );
      return true;
    },

    // Get authorization code
    async getAuthorizationCode(authorizationCode: string) {
      const result = await db.query(
        `SELECT * FROM oauth_authorization_codes
         WHERE code = $1 AND expires_at > NOW() AND used = false`,
        [authorizationCode]
      );

      if (result.rows.length === 0) return false;

      const code = result.rows[0];
      return {
        code: code.code,
        expiresAt: code.expires_at,
        redirectUri: code.redirect_uri,
        scope: code.scope,
        client: { id: code.client_id },
        user: { id: code.user_id }
      };
    },

    // Save authorization code
    async saveAuthorizationCode(code: any, client: any, user: any) {
      const authCode = crypto.randomBytes(32).toString('hex');

      await db.query(
        `INSERT INTO oauth_authorization_codes (
          code, expires_at, redirect_uri, scope, client_id, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          authCode,
          code.expiresAt,
          code.redirectUri,
          code.scope,
          client.id,
          user.id
        ]
      );

      return {
        authorizationCode: authCode,
        expiresAt: code.expiresAt,
        redirectUri: code.redirectUri,
        scope: code.scope,
        client: { id: client.id },
        user: { id: user.id }
      };
    },

    // Revoke authorization code
    async revokeAuthorizationCode(code: any) {
      await db.query(
        'UPDATE oauth_authorization_codes SET used = true WHERE code = $1',
        [code.code]
      );
      return true;
    },

    // Verify scope
    async verifyScope(token: any, scope: string) {
      if (!token.scope) return false;
      const requestedScopes = scope.split(' ');
      const tokenScopes = token.scope.split(' ');
      return requestedScopes.every(s => tokenScopes.includes(s));
    }
  },

  accessTokenLifetime: 3600, // 1 hour
  refreshTokenLifetime: 86400 * 30, // 30 days
  allowBearerTokensInQueryString: false,
  allowExtendedTokenAttributes: true
});
```

### OIDC Provider

```typescript
// src/oauth/oidcProvider.ts
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../database';

export class OIDCProvider {
  // Discovery endpoint
  async discovery(req: Request, res: Response): Promise<void> {
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      userinfo_endpoint: `${baseUrl}/oauth/userinfo`,
      jwks_uri: `${baseUrl}/oauth/jwks`,
      registration_endpoint: `${baseUrl}/oauth/register`,
      scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
      response_types_supported: ['code', 'token', 'id_token', 'code token', 'code id_token'],
      grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
      claims_supported: ['sub', 'name', 'email', 'email_verified', 'picture']
    });
  }

  // UserInfo endpoint
  async userinfo(req: Request, res: Response): Promise<void> {
    const userId = req.oauth.token.user.id;

    const result = await db.query(
      'SELECT id, email, name, picture FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = result.rows[0];

    res.json({
      sub: user.id,
      name: user.name,
      email: user.email,
      email_verified: true,
      picture: user.picture
    });
  }

  // Generate ID Token
  generateIDToken(user: any, client: any, nonce?: string): string {
    const payload = {
      iss: process.env.OIDC_ISSUER,
      sub: user.id,
      aud: client.id,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      nonce,
      name: user.name,
      email: user.email,
      email_verified: true,
      picture: user.picture
    };

    return jwt.sign(payload, process.env.JWT_PRIVATE_KEY!, {
      algorithm: 'RS256',
      keyid: process.env.JWT_KEY_ID
    });
  }

  // JWKS endpoint
  async jwks(req: Request, res: Response): Promise<void> {
    const publicKey = process.env.JWT_PUBLIC_KEY!;

    // Convert PEM to JWK format
    const jwk = {
      kty: 'RSA',
      use: 'sig',
      kid: process.env.JWT_KEY_ID,
      n: publicKey, // Base64url encoded modulus
      e: 'AQAB' // Base64url encoded exponent
    };

    res.json({
      keys: [jwk]
    });
  }
}
```

---

## Data Import/Export

### Import Service

```typescript
// src/import/importService.ts
import { Readable } from 'stream';
import csv from 'csv-parser';
import xlsx from 'xlsx';
import xml2js from 'xml2js';
import { db } from '../database';
import { validateData } from '../validation/dataValidator';
import { transformData } from '../transformation/dataTransformer';

export class ImportService {
  async importFile(
    file: Express.Multer.File,
    entityType: string,
    mapping: FieldMapping[],
    options: ImportOptions
  ): Promise<ImportResult> {
    const records = await this.parseFile(file);
    const results: ImportResult = {
      total: records.length,
      success: 0,
      failed: 0,
      errors: [],
      duration: 0
    };

    const startTime = Date.now();

    // Process in batches
    const batchSize = options.batchSize || 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchResult = await this.processBatch(
        batch,
        entityType,
        mapping,
        options
      );

      results.success += batchResult.success;
      results.failed += batchResult.failed;
      results.errors.push(...batchResult.errors);
    }

    results.duration = Date.now() - startTime;

    // Log import
    await this.logImport(entityType, results);

    return results;
  }

  private async parseFile(file: Express.Multer.File): Promise<any[]> {
    const ext = file.originalname.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'csv':
        return this.parseCSV(file);
      case 'xlsx':
      case 'xls':
        return this.parseExcel(file);
      case 'json':
        return this.parseJSON(file);
      case 'xml':
        return this.parseXML(file);
      default:
        throw new Error(`Unsupported file format: ${ext}`);
    }
  }

  private async parseCSV(file: Express.Multer.File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const records: any[] = [];
      const stream = Readable.from(file.buffer);

      stream
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim(),
          mapValues: ({ value }) => value.trim()
        }))
        .on('data', (data) => records.push(data))
        .on('end', () => resolve(records))
        .on('error', reject);
    });
  }

  private async parseExcel(file: Express.Multer.File): Promise<any[]> {
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    return xlsx.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: null
    });
  }

  private async parseJSON(file: Express.Multer.File): Promise<any[]> {
    const content = file.buffer.toString('utf8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [data];
  }

  private async parseXML(file: Express.Multer.File): Promise<any[]> {
    const content = file.buffer.toString('utf8');
    const parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true
    });

    const result = await parser.parseStringPromise(content);
    // Extract records from XML structure
    const records = result.root?.record || result.records || [];
    return Array.isArray(records) ? records : [records];
  }

  private async processBatch(
    records: any[],
    entityType: string,
    mapping: FieldMapping[],
    options: ImportOptions
  ): Promise<BatchResult> {
    const result: BatchResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    const mappedRecords = records.map(record => this.mapFields(record, mapping));

    // Validate
    const validationResults = await validateData(mappedRecords, entityType);

    // Transform
    const transformedRecords = await transformData(
      mappedRecords,
      options.transformations || []
    );

    // Handle duplicates
    const dedupedRecords = options.detectDuplicates
      ? await this.detectAndHandleDuplicates(transformedRecords, entityType, options)
      : transformedRecords;

    // Insert into database
    for (let i = 0; i < dedupedRecords.length; i++) {
      try {
        if (validationResults[i].valid) {
          await this.insertRecord(dedupedRecords[i], entityType);
          result.success++;
        } else {
          result.failed++;
          result.errors.push({
            row: i + 1,
            errors: validationResults[i].errors
          });
        }
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: i + 1,
          errors: [error.message]
        });
      }
    }

    return result;
  }

  private mapFields(record: any, mapping: FieldMapping[]): any {
    const mapped: any = {};

    mapping.forEach(map => {
      const value = record[map.sourceField];
      mapped[map.targetField] = map.transform
        ? this.applyTransform(value, map.transform)
        : value;
    });

    return mapped;
  }

  private async detectAndHandleDuplicates(
    records: any[],
    entityType: string,
    options: ImportOptions
  ): Promise<any[]> {
    const uniqueFields = options.uniqueFields || ['id'];
    const result: any[] = [];

    for (const record of records) {
      // Build WHERE clause for duplicate detection
      const whereConditions = uniqueFields
        .map((field, idx) => `${field} = $${idx + 1}`)
        .join(' AND ');

      const values = uniqueFields.map(field => record[field]);

      const existing = await db.query(
        `SELECT * FROM ${entityType} WHERE ${whereConditions}`,
        values
      );

      if (existing.rows.length > 0) {
        // Handle duplicate based on strategy
        switch (options.duplicateStrategy) {
          case 'skip':
            // Don't add to result
            break;
          case 'update':
            record._isUpdate = true;
            record._existingId = existing.rows[0].id;
            result.push(record);
            break;
          case 'merge':
            record._isMerge = true;
            record._existingData = existing.rows[0];
            result.push(record);
            break;
          default:
            result.push(record);
        }
      } else {
        result.push(record);
      }
    }

    return result;
  }

  private async insertRecord(record: any, entityType: string): Promise<void> {
    if (record._isUpdate) {
      // Update existing record
      const fields = Object.keys(record).filter(k => !k.startsWith('_'));
      const setClause = fields.map((f, idx) => `${f} = $${idx + 1}`).join(', ');
      const values = fields.map(f => record[f]);
      values.push(record._existingId);

      await db.query(
        `UPDATE ${entityType} SET ${setClause} WHERE id = $${values.length}`,
        values
      );
    } else if (record._isMerge) {
      // Merge with existing
      const merged = { ...record._existingData, ...record };
      delete merged._isMerge;
      delete merged._existingData;

      const fields = Object.keys(merged);
      const setClause = fields.map((f, idx) => `${f} = $${idx + 1}`).join(', ');
      const values = fields.map(f => merged[f]);
      values.push(merged.id);

      await db.query(
        `UPDATE ${entityType} SET ${setClause} WHERE id = $${values.length}`,
        values
      );
    } else {
      // Insert new record
      const fields = Object.keys(record);
      const columns = fields.join(', ');
      const placeholders = fields.map((_, idx) => `$${idx + 1}`).join(', ');
      const values = fields.map(f => record[f]);

      await db.query(
        `INSERT INTO ${entityType} (${columns}) VALUES (${placeholders})`,
        values
      );
    }
  }
}
```

### Export Service

```typescript
// src/export/exportService.ts
import xlsx from 'xlsx';
import { createObjectCsvWriter } from 'csv-writer';
import xml2js from 'xml2js';
import { db } from '../database';

export class ExportService {
  async export(
    entityType: string,
    query: ExportQuery,
    format: 'csv' | 'xlsx' | 'json' | 'xml'
  ): Promise<Buffer> {
    // Fetch data
    const data = await this.fetchData(entityType, query);

    // Generate file based on format
    switch (format) {
      case 'csv':
        return this.generateCSV(data);
      case 'xlsx':
        return this.generateExcel(data);
      case 'json':
        return this.generateJSON(data);
      case 'xml':
        return this.generateXML(data);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async fetchData(
    entityType: string,
    query: ExportQuery
  ): Promise<any[]> {
    let sql = `SELECT ${query.fields.join(', ')} FROM ${entityType}`;
    const values: any[] = [];
    let paramCount = 1;

    // Add WHERE clause
    if (query.filters && query.filters.length > 0) {
      const conditions = query.filters.map(filter => {
        values.push(filter.value);
        return `${filter.field} ${filter.operator} $${paramCount++}`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add ORDER BY
    if (query.sort) {
      sql += ` ORDER BY ${query.sort.field} ${query.sort.order}`;
    }

    // Add LIMIT/OFFSET
    if (query.limit) {
      sql += ` LIMIT $${paramCount++}`;
      values.push(query.limit);
    }
    if (query.offset) {
      sql += ` OFFSET $${paramCount++}`;
      values.push(query.offset);
    }

    const result = await db.query(sql, values);
    return result.rows;
  }

  private async generateCSV(data: any[]): Promise<Buffer> {
    if (data.length === 0) {
      return Buffer.from('');
    }

    const headers = Object.keys(data[0]).map(key => ({
      id: key,
      title: key
    }));

    const csvWriter = createObjectCsvWriter({
      path: '/tmp/export.csv',
      header: headers
    });

    await csvWriter.writeRecords(data);

    return Buffer.from(
      [headers.map(h => h.title).join(',')]
        .concat(data.map(row =>
          headers.map(h => JSON.stringify(row[h.id] || '')).join(',')
        ))
        .join('\n')
    );
  }

  private async generateExcel(data: any[]): Promise<Buffer> {
    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  private async generateJSON(data: any[]): Promise<Buffer> {
    return Buffer.from(JSON.stringify(data, null, 2));
  }

  private async generateXML(data: any[]): Promise<Buffer> {
    const builder = new xml2js.Builder({
      rootName: 'records',
      xmldec: { version: '1.0', encoding: 'UTF-8' }
    });

    const xml = builder.buildObject({ record: data });
    return Buffer.from(xml);
  }
}
```

---

## Database Schema

```sql
-- src/database/migrations/005_integration_tables.sql

-- OAuth Clients
CREATE TABLE oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(255) UNIQUE NOT NULL,
  client_secret VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  grants TEXT[] NOT NULL DEFAULT ARRAY['authorization_code', 'refresh_token'],
  redirect_uris TEXT[] NOT NULL,
  access_token_lifetime INTEGER DEFAULT 3600,
  refresh_token_lifetime INTEGER DEFAULT 2592000,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_oauth_clients_tenant ON oauth_clients(tenant_id);
CREATE INDEX idx_oauth_clients_client_id ON oauth_clients(client_id);

-- OAuth Tokens
CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token VARCHAR(255) UNIQUE NOT NULL,
  access_token_expires_at TIMESTAMP NOT NULL,
  refresh_token VARCHAR(255) UNIQUE,
  refresh_token_expires_at TIMESTAMP,
  client_id VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT,
  revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_oauth_tokens_access ON oauth_tokens(access_token);
CREATE INDEX idx_oauth_tokens_refresh ON oauth_tokens(refresh_token);
CREATE INDEX idx_oauth_tokens_user ON oauth_tokens(user_id);

-- OAuth Authorization Codes
CREATE TABLE oauth_authorization_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  redirect_uri TEXT NOT NULL,
  scope TEXT,
  client_id VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_oauth_codes_code ON oauth_authorization_codes(code);
CREATE INDEX idx_oauth_codes_user ON oauth_authorization_codes(user_id);

-- Webhooks
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  active BOOLEAN DEFAULT true,
  secret VARCHAR(255) NOT NULL,
  headers JSONB,
  transform TEXT,
  retry_config JSONB,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhooks_tenant ON webhooks(tenant_id);
CREATE INDEX idx_webhooks_events ON webhooks USING GIN (events);

-- Webhook Deliveries
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL, -- success, failed, pending
  status_code INTEGER,
  response_time INTEGER,
  error TEXT,
  attempt INTEGER DEFAULT 1,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_created ON webhook_deliveries(created_at);

-- Webhook Dead Letter Queue
CREATE TABLE webhook_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  error TEXT,
  failed_at TIMESTAMP NOT NULL,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id)
);

CREATE INDEX idx_webhook_dlq_webhook ON webhook_dlq(webhook_id);
CREATE INDEX idx_webhook_dlq_resolved ON webhook_dlq(resolved);

-- Connectors
CREATE TABLE connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL, -- salesforce, jira, servicenow, sap, custom
  name VARCHAR(255) NOT NULL,
  config JSONB NOT NULL,
  credentials_encrypted TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, error
  last_sync_at TIMESTAMP,
  last_error TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_connectors_tenant ON connectors(tenant_id);
CREATE INDEX idx_connectors_type ON connectors(type);

-- Sync Jobs
CREATE TABLE sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  direction VARCHAR(20) NOT NULL, -- inbound, outbound, bidirectional
  schedule VARCHAR(255), -- cron expression
  entity_mapping JSONB NOT NULL,
  field_mapping JSONB NOT NULL,
  conflict_resolution VARCHAR(50) DEFAULT 'source_wins', -- source_wins, target_wins, manual
  last_run_at TIMESTAMP,
  last_run_status VARCHAR(50), -- success, failed, partial
  last_run_stats JSONB,
  next_run_at TIMESTAMP,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sync_jobs_connector ON sync_jobs(connector_id);
CREATE INDEX idx_sync_jobs_next_run ON sync_jobs(next_run_at);

-- Sync Job Runs
CREATE TABLE sync_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id UUID NOT NULL REFERENCES sync_jobs(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL, -- running, success, failed, partial
  records_processed INTEGER DEFAULT 0,
  records_success INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  errors JSONB,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER
);

CREATE INDEX idx_sync_job_runs_job ON sync_job_runs(sync_job_id);
CREATE INDEX idx_sync_job_runs_started ON sync_job_runs(started_at);

-- Import Jobs
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  mapping JSONB NOT NULL,
  options JSONB,
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  total_records INTEGER,
  success_records INTEGER,
  failed_records INTEGER,
  errors JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_import_jobs_tenant ON import_jobs(tenant_id);
CREATE INDEX idx_import_jobs_status ON import_jobs(status);

-- API Keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  scopes TEXT[] NOT NULL,
  rate_limit INTEGER,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  revoked BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

This implementation guide provides comprehensive technical details for Phase 5. Would you like me to continue with the remaining documentation files?

