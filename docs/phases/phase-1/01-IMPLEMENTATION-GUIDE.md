# Phase 1: Implementation Guide

## Architecture Principles

### 1. Metadata-First Architecture
Every aspect of the platform is driven by metadata, enabling:
- Client customization without code changes
- Safe upgrades that preserve customizations
- Runtime configuration changes
- AVA understanding of system structure

### 2. Layered Customization Model
```
┌─────────────────────────────────────────────────┐
│  Layer 4: User Preferences                      │ ← Individual user settings
├─────────────────────────────────────────────────┤
│  Layer 3: Group/Department Overrides            │ ← Team-specific configs
├─────────────────────────────────────────────────┤
│  Layer 2: Instance Customizations               │ ← Client-specific configs
├─────────────────────────────────────────────────┤
│  Layer 1: Platform Defaults                     │ ← HubbleWave base (upgradeable)
└─────────────────────────────────────────────────┘
```

### 3. Theme Token Architecture
Never use hardcoded colors - always reference semantic tokens:

```typescript
// ❌ WRONG - Hardcoded color
const Button = styled.button`
  background-color: #1976d2;
`;

// ✅ CORRECT - Theme token reference
const Button = styled.button`
  background-color: var(--hw-interactive-primary);
`;
```

---

## 1. Authentication System

### 1.1 Authentication Flow

```typescript
// libs/auth/src/flows/authentication.flow.ts

interface AuthenticationContext {
  // Request information
  ip: string;
  userAgent: string;
  deviceFingerprint: string;
  timestamp: Date;

  // Resolved information
  geoLocation?: GeoLocation;
  deviceInfo?: DeviceInfo;
  knownDevice?: boolean;

  // Risk assessment
  riskScore?: number;
  riskFactors?: RiskFactor[];
}

interface AuthenticationResult {
  status: 'success' | 'mfa_required' | 'password_change_required' | 'locked' | 'failed';
  user?: User;
  tokens?: TokenPair;
  mfaChallenge?: MfaChallenge;
  message?: string;
}

@Injectable()
export class AuthenticationService {
  async authenticate(
    credentials: LoginCredentials,
    context: AuthenticationContext
  ): Promise<AuthenticationResult> {
    // Step 1: Validate credentials
    const user = await this.validateCredentials(credentials);
    if (!user) {
      await this.recordFailedAttempt(credentials.username, context);
      return { status: 'failed', message: 'Invalid credentials' };
    }

    // Step 2: Check account status
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return { status: 'locked', message: 'Account temporarily locked' };
    }

    // Step 3: Assess risk and determine MFA requirement
    const riskAssessment = await this.riskService.assess(user, context);
    context.riskScore = riskAssessment.score;
    context.riskFactors = riskAssessment.factors;

    // Step 4: Determine if MFA is required
    const mfaRequired = await this.shouldRequireMfa(user, riskAssessment);
    if (mfaRequired) {
      const challenge = await this.mfaService.createChallenge(user, riskAssessment.recommendedMethods);
      return { status: 'mfa_required', mfaChallenge: challenge };
    }

    // Step 5: Check password policy
    if (await this.passwordNeedsChange(user)) {
      return { status: 'password_change_required', user };
    }

    // Step 6: Generate tokens and create session
    const tokens = await this.tokenService.generateTokenPair(user, context);
    await this.sessionService.create(user, context, tokens);

    return { status: 'success', user, tokens };
  }
}
```

### 1.2 Multi-Factor Authentication

