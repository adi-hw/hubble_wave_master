# Phase 1: Test Plan

## Testing Strategy Overview

### Testing Pyramid

```
                    ┌──────────────┐
                   │   E2E Tests   │  ← 10% (Critical user journeys)
                  └───────┬────────┘
                 ┌────────┴─────────┐
                │ Integration Tests │  ← 20% (API, Service integration)
               └─────────┬──────────┘
              ┌──────────┴───────────┐
             │     Unit Tests        │  ← 70% (Components, Services, Utils)
            └────────────────────────┘
```

### Quality Gates

| Gate | Criteria | Blocking? |
|------|----------|-----------|
| Unit Tests | > 80% coverage | Yes |
| Integration Tests | All API tests pass | Yes |
| E2E Tests | Critical paths pass | Yes |
| Accessibility | Score > 95 | Yes |
| Performance | LCP < 1.5s | Yes |
| Security | No critical vulnerabilities | Yes |
| Code Review | Approved by 2 reviewers | Yes |

---

## 1. Unit Testing

### 1.1 Frontend Components

```typescript
// apps/web-client/src/components/__tests__/Button.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../../theme';
import { Button } from '../Button';

describe('Button Component', () => {
  const renderWithTheme = (ui: React.ReactElement) => {
    return render(<ThemeProvider>{ui}</ThemeProvider>);
  };

  describe('Variants', () => {
    it('renders primary variant with correct styles', () => {
      renderWithTheme(<Button variant="primary">Click me</Button>);
      const button = screen.getByRole('button');

      // Should use theme tokens, not hardcoded colors
      expect(button).toHaveStyle({
        backgroundColor: 'var(--hw-interactive-primary)',
      });
    });

    it('renders secondary variant with correct styles', () => {
      renderWithTheme(<Button variant="secondary">Click me</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveStyle({
        backgroundColor: 'var(--hw-interactive-secondary)',
      });
    });

    it('renders ghost variant with transparent background', () => {
      renderWithTheme(<Button variant="ghost">Click me</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveStyle({
        backgroundColor: 'transparent',
      });
    });
  });

  describe('Sizes', () => {
    it.each(['sm', 'md', 'lg'] as const)('renders %s size correctly', (size) => {
      renderWithTheme(<Button size={size}>Click me</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('data-size', size);
    });
  });

  describe('States', () => {
    it('shows loading spinner when loading', () => {
      renderWithTheme(<Button loading>Click me</Button>);

      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });

    it('is disabled when disabled prop is true', () => {
      renderWithTheme(<Button disabled>Click me</Button>);

      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('does not trigger onClick when disabled', () => {
      const onClick = jest.fn();
      renderWithTheme(<Button disabled onClick={onClick}>Click me</Button>);

      fireEvent.click(screen.getByRole('button'));

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has correct focus styles', () => {
      renderWithTheme(<Button>Click me</Button>);
      const button = screen.getByRole('button');

      button.focus();

      expect(button).toHaveStyle({
        boxShadow: 'var(--hw-shadow-focus)',
      });
    });

    it('announces loading state to screen readers', () => {
      renderWithTheme(<Button loading>Click me</Button>);

      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    });
  });
});
```

### 1.2 Backend Services

