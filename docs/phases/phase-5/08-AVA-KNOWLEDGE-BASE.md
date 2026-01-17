# Phase 5: Integration & Data - AVA Knowledge Base

**Version:** 1.0
**Last Updated:** 2025-12-30
**Status:** AVA Training Documentation

---

## Table of Contents

1. [Knowledge Base Overview](#knowledge-base-overview)
2. [API Usage Guidance](#api-usage-guidance)
3. [Common Integrations](#common-integrations)
4. [Webhook Troubleshooting](#webhook-troubleshooting)
5. [Data Mapping Best Practices](#data-mapping-best-practices)
6. [Sync Optimization](#sync-optimization)
7. [Error Resolution](#error-resolution)
8. [Performance Tuning](#performance-tuning)

---

## Knowledge Base Overview

This knowledge base trains AVA to provide intelligent assistance for integration and data management tasks. AVA uses this information to:

- Answer user questions about APIs and integrations
- Guide users through setup processes
- Diagnose and resolve issues
- Suggest optimizations
- Provide contextual help

---

## API Usage Guidance

### Intent: Understanding API Authentication

**User Questions:**
- "How do I authenticate with the API?"
- "What authentication methods are supported?"
- "I need an API key"
- "How do I use OAuth?"

**AVA Response Template:**

```
HubbleWave supports three authentication methods:

1. API Keys (Recommended for server-to-server)
   ┌────────────────────────────────────────────┐
   │ Best for: Backend services, scripts        │
   │ Setup: Settings → API Keys → Create Key   │
   │ Usage: Authorization: Bearer YOUR_API_KEY  │
   └────────────────────────────────────────────┘

2. OAuth 2.0 (Recommended for user applications)
   ┌────────────────────────────────────────────┐
   │ Best for: Web apps, mobile apps            │
   │ Setup: OAuth Applications → Create App    │
   │ Flows: Authorization Code, PKCE           │
   └────────────────────────────────────────────┘

3. JWT Tokens (For session-based auth)
   ┌────────────────────────────────────────────┐
   │ Best for: Browser-based applications       │
   │ Setup: Automatic after login               │
   │ Duration: Configurable (default: 1 hour)   │
   └────────────────────────────────────────────┘

Which authentication method works best for your use case?

[API Key Setup Guide]
[OAuth Setup Guide]
[JWT Documentation]
```

**Knowledge Base Entry:**

```yaml
intent: api_authentication
category: API
keywords: [authentication, auth, api key, oauth, token, jwt, bearer]
context_triggers:
  - User mentions API access
  - User asks about authentication
  - User receives 401 errors
response_type: guided_tutorial
related_docs:
  - /docs/api/authentication
  - /docs/api/oauth-flow
  - /docs/api/api-keys
examples:
  - question: "How do I get an API key?"
    answer: "Navigate to Settings → API Keys → Create New Key. Give it a name and select scopes."
  - question: "My API key isn't working"
    answer: "Let me check: 1) Is the key active? 2) Does it have the right scopes? 3) Are you including 'Bearer' in the header?"
```

---

### Intent: Making API Requests

**User Questions:**
- "How do I fetch projects?"
- "Show me how to use the API"
- "I want to get all customers"
- "Create a task via API"

**AVA Response Template:**

```
I'll help you make an API request to fetch projects.

Example Request:
────────────────

GET https://api.hubblewave.com/v1/projects?page=1&pageSize=20

Headers:
  Authorization: Bearer YOUR_API_KEY
  Content-Type: application/json

Example Response:
─────────────────

{
  "data": [
    {
      "id": "proj_1234567890",
      "name": "Website Redesign",
      "status": "active",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 20,
    "totalPages": 5,
    "totalItems": 94
  }
}

Would you like me to:
1. Generate code in your language (Python, JavaScript, etc.)
2. Test this request in the API Explorer
3. Show you how to filter or paginate

[Generate Code] [Try in Explorer] [Show Advanced Options]
```

**Knowledge Base Entry:**

```yaml
intent: make_api_request
category: API
keywords: [fetch, get, retrieve, query, api request, call api]
context_triggers:
  - User wants to retrieve data
  - User mentions specific entities (projects, tasks, etc.)
response_type: code_example
parameters:
  - entity_type: Detected from user question
  - http_method: GET (default for fetch)
  - language: User preference or default to JavaScript
code_templates:
  javascript: |
    const response = await fetch('https://api.hubblewave.com/v1/{entity_type}', {
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    console.log(data);
  python: |
    import requests

    response = requests.get(
      'https://api.hubblewave.com/v1/{entity_type}',
      headers={'Authorization': 'Bearer YOUR_API_KEY'}
    )
    data = response.json()
    print(data)
```

---

## Common Integrations

### Intent: Salesforce Integration Setup

**User Questions:**
- "Connect to Salesforce"
- "Integrate with Salesforce"
- "Sync Salesforce data"
- "Setup Salesforce connector"

**AVA Response Template:**

```
I'll guide you through setting up Salesforce integration.

Prerequisites Checklist:
┌────────────────────────────────────────────────┐
│ ☐ Salesforce Administrator access             │
│ ☐ Connected App created in Salesforce         │
│ ☐ Consumer Key and Secret available           │
│ ☐ Security token (if using password flow)     │
└────────────────────────────────────────────────┘

Setup Process:
──────────────

Step 1: Create Connected App in Salesforce
  • Go to Setup → App Manager → New Connected App
  • Enable OAuth Settings
  • Callback URL: https://app.hubblewave.com/integrations/salesforce/callback
  • Required Scopes:
    - Full access (full)
    - Perform requests at any time (refresh_token, offline_access)

Step 2: Configure in HubbleWave
  • Go to Integrations → Marketplace
  • Click on Salesforce
  • Enter your credentials
  • Test connection

Step 3: Map Fields
  • Choose Salesforce object (e.g., Opportunity)
  • Choose HubbleWave entity (e.g., Project)
  • I'll suggest field mappings automatically

Step 4: Configure Sync
  • Choose sync frequency (real-time or scheduled)
  • Set up bi-directional sync rules
  • Test with sample data

Do you already have a Connected App in Salesforce?

[Yes, I have credentials]
[No, show me how to create one]
[Video Tutorial]
```

**Knowledge Base Entry:**

```yaml
intent: salesforce_integration_setup
category: Integrations
subcategory: Salesforce
keywords: [salesforce, sfdc, crm, opportunity, account, contact]
difficulty: intermediate
estimated_time: 15-30 minutes
prerequisites:
  - Salesforce Administrator access
  - HubbleWave Professional plan or higher
steps:
  1:
    title: "Create Salesforce Connected App"
    description: "Set up OAuth credentials in Salesforce"
    documentation: "/docs/integrations/salesforce/connected-app"
    common_issues:
      - "Callback URL mismatch"
      - "Missing OAuth scopes"
  2:
    title: "Connect to HubbleWave"
    description: "Enter credentials and test connection"
    documentation: "/docs/integrations/salesforce/connection"
  3:
    title: "Configure Field Mapping"
    description: "Map Salesforce fields to HubbleWave entities"
    documentation: "/docs/integrations/salesforce/field-mapping"
    ai_assistance: "Auto-suggest mappings based on field names and types"
  4:
    title: "Set Up Sync"
    description: "Configure sync frequency and direction"
    documentation: "/docs/integrations/salesforce/sync"
common_objects:
  - name: "Opportunity"
    maps_to: "Project"
    confidence: 0.95
  - name: "Account"
    maps_to: "Organization"
    confidence: 0.90
  - name: "Contact"
    maps_to: "Person"
    confidence: 0.92
```

---

### Intent: Jira Integration Setup

**User Questions:**
- "Connect Jira"
- "Sync Jira issues"
- "Integrate with Jira"
- "Setup Jira connector"

**AVA Response Template:**

```
I'll help you connect Jira to HubbleWave.

Quick Setup (3 steps):
──────────────────────

1. Jira Type
   What type of Jira are you using?
   • Jira Cloud (yourcompany.atlassian.net)
   • Jira Server/Data Center (self-hosted)

2. Authentication
   For Jira Cloud:
   • Email: your@email.com
   • API Token: (Generate at id.atlassian.com)

3. Project Selection
   Which Jira projects do you want to sync?
   • All projects
   • Specific projects (select from list)

Field Mapping Suggestions:
──────────────────────────

Jira Issue → HubbleWave Task
┌────────────────────────────────────────────────┐
│ Summary           → title         (99% match)  │
│ Description       → description   (98% match)  │
│ Status            → status        (needs mapping)│
│ Priority          → priority      (needs mapping)│
│ Assignee          → assigneeId    (91% match)  │
│ Created           → createdAt     (99% match)  │
│ Updated           → updatedAt     (99% match)  │
└────────────────────────────────────────────────┘

Status Mapping:
• To Do → pending
• In Progress → in_progress
• Done → completed

Does this mapping look correct?

[Accept & Continue]
[Customize Mappings]
[View All Jira Fields]
```

**Knowledge Base Entry:**

```yaml
intent: jira_integration_setup
category: Integrations
subcategory: Jira
keywords: [jira, atlassian, issue, epic, sprint, story]
difficulty: beginner
estimated_time: 10-15 minutes
jira_types:
  cloud:
    authentication: "API Token"
    api_version: "v3"
    base_url_pattern: "https://{site}.atlassian.net"
  server:
    authentication: "Basic Auth or Personal Access Token"
    api_version: "v2"
    base_url_pattern: "https://{domain}/jira"
common_field_mappings:
  issue_to_task:
    - source: "summary"
      target: "title"
      confidence: 0.99
      transform: none
    - source: "description"
      target: "description"
      confidence: 0.98
      transform: none
    - source: "status.name"
      target: "status"
      confidence: 0.85
      transform: value_mapping
      value_map:
        "To Do": "pending"
        "In Progress": "in_progress"
        "Done": "completed"
        "Backlog": "draft"
    - source: "priority.name"
      target: "priority"
      confidence: 0.87
      transform: value_mapping
      value_map:
        "Highest": "critical"
        "High": "high"
        "Medium": "medium"
        "Low": "low"
        "Lowest": "low"
troubleshooting:
  - issue: "Authentication failed"
    solution: "Verify API token is valid and not expired. Generate new token at id.atlassian.com/manage-profile/security/api-tokens"
  - issue: "403 Forbidden"
    solution: "Check that user has permission to access the Jira project"
  - issue: "Custom fields not syncing"
    solution: "Add custom field mappings in the advanced configuration"
```

---

## Webhook Troubleshooting

### Intent: Webhook Not Receiving Events

**User Questions:**
- "Webhook not working"
- "Not receiving webhooks"
- "Webhook failed"
- "Events not triggering"

**AVA Response Template:**

```
I'll help troubleshoot your webhook issue.

Running Diagnostics...
──────────────────────

Webhook: {webhook_name}
Endpoint: {webhook_url}

✓ Webhook configuration is valid
✗ Recent delivery failures detected

Issue Identified:
─────────────────

⚠️ Connection Refused (Error 503)

Your webhook endpoint is refusing connections.
This typically means:

1. Server is down or unreachable
2. Firewall is blocking our requests
3. URL has changed or is incorrect

Troubleshooting Steps:
──────────────────────

□ Step 1: Test Your Endpoint
  I can send a test webhook right now.
  [Send Test Webhook]

□ Step 2: Check Server Status
  Is your server running and accessible?
  Can you access {webhook_url} from your browser?

□ Step 3: Verify Firewall Rules
  Whitelist these HubbleWave IPs:
  • 52.1.23.45
  • 52.1.23.46
  • 52.1.23.47

□ Step 4: Check Webhook Response
  Your endpoint should:
  • Respond with 200-299 status code
  • Respond within 30 seconds
  • Return valid JSON (optional)

Recent Delivery Attempts:
─────────────────────────

• 2 mins ago - Failed (Connection refused)
• 5 mins ago - Failed (Connection refused)
• 8 mins ago - Failed (Connection refused)

Would you like me to:
[Retry Delivery Now]
[Test Different URL]
[View Full Error Log]
[Webhook Setup Guide]
```

**Knowledge Base Entry:**

```yaml
intent: webhook_not_receiving
category: Webhooks
subcategory: Troubleshooting
keywords: [webhook, not working, failed, not receiving, not triggering]
diagnostic_steps:
  1:
    check: "Webhook active status"
    query: "SELECT active FROM webhooks WHERE id = ?"
    condition: "active = false"
    message: "Your webhook is disabled. This happens after 10 consecutive failures."
    solution: "Re-enable webhook after fixing the underlying issue"
  2:
    check: "Recent delivery attempts"
    query: "SELECT * FROM webhook_deliveries WHERE webhook_id = ? ORDER BY created_at DESC LIMIT 5"
    analyze: "Look for common error patterns"
  3:
    check: "Endpoint reachability"
    action: "Perform HTTP HEAD request to webhook URL"
    timeout: 5000
  4:
    check: "SSL certificate validity"
    action: "Verify SSL certificate if HTTPS"
common_errors:
  connection_refused:
    description: "Server is not accepting connections"
    causes:
      - "Server is down"
      - "Firewall blocking requests"
      - "Wrong port"
    solutions:
      - "Verify server is running"
      - "Whitelist HubbleWave IPs"
      - "Check port configuration"
  timeout:
    description: "Server did not respond within 30 seconds"
    causes:
      - "Slow processing"
      - "Network issues"
      - "Server overload"
    solutions:
      - "Optimize webhook endpoint"
      - "Return 200 immediately, process async"
      - "Increase server resources"
  ssl_error:
    description: "SSL certificate validation failed"
    causes:
      - "Expired certificate"
      - "Self-signed certificate"
      - "Certificate mismatch"
    solutions:
      - "Renew SSL certificate"
      - "Use valid CA-signed certificate"
      - "Ensure certificate matches domain"
  4xx_error:
    description: "Client error (400-499)"
    causes:
      - "Invalid webhook signature"
      - "Missing required headers"
      - "Authentication failure"
    solutions:
      - "Verify signature validation logic"
      - "Check header requirements"
      - "Update authentication credentials"
```

---

## Data Mapping Best Practices

### Intent: Help with Field Mapping

**User Questions:**
- "How do I map fields?"
- "Field mapping guidance"
- "Map Salesforce to HubbleWave"
- "Transform data during sync"

**AVA Response Template:**

```
I'll guide you through field mapping best practices.

Mapping Strategy:
─────────────────

1. Automatic Mapping (Recommended)
   I'll analyze both schemas and suggest mappings
   based on:
   • Field name similarity
   • Data type compatibility
   • Common patterns

2. Manual Mapping
   You can override any suggestions and
   create custom mappings

3. Transformation Rules
   Apply transformations when needed:
   • Data type conversion
   • Value mapping
   • Concatenation
   • Custom functions

Best Practices:
───────────────

✓ DO:
  • Map required fields first
  • Use consistent naming conventions
  • Test with sample data
  • Document custom transformations
  • Handle null values

✗ DON'T:
  • Map incompatible data types
  • Ignore required fields
  • Skip validation
  • Map sensitive data without encryption

Common Transformations:
───────────────────────

1. Value Mapping
   Map different value sets
   Example: "Active" → "active"
            "Inactive" → "inactive"

2. Date Format
   Convert date formats
   Example: "MM/DD/YYYY" → "YYYY-MM-DD"

3. Currency Conversion
   Convert between currencies
   Example: EUR → USD (with live rates)

4. Concatenation
   Combine multiple fields
   Example: FirstName + " " + LastName → name

5. Lookup/Reference
   Map to related records
   Example: Email → User ID

Would you like me to:
[Auto-Map Fields]
[Show Transformation Examples]
[Configure Value Mapping]
```

**Knowledge Base Entry:**

```yaml
intent: field_mapping_assistance
category: Data Management
subcategory: Field Mapping
keywords: [mapping, transform, convert, field, data mapping]
mapping_strategies:
  automatic:
    confidence_threshold: 0.80
    matching_factors:
      - field_name_similarity: 0.40
      - data_type_match: 0.30
      - semantic_similarity: 0.20
      - pattern_matching: 0.10
    algorithms:
      - levenshtein_distance
      - word2vec_similarity
      - type_compatibility_check
  manual:
    ui_type: "visual_mapper"
    features:
      - drag_and_drop
      - search_fields
      - preview_data
      - test_mapping
transformation_types:
  value_mapping:
    description: "Map discrete values from source to target"
    example:
      source_values: ["New", "In Progress", "Done"]
      target_values: ["pending", "in_progress", "completed"]
    use_cases:
      - "Status fields"
      - "Priority levels"
      - "Categories"
  data_type_conversion:
    description: "Convert between data types"
    supported:
      - string_to_number
      - string_to_date
      - number_to_string
      - boolean_to_string
    validation: "Ensure valid conversion possible"
  concatenation:
    description: "Combine multiple fields"
    example: "FirstName + ' ' + LastName → fullName"
    use_cases:
      - "Full name from parts"
      - "Address from components"
      - "Composite identifiers"
  lookup_reference:
    description: "Map to related records"
    methods:
      - by_email
      - by_external_id
      - by_unique_field
    error_handling: "Create if not found or skip"
validation_rules:
  - check: "Required field mapping"
    message: "All required target fields must be mapped"
  - check: "Data type compatibility"
    message: "Source and target types must be compatible"
  - check: "Unique field handling"
    message: "Unique fields require careful duplicate handling"
```

---

## Sync Optimization

### Intent: Improve Sync Performance

**User Questions:**
- "Sync is slow"
- "How to speed up sync?"
- "Optimize sync performance"
- "Sync takes too long"

**AVA Response Template:**

```
I'll analyze your sync performance and suggest optimizations.

Current Performance:
────────────────────

Connector: {connector_name}
Records: {record_count}
Duration: {duration}
Rate: {records_per_second} records/second

Performance Analysis:
─────────────────────

⚠️ Your sync is slower than expected

Expected: ~50 records/second
Actual: 2.9 records/second
Performance: 94% slower

Bottlenecks Identified:
───────────────────────

1. API Rate Limiting (45% of time)
   • Current: 100 API calls/minute
   • Recommendation: Use Bulk API
   • Impact: 5x faster

2. N+1 Query Problem (35% of time)
   • Making {n_queries} individual queries
   • Recommendation: Use composite queries
   • Impact: 3x faster

3. Field Transformations (20% of time)
   • Complex currency conversions on each record
   • Recommendation: Cache exchange rates
   • Impact: 1.2x faster

Optimization Recommendations:
─────────────────────────────

Priority  Action                      Impact
──────────────────────────────────────────────
HIGH      Enable Bulk API             5x faster
HIGH      Use composite queries       3x faster
MEDIUM    Cache exchange rates        1.2x faster
LOW       Increase batch size         1.1x faster

Total estimated improvement: 15x faster
(From 8m 34s to ~34 seconds)

Would you like me to:
[Apply All Optimizations]
[Apply Selected Optimizations]
[Explain Each Optimization]
[Run Performance Test]
```

**Knowledge Base Entry:**

```yaml
intent: sync_optimization
category: Performance
subcategory: Sync Optimization
keywords: [slow, performance, optimize, speed up, faster]
performance_analysis:
  baseline_metrics:
    expected_rate: 50  # records per second
    acceptable_rate: 20  # records per second
    poor_rate: 10  # records per second
  bottleneck_detection:
    - name: "API Rate Limiting"
      indicators:
        - high_api_call_count
        - rate_limit_errors
        - long_wait_times
      solutions:
        - use_bulk_api
        - batch_requests
        - increase_rate_limit
    - name: "N+1 Queries"
      indicators:
        - individual_record_queries
        - high_query_count
        - database_time_high
      solutions:
        - use_composite_queries
        - eager_loading
        - graphql_queries
    - name: "Complex Transformations"
      indicators:
        - high_cpu_usage
        - transformation_time_high
      solutions:
        - cache_computed_values
        - optimize_algorithms
        - pre_compute_mappings
    - name: "Network Latency"
      indicators:
        - high_response_times
        - geographic_distance
      solutions:
        - regional_endpoints
        - connection_pooling
        - cdn_usage
optimization_strategies:
  bulk_api:
    description: "Process multiple records in single API call"
    applicability:
      - salesforce: true
      - jira: true
      - servicenow: true
    batch_sizes:
      salesforce: 200
      jira: 100
      servicenow: 500
    expected_improvement: "3-10x"
  composite_queries:
    description: "Fetch related data in single query"
    example: "GraphQL or Include parameters"
    expected_improvement: "2-5x"
  caching:
    description: "Cache frequently accessed data"
    cache_candidates:
      - exchange_rates
      - lookup_tables
      - user_mappings
    ttl: "1 hour"
    expected_improvement: "1.2-2x"
  connection_pooling:
    description: "Reuse connections instead of creating new"
    pool_size: 10
    expected_improvement: "1.1-1.5x"
```

---

## Error Resolution

### Intent: API Error Resolution

**User Questions:**
- "API error 401"
- "Why am I getting 403?"
- "500 internal server error"
- "API request failed"

**AVA Response Template:**

```
I'll help you resolve this API error.

Error Details:
──────────────

Status: 401 Unauthorized
Endpoint: GET /api/v1/projects
Message: "Invalid or expired token"

What This Means:
────────────────

Your authentication token is either:
• Invalid (malformed or incorrect)
• Expired (tokens expire after 1 hour)
• Revoked (manually disabled)

How to Fix:
───────────

Option 1: Refresh Your Token (Recommended)
  If using OAuth:
  → Use your refresh token to get new access token
  → I can guide you through this

Option 2: Generate New API Key
  If using API keys:
  → Go to Settings → API Keys
  → Generate new key
  → Update your application

Option 3: Re-authenticate
  → Log out and log back in
  → Token will be automatically refreshed

Prevention Tips:
────────────────

✓ Implement automatic token refresh
✓ Handle 401 errors gracefully
✓ Store refresh tokens securely
✓ Monitor token expiration

Would you like me to:
[Guide Token Refresh]
[Generate New API Key]
[View Token Status]
[Error Handling Best Practices]
```

**Knowledge Base Entry:**

```yaml
intent: api_error_resolution
category: Troubleshooting
subcategory: API Errors
keywords: [error, failed, 401, 403, 404, 500, unauthorized, forbidden]
http_errors:
  400:
    title: "Bad Request"
    common_causes:
      - "Invalid request parameters"
      - "Malformed JSON"
      - "Missing required fields"
    resolution_steps:
      - "Validate request format"
      - "Check required parameters"
      - "Review API documentation"
  401:
    title: "Unauthorized"
    common_causes:
      - "Missing authentication token"
      - "Invalid token"
      - "Expired token"
    resolution_steps:
      - "Check Authorization header"
      - "Refresh access token"
      - "Generate new API key"
  403:
    title: "Forbidden"
    common_causes:
      - "Insufficient permissions"
      - "Invalid scopes"
      - "Resource access denied"
    resolution_steps:
      - "Check API key scopes"
      - "Verify user permissions"
      - "Contact administrator"
  404:
    title: "Not Found"
    common_causes:
      - "Incorrect endpoint URL"
      - "Resource doesn't exist"
      - "Typo in resource ID"
    resolution_steps:
      - "Verify endpoint URL"
      - "Check resource ID"
      - "Confirm resource exists"
  429:
    title: "Too Many Requests"
    common_causes:
      - "Rate limit exceeded"
      - "Too many concurrent requests"
    resolution_steps:
      - "Implement rate limiting"
      - "Add retry with backoff"
      - "Upgrade plan for higher limits"
  500:
    title: "Internal Server Error"
    common_causes:
      - "Server-side bug"
      - "Database error"
      - "Temporary outage"
    resolution_steps:
      - "Retry request"
      - "Check status page"
      - "Contact support if persists"
automated_diagnostics:
  - check_token_validity
  - check_token_expiration
  - check_api_key_scopes
  - check_rate_limit_status
  - check_endpoint_availability
```

---

## Performance Tuning

### Intent: API Performance Optimization

**User Questions:**
- "API is slow"
- "Reduce API latency"
- "Speed up API calls"
- "Optimize API performance"

**AVA Response Template:**

```
I'll help you optimize API performance.

Current Performance:
────────────────────

Endpoint: {endpoint}
Average Response Time: {avg_time}ms
95th Percentile: {p95_time}ms
Target: < 200ms

Performance Breakdown:
──────────────────────

Network Time:     45ms  (22%)
Server Processing: 80ms  (39%)
Database Query:    75ms  (37%)
Other:             5ms   (2%)

Optimization Recommendations:
──────────────────────────────

1. Reduce Payload Size
   Current: Fetching all 32 fields
   Recommendation: Select only needed fields

   Before:
   GET /api/v1/projects

   After:
   GET /api/v1/projects?fields=id,name,status,targetDate

   Impact: 60% faster, 80% less data

2. Implement Pagination
   Current: Fetching all 4,287 projects
   Recommendation: Use pagination

   GET /api/v1/projects?page=1&pageSize=20

   Impact: 95% faster

3. Use Caching
   For data that doesn't change frequently:
   • Set Cache-Control headers
   • Implement client-side caching
   • Use ETags for conditional requests

   Impact: 90% faster for cached responses

4. Parallel Requests
   If fetching multiple resources:
   • Use Promise.all() for concurrent requests
   • Batch requests when possible

   Impact: 70% faster for multiple requests

5. Consider GraphQL
   For complex nested data:
   • Single request for nested data
   • Fetch exactly what you need

   Impact: 85% faster for nested queries

Expected Total Improvement: 3-10x faster

Would you like me to:
[Show Code Examples]
[Implement Caching]
[Convert to GraphQL]
[Performance Testing]
```

**Knowledge Base Entry:**

```yaml
intent: api_performance_optimization
category: Performance
subcategory: API Optimization
keywords: [slow api, latency, performance, optimization, speed]
performance_targets:
  excellent: 100
  good: 200
  acceptable: 500
  poor: 1000
  very_poor: 2000
optimization_techniques:
  field_selection:
    description: "Request only needed fields"
    syntax: "?fields=id,name,status"
    impact: "50-70% improvement"
    when_to_use: "When you don't need all fields"
  pagination:
    description: "Limit number of records per request"
    syntax: "?page=1&pageSize=20"
    impact: "80-95% improvement"
    when_to_use: "When dealing with large datasets"
  filtering:
    description: "Filter server-side instead of client-side"
    syntax: "?status=active&priority=high"
    impact: "60-90% improvement"
    when_to_use: "When you need subset of data"
  caching:
    description: "Cache responses to avoid repeated requests"
    headers:
      - "Cache-Control: max-age=3600"
      - "ETag: {hash}"
    impact: "90-99% improvement for cached hits"
    when_to_use: "For data that changes infrequently"
  compression:
    description: "Compress response data"
    headers:
      - "Accept-Encoding: gzip, deflate"
    impact: "70-90% data reduction"
    when_to_use: "Always (automatically applied)"
  parallel_requests:
    description: "Make multiple requests concurrently"
    example: "Promise.all([fetch1, fetch2, fetch3])"
    impact: "70-90% improvement for multiple requests"
    when_to_use: "When fetching independent resources"
  graphql:
    description: "Use GraphQL for complex data needs"
    advantages:
      - "Single request for nested data"
      - "Fetch exactly what you need"
      - "No over-fetching or under-fetching"
    impact: "80-95% improvement for complex queries"
    when_to_use: "When you need related/nested data"
monitoring:
  - track_response_times
  - identify_slow_endpoints
  - monitor_cache_hit_rate
  - analyze_query_patterns
```

---

This comprehensive knowledge base enables AVA to provide intelligent, context-aware assistance for all integration and data management tasks in Phase 5.