```typescript
// libs/auth/src/mfa/mfa.service.ts

type MfaMethod = 'totp' | 'sms' | 'email' | 'push' | 'webauthn' | 'backup_code';

interface MfaChallenge {
  id: string;
  userId: string;
  methods: MfaMethod[];
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
}

interface MfaConfig {
  // Method-specific configuration
  totp: {
    issuer: string;
    algorithm: 'SHA1' | 'SHA256' | 'SHA512';
    digits: 6 | 8;
    period: 30 | 60;
  };

  sms: {
    provider: 'twilio' | 'aws_sns';
    codeLength: number;
    expirationMinutes: number;
    template: string;
  };

  email: {
    codeLength: number;
    expirationMinutes: number;
    templateId: string;
  };

  push: {
    provider: 'firebase' | 'apns';
    expirationMinutes: number;
    requireBiometric: boolean;
  };

  webauthn: {
    rpId: string;
    rpName: string;
    attestation: 'none' | 'indirect' | 'direct';
    authenticatorAttachment?: 'platform' | 'cross-platform';
    userVerification: 'required' | 'preferred' | 'discouraged';
  };

  backup: {
    codeCount: number;
    codeLength: number;
    regenerateOnUse: boolean;
  };
}

@Injectable()
export class MfaService {
  async enrollTotp(userId: string): Promise<TotpEnrollment> {
    const secret = this.generateSecret();
    const qrCodeUrl = this.generateQrCodeUrl(userId, secret);

    // Store pending enrollment (not active until verified)
    await this.storePendingEnrollment(userId, 'totp', { secret });

    return {
      secret,
      qrCodeUrl,
      manualEntryKey: this.formatSecretForManualEntry(secret),
    };
  }

  async verifyTotp(userId: string, code: string): Promise<boolean> {
    const enrollment = await this.getEnrollment(userId, 'totp');
    const config = await this.getConfig();

    return this.totpLib.verify({
      token: code,
      secret: enrollment.secret,
      window: config.totp.period === 30 ? 1 : 0,
    });
  }

  async createChallenge(user: User, methods: MfaMethod[]): Promise<MfaChallenge> {
    const challenge: MfaChallenge = {
      id: uuid(),
      userId: user.id,
      methods: methods.filter(m => user.mfaMethods.includes(m)),
      expiresAt: addMinutes(new Date(), 5),
      attempts: 0,
      maxAttempts: 5,
    };

    await this.redis.setex(
      `mfa:challenge:${challenge.id}`,
      300, // 5 minutes
      JSON.stringify(challenge)
    );

    return challenge;
  }
}
```

### 1.3 Single Sign-On Implementation

```typescript
// libs/auth/src/sso/sso-provider.factory.ts

interface SsoProviderConfig {
  id: string;
  name: string;
  protocol: 'saml' | 'oidc' | 'oauth2';
  enabled: boolean;

  // Display
  buttonLabel: string;
  buttonIcon: string;           // Icon token reference
  buttonVariant: string;        // Theme token reference

  // Protocol-specific config (stored encrypted)
  config: SamlConfig | OidcConfig | OAuth2Config;

  // Attribute mapping
  attributeMapping: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    groups?: string;
    roles?: string;
  };

  // Role/Group mapping
  roleMapping: {
    sourceValue: string;
    targetRole: string;
  }[];

  // JIT provisioning
  jitProvisioning: {
    enabled: boolean;
    defaultRoles: string[];
    defaultGroups: string[];
  };
}

interface SamlConfig {
  entityId: string;
  ssoUrl: string;
  sloUrl?: string;
  certificate: string;          // Encrypted
  signRequests: boolean;
  signatureAlgorithm: string;
  digestAlgorithm: string;
}

interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;         // Encrypted
  scopes: string[];
  responseType: string;
  discoveryUrl?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
}

@Injectable()
export class SsoProviderFactory {
  createProvider(config: SsoProviderConfig): SsoProvider {
    switch (config.protocol) {
      case 'saml':
        return new SamlProvider(config);
      case 'oidc':
        return new OidcProvider(config);
      case 'oauth2':
        return new OAuth2Provider(config);
      default:
        throw new Error(`Unknown SSO protocol: ${config.protocol}`);
    }
  }
}
```

---

## 2. Collection Management

### 2.1 Collection Metadata Schema