```typescript
// apps/svc-identity/src/app/auth/__tests__/auth.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { MfaService } from '../mfa/mfa.service';
import { RiskAssessmentService } from '../risk/risk-assessment.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let mfaService: jest.Mocked<MfaService>;
  let riskService: jest.Mocked<RiskAssessmentService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            validatePassword: jest.fn(),
            updateLastLogin: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: MfaService,
          useValue: {
            isRequired: jest.fn(),
            createChallenge: jest.fn(),
            verifyCode: jest.fn(),
          },
        },
        {
          provide: RiskAssessmentService,
          useValue: {
            assess: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    mfaService = module.get(MfaService);
    riskService = module.get(RiskAssessmentService);
  });

  describe('authenticate', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      password: 'hashed-password',
      mfaEnabled: false,
      status: 'active',
    };

    const mockContext = {
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      deviceFingerprint: 'fp-123',
      timestamp: new Date(),
    };

    it('returns success with tokens for valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      usersService.validatePassword.mockResolvedValue(true);
      riskService.assess.mockResolvedValue({ score: 20, recommendation: 'skip' });
      mfaService.isRequired.mockResolvedValue(false);
      jwtService.signAsync.mockResolvedValue('mock-token');

      const result = await service.authenticate(
        { email: 'test@example.com', password: 'password' },
        mockContext
      );

      expect(result.status).toBe('success');
      expect(result.tokens).toBeDefined();
      expect(result.user.id).toBe('user-123');
    });

    it('returns failed for invalid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      usersService.validatePassword.mockResolvedValue(false);

      const result = await service.authenticate(
        { email: 'test@example.com', password: 'wrong-password' },
        mockContext
      );

      expect(result.status).toBe('failed');
      expect(result.tokens).toBeUndefined();
    });

    it('returns mfa_required when MFA is enabled', async () => {
      usersService.findByEmail.mockResolvedValue({ ...mockUser, mfaEnabled: true });
      usersService.validatePassword.mockResolvedValue(true);
      riskService.assess.mockResolvedValue({ score: 50, recommendation: 'hard' });
      mfaService.isRequired.mockResolvedValue(true);
      mfaService.createChallenge.mockResolvedValue({
        id: 'challenge-123',
        methods: ['totp'],
      });

      const result = await service.authenticate(
        { email: 'test@example.com', password: 'password' },
        mockContext
      );

      expect(result.status).toBe('mfa_required');
      expect(result.mfaChallenge).toBeDefined();
      expect(result.mfaChallenge.methods).toContain('totp');
    });

    it('returns locked for locked accounts', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        lockedUntil: new Date(Date.now() + 3600000), // 1 hour from now
      });

      const result = await service.authenticate(
        { email: 'test@example.com', password: 'password' },
        mockContext
      );

      expect(result.status).toBe('locked');
    });

    it('increments failed attempts on invalid password', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      usersService.validatePassword.mockResolvedValue(false);

      await service.authenticate(
        { email: 'test@example.com', password: 'wrong' },
        mockContext
      );

      expect(usersService.incrementFailedAttempts).toHaveBeenCalledWith('user-123');
    });
  });
});
```

### 1.3 Metadata Services

```typescript
// apps/svc-metadata/src/app/collections/__tests__/collections.service.spec.ts

describe('CollectionsService', () => {
  describe('create', () => {
    it('creates a collection with default system properties', async () => {
      const result = await service.create({
        name: 'test_collection',
        label: 'Test Collection',
      }, 'user-123');

      // Should have system properties
      expect(result.properties).toContainEqual(
        expect.objectContaining({ name: 'id', type: 'uuid', system: true })
      );
      expect(result.properties).toContainEqual(
        expect.objectContaining({ name: 'created_at', type: 'datetime', system: true })
      );
      expect(result.properties).toContainEqual(
        expect.objectContaining({ name: 'updated_at', type: 'datetime', system: true })
      );
    });

    it('validates collection name format', async () => {
      await expect(
        service.create({ name: 'Invalid Name!', label: 'Test' }, 'user-123')
      ).rejects.toThrow('Collection name must be lowercase with underscores');
    });

    it('prevents reserved name usage', async () => {
      await expect(
        service.create({ name: 'users', label: 'Users' }, 'user-123')
      ).rejects.toThrow('Collection name "users" is reserved');
    });

    it('creates database table for collection', async () => {
      await service.create({
        name: 'test_collection',
        label: 'Test',
      }, 'user-123');

      expect(schemaService.createTable).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'test_collection' })
      );
    });

    it('notifies AVA of new collection', async () => {
      const result = await service.create({
        name: 'test_collection',
        label: 'Test',
      }, 'user-123');

      expect(avaService.learnCollection).toHaveBeenCalledWith(result);
    });
  });

  describe('addProperty', () => {
    it('validates property type', async () => {
      await expect(
        service.addProperty('collection-123', {
          name: 'test_field',
          type: 'invalid_type' as any,
        }, 'user-123')
      ).rejects.toThrow('Invalid property type');
    });

    it('adds column to database table', async () => {
      await service.addProperty('collection-123', {
        name: 'test_field',
        type: 'text',
      }, 'user-123');

      expect(schemaService.addColumn).toHaveBeenCalledWith(
        'test_collection',
        expect.objectContaining({ name: 'test_field', type: 'text' })
      );
    });

    it('creates index for indexed properties', async () => {
      await service.addProperty('collection-123', {
        name: 'indexed_field',
        type: 'text',
        indexed: true,
      }, 'user-123');

      expect(schemaService.createIndex).toHaveBeenCalled();
    });
  });
});
```

