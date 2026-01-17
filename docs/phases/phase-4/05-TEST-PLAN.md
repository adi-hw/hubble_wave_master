# Phase 4: Test Plan

**Purpose:** Comprehensive testing strategy for Workflows & Notifications
**Scope:** Functional, integration, performance, and user acceptance testing
**Timeline:** Weeks 35-36 (parallel with development)

---

## Table of Contents

1. [Test Strategy](#test-strategy)
2. [Workflow Engine Testing](#workflow-engine-testing)
3. [Approval Testing](#approval-testing)
4. [SLA Testing](#sla-testing)
5. [Notification Testing](#notification-testing)
6. [Integration Testing](#integration-testing)
7. [Performance Testing](#performance-testing)
8. [Security Testing](#security-testing)
9. [User Acceptance Testing](#user-acceptance-testing)
10. [Test Automation](#test-automation)

---

## Test Strategy

### Testing Pyramid

```
                    ┌─────────────┐
                    │     UAT     │  Manual testing by users
                    │   (5-10%)   │
                    └─────────────┘
                 ┌─────────────────┐
                 │   Integration   │  API and system integration
                 │     (20-30%)    │
                 └─────────────────┘
              ┌──────────────────────┐
              │   Component/Service  │  Individual service testing
              │       (30-40%)       │
              └──────────────────────┘
           ┌──────────────────────────────┐
           │         Unit Tests           │  Function/method level
           │          (40-50%)            │
           └──────────────────────────────┘
```

### Test Types

| Test Type | Coverage | Tools | Frequency |
|-----------|----------|-------|-----------|
| Unit Tests | 80%+ | Jest, Mocha | Every commit |
| Integration Tests | 70%+ | Supertest, Postman | Every PR |
| E2E Tests | Critical paths | Playwright, Cypress | Daily |
| Performance Tests | Key workflows | k6, Artillery | Weekly |
| Security Tests | OWASP Top 10 | OWASP ZAP, Snyk | Weekly |
| UAT | All features | Manual | Before release |

### Test Environments

1. **Local Development** - Developer machines
2. **CI/CD** - Automated testing on PR
3. **Staging** - Pre-production environment
4. **Production** - Post-deployment smoke tests

---

## Workflow Engine Testing

### Unit Tests

```typescript
// __tests__/WorkflowEngine.test.ts

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
    engine = new WorkflowEngine(db);
  });

  describe('execute', () => {
    it('should execute a simple workflow', async () => {
      const workflow = createSimpleWorkflow();
      const instance = await engine.execute(workflow.id, 'record-123', 'user-456');

      expect(instance.state).toBe('completed');
      expect(instance.current_node_id).toBeNull();
    });

    it('should handle workflow with conditions', async () => {
      const workflow = createConditionalWorkflow();
      const instance = await engine.execute(workflow.id, 'record-123', 'user-456');

      // Verify correct branch taken
      const history = await db.getWorkflowHistory(instance.id);
      expect(history).toContainNode('condition-node');
      expect(history).toContainNode('true-branch-action');
    });

    it('should pause at approval nodes', async () => {
      const workflow = createApprovalWorkflow();
      const instance = await engine.execute(workflow.id, 'record-123', 'user-456');

      expect(instance.state).toBe('waiting_approval');
      expect(instance.current_node_id).toBe('approval-node-1');
    });

    it('should handle errors gracefully', async () => {
      const workflow = createWorkflowWithFailingAction();

      await expect(
        engine.execute(workflow.id, 'record-123', 'user-456')
      ).rejects.toThrow('Action failed');

      // Verify error logged
      const history = await db.getWorkflowHistory(instance.id);
      expect(history).toContainError('Action failed');
    });
  });

  describe('resumeAfterApproval', () => {
    it('should continue workflow after approval', async () => {
      const workflow = createApprovalWorkflow();
      const instance = await engine.execute(workflow.id, 'record-123', 'user-456');

      await engine.resumeAfterApproval(instance.id, 'approval-node-1', true);

      const updatedInstance = await db.getWorkflowInstance(instance.id);
      expect(updatedInstance.state).toBe('completed');
    });

    it('should terminate workflow after rejection', async () => {
      const workflow = createApprovalWorkflow();
      const instance = await engine.execute(workflow.id, 'record-123', 'user-456');

      await engine.resumeAfterApproval(instance.id, 'approval-node-1', false);

      const updatedInstance = await db.getWorkflowInstance(instance.id);
      expect(updatedInstance.state).toBe('rejected');
    });
  });

  describe('evaluateConditions', () => {
    it('should evaluate simple conditions correctly', () => {
      const record = { priority: 'High', category: 'Network' };
      const condition = { field: 'priority', operator: '=', value: 'High' };

      const result = engine.evaluateCondition(
        record.priority,
        condition.operator,
        condition.value
      );

      expect(result).toBe(true);
    });

    it('should evaluate complex condition groups', () => {
      const record = { priority: 'High', category: 'Network', impact: 3 };
      const conditionGroup = {
        operator: 'AND',
        conditions: [
          { field: 'priority', operator: '=', value: 'High' },
          { field: 'impact', operator: '>=', value: 2 }
        ]
      };

      const result = engine.evaluateConditions(conditionGroup, record);

      expect(result).toBe(true);
    });
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/WorkflowIntegration.test.ts

describe('Workflow Integration Tests', () => {
  let app: Express;
  let db: Database;

  beforeAll(async () => {
    app = await createTestApp();
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  describe('End-to-End Workflow Execution', () => {
    it('should execute incident assignment workflow', async () => {
      // Create test incident
      const incident = await createTestIncident({
        category: 'Network',
        priority: 'High'
      });

      // Workflow should auto-execute on incident creation
      await waitFor(() => incident.assignment_group !== null);

      expect(incident.assignment_group).toBe('Network Team');

      // Verify workflow history
      const instances = await db.query(
        'SELECT * FROM workflow_instances WHERE record_id = $1',
        [incident.id]
      );

      expect(instances.rows.length).toBe(1);
      expect(instances.rows[0].state).toBe('completed');
    });

    it('should execute multi-stage approval workflow', async () => {
      // Create change request
      const change = await createTestChange({
        type: 'Normal',
        risk: 'Medium',
        cost: 7500
      });

      // Submit for approval
      await request(app)
        .post(`/api/changes/${change.id}/submit`)
        .expect(200);

      // Verify approval created for manager
      const managerApprovals = await db.query(
        'SELECT * FROM approvals WHERE workflow_instance_id = $1 AND approver_id = $2',
        [change.workflow_instance_id, change.manager_id]
      );

      expect(managerApprovals.rows.length).toBe(1);
      expect(managerApprovals.rows[0].status).toBe('pending');

      // Manager approves
      await request(app)
        .post(`/api/approvals/${managerApprovals.rows[0].id}/approve`)
        .send({ comments: 'Approved' })
        .expect(200);

      // Verify approval created for director
      await waitFor(async () => {
        const directorApprovals = await db.query(
          'SELECT * FROM approvals WHERE workflow_instance_id = $1 AND approver_id = $2',
          [change.workflow_instance_id, change.director_id]
        );
        return directorApprovals.rows.length > 0;
      });
    });
  });

  describe('Workflow Triggers', () => {
    it('should trigger on record creation', async () => {
      const workflow = await createWorkflow({
        trigger: { type: 'record_created', table: 'incident' }
      });

      await activateWorkflow(workflow.id);

      const incident = await createTestIncident();

      const instances = await db.query(
        'SELECT * FROM workflow_instances WHERE workflow_id = $1',
        [workflow.id]
      );

      expect(instances.rows.length).toBeGreaterThan(0);
    });

    it('should trigger on field change', async () => {
      const workflow = await createWorkflow({
        trigger: {
          type: 'field_changed',
          table: 'incident',
          filter: { field: 'priority' }
        }
      });

      await activateWorkflow(workflow.id);

      const incident = await createTestIncident({ priority: 'Low' });

      // Change priority
      await updateIncident(incident.id, { priority: 'High' });

      const instances = await db.query(
        'SELECT * FROM workflow_instances WHERE workflow_id = $1 AND record_id = $2',
        [workflow.id, incident.id]
      );

      expect(instances.rows.length).toBeGreaterThan(0);
    });

    it('should trigger on schedule', async () => {
      const workflow = await createWorkflow({
        trigger: {
          type: 'scheduled',
          schedule: '0 9 * * *', // Daily at 9 AM
          filter: { state: 'Open' }
        }
      });

      await activateWorkflow(workflow.id);

      // Create incidents matching filter
      await createTestIncident({ state: 'Open' });
      await createTestIncident({ state: 'Open' });

      // Manually trigger scheduled job (or wait for actual schedule)
      await triggerScheduledWorkflows();

      const instances = await db.query(
        'SELECT * FROM workflow_instances WHERE workflow_id = $1',
        [workflow.id]
      );

      expect(instances.rows.length).toBe(2);
    });
  });
});
```

### Test Cases Matrix

| Test Case | Workflow Type | Expected Result | Priority |
|-----------|--------------|-----------------|----------|
| WF-001 | Simple linear workflow | Executes all nodes sequentially | P0 |
| WF-002 | Conditional branching | Takes correct branch based on data | P0 |
| WF-003 | Parallel execution | Multiple branches execute simultaneously | P1 |
| WF-004 | Loop construct | Iterates over collection correctly | P1 |
| WF-005 | Nested subflow | Calls and returns from subflow | P1 |
| WF-006 | Error handling | Catches and logs errors gracefully | P0 |
| WF-007 | Timeout handling | Workflow times out after configured duration | P1 |
| WF-008 | Variable substitution | Variables correctly replaced in actions | P0 |
| WF-009 | Dynamic assignment | Approver/assignee determined at runtime | P0 |
| WF-010 | Workflow cancellation | Can cancel running workflow | P1 |

---

## Approval Testing

### Functional Tests

```typescript
// __tests__/ApprovalEngine.test.ts

describe('Approval Engine', () => {
  describe('Sequential Approvals', () => {
    it('should process approvals in order', async () => {
      const approvals = await createSequentialApprovals([
        'manager-1',
        'director-1',
        'vp-1'
      ]);

      // Only first approval should be active
      expect(approvals[0].status).toBe('pending');
      expect(approvals[1].status).toBe('pending');
      expect(approvals[2].status).toBe('pending');

      // Approve first
      await approveApproval(approvals[0].id, 'manager-1');

      // Second should now be active, third still waiting
      const updated = await getApprovals(approvals[0].workflow_instance_id);
      expect(updated[0].status).toBe('approved');
      expect(updated[1].status).toBe('pending');
    });

    it('should complete workflow after all approvals', async () => {
      const approvals = await createSequentialApprovals(['manager-1', 'director-1']);

      await approveApproval(approvals[0].id, 'manager-1');
      await approveApproval(approvals[1].id, 'director-1');

      const instance = await getWorkflowInstance(approvals[0].workflow_instance_id);
      expect(instance.state).toBe('completed');
    });
  });

  describe('Parallel Approvals', () => {
    it('should allow simultaneous approvals (any)', async () => {
      const approvals = await createParallelApprovals(
        ['manager-1', 'manager-2', 'manager-3'],
        'any'
      );

      // Any manager can approve
      await approveApproval(approvals[1].id, 'manager-2');

      const instance = await getWorkflowInstance(approvals[0].workflow_instance_id);
      expect(instance.state).toBe('completed');
    });

    it('should require all approvals (all)', async () => {
      const approvals = await createParallelApprovals(
        ['manager-1', 'manager-2', 'manager-3'],
        'all'
      );

      // First approval - workflow continues
      await approveApproval(approvals[0].id, 'manager-1');
      let instance = await getWorkflowInstance(approvals[0].workflow_instance_id);
      expect(instance.state).toBe('waiting_approval');

      // Second approval - workflow continues
      await approveApproval(approvals[1].id, 'manager-2');
      instance = await getWorkflowInstance(approvals[0].workflow_instance_id);
      expect(instance.state).toBe('waiting_approval');

      // Third approval - workflow completes
      await approveApproval(approvals[2].id, 'manager-3');
      instance = await getWorkflowInstance(approvals[0].workflow_instance_id);
      expect(instance.state).toBe('completed');
    });
  });

  describe('Approval Delegation', () => {
    it('should allow approver to delegate', async () => {
      const approval = await createApproval('manager-1');

      await delegateApproval(approval.id, 'manager-1', 'manager-2');

      const updated = await getApproval(approval.id);
      expect(updated.delegated_to).toBe('manager-2');
      expect(updated.status).toBe('delegated');
    });

    it('should allow delegate to approve', async () => {
      const approval = await createApproval('manager-1');
      await delegateApproval(approval.id, 'manager-1', 'manager-2');

      await approveApproval(approval.id, 'manager-2');

      const updated = await getApproval(approval.id);
      expect(updated.status).toBe('approved');
      expect(updated.approved_by).toBe('manager-2');
    });
  });

  describe('Approval Rejection', () => {
    it('should terminate workflow on rejection', async () => {
      const approval = await createApproval('manager-1');

      await rejectApproval(approval.id, 'manager-1', 'Insufficient documentation');

      const instance = await getWorkflowInstance(approval.workflow_instance_id);
      expect(instance.state).toBe('rejected');
    });

    it('should support rejection with rework', async () => {
      const approval = await createApproval('manager-1');

      await requestInfoApproval(approval.id, 'manager-1', 'Please provide cost analysis');

      const updated = await getApproval(approval.id);
      expect(updated.status).toBe('info_requested');

      // Requester updates and resubmits
      await resubmitApproval(approval.id);

      const resubmitted = await getApproval(approval.id);
      expect(resubmitted.status).toBe('pending');
    });
  });

  describe('Approval Timeout', () => {
    it('should escalate after timeout', async () => {
      const approval = await createApproval('manager-1', {
        timeout_hours: 0.001, // 3.6 seconds for testing
        escalation: { action: 'notify_manager' }
      });

      // Wait for timeout
      await sleep(5000);

      const notifications = await getNotifications('manager-manager-1'); // Manager's manager
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].type).toBe('approval_escalation');
    });

    it('should auto-approve after timeout if configured', async () => {
      const approval = await createApproval('manager-1', {
        timeout_hours: 0.001,
        escalation: { action: 'auto_approve' }
      });

      await sleep(5000);

      const updated = await getApproval(approval.id);
      expect(updated.status).toBe('approved');
      expect(updated.approved_by).toBe('system');
    });
  });
});
```

### Test Data

```typescript
// __tests__/fixtures/approval-scenarios.ts

export const approvalScenarios = [
  {
    name: 'Simple manager approval',
    approvers: ['manager-1'],
    type: 'sequential',
    expected_stages: 1
  },
  {
    name: 'Two-stage approval (manager → director)',
    approvers: ['manager-1', 'director-1'],
    type: 'sequential',
    expected_stages: 2
  },
  {
    name: 'Three-stage approval (manager → director → VP)',
    approvers: ['manager-1', 'director-1', 'vp-1'],
    type: 'sequential',
    expected_stages: 3
  },
  {
    name: 'Parallel manager approval (any)',
    approvers: ['manager-1', 'manager-2', 'manager-3'],
    type: 'parallel_any',
    expected_stages: 1
  },
  {
    name: 'Parallel manager approval (all)',
    approvers: ['manager-1', 'manager-2', 'manager-3'],
    type: 'parallel_all',
    expected_stages: 1
  },
  {
    name: 'Dynamic approver (manager field)',
    approvers: [{ field: 'manager' }],
    type: 'sequential',
    expected_stages: 1
  }
];
```

---

## SLA Testing

### Timer Accuracy Tests

```typescript
// __tests__/SLATimerService.test.ts

describe('SLA Timer Service', () => {
  describe('Timer Accuracy', () => {
    it('should track elapsed time accurately', async () => {
      const sla = await createSLA({ target_minutes: 60 });

      const start = Date.now();
      await sleep(5000); // 5 seconds

      const instance = await getSLAInstance(sla.id);
      const elapsed = instance.elapsed_seconds;

      expect(elapsed).toBeGreaterThanOrEqual(4);
      expect(elapsed).toBeLessThanOrEqual(6); // Allow 1s margin
    });

    it('should calculate remaining time correctly', async () => {
      const sla = await createSLA({ target_minutes: 1 }); // 60 seconds

      await sleep(30000); // 30 seconds

      const instance = await getSLAInstance(sla.id);

      expect(instance.remaining_seconds).toBeGreaterThanOrEqual(28);
      expect(instance.remaining_seconds).toBeLessThanOrEqual(32);
    });

    it('should handle business hours correctly', async () => {
      const calendar = await createBusinessHours({
        start: '09:00',
        end: '17:00',
        timezone: 'America/Los_Angeles'
      });

      const sla = await createSLA({
        target_minutes: 480, // 8 hours
        business_hours_id: calendar.id
      });

      // Start at 4 PM (1 hour before end)
      const startTime = setHours(new Date(), 16);
      await startSLA(sla.id, startTime);

      // Should account for overnight gap
      const instance = await getSLAInstance(sla.id);
      const targetTime = instance.target_time;

      // Should be next day at 4 PM (8 business hours later)
      expect(targetTime.getHours()).toBe(16);
      expect(differenceInDays(targetTime, startTime)).toBe(1);
    });
  });

  describe('SLA State Management', () => {
    it('should pause and resume correctly', async () => {
      const sla = await createSLA({ target_minutes: 60 });

      await sleep(10000); // 10 seconds active

      await pauseSLA(sla.id);
      const pauseTime = Date.now();

      await sleep(5000); // 5 seconds paused

      await resumeSLA(sla.id);

      const instance = await getSLAInstance(sla.id);

      // Should not count paused time
      expect(instance.total_pause_seconds).toBeGreaterThanOrEqual(4);
      expect(instance.total_pause_seconds).toBeLessThanOrEqual(6);
    });

    it('should handle multiple pause/resume cycles', async () => {
      const sla = await createSLA({ target_minutes: 60 });

      // First cycle
      await sleep(5000);
      await pauseSLA(sla.id);
      await sleep(3000);
      await resumeSLA(sla.id);

      // Second cycle
      await sleep(5000);
      await pauseSLA(sla.id);
      await sleep(3000);
      await resumeSLA(sla.id);

      const instance = await getSLAInstance(sla.id);

      expect(instance.pause_count).toBe(2);
      expect(instance.total_pause_seconds).toBeGreaterThanOrEqual(5);
      expect(instance.total_pause_seconds).toBeLessThanOrEqual(7);
    });
  });

  describe('SLA Breach Detection', () => {
    it('should detect breach accurately', async () => {
      const sla = await createSLA({ target_minutes: 0.05 }); // 3 seconds

      await sleep(5000);

      const instance = await getSLAInstance(sla.id);
      expect(instance.state).toBe('breached');

      const breaches = await getSLABreaches(instance.record_id);
      expect(breaches.length).toBe(1);
    });

    it('should send warnings at thresholds', async () => {
      const sla = await createSLA({
        target_minutes: 1,
        warning_threshold_1: 75,
        warning_threshold_2: 90
      });

      // Wait for 75%
      await sleep(45000);

      let instance = await getSLAInstance(sla.id);
      expect(instance.warning_1_sent).toBe(true);

      // Wait for 90%
      await sleep(10000);

      instance = await getSLAInstance(sla.id);
      expect(instance.warning_2_sent).toBe(true);
    });
  });

  describe('SLA Escalation', () => {
    it('should execute escalation actions', async () => {
      const sla = await createSLA({
        target_minutes: 0.05,
        escalations: [{
          threshold_percent: 75,
          actions: [
            { type: 'send_notification', config: { template: 'sla_warning' } },
            { type: 'update_field', config: { field: 'priority', value: 'High' } }
          ]
        }]
      });

      await sleep(4000); // 75% of 3 seconds

      const record = await getRecord(sla.record_id);
      expect(record.priority).toBe('High');

      const notifications = await getNotifications(record.assigned_to);
      expect(notifications.some(n => n.template === 'sla_warning')).toBe(true);
    });
  });
});
```

### Performance Benchmarks

```typescript
// __tests__/performance/sla-performance.test.ts

describe('SLA Performance Benchmarks', () => {
  it('should handle 1000 concurrent SLA timers', async () => {
    const slas = await Promise.all(
      Array(1000).fill(null).map(() => createSLA({ target_minutes: 60 }))
    );

    const start = Date.now();

    // Update all timers
    await updateAllSLATimers();

    const duration = Date.now() - start;

    // Should complete in < 5 seconds
    expect(duration).toBeLessThan(5000);
  });

  it('should maintain accuracy under load', async () => {
    const slas = await Promise.all(
      Array(100).fill(null).map(() => createSLA({ target_minutes: 1 }))
    );

    await sleep(30000); // 30 seconds

    const instances = await Promise.all(
      slas.map(sla => getSLAInstance(sla.id))
    );

    // All should be around 30 seconds elapsed
    instances.forEach(instance => {
      expect(instance.elapsed_seconds).toBeGreaterThanOrEqual(28);
      expect(instance.elapsed_seconds).toBeLessThanOrEqual(32);
    });
  });

  it('should recover from timer service restart', async () => {
    const sla = await createSLA({ target_minutes: 2 });

    await sleep(30000); // 30 seconds

    // Simulate service restart
    await restartSLAService();

    await sleep(30000); // Another 30 seconds

    const instance = await getSLAInstance(sla.id);

    // Should have ~60 seconds total (not reset to 0)
    expect(instance.elapsed_seconds).toBeGreaterThanOrEqual(58);
    expect(instance.elapsed_seconds).toBeLessThanOrEqual(62);
  });
});
```

---

## Notification Testing

### Multi-Channel Tests

```typescript
// __tests__/NotificationService.test.ts

describe('Notification Service', () => {
  describe('Email Notifications', () => {
    it('should send email successfully', async () => {
      const mockSendGrid = jest.spyOn(sendgrid, 'send');

      await notificationService.send(
        'incident-assignment',
        'user-123',
        { incident: { number: 'INC0001' } }
      );

      expect(mockSendGrid).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user123@example.com',
          subject: expect.stringContaining('INC0001'),
          html: expect.any(String)
        })
      );
    });

    it('should render template variables correctly', async () => {
      const mockSendGrid = jest.spyOn(sendgrid, 'send');

      await notificationService.send(
        'incident-assignment',
        'user-123',
        {
          record: { number: 'INC0001', short_description: 'Test incident' },
          assigned_to: { name: 'John Smith' }
        }
      );

      const call = mockSendGrid.mock.calls[0][0];
      expect(call.html).toContain('INC0001');
      expect(call.html).toContain('Test incident');
      expect(call.html).toContain('John Smith');
    });

    it('should handle email delivery failures', async () => {
      jest.spyOn(sendgrid, 'send').mockRejectedValue(new Error('SMTP error'));

      const notificationId = await notificationService.send(
        'incident-assignment',
        'user-123',
        {}
      );

      const history = await getNotificationHistory(notificationId, 'email');
      expect(history.failed_at).not.toBeNull();
      expect(history.error_message).toContain('SMTP error');
    });
  });

  describe('SMS Notifications', () => {
    it('should send SMS successfully', async () => {
      const mockTwilio = jest.spyOn(twilio.messages, 'create');

      await notificationService.send(
        'sla-breach',
        'user-123',
        { incident: { number: 'INC0001' } },
        { channels: ['sms'] }
      );

      expect(mockTwilio).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+15551234567',
          body: expect.stringContaining('INC0001')
        })
      );
    });

    it('should truncate SMS to 160 characters', async () => {
      const mockTwilio = jest.spyOn(twilio.messages, 'create');

      await notificationService.send(
        'long-message',
        'user-123',
        { description: 'A'.repeat(200) },
        { channels: ['sms'] }
      );

      const call = mockTwilio.mock.calls[0][0];
      expect(call.body.length).toBeLessThanOrEqual(160);
    });
  });

  describe('Push Notifications', () => {
    it('should send push notification successfully', async () => {
      const mockFCM = jest.spyOn(fcm, 'sendMulticast');

      await notificationService.send(
        'approval-required',
        'user-123',
        { approval: { id: 'APR001' } },
        { channels: ['push'] }
      );

      expect(mockFCM).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: expect.objectContaining({
            title: expect.any(String),
            body: expect.any(String)
          })
        })
      );
    });

    it('should handle multiple device tokens', async () => {
      const mockFCM = jest.spyOn(fcm, 'sendMulticast');

      // User has 3 devices
      await createDeviceToken('user-123', 'token-ios');
      await createDeviceToken('user-123', 'token-android');
      await createDeviceToken('user-123', 'token-web');

      await notificationService.send(
        'approval-required',
        'user-123',
        {},
        { channels: ['push'] }
      );

      const call = mockFCM.mock.calls[0][0];
      expect(call.tokens.length).toBe(3);
    });
  });

  describe('In-App Notifications', () => {
    it('should create in-app notification', async () => {
      await notificationService.send(
        'comment-added',
        'user-123',
        { comment: { text: 'New comment' } },
        { channels: ['in_app'] }
      );

      const notifications = await getInAppNotifications('user-123');
      expect(notifications.length).toBe(1);
      expect(notifications[0].read).toBe(false);
    });

    it('should send via WebSocket if user online', async () => {
      const mockSocket = jest.fn();
      socketio.to = jest.fn().mockReturnValue({ emit: mockSocket });

      await notificationService.send(
        'comment-added',
        'user-123',
        {},
        { channels: ['in_app'] }
      );

      expect(mockSocket).toHaveBeenCalledWith(
        'notification',
        expect.any(Object)
      );
    });
  });

  describe('Smart Delivery', () => {
    it('should respect user channel preferences', async () => {
      await setUserPreferences('user-123', {
        assignment: ['email', 'in_app'],
        approval: ['email', 'sms', 'push']
      });

      await notificationService.send('incident-assignment', 'user-123', {});

      const history = await getAllNotificationHistory('user-123');
      const channels = history.map(h => h.channel);

      expect(channels).toContain('email');
      expect(channels).toContain('in_app');
      expect(channels).not.toContain('sms');
      expect(channels).not.toContain('push');
    });

    it('should respect quiet hours', async () => {
      await setUserPreferences('user-123', {
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00'
      });

      // Send during quiet hours (11 PM)
      jest.useFakeTimers();
      jest.setSystemTime(setHours(new Date(), 23));

      await notificationService.send(
        'low-priority',
        'user-123',
        {},
        { priority: 'low' }
      );

      const queue = await getNotificationQueue('user-123');
      expect(queue[0].scheduled_for).not.toBeNull();
      expect(queue[0].scheduled_for.getHours()).toBe(8); // Next morning

      jest.useRealTimers();
    });

    it('should send urgent notifications even during quiet hours', async () => {
      await setUserPreferences('user-123', {
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00'
      });

      jest.useFakeTimers();
      jest.setSystemTime(setHours(new Date(), 23));

      await notificationService.send(
        'sla-breach',
        'user-123',
        {},
        { priority: 'urgent' }
      );

      const queue = await getNotificationQueue('user-123');
      expect(queue[0].scheduled_for).toBeNull(); // Send immediately

      jest.useRealTimers();
    });
  });

  describe('Delivery Tracking', () => {
    it('should track email opens', async () => {
      const notificationId = await notificationService.send(
        'incident-assignment',
        'user-123',
        {}
      );

      // Simulate SendGrid webhook for open event
      await request(app)
        .post('/api/webhooks/sendgrid')
        .send([{
          event: 'open',
          sg_message_id: 'msg-123',
          notification_id: notificationId,
          timestamp: Math.floor(Date.now() / 1000)
        }])
        .expect(200);

      const history = await getNotificationHistory(notificationId, 'email');
      expect(history.opened_at).not.toBeNull();
    });

    it('should track SMS delivery status', async () => {
      const notificationId = await notificationService.send(
        'sla-breach',
        'user-123',
        {},
        { channels: ['sms'] }
      );

      // Simulate Twilio webhook for delivery
      await request(app)
        .post('/api/webhooks/twilio/status')
        .send({
          MessageSid: 'msg-123',
          MessageStatus: 'delivered'
        })
        .expect(200);

      const history = await getNotificationHistory(notificationId, 'sms');
      expect(history.delivered_at).not.toBeNull();
    });
  });
});
```

---

## Integration Testing

### System Integration Tests

```typescript
// __tests__/integration/system-integration.test.ts

describe('Phase 4 System Integration', () => {
  describe('Workflow + SLA Integration', () => {
    it('should pause SLA during approval wait', async () => {
      const incident = await createTestIncident();
      const sla = await getSLAForRecord(incident.id);

      // Workflow sends for approval
      await submitForApproval(incident.id);

      // SLA should pause
      await waitFor(async () => {
        const updated = await getSLAInstance(sla.id);
        return updated.state === 'paused';
      });
    });

    it('should resume SLA after approval', async () => {
      const incident = await createTestIncident();
      await submitForApproval(incident.id);

      const approval = await getPendingApproval(incident.id);
      await approveApproval(approval.id, approval.approver_id);

      const sla = await getSLAForRecord(incident.id);
      expect(sla.state).toBe('active');
    });
  });

  describe('Workflow + Notification Integration', () => {
    it('should send notifications from workflow actions', async () => {
      const workflow = await createWorkflow({
        nodes: [
          { type: 'start' },
          {
            type: 'action',
            config: {
              action: 'send_notification',
              template: 'incident-assignment',
              recipient: '${assigned_to}'
            }
          },
          { type: 'end' }
        ]
      });

      const incident = await createTestIncident({ assigned_to: 'user-123' });

      await waitFor(async () => {
        const notifications = await getNotifications('user-123');
        return notifications.length > 0;
      });
    });
  });

  describe('SLA + Notification Integration', () => {
    it('should send warning notification at threshold', async () => {
      const sla = await createSLA({
        target_minutes: 1,
        warning_threshold_1: 75
      });

      const incident = await getRecord(sla.record_id);

      await sleep(45000); // 75% of 60 seconds

      const notifications = await getNotifications(incident.assigned_to);
      expect(notifications.some(n => n.type === 'sla_warning')).toBe(true);
    });

    it('should send breach notification', async () => {
      const sla = await createSLA({ target_minutes: 0.05 });
      const incident = await getRecord(sla.record_id);

      await sleep(5000);

      const notifications = await getNotifications(incident.assigned_to);
      expect(notifications.some(n => n.type === 'sla_breach')).toBe(true);
    });
  });

  describe('Full Stack Integration', () => {
    it('should execute complete incident lifecycle', async () => {
      // 1. Create incident (triggers workflow)
      const incident = await createTestIncident({
        category: 'Network',
        priority: 'High'
      });

      // 2. Workflow auto-assigns
      await waitFor(() => incident.assignment_group !== null);
      expect(incident.assignment_group).toBe('Network Team');

      // 3. Assignment notification sent
      const assignmentNotifications = await getNotifications(incident.assigned_to);
      expect(assignmentNotifications.length).toBeGreaterThan(0);

      // 4. SLA started
      const sla = await getSLAForRecord(incident.id);
      expect(sla.state).toBe('active');

      // 5. Technician works on incident
      await updateIncident(incident.id, { state: 'In Progress' });

      // 6. Resolution submitted
      await updateIncident(incident.id, {
        state: 'Resolved',
        resolution_notes: 'Fixed network switch'
      });

      // 7. SLA completed
      const completedSLA = await getSLAInstance(sla.id);
      expect(completedSLA.state).toBe('completed');

      // 8. Resolution notification sent to requester
      const resolutionNotifications = await getNotifications(incident.requester);
      expect(resolutionNotifications.some(n =>
        n.title.includes('Resolved')
      )).toBe(true);
    });
  });
});
```

---

## Performance Testing

### Load Tests

```javascript
// k6/workflow-load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 500 },  // Ramp to 500 users
    { duration: '5m', target: 500 },  // Stay at 500 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.01'],    // Error rate under 1%
  },
};

export default function () {
  // Create incident (triggers workflow)
  let incident = http.post('http://localhost:3000/api/incidents', JSON.stringify({
    short_description: 'Load test incident',
    category: 'Network',
    priority: 'High'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

  check(incident, {
    'incident created': (r) => r.status === 201,
    'workflow triggered': (r) => r.json('workflow_instance_id') !== null
  });

  sleep(1);
}
```

### Stress Tests

```javascript
// k6/sla-stress-test.js

export let options = {
  scenarios: {
    constant_slas: {
      executor: 'constant-vus',
      vus: 1000,
      duration: '10m',
    },
  },
  thresholds: {
    'sla_timer_accuracy': ['p(99)<1'], // 99% within 1 second
  },
};

export default function () {
  // Create record with SLA
  let record = http.post('http://localhost:3000/api/incidents', {
    short_description: 'SLA stress test',
    priority: 'High'
  });

  let sla = record.json('sla_instances')[0];

  // Check SLA accuracy after 30 seconds
  sleep(30);

  let updated = http.get(`http://localhost:3000/api/sla/instances/${sla.id}`);
  let elapsed = updated.json('elapsed_seconds');

  check(elapsed, {
    'timer accurate': (e) => Math.abs(e - 30) <= 1
  });
}
```

---

## Security Testing

### Security Test Cases

```typescript
// __tests__/security/workflow-security.test.ts

describe('Workflow Security', () => {
  it('should prevent unauthorized workflow execution', async () => {
    const workflow = await createWorkflow({ created_by: 'user-1' });

    await request(app)
      .post(`/api/workflows/${workflow.id}/execute`)
      .set('Authorization', 'Bearer user-2-token')
      .expect(403);
  });

  it('should prevent SQL injection in workflow conditions', async () => {
    const maliciousCondition = {
      field: 'priority',
      operator: '=',
      value: "'; DROP TABLE incidents; --"
    };

    await expect(
      createWorkflow({ conditions: maliciousCondition })
    ).rejects.toThrow('Invalid condition');
  });

  it('should sanitize notification content', async () => {
    const xssPayload = '<script>alert("XSS")</script>';

    await notificationService.send(
      'test-template',
      'user-123',
      { description: xssPayload }
    );

    const history = await getNotificationHistory();
    expect(history[0].content).not.toContain('<script>');
    expect(history[0].content).toContain('&lt;script&gt;');
  });

  it('should enforce approval permissions', async () => {
    const approval = await createApproval('manager-1');

    // Different user tries to approve
    await request(app)
      .post(`/api/approvals/${approval.id}/approve`)
      .set('Authorization', 'Bearer user-2-token')
      .expect(403);
  });
});
```

---

## User Acceptance Testing

### UAT Test Scenarios

```markdown
# Phase 4 UAT Test Scenarios

## Workflow Designer UAT

### Scenario 1: Create Simple Assignment Workflow
**Objective:** Verify business users can create workflows without IT help

**Steps:**
1. Login as business user (non-admin)
2. Navigate to Workflows > Create New
3. Name: "Auto-Assign Network Incidents"
4. Drag "Start" node to canvas
5. Configure trigger: Incident Created, Category = Network
6. Drag "Action" node, connect to Start
7. Configure action: Update Record, Set Assignment Group = Network Team
8. Drag "End" node, connect to Action
9. Click "Test" - verify validation passes
10. Click "Activate"

**Expected Result:**
- Workflow creates successfully
- No errors during creation
- Test passes validation
- Workflow activates immediately
- New network incidents auto-assign to Network Team

**Pass/Fail:** _______

**Notes:** _______________________________

---

### Scenario 2: Create Multi-Stage Approval
**Objective:** Verify complex approval workflows

**Steps:**
1. Create workflow: "Change Approval Flow"
2. Trigger: Change Submitted, Type = Normal
3. Add Approval node: Manager (Dynamic: Requester's Manager)
4. Add Approval node: Director (Dynamic: Manager's Manager)
5. Add Condition node after Director approval
6. If Approved: Update state to "Approved"
7. If Rejected: Update state to "Rejected"
8. Add notification nodes for both paths
9. Test with sample change
10. Activate

**Expected Result:**
- Sequential approvals route correctly
- Each approver receives notification
- Rejection terminates workflow
- Approval continues to next stage
- Final state updates correctly

**Pass/Fail:** _______

---

## SLA Management UAT

### Scenario 3: SLA Breach Prevention
**Objective:** Verify SLA warnings help prevent breaches

**Steps:**
1. Create incident with 1-hour resolution SLA
2. Wait until SLA reaches 75% (45 minutes)
3. Verify warning notification received
4. Check SLA widget shows warning color
5. Wait until 90% (54 minutes)
6. Verify escalation notification to manager
7. Resolve incident before breach
8. Verify SLA marked as "Completed" not "Breached"

**Expected Result:**
- 75% warning sent on time
- 90% escalation sent on time
- Visual indicators update correctly
- Manager notified at 90%
- SLA completes successfully

**Pass/Fail:** _______

---

## Notification Center UAT

### Scenario 4: Notification Preferences
**Objective:** Verify users can control notification delivery

**Steps:**
1. Navigate to Profile > Notification Preferences
2. Set Quiet Hours: 10 PM - 7 AM
3. Configure channels:
   - Assignments: Email + In-App
   - Approvals: Email + SMS + Push
   - Comments: In-App only
4. Enable digest mode: Daily at 9 AM
5. Save preferences
6. Create test notifications during quiet hours
7. Create test notifications during active hours
8. Verify delivery matches preferences

**Expected Result:**
- Quiet hours respected (urgent only)
- Channels match preferences
- Digest batches non-urgent items
- No notification fatigue

**Pass/Fail:** _______

---

## Mobile App UAT

### Scenario 5: Mobile Approvals
**Objective:** Verify mobile approval experience

**Steps:**
1. Open mobile app
2. Navigate to Approvals tab
3. View pending approval
4. Swipe right to approve
5. Add approval comment
6. Submit approval
7. Verify approval processed
8. Verify next approver notified

**Expected Result:**
- Swipe gesture works smoothly
- Approval details clearly visible
- Comments easy to add
- Submission confirms immediately
- Workflow continues correctly

**Pass/Fail:** _______
```

---

## Test Automation

### CI/CD Pipeline Tests

```yaml
# .github/workflows/phase-4-tests.yml

name: Phase 4 Tests

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:unit
      - uses: codecov/codecov-action@v2

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
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
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/hubblewave_test
          REDIS_URL: redis://localhost:6379

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npx playwright install
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v2
        if: failure()
        with:
          name: playwright-screenshots
          path: test-results/

  performance-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    steps:
      - uses: actions/checkout@v2
      - uses: grafana/k6-action@v0.2.0
        with:
          filename: k6/workflow-load-test.js
          cloud: true
          token: ${{ secrets.K6_CLOUD_TOKEN }}
```

---

## Conclusion

This comprehensive test plan ensures Phase 4 features are thoroughly tested across all dimensions: functionality, performance, security, and user experience. Follow this plan to deliver a high-quality, production-ready system.

**Test Coverage Goals:**
- Unit Tests: 80%+
- Integration Tests: 70%+
- E2E Tests: Critical paths covered
- Performance: Meet all benchmarks
- Security: Zero critical vulnerabilities
- UAT: 100% scenarios pass

**Next Steps:**
1. Review test plan with QA team
2. Set up test environments
3. Implement automated tests
4. Execute UAT with pilot users
5. Address all findings
6. Sign-off for production deployment