```typescript
// libs/metadata/src/collection/collection.schema.ts

interface CollectionDefinition {
  // Identity
  id: string;
  name: string;                           // System name (e.g., "incidents")
  label: string;                          // Display name (e.g., "Incidents")
  pluralLabel: string;                    // Plural display (e.g., "Incidents")
  description?: string;

  // Categorization
  category: string;                       // e.g., "ITSM", "HR", "Custom"
  icon: string;                           // Icon token reference
  color: string;                          // Theme token reference

  // Properties
  properties: PropertyDefinition[];

  // Primary display field
  displayProperty: string;                // Which property to show in references

  // Audit settings
  audit: {
    enabled: boolean;
    trackChanges: boolean;
    retentionDays: number;
  };

  // Versioning
  versioning: {
    enabled: boolean;
    maxVersions?: number;
  };

  // Security
  security: {
    rowLevelSecurity: boolean;
    rlsPolicy?: string;                   // Policy expression
  };

  // Relationships
  relationships: RelationshipDefinition[];

  // Indexes for performance
  indexes: IndexDefinition[];

  // Metadata management
  source: 'platform' | 'instance';
  customizable: boolean;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PropertyDefinition {
  id: string;
  name: string;                           // System name (e.g., "short_description")
  label: string;                          // Display name (e.g., "Short Description")
  description?: string;

  // Type
  type: PropertyType;
  typeConfig?: PropertyTypeConfig;

  // Behavior
  required: boolean;
  unique: boolean;
  indexed: boolean;
  searchable: boolean;
  sortable: boolean;
  filterable: boolean;

  // Default value
  defaultValue?: unknown;
  defaultExpression?: string;             // Formula for default

  // Validation
  validation?: ValidationRule[];

  // Display
  displayOrder: number;
  showInList: boolean;
  showInForm: boolean;
  showInCard: boolean;
  columnWidth?: number;

  // Security
  readRoles?: string[];                   // Who can see this property
  writeRoles?: string[];                  // Who can modify this property

  // AVA integration
  avaDescription?: string;                // How AVA describes this property
  avaExamples?: string[];                 // Example values for AVA

  // Metadata
  source: 'platform' | 'instance';
  customizable: boolean;
}

type PropertyType =
  | 'string'
  | 'text'
  | 'richText'
  | 'number'
  | 'decimal'
  | 'currency'
  | 'percentage'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'
  | 'duration'
  | 'email'
  | 'url'
  | 'phone'
  | 'choice'
  | 'multiChoice'
  | 'reference'
  | 'multiReference'
  | 'user'
  | 'group'
  | 'attachment'
  | 'image'
  | 'json'
  | 'formula'
  | 'rollup'
  | 'lookup';

interface PropertyTypeConfig {
  // For choice types
  choices?: ChoiceOption[];
  allowOther?: boolean;

  // For reference types
  targetCollection?: string;
  displayProperty?: string;
  filterExpression?: string;

  // For number types
  minValue?: number;
  maxValue?: number;
  precision?: number;

  // For currency
  currencyCode?: string;
  currencyProperty?: string;             // Dynamic currency from another property

  // For date/time
  includeTime?: boolean;
  timezone?: string;
  minDate?: string;
  maxDate?: string;

  // For string types
  minLength?: number;
  maxLength?: number;
  pattern?: string;

  // For formula types
  formula?: string;
  returnType?: PropertyType;

  // For rollup types
  relationshipId?: string;
  rollupProperty?: string;
  rollupFunction: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'countAll';

  // For lookup types
  relationshipId?: string;
  lookupProperty?: string;
}
```

### 2.2 Collection Service Implementation

