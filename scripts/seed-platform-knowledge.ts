/**
 * Seed Platform Knowledge to Vector Store
 *
 * Indexes platform capabilities and documentation for RAG-based search.
 */
import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import axios from 'axios';

const EMBEDDING_BASE_URL =
  process.env.VLLM_BASE_URL ||
  process.env.OLLAMA_BASE_URL ||
  'http://localhost:11434';
const EMBEDDING_MODEL =
  process.env.VLLM_EMBEDDING_MODEL ||
  process.env.OLLAMA_EMBEDDING_MODEL ||
  'nomic-embed-text';
const EMBEDDING_API_KEY = process.env.VLLM_API_KEY || process.env.OLLAMA_API_KEY || '';

type EmbeddingProvider = {
  name: 'ollama' | 'openai';
  url: string;
  payload: (text: string) => Record<string, unknown>;
  extract: (data: any) => number[];
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function buildOpenAiEmbeddingUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  return normalized.endsWith('/v1')
    ? `${normalized}/embeddings`
    : `${normalized}/v1/embeddings`;
}

function buildOllamaEmbeddingUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl).replace(/\/v1$/, '');
  return `${normalized}/api/embeddings`;
}

const EMBEDDING_HEADERS = {
  'Content-Type': 'application/json',
  ...(EMBEDDING_API_KEY ? { Authorization: `Bearer ${EMBEDDING_API_KEY}` } : {}),
};

let embeddingProvider: EmbeddingProvider | null = null;

