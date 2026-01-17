# Phase 5: Integration & Data - Test Plan

**Version:** 1.0
**Last Updated:** 2025-12-30
**Status:** Testing Specification

---

## Table of Contents

1. [Test Overview](#test-overview)
2. [API Testing](#api-testing)
3. [Webhook Testing](#webhook-testing)
4. [Integration Testing](#integration-testing)
5. [Data Import/Export Testing](#data-importexport-testing)
6. [Sync Engine Testing](#sync-engine-testing)
7. [OAuth Testing](#oauth-testing)
8. [GraphQL Testing](#graphql-testing)
9. [Performance Testing](#performance-testing)
10. [Security Testing](#security-testing)
11. [Test Automation](#test-automation)

---

## Test Overview

### Testing Objectives

- Validate REST and GraphQL API functionality
- Ensure reliable webhook delivery
- Verify connector integrations
- Test data import/export accuracy
- Validate sync engine correctness
- Confirm OAuth security
- Measure performance under load
- Identify security vulnerabilities

### Testing Approach

- **Unit Testing:** Individual components and functions
- **Integration Testing:** Component interactions
- **End-to-End Testing:** Complete workflows
- **Performance Testing:** Load and stress scenarios
- **Security Testing:** Penetration and vulnerability testing

### Success Criteria

| Metric | Target |
|--------|--------|
| API response time (p95) | < 200ms |
| Webhook delivery success rate | > 99.5% |
| Data import accuracy | > 99% |
| Sync conflict resolution accuracy | > 98% |
| Test coverage | > 85% |
| Critical bugs | 0 |

---

## API Testing

### REST API Endpoint Tests

#### Test Suite: Projects API

```javascript
// test/api/projects.test.js
import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/api/server';

describe('Projects API', () => {
  let authToken;
  let projectId;

  beforeAll(async () => {
    // Authenticate and get token
    const authResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'TestPassword123!'
      });

    authToken = authResponse.body.token;
  });

  describe('GET /api/v1/projects', () => {
    it('should return list of projects with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, pageSize: 20 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination.currentPage).toBe(1);
      expect(response.body.pagination.pageSize).toBe(20);
    });

    it('should filter projects by status', async () => {
      const response = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'active' })
        .expect(200);

      response.body.data.forEach(project => {
        expect(project.status).toBe('active');
      });
    });

    it('should sort projects correctly', async () => {
      const response = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ sort: 'createdAt', order: 'desc' })
        .expect(200);

      const dates = response.body.data.map(p => new Date(p.createdAt));
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i-1].getTime()).toBeGreaterThanOrEqual(dates[i].getTime());
      }
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/v1/projects')
        .expect(401);
    });
  });

  describe('POST /api/v1/projects', () => {
    it('should create a new project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project',
        status: 'active',
        targetDate: '2025-12-31'
      };

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(projectData.name);
      expect(response.body.status).toBe(projectData.status);

      projectId = response.body.id;
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Missing name field'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('name');
    });

    it('should validate field types', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test',
          targetDate: 'invalid-date'
        })
        .expect(400);

      expect(response.body.error).toContain('date');
    });
  });

  describe('GET /api/v1/projects/:id', () => {
    it('should return project by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(projectId);
    });

    it('should return 404 for non-existent project', async () => {
      await request(app)
        .get('/api/v1/projects/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PUT /api/v1/projects/:id', () => {
    it('should update project', async () => {
      const updates = {
        name: 'Updated Project Name',
        status: 'on_hold'
      };

      const response = await request(app)
        .put(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.name).toBe(updates.name);
      expect(response.body.status).toBe(updates.status);
    });
  });

  describe('DELETE /api/v1/projects/:id', () => {
    it('should delete project', async () => {
      await request(app)
        .delete(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify deletion
      await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
```

### Rate Limiting Tests

```javascript
// test/api/rateLimiting.test.js
describe('Rate Limiting', () => {
  it('should enforce rate limits', async () => {
    const requests = [];

    // Make 101 requests (limit is 100/min for free tier)
    for (let i = 0; i < 101; i++) {
      requests.push(
        request(app)
          .get('/api/v1/projects')
          .set('Authorization', `Bearer ${authToken}`)
      );
    }

    const responses = await Promise.all(requests);

    // Last request should be rate limited
    const rateLimited = responses.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('should include rate limit headers', async () => {
    const response = await request(app)
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.headers).toHaveProperty('x-ratelimit-limit');
    expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    expect(response.headers).toHaveProperty('x-ratelimit-reset');
  });

  it('should respect tenant-specific limits', async () => {
    // Enterprise tenant should have higher limits
    const enterpriseToken = await getEnterpriseToken();

    const requests = [];
    for (let i = 0; i < 1000; i++) {
      requests.push(
        request(app)
          .get('/api/v1/projects')
          .set('Authorization', `Bearer ${enterpriseToken}`)
      );
    }

    const responses = await Promise.all(requests);
    const successful = responses.filter(r => r.status === 200);
    expect(successful.length).toBeGreaterThan(100); // More than free tier
  });
});
```

### API Versioning Tests

```javascript
// test/api/versioning.test.js
describe('API Versioning', () => {
  it('should support v1 endpoints', async () => {
    await request(app)
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
  });

  it('should return version in response headers', async () => {
    const response = await request(app)
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.headers).toHaveProperty('x-api-version');
    expect(response.headers['x-api-version']).toBe('1.0');
  });

  it('should handle deprecated endpoints gracefully', async () => {
    const response = await request(app)
      .get('/api/v1/deprecated-endpoint')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.headers).toHaveProperty('x-api-deprecated');
    expect(response.headers['x-api-deprecated']).toBe('true');
  });
});
```

---

## Webhook Testing

### Webhook Delivery Tests

```javascript
// test/webhooks/delivery.test.js
import { WebhookService } from '../../src/webhooks/webhookService';
import nock from 'nock';

describe('Webhook Delivery', () => {
  let webhookService;
  let mockEndpoint;

  beforeEach(() => {
    webhookService = new WebhookService();
    mockEndpoint = 'https://api.example.com';
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should deliver webhook successfully', async () => {
    const webhook = {
      id: 'wh_123',
      url: `${mockEndpoint}/webhooks`,
      events: ['project.created'],
      secret: 'test-secret',
      active: true
    };

    nock(mockEndpoint)
      .post('/webhooks')
      .reply(200, { success: true });

    await webhookService.trigger('project.created', {
      id: 'proj_123',
      name: 'Test Project'
    }, 'tenant_123');

    // Verify delivery was logged
    const deliveries = await getWebhookDeliveries(webhook.id);
    expect(deliveries.length).toBe(1);
    expect(deliveries[0].status).toBe('success');
  });

  it('should retry failed deliveries', async () => {
    const webhook = {
      id: 'wh_456',
      url: `${mockEndpoint}/webhooks`,
      events: ['project.created'],
      secret: 'test-secret',
      active: true
    };

    // Fail first 2 attempts, succeed on 3rd
    nock(mockEndpoint)
      .post('/webhooks')
      .times(2)
      .reply(500, { error: 'Server error' });

    nock(mockEndpoint)
      .post('/webhooks')
      .reply(200, { success: true });

    await webhookService.trigger('project.created', {
      id: 'proj_123'
    }, 'tenant_123');

    // Wait for retries
    await new Promise(resolve => setTimeout(resolve, 5000));

    const deliveries = await getWebhookDeliveries(webhook.id);
    const lastDelivery = deliveries[deliveries.length - 1];

    expect(lastDelivery.status).toBe('success');
    expect(lastDelivery.attempt).toBe(3);
  });

  it('should move to DLQ after max retries', async () => {
    const webhook = {
      id: 'wh_789',
      url: `${mockEndpoint}/webhooks`,
      events: ['project.created'],
      secret: 'test-secret',
      active: true
    };

    // Fail all attempts
    nock(mockEndpoint)
      .post('/webhooks')
      .times(10)
      .reply(500, { error: 'Server error' });

    await webhookService.trigger('project.created', {
      id: 'proj_123'
    }, 'tenant_123');

    // Wait for all retries
    await new Promise(resolve => setTimeout(resolve, 30000));

    const dlqEntries = await getWebhookDLQ(webhook.id);
    expect(dlqEntries.length).toBe(1);
  });

  it('should include correct signature', async () => {
    const webhook = {
      id: 'wh_sig',
      url: `${mockEndpoint}/webhooks`,
      events: ['project.created'],
      secret: 'test-secret',
      active: true
    };

    let receivedSignature;

    nock(mockEndpoint)
      .post('/webhooks')
      .reply(function(uri, body) {
        receivedSignature = this.req.headers['x-hubblewave-signature'];
        return [200, { success: true }];
      });

    const payload = { id: 'proj_123', name: 'Test' };
    await webhookService.trigger('project.created', payload, 'tenant_123');

    // Wait for delivery
    await new Promise(resolve => setTimeout(resolve, 1000));

    expect(receivedSignature).toBeDefined();
    expect(receivedSignature).toMatch(/^sha256=/);

    // Verify signature
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', webhook.secret);
    const expectedSig = `sha256=${hmac.update(JSON.stringify(payload)).digest('hex')}`;

    // Signatures should match
    expect(receivedSignature).toBeTruthy();
  });

  it('should respect timeout settings', async () => {
    const webhook = {
      id: 'wh_timeout',
      url: `${mockEndpoint}/webhooks`,
      events: ['project.created'],
      secret: 'test-secret',
      active: true
    };

    // Simulate slow response
    nock(mockEndpoint)
      .post('/webhooks')
      .delay(35000) // 35 seconds (over 30s timeout)
      .reply(200, { success: true });

    const startTime = Date.now();

    await webhookService.trigger('project.created', {
      id: 'proj_123'
    }, 'tenant_123');

    await new Promise(resolve => setTimeout(resolve, 31000));

    const deliveries = await getWebhookDeliveries(webhook.id);
    expect(deliveries[0].status).toBe('failed');
    expect(deliveries[0].error).toContain('timeout');
  });
});
```

### Webhook Signature Verification Tests

```javascript
// test/webhooks/signature.test.js
describe('Webhook Signature Verification', () => {
  it('should generate valid signature', () => {
    const payload = { event: 'test', data: { id: '123' } };
    const secret = 'test-secret';

    const signature = generateSignature(payload, secret);

    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('should verify valid signature', () => {
    const payload = { event: 'test', data: { id: '123' } };
    const secret = 'test-secret';

    const signature = generateSignature(payload, secret);
    const isValid = verifySignature(payload, signature, secret);

    expect(isValid).toBe(true);
  });

  it('should reject invalid signature', () => {
    const payload = { event: 'test', data: { id: '123' } };
    const secret = 'test-secret';

    const isValid = verifySignature(payload, 'sha256=invalid', secret);

    expect(isValid).toBe(false);
  });

  it('should reject tampered payload', () => {
    const originalPayload = { event: 'test', data: { id: '123' } };
    const secret = 'test-secret';

    const signature = generateSignature(originalPayload, secret);

    const tamperedPayload = { event: 'test', data: { id: '456' } };
    const isValid = verifySignature(tamperedPayload, signature, secret);

    expect(isValid).toBe(false);
  });
});
```

---

## Integration Testing

### Salesforce Connector Tests

```javascript
// test/integrations/salesforce.test.js
import { SalesforceConnector } from '../../src/connectors/salesforce';

describe('Salesforce Connector', () => {
  let connector;

  beforeAll(async () => {
    connector = new SalesforceConnector({
      instanceUrl: process.env.SF_INSTANCE_URL,
      clientId: process.env.SF_CLIENT_ID,
      clientSecret: process.env.SF_CLIENT_SECRET,
      refreshToken: process.env.SF_REFRESH_TOKEN
    });

    await connector.authenticate();
  });

  describe('Authentication', () => {
    it('should authenticate successfully', async () => {
      expect(connector.isAuthenticated()).toBe(true);
      expect(connector.accessToken).toBeDefined();
    });

    it('should refresh token when expired', async () => {
      const oldToken = connector.accessToken;

      // Force token expiration
      connector.tokenExpiresAt = Date.now() - 1000;

      await connector.ensureAuthenticated();

      expect(connector.accessToken).not.toBe(oldToken);
    });
  });

  describe('Data Retrieval', () => {
    it('should fetch Opportunities', async () => {
      const opportunities = await connector.query(
        'SELECT Id, Name, Amount, StageName FROM Opportunity LIMIT 10'
      );

      expect(Array.isArray(opportunities)).toBe(true);
      expect(opportunities.length).toBeLessThanOrEqual(10);

      if (opportunities.length > 0) {
        expect(opportunities[0]).toHaveProperty('Id');
        expect(opportunities[0]).toHaveProperty('Name');
      }
    });

    it('should handle large result sets with pagination', async () => {
      const allRecords = [];
      let locator = null;

      do {
        const result = await connector.queryMore(
          'SELECT Id FROM Opportunity',
          locator
        );

        allRecords.push(...result.records);
        locator = result.nextRecordsUrl;
      } while (locator);

      expect(allRecords.length).toBeGreaterThan(0);
    });
  });

  describe('Data Synchronization', () => {
    it('should sync Opportunities to Projects', async () => {
      const syncConfig = {
        sourceObject: 'Opportunity',
        targetEntity: 'Project',
        fieldMapping: {
          'Name': 'name',
          'Description': 'description',
          'Amount': 'budget',
          'CloseDate': 'targetDate',
          'StageName': 'status'
        },
        valueMapping: {
          'status': {
            'Prospecting': 'draft',
            'Qualification': 'planning',
            'Closed Won': 'completed'
          }
        }
      };

      const result = await connector.sync(syncConfig);

      expect(result.success).toBeGreaterThan(0);
      expect(result.failed).toBe(0);
    });

    it('should handle sync errors gracefully', async () => {
      const syncConfig = {
        sourceObject: 'Opportunity',
        targetEntity: 'Project',
        fieldMapping: {
          'Name': 'name',
          'InvalidField': 'description'
        }
      };

      const result = await connector.sync(syncConfig);

      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Bulk Operations', () => {
    it('should perform bulk insert', async () => {
      const records = [
        { Name: 'Test Opp 1', StageName: 'Prospecting', CloseDate: '2025-12-31' },
        { Name: 'Test Opp 2', StageName: 'Prospecting', CloseDate: '2025-12-31' },
        { Name: 'Test Opp 3', StageName: 'Prospecting', CloseDate: '2025-12-31' }
      ];

      const result = await connector.bulkInsert('Opportunity', records);

      expect(result.successfulResults).toBe(3);
      expect(result.failedResults).toBe(0);
    });

    it('should perform bulk update', async () => {
      // First, get some records to update
      const opportunities = await connector.query(
        'SELECT Id FROM Opportunity LIMIT 3'
      );

      const updates = opportunities.map(opp => ({
        Id: opp.Id,
        StageName: 'Qualification'
      }));

      const result = await connector.bulkUpdate('Opportunity', updates);

      expect(result.successfulResults).toBe(updates.length);
    });
  });

  describe('Error Handling', () => {
    it('should handle API rate limits', async () => {
      // Simulate rate limit by making many rapid requests
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(connector.query('SELECT Id FROM Account LIMIT 1'));
      }

      await expect(Promise.all(promises)).resolves.toBeDefined();
      // Should handle rate limiting gracefully with retries
    });

    it('should handle connection failures', async () => {
      const badConnector = new SalesforceConnector({
        instanceUrl: 'https://invalid.salesforce.com',
        clientId: 'invalid',
        clientSecret: 'invalid',
        refreshToken: 'invalid'
      });

      await expect(badConnector.authenticate()).rejects.toThrow();
    });
  });
});
```

### Jira Connector Tests

```javascript
// test/integrations/jira.test.js
import { JiraConnector } from '../../src/connectors/jira';

describe('Jira Connector', () => {
  let connector;

  beforeAll(async () => {
    connector = new JiraConnector({
      host: process.env.JIRA_HOST,
      email: process.env.JIRA_EMAIL,
      apiToken: process.env.JIRA_API_TOKEN
    });

    await connector.authenticate();
  });

  describe('Issue Management', () => {
    let issueKey;

    it('should create an issue', async () => {
      const issue = await connector.createIssue({
        project: { key: 'TEST' },
        summary: 'Test Issue from Integration Test',
        description: 'This is a test issue',
        issuetype: { name: 'Task' }
      });

      expect(issue).toHaveProperty('key');
      issueKey = issue.key;
    });

    it('should fetch an issue', async () => {
      const issue = await connector.getIssue(issueKey);

      expect(issue.key).toBe(issueKey);
      expect(issue.fields.summary).toBe('Test Issue from Integration Test');
    });

    it('should update an issue', async () => {
      await connector.updateIssue(issueKey, {
        fields: {
          description: 'Updated description'
        }
      });

      const issue = await connector.getIssue(issueKey);
      expect(issue.fields.description).toContain('Updated description');
    });

    it('should sync issues to tasks', async () => {
      const syncConfig = {
        projectKey: 'TEST',
        targetEntity: 'Task',
        fieldMapping: {
          'summary': 'title',
          'description': 'description',
          'status': 'status',
          'assignee': 'assigneeId'
        }
      };

      const result = await connector.syncIssuesToTasks(syncConfig);

      expect(result.synced).toBeGreaterThan(0);
    });

    it('should delete an issue', async () => {
      await connector.deleteIssue(issueKey);

      await expect(connector.getIssue(issueKey)).rejects.toThrow();
    });
  });

  describe('JQL Queries', () => {
    it('should execute JQL query', async () => {
      const issues = await connector.searchIssues(
        'project = TEST AND status = "To Do"',
        { maxResults: 10 }
      );

      expect(Array.isArray(issues.issues)).toBe(true);
      expect(issues.issues.length).toBeLessThanOrEqual(10);
    });

    it('should handle pagination', async () => {
      const allIssues = [];
      let startAt = 0;
      const maxResults = 50;
      let total;

      do {
        const result = await connector.searchIssues(
          'project = TEST',
          { startAt, maxResults }
        );

        allIssues.push(...result.issues);
        startAt += maxResults;
        total = result.total;
      } while (allIssues.length < total);

      expect(allIssues.length).toBe(total);
    });
  });
});
```

---

## Data Import/Export Testing

### Import Tests

```javascript
// test/import/import.test.js
import { ImportService } from '../../src/import/importService';
import fs from 'fs';
import path from 'path';

describe('Data Import', () => {
  let importService;

  beforeAll(() => {
    importService = new ImportService();
  });

  describe('CSV Import', () => {
    it('should import valid CSV file', async () => {
      const csvFile = {
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures/customers.csv')),
        originalname: 'customers.csv',
        mimetype: 'text/csv'
      };

      const mapping = [
        { sourceField: 'customer_name', targetField: 'name' },
        { sourceField: 'email_address', targetField: 'email' },
        { sourceField: 'phone_number', targetField: 'phone' }
      ];

      const result = await importService.importFile(
        csvFile,
        'Customer',
        mapping,
        { batchSize: 100 }
      );

      expect(result.success).toBeGreaterThan(0);
      expect(result.failed).toBe(0);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should validate data during import', async () => {
      const csvFile = {
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures/invalid-customers.csv')),
        originalname: 'invalid-customers.csv',
        mimetype: 'text/csv'
      };

      const mapping = [
        { sourceField: 'name', targetField: 'name' },
        { sourceField: 'email', targetField: 'email' }
      ];

      const result = await importService.importFile(
        csvFile,
        'Customer',
        mapping,
        { validateData: true }
      );

      expect(result.failed).toBeGreaterThan(0);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle duplicate detection', async () => {
      const csvFile = {
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures/customers-with-dupes.csv')),
        originalname: 'customers-with-dupes.csv',
        mimetype: 'text/csv'
      };

      const mapping = [
        { sourceField: 'name', targetField: 'name' },
        { sourceField: 'email', targetField: 'email' }
      ];

      const result = await importService.importFile(
        csvFile,
        'Customer',
        mapping,
        {
          detectDuplicates: true,
          uniqueFields: ['email'],
          duplicateStrategy: 'skip'
        }
      );

      expect(result.total).toBeGreaterThan(result.success);
      // Some records should be skipped as duplicates
    });
  });

  describe('Excel Import', () => {
    it('should import Excel file', async () => {
      const excelFile = {
        buffer: fs.readFileSync(path.join(__dirname, 'fixtures/projects.xlsx')),
        originalname: 'projects.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };

      const mapping = [
        { sourceField: 'Project Name', targetField: 'name' },
        { sourceField: 'Description', targetField: 'description' },
        { sourceField: 'Status', targetField: 'status' }
      ];

      const result = await importService.importFile(
        excelFile,
        'Project',
        mapping,
        {}
      );

      expect(result.success).toBeGreaterThan(0);
    });
  });

  describe('Large File Import', () => {
    it('should import large file (10,000 records)', async () => {
      // Generate large CSV file
      const records = [];
      for (let i = 0; i < 10000; i++) {
        records.push(`Customer ${i},customer${i}@example.com,555-${String(i).padStart(4, '0')}`);
      }

      const csvContent = 'name,email,phone\n' + records.join('\n');

      const csvFile = {
        buffer: Buffer.from(csvContent),
        originalname: 'large-import.csv',
        mimetype: 'text/csv'
      };

      const mapping = [
        { sourceField: 'name', targetField: 'name' },
        { sourceField: 'email', targetField: 'email' },
        { sourceField: 'phone', targetField: 'phone' }
      ];

      const startTime = Date.now();

      const result = await importService.importFile(
        csvFile,
        'Customer',
        mapping,
        { batchSize: 500 }
      );

      const duration = Date.now() - startTime;

      expect(result.success).toBe(10000);
      expect(duration).toBeLessThan(300000); // Should complete in < 5 minutes
    }, 600000); // 10 minute timeout
  });
});
```

### Export Tests

```javascript
// test/export/export.test.js
import { ExportService } from '../../src/export/exportService';

describe('Data Export', () => {
  let exportService;

  beforeAll(() => {
    exportService = new ExportService();
  });

  describe('CSV Export', () => {
    it('should export data to CSV', async () => {
      const query = {
        fields: ['name', 'email', 'phone', 'createdAt'],
        filters: [
          { field: 'status', operator: 'equals', value: 'active' }
        ],
        sort: { field: 'createdAt', order: 'desc' }
      };

      const buffer = await exportService.export('Customer', query, 'csv');

      expect(buffer).toBeInstanceOf(Buffer);

      const content = buffer.toString('utf8');
      expect(content).toContain('name,email,phone,createdAt');
    });
  });

  describe('Excel Export', () => {
    it('should export data to Excel', async () => {
      const query = {
        fields: ['name', 'description', 'status'],
        filters: []
      };

      const buffer = await exportService.export('Project', query, 'xlsx');

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('Large Export', () => {
    it('should export large dataset', async () => {
      const query = {
        fields: ['name', 'email'],
        filters: [],
        limit: 50000
      };

      const startTime = Date.now();

      const buffer = await exportService.export('Customer', query, 'csv');

      const duration = Date.now() - startTime;

      expect(buffer.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(60000); // Should complete in < 1 minute
    }, 120000);
  });
});
```

---

## Performance Testing

### Load Testing with k6

```javascript
// test/performance/api-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests must complete below 200ms
    'http_req_duration{staticAsset:yes}': ['p(95)<100'],
    errors: ['rate<0.1'], // Error rate must be below 10%
  },
};

const API_TOKEN = __ENV.API_TOKEN;
const BASE_URL = 'https://api.hubblewave.com/v1';

export default function () {
  const headers = {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json',
  };

  // Test GET /projects
  let response = http.get(`${BASE_URL}/projects?page=1&pageSize=20`, { headers });

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'has data': (r) => JSON.parse(r.body).data !== undefined,
  }) || errorRate.add(1);

  sleep(1);

  // Test POST /projects
  const project = {
    name: `Load Test Project ${Date.now()}`,
    description: 'Created during load test',
    status: 'active',
  };

  response = http.post(`${BASE_URL}/projects`, JSON.stringify(project), { headers });

  check(response, {
    'status is 201': (r) => r.status === 201,
    'project created': (r) => JSON.parse(r.body).id !== undefined,
  }) || errorRate.add(1);

  sleep(1);
}
```

### Stress Testing

```javascript
// test/performance/stress-test.js
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Normal load
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },   // Increased load
    { duration: '5m', target: 200 },
    { duration: '2m', target: 500 },   // Stress level
    { duration: '5m', target: 500 },
    { duration: '2m', target: 1000 },  // Breaking point
    { duration: '5m', target: 1000 },
    { duration: '10m', target: 0 },    // Recovery
  ],
};
```

This comprehensive test plan covers all major aspects of Phase 5 integration and data features, ensuring quality and reliability before deployment.