```typescript
// apps/svc-metadata/src/app/collections/collections.service.ts

@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(Collection) private collectionRepo: Repository<Collection>,
    @InjectRepository(Property) private propertyRepo: Repository<Property>,
    private readonly schemaService: SchemaService,
    private readonly cacheService: CacheService,
    private readonly auditService: AuditService,
    private readonly avaService: AvaService,
  ) {}

  async create(dto: CreateCollectionDto, createdBy: string): Promise<Collection> {
    // Validate collection name
    await this.validateCollectionName(dto.name);

    // Create collection record
    const collection = this.collectionRepo.create({
      ...dto,
      source: 'instance',
      version: '1.0.0',
      createdBy,
    });

    // Create database table
    await this.schemaService.createTable(collection);

    // Save metadata
    const saved = await this.collectionRepo.save(collection);

    // Create default properties (id, createdAt, updatedAt, createdBy, updatedBy)
    await this.createSystemProperties(saved);

    // Create user-defined properties
    if (dto.properties) {
      await this.createProperties(saved.id, dto.properties);
    }

    // Invalidate cache
    await this.cacheService.invalidatePattern('collections:*');

    // Audit log
    await this.auditService.log('collection.created', saved.id, createdBy);

    // Notify AVA of new collection
    await this.avaService.learnCollection(saved);

    return this.findById(saved.id);
  }

  async addProperty(
    collectionId: string,
    dto: CreatePropertyDto,
    createdBy: string
  ): Promise<Property> {
    const collection = await this.findById(collectionId);

    // Validate property name
    await this.validatePropertyName(collectionId, dto.name);

    // Create property record
    const property = this.propertyRepo.create({
      collectionId,
      ...dto,
      source: 'instance',
      createdBy,
    });

    // Add column to database table
    await this.schemaService.addColumn(collection.name, property);

    // Save metadata
    const saved = await this.propertyRepo.save(property);

    // Invalidate cache
    await this.cacheService.invalidate(`collection:${collectionId}`);

    // Audit log
    await this.auditService.log('property.created', saved.id, createdBy);

    // Notify AVA of new property
    await this.avaService.learnProperty(collection, saved);

    return saved;
  }
}
```

---

## 3. Record Operations

### 3.1 Record Service

