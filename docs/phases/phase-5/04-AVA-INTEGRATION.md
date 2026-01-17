# Phase 5: Integration & Data - AVA Integration

**Version:** 1.0
**Last Updated:** 2025-12-30
**Status:** AVA Feature Specification

---

## Table of Contents

1. [Overview](#overview)
2. [API Query Generation](#api-query-generation)
3. [Integration Setup Assistance](#integration-setup-assistance)
4. [Data Mapping Suggestions](#data-mapping-suggestions)
5. [Webhook Configuration](#webhook-configuration)
6. [Sync Troubleshooting](#sync-troubleshooting)
7. [Import/Export Guidance](#importexport-guidance)
8. [OAuth Flow Assistance](#oauth-flow-assistance)
9. [Performance Optimization](#performance-optimization)
10. [Conversation Examples](#conversation-examples)

---

## Overview

AVA (Advanced Virtual Assistant) provides intelligent assistance throughout the integration and data management lifecycle. This document outlines AVA's capabilities in Phase 5, focusing on helping users with API usage, integration configuration, data mapping, and troubleshooting.

### Key Capabilities

- **API Query Generation:** Convert natural language to API requests
- **Integration Setup:** Guide users through connector configuration
- **Data Mapping:** Suggest field mappings and transformations
- **Troubleshooting:** Diagnose and resolve sync/webhook failures
- **Optimization:** Recommend performance improvements
- **Documentation:** Provide contextual API documentation

---

## API Query Generation

### Natural Language to API Translation

AVA translates user intent into properly formatted API requests.

#### Example 1: Simple Query

```
User: Show me all active projects

AVA: I'll help you retrieve all active projects. Here's the API query:

GET /api/v1/projects?status=active

Would you like me to:
1. Execute this query and show you the results
2. Generate code in your preferred language
3. Add additional filters (owner, date range, etc.)

[Execute Query] [Show Code] [Add Filters]
```

#### Example 2: Complex Query with Filters

```
User: Get projects created in the last 30 days with high priority

AVA: I'll construct a query for recent high-priority projects:

GET /api/v1/projects?createdAfter=2024-12-16&priority=high&sort=createdAt&order=desc

This query will:
• Filter projects created after December 16, 2024
• Filter for high priority only
• Sort by creation date (newest first)

Estimated results: 23 projects

[Execute Query] [Modify Filters] [Export Results]
```

#### Example 3: Nested Data Query (GraphQL)

```
User: Show me projects with their tasks and assigned users

AVA: For this request, I recommend using GraphQL since you need nested data.
Here's the query:

query {
  projects {
    items {
      id
      name
      status
      tasks {
        id
        title
        status
        assignee {
          id
          name
          email
        }
      }
    }
  }
}

This will retrieve:
• All projects
• Tasks within each project
• Assigned users for each task

[Execute in GraphQL Playground] [Convert to REST] [Download as Code]
```

### Code Generation

AVA generates implementation code in multiple languages.

```
User: Generate Python code to fetch all customers

AVA: Here's Python code using the requests library:

```python
import requests

API_KEY = "your_api_key_here"
BASE_URL = "https://api.hubblewave.com/v1"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

response = requests.get(f"{BASE_URL}/customers", headers=headers)

if response.status_code == 200:
    customers = response.json()
    print(f"Retrieved {len(customers['data'])} customers")
    for customer in customers['data']:
        print(f"- {customer['name']} ({customer['email']})")
else:
    print(f"Error: {response.status_code} - {response.text}")
```

Would you like:
• Code in a different language (JavaScript, C#, Go, etc.)
• Error handling enhancements
• Pagination support
• Response caching

[Copy Code] [Change Language] [Add Features]
```

---

## Integration Setup Assistance

### Connector Configuration Wizard

AVA guides users through setting up external integrations.

#### Salesforce Integration

```
User: I want to connect Salesforce

AVA: I'll help you set up Salesforce integration. Let me guide you through the process.

Step 1: Authentication
─────────────────────
To connect to Salesforce, I'll need:

1. Salesforce Instance URL
   Example: https://yourcompany.salesforce.com

2. Authentication Method
   • OAuth 2.0 (Recommended - more secure)
   • Username + Password + Security Token

Which authentication method would you prefer?

[OAuth 2.0] [Username/Password]

──────────────────────────────────────
Need help?
• OAuth requires a Connected App in Salesforce
• I can guide you through creating one
• Or use existing credentials if you have them
```

#### OAuth Flow Guidance

```
User: Use OAuth 2.0

AVA: Great choice! Here's what we'll do:

Prerequisites Checklist:
┌─────────────────────────────────────────────┐
│ ☐ Salesforce Connected App configured      │
│ ☐ Consumer Key (Client ID) available       │
│ ☐ Consumer Secret (Client Secret) available│
│ ☐ Callback URL registered                  │
└─────────────────────────────────────────────┘

Don't have a Connected App yet?

I can show you how to create one:
1. Go to Salesforce Setup → App Manager
2. Click "New Connected App"
3. Fill in these details:
   • Connected App Name: "HubbleWave Integration"
   • API Name: HubbleWave_Integration
   • Contact Email: your@email.com
   • Enable OAuth Settings: ✓
   • Callback URL: https://app.hubblewave.com/integrations/salesforce/callback
   • Selected OAuth Scopes:
     - Full access (full)
     - Perform requests at any time (refresh_token, offline_access)

[I have the credentials] [Show detailed setup guide] [Video tutorial]
```

#### Connection Testing

```
AVA: Testing Salesforce connection...

✓ Authentication successful
✓ Connected to: YourCompany Production (NA152)
✓ API version: 59.0
✓ User: john.smith@yourcompany.com

Available Objects Detected:
┌──────────────────────────────────────────────┐
│ Standard Objects:        Custom Objects:     │
│ • Account (1,234)        • Project__c (487)  │
│ • Contact (5,678)        • CustomApp__c (92) │
│ • Opportunity (892)                          │
│ • Lead (2,341)                               │
└──────────────────────────────────────────────┘

What would you like to sync?
[Configure Sync] [Map Fields] [Test with Sample Data]
```

---

## Data Mapping Suggestions

### Intelligent Field Mapping

AVA suggests field mappings based on field names, types, and data analysis.

#### Auto-Mapping Suggestion

```
User: Map Salesforce Opportunities to HubbleWave Projects

AVA: I've analyzed both schemas and created suggested mappings:

Confident Mappings (95%+ match):
┌────────────────────────────────────────────────────────┐
│ Salesforce Field  →  HubbleWave Field     Confidence   │
│ ──────────────────────────────────────────────────────│
│ Name              →  name                 99%          │
│ Description       →  description          98%          │
│ CloseDate         →  targetDate           96%          │
│ CreatedDate       →  createdAt            99%          │
│ LastModifiedDate  →  updatedAt            99%          │
└────────────────────────────────────────────────────────┘

Suggested Mappings (80-95% match):
┌────────────────────────────────────────────────────────┐
│ Salesforce Field  →  HubbleWave Field     Confidence   │
│ ──────────────────────────────────────────────────────│
│ Amount            →  budget               87%          │
│ StageName         →  status               85%          │
│ OwnerId           →  ownerId              91%          │
└────────────────────────────────────────────────────────┘

Requires Attention:
┌────────────────────────────────────────────────────────┐
│ Salesforce Field  →  Suggestion                        │
│ ──────────────────────────────────────────────────────│
│ StageName         →  Needs value mapping               │
│   • "Prospecting" → "draft" or "planning"?             │
│   • "Closed Won" → "completed" or "active"?            │
│                                                        │
│ Amount            →  Needs currency conversion?        │
│   • Currently: USD                                     │
│   • Target currency: USD                               │
└────────────────────────────────────────────────────────┘

[Accept All] [Review Individually] [Show Unmapped Fields]
```

#### Value Mapping Assistance

```
User: Help me map StageName to status

AVA: I'll help you map Salesforce StageName values to HubbleWave status values.

I found these values in your Salesforce data (last 1000 Opportunities):

Salesforce StageName Values:
┌─────────────────────────┬──────────┬─────────┐
│ Value                   │ Count    │ %       │
├─────────────────────────┼──────────┼─────────┤
│ Prospecting             │ 234      │ 26.2%   │
│ Qualification           │ 187      │ 21.0%   │
│ Needs Analysis          │ 145      │ 16.3%   │
│ Value Proposition       │ 98       │ 11.0%   │
│ Proposal/Price Quote    │ 76       │ 8.5%    │
│ Negotiation/Review      │ 54       │ 6.1%    │
│ Closed Won              │ 67       │ 7.5%    │
│ Closed Lost             │ 31       │ 3.5%    │
└─────────────────────────┴──────────┴─────────┘

HubbleWave Status Options:
• draft
• planning
• active
• on_hold
• completed
• cancelled
• archived

Suggested Mappings:
┌──────────────────────────┬──────────────────┬────────────┐
│ Salesforce               │ HubbleWave       │ Reasoning  │
├──────────────────────────┼──────────────────┼────────────┤
│ Prospecting              │ draft            │ Early stage│
│ Qualification            │ planning         │ Analysis   │
│ Needs Analysis           │ planning         │ Analysis   │
│ Value Proposition        │ planning         │ Pre-exec   │
│ Proposal/Price Quote     │ active           │ In-flight  │
│ Negotiation/Review       │ active           │ In-flight  │
│ Closed Won               │ completed        │ Successful │
│ Closed Lost              │ cancelled        │ Unsuccessful│
└──────────────────────────┴──────────────────┴────────────┘

[Accept Suggestions] [Customize Mappings] [Add Default Value]
```

### Transformation Suggestions

```
User: The Amount field is in different currencies

AVA: I detected mixed currencies in your Salesforce Amount field.

Currency Analysis:
┌────────────┬──────────┬─────────┐
│ Currency   │ Count    │ %       │
├────────────┼──────────┼─────────┤
│ USD        │ 745      │ 83.5%   │
│ EUR        │ 98       │ 11.0%   │
│ GBP        │ 49       │ 5.5%    │
└────────────┴──────────┴─────────┘

Recommended Solution:
Convert all amounts to USD (your HubbleWave default currency)

Transformation Configuration:
┌──────────────────────────────────────────────────┐
│ Source Field:    CurrencyIsoCode, Amount         │
│ Transformation:  Currency Conversion             │
│ Target Currency: USD                             │
│ Exchange Rate:   Live rates from ECB API         │
│ Fallback:        Fixed rates (if API unavailable)│
│ Precision:       2 decimal places                │
└──────────────────────────────────────────────────┘

Preview (based on current rates):
• EUR 10,000 → USD 10,950
• GBP 10,000 → USD 12,650
• USD 10,000 → USD 10,000

Exchange rates updated: 2 hours ago

[Apply Transformation] [Use Fixed Rates] [Skip Conversion]
```

---

## Webhook Configuration

### Event Selection Assistance

```
User: Set up a webhook for project updates

AVA: I'll help you configure a webhook for project updates.

First, let me understand your needs:

Q1: When should the webhook trigger?
┌────────────────────────────────────────────────┐
│ ☐ When a project is created                   │
│ ☑ When a project is updated                   │
│ ☐ When a project is deleted                   │
│ ☐ When a project status changes               │
│ ☐ When a project is archived                  │
└────────────────────────────────────────────────┘

Q2: What data should be included in the webhook payload?
┌────────────────────────────────────────────────┐
│ ● Full project details (recommended)           │
│ ○ Only changed fields                          │
│ ○ Just project ID (minimal payload)            │
└────────────────────────────────────────────────┘

Q3: What's your webhook endpoint URL?
┌────────────────────────────────────────────────┐
│ https://api.example.com/webhooks/projects      │
└────────────────────────────────────────────────┘

[Continue] [Advanced Options]
```

### Webhook Testing

```
AVA: Let's test your webhook configuration before saving.

Webhook Test
┌──────────────────────────────────────────────────┐
│ Endpoint: https://api.example.com/webhooks/...  │
│ Event:    project.updated                        │
│                                                  │
│ Sending test payload...                          │
│                                                  │
│ ✓ Request sent successfully                      │
│ ✓ Response received: 200 OK                      │
│ ✓ Response time: 145ms                           │
│                                                  │
│ Response Headers:                                │
│ • Content-Type: application/json                 │
│ • X-Request-Id: req_abc123                       │
│                                                  │
│ Response Body:                                   │
│ {                                                │
│   "success": true,                               │
│   "message": "Webhook received",                 │
│   "processedAt": "2025-01-15T14:30:00Z"          │
│ }                                                │
└──────────────────────────────────────────────────┘

✓ Your endpoint is correctly configured!

Recommendations:
• Response time is good (< 200ms)
• Consider implementing retry handling
• Make sure to validate webhook signatures

[Save Webhook] [Test Again] [Configure Retries]
```

---

## Sync Troubleshooting

### Failure Diagnosis

```
User: My Salesforce sync keeps failing

AVA: I'll help you diagnose the sync failure. Let me analyze recent sync attempts.

Analyzing Salesforce Sync Issues...

Problem Identified:
┌──────────────────────────────────────────────────┐
│ ⚠️ Authentication Failure                         │
│                                                  │
│ Error: "INVALID_SESSION_ID: Session expired      │
│ or invalid"                                      │
│                                                  │
│ Last successful sync: 2 days ago                 │
│ Failed attempts: 12 (last 24 hours)              │
└──────────────────────────────────────────────────┘

Root Cause:
Your Salesforce OAuth token has expired. This can happen when:
• The refresh token is invalidated
• Password was changed in Salesforce
• Connected App permissions were modified
• Session timeout policy changed

Recommended Solution:
1. Re-authenticate the Salesforce connection
2. Verify Connected App is still active
3. Check OAuth token settings

[Re-authenticate Now] [View Error Logs] [Check Salesforce Status]
```

### Field Mapping Issues

```
User: Some records aren't syncing from Salesforce

AVA: I'll investigate why some records aren't syncing.

Sync Analysis (Last Run):
┌──────────────────────────────────────────────────┐
│ Total records:     487                           │
│ Synced:           443 (90.1%)                    │
│ Failed:            44 (9.9%)                     │
└──────────────────────────────────────────────────┘

Failure Breakdown:
┌──────────────────────────────────────────────────┐
│ Reason                              Count        │
├──────────────────────────────────────────────────┤
│ Invalid status value                  24         │
│ Missing required field (owner)        12         │
│ Duplicate detection                    8         │
└──────────────────────────────────────────────────┘

Issue 1: Invalid Status Values
────────────────────────────────
24 records have StageName values that aren't mapped:
• "Pending Review" → No mapping configured
• "Executive Approval" → No mapping configured

Solution:
Add mappings for these values, or set a default value.

[Configure Missing Mappings] [Set Default Value] [View Failed Records]

Issue 2: Missing Owner
──────────────────────
12 records have no OwnerId in Salesforce.

Options:
1. Set a default owner in HubbleWave
2. Skip records without owners
3. Use a field mapping rule

[Set Default Owner] [Skip Records] [Create Mapping Rule]
```

### Performance Optimization

```
User: The sync is very slow

AVA: Let me analyze your sync performance.

Performance Analysis:
┌──────────────────────────────────────────────────┐
│ Sync Duration:        8 minutes 34 seconds       │
│ Records Processed:    1,487                      │
│ Average Rate:         2.9 records/second         │
│                                                  │
│ Expected Rate:        ~50 records/second         │
│ Performance:          ⚠️ 94% slower than expected │
└──────────────────────────────────────────────────┘

Bottlenecks Identified:
┌──────────────────────────────────────────────────┐
│ 1. API Rate Limiting (45% of time)               │
│    • Hitting Salesforce API limits               │
│    • Current: 100 calls/min                      │
│    • Recommended: Use Bulk API for >200 records  │
│                                                  │
│ 2. Field-Level Queries (35% of time)             │
│    • Loading related objects individually        │
│    • Making 1,487 additional API calls           │
│    • Recommended: Use composite queries          │
│                                                  │
│ 3. Transformation Processing (20% of time)       │
│    • Complex currency conversions                │
│    • Recommended: Pre-calculate exchange rates   │
└──────────────────────────────────────────────────┘

Optimization Recommendations:
┌──────────────────────────────────────────────────┐
│ Priority  Action                    Impact        │
├──────────────────────────────────────────────────┤
│ HIGH      Enable Bulk API           ~5x faster   │
│ HIGH      Use composite queries     ~3x faster   │
│ MEDIUM    Cache exchange rates      ~1.2x faster │
│ LOW       Increase batch size       ~1.1x faster │
└──────────────────────────────────────────────────┘

Estimated improvement: 15x faster (34 seconds instead of 8+ minutes)

[Apply All Optimizations] [Apply Selected] [Show Details]
```

---

## Import/Export Guidance

### Import Assistance

```
User: I need to import 10,000 customer records

AVA: I'll help you import 10,000 customer records efficiently.

Pre-Import Checklist:
┌────────────────────────────────────────────────────┐
│ ☑ File size check (< 100 MB limit)                │
│ ☑ File format supported (CSV/Excel/JSON)          │
│ ☐ Required fields present in file                 │
│ ☐ Data validation rules reviewed                  │
│ ☐ Duplicate detection strategy chosen             │
└────────────────────────────────────────────────────┘

Recommended Approach:
Given the large dataset (10,000 records), I suggest:

1. Batch Import Strategy
   • Process in batches of 500 records
   • Estimated time: 4-6 minutes
   • Allows for error recovery

2. Validation Rules
   • Pre-validate data before import
   • Identify issues early
   • Generate error report

3. Duplicate Detection
   • Check for duplicates by email
   • Estimated duplicates: ~150 (based on typical data)

Would you like me to:
[Validate File First] [Import with Recommended Settings] [Custom Configuration]
```

### Data Validation Preview

```
AVA: Validating your customer import file...

Validation Results:
┌────────────────────────────────────────────────────┐
│ Total Records:        10,000                       │
│ Valid Records:         9,734 (97.3%)               │
│ Invalid Records:         266 (2.7%)                │
└────────────────────────────────────────────────────┘

Issues Found:
┌────────────────────────────────────────────────────┐
│ Issue Type                        Count  Severity  │
├────────────────────────────────────────────────────┤
│ Missing email (required)            142  ❗ High   │
│ Invalid email format                 87  ❗ High   │
│ Missing name (required)              24  ❗ High   │
│ Invalid phone format                 13  ⚠️ Medium │
└────────────────────────────────────────────────────┘

Sample Errors:
Row 45:   Missing email address
Row 128:  Invalid email: "john@" (incomplete domain)
Row 342:  Missing customer name
Row 891:  Invalid email: "notanemail" (no @ symbol)

Options:
1. Fix errors in file and re-upload
2. Import valid records only (9,734 records)
3. Download error report and fix specific issues

[Download Error Report] [Import Valid Only] [Cancel Import]
```

### Export Optimization

```
User: Export all customers to Excel

AVA: I'll help you export customer data to Excel.

Export Size Estimation:
┌────────────────────────────────────────────────────┐
│ Total Customers:      24,587                       │
│ Selected Fields:      18                           │
│ Estimated File Size:  ~8.2 MB                      │
│ Estimated Time:       ~15 seconds                  │
└────────────────────────────────────────────────────┘

⚠️ Large Export Detected

For better performance, I recommend:

Option 1: Filtered Export (Recommended)
• Export specific customer segments
• Faster processing
• Smaller file size
• Example filters:
  - Active customers only (18,234 records) → 5.8 MB
  - Customers from last year (8,902 records) → 2.9 MB

Option 2: Split Export
• Export in multiple files
• Easier to work with in Excel
• Suggested splits:
  - By region (4 files)
  - By status (2 files)
  - By date range (monthly)

Option 3: Full Export
• All 24,587 records in one file
• May be slow to open in Excel
• Consider using CSV format instead

[Filter Export] [Split Export] [Full Export Anyway]
```

---

## OAuth Flow Assistance

### OAuth Setup Wizard

```
User: Help me set up OAuth for my mobile app

AVA: I'll guide you through OAuth 2.0 setup for your mobile app.

OAuth Configuration Wizard
═══════════════════════════

Step 1: Application Type
─────────────────────────

Your app type: Mobile Application

For mobile apps, I recommend:
• Authorization Code flow with PKCE
• Why? More secure for apps that can't store secrets
• Prevents authorization code interception

Step 2: Redirect URI
────────────────────

For mobile apps, you need a custom URI scheme:

Recommended format:
  com.yourcompany.yourapp://oauth/callback

Example for your app:
┌────────────────────────────────────────────────────┐
│ App ID:           myapp                            │
│ Redirect URI:     myapp://oauth/callback           │
│ Alternative:      https://app.example.com/callback │
└────────────────────────────────────────────────────┘

Step 3: Scopes
──────────────

What permissions does your app need?

┌────────────────────────────────────────────────────┐
│ ☑ read        Read access to resources            │
│ ☑ write       Create and update resources         │
│ ☑ profile     Access user profile information     │
│ ☐ admin       Administrative access                │
└────────────────────────────────────────────────────┘

[Continue to Step 4] [Save Progress] [Cancel]
```

### Implementation Code

```
AVA: Here's the implementation code for your mobile app (iOS):

Swift Implementation:
════════════════════

import AuthenticationServices

class OAuthManager {
    let clientID = "mob_YOUR_CLIENT_ID"
    let redirectURI = "myapp://oauth/callback"
    let authorizationEndpoint = "https://auth.hubblewave.com/oauth/authorize"
    let tokenEndpoint = "https://auth.hubblewave.com/oauth/token"

    func startOAuthFlow() {
        // Generate PKCE code verifier and challenge
        let codeVerifier = generateCodeVerifier()
        let codeChallenge = generateCodeChallenge(from: codeVerifier)

        // Build authorization URL
        var components = URLComponents(string: authorizationEndpoint)!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "read write profile"),
            URLQueryItem(name: "code_challenge", value: codeChallenge),
            URLQueryItem(name: "code_challenge_method", value: "S256")
        ]

        // Present authentication session
        let session = ASWebAuthenticationSession(
            url: components.url!,
            callbackURLScheme: "myapp"
        ) { callbackURL, error in
            guard let callbackURL = callbackURL,
                  let code = self.extractCode(from: callbackURL) else {
                return
            }

            self.exchangeCodeForToken(code: code, codeVerifier: codeVerifier)
        }

        session.presentationContextProvider = self
        session.start()
    }

    // ... Additional helper methods
}

Security Best Practices:
✓ PKCE prevents authorization code interception
✓ State parameter prevents CSRF attacks
✓ Secure storage of tokens in Keychain
✓ Token refresh before expiration

[Copy Code] [Show Android Version] [Show Token Refresh Code]
```

---

## Performance Optimization

### Query Optimization

```
User: My API queries are slow

AVA: Let me analyze your API usage and suggest optimizations.

Query Performance Analysis:
┌────────────────────────────────────────────────────┐
│ Endpoint:         GET /api/v1/projects            │
│ Avg Response:     2,450ms                          │
│ Expected:         < 200ms                          │
│ Performance:      ⚠️ 12x slower than expected      │
└────────────────────────────────────────────────────┘

Issues Detected:
┌────────────────────────────────────────────────────┐
│ 1. No Pagination (45% of delay)                   │
│    • Fetching all 4,287 projects at once          │
│    • Large payload: 8.2 MB                         │
│    • Solution: Add pagination                      │
│                                                    │
│ 2. Over-fetching Data (35% of delay)              │
│    • Retrieving all fields (32 fields)            │
│    • Only using 8 fields in your app              │
│    • Solution: Use field selection                 │
│                                                    │
│ 3. N+1 Query Problem (20% of delay)               │
│    • Loading owner details for each project       │
│    • Making 4,287 additional requests             │
│    • Solution: Use GraphQL or include parameter   │
└────────────────────────────────────────────────────┘

Optimized Query:
────────────────

Current (Slow):
GET /api/v1/projects

Optimized (Fast):
GET /api/v1/projects?
    page=1&
    pageSize=20&
    fields=id,name,status,targetDate&
    include=owner

Performance Improvement:
• Response time: 85ms (28x faster)
• Payload size: 12 KB (683x smaller)
• API calls: 1 instead of 4,288

[Apply Optimization] [Test Performance] [Show GraphQL Alternative]
```

---

## Conversation Examples

### Example 1: Complete Integration Setup

```
User: I need to sync Jira issues to HubbleWave tasks

AVA: I'll help you set up Jira to HubbleWave sync. Let's start:

Step 1: Connect to Jira
What type of Jira instance do you have?
[Cloud] [Server] [Data Center]

User: Cloud

AVA: Great! For Jira Cloud, we'll use OAuth 2.0 authentication.

I'll need:
1. Jira site URL (e.g., yourcompany.atlassian.net)
2. API token (you can generate one in your Atlassian account)

What's your Jira site URL?

User: acmecorp.atlassian.net

AVA: Perfect! Now, let's authenticate...

✓ Connected to Jira Cloud (acmecorp.atlassian.net)
✓ Found 3 projects: PROJ, DEV, SUPPORT
✓ Detected 487 open issues

Step 2: Field Mapping
I'll map Jira Issue fields to HubbleWave Task fields.

Suggested mappings:
• Summary → title ✓
• Description → description ✓
• Status → status (needs value mapping)
• Priority → priority (needs value mapping)
• Assignee → assigneeId (needs user mapping)
• Created → createdAt ✓
• Updated → updatedAt ✓

Let's configure the status mapping:

Jira Status → HubbleWave Status
• To Do → pending
• In Progress → in_progress
• Done → completed

Does this look correct?
[Yes, continue] [Customize mappings]

User: Yes, continue

AVA: Excellent!

Step 3: Sync Configuration
How often should we sync?
[ ] Real-time (via webhooks)
[ ] Every 15 minutes
[ ] Every hour
[ ] Daily

User: Real-time

AVA: Perfect! I'll set up webhooks in Jira for real-time sync.

Configuration Summary:
┌────────────────────────────────────────────────────┐
│ Source:           Jira Cloud (acmecorp)            │
│ Target:           HubbleWave Tasks                 │
│ Sync Mode:        Real-time (webhooks)             │
│ Direction:        Bi-directional                   │
│ Field Mappings:   7 fields mapped                  │
│ Projects:         All (3 projects)                 │
└────────────────────────────────────────────────────┘

Ready to activate?
[Activate Sync] [Test First] [Review Configuration]

User: Test First

AVA: Running test sync with 5 sample issues...

✓ Test 1: Create task from Jira issue PROJ-123
✓ Test 2: Update task when Jira issue updated
✓ Test 3: Status sync (To Do → pending)
✓ Test 4: Assignee mapping
✓ Test 5: Comment sync

All tests passed! ✓

[Activate Sync Now] [View Test Results] [Modify Configuration]

User: Activate Sync Now

AVA: Activating Jira sync...

✓ Webhooks configured in Jira
✓ Initial sync started (487 issues)
✓ Real-time sync active

Your Jira-HubbleWave integration is now live!

Initial sync progress: 156 / 487 (32%)
Estimated completion: 2 minutes

[View Sync Dashboard] [Configure Notifications] [Done]
```

### Example 2: Troubleshooting Webhook

```
User: My webhook stopped working

AVA: Let me investigate your webhook issue.

Checking webhook status...

Found the problem:
┌────────────────────────────────────────────────────┐
│ ⚠️ Webhook Disabled (Too Many Failures)            │
│                                                    │
│ Webhook:          Project Notifications           │
│ Endpoint:         https://api.example.com/hooks    │
│ Status:           Disabled                         │
│ Disabled Since:   2 hours ago                      │
│ Reason:           10 consecutive failures          │
└────────────────────────────────────────────────────┘

Recent Delivery Attempts:
• 14:30 - Failed (Connection refused)
• 14:28 - Failed (Connection refused)
• 14:26 - Failed (Connection refused)
... 7 more failures

It looks like your webhook endpoint is not responding.

Let me check if it's reachable...

Testing: https://api.example.com/hooks

✗ Connection failed: "Connection refused"

The endpoint is not accessible. This could mean:
1. Your server is down
2. Firewall is blocking our requests
3. The URL has changed

Would you like me to:
[Test Different URL] [View IP Whitelist Info] [Disable Webhook]

User: View IP Whitelist Info

AVA: Here's our webhook delivery information:

IP Addresses to Whitelist:
┌────────────────────────────────────────────────────┐
│ Production IPs:                                    │
│ • 52.1.23.45                                       │
│ • 52.1.23.46                                       │
│ • 52.1.23.47                                       │
│                                                    │
│ User-Agent:                                        │
│ HubbleWave-Webhook/1.0                             │
│                                                    │
│ Headers Sent:                                      │
│ • X-HubbleWave-Signature: <signature>              │
│ • X-HubbleWave-Event: <event-type>                 │
│ • X-HubbleWave-Delivery: <delivery-id>             │
└────────────────────────────────────────────────────┘

Once you've updated your firewall, we can test again.

[Test Connection Again] [Copy IP List] [Webhook Documentation]
```

This AVA integration provides comprehensive assistance throughout the integration and data management process, making complex tasks accessible through natural conversation.

