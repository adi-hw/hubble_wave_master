# Phase 3: AVA Knowledge Base

**Document Type:** AI Training Data & Knowledge Base
**Audience:** AI/ML Team, AVA Development
**Status:** Planning Phase

## Table of Contents

1. [Overview](#overview)
2. [Rule Types Knowledge](#rule-types-knowledge)
3. [Trigger Event Knowledge](#trigger-event-knowledge)
4. [Common Patterns](#common-patterns)
5. [Troubleshooting Knowledge](#troubleshooting-knowledge)
6. [Best Practices](#best-practices)
7. [Natural Language Patterns](#natural-language-patterns)
8. [Error Messages & Solutions](#error-messages--solutions)

---

## Overview

This knowledge base provides AVA with the information needed to:
1. Understand user intent when creating automation
2. Suggest appropriate rule types and configurations
3. Debug failing rules
4. Recommend optimizations
5. Guide users through automation workflows

---

## Rule Types Knowledge

### Business Rules

**Purpose**: Automated actions triggered by record operations

**When to Use**:
- "Send an email when..." → Business Rule with After trigger
- "Automatically assign when..." → Business Rule with Before trigger
- "Update related records when..." → Business Rule with After trigger
- "Prevent saving if..." → Business Rule with Before trigger + abort

**When NOT to Use**:
- "Every day at 9 AM..." → Use Scheduled Job instead
- "Calculate total price..." → Use Calculated Property instead
- "Show/hide field when..." → Use Client Script instead
- "Prevent invalid data..." → Use Validation Rule instead

**Examples**:
```
User: "Send an email when an incident is resolved"
AVA: I'll create a Business Rule for you:
     - Trigger: After Update
     - Condition: Status changed to "Resolved"
     - Action: Send Email to Assigned To

User: "Update all related tasks when a project is closed"
AVA: I'll create a Business Rule for you:
     - Trigger: After Update
     - Condition: Status changed to "Closed"
     - Action: Update Related Records (Tasks)
       Set Status = "Closed" on all child Tasks
```

---

### Scheduled Jobs

**Purpose**: Time-based automation that processes multiple records

**When to Use**:
- "Every day at..." → Scheduled Job (cron)
- "Every Monday..." → Scheduled Job (weekly)
- "Once on..." → Scheduled Job (one-time)
- "Clean up old records..." → Scheduled Job
- "Generate daily report..." → Scheduled Job

**When NOT to Use**:
- "When a record is created..." → Use Business Rule instead
- "Calculate this property..." → Use Calculated Property instead
- "Validate before saving..." → Use Validation Rule instead

**Examples**:
```
User: "Delete draft incidents older than 30 days every night"
AVA: I'll create a Scheduled Job for you:
     - Schedule: Daily at 2:00 AM
     - Collection: Incident
     - Conditions: Status = "Draft" AND Created > 30 days ago
     - Action: Delete Record

User: "Send a weekly summary of open incidents to managers every Monday"
AVA: I'll create a Scheduled Job for you:
     - Schedule: Weekly, Monday at 9:00 AM
     - Collection: Incident
     - Conditions: Status = "Open"
     - Action: Send Email to Role "Manager"
       Include summary of open incidents
```

---

### Validation Rules

**Purpose**: Prevent invalid data from being saved

**When to Use**:
- "Make sure..." → Validation Rule
- "Prevent..." → Validation Rule
- "Require... when..." → Validation Rule
- "End date must be after start date" → Validation Rule
- "Manager approval required for..." → Validation Rule

**When NOT to Use**:
- "Send an email when..." → Use Business Rule instead
- "Calculate..." → Use Calculated Property instead
- "Show/hide field..." → Use Client Script instead

**Examples**:
```
User: "Make sure the end date is after the start date"
AVA: I'll create a Validation Rule for you:
     - Name: "End Date After Start Date"
     - Condition: End Date < Start Date
     - Error: "End Date must be on or after Start Date"

User: "Require manager approval for purchases over $5,000"
AVA: I'll create a Validation Rule for you:
     - Name: "Manager Approval for High-Value Purchases"
     - Condition: Amount > 5000 AND Manager Approval is empty
     - Error: "Manager approval required for amounts over $5,000"
```

---

### Calculated Properties

**Purpose**: Auto-compute property values based on formulas

**When to Use**:
- "Calculate..." → Calculated Property
- "Add quantity and price..." → Calculated Property
- "Compute total..." → Calculated Property
- "Count related records..." → Calculated Property (Rollup)
- "Days between dates..." → Calculated Property (Duration)

**When NOT to Use**:
- "Send an email when..." → Use Business Rule instead
- "Every day at..." → Use Scheduled Job instead
- "Make sure..." → Use Validation Rule instead

**Examples**:
```
User: "Calculate total price as quantity times unit price"
AVA: I'll create a Calculated Property for you:
     - Property: Total Price
     - Formula: [Quantity] * [Unit Price]
     - Type: Display-only (recalculates on view)

User: "Calculate the total with tax and discount"
AVA: I'll create a Calculated Property for you:
     - Property: Total Amount
     - Formula: ([Quantity] * [Unit Price]) * (1 - [Discount]/100) * (1 + [Tax Rate]/100)
     - Type: Stored (saves to database)

User: "Count how many tasks are in this project"
AVA: I'll create a Calculated Property (Rollup) for you:
     - Property: Task Count
     - Type: Rollup
     - Related Collection: Tasks
     - Function: COUNT
     - Filter: Status != "Cancelled"
```

---

### Client Scripts

**Purpose**: Dynamic UI behaviors without page reload

**When to Use**:
- "Show/hide field when..." → Client Script (onChange)
- "Make field required when..." → Client Script (onChange)
- "Set default value based on..." → Client Script (onLoad)
- "Show warning when..." → Client Script (onChange)
- "Populate field when..." → Client Script (onChange)

**When NOT to Use**:
- "Send an email when..." → Use Business Rule instead
- "Calculate..." → Use Calculated Property instead
- "Prevent saving if..." → Use Validation Rule instead

**Examples**:
```
User: "Show the escalation manager field only when priority is critical"
AVA: I'll create a Client Script for you:
     - Type: onChange
     - Property: Priority
     - If: Priority = "Critical"
       Then: Show property "Escalation Manager"
       Else: Hide property "Escalation Manager"

User: "Make business impact required when priority is high or critical"
AVA: I'll create a Client Script for you:
     - Type: onChange
     - Property: Priority
     - If: Priority in ["High", "Critical"]
       Then: Make "Business Impact" required
       Else: Make "Business Impact" optional
```

---

## Trigger Event Knowledge

### When to Use Each Trigger Type

#### Before Insert
**Use Cases**:
- Set default values
- Auto-populate properties
- Validate before saving
- Generate unique identifiers
- Normalize data

**Example Prompts**:
- "Auto-populate created by and created date"
- "Generate a unique incident number"
- "Set default priority based on category"

---

#### After Insert
**Use Cases**:
- Send notifications
- Create related records
- Update parent records
- Log creation events
- Trigger workflows

**Example Prompts**:
- "Send email when incident is created"
- "Create default tasks when project is created"
- "Notify manager when request is submitted"

---

#### Before Update
**Use Cases**:
- Validate changes before saving
- Prevent unauthorized updates
- Log changes
- Auto-update timestamps

**Example Prompts**:
- "Prevent changing status if not authorized"
- "Update 'Updated By' and 'Updated Date'"
- "Require resolution notes when resolving"

---

#### After Update
**Use Cases**:
- Send change notifications
- Update related records
- Cascade status changes
- Log changes
- Trigger workflows

**Example Prompts**:
- "Email assigned user when incident is updated"
- "Update parent status when all children are complete"
- "Log status changes to audit trail"

---

#### Before Delete
**Use Cases**:
- Prevent deletion of records with dependencies
- Validate deletion permissions
- Warn before deletion

**Example Prompts**:
- "Prevent deleting projects with active tasks"
- "Require admin permission to delete"

---

#### After Delete
**Use Cases**:
- Delete related records (cascade)
- Send notifications
- Log deletions
- Clean up references

**Example Prompts**:
- "Delete all tasks when project is deleted"
- "Notify manager when employee is deleted"
- "Log deletion to audit trail"

---

## Common Patterns

### Pattern 1: Auto-Assignment

**User Intent**: Automatically assign records based on conditions

**Common Phrases**:
- "Assign to [team] when [condition]"
- "Set assigned to [user] if [condition]"
- "Route to [team] based on [property]"

**AVA Response Template**:
```
I'll create a Business Rule to auto-assign:

WHEN: [Collection] is created or updated
IF: [Condition]
THEN: Set [Assignment Property] = [Value]
```

**Example**:
```
User: "Assign critical incidents to the Network team when unassigned"

AVA: I'll create a Business Rule:
     - Trigger: Before Insert, Before Update
     - Conditions:
       - Priority = "Critical"
       - Assignment Group is empty
     - Actions:
       - Set Assignment Group = "Network Operations"
       - Set Assigned To = "Network Queue"
```

---

### Pattern 2: Status Change Notification

**User Intent**: Send notification when status changes

**Common Phrases**:
- "Send email when status changes to [value]"
- "Notify [recipient] when [property] becomes [value]"
- "Alert [user] if status is [value]"

**AVA Response Template**:
```
I'll create a Business Rule to send notifications:

WHEN: [Collection] is updated
IF: [Property] changed to [Value]
THEN: Send [Notification Type] to [Recipient]
```

**Example**:
```
User: "Email the assigned user when an incident is resolved"

AVA: I'll create a Business Rule:
     - Trigger: After Update
     - Conditions:
       - Status changed to "Resolved"
     - Actions:
       - Send Email to Assigned To
         Subject: "Incident [Number] Resolved"
         Body: "Your incident has been resolved..."
```

---

### Pattern 3: Cascading Updates

**User Intent**: Update related records when parent changes

**Common Phrases**:
- "Update all [child records] when [parent] changes"
- "Cascade [property] to related [records]"
- "Set [property] on all child [records]"

**AVA Response Template**:
```
I'll create a Business Rule to cascade updates:

WHEN: [Parent Collection] is updated
IF: [Condition]
THEN: Update all related [Child Collection]
      Set [Property] = [Value]
```

**Example**:
```
User: "Close all tasks when project is closed"

AVA: I'll create a Business Rule:
     - Trigger: After Update
     - Conditions:
       - Status changed to "Closed"
     - Actions:
       - Update Related Records (Tasks)
         Set Status = "Closed"
         Set Closed Date = NOW()
```

---

### Pattern 4: Data Validation

**User Intent**: Ensure data integrity with validation

**Common Phrases**:
- "Make sure [property] is [condition]"
- "Prevent saving if [condition]"
- "Require [property] when [condition]"
- "[Property] must be [condition]"

**AVA Response Template**:
```
I'll create a Validation Rule:

Record is INVALID when: [Condition]
Error Message: [User-friendly message]
```

**Example**:
```
User: "Make sure the end date is after the start date"

AVA: I'll create a Validation Rule:
     - Name: "End Date After Start Date"
     - Invalid when: End Date < Start Date
     - Error: "End Date must be on or after Start Date"

User: "Require resolution notes when resolving incidents"

AVA: I'll create a Validation Rule:
     - Name: "Resolution Notes Required"
     - Invalid when:
       - Status = "Resolved"
       - Resolution Notes is empty
     - Error: "Resolution Notes are required when resolving incidents"
```

---

### Pattern 5: Scheduled Cleanup

**User Intent**: Periodically delete or archive old records

**Common Phrases**:
- "Delete [records] older than [timeframe]"
- "Clean up [status] records every [frequency]"
- "Archive [records] after [timeframe]"

**AVA Response Template**:
```
I'll create a Scheduled Job:

Schedule: [Frequency] at [Time]
Collection: [Collection Name]
Conditions: [Filters]
Action: [Delete/Update]
```

**Example**:
```
User: "Delete draft incidents older than 30 days every night"

AVA: I'll create a Scheduled Job:
     - Name: "Cleanup Old Drafts"
     - Schedule: Daily at 2:00 AM
     - Collection: Incident
     - Conditions:
       - Status = "Draft"
       - Created Date > 30 days ago
     - Action: Delete Record

     This will run daily and clean up old draft incidents.
     Estimated records to process: ~50 per day
```

---

### Pattern 6: Calculated Totals

**User Intent**: Calculate values based on other properties

**Common Phrases**:
- "Calculate [property] as [formula]"
- "Add [property1] and [property2]"
- "Compute [property] based on [other properties]"

**AVA Response Template**:
```
I'll create a Calculated Property:

Property: [Property Name]
Formula: [Formula Expression]
Type: [Display-only / Stored]
```

**Example**:
```
User: "Calculate total price as quantity times unit price"

AVA: I'll create a Calculated Property:
     - Property: Total Price
     - Formula: [Quantity] * [Unit Price]
     - Type: Display-only (recalculates on view)

     Example: Quantity = 10, Unit Price = $50
     Result: $500

User: "Calculate the final amount with tax and discount"

AVA: I'll create a Calculated Property:
     - Property: Final Amount
     - Formula: ([Quantity] * [Unit Price]) * (1 - [Discount]/100) * (1 + [Tax]/100)
     - Type: Stored (saves to database)

     This accounts for:
     - Quantity × Unit Price = Subtotal
     - Apply Discount percentage
     - Apply Tax percentage
     - Result is stored for faster retrieval
```

---

## Troubleshooting Knowledge

### Common Error Patterns

#### Error: "Property does not exist"

**Cause**: Rule references a property that doesn't exist in the collection

**AVA Diagnosis**:
```
I found the issue:

Your rule references the property "[Property Name]" which doesn't
exist in the [Collection Name] collection.

Did you mean one of these?
- [Similar Property 1]
- [Similar Property 2]
- [Similar Property 3]

Or would you like to create the "[Property Name]" property?

[Use [Similar Property 1]]  [Create New Property]  [Cancel]
```

---

#### Error: "Infinite loop detected"

**Cause**: Rule triggers itself repeatedly

**AVA Diagnosis**:
```
⚠️ Infinite loop detected!

Your rule "[Rule Name]" is creating an infinite loop.

Cause:
The rule updates property "[Property]" which triggers the same
rule again, creating an endless cycle.

How to fix:
1. Add a condition to prevent re-execution:
   IF [Updated By Rule] is empty

2. Change trigger timing from "After Update" to "Before Update"

3. Disable recursive execution in Advanced Options

[Fix Automatically]  [Show Me How]  [Learn More]
```

---

#### Error: "Email notification failed"

**Cause**: Email server issue or invalid recipient

**AVA Diagnosis**:
```
Your rule "[Rule Name]" failed to send email notifications.

Root Cause:
[Specific error: SMTP timeout / Invalid recipient / etc.]

Impact:
✓ Other actions executed successfully
✗ Email notification did not send

Recommendation:
1. Check email server status
2. Verify recipient email addresses
3. Make email notification optional (continue on error)

Would you like to:
[Retry Failed Emails]  [Check Email Settings]  [Make Optional]
```

---

#### Error: "Performance degradation"

**Cause**: Rule taking too long to execute

**AVA Diagnosis**:
```
📊 Performance Alert

Your rule "[Rule Name]" is running slower than expected.

Current Performance:
- Average execution time: 850ms
- Recommended: < 200ms
- Slowdown: 4.3x slower

Cause:
The rule queries [15] related records on every execution.

Recommendations:
1. Convert to stored calculation (recalculate only when needed)
2. Add indexes to related collections
3. Reduce number of actions
4. Use async execution (non-blocking)

Estimated improvement: 850ms → 45ms (95% faster)

[Apply Optimization]  [View Details]  [Dismiss]
```

---

#### Error: "Validation rule too strict"

**Cause**: Validation preventing legitimate saves

**AVA Diagnosis**:
```
Your validation rule "[Rule Name]" has prevented [25] legitimate
saves in the past week.

Analysis:
The rule blocks saves when: [Condition]

Recent blocks:
- User tried to save: [Scenario 1]
- User tried to save: [Scenario 2]
- User tried to save: [Scenario 3]

Recommendation:
Consider making the validation less strict:

Current: [Property] must be [Condition]
Suggested: [Property] should be [Condition] (warning instead of error)

[Adjust Rule]  [Keep Current]  [View All Blocks]
```

---

## Best Practices

### Performance Best Practices

**AVA Recommendations**:

1. **Use Before Triggers for Simple Updates**
```
Instead of: After Update + Update Record
Use: Before Update + Set Property

Why: Avoids extra database write
Improvement: 2x faster
```

2. **Store Frequently-Accessed Calculations**
```
Instead of: Display-only calculated property
Use: Stored calculation

When: Property is read often but changes rarely
Improvement: 10x faster reads
```

3. **Use Async Execution for Non-Critical Actions**
```
Instead of: Synchronous email notification
Use: Async execution

Why: Doesn't block user's save operation
Improvement: Better user experience
```

4. **Batch Updates in Scheduled Jobs**
```
Instead of: Multiple individual updates
Use: Bulk update in single query

Why: Reduces database roundtrips
Improvement: 50x faster for 1000 records
```

---

### Security Best Practices

**AVA Recommendations**:

1. **Audit Sensitive Actions**
```
For rules that:
- Delete records
- Modify permissions
- Access PII data

Add: Audit log action to track who triggered the rule
```

2. **Validate User Permissions**
```
For sensitive operations, add condition:
IF Current User Role in ["Admin", "Manager"]

This ensures only authorized users trigger the rule
```

3. **Sanitize User Input**
```
When using user-provided values in formulas or notifications,
ensure proper sanitization to prevent injection attacks.
```

---

### Maintainability Best Practices

**AVA Recommendations**:

1. **Use Descriptive Names**
```
Instead of: "Rule 1", "Email Rule"
Use: "Auto-assign Critical Incidents to Network Team"

Why: Self-documenting, easy to find
```

2. **Add Descriptions**
```
Always include a description explaining:
- What the rule does
- Why it exists
- When it was created
- Who requested it
```

3. **Test Before Activating**
```
Use the built-in test console to verify:
- Conditions evaluate correctly
- Actions execute as expected
- Performance is acceptable
```

4. **Monitor After Deployment**
```
After activating a new rule:
- Check execution logs for first few runs
- Verify success rate
- Monitor performance
- Confirm expected behavior
```

---

## Natural Language Patterns

### Intent Recognition Training

**Create Business Rule Intent**:
```
Phrases:
- "create a rule that..."
- "send an email when..."
- "automatically assign..."
- "update records when..."
- "notify [someone] if..."

Entity Extraction:
- Collection: "incidents", "tasks", "projects"
- Trigger: "when created", "when updated", "when deleted"
- Condition: "priority is critical", "status changes to resolved"
- Action: "send email", "assign to", "set property", "create record"
```

---

**Create Validation Rule Intent**:
```
Phrases:
- "make sure..."
- "prevent..."
- "require... when..."
- "validate that..."
- "don't allow..."

Entity Extraction:
- Validation Type: "must be", "cannot be", "should be"
- Properties: "[property name]"
- Comparison: "greater than", "less than", "equals"
- Error Message: user's description or generate helpful default
```

---

**Create Calculated Property Intent**:
```
Phrases:
- "calculate..."
- "compute..."
- "add... and..."
- "multiply... by..."
- "total of..."
- "sum of..."
- "count..."

Entity Extraction:
- Property: "total price", "final amount", "task count"
- Operation: "add", "subtract", "multiply", "divide", "count"
- Operands: property names or values
```

---

**Create Scheduled Job Intent**:
```
Phrases:
- "every day at..."
- "every monday..."
- "once a week..."
- "daily at..."
- "clean up..."
- "delete old..."

Entity Extraction:
- Frequency: "daily", "weekly", "monthly", "once"
- Time: "9 AM", "2:00 PM", "midnight"
- Collection: "incidents", "tasks"
- Condition: "older than 30 days", "status is draft"
- Action: "delete", "archive", "send report"
```

---

### Disambiguation Patterns

**When User Intent is Unclear**:

```
User: "Send a notification"

AVA: I can help with that! A few questions:

     1. When should the notification be sent?
        ○ When a record is created/updated
        ○ On a schedule (daily, weekly, etc.)

     2. What collection should trigger this?
        [Select collection ▼]

     3. Who should receive the notification?
        ○ Property value (e.g., Assigned To)
        ○ Specific users
        ○ Role
        ○ Email addresses

[Continue]
```

---

**When Multiple Approaches Possible**:

```
User: "Calculate the total price"

AVA: I can help! I noticed you could do this in two ways:

     Option 1: Calculated Property (Recommended)
     - Automatically computes on every view
     - No manual recalculation needed
     - Best for: [Quantity] * [Unit Price]

     Option 2: Business Rule
     - Computes once when record is saved
     - Doesn't recalculate on view
     - Best for: Complex calculations with many steps

     Which approach would you prefer?

     [Use Calculated Property]  [Use Business Rule]
```

---

## Error Messages & Solutions

### User-Friendly Error Messages

**Instead of Technical Errors**:

❌ **Bad**: "TypeError: Cannot read property 'email' of null"

✅ **Good**: "The Assignment Group Manager property is empty. Please ensure all Assignment Groups have a manager assigned, or modify the rule to handle empty values."

---

❌ **Bad**: "ReferenceError: priority is not defined"

✅ **Good**: "The property 'Priority' doesn't exist in the Incident collection. Did you mean 'Urgency' or 'Impact'?"

---

❌ **Bad**: "Maximum call stack size exceeded"

✅ **Good**: "This rule is creating an infinite loop by triggering itself repeatedly. Add a condition to prevent re-execution, such as checking if the record was already updated by this rule."

---

### Solution-Oriented Responses

**Pattern**: Error + Cause + Solution + Action

```
Error: Email notification failed

Cause: The SMTP server at mail.company.com is not responding

Impact:
✓ Assignment Group was set correctly
✗ Email notification did not send

Solution:
1. Check email server status
2. Verify SMTP settings in Admin > Email Configuration
3. Retry failed notifications
4. Or, make email optional (continue rule even if email fails)

[Retry Emails]  [Check Settings]  [Make Optional]  [Contact Support]
```

---

**Document Version:** 1.0
**Last Updated:** 2025-12-30
**AVA Training Model:** Claude Opus 4.5
**Knowledge Base Status:** Active