```typescript
// apps/svc-data/src/app/records/records.service.ts

interface RecordQuery {
  collection: string;
  fields?: string[];              // Properties to return
  filter?: FilterExpression;
  sort?: SortExpression[];
  page?: number;
  limit?: number;
  includeRelated?: string[];     // Related records to include
}

interface FilterExpression {
  operator: 'and' | 'or';
  conditions: (FilterCondition | FilterExpression)[];
}

interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

type FilterOperator =
  | 'eq' | 'ne'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'notIn'
  | 'contains' | 'notContains'
  | 'startsWith' | 'endsWith'
  | 'isNull' | 'isNotNull'
  | 'between'
  | 'matches';                    // Regex

@Injectable()
export class RecordsService {
  async query(query: RecordQuery, user: User): Promise<PaginatedResult<Record>> {
    // Get collection metadata
    const collection = await this.metadataService.getCollection(query.collection);

    // Apply row-level security
    const securityFilter = await this.securityService.getSecurityFilter(
      collection,
      user,
      'read'
    );

    // Build query
    const qb = this.buildQuery(collection, query, securityFilter);

    // Execute with pagination
    const [records, total] = await qb.getManyAndCount();

    // Load related records if requested
    if (query.includeRelated?.length) {
      await this.loadRelatedRecords(records, query.includeRelated, collection);
    }

    // Transform to output format
    const transformed = await this.transformRecords(records, collection, query.fields);

    return {
      data: transformed,
      total,
      page: query.page || 1,
      limit: query.limit || 50,
      totalPages: Math.ceil(total / (query.limit || 50)),
    };
  }

  async create(
    collectionName: string,
    data: Record<string, unknown>,
    user: User
  ): Promise<Record> {
    const collection = await this.metadataService.getCollection(collectionName);

    // Check create permission
    await this.securityService.checkPermission(collection, user, 'create');

    // Validate data against collection schema
    const validated = await this.validationService.validate(collection, data, 'create');

    // Apply default values
    const withDefaults = await this.applyDefaults(collection, validated);

    // Calculate formula fields
    const withFormulas = await this.calculateFormulas(collection, withDefaults);

    // Execute before-create hooks
    const hooked = await this.hookService.runBeforeCreate(collection, withFormulas, user);

    // Insert record
    const record = await this.insertRecord(collection, hooked, user);

    // Execute after-create hooks
    await this.hookService.runAfterCreate(collection, record, user);

    // Create audit entry
    await this.auditService.logRecordCreate(collection, record, user);

    // Update rollup fields on related records
    await this.updateRollups(collection, record);

    // Notify AVA
    await this.avaService.notifyRecordCreated(collection, record);

    return record;
  }

  async update(
    collectionName: string,
    recordId: string,
    data: Record<string, unknown>,
    user: User
  ): Promise<Record> {
    const collection = await this.metadataService.getCollection(collectionName);
    const existing = await this.findById(collection, recordId);

    // Check update permission (including row-level security)
    await this.securityService.checkRecordPermission(collection, existing, user, 'update');

    // Check field-level permissions
    const allowedFields = await this.securityService.getWritableFields(collection, user);
    const filteredData = this.filterToAllowedFields(data, allowedFields);

    // Validate data
    const validated = await this.validationService.validate(collection, filteredData, 'update');

    // Merge with existing
    const merged = { ...existing, ...validated };

    // Calculate formulas
    const withFormulas = await this.calculateFormulas(collection, merged);

    // Execute before-update hooks
    const hooked = await this.hookService.runBeforeUpdate(collection, existing, withFormulas, user);

    // Create version if versioning enabled
    if (collection.versioning.enabled) {
      await this.createVersion(collection, existing, user);
    }

    // Update record
    const updated = await this.updateRecord(collection, recordId, hooked, user);

    // Execute after-update hooks
    await this.hookService.runAfterUpdate(collection, existing, updated, user);

    // Create audit entry with diff
    await this.auditService.logRecordUpdate(collection, existing, updated, user);

    // Update rollups
    await this.updateRollups(collection, updated);

    return updated;
  }

  async bulkCreate(
    collectionName: string,
    records: Record<string, unknown>[],
    user: User,
    options: BulkOptions = {}
  ): Promise<BulkResult> {
    const collection = await this.metadataService.getCollection(collectionName);
    await this.securityService.checkPermission(collection, user, 'create');

    const results: BulkResultItem[] = [];
    const batchSize = options.batchSize || 100;

    // Process in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      // Validate batch
      const validated = await Promise.all(
        batch.map(async (record, idx) => {
          try {
            return {
              index: i + idx,
              data: await this.validationService.validate(collection, record, 'create'),
              valid: true,
            };
          } catch (error) {
            return {
              index: i + idx,
              error: error.message,
              valid: false,
            };
          }
        })
      );

      // Insert valid records
      const validRecords = validated.filter(v => v.valid);
      if (validRecords.length > 0) {
        const inserted = await this.batchInsert(
          collection,
          validRecords.map(v => v.data),
          user
        );
        results.push(...inserted.map((r, idx) => ({
          index: validRecords[idx].index,
          success: true,
          record: r,
        })));
      }

      // Track failed records
      results.push(...validated
        .filter(v => !v.valid)
        .map(v => ({
          index: v.index,
          success: false,
          error: v.error,
        }))
      );

      // Emit progress
      if (options.onProgress) {
        options.onProgress({
          processed: Math.min(i + batchSize, records.length),
          total: records.length,
          succeeded: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
        });
      }
    }

    return {
      total: records.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }
}
```

---

## 4. View System

### 4.1 View Metadata Schema

