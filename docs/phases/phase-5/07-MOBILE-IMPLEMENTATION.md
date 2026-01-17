# Phase 5: Integration & Data - Mobile Implementation

**Version:** 1.0
**Last Updated:** 2025-12-30
**Status:** Mobile Specification

---

## Table of Contents

1. [Mobile Overview](#mobile-overview)
2. [Mobile API Access](#mobile-api-access)
3. [OAuth Mobile Flow](#oauth-mobile-flow)
4. [Integration Monitoring](#integration-monitoring)
5. [Data Import/Export](#data-importexport)
6. [Offline Sync](#offline-sync)
7. [Push Notifications](#push-notifications)
8. [Mobile UI Components](#mobile-ui-components)

---

## Mobile Overview

### Mobile Integration Capabilities

The HubbleWave mobile app provides full access to integration and data management features, optimized for mobile devices.

### Key Features

- **API Documentation Browser:** Access API docs on-the-go
- **Integration Status Monitoring:** View sync jobs and webhook deliveries
- **OAuth Authentication:** Secure mobile OAuth flow with PKCE
- **Push Notifications:** Real-time alerts for sync failures
- **Offline Data Access:** View cached integration data offline
- **Mobile-Optimized Import:** Import data from mobile device storage

---

## Mobile API Access

### Mobile API Documentation Viewer

```
┌─────────────────────────────────────┐
│ ≡  API Documentation       [Search] │
├─────────────────────────────────────┤
│                                     │
│ 📚 Getting Started                  │
│    → Authentication                 │
│    → Making Your First Request      │
│    → Rate Limits                    │
│                                     │
│ 📖 Endpoints                        │
│    ▼ Projects                       │
│      → GET /projects                │
│      → POST /projects               │
│      → GET /projects/:id            │
│      → PUT /projects/:id            │
│      → DELETE /projects/:id         │
│                                     │
│    ▼ Tasks                          │
│      → GET /tasks                   │
│      → POST /tasks                  │
│                                     │
│    ▼ Integrations                   │
│      → GET /connectors              │
│      → POST /webhooks               │
│                                     │
│ 🔑 Authentication                   │
│    → API Keys                       │
│    → OAuth 2.0                      │
│    → JWT Tokens                     │
│                                     │
│ 📊 GraphQL                          │
│    → Schema Explorer                │
│    → Query Builder                  │
│                                     │
└─────────────────────────────────────┘
```

### Endpoint Detail View (Mobile)

```
┌─────────────────────────────────────┐
│ ← GET /api/v1/projects              │
├─────────────────────────────────────┤
│                                     │
│ Get Projects                        │
│                                     │
│ Retrieve a list of all projects     │
│ with optional filtering and         │
│ pagination support.                 │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ ▼ Query Parameters                  │
│                                     │
│   page          integer  Optional   │
│   Page number (default: 1)          │
│                                     │
│   pageSize      integer  Optional   │
│   Items per page (default: 20)      │
│                                     │
│   status        string   Optional   │
│   Filter by status                  │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ ▼ Response (200 OK)                 │
│                                     │
│ {                                   │
│   "data": [                         │
│     {                               │
│       "id": "proj_123",             │
│       "name": "Website...",         │
│       "status": "active"            │
│     }                               │
│   ],                                │
│   "pagination": {                   │
│     "currentPage": 1,               │
│     "totalPages": 5                 │
│   }                                 │
│ }                                   │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ [Try in API Explorer]               │
│ [Copy cURL]                         │
│ [Share]                             │
│                                     │
└─────────────────────────────────────┘
```

### Mobile API Testing

```
┌─────────────────────────────────────┐
│ ← Try API - GET /projects           │
├─────────────────────────────────────┤
│                                     │
│ Authentication                      │
│ ┌─────────────────────────────────┐ │
│ │ My Production Key ▾             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Query Parameters                    │
│ ┌─────────────────────────────────┐ │
│ │ page          1                 │ │
│ │ pageSize      20                │ │
│ │ status        [Select]          │ │
│ └─────────────────────────────────┘ │
│                                     │
│         [Send Request]              │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ Response (200 OK) - 156ms           │
│                                     │
│ ▼ Body                              │
│ {                                   │
│   "data": [                         │
│     {                               │
│       "id": "proj_123",             │
│       "name": "Website Redesign",   │
│       "status": "active",           │
│       "createdAt": "2025-01-15"     │
│     },                              │
│     ...                             │
│   ],                                │
│   "pagination": {                   │
│     "currentPage": 1,               │
│     "pageSize": 20,                 │
│     "totalPages": 5                 │
│   }                                 │
│ }                                   │
│                                     │
│ ▼ Headers                           │
│ ▼ Request                           │
│                                     │
│ [Save Response]                     │
│ [Copy]                              │
│                                     │
└─────────────────────────────────────┘
```

---

## OAuth Mobile Flow

### Mobile OAuth Implementation (iOS)

```swift
// iOS OAuth Implementation
import AuthenticationServices

class HubbleWaveAuth: NSObject {
    let clientID = "mob_YOUR_CLIENT_ID"
    let redirectURI = "hubblewave://oauth/callback"
    let authURL = "https://auth.hubblewave.com/oauth/authorize"
    let tokenURL = "https://auth.hubblewave.com/oauth/token"

    private var authSession: ASWebAuthenticationSession?
    private var codeVerifier: String?

    func startOAuthFlow(completion: @escaping (Result<String, Error>) -> Void) {
        // Generate PKCE parameters
        codeVerifier = generateCodeVerifier()
        let codeChallenge = generateCodeChallenge(from: codeVerifier!)

        // Build authorization URL
        var components = URLComponents(string: authURL)!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "read write profile"),
            URLQueryItem(name: "code_challenge", value: codeChallenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "state", value: generateState())
        ]

        // Present authentication session
        authSession = ASWebAuthenticationSession(
            url: components.url!,
            callbackURLScheme: "hubblewave"
        ) { [weak self] callbackURL, error in
            guard let self = self,
                  let callbackURL = callbackURL,
                  let code = self.extractCode(from: callbackURL) else {
                if let error = error {
                    completion(.failure(error))
                }
                return
            }

            // Exchange code for token
            self.exchangeCodeForToken(code: code, completion: completion)
        }

        authSession?.presentationContextProvider = self
        authSession?.prefersEphemeralWebBrowserSession = true
        authSession?.start()
    }

    private func exchangeCodeForToken(code: String, completion: @escaping (Result<String, Error>) -> Void) {
        var request = URLRequest(url: URL(string: tokenURL)!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: String] = [
            "grant_type": "authorization_code",
            "code": code,
            "client_id": clientID,
            "redirect_uri": redirectURI,
            "code_verifier": codeVerifier!
        ]

        request.httpBody = try? JSONEncoder().encode(body)

        URLSession.shared.dataTask(with: request) { data, response, error in
            guard let data = data,
                  let tokenResponse = try? JSONDecoder().decode(TokenResponse.self, from: data) else {
                completion(.failure(error ?? OAuthError.invalidResponse))
                return
            }

            // Store tokens securely in Keychain
            KeychainManager.shared.save(accessToken: tokenResponse.accessToken)
            KeychainManager.shared.save(refreshToken: tokenResponse.refreshToken)

            completion(.success(tokenResponse.accessToken))
        }.resume()
    }

    // PKCE helper methods
    private func generateCodeVerifier() -> String {
        var buffer = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, buffer.count, &buffer)
        return Data(buffer).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
            .trimmingCharacters(in: .whitespaces)
    }

    private func generateCodeChallenge(from verifier: String) -> String {
        guard let data = verifier.data(using: .utf8) else { return "" }
        var buffer = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        data.withUnsafeBytes {
            _ = CC_SHA256($0.baseAddress, CC_LONG(data.count), &buffer)
        }
        return Data(buffer).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
            .trimmingCharacters(in: .whitespaces)
    }
}

struct TokenResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
    let tokenType: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case tokenType = "token_type"
    }
}
```

### Mobile OAuth UI Flow

```
┌─────────────────────────────────────┐
│ Welcome to HubbleWave               │
├─────────────────────────────────────┤
│                                     │
│        ╔═══════════╗                │
│        ║           ║                │
│        ║  HUBBLE   ║                │
│        ║   WAVE    ║                │
│        ║           ║                │
│        ╚═══════════╝                │
│                                     │
│  Connect your account to access     │
│  integrations and sync data.        │
│                                     │
│                                     │
│     [Sign in with HubbleWave]       │
│                                     │
│                                     │
│     [Use API Key Instead]           │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

```
┌─────────────────────────────────────┐
│ 🔒 HubbleWave Login     [Done] │
├─────────────────────────────────────┤
│                                     │
│ Email                               │
│ ┌─────────────────────────────────┐ │
│ │ john@example.com                │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Password                            │
│ ┌─────────────────────────────────┐ │
│ │ ●●●●●●●●●●●●                    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ☐ Keep me signed in                 │
│                                     │
│         [Sign In]                   │
│                                     │
│ Forgot password?                    │
│                                     │
└─────────────────────────────────────┘
```

```
┌─────────────────────────────────────┐
│ 🔒 Authorize HubbleWave  [Done] │
├─────────────────────────────────────┤
│                                     │
│ HubbleWave Mobile would like to:    │
│                                     │
│ ☑ Read your data                    │
│   View projects, tasks, and other   │
│   information                       │
│                                     │
│ ☑ Modify your data                  │
│   Create, update, and delete        │
│   information                       │
│                                     │
│ ☑ Access your profile               │
│   View your name and email          │
│                                     │
│ This will allow the app to sync     │
│ data and send notifications.        │
│                                     │
│     [Authorize]    [Cancel]         │
│                                     │
└─────────────────────────────────────┘
```

---

## Integration Monitoring

### Sync Status Dashboard (Mobile)

```
┌─────────────────────────────────────┐
│ ≡  Integrations            🔄  [+]  │
├─────────────────────────────────────┤
│                                     │
│ Active Syncs (3)                    │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🔵 Salesforce                   │ │
│ │ Syncing...                      │ │
│ │ ████████████░░ 85%              │ │
│ │ 170 / 200 records               │ │
│ │ Started: 2m ago                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ✅ Jira                         │ │
│ │ Last sync: 15m ago              │ │
│ │ 234 issues synced               │ │
│ │ Next: in 45m                    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ⚠️ ServiceNow                   │ │
│ │ Last sync failed                │ │
│ │ Connection timeout              │ │
│ │ [Retry Now]                     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Recent Activity                     │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ✓ Salesforce   2h ago   198     │ │
│ │ ✓ Jira         3h ago   187     │ │
│ │ ✗ ServiceNow   5h ago   Failed  │ │
│ │ ✓ SAP          1d ago   1,423   │ │
│ └─────────────────────────────────┘ │
│                                     │
│               [View All]            │
│                                     │
└─────────────────────────────────────┘
```

### Integration Details (Mobile)

```
┌─────────────────────────────────────┐
│ ← Salesforce Integration            │
├─────────────────────────────────────┤
│                                     │
│ ● Active                            │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ Connection                          │
│ Instance: acmecorp.salesforce.com   │
│ User: john@acmecorp.com             │
│ Connected: 2 weeks ago              │
│                                     │
│ [Test Connection]                   │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ Sync Configuration                  │
│ Direction: ⇄ Bi-directional         │
│ Schedule: Every 30 minutes          │
│ Entity: Opportunity → Project       │
│                                     │
│ [Edit Configuration]                │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ Recent Syncs (24h)                  │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ✓ 2m ago     200    2m 15s      │ │
│ │ ✓ 32m ago    198    2m 05s      │ │
│ │ ✓ 1h ago     201    2m 12s      │ │
│ │ ⚠ 2h ago     156    2m 31s      │ │
│ │   44 records skipped            │ │
│ │ ✓ 3h ago     195    2m 08s      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ Performance (7 days)                │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │       ██                        │ │
│ │   ██  ██    ██                  │ │
│ │   ██  ██    ██  ██              │ │
│ │ ──────────────────────────────  │ │
│ │ Mon Tue Wed Thu Fri Sat Sun     │ │
│ │                                 │ │
│ │ Success Rate: 98.2%             │ │
│ │ Avg Duration: 2m 10s            │ │
│ │ Total Synced: 1,487 records     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [View Detailed Logs]                │
│ [Pause Sync]                        │
│ [Delete Integration]                │
│                                     │
└─────────────────────────────────────┘
```

### Webhook Monitoring (Mobile)

```
┌─────────────────────────────────────┐
│ ≡  Webhooks                   [+]   │
├─────────────────────────────────────┤
│                                     │
│ Active Webhooks (2)                 │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ● Project Notifications         │ │
│ │ api.example.com/webhooks/...    │ │
│ │                                 │ │
│ │ Events: project.created         │ │
│ │         project.updated         │ │
│ │                                 │ │
│ │ Deliveries: 142 (24h)           │ │
│ │ Success Rate: 99.3%             │ │
│ │ Last: 2 mins ago ✓              │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ⚠️ Task Updates                 │ │
│ │ hooks.slack.com/services/...    │ │
│ │                                 │ │
│ │ Events: task.completed          │ │
│ │                                 │ │
│ │ Deliveries: 87 (24h)            │ │
│ │ Success Rate: 100%              │ │
│ │ Last: 15 mins ago ✓             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Failed Deliveries (1)               │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ✗ project.updated               │ │
│ │ 1 hour ago                      │ │
│ │ Connection timeout              │ │
│ │ [Retry] [View Details]          │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

---

## Data Import/Export

### Mobile Import

```
┌─────────────────────────────────────┐
│ ← Import Data                       │
├─────────────────────────────────────┤
│                                     │
│ Select Source                       │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 📱 From Device                  │ │
│ │ Choose a file from your device  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ☁️ From Cloud                   │ │
│ │ Import from cloud storage       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 📧 From Email                   │ │
│ │ Import CSV attachment           │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 📸 Scan Document                │ │
│ │ Import from scanned document    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Supported Formats:                  │
│ CSV, Excel, JSON                    │
│                                     │
└─────────────────────────────────────┘
```

### Mobile Export

```
┌─────────────────────────────────────┐
│ ← Export Customers                  │
├─────────────────────────────────────┤
│                                     │
│ Export Options                      │
│                                     │
│ Format                              │
│ ┌─────────────────────────────────┐ │
│ │ ● CSV                           │ │
│ │ ○ Excel                         │ │
│ │ ○ JSON                          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Filters                             │
│ ┌─────────────────────────────────┐ │
│ │ Status: active            [×]   │ │
│ │ Country: US               [×]   │ │
│ └─────────────────────────────────┘ │
│ [Add Filter]                        │
│                                     │
│ Fields                              │
│ ☑ Select All (12 fields)            │
│                                     │
│ Preview                             │
│ Records: 487                        │
│ File Size: ~125 KB                  │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│          [Export]                   │
│                                     │
│ Share To:                           │
│ [Email] [Messages] [Save to Files]  │
│                                     │
└─────────────────────────────────────┘
```

---

## Offline Sync

### Offline Data Access

```typescript
// Mobile offline sync implementation
class OfflineSyncManager {
  private db: SQLiteDatabase;
  private syncQueue: SyncQueue;

  async syncWhenOnline(): Promise<void> {
    if (!this.isOnline()) {
      // Queue changes for later sync
      await this.queueChanges();
      return;
    }

    // Sync queued changes
    const changes = await this.syncQueue.getAll();

    for (const change of changes) {
      try {
        await this.syncChange(change);
        await this.syncQueue.remove(change.id);
      } catch (error) {
        // Retry later
        await this.syncQueue.incrementRetry(change.id);
      }
    }

    // Fetch latest data
    await this.fetchLatestData();
  }

  async queueChange(change: Change): Promise<void> {
    await this.syncQueue.add({
      id: generateId(),
      type: change.type,
      entity: change.entity,
      data: change.data,
      timestamp: Date.now(),
      retries: 0
    });
  }

  private isOnline(): boolean {
    return NetInfo.fetch().then(state => state.isConnected);
  }
}
```

### Offline Indicator (Mobile UI)

```
┌─────────────────────────────────────┐
│ ≡  Integrations           ⚠️ Offline│
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ⚠️ You're currently offline      │ │
│ │                                 │ │
│ │ • Viewing cached data           │ │
│ │ • 3 changes queued for sync     │ │
│ │ • Last synced: 2 hours ago      │ │
│ │                                 │ │
│ │ Changes will sync automatically │ │
│ │ when you're back online.        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Cached Integrations                 │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Salesforce                      │ │
│ │ Last synced: 2h ago             │ │
│ │ Cached: 200 records             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Jira                            │ │
│ │ Last synced: 3h ago             │ │
│ │ Cached: 187 records             │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

---

## Push Notifications

### Sync Failure Notifications

```
┌─────────────────────────────────────┐
│ HubbleWave                    now   │
├─────────────────────────────────────┤
│                                     │
│ ⚠️ Sync Failed - Salesforce         │
│                                     │
│ Your Salesforce sync has failed     │
│ after 5 attempts. Connection        │
│ timeout.                            │
│                                     │
│ Tap to troubleshoot                 │
│                                     │
└─────────────────────────────────────┘
```

### Webhook Delivery Alerts

```
┌─────────────────────────────────────┐
│ HubbleWave              2 mins ago  │
├─────────────────────────────────────┤
│                                     │
│ ⚠️ Webhook Delivery Failed          │
│                                     │
│ Project Notifications webhook       │
│ failed to deliver. All retries      │
│ exhausted.                          │
│                                     │
│ Tap to view details and retry       │
│                                     │
└─────────────────────────────────────┘
```

### Integration Success Notifications

```
┌─────────────────────────────────────┐
│ HubbleWave              5 mins ago  │
├─────────────────────────────────────┤
│                                     │
│ ✅ Import Complete                  │
│                                     │
│ Successfully imported 1,475         │
│ customer records.                   │
│                                     │
│ Tap to view imported data           │
│                                     │
└─────────────────────────────────────┘
```

### Notification Settings

```
┌─────────────────────────────────────┐
│ ← Notification Settings             │
├─────────────────────────────────────┤
│                                     │
│ Integration Notifications           │
│                                     │
│ ☑ Sync failures                     │
│ ☑ Webhook delivery failures         │
│ ☑ Import/export completion          │
│ ☐ Successful syncs                  │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ Notification Frequency              │
│                                     │
│ ● Immediately                       │
│ ○ Hourly digest                     │
│ ○ Daily digest                      │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ Quiet Hours                         │
│                                     │
│ ☑ Enable quiet hours                │
│                                     │
│ From:  [ 10:00 PM ▾ ]               │
│ To:    [  7:00 AM ▾ ]               │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ Critical Alerts                     │
│                                     │
│ ☑ Override quiet hours for          │
│   critical failures                 │
│                                     │
└─────────────────────────────────────┘
```

---

## Mobile UI Components

### CSS for Mobile Integration UI

```css
/* Mobile Integration Styles */
:root {
  --mobile-padding: 1rem;
  --mobile-card-radius: 12px;
  --mobile-touch-target: 44px;
}

.mobile-integration-list {
  padding: var(--mobile-padding);
  background: var(--hw-background);
}

.mobile-integration-card {
  background: var(--hw-surface);
  border-radius: var(--mobile-card-radius);
  padding: 1rem;
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-height: var(--mobile-touch-target);
}

.mobile-integration-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.mobile-integration-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.mobile-integration-card__name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--hw-text-primary);
}

.mobile-integration-card__status {
  font-size: 0.875rem;
  color: var(--hw-text-secondary);
  margin-bottom: 0.5rem;
}

.mobile-integration-progress {
  height: 4px;
  background: var(--hw-surface-elevated);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.mobile-integration-progress__bar {
  height: 100%;
  background: var(--hw-integration-primary);
  transition: width 0.3s ease;
}

.mobile-touch-target {
  min-height: var(--mobile-touch-target);
  min-width: var(--mobile-touch-target);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Offline indicator */
.mobile-offline-banner {
  background: color-mix(in srgb, var(--hw-status-warning) 10%, transparent);
  border-left: 4px solid var(--hw-status-warning);
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: var(--mobile-card-radius);
}

/* Pull to refresh */
.mobile-pull-refresh {
  display: flex;
  justify-content: center;
  padding: 1rem;
  color: var(--hw-text-secondary);
}

.mobile-pull-refresh__spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

This mobile implementation ensures full integration capabilities are accessible on mobile devices with an optimized user experience.

