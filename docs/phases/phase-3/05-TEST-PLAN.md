# Phase 3: Test Plan

**Document Type:** Quality Assurance Specification
**Audience:** QA Engineers, Developers
**Status:** Planning Phase

## Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Unit Testing](#unit-testing)
3. [Integration Testing](#integration-testing)
4. [Performance Testing](#performance-testing)
5. [Security Testing](#security-testing)
6. [User Acceptance Testing](#user-acceptance-testing)
7. [Test Automation](#test-automation)
8. [Test Data Management](#test-data-management)

---

## Testing Strategy

### Testing Pyramid

```
                    ▲
                   ╱ ╲
                  ╱   ╲
                 ╱ E2E ╲         10% - End-to-End Tests
                ╱───────╲
               ╱         ╲
              ╱Integration╲      30% - Integration Tests
             ╱─────────────╲
            ╱               ╲
           ╱  Unit Tests     ╲   60% - Unit Tests
          ╱___________________╲
```

### Test Coverage Goals

- **Unit Tests**: 85% code coverage
- **Integration Tests**: All API endpoints and services
- **Performance Tests**: All critical paths under load
- **Security Tests**: All user inputs and data access points
- **E2E Tests**: All major user workflows

### Test Environments

1. **Local Development**: Individual developer testing
2. **CI/CD**: Automated tests on every commit
3. **Staging**: Pre-production testing with production-like data
4. **Production**: Smoke tests and monitoring

---

## Unit Testing

### Business Rules Engine

#### Test Suite: Rule Evaluation

```typescript
describe('RuleEvaluator', () => {
    describe('evaluateCondition', () => {
        it('should evaluate equals operator correctly', async () => {
            const condition: Condition = {
                property: 'priority',
                operator: 'equals',
                value: 'Critical',
                valueType: 'static',
            };

            const record = { priority: 'Critical' };
            const result = await evaluator.evaluateCondition(condition, record);

            expect(result).toBe(true);
        });

        it('should evaluate not_equals operator correctly', async () => {
            const condition: Condition = {
                property: 'priority',
                operator: 'not_equals',
                value: 'Critical',
                valueType: 'static',
            };

            const record = { priority: 'Low' };
            const result = await evaluator.evaluateCondition(condition, record);

            expect(result).toBe(true);
        });

        it('should evaluate is_empty operator correctly', async () => {
            const condition: Condition = {
                property: 'assignment_group',
                operator: 'is_empty',
                value: null,
                valueType: 'static',
            };

            const record = { assignment_group: null };
            const result = await evaluator.evaluateCondition(condition, record);

            expect(result).toBe(true);
        });

        it('should evaluate changed operator with old record', async () => {
            const condition: Condition = {
                property: 'priority',
                operator: 'changed',
                value: null,
                valueType: 'static',
            };

            const record = { priority: 'Critical' };
            const oldRecord = { priority: 'Low' };
            const result = await evaluator.evaluateCondition(condition, record, oldRecord);

            expect(result).toBe(true);
        });

        it('should handle nested property access', async () => {
            const condition: Condition = {
                property: 'user.department.name',
                operator: 'equals',
                value: 'Engineering',
                valueType: 'static',
            };

            const record = {
                user: {
                    department: {
                        name: 'Engineering',
                    },
                },
            };

            const result = await evaluator.evaluateCondition(condition, record);
            expect(result).toBe(true);
        });
    });

    describe('evaluateConditionGroup', () => {
        it('should evaluate AND operator correctly', async () => {
            const group: ConditionGroup = {
                operator: 'AND',
                conditions: [
                    { property: 'priority', operator: 'equals', value: 'Critical', valueType: 'static' },
                    { property: 'assignment_group', operator: 'is_empty', value: null, valueType: 'static' },
                ],
            };

            const record = { priority: 'Critical', assignment_group: null };
            const result = await evaluator.evaluateConditionGroup(group, record);

            expect(result).toBe(true);
        });

        it('should evaluate OR operator correctly', async () => {
            const group: ConditionGroup = {
                operator: 'OR',
                conditions: [
                    { property: 'priority', operator: 'equals', value: 'Critical', valueType: 'static' },
                    { property: 'priority', operator: 'equals', value: 'High', valueType: 'static' },
                ],
            };

            const record = { priority: 'High' };
            const result = await evaluator.evaluateConditionGroup(group, record);

            expect(result).toBe(true);
        });

        it('should handle empty condition group as true', async () => {
            const group: ConditionGroup = {
                operator: 'AND',
                conditions: [],
            };

            const record = { priority: 'Low' };
            const result = await evaluator.evaluateConditionGroup(group, record);

            expect(result).toBe(true);
        });
    });

    describe('evaluate (full conditions)', () => {
        it('should evaluate complex nested conditions', async () => {
            const conditions: TriggerConditions = {
                operator: 'OR',
                conditionGroups: [
                    {
                        operator: 'AND',
                        conditions: [
                            { property: 'priority', operator: 'equals', value: 'Critical', valueType: 'static' },
                            { property: 'assignment_group', operator: 'is_empty', value: null, valueType: 'static' },
                        ],
                    },
                    {
                        operator: 'AND',
                        conditions: [
                            { property: 'status', operator: 'changed_to', value: 'Resolved', valueType: 'static' },
                            { property: 'resolution_notes', operator: 'is_empty', value: null, valueType: 'static' },
                        ],
                    },
                ],
            };

            const record = { priority: 'Critical', assignment_group: null, status: 'New' };
            const result = await evaluator.evaluate({ conditions, record });

            expect(result).toBe(true);
        });
    });
});
```

#### Test Suite: Action Execution

```typescript
describe('ActionExecutor', () => {
    describe('executeSetProperty', () => {
        it('should set property value correctly', async () => {
            const action: SetPropertyAction = {
                type: 'set_property',
                config: {
                    property: 'assignment_group',
                    valueType: 'static',
                    value: 'Network Operations',
                },
                order: 1,
                stopOnError: false,
            };

            const record = { priority: 'Critical' };
            const result = await executor.executeSetProperty(action, record);

            expect(result.recordChanges).toEqual({
                assignment_group: 'Network Operations',
            });
        });

        it('should resolve property value from another property', async () => {
            const action: SetPropertyAction = {
                type: 'set_property',
                config: {
                    property: 'assigned_to',
                    valueType: 'property',
                    value: 'created_by',
                },
                order: 1,
                stopOnError: false,
            };

            const record = { created_by: 'user123' };
            const result = await executor.executeSetProperty(action, record);

            expect(result.recordChanges).toEqual({
                assigned_to: 'user123',
            });
        });
    });

    describe('executeCreateRecord', () => {
        it('should create related record with link', async () => {
            const action: CreateRecordAction = {
                type: 'create_record',
                config: {
                    collection: 'tasks',
                    propertyValues: {
                        subject: { value: 'Review Critical Incident', valueType: 'static' },
                        description: { value: 'Review and escalate', valueType: 'static' },
                    },
                    linkToCurrentRecord: {
                        referenceProperty: 'incident_id',
                    },
                },
                order: 1,
                stopOnError: false,
            };

            const record = { id: 'inc123', priority: 'Critical' };
            const result = await executor.executeCreateRecord(action, record, 'user123');

            expect(result.data).toMatchObject({
                subject: 'Review Critical Incident',
                incident_id: 'inc123',
            });
        });
    });

    describe('executeSendNotification', () => {
        it('should send email notification', async () => {
            const action: SendNotificationAction = {
                type: 'send_notification',
                config: {
                    notificationType: 'email',
                    recipients: {
                        type: 'property',
                        value: 'assigned_to',
                    },
                    subject: 'Incident Assigned',
                    body: 'You have been assigned incident [Number]',
                },
                order: 1,
                stopOnError: false,
            };

            const record = { number: 'INC0012345', assigned_to: 'user123' };
            const result = await executor.executeSendNotification(action, record);

            expect(result.data).toMatchObject({
                sent: true,
                recipient: 'user123',
            });
        });
    });

    describe('executeActions', () => {
        it('should execute multiple actions in order', async () => {
            const actions: RuleAction[] = [
                {
                    type: 'set_property',
                    config: {
                        property: 'assignment_group',
                        valueType: 'static',
                        value: 'Network Ops',
                    },
                    order: 1,
                    stopOnError: false,
                },
                {
                    type: 'set_property',
                    config: {
                        property: 'assigned_to',
                        valueType: 'static',
                        value: 'Network Queue',
                    },
                    order: 2,
                    stopOnError: false,
                },
            ];

            const record = { priority: 'Critical' };
            const result = await executor.executeActions({
                actions,
                record,
                userId: 'user123',
                executionId: 'exec123',
            });

            expect(result.recordChanges).toEqual({
                assignment_group: 'Network Ops',
                assigned_to: 'Network Queue',
            });
        });

        it('should stop execution on error if stopOnError is true', async () => {
            const actions: RuleAction[] = [
                {
                    type: 'set_property',
                    config: {
                        property: 'assignment_group',
                        valueType: 'static',
                        value: 'Network Ops',
                    },
                    order: 1,
                    stopOnError: true,
                },
                {
                    type: 'send_notification',
                    config: {
                        notificationType: 'email',
                        recipients: { type: 'email', value: 'invalid-email' },
                        subject: 'Test',
                        body: 'Test',
                    },
                    order: 2,
                    stopOnError: true,
                },
                {
                    type: 'set_property',
                    config: {
                        property: 'status',
                        valueType: 'static',
                        value: 'Assigned',
                    },
                    order: 3,
                    stopOnError: false,
                },
            ];

            const record = { priority: 'Critical' };

            await expect(
                executor.executeActions({
                    actions,
                    record,
                    userId: 'user123',
                    executionId: 'exec123',
                })
            ).rejects.toThrow();
        });
    });
});
```

### Scheduled Jobs

```typescript
describe('ScheduledJobsService', () => {
    describe('scheduleJob', () => {
        it('should schedule cron-based job', async () => {
            const job: ScheduledJob = {
                id: 'job123',
                schedule_type: 'cron',
                cron_expression: '0 9 * * 1', // Every Monday at 9 AM
                timezone: 'America/New_York',
                // ... other fields
            };

            await service.scheduleJob(job);

            const bullJob = await jobQueue.getJob('job123');
            expect(bullJob).toBeDefined();
            expect(bullJob?.opts.repeat?.cron).toBe('0 9 * * 1');
        });

        it('should schedule interval-based job', async () => {
            const job: ScheduledJob = {
                id: 'job123',
                schedule_type: 'interval',
                interval_minutes: 60,
                // ... other fields
            };

            await service.scheduleJob(job);

            const bullJob = await jobQueue.getJob('job123');
            expect(bullJob).toBeDefined();
            expect(bullJob?.opts.repeat?.every).toBe(3600000); // 60 minutes in ms
        });
    });

    describe('calculateNextRun', () => {
        it('should calculate next run for cron schedule', async () => {
            const job: ScheduledJob = {
                schedule_type: 'cron',
                cron_expression: '0 9 * * *', // Daily at 9 AM
                timezone: 'America/New_York',
                // ... other fields
            };

            const nextRun = await service.calculateNextRun(job);
            const now = new Date();

            expect(nextRun).toBeDefined();
            expect(nextRun!.getTime()).toBeGreaterThan(now.getTime());
        });
    });

    describe('processJob', () => {
        it('should process collection query job', async () => {
            const job: ScheduledJob = {
                id: 'job123',
                job_type: 'collection_query',
                collection_id: 'col123',
                query_conditions: {
                    conditions: [
                        { property: 'status', operator: 'equals', value: 'Draft', valueType: 'static' },
                    ],
                    operator: 'AND',
                },
                actions: [
                    {
                        type: 'delete_record',
                        order: 1,
                        stopOnError: false,
                    },
                ],
                // ... other fields
            };

            const result = await service.executeCollectionQuery(job);

            expect(result.recordsProcessed).toBeGreaterThan(0);
        });
    });
});
```

### Validation Service

```typescript
describe('ValidationService', () => {
    describe('validateRecord', () => {
        it('should validate date range correctly', async () => {
            const rule: ValidationRule = {
                validation_type: 'record',
                validation_conditions: {
                    conditionGroups: [
                        {
                            operator: 'AND',
                            conditions: [
                                {
                                    property: 'end_date',
                                    operator: 'less_than',
                                    value: 'start_date',
                                    valueType: 'property',
                                },
                            ],
                        },
                    ],
                    operator: 'AND',
                },
                error_message: 'End Date must be after Start Date',
                // ... other fields
            };

            const record = {
                start_date: new Date('2025-01-01'),
                end_date: new Date('2024-12-31'), // Before start date
            };

            const result = await service.executeValidationRule(rule, record);

            expect(result.isValid).toBe(false);
        });

        it('should pass validation when conditions not met', async () => {
            const rule: ValidationRule = {
                validation_type: 'record',
                validation_conditions: {
                    conditionGroups: [
                        {
                            operator: 'AND',
                            conditions: [
                                {
                                    property: 'end_date',
                                    operator: 'less_than',
                                    value: 'start_date',
                                    valueType: 'property',
                                },
                            ],
                        },
                    ],
                    operator: 'AND',
                },
                error_message: 'End Date must be after Start Date',
                // ... other fields
            };

            const record = {
                start_date: new Date('2025-01-01'),
                end_date: new Date('2025-12-31'), // After start date
            };

            const result = await service.executeValidationRule(rule, record);

            expect(result.isValid).toBe(true);
        });
    });
});
```

---

## Integration Testing

### Business Rules Integration

```typescript
describe('Business Rules Integration', () => {
    it('should execute before insert trigger', async () => {
        // Create a rule
        const rule = await createBusinessRule({
            name: 'Auto-assign Critical',
            collection_id: 'incidents',
            trigger_type: 'insert',
            trigger_timing: 'before',
            trigger_conditions: {
                conditionGroups: [
                    {
                        operator: 'AND',
                        conditions: [
                            { property: 'priority', operator: 'equals', value: 'Critical', valueType: 'static' },
                        ],
                    },
                ],
                operator: 'AND',
            },
            actions: [
                {
                    type: 'set_property',
                    config: {
                        property: 'assignment_group',
                        valueType: 'static',
                        value: 'Network Ops',
                    },
                    order: 1,
                    stopOnError: false,
                },
            ],
            is_active: true,
        });

        // Create a record that triggers the rule
        const record = await createRecord({
            collection: 'incidents',
            data: {
                priority: 'Critical',
                short_description: 'Network outage',
            },
        });

        // Verify the rule executed
        expect(record.assignment_group).toBe('Network Ops');
    });

    it('should execute multiple rules in order', async () => {
        // Create two rules with different execution orders
        const rule1 = await createBusinessRule({
            name: 'Rule 1',
            execution_order: 100,
            actions: [
                {
                    type: 'set_property',
                    config: { property: 'field1', valueType: 'static', value: 'value1' },
                    order: 1,
                    stopOnError: false,
                },
            ],
            // ... other fields
        });

        const rule2 = await createBusinessRule({
            name: 'Rule 2',
            execution_order: 200,
            actions: [
                {
                    type: 'set_property',
                    config: { property: 'field2', valueType: 'static', value: 'value2' },
                    order: 1,
                    stopOnError: false,
                },
            ],
            // ... other fields
        });

        // Create record
        const record = await createRecord({
            collection: 'incidents',
            data: { priority: 'Critical' },
        });

        // Verify both rules executed in order
        expect(record.field1).toBe('value1');
        expect(record.field2).toBe('value2');

        // Verify execution logs show correct order
        const logs = await getExecutionLogs(record.id);
        expect(logs[0].rule_id).toBe(rule1.id);
        expect(logs[1].rule_id).toBe(rule2.id);
    });

    it('should prevent infinite loops', async () => {
        // Create a rule that updates a property
        const rule = await createBusinessRule({
            name: 'Update Status',
            trigger_type: 'update',
            trigger_timing: 'after',
            actions: [
                {
                    type: 'set_property',
                    config: { property: 'updated_count', valueType: 'static', value: '1' },
                    order: 1,
                    stopOnError: false,
                },
            ],
            // ... other fields
        });

        // Create and update record
        const record = await createRecord({
            collection: 'incidents',
            data: { priority: 'Low' },
        });

        await updateRecord({
            collection: 'incidents',
            id: record.id,
            data: { priority: 'High' },
        });

        // Verify rule didn't create infinite loop
        const logs = await getExecutionLogs(record.id);
        expect(logs.length).toBeLessThan(10); // Should not execute many times
    });
});
```

### Scheduled Jobs Integration

```typescript
describe('Scheduled Jobs Integration', () => {
    it('should execute scheduled job at correct time', async () => {
        // Create a job scheduled for 1 second from now
        const runTime = new Date(Date.now() + 1000);

        const job = await createScheduledJob({
            name: 'Test Job',
            schedule_type: 'once',
            scheduled_time: runTime,
            job_type: 'collection_query',
            collection_id: 'incidents',
            query_conditions: {
                conditions: [
                    { property: 'status', operator: 'equals', value: 'Draft', valueType: 'static' },
                ],
                operator: 'AND',
            },
            actions: [
                {
                    type: 'set_property',
                    config: { property: 'processed', valueType: 'static', value: 'true' },
                    order: 1,
                    stopOnError: false,
                },
            ],
        });

        // Wait for job to execute
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify job executed
        const jobRecord = await getScheduledJob(job.id);
        expect(jobRecord.last_run_at).toBeDefined();
        expect(jobRecord.run_count).toBe(1);
    });

    it('should retry failed jobs', async () => {
        // Create a job that will fail initially
        const job = await createScheduledJob({
            name: 'Failing Job',
            max_retries: 3,
            // ... configuration that causes failure
        });

        // Trigger job execution
        await jobQueue.add({ scheduledJobId: job.id });

        // Wait for retries
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verify retry attempts
        const logs = await getExecutionLogs(job.id);
        expect(logs.length).toBeGreaterThan(1);
        expect(logs.length).toBeLessThanOrEqual(4); // Initial + 3 retries
    });
});
```

---

## Performance Testing

### Load Testing Scenarios

#### Scenario 1: Concurrent Rule Executions

```typescript
describe('Performance: Concurrent Rule Executions', () => {
    it('should handle 1000 concurrent record creations with rules', async () => {
        // Create a rule
        const rule = await createBusinessRule({
            name: 'Performance Test Rule',
            trigger_type: 'insert',
            // ... configuration
        });

        const startTime = Date.now();

        // Create 1000 records concurrently
        const promises = Array.from({ length: 1000 }, (_, i) =>
            createRecord({
                collection: 'incidents',
                data: {
                    priority: 'Critical',
                    number: `INC${i.toString().padStart(7, '0')}`,
                },
            })
        );

        await Promise.all(promises);

        const duration = Date.now() - startTime;

        // Verify performance
        expect(duration).toBeLessThan(30000); // Should complete in < 30 seconds
        console.log(`Created 1000 records with rule execution in ${duration}ms`);
        console.log(`Average: ${duration / 1000}ms per record`);
    });
});
```

#### Scenario 2: Complex Rule Performance

```typescript
describe('Performance: Complex Rules', () => {
    it('should execute complex rule with multiple conditions and actions < 200ms', async () => {
        const rule = await createBusinessRule({
            name: 'Complex Rule',
            trigger_conditions: {
                conditionGroups: [
                    {
                        operator: 'AND',
                        conditions: [
                            { property: 'priority', operator: 'equals', value: 'Critical', valueType: 'static' },
                            { property: 'assignment_group', operator: 'is_empty', value: null, valueType: 'static' },
                            { property: 'impact', operator: 'greater_than', value: '3', valueType: 'static' },
                        ],
                    },
                    {
                        operator: 'AND',
                        conditions: [
                            { property: 'status', operator: 'equals', value: 'New', valueType: 'static' },
                            { property: 'urgency', operator: 'equals', value: 'High', valueType: 'static' },
                        ],
                    },
                ],
                operator: 'OR',
            },
            actions: [
                { type: 'set_property', /* ... */ },
                { type: 'create_record', /* ... */ },
                { type: 'send_notification', /* ... */ },
                { type: 'update_record', /* ... */ },
            ],
        });

        const startTime = Date.now();

        await createRecord({
            collection: 'incidents',
            data: {
                priority: 'Critical',
                // ... other fields
            },
        });

        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(200);
        console.log(`Complex rule executed in ${duration}ms`);
    });
});
```

#### Scenario 3: Scheduled Job Performance

```typescript
describe('Performance: Scheduled Jobs', () => {
    it('should process 10,000 records in < 5 minutes', async () => {
        // Create 10,000 test records
        await createTestRecords(10000, { status: 'Draft' });

        // Create scheduled job to process them
        const job = await createScheduledJob({
            name: 'Bulk Processing Job',
            job_type: 'collection_query',
            query_conditions: {
                conditions: [
                    { property: 'status', operator: 'equals', value: 'Draft', valueType: 'static' },
                ],
                operator: 'AND',
            },
            actions: [
                {
                    type: 'set_property',
                    config: { property: 'processed', valueType: 'static', value: 'true' },
                    order: 1,
                    stopOnError: false,
                },
            ],
        });

        const startTime = Date.now();

        // Execute job
        await service.processJob({ data: { scheduledJobId: job.id } });

        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(300000); // 5 minutes
        console.log(`Processed 10,000 records in ${duration}ms`);
        console.log(`Average: ${duration / 10000}ms per record`);
    });
});
```

### Performance Benchmarks

| Operation | Target | Acceptable | Maximum |
|-----------|--------|------------|---------|
| Simple rule evaluation | < 50ms | < 100ms | 200ms |
| Complex rule evaluation | < 100ms | < 200ms | 500ms |
| Before trigger (blocking) | < 50ms | < 100ms | 200ms |
| After trigger (async) | < 500ms | < 1000ms | 2000ms |
| Scheduled job (per record) | < 10ms | < 50ms | 100ms |
| Validation rule | < 20ms | < 50ms | 100ms |
| Formula calculation | < 10ms | < 50ms | 100ms |

---

## Security Testing

### Input Validation Tests

```typescript
describe('Security: Input Validation', () => {
    it('should prevent SQL injection in rule conditions', async () => {
        const maliciousInput = "'; DROP TABLE business_rules; --";

        await expect(
            createBusinessRule({
                name: maliciousInput,
                // ... other fields
            })
        ).rejects.toThrow('Invalid input');
    });

    it('should sanitize formula expressions', async () => {
        const maliciousFormula = "eval('malicious code')";

        await expect(
            createCalculatedProperty({
                formula: maliciousFormula,
                // ... other fields
            })
        ).rejects.toThrow('Invalid formula');
    });

    it('should prevent code injection in email templates', async () => {
        const maliciousTemplate = "<script>alert('XSS')</script>";

        const action: SendNotificationAction = {
            type: 'send_notification',
            config: {
                notificationType: 'email',
                recipients: { type: 'email', value: 'test@test.com' },
                subject: 'Test',
                body: maliciousTemplate,
            },
            order: 1,
            stopOnError: false,
        };

        const result = await executor.executeSendNotification(action, {});

        // Verify HTML is escaped
        expect(result.data.body).not.toContain('<script>');
        expect(result.data.body).toContain('&lt;script&gt;');
    });
});
```

### Access Control Tests

```typescript
describe('Security: Access Control', () => {
    it('should prevent unauthorized rule creation', async () => {
        const unauthorizedUser = { id: 'user123', role: 'user' };

        await expect(
            createBusinessRule(
                {
                    name: 'Test Rule',
                    // ... other fields
                },
                unauthorizedUser
            )
        ).rejects.toThrow('Unauthorized');
    });

    it('should prevent cross-instance rule access', async () => {
        const ruleInInstance1 = await createBusinessRule({
            instance_id: 'instance1',
            name: 'Test Rule',
            // ... other fields
        });

        await expect(
            getBusinessRule(ruleInInstance1.id, { instanceId: 'instance2' })
        ).rejects.toThrow('Not found');
    });

    it('should audit all rule executions', async () => {
        const rule = await createBusinessRule({ /* ... */ });

        await createRecord({
            collection: 'incidents',
            data: { priority: 'Critical' },
            userId: 'user123',
        });

        const logs = await getExecutionLogs(rule.id);

        expect(logs[0]).toMatchObject({
            rule_id: rule.id,
            triggered_by: 'user123',
            status: 'success',
        });
    });
});
```

### Sandbox Security Tests

```typescript
describe('Security: Sandbox Isolation', () => {
    it('should prevent file system access in formula', async () => {
        const maliciousFormula = "require('fs').readFileSync('/etc/passwd')";

        await expect(
            evaluateFormula(maliciousFormula, {})
        ).rejects.toThrow('Forbidden operation');
    });

    it('should prevent network access in formula', async () => {
        const maliciousFormula = "require('http').get('http://evil.com')";

        await expect(
            evaluateFormula(maliciousFormula, {})
        ).rejects.toThrow('Forbidden operation');
    });

    it('should timeout long-running formulas', async () => {
        const infiniteLoop = "while(true) {}";

        await expect(
            evaluateFormula(infiniteLoop, {}, { timeout: 1000 })
        ).rejects.toThrow('Timeout');
    });
});
```

---

## User Acceptance Testing

### Test Scenarios

#### UAT-1: Create Business Rule via UI

**Scenario**: Admin creates a rule to auto-assign critical incidents

**Steps**:
1. Navigate to Automation > Business Rules
2. Click "Create Rule"
3. Enter rule name: "Auto-assign Critical Incidents"
4. Select trigger: "When record is created"
5. Add condition: Priority equals "Critical"
6. Add action: Set Assignment Group to "Network Operations"
7. Click "Save Rule"

**Expected Results**:
- Rule is created successfully
- Rule appears in the list as "Active"
- Creating a new critical incident triggers the rule
- Incident is assigned to Network Operations

---

#### UAT-2: Create Scheduled Job

**Scenario**: Admin creates a daily cleanup job

**Steps**:
1. Navigate to Automation > Scheduled Jobs
2. Click "Create Scheduled Job"
3. Enter name: "Daily Cleanup"
4. Select schedule: "Daily at 2:00 AM"
5. Select collection: "Incident"
6. Add condition: Status equals "Draft" AND Created older than 30 days
7. Add action: Delete record
8. Click "Save Scheduled Job"

**Expected Results**:
- Job is created successfully
- Next run time is displayed correctly
- Job executes at scheduled time
- Draft records older than 30 days are deleted

---

#### UAT-3: AVA Natural Language Rule Creation

**Scenario**: User asks AVA to create a rule

**Steps**:
1. Open AVA chat
2. Type: "Create a rule that sends an email when priority changes to critical"
3. Review AVA's suggested rule configuration
4. Click "Create Rule"

**Expected Results**:
- AVA correctly interprets the request
- Suggested rule matches user intent
- Rule is created and activated
- Email is sent when priority changes to critical

---

## Test Automation

### CI/CD Pipeline

```yaml
# .github/workflows/phase3-tests.yml

name: Phase 3 Tests

on:
  push:
    branches: [main, develop, 'phase-3/*']
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npx prisma migrate deploy

      - name: Run integration tests
        run: npm run test:integration

  performance-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run performance tests
        run: npm run test:performance

      - name: Upload performance results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: performance-results.json

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-results
          path: playwright-report/
```

---

## Test Data Management

### Test Data Generation

```typescript
// Test data factory for automation rules

export class TestDataFactory {
    /**
     * Create test business rule
     */
    static createBusinessRule(overrides?: Partial<BusinessRule>): BusinessRule {
        return {
            id: uuid(),
            instance_id: 'test-instance',
            name: 'Test Rule',
            description: 'Test rule description',
            collection_id: 'test-collection',
            trigger_type: 'insert',
            trigger_timing: 'before',
            trigger_conditions: {
                conditionGroups: [],
                operator: 'AND',
            },
            actions: [],
            is_active: true,
            execution_order: 100,
            created_at: new Date(),
            updated_at: new Date(),
            ...overrides,
        };
    }

    /**
     * Create test scheduled job
     */
    static createScheduledJob(overrides?: Partial<ScheduledJob>): ScheduledJob {
        return {
            id: uuid(),
            instance_id: 'test-instance',
            name: 'Test Job',
            schedule_type: 'daily',
            cron_expression: '0 9 * * *',
            timezone: 'UTC',
            job_type: 'collection_query',
            query_conditions: {
                conditions: [],
                operator: 'AND',
            },
            actions: [],
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
            ...overrides,
        };
    }

    /**
     * Create test records in bulk
     */
    static async createTestRecords(
        count: number,
        template: Partial<Record<string, any>>
    ): Promise<any[]> {
        const records = [];

        for (let i = 0; i < count; i++) {
            records.push({
                id: uuid(),
                number: `TEST${i.toString().padStart(7, '0')}`,
                created_at: new Date(),
                ...template,
            });
        }

        await prisma.records.createMany({ data: records });

        return records;
    }
}
```

---

**Document Version:** 1.0
**Last Updated:** 2025-12-30
**QA Team Lead:** TBD
**Test Environment:** Staging