async function resolveEmbeddingProvider(): Promise<EmbeddingProvider> {
  if (embeddingProvider) {
    return embeddingProvider;
  }

  const candidates: EmbeddingProvider[] = [
    {
      name: 'ollama',
      url: buildOllamaEmbeddingUrl(EMBEDDING_BASE_URL),
      payload: (text) => ({ model: EMBEDDING_MODEL, prompt: text }),
      extract: (data) => data?.embedding,
    },
    {
      name: 'openai',
      url: buildOpenAiEmbeddingUrl(EMBEDDING_BASE_URL),
      payload: (text) => ({ model: EMBEDDING_MODEL, input: text }),
      extract: (data) => data?.data?.[0]?.embedding,
    },
  ];

  if (normalizeBaseUrl(EMBEDDING_BASE_URL).endsWith('/v1')) {
    candidates.reverse();
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const response = await axios.post(candidate.url, candidate.payload('ping'), {
        headers: EMBEDDING_HEADERS,
        timeout: 10000,
      });
      const embedding = candidate.extract(response.data);
      if (Array.isArray(embedding)) {
        embeddingProvider = candidate;
        return candidate;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `No embedding provider reachable at ${EMBEDDING_BASE_URL}. Last error: ${String(lastError)}`
  );
}

const platformKnowledge = [
  // General Help
  {
    sourceType: 'platform_docs',
    sourceId: 'ava-introduction',
    content: `AVA - AI Virtual Assistant

I'm AVA, the AI Virtual Assistant for HubbleWave. I can help you with:

1. **Navigating the Platform** - Tell me what you're looking for and I'll guide you there.
2. **Answering Questions** - Ask about platform features, capabilities, or how to do something.
3. **Creating Records** - I can help you create incidents, requests, or other records.
4. **Finding Information** - Search knowledge articles, catalog items, and more.
5. **Understanding Your Data** - Ask about your incidents, requests, assets, and other records.

Just ask me anything in natural language and I'll do my best to help!

Examples of what you can ask:
- "How do I create an incident?"
- "Show me my open requests"
- "What is the service catalog?"
- "Help me find information about VPN issues"
- "What can you do?"`,
    metadata: { category: 'help', priority: 1 }
  },
  // Core Platform
  {
    sourceType: 'platform_docs',
    sourceId: 'collections-overview',
    content: `Collections (Schema Engine)

Collections are the foundation for storing any type of business data in HubbleWave. They're like customizable database tables.

Key Features:
- Define custom collections with flexible schemas
- Add properties of various types (text, number, date, reference, etc.)
- Set up relationships between collections
- Configure validation rules and defaults
- Enable attachments and comments
- Full audit trail of changes

Use Cases:
- Create a custom asset inventory
- Build a project tracking system
- Design a vendor management database
- Track contracts and agreements

To create a collection, go to Admin > Schema > Collections and click "New Collection".`,
    metadata: { category: 'core', module: 'schema' }
  },
  {
    sourceType: 'platform_docs',
    sourceId: 'views-overview',
    content: `Views Engine

Views let you create custom list displays of your data with filters, sorting, and grouping.

Key Features:
- Create list views with custom columns
- Add filters and sorting
- Save personal or shared views
- Group by columns
- Inline editing support
- Export to CSV/Excel

To create a view, open any collection and click the view dropdown, then "Create New View".`,
    metadata: { category: 'core', module: 'views' }
  },
  // ITSM
  {
    sourceType: 'platform_docs',
    sourceId: 'incident-management',
    content: `Incident Management

Track and resolve IT incidents with prioritization, assignment, escalation, and SLA tracking.

Key Features:
- Incident creation and categorization
- Priority and urgency matrix
- Assignment to individuals or groups
- SLA tracking and alerts
- Related incidents and problems
- Resolution and closure process
- Knowledge article suggestions

To create an incident:
1. Click "Create" in the top navigation
2. Select "Incident"
3. Fill in the short description and details
4. Assign to a group or individual
5. Set the priority and category
6. Click "Submit"`,
    metadata: { category: 'itsm', module: 'incident' }
  },
  {
    sourceType: 'platform_docs',
    sourceId: 'service-requests',
    content: `Service Request Fulfillment

Handle service requests from the catalog with approval process flows, task assignment, and fulfillment tracking.

Key Features:
- Request submission from catalog
- Multi-level approval process flows
- Task breakdown and assignment
- Status tracking for requesters
- Fulfillment templates

To submit a service request:
1. Browse the Service Catalog
2. Select the item you need
3. Fill in the request form
4. Submit for approval
5. Track status in "My Requests"`,
    metadata: { category: 'itsm', module: 'request' }
  },
  {
    sourceType: 'platform_docs',
    sourceId: 'change-management',
    content: `Change Management

Plan, approve, and implement changes with risk assessment and change advisory board (CAB) reviews.

Key Features:
- Change request creation
- Risk and impact assessment
- CAB review process
- Change calendar
- Implementation planning
- Post-implementation review
- Emergency change handling

Standard changes go through a simplified process. Normal and emergency changes require CAB approval.`,
    metadata: { category: 'itsm', module: 'change' }
  },
  // Knowledge Base
  {
    sourceType: 'platform_docs',
    sourceId: 'knowledge-base',
    content: `Knowledge Base

Create, publish, and maintain knowledge articles for self-service support.

Key Features:
- Article creation and editing
- Categories and tags
- Version history
- Approval process flows for publishing
- AI-powered search
- Article ratings and feedback

To create a knowledge article:
1. Go to Knowledge > Articles
2. Click "New Article"
3. Write your content using the rich text editor
4. Add categories and tags
5. Submit for approval
6. Once approved, it will be published`,
    metadata: { category: 'knowledge', module: 'knowledge' }
  },
  // Asset Management
  {
    sourceType: 'platform_docs',
    sourceId: 'asset-management',
    content: `Asset Management

Track hardware, software, and other assets throughout their lifecycle.

Key Features:
- Asset inventory and discovery
- Hardware and software tracking
- Asset lifecycle management
- Depreciation calculations
- Warranty and contract tracking
- Location and assignment tracking

Assets can be linked to users, locations, and other configuration items in the CMDB.`,
    metadata: { category: 'asset', module: 'asset' }
  },
  // Automation
  {
    sourceType: 'platform_docs',
    sourceId: 'business-rules',
    content: `Business Rules

Automate actions when records are created, updated, or deleted.

Key Features:
- Trigger on record events (insert, update, delete)
- Condition-based execution
- Set field values automatically
- Send email notifications
- Create related records
- Call external webhooks

Example automations:
- Auto-assign incidents based on category
- Send notification when SLA is at risk
- Set default values on record creation
- Escalate after X hours without response`,
    metadata: { category: 'automation', module: 'automation' }
  },
  // Service Catalog
  {
    sourceType: 'platform_docs',
    sourceId: 'service-catalog',
    content: `Service Catalog

Publish a catalog of IT services and products that users can request.

Key Features:
- Service and product definitions
- Category organization
- Pricing and cost centers
- Request forms per item
- Approval process flows
- Self-service portal

The catalog provides a "menu" of IT services that end users can browse and request.`,
    metadata: { category: 'catalog', module: 'catalog' }
  },
  // Security
  {
    sourceType: 'platform_docs',
    sourceId: 'access-control',
    content: `Role-Based Access Control

Define roles with specific permissions for collections, fields, and actions.

Key Features:
- Role definitions
- Collection-level permissions
- Field-level security
- Record-level ACLs
- Permission inheritance

Users inherit permissions from their roles. Administrators can create custom roles with specific access rights.`,
    metadata: { category: 'security', module: 'security' }
  }
];

async function getEmbedding(text: string): Promise<number[]> {
  try {
    const provider = await resolveEmbeddingProvider();
    const response = await axios.post(provider.url, provider.payload(text), {
      headers: EMBEDDING_HEADERS,
      timeout: 60000,
    });
    const embedding = provider.extract(response.data);
    if (!Array.isArray(embedding)) {
      throw new Error(`Embedding response missing vector from ${provider.name}`);
    }
    return embedding;
  } catch (error) {
    console.error('Failed to get embedding:', error);
    throw error;
  }
}

async function main() {
  console.log('Connecting to database...');

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'hubblewave',
    password: process.env.DB_PASSWORD || 'hubblewave',
    database: process.env.DB_NAME || 'hubblewave',
  });

  await dataSource.initialize();
  console.log('Connected to database');

  // Ensure pgvector extension exists
  await dataSource.query('CREATE EXTENSION IF NOT EXISTS vector');

  console.log(`Seeding ${platformKnowledge.length} platform documents...`);

  for (const doc of platformKnowledge) {
    try {
      console.log(`  Processing: ${doc.sourceId}`);

      // Get embedding
      const embedding = await getEmbedding(doc.content);

      // Insert or update document
      await dataSource.query(`
        INSERT INTO document_chunks (source_type, source_id, content, metadata, embedding)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (source_type, source_id, content)
        DO UPDATE SET embedding = $5, updated_at = NOW()
      `, [doc.sourceType, doc.sourceId, doc.content, JSON.stringify(doc.metadata), `[${embedding.join(',')}]`]);

      console.log(`    ✓ Indexed successfully`);
    } catch (error) {
      console.error(`    ✗ Failed: ${error}`);
    }
  }

  // Show count
  const result = await dataSource.query('SELECT COUNT(*) as count FROM document_chunks');
  console.log(`\nTotal documents in vector store: ${result[0].count}`);

  await dataSource.destroy();
  console.log('Done!');
}

main().catch(console.error);