---

## 2. Integration Testing

### 2.1 API Integration Tests

```typescript
// apps/svc-identity/src/app/__tests__/auth.e2e-spec.ts

describe('Authentication API (e2e)', () => {
  let app: INestApplication;
  let testUser: User;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create test user
    testUser = await createTestUser({
      email: 'test@example.com',
      password: 'SecurePassword123!',
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  describe('POST /api/auth/login', () => {
    it('returns 200 with tokens for valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('returns 401 for invalid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('returns 429 after too many failed attempts', async () => {
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'WrongPassword',
          });
      }

      // 6th attempt should be rate limited
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
        });

      expect(response.status).toBe(429);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns new access token for valid refresh token', async () => {
      // First login to get tokens
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePassword123!',
        });

      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({
          refreshToken: loginResponse.body.refreshToken,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
    });
  });
});
```

### 2.2 Record Operations Integration Tests

```typescript
// apps/svc-data/src/app/__tests__/records.e2e-spec.ts

describe('Records API (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let testCollection: Collection;

  beforeAll(async () => {
    // Setup test collection with properties
    testCollection = await createTestCollection({
      name: 'test_records',
      properties: [
        { name: 'title', type: 'text', required: true },
        { name: 'status', type: 'choice', choices: ['new', 'active', 'closed'] },
        { name: 'priority', type: 'number' },
      ],
    });

    authToken = await getTestAuthToken();
  });

  describe('POST /api/records/:collection', () => {
    it('creates a record with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/records/${testCollection.name}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Record',
          status: 'new',
          priority: 1,
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.title).toBe('Test Record');
      expect(response.body.created_at).toBeDefined();
    });

    it('returns 400 for missing required fields', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/records/${testCollection.name}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'new',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ field: 'title', message: 'Required' })
      );
    });

    it('returns 400 for invalid choice value', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/records/${testCollection.name}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test',
          status: 'invalid_status',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].field).toBe('status');
    });
  });

  describe('GET /api/records/:collection', () => {
    beforeAll(async () => {
      // Create test records
      await createTestRecords(testCollection.name, 100);
    });

    it('returns paginated records', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/records/${testCollection.name}?page=1&limit=10`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.total).toBe(100);
      expect(response.body.totalPages).toBe(10);
    });

    it('filters records correctly', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/records/${testCollection.name}`)
        .query({
          filter: JSON.stringify({
            operator: 'and',
            conditions: [
              { field: 'status', operator: 'eq', value: 'new' },
            ],
          }),
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      response.body.data.forEach((record: any) => {
        expect(record.status).toBe('new');
      });
    });

    it('sorts records correctly', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/records/${testCollection.name}`)
        .query({
          sort: JSON.stringify([{ field: 'priority', direction: 'desc' }]),
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const priorities = response.body.data.map((r: any) => r.priority);
      expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
    });
  });

  describe('Bulk Operations', () => {
    it('creates multiple records in batch', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/records/${testCollection.name}/bulk`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          operation: 'create',
          records: [
            { title: 'Bulk 1', status: 'new' },
            { title: 'Bulk 2', status: 'active' },
            { title: 'Bulk 3', status: 'new' },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.succeeded).toBe(3);
      expect(response.body.failed).toBe(0);
    });

    it('handles partial failures in bulk create', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/records/${testCollection.name}/bulk`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          operation: 'create',
          records: [
            { title: 'Valid', status: 'new' },
            { status: 'new' }, // Missing required title
            { title: 'Also Valid', status: 'active' },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.succeeded).toBe(2);
      expect(response.body.failed).toBe(1);
      expect(response.body.results[1].error).toContain('title');
    });
  });
});
```

---

## 3. End-to-End Testing

### 3.1 Critical User Journeys

```typescript
// apps/web-client-e2e/src/login.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('successful login redirects to workspace', async ({ page }) => {
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'SecurePassword123!');
    await page.click('[data-testid=login-button]');

    await expect(page).toHaveURL('/workspace');
    await expect(page.locator('[data-testid=user-menu]')).toBeVisible();
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'WrongPassword');
    await page.click('[data-testid=login-button]');

    await expect(page.locator('[data-testid=error-message]')).toHaveText(
      'Invalid email or password'
    );
    await expect(page).toHaveURL('/login');
  });

  test('MFA flow when enabled', async ({ page }) => {
    await page.fill('[data-testid=email-input]', 'mfa-user@example.com');
    await page.fill('[data-testid=password-input]', 'SecurePassword123!');
    await page.click('[data-testid=login-button]');

    // Should show MFA challenge
    await expect(page.locator('[data-testid=mfa-challenge]')).toBeVisible();

    // Enter TOTP code
    await page.fill('[data-testid=totp-input]', '123456');
    await page.click('[data-testid=verify-button]');

    await expect(page).toHaveURL('/workspace');
  });

  test('login with SSO provider', async ({ page }) => {
    await page.click('[data-testid=sso-microsoft]');

    // Should redirect to Microsoft login
    await expect(page.url()).toContain('login.microsoftonline.com');
  });
});