```typescript
// libs/metadata/src/views/view.schema.ts

interface ViewDefinition {
  id: string;
  name: string;
  label: string;
  description?: string;

  // Associated collection
  collectionId: string;

  // View type
  type: 'list' | 'kanban' | 'calendar' | 'gallery' | 'timeline' | 'chart';

  // Type-specific configuration
  config: ListViewConfig | KanbanViewConfig | CalendarViewConfig | GalleryViewConfig;

  // Filtering
  filter?: FilterExpression;
  userCanFilter: boolean;

  // Sorting
  defaultSort?: SortExpression[];
  userCanSort: boolean;

  // Grouping
  groupBy?: string;
  groupCollapsed?: boolean;

  // Visibility
  visibility: 'public' | 'group' | 'personal';
  visibilityGroupIds?: string[];
  ownerId?: string;

  // Access control
  roles?: string[];

  // Quick actions
  quickActions?: QuickAction[];

  // AVA integration
  avaDescription?: string;

  // Metadata
  source: 'platform' | 'instance' | 'user';
  version: string;
}

interface ListViewConfig {
  columns: ColumnConfig[];
  density: 'compact' | 'comfortable' | 'spacious';
  showLineNumbers: boolean;
  allowInlineEdit: boolean;
  stickyHeader: boolean;
  virtualScroll: boolean;
  rowHeight: number;
}

interface ColumnConfig {
  propertyId: string;
  width: number | 'auto';
  minWidth?: number;
  maxWidth?: number;
  visible: boolean;
  pinned?: 'left' | 'right';
  sortable: boolean;
  filterable: boolean;
  resizable: boolean;
}

interface KanbanViewConfig {
  laneProperty: string;           // Choice property for lanes
  cardTitle: string;              // Property for card title
  cardSubtitle?: string;          // Property for card subtitle
  cardProperties: string[];       // Properties shown on card
  cardColor?: string;             // Property for card color
  wipLimits?: Record<string, number>;
  allowDragDrop: boolean;
  showEmptyLanes: boolean;
}

interface CalendarViewConfig {
  startDateProperty: string;
  endDateProperty?: string;
  titleProperty: string;
  colorProperty?: string;
  allDayProperty?: string;
  defaultView: 'month' | 'week' | 'day' | 'agenda';
  allowDragDrop: boolean;
  showWeekends: boolean;
  workingHours: { start: string; end: string };
}

interface GalleryViewConfig {
  imageProperty: string;          // Attachment property for image
  titleProperty: string;
  subtitleProperty?: string;
  cardSize: 'small' | 'medium' | 'large';
  aspectRatio: '1:1' | '4:3' | '16:9';
  showOverlay: boolean;
  overlayProperties: string[];
}
```

---

## 5. Database Schema

### 5.1 Core Tables Migration

```sql
-- migrations/instance/1704067200001-phase1-core-tables.sql

-- Collections metadata
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  label VARCHAR(255) NOT NULL,
  plural_label VARCHAR(255),
  description TEXT,
  category VARCHAR(100),
  icon VARCHAR(100),
  color VARCHAR(50),
  display_property VARCHAR(255),
  audit_enabled BOOLEAN DEFAULT true,
  audit_track_changes BOOLEAN DEFAULT true,
  audit_retention_days INTEGER DEFAULT 365,
  versioning_enabled BOOLEAN DEFAULT false,
  versioning_max_versions INTEGER,
  row_level_security BOOLEAN DEFAULT false,
  rls_policy TEXT,
  source VARCHAR(50) DEFAULT 'instance',
  customizable BOOLEAN DEFAULT true,
  version VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- Properties metadata
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,
  type_config JSONB,
  required BOOLEAN DEFAULT false,
  unique_value BOOLEAN DEFAULT false,
  indexed BOOLEAN DEFAULT false,
  searchable BOOLEAN DEFAULT true,
  sortable BOOLEAN DEFAULT true,
  filterable BOOLEAN DEFAULT true,
  default_value JSONB,
  default_expression TEXT,
  validation JSONB,
  display_order INTEGER DEFAULT 0,
  show_in_list BOOLEAN DEFAULT true,
  show_in_form BOOLEAN DEFAULT true,
  show_in_card BOOLEAN DEFAULT true,
  column_width INTEGER,
  read_roles TEXT[],
  write_roles TEXT[],
  ava_description TEXT,
  ava_examples TEXT[],
  source VARCHAR(50) DEFAULT 'instance',
  customizable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(collection_id, name)
);

-- Relationships
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  source_collection_id UUID NOT NULL REFERENCES collections(id),
  target_collection_id UUID NOT NULL REFERENCES collections(id),
  relationship_type VARCHAR(50) NOT NULL, -- 'one_to_many', 'many_to_many'
  source_property_id UUID REFERENCES properties(id),
  target_property_id UUID REFERENCES properties(id),
  junction_collection_id UUID REFERENCES collections(id), -- For many-to-many
  cascade_delete BOOLEAN DEFAULT false,
  required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name)
);

-- Views
CREATE TABLE views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL,
  filter JSONB,
  user_can_filter BOOLEAN DEFAULT true,
  default_sort JSONB,
  user_can_sort BOOLEAN DEFAULT true,
  group_by VARCHAR(255),
  group_collapsed BOOLEAN DEFAULT false,
  visibility VARCHAR(50) DEFAULT 'public',
  visibility_group_ids UUID[],
  owner_id UUID REFERENCES users(id),
  roles TEXT[],
  quick_actions JSONB,
  ava_description TEXT,
  source VARCHAR(50) DEFAULT 'instance',
  version VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- User preferences
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preference_key VARCHAR(255) NOT NULL,
  preference_value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, preference_key)
);

-- Favorites
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(50) NOT NULL, -- 'collection', 'view', 'record', 'report'
  target_id UUID NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_type, target_id)
);

-- Recent items
CREATE TABLE recent_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(50) NOT NULL,
  target_id UUID NOT NULL,
  target_metadata JSONB, -- Cached display info
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recent_items_user ON recent_items(user_id, accessed_at DESC);
```

