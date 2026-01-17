# Phase 4: AVA Knowledge Base

**Purpose:** Training data and knowledge for AVA's Phase 4 capabilities
**Scope:** Workflows, SLA management, notifications, approvals
**Format:** Structured data for AVA's learning and response generation

---

## Table of Contents

1. [Workflow Best Practices](#workflow-best-practices)
2. [SLA Configuration Guidance](#sla-configuration-guidance)
3. [Notification Channel Selection](#notification-channel-selection)
4. [Approval Workflow Patterns](#approval-workflow-patterns)
5. [Common Scenarios](#common-scenarios)
6. [Troubleshooting Guide](#troubleshooting-guide)
7. [Optimization Recommendations](#optimization-recommendations)

---

## Workflow Best Practices

### General Workflow Design Principles

```yaml
workflow_best_practices:
  - principle: "Keep it Simple"
    description: "Start with simple linear workflows before adding complexity"
    examples:
      - "Single action workflows for automation"
      - "Two-step approval workflows"
      - "Basic notification workflows"
    avoid:
      - "Overly complex workflows with 10+ nodes"
      - "Nested loops and recursive calls"
      - "Workflows trying to do too much"

  - principle: "Fail Fast"
    description: "Validate inputs early and provide clear error messages"
    examples:
      - "Check required fields at start"
      - "Validate data before expensive operations"
      - "Provide specific error messages"
    avoid:
      - "Running entire workflow before checking basics"
      - "Generic error messages"
      - "Silent failures"

  - principle: "Idempotent Actions"
    description: "Ensure actions can be safely retried without side effects"
    examples:
      - "Check if record already updated before updating"
      - "Use unique identifiers for created records"
      - "Handle duplicate notifications gracefully"
    avoid:
      - "Creating duplicate records on retry"
      - "Double-sending notifications"
      - "Incrementing counters on retry"

  - principle: "Meaningful Names"
    description: "Use clear, descriptive names for workflows and nodes"
    examples:
      - "Incident Auto-Assignment"
      - "Change Approval - CAB Review"
      - "SLA Breach Escalation"
    avoid:
      - "Workflow 1", "Test Flow"
      - "Node1", "Action"
      - "My Workflow"

  - principle: "Document Intent"
    description: "Add descriptions explaining why workflow exists"
    examples:
      - "Automates assignment to reduce manual routing time"
      - "Ensures CAB approval for high-risk changes"
      - "Prevents SLA breaches through proactive escalation"
    avoid:
      - "Empty descriptions"
      - "Generic descriptions"
      - "Copy-pasted text"
```

### Workflow Performance Guidelines

```yaml
performance_guidelines:
  - guideline: "Minimize API Calls"
    description: "Batch operations when possible"
    bad_example: |
      For each user in list:
        Call API to get user details
        Call API to check permissions
        Call API to update record
    good_example: |
      Get all user IDs
      Call batch API to get user details
      Call batch API to check permissions
      Call batch API to update records
    impact: "10x faster execution"

  - guideline: "Use Conditions Wisely"
    description: "Put most common conditions first"
    bad_example: |
      If rare_condition:
        Do something
      Else if common_condition:
        Do common thing
    good_example: |
      If common_condition:
        Do common thing
      Else if rare_condition:
        Do something
    impact: "Faster average execution time"

  - guideline: "Avoid Long Waits"
    description: "Use event-based triggers instead of polling"
    bad_example: |
      Loop:
        Wait 5 minutes
        Check if condition met
        If yes, continue
    good_example: |
      Wait for field_changed event
      Continue when event fires
    impact: "Immediate response vs polling delay"

  - guideline: "Limit Workflow Depth"
    description: "Avoid deeply nested subflows"
    bad_example: |
      Main Workflow
        → Subflow A
          → Subflow B
            → Subflow C (too deep!)
    good_example: |
      Main Workflow
        → Subflow A
        → Subflow B (parallel or sequential)
    impact: "Easier debugging and maintenance"
```

### Testing Best Practices

```yaml
testing_best_practices:
  - practice: "Test Before Activate"
    steps:
      - "Use Test mode with sample data"
      - "Verify all branches execute correctly"
      - "Check error handling works"
      - "Validate performance is acceptable"
    ava_help: "AVA can generate test scenarios automatically"

  - practice: "Test Edge Cases"
    scenarios:
      - "Empty/null values"
      - "Very long text fields"
      - "Special characters"
      - "Concurrent execution"
      - "Network failures"
    ava_help: "AVA suggests edge cases based on node types"

  - practice: "Monitor After Deployment"
    metrics:
      - "Execution success rate"
      - "Average execution time"
      - "Error frequency and types"
      - "Business impact metrics"
    ava_help: "AVA alerts when metrics deviate from baseline"
```

---

## SLA Configuration Guidance

### SLA Target Setting

```yaml
sla_targets:
  incident:
    priority_critical:
      response: "15 minutes"
      resolution: "4 hours"
      rationale: "Business-critical, immediate attention needed"
      business_hours: false  # 24/7

    priority_high:
      response: "30 minutes"
      resolution: "8 hours"
      rationale: "High impact, urgent but not critical"
      business_hours: true

    priority_medium:
      response: "2 hours"
      resolution: "24 hours"
      rationale: "Standard service level"
      business_hours: true

    priority_low:
      response: "4 hours"
      resolution: "72 hours"
      rationale: "Low impact, can wait"
      business_hours: true

  request:
    standard:
      response: "4 hours"
      fulfillment: "5 business days"
      rationale: "Standard request processing time"

    expedited:
      response: "1 hour"
      fulfillment: "1 business day"
      rationale: "Urgent business need"

  change:
    normal:
      approval: "5 business days"
      implementation: "15 business days"
      rationale: "Allow time for CAB review and planning"

    emergency:
      approval: "2 hours"
      implementation: "4 hours"
      rationale: "Emergency fix needed"
```

### Warning Threshold Configuration

```yaml
warning_thresholds:
  recommended:
    first_warning: 75
    second_warning: 90
    rationale: "Provides adequate time for intervention"

  aggressive:
    first_warning: 50
    second_warning: 75
    rationale: "For very strict SLA requirements"

  relaxed:
    first_warning: 85
    second_warning: 95
    rationale: "For less critical SLAs"

  ava_recommendation: |
    AVA analyzes historical data to recommend optimal thresholds:
    - If 75% warning often arrives too late, suggest 60-70%
    - If warnings cause alert fatigue, suggest 80-85%
    - Adjusts based on team response patterns
```

### Business Hours Best Practices

```yaml
business_hours:
  standard_office:
    schedule:
      monday_friday: "9:00 AM - 5:00 PM"
      saturday_sunday: "Closed"
    timezone: "America/New_York"
    use_for:
      - "Non-critical incidents"
      - "Standard requests"
      - "Normal changes"

  extended_support:
    schedule:
      monday_friday: "7:00 AM - 9:00 PM"
      saturday: "9:00 AM - 5:00 PM"
      sunday: "Closed"
    timezone: "America/New_York"
    use_for:
      - "Medium priority incidents"
      - "Business-critical requests"

  follow_the_sun:
    schedule:
      all_days: "24/7"
    timezone: "UTC"
    regions:
      - "Americas (8 AM - 5 PM EST)"
      - "EMEA (8 AM - 5 PM GMT)"
      - "APAC (8 AM - 5 PM SGT)"
    use_for:
      - "Critical incidents"
      - "Global services"

  holiday_handling:
    - name: "US Federal Holidays"
      dates:
        - "2025-01-01"  # New Year's Day
        - "2025-07-04"  # Independence Day
        - "2025-12-25"  # Christmas
      behavior: "Exclude from business hours"

    - name: "Company Shutdown"
      dates:
        - "2025-12-26 to 2025-12-31"
      behavior: "Emergency support only"
```

### SLA Escalation Strategies

```yaml
escalation_strategies:
  - strategy: "Notify and Increase Priority"
    description: "Alert stakeholders and bump priority"
    thresholds:
      - at: "75%"
        actions:
          - type: "send_notification"
            recipients: ["assigned_user", "assignment_group"]
            template: "sla_warning_75"

      - at: "90%"
        actions:
          - type: "send_notification"
            recipients: ["assigned_user", "manager", "assignment_group"]
            template: "sla_warning_90"
          - type: "update_field"
            field: "priority"
            value: "increase_one_level"

      - at: "100%"
        actions:
          - type: "send_notification"
            recipients: ["assigned_user", "manager", "director"]
            template: "sla_breach"
          - type: "create_task"
            assigned_to: "manager"
            subject: "Review SLA Breach"

  - strategy: "Automatic Reassignment"
    description: "Reassign to more senior resources"
    thresholds:
      - at: "80%"
        actions:
          - type: "check_progress"
            if_no_updates_in: "30 minutes"
            then:
              - type: "assign_to"
                target: "senior_technician"
              - type: "send_notification"
                template: "escalation_reassignment"

  - strategy: "Management Intervention"
    description: "Pull in management early"
    thresholds:
      - at: "60%"
        actions:
          - type: "send_notification"
            recipients: ["manager"]
            template: "early_warning"
            message: "Item at risk, may need assistance"

      - at: "85%"
        actions:
          - type: "create_conference_bridge"
          - type: "send_notification"
            recipients: ["assigned_user", "manager", "subject_matter_experts"]
            template: "war_room_invite"
```

### Pause Condition Patterns

```yaml
pause_conditions:
  - name: "Awaiting Customer"
    condition:
      state: "Awaiting User Info"
    description: "Clock stops when waiting for customer input"
    best_for: ["incidents", "requests"]

  - name: "Awaiting Vendor"
    condition:
      state: "Awaiting Vendor"
    description: "Clock stops when waiting for third party"
    best_for: ["incidents", "change_requests"]

  - name: "Scheduled Maintenance Window"
    condition:
      state: "Scheduled"
      scheduled_start: "not_yet_reached"
    description: "Clock pauses until implementation window"
    best_for: ["changes"]

  - name: "Approval Pending"
    condition:
      state: "Pending Approval"
    description: "Clock stops during approval process"
    best_for: ["requests", "changes"]
    note: "Automatically paused by workflow approval nodes"

  common_mistakes:
    - mistake: "Pausing during active work"
      why_bad: "Allows SLA gaming, masks performance issues"
      example: "Pausing while technician investigates"

    - mistake: "Not documenting pause reasons"
      why_bad: "Difficult to audit, unclear why paused"
      solution: "Always add work note when pausing SLA"

    - mistake: "Forgetting to resume"
      why_bad: "SLA never completes, metrics skewed"
      solution: "Use automated resume conditions"
```

---

## Notification Channel Selection

### Channel Selection Matrix

```yaml
channel_selection:
  email:
    best_for:
      - "Detailed information"
      - "Non-urgent updates"
      - "Audit trail needed"
      - "External recipients"
    characteristics:
      urgency: "low"
      character_limit: "unlimited"
      rich_formatting: "yes"
      attachment_support: "yes"
      cost: "free"
    response_time: "hours to days"
    engagement_rate: "20-40%"

  sms:
    best_for:
      - "Urgent alerts"
      - "Critical incidents"
      - "SLA breaches"
      - "Mobile-first users"
    characteristics:
      urgency: "high"
      character_limit: "160 characters"
      rich_formatting: "no"
      attachment_support: "no"
      cost: "$0.01-0.05 per message"
    response_time: "minutes"
    engagement_rate: "90-98%"

  push:
    best_for:
      - "Approvals"
      - "Assignments"
      - "Time-sensitive updates"
      - "Mobile app users"
    characteristics:
      urgency: "medium-high"
      character_limit: "~100 characters"
      rich_formatting: "limited"
      attachment_support: "no"
      cost: "free"
    response_time: "seconds to minutes"
    engagement_rate: "50-70%"

  in_app:
    best_for:
      - "All notification types"
      - "Secondary channel"
      - "Persistent history"
      - "Non-interruptive"
    characteristics:
      urgency: "low-medium"
      character_limit: "flexible"
      rich_formatting: "yes"
      attachment_support: "yes"
      cost: "free"
    response_time: "when user logs in"
    engagement_rate: "100% (when in app)"
```

### Notification Type Recommendations

```yaml
notification_recommendations:
  assignments:
    primary_channel: "email"
    secondary_channels: ["push", "in_app"]
    rationale: "User needs context, not extremely urgent"
    template_tips:
      - "Include incident number and description"
      - "Add priority and SLA information"
      - "Provide direct link to record"

  approvals:
    primary_channel: "email"
    secondary_channels: ["push", "sms"]
    rationale: "Time-sensitive but needs context"
    template_tips:
      - "Summarize what needs approval"
      - "Include risk/impact information"
      - "Add quick action buttons (approve/reject)"
      - "Show due date prominently"

  sla_warnings:
    priority_critical:
      channels: ["sms", "push", "email"]
      rationale: "Very urgent, multi-channel ensures delivery"
    priority_high:
      channels: ["push", "email"]
      rationale: "Urgent but less critical"
    priority_medium_low:
      channels: ["email", "in_app"]
      rationale: "Informational, not urgent"

  sla_breaches:
    channels: ["sms", "push", "email"]
    recipients: ["assigned_user", "manager", "director"]
    rationale: "Critical failure, all hands on deck"
    template_tips:
      - "State breach clearly in subject"
      - "Include breach duration"
      - "Add impact assessment"
      - "Suggest immediate actions"

  status_updates:
    channels: ["in_app", "email"]
    frequency: "digest"
    rationale: "Informational, can be batched"
    template_tips:
      - "Group by record type"
      - "Summarize key changes"
      - "Link to detailed updates"

  comments:
    mentioned:
      channels: ["push", "email", "in_app"]
      rationale: "User was directly mentioned"
    watching:
      channels: ["in_app", "email"]
      frequency: "digest"
      rationale: "User is watching but not directly involved"
```

### User Preference Patterns

```yaml
user_personas:
  - persona: "Mobile-First User"
    characteristics:
      - "Rarely at desktop"
      - "Quick responder"
      - "Prefers short messages"
    recommended_channels:
      approvals: ["push", "sms"]
      assignments: ["push", "in_app"]
      updates: ["in_app"]
    avoid: "Long emails"

  - persona: "Email Power User"
    characteristics:
      - "Always in email client"
      - "Likes detailed information"
      - "Uses folders and rules"
    recommended_channels:
      all_types: ["email", "in_app"]
      urgent_only: ["push"]
    preferences:
      - "Rich HTML emails"
      - "Thread conversations"
      - "Attachments welcome"

  - persona: "Quiet Hours Enforcer"
    characteristics:
      - "Work-life balance focused"
      - "Defined working hours"
      - "Hates after-hours interruptions"
    recommended_settings:
      quiet_hours: "6 PM - 8 AM"
      quiet_hours_exceptions: ["critical_sla_breach"]
      digest_mode: "enabled"
      digest_time: "9:00 AM daily"

  - persona: "Notification Minimalist"
    characteristics:
      - "Overwhelmed by notifications"
      - "Only wants critical items"
      - "Checks app regularly"
    recommended_channels:
      approvals: ["in_app", "email"]
      assignments: ["in_app"]
      everything_else: ["in_app_only"]
    avoid:
      - "Push notifications"
      - "SMS"
      - "Frequent emails"
```

---

## Approval Workflow Patterns

### Common Approval Patterns

```yaml
approval_patterns:
  - pattern: "Single Approver"
    use_when: "Simple approval, one decision maker"
    configuration:
      approver_type: "user"
      approver: "manager"
      timeout: "24 hours"
    example: "Manager approves PTO request"

  - pattern: "Sequential Chain"
    use_when: "Hierarchical approval needed"
    configuration:
      stages:
        - approver: "team_lead"
          timeout: "8 hours"
        - approver: "manager"
          timeout: "24 hours"
        - approver: "director"
          timeout: "48 hours"
    example: "Budget approval chain"

  - pattern: "Parallel Any"
    use_when: "Any one person can approve"
    configuration:
      approvers: ["manager_a", "manager_b", "manager_c"]
      approval_type: "parallel_any"
      timeout: "24 hours"
    example: "Any manager can approve time off"

  - pattern: "Parallel All"
    use_when: "Consensus required"
    configuration:
      approvers: ["legal", "security", "finance"]
      approval_type: "parallel_all"
      timeout: "5 days"
    example: "Vendor contract approval"

  - pattern: "Conditional Routing"
    use_when: "Approver depends on data"
    configuration:
      rules:
        - if: "amount < $1000"
          approver: "manager"
        - if: "amount >= $1000 AND amount < $10000"
          approver: "director"
        - if: "amount >= $10000"
          approver: "vp"
    example: "Purchase approval based on amount"

  - pattern: "Domain Expert Review"
    use_when: "Technical expertise needed"
    configuration:
      stages:
        - approver: "business_owner"
          type: "business_approval"
        - approver: "technical_architect"
          type: "technical_review"
        - approver: "security_team"
          type: "security_review"
    example: "Change advisory board (CAB) review"
```

### Approval Best Practices

```yaml
approval_best_practices:
  - practice: "Set Reasonable Timeouts"
    recommendations:
      urgent: "2-4 hours"
      high_priority: "8-24 hours"
      normal: "1-3 business days"
      low_priority: "5 business days"
    avoid: "Unrealistic timeouts (1 hour for complex approvals)"

  - practice: "Enable Delegation"
    configuration:
      auto_delegate: true
      delegate_to: "out_of_office_proxy"
      delegate_conditions: ["user_on_vacation", "user_out_sick"]
    rationale: "Prevents approval bottlenecks"

  - practice: "Provide Context"
    required_fields:
      - "What is being approved"
      - "Why approval is needed"
      - "Impact of approval/rejection"
      - "Risk assessment"
      - "Cost (if applicable)"
    presentation:
      - "Summarize in notification"
      - "Link to full details"
      - "Highlight key decision factors"

  - practice: "Clear Approval Criteria"
    examples:
      good: |
        Approve if:
        - All required documentation is complete
        - Budget is available
        - Timing does not conflict with other initiatives
        - Risk is acceptable (low or mitigated)
      bad: |
        "Use your judgment"

  - practice: "Audit Trail"
    required_data:
      - "Who approved/rejected"
      - "When decision was made"
      - "Comments provided"
      - "Any delegation that occurred"
    retention: "7 years for financial, 3 years for others"

  - practice: "Escalation Path"
    scenarios:
      timeout: "Auto-escalate to next level manager"
      rejection: "Return to requester with clear reason"
      additional_info_needed: "Request info, pause clock"
    avoid: "Approval requests dying in queue"
```

### Approval Routing Logic

```yaml
routing_logic:
  - logic_type: "Dynamic Field-Based"
    description: "Route based on record field value"
    examples:
      - field: "assigned_to.manager"
        description: "Route to assigned user's manager"
      - field: "department.director"
        description: "Route to department director"
      - field: "location.site_manager"
        description: "Route to site manager for location"
    ava_help: "AVA suggests appropriate field based on approval type"

  - logic_type: "Role-Based"
    description: "Route to user with specific role"
    examples:
      - role: "change_manager"
        description: "Route to anyone with Change Manager role"
      - role: "financial_approver"
        condition: "amount > $5000"
      - role: "security_approver"
        condition: "category = 'Security'"
    ava_help: "AVA maintains role mappings and suggests when to use"

  - logic_type: "Group-Based"
    description: "Route to assignment group"
    examples:
      - group: "CAB"
        approval_type: "parallel_all"
        description: "All CAB members must approve"
      - group: "Finance Team"
        approval_type: "parallel_any"
        description: "Any finance team member can approve"
    ava_help: "AVA suggests appropriate groups based on request type"

  - logic_type: "Hierarchical"
    description: "Follow organizational hierarchy"
    examples:
      - levels: ["manager", "director", "vp"]
        stop_when: "amount < $50000 AND level = 'director'"
      - levels: ["team_lead", "department_head", "division_vp", "ceo"]
        all_levels_required: true
    ava_help: "AVA knows org chart, suggests appropriate chain length"
```

---

## Common Scenarios

### Scenario: Incident Auto-Assignment

```yaml
scenario: "Auto-assign incidents based on category"
workflow:
  trigger:
    type: "record_created"
    table: "incident"

  nodes:
    - type: "condition"
      field: "category"
      branches:
        network:
          - type: "action"
            action: "update_record"
            fields:
              assignment_group: "Network Operations"
              assigned_to: "round_robin"

        hardware:
          - type: "action"
            action: "update_record"
            fields:
              assignment_group: "Hardware Support"
              assigned_to: "round_robin"

        software:
          - type: "action"
            action: "update_record"
            fields:
              assignment_group: "Application Support"
              assigned_to: "round_robin"

        default:
          - type: "action"
            action: "update_record"
            fields:
              assignment_group: "Service Desk"
              assigned_to: "next_available"

    - type: "action"
      action: "send_notification"
      template: "incident_assignment"
      recipients: ["assigned_to"]

  sla_impact: "Speeds up initial response by eliminating manual routing"
  expected_time_savings: "5-10 minutes per incident"
```

### Scenario: Change Approval Flow

```yaml
scenario: "Multi-stage change approval"
workflow:
  trigger:
    type: "field_changed"
    table: "change_request"
    field: "state"
    from: "draft"
    to: "assessment"

  nodes:
    - type: "condition"
      description: "Determine approval path based on risk"
      field: "risk"
      branches:
        high:
          - type: "approval"
            description: "CAB approval required for high risk"
            approver_type: "group"
            approver: "Change Advisory Board"
            approval_type: "parallel_all"
            timeout_hours: 72

        medium:
          - type: "approval"
            description: "Manager and Technical Lead approval"
            stages:
              - approver_type: "dynamic"
                approver_field: "requested_by.manager"
                timeout_hours: 24
              - approver_type: "role"
                approver_role: "technical_lead"
                timeout_hours: 24

        low:
          - type: "approval"
            description: "Manager approval only"
            approver_type: "dynamic"
            approver_field: "requested_by.manager"
            timeout_hours: 8

    - type: "condition"
      description: "Check if approved"
      field: "approval_status"
      branches:
        approved:
          - type: "action"
            action: "update_record"
            fields:
              state: "scheduled"
          - type: "action"
            action: "send_notification"
            template: "change_approved"
            recipients: ["requested_by"]

        rejected:
          - type: "action"
            action: "update_record"
            fields:
              state: "cancelled"
          - type: "action"
            action: "send_notification"
            template: "change_rejected"
            recipients: ["requested_by"]

  compliance: "Ensures proper approval authority based on change risk"
  audit_trail: "Full approval history with timestamps and comments"
```

### Scenario: SLA Breach Prevention

```yaml
scenario: "Proactive SLA breach prevention"
workflow:
  trigger:
    type: "sla_threshold"
    threshold: "75%"

  nodes:
    - type: "condition"
      description: "Check if progress is being made"
      field: "work_notes"
      condition: "updated_in_last_30_minutes"
      branches:
        yes:
          - type: "action"
            description: "Progress is good, just notify"
            action: "send_notification"
            template: "sla_warning_on_track"
            recipients: ["assigned_to"]

        no:
          - type: "action"
            description: "No progress, escalate"
            action: "send_notification"
            template: "sla_warning_no_progress"
            recipients: ["assigned_to", "manager"]

          - type: "condition"
            description: "Check if needs reassignment"
            field: "assigned_to.workload"
            condition: "> 10_active_items"
            branches:
              yes:
                - type: "action"
                  description: "Assigned user overloaded, offer help"
                  action: "create_task"
                  assigned_to: "manager"
                  subject: "Review workload - possible reassignment needed"

  ava_enhancement: |
    AVA predicts breach likelihood:
    - Analyzes similar incidents
    - Considers current workload
    - Factors in time of day/week
    - Recommends preemptive action at 60% if breach likely
```

---

## Troubleshooting Guide

### Common Workflow Issues

```yaml
workflow_troubleshooting:
  - issue: "Workflow not triggering"
    causes:
      - "Workflow not activated"
      - "Trigger conditions not met"
      - "Record doesn't match filter"
      - "Workflow version conflict"
    solutions:
      - "Verify workflow is active"
      - "Check trigger configuration"
      - "Review filter conditions"
      - "Check if newer version exists"
    ava_help: "AVA can diagnose trigger issues automatically"

  - issue: "Workflow stuck in progress"
    causes:
      - "Approval timeout not configured"
      - "Wait node waiting forever"
      - "Infinite loop condition"
      - "External API not responding"
    solutions:
      - "Set timeout on approval nodes"
      - "Add timeout to wait nodes"
      - "Review loop exit conditions"
      - "Add error handling for API calls"
    ava_help: "AVA detects long-running workflows and suggests fixes"

  - issue: "Workflow executing multiple times"
    causes:
      - "Multiple triggers match same event"
      - "Trigger on field that workflow updates"
      - "No deduplication logic"
    solutions:
      - "Review trigger overlap"
      - "Add condition to check if already processed"
      - "Use workflow context to track execution"
    ava_help: "AVA detects duplicate execution patterns"

  - issue: "Approval not routing correctly"
    causes:
      - "Dynamic field value is null"
      - "User not active in system"
      - "Role membership incorrect"
      - "Out-of-office not configured"
    solutions:
      - "Add null checks and fallback approvers"
      - "Validate user status before routing"
      - "Verify role assignments"
      - "Enable auto-delegation"
    ava_help: "AVA suggests fallback approvers based on org structure"
```

### SLA Troubleshooting

```yaml
sla_troubleshooting:
  - issue: "SLA not starting"
    causes:
      - "SLA conditions not met"
      - "Table doesn't match"
      - "Business hours calendar missing"
      - "SLA definition not active"
    solutions:
      - "Review SLA condition logic"
      - "Verify table configuration"
      - "Create/assign business hours"
      - "Activate SLA definition"
    ava_help: "AVA checks all SLA prerequisites"

  - issue: "SLA timer inaccurate"
    causes:
      - "Pause conditions not working"
      - "Business hours misconfigured"
      - "Timezone issues"
      - "Timer service restart"
    solutions:
      - "Verify pause condition logic"
      - "Check business hours calendar"
      - "Confirm timezone settings"
      - "Review timer reconciliation logs"
    ava_help: "AVA compares expected vs actual time, diagnoses issue"

  - issue: "SLA warnings not sending"
    causes:
      - "Threshold percentages incorrect"
      - "Notification template missing"
      - "Recipient field empty"
      - "Quiet hours blocking send"
    solutions:
      - "Verify threshold configuration (0-100)"
      - "Create/assign notification template"
      - "Set default recipients"
      - "Review quiet hours settings"
    ava_help: "AVA tests notification delivery end-to-end"
```

### Notification Troubleshooting

```yaml
notification_troubleshooting:
  - issue: "Notifications not delivering"
    by_channel:
      email:
        causes:
          - "Invalid email address"
          - "Email bouncing"
          - "Spam filter blocking"
          - "SendGrid API error"
        solutions:
          - "Verify email address format"
          - "Check bounce list"
          - "Whitelist sender domain"
          - "Review SendGrid logs"

      sms:
        causes:
          - "Invalid phone number"
          - "Country not supported"
          - "Carrier blocking"
          - "Insufficient Twilio credits"
        solutions:
          - "Verify phone number format (+1...)"
          - "Check Twilio supported countries"
          - "Contact carrier"
          - "Add Twilio credits"

      push:
        causes:
          - "No device tokens registered"
          - "Token expired"
          - "App uninstalled"
          - "FCM service error"
        solutions:
          - "User needs to log in to mobile app"
          - "Token auto-refreshes on next login"
          - "Remove stale tokens"
          - "Check FCM status"

      in_app:
        causes:
          - "User not logged in"
          - "WebSocket disconnected"
          - "Notification dismissed"
        solutions:
          - "Notification persists until read"
          - "Auto-reconnects on page load"
          - "Can view in notification center"

    ava_help: "AVA checks all channels and reports specific issue"

  - issue: "Too many notifications (fatigue)"
    causes:
      - "No digest mode enabled"
      - "Multiple workflows sending same notification"
      - "Quiet hours not configured"
      - "User subscribed to too many items"
    solutions:
      - "Enable digest mode for non-urgent"
      - "Deduplicate notifications"
      - "Set quiet hours"
      - "Review watched items"
    ava_help: "AVA detects patterns and suggests optimizations"
```

---

## Optimization Recommendations

### Workflow Optimization

```yaml
workflow_optimization:
  - optimization: "Reduce Node Count"
    before: "10 nodes with multiple conditions"
    after: "6 nodes with consolidated logic"
    impact: "40% faster execution"
    how: "Combine related condition nodes, use subflows for reusable logic"

  - optimization: "Parallel Execution"
    before: "Sequential API calls (5 x 1s = 5s)"
    after: "Parallel API calls (max 1s)"
    impact: "80% faster execution"
    how: "Use parallel node execution when operations are independent"

  - optimization: "Early Exit Conditions"
    before: "Check complex conditions at end"
    after: "Check simple conditions first, exit early if not met"
    impact: "Skip 70% of unnecessary processing"
    how: "Put most common/simple conditions first"

  - optimization: "Caching Lookups"
    before: "Lookup user details on every execution"
    after: "Cache user details for 5 minutes"
    impact: "Eliminate 90% of redundant queries"
    how: "Use workflow context to store frequently accessed data"

  - optimization: "Batch Operations"
    before: "Update 100 records in loop (100 API calls)"
    after: "Batch update 100 records (1 API call)"
    impact: "99% fewer API calls"
    how: "Use batch API endpoints when available"
```

### SLA Optimization

```yaml
sla_optimization:
  - optimization: "Right-Size Targets"
    analysis: |
      Review actual resolution times:
      - P1: 95% resolved in 3 hours (target: 4 hours) ✓ Good
      - P2: 60% resolved in 8 hours (target: 8 hours) ✗ Too tight
      - P3: 90% resolved in 12 hours (target: 24 hours) ✗ Too loose
    recommendation: |
      - P1: Keep at 4 hours (comfortable margin)
      - P2: Increase to 12 hours (80% achievable)
      - P3: Reduce to 16 hours (still achievable, more customer value)
    impact: "Better compliance without sacrificing service"

  - optimization: "Adjust Warning Thresholds"
    analysis: |
      75% warning arrives 2 hours before breach
      Team needs 3-4 hours to react effectively
    recommendation: "Lower threshold to 60-65%"
    impact: "More time to prevent breaches"

  - optimization: "Automated Pause/Resume"
    before: "Manual pause when customer contacted"
    after: "Auto-pause when state = 'Awaiting User Info'"
    impact: "Accurate SLA tracking, no manual intervention"
    implementation: "Set pause conditions on SLA definition"

  - optimization: "Smart Escalation"
    before: "Escalate all items at 90%"
    after: |
      Escalate at 90% only if:
      - No work notes in last 30 minutes
      - Assigned user has >10 active items
      - Item is business-critical
    impact: "50% fewer false escalations"
```

### Notification Optimization

```yaml
notification_optimization:
  - optimization: "Digest Mode for Low Priority"
    before: "Send 50 low-priority notifications individually"
    after: "Batch into daily digest"
    impact: "50 notifications → 1 digest"
    user_satisfaction: "Much higher (not overwhelmed)"

  - optimization: "Smart Channel Selection"
    analysis: |
      User A: Opens push notifications in 2 minutes, emails in 2 hours
      User B: Never opens push, reads all emails
    recommendation: |
      User A: Prefer push for time-sensitive, email for detailed
      User B: Email for everything
    implementation: "AVA learns and adjusts automatically"

  - optimization: "Deduplicate Cross-Channel"
    before: "Same notification sent via email, push, and in-app"
    after: "Push notification, in-app backup, email only if not seen in 1 hour"
    impact: "67% fewer notifications, same effective delivery"

  - optimization: "Suppress Low-Value Notifications"
    analysis: |
      "Workflow completed" notifications:
      - Open rate: 5%
      - Click rate: 0.1%
      Conclusion: Users don't care
    recommendation: "Stop sending, or make in-app only"
    impact: "Reduce notification volume 20%"

  - optimization: "Personalized Timing"
    analysis: "User checks notifications at 9 AM, 1 PM, 5 PM"
    before: "Send immediately at any time"
    after: "Batch and send at 9 AM unless urgent"
    impact: "Higher engagement, less interruption"
```

---

## AVA Learning & Improvement

### Continuous Learning

```yaml
ava_learning:
  - learning_type: "Usage Patterns"
    data_collected:
      - "Which workflows users create most"
      - "Common node combinations"
      - "Frequent error patterns"
      - "Success rates by pattern"
    application:
      - "Suggest templates based on similar needs"
      - "Warn about error-prone patterns"
      - "Recommend proven patterns"

  - learning_type: "Performance Metrics"
    data_collected:
      - "Workflow execution times"
      - "SLA compliance rates"
      - "Notification engagement rates"
      - "User satisfaction scores"
    application:
      - "Identify optimization opportunities"
      - "Recommend SLA target adjustments"
      - "Suggest notification channel changes"

  - learning_type: "User Behavior"
    data_collected:
      - "When users respond to notifications"
      - "Which channels they prefer"
      - "How quickly they act on approvals"
      - "When they're most active"
    application:
      - "Optimize notification timing"
      - "Adjust quiet hours automatically"
      - "Recommend channel preferences"

  - learning_type: "Industry Best Practices"
    data_collected:
      - "Anonymized metrics from all customers"
      - "Successful pattern implementations"
      - "Common pitfalls and solutions"
    application:
      - "Recommend industry-standard targets"
      - "Suggest proven workflow patterns"
      - "Warn about known anti-patterns"
```

### AVA Proactive Recommendations

```yaml
proactive_recommendations:
  - recommendation: "Workflow Optimization"
    trigger: "Workflow execution time > 2x baseline"
    message: |
      "I noticed your 'Change Approval' workflow is taking 45 seconds to execute,
      up from a baseline of 20 seconds. I found 3 optimization opportunities:

      1. Combine 4 similar condition nodes (saves 8 seconds)
      2. Cache user lookups (saves 12 seconds)
      3. Make API calls parallel (saves 5 seconds)

      Would you like me to apply these optimizations?"

  - recommendation: "SLA Target Adjustment"
    trigger: "Compliance rate < 85% or > 98% for 30 days"
    message: |
      "Your P2 incident resolution SLA compliance is 73% over the last 30 days.
      Analysis shows:

      - 95% percentile resolution time: 10.5 hours
      - Current target: 8 hours
      - Recommended target: 12 hours

      Adjusting to 12 hours would achieve 92% compliance while still providing
      excellent service. Would you like me to update this?"

  - recommendation: "Notification Channel Change"
    trigger: "Channel engagement < 20% for 7 days"
    message: |
      "I notice you rarely open push notifications for 'Comment Added' events
      (3% open rate). However, you read these in the app within 2 hours.

      Recommendation: Change 'Comment Added' to in-app only, disable push.

      This would reduce interruptions while ensuring you still see these updates.
      Apply this change?"

  - recommendation: "Approval Delegation Setup"
    trigger: "Approvals timing out due to OOO"
    message: |
      "Mike Johnson's approvals timed out 3 times this week while he's on vacation.

      I found that Sarah Chen typically serves as backup when Mike is out.

      Would you like me to:
      1. Set up auto-delegation when Mike has OOO status
      2. Delegate to Sarah Chen
      3. Notify Mike when delegation occurs

      This would prevent future approval bottlenecks."
```

---

## Conclusion

This knowledge base enables AVA to provide intelligent, context-aware guidance for all Phase 4 features. AVA uses this information to:

1. **Help users create better workflows** - Suggest patterns, avoid pitfalls
2. **Optimize SLA management** - Recommend targets, adjust thresholds
3. **Improve notification delivery** - Select channels, reduce fatigue
4. **Streamline approvals** - Route efficiently, prevent bottlenecks
5. **Learn and improve** - Continuously refine recommendations

**AVA's Value Proposition:**
- **70% faster workflow creation** via natural language and templates
- **40% reduction in SLA breaches** via predictive alerts
- **67% reduction in notification fatigue** via intelligent routing
- **Continuous improvement** via learning and optimization

This makes HubbleWave not just a platform, but an **intelligent partner** that helps organizations work smarter, faster, and better.