// apps/web-client-e2e/src/collection-management.spec.ts

test.describe('Collection Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('create a new collection with properties', async ({ page }) => {
    await page.goto('/admin/collections');
    await page.click('[data-testid=new-collection-button]');

    // Step 1: Basic info
    await page.fill('[data-testid=collection-name]', 'customer_feedback');
    await page.fill('[data-testid=collection-label]', 'Customer Feedback');
    await page.click('[data-testid=next-button]');

    // Step 2: Properties
    await page.click('[data-testid=add-property]');
    await page.fill('[data-testid=property-name]', 'title');
    await page.selectOption('[data-testid=property-type]', 'text');
    await page.check('[data-testid=property-required]');
    await page.click('[data-testid=save-property]');

    await page.click('[data-testid=add-property]');
    await page.fill('[data-testid=property-name]', 'rating');
    await page.selectOption('[data-testid=property-type]', 'number');
    await page.click('[data-testid=save-property]');

    await page.click('[data-testid=next-button]');

    // Step 3: Views
    await page.click('[data-testid=next-button]');

    // Step 4: Review & Create
    await page.click('[data-testid=create-collection-button]');

    // Should show success and redirect
    await expect(page.locator('[data-testid=success-toast]')).toBeVisible();
    await expect(page).toHaveURL(/\/collections\/customer_feedback/);
  });

  test('modify existing collection', async ({ page }) => {
    await page.goto('/collections/customer_feedback/settings');

    // Add a new property
    await page.click('[data-testid=add-property]');
    await page.fill('[data-testid=property-name]', 'status');
    await page.selectOption('[data-testid=property-type]', 'choice');
    await page.click('[data-testid=add-choice]');
    await page.fill('[data-testid=choice-value-0]', 'New');
    await page.click('[data-testid=add-choice]');
    await page.fill('[data-testid=choice-value-1]', 'Reviewed');
    await page.click('[data-testid=save-property]');

    await expect(page.locator('[data-testid=success-toast]')).toBeVisible();
  });
});

// apps/web-client-e2e/src/record-operations.spec.ts