---

## 6. API Endpoints Summary

```typescript
// Phase 1 API Routes

// Authentication
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
POST   /api/auth/mfa/challenge
POST   /api/auth/mfa/verify
POST   /api/auth/sso/:providerId
POST   /api/auth/sso/:providerId/callback
POST   /api/auth/passwordless/magic-link
POST   /api/auth/passwordless/webauthn/register
POST   /api/auth/passwordless/webauthn/authenticate

// Users
GET    /api/users
GET    /api/users/:id
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id
POST   /api/users/:id/activate
POST   /api/users/:id/deactivate
POST   /api/users/:id/impersonate

// Roles & Permissions
GET    /api/roles
GET    /api/roles/:id
POST   /api/roles
PUT    /api/roles/:id
DELETE /api/roles/:id
GET    /api/permissions

// Groups
GET    /api/groups
GET    /api/groups/:id
POST   /api/groups
PUT    /api/groups/:id
DELETE /api/groups/:id
POST   /api/groups/:id/members

// Collections
GET    /api/collections
GET    /api/collections/:id
POST   /api/collections
PUT    /api/collections/:id
DELETE /api/collections/:id
GET    /api/collections/:id/properties
POST   /api/collections/:id/properties
PUT    /api/collections/:id/properties/:propertyId
DELETE /api/collections/:id/properties/:propertyId

// Records
GET    /api/records/:collection
GET    /api/records/:collection/:id
POST   /api/records/:collection
PUT    /api/records/:collection/:id
DELETE /api/records/:collection/:id
POST   /api/records/:collection/bulk
DELETE /api/records/:collection/bulk
POST   /api/records/:collection/import
POST   /api/records/:collection/export
GET    /api/records/:collection/:id/history
GET    /api/records/:collection/:id/versions

// Views
GET    /api/views
GET    /api/views/:id
POST   /api/views
PUT    /api/views/:id
DELETE /api/views/:id
GET    /api/collections/:id/views

// User Preferences
GET    /api/preferences
PUT    /api/preferences
GET    /api/favorites
POST   /api/favorites
DELETE /api/favorites/:id
GET    /api/recent

// Theme
GET    /api/theme/tokens
GET    /api/theme/config
PUT    /api/theme/config

// Search
GET    /api/search?q=query
POST   /api/search/advanced
```