test.describe('Record Operations', () => {
  test('create, edit, and delete a record', async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/collections/customer_feedback');

    // Create
    await page.click('[data-testid=new-record-button]');
    await page.fill('[data-testid=field-title]', 'Great product!');
    await page.fill('[data-testid=field-rating]', '5');
    await page.selectOption('[data-testid=field-status]', 'New');
    await page.click('[data-testid=save-button]');

    await expect(page.locator('[data-testid=success-toast]')).toHaveText(
      /Record created/
    );

    // Verify in list
    await expect(page.locator('text=Great product!')).toBeVisible();

    // Edit
    await page.click('text=Great product!');
    await page.click('[data-testid=edit-button]');
    await page.fill('[data-testid=field-title]', 'Updated feedback');
    await page.click('[data-testid=save-button]');

    await expect(page.locator('[data-testid=success-toast]')).toHaveText(
      /Record updated/
    );

    // Delete
    await page.click('[data-testid=delete-button]');
    await page.click('[data-testid=confirm-delete]');

    await expect(page.locator('text=Updated feedback')).not.toBeVisible();
  });

  test('bulk select and delete records', async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/collections/customer_feedback');

    // Select multiple records
    await page.click('[data-testid=row-checkbox-0]');
    await page.click('[data-testid=row-checkbox-1]');
    await page.click('[data-testid=row-checkbox-2]');

    // Bulk delete
    await page.click('[data-testid=bulk-delete-button]');
    await page.click('[data-testid=confirm-delete]');

    await expect(page.locator('[data-testid=success-toast]')).toHaveText(
      /3 records deleted/
    );
  });
});
```

---

## 4. Accessibility Testing

### 4.1 Automated Accessibility Tests

```typescript
// apps/web-client-e2e/src/accessibility.spec.ts

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('login page has no accessibility violations', async ({ page }) => {
    await page.goto('/login');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('workspace has no accessibility violations', async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/workspace');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('data table is keyboard navigable', async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/collections/incidents');

    // Tab to first row
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveAttribute('data-testid', /row/);

    // Arrow down to next row
    await page.keyboard.press('ArrowDown');
    const newFocused = page.locator(':focus');
    await expect(newFocused).toHaveAttribute('data-row-index', '1');
  });

  test('focus is trapped in modal', async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/collections/incidents');
    await page.click('[data-testid=new-record-button]');

    // Tab through all focusable elements
    const firstFocusable = page.locator('[data-testid=modal] :focus-visible').first();
    await expect(firstFocusable).toBeVisible();

    // Tab to the end and back to start
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
    }

    // Focus should still be in modal
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    const isInModal = await focusedElement.evaluate(
      (el) => el.closest('[data-testid=modal]') !== null
    );
    expect(isInModal).toBe(true);
  });
});
```

---

## 5. Performance Testing

### 5.1 Performance Benchmarks

```typescript
// apps/web-client-e2e/src/performance.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Performance', () => {
  test('login page loads within 1.5 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(1500);
  });

  test('collection list with 1000 records loads within 2 seconds', async ({ page }) => {
    await loginAsUser(page);

    const startTime = Date.now();
    await page.goto('/collections/large_collection');
    await page.waitForSelector('[data-testid=data-table]');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(2000);
  });

  test('virtual scrolling handles 10000 records smoothly', async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/collections/large_collection');

    // Scroll to bottom
    const table = page.locator('[data-testid=data-table]');
    await table.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    // Check FPS during scroll
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        let frameCount = 0;
        const startTime = performance.now();

        function countFrame() {
          frameCount++;
          if (performance.now() - startTime < 1000) {
            requestAnimationFrame(countFrame);
          } else {
            resolve({ fps: frameCount });
          }
        }
        requestAnimationFrame(countFrame);
      });
    });

    expect(metrics.fps).toBeGreaterThan(30);
  });

  test('Core Web Vitals meet targets', async ({ page }) => {
    await page.goto('/workspace');

    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lcp = entries.find((e) => e.entryType === 'largest-contentful-paint');
          const cls = entries.find((e) => e.entryType === 'layout-shift');

          resolve({
            lcp: lcp?.startTime,
            cls: cls?.value,
          });
        }).observe({ entryTypes: ['largest-contentful-paint', 'layout-shift'] });
      });
    });

    expect(metrics.lcp).toBeLessThan(2500); // LCP < 2.5s
    expect(metrics.cls).toBeLessThan(0.1); // CLS < 0.1
  });
});
```

---

## 6. Test Data Management

```typescript
// apps/web-client-e2e/src/support/test-data.ts

export class TestDataFactory {
  async createTestUser(overrides: Partial<User> = {}): Promise<User> {
    return this.api.post('/api/test/users', {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      role: 'user',
      ...overrides,
    });
  }

  async createTestCollection(name: string, properties: PropertyDef[]): Promise<Collection> {
    return this.api.post('/api/test/collections', {
      name,
      properties,
    });
  }

  async createTestRecords(collectionName: string, count: number): Promise<void> {
    const records = Array.from({ length: count }, (_, i) => ({
      title: `Test Record ${i + 1}`,
      status: ['new', 'active', 'closed'][i % 3],
      priority: (i % 5) + 1,
    }));

    await this.api.post(`/api/test/records/${collectionName}/bulk`, { records });
  }

  async cleanup(): Promise<void> {
    await this.api.post('/api/test/cleanup');
  }
}
```
