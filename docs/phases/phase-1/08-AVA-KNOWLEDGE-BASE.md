# Phase 1: Core Platform - AVA Knowledge Base

## Overview

This document defines everything AVA (Autonomous Virtual Assistant) needs to know about Phase 1 features to effectively support users. AVA uses this knowledge base for natural language understanding, contextual help, and proactive assistance.

---

## Domain Knowledge

### HubbleWave Terminology

AVA must use correct HubbleWave terminology when communicating with users:

| Correct Term | Incorrect Term | Definition |
|--------------|----------------|------------|
| Collection | Table | A structured container for records with defined properties |
| Property | Field/Column | An attribute definition within a collection |
| Record | Row | A single data entry within a collection |
| View | List/Filter | A saved configuration for displaying records |
| Instance | Tenant | A customer's isolated environment |
| Workspace | Dashboard | The main working area of the application |
| Group | Team | A collection of users for permission assignment |

### System Architecture Understanding

```yaml
# AVA's mental model of the system
system:
  frontend:
    technology: "React SPA"
    hosting: "CDN with PWA support"
    features:
      - "Responsive design (mobile to desktop)"
      - "Offline capability"
      - "Real-time updates via WebSocket"

  backend:
    technology: "NestJS microservices"
    services:
      - name: "svc-gateway"
        purpose: "API gateway, request routing"
      - name: "svc-auth"
        purpose: "Authentication, authorization"
      - name: "svc-metadata"
        purpose: "Collection and property definitions"
      - name: "svc-data"
        purpose: "Record CRUD operations"

  database:
    type: "PostgreSQL"
    isolation: "Schema-per-instance for data isolation"

  ai:
    ava:
      purpose: "User assistance, natural language interface"
      capabilities:
        - "Answer questions"
        - "Execute actions"
        - "Provide guidance"
        - "Learn from context"
```

---

## Feature Knowledge

### 1. Authentication System

#### What AVA Knows

```yaml
authentication:
  methods:
    - type: "username_password"
      description: "Standard email/password login"
      password_requirements:
        min_length: 12
        requires_uppercase: true
        requires_lowercase: true
        requires_number: true
        requires_symbol: true

    - type: "sso"
      protocols: ["SAML 2.0", "OIDC"]
      description: "Enterprise single sign-on integration"

    - type: "mfa"
      options:
        - "TOTP (authenticator app)"
        - "Email OTP"
        - "SMS OTP"
        - "WebAuthn (security key)"
      when_required: "Risk-based or policy-enforced"

  session:
    duration: "8 hours default, configurable"
    refresh: "Automatic with activity"
    concurrent: "Configurable per instance"

  common_issues:
    - issue: "Forgot password"
      resolution: "Click 'Forgot Password' on login page, check email for reset link"

    - issue: "MFA device lost"
      resolution: "Contact administrator for backup codes or MFA reset"

    - issue: "SSO not working"
      resolution: "Verify SSO is configured, check with IT for IdP status"

    - issue: "Session expired"
      resolution: "This is normal after inactivity. Simply log in again."
```

#### Sample AVA Responses

```
User: "I can't log in"
AVA: "I'm sorry you're having trouble logging in. Let me help:

1. **Forgot Password?** Click 'Forgot Password' on the login screen to reset it.
2. **Using SSO?** Make sure you're clicking the 'Sign in with SSO' button.
3. **MFA Issues?** If you've lost access to your authenticator, contact your administrator.

What specific issue are you experiencing?"

---

User: "How do I set up two-factor authentication?"
AVA: "Great choice for extra security! Here's how to enable MFA:

1. Go to **Settings** → **Security**
2. Click **Enable Two-Factor Authentication**
3. Choose your method:
   - **Authenticator App** (recommended) - Scan the QR code with Google Authenticator or similar
   - **Email** - Receive codes via email
4. Enter the verification code to confirm

Would you like me to take you to the security settings now?"
```

### 2. User Management

#### What AVA Knows

```yaml
user_management:
  user_properties:
    - username: "Unique identifier, typically email"
    - display_name: "Name shown in UI"
    - email: "Contact email for notifications"
    - status: "Active, Inactive, Pending, Locked"
    - roles: "Assigned permission sets"
    - groups: "Group memberships for team-based permissions"
    - preferences: "UI settings, notifications, locale"

  roles:
    description: "Named sets of permissions"
    built_in:
      - "Administrator" # Full system access
      - "Standard User" # Normal access
      - "Read Only" # View-only access
    custom: "Instances can create custom roles"

  groups:
    description: "Collections of users for bulk permission assignment"
    features:
      - "Hierarchical (groups can contain groups)"
      - "Permission inheritance"
      - "Collection-level access control"

  permissions:
    model: "Resource + Action based"
    examples:
      - "record.create"
      - "record.read"
      - "record.update"
      - "record.delete"
      - "collection.admin"
      - "user.manage"

  common_tasks:
    create_user:
      steps:
        - "Navigate to Administration → Users"
        - "Click '+ New User'"
        - "Fill in required fields"
        - "Assign roles and groups"
        - "Save and optionally send invitation"

    deactivate_user:
      steps:
        - "Find user in user list"
        - "Click user to open details"
        - "Change status to 'Inactive'"
        - "Save changes"
      note: "Deactivated users cannot log in but data is preserved"
```

#### Sample AVA Responses

```
User: "How do I add a new team member?"
AVA: "I'll walk you through adding a new user:

1. Go to **Administration** → **Users**
2. Click **+ New User**
3. Enter their details:
   - Email address (required)
   - Display name
   - Initial roles
4. Click **Save & Invite** to send them a welcome email

Would you like me to open the new user form for you?"

---

User: "What's the difference between roles and groups?"
AVA: "Great question! Here's the difference:

**Roles** define *what* someone can do:
- A set of permissions (create, read, update, delete)
- Examples: Administrator, Standard User, Analyst

**Groups** define *who* has access together:
- Collections of users
- Can be assigned permissions on specific collections
- Examples: Finance Team, IT Support, Regional Managers

**Example:** The 'Finance Team' group might have the 'Standard User' role, plus special access to the 'Budgets' collection.

Need help setting up roles or groups for your team?"
```

### 3. Collection Management

#### What AVA Knows

```yaml
collection_management:
  definition: "Collections are structured containers for your data, similar to database tables but more flexible"

  collection_properties:
    - name: "Unique system identifier"
    - display_name: "Human-readable name"
    - icon: "Visual identifier"
    - description: "Purpose and usage notes"
    - properties: "Field definitions"
    - behaviors: "Automation rules"
    - access: "Permission settings"

  property_types:
    text:
      description: "Single or multi-line text"
      options: ["max_length", "pattern", "rich_text"]

    number:
      description: "Integer or decimal values"
      options: ["min", "max", "precision", "format"]

    date:
      description: "Date or datetime values"
      options: ["date_only", "include_time", "timezone"]

    choice:
      description: "Single or multi-select from predefined options"
      options: ["choices", "allow_other", "default"]

    reference:
      description: "Link to records in another collection"
      options: ["target_collection", "display_field", "cascade"]

    user:
      description: "Reference to a user in the system"
      options: ["allow_groups", "multiple"]

    attachment:
      description: "File attachments"
      options: ["allowed_types", "max_size", "multiple"]

    calculated:
      description: "Value computed from other properties"
      options: ["formula", "dependencies", "cache"]

  common_tasks:
    create_collection:
      steps:
        - "Go to Administration → Collections"
        - "Click '+ New Collection'"
        - "Enter name and description"
        - "Add properties"
        - "Configure access permissions"
        - "Save"

    add_property:
      steps:
        - "Open collection settings"
        - "Go to Properties tab"
        - "Click '+ Add Property'"
        - "Choose type and configure options"
        - "Save"
      note: "Adding properties is non-destructive"

    modify_property:
      caution: "Changing property types may affect existing data"
      safe_changes:
        - "Display name"
        - "Description"
        - "Making required → optional"
        - "Extending choices"
      risky_changes:
        - "Changing type (may lose data)"
        - "Making optional → required (may fail validation)"
        - "Removing choices in use"
```

#### Sample AVA Responses

```
User: "I need to track company assets"
AVA: "I can help you create an Assets collection! Based on common asset tracking needs, here's what I recommend:

**Collection: Assets**
- **Name** (Text) - Asset name
- **Asset Tag** (Text) - Unique identifier
- **Type** (Choice) - Hardware, Software, Vehicle, etc.
- **Status** (Choice) - In Use, Available, Retired
- **Assigned To** (User) - Current owner
- **Location** (Text or Reference) - Where it is
- **Purchase Date** (Date)
- **Value** (Number) - Cost/current value

Want me to create this collection for you, or would you like to customize it first?"

---

User: "Can I link records between collections?"
AVA: "Absolutely! HubbleWave supports powerful relationships between collections using **Reference** properties.

**Example:** Link Work Orders to Assets
1. Open the Work Orders collection
2. Add a new property of type **Reference**
3. Select **Assets** as the target collection
4. Choose which field to display (e.g., Asset Name)

Now each work order can be linked to specific assets!

**Pro tips:**
- You can reference multiple records (one-to-many)
- Cascading deletes can be configured
- Related records show up in both directions

Shall I help you set up a specific relationship?"
```

### 4. Record Operations

#### What AVA Knows

```yaml
record_operations:
  create:
    methods:
      - "Form UI (manual entry)"
      - "Quick create (minimal fields)"
      - "Clone existing record"
      - "Import from file"
      - "API integration"
    validation: "Required fields and constraints checked"

  read:
    methods:
      - "List view (data table)"
      - "Detail view (single record)"
      - "Card view (visual)"
      - "Quick view (hover preview)"
    filtering: "Property-based filters"
    sorting: "Any property, multi-column"
    search: "Full-text across all properties"

  update:
    methods:
      - "Form edit"
      - "Inline edit (in table)"
      - "Bulk edit (multiple records)"
    history: "All changes tracked in audit log"
    collaboration: "Real-time presence indicators"

  delete:
    soft_delete: "Records moved to recycle bin"
    retention: "Configurable retention period"
    permanent: "After retention or manual purge"
    cascade: "Dependent on relationship configuration"

  bulk_operations:
    - "Bulk edit (change property values)"
    - "Bulk delete"
    - "Bulk export"
    - "Bulk assign"

  shortcuts:
    keyboard:
      - "Ctrl/Cmd + N: New record"
      - "Ctrl/Cmd + S: Save"
      - "Ctrl/Cmd + E: Edit mode"
      - "Delete: Delete selected"
      - "Escape: Cancel/Close"
```

#### Sample AVA Responses

```
User: "How do I find records from last week?"
AVA: "There are several ways to find recent records:

**Quick Filter:**
1. In the collection view, look for the filter bar
2. Click the **Created** date filter
3. Select **Last 7 days**

**Or use the search bar:**
Type: `created:>-7d` for records created in the last 7 days

**Or ask me!**
Just say: "Show me work orders created last week" and I'll filter them for you.

Would you like me to apply this filter now?"

---

User: "I need to update the status of 50 records at once"
AVA: "You can bulk update records easily:

1. **Select the records:**
   - Click the checkbox in the header to select all visible
   - Or hold Shift and click to select a range
   - Or Ctrl/Cmd+click to select specific ones

2. **Apply bulk action:**
   - Click the **Bulk Actions** button (appears when multiple selected)
   - Choose **Edit**
   - Select the **Status** property
   - Choose the new value
   - Click **Apply to All**

**Tip:** You can filter first to show only the records you want to update, then select all.

Need help filtering to find the right 50 records?"
```

### 5. View System

#### What AVA Knows

```yaml
view_system:
  definition: "Views are saved configurations for displaying and filtering collection data"

  view_types:
    list:
      description: "Table/grid format"
      options: ["columns", "sorting", "grouping", "row_height"]

    card:
      description: "Visual cards with key information"
      options: ["card_fields", "image_field", "card_size"]

    calendar:
      description: "Date-based calendar display"
      requires: "Date property"
      options: ["date_field", "title_field", "color_coding"]

    kanban:
      description: "Column-based workflow view"
      requires: "Choice property for columns"
      options: ["column_field", "card_fields", "wip_limits"]

  view_components:
    filters:
      - "Property-based conditions"
      - "AND/OR logic"
      - "Relative dates (today, this week)"
      - "Current user reference"

    columns:
      - "Show/hide properties"
      - "Column order"
      - "Column width"
      - "Frozen columns"

    sorting:
      - "Primary and secondary sort"
      - "Ascending/descending"

    grouping:
      - "Group by any property"
      - "Collapsible groups"
      - "Group summaries"

  view_visibility:
    personal: "Only visible to creator"
    shared: "Visible to specified users/groups"
    public: "Visible to all with collection access"
    default: "Shown by default when opening collection"

  common_tasks:
    create_view:
      steps:
        - "Configure the display (filters, columns, sort)"
        - "Click 'Save View' or the save icon"
        - "Enter a name"
        - "Choose visibility"
        - "Save"

    share_view:
      steps:
        - "Open view settings"
        - "Change visibility to 'Shared'"
        - "Select users or groups"
        - "Save"
```

#### Sample AVA Responses

```
User: "How do I create a view that shows only my open tasks?"
AVA: "Great idea! Here's how to create a personal task view:

1. Go to your **Tasks** collection
2. Add filters:
   - **Assigned To** = Current User
   - **Status** ≠ Completed
   - **Status** ≠ Cancelled
3. Click **Save View**
4. Name it "My Open Tasks"
5. Keep it as **Personal** (just for you)

**Pro tip:** Set it as your default view so it loads automatically!

Want me to create this view for you right now?"

---

User: "What's the difference between filters and views?"
AVA: "Good question! Here's the key difference:

**Filters** are temporary:
- Apply conditions to narrow down what you see
- Disappear when you navigate away
- Good for one-time searches

**Views** are saved configurations:
- Include filters, but also columns, sorting, grouping
- Persist for future use
- Can be shared with your team
- Can include personal filters like "my records"

**Example workflow:**
1. Apply filters to find what you need
2. Arrange columns how you like
3. Save as a view if you'll need it again

Think of views as "bookmarks" for specific ways of looking at your data.

Would you like help saving your current filter as a view?"
```

---

## Troubleshooting Knowledge

### Common Issues and Resolutions

```yaml
troubleshooting:
  login_issues:
    - symptom: "Password not accepted"
      causes:
        - "Caps lock on"
        - "Password expired"
        - "Account locked"
      resolution: "Try password reset, check with admin if locked"

    - symptom: "SSO redirect loop"
      causes:
        - "Browser cookies disabled"
        - "IdP configuration issue"
      resolution: "Clear cookies, try incognito, contact IT"

  performance_issues:
    - symptom: "Page loads slowly"
      causes:
        - "Large dataset"
        - "Complex view"
        - "Network issues"
      resolution: "Add filters, reduce columns, check connection"

    - symptom: "Search is slow"
      causes:
        - "Searching across many records"
        - "Complex search query"
      resolution: "Be more specific, use filters first"

  data_issues:
    - symptom: "Can't save record"
      causes:
        - "Required field missing"
        - "Validation error"
        - "Permission denied"
      resolution: "Check highlighted fields, verify permissions"

    - symptom: "Data looks wrong"
      causes:
        - "Filter applied"
        - "View not refreshed"
        - "Cache stale"
      resolution: "Clear filters, refresh page, check view settings"

  access_issues:
    - symptom: "Can't see collection"
      causes:
        - "No access granted"
        - "Collection hidden"
        - "Instance restriction"
      resolution: "Contact admin for access"

    - symptom: "Can't edit record"
      causes:
        - "Read-only role"
        - "Record locked"
        - "Workflow restriction"
      resolution: "Check role, wait for unlock, follow workflow"
```

### Sample Troubleshooting Responses

```
User: "I can't see the Assets collection"
AVA: "Let me help troubleshoot that:

**Possible reasons:**
1. **Access not granted** - Your role may not include Assets access
2. **Collection hidden** - It might be in a collapsed group in navigation
3. **Instance setting** - Assets may not be enabled for your instance

**Try these steps:**
1. Expand all groups in the left navigation
2. Use the search bar to search for "Assets"
3. Check if you see it in Administration → Collections (if you have access)

If you can't find it, ask your administrator to grant you access to the Assets collection.

Would you like me to check what collections you currently have access to?"

---

User: "My changes aren't saving"
AVA: "That's frustrating! Let's figure out what's happening:

**Check for these:**
1. 🔴 **Red highlighted fields** - Required fields that need values
2. ⚠️ **Validation errors** - Look for error messages near fields
3. 🔒 **Permission issue** - You may only have read access

**Quick fixes:**
1. Scroll through the form looking for any red indicators
2. Try clicking Save again and watch for error messages
3. Refresh the page and try again

**If none of that works:**
- Check your internet connection
- Try a different browser
- Contact support with the error message

What error message (if any) are you seeing?"
```

---

## Proactive Assistance Triggers

### When AVA Should Offer Help

```yaml
proactive_triggers:
  onboarding:
    - trigger: "First login"
      action: "Offer platform tour"
      message: "Welcome to HubbleWave! Would you like a quick tour of the key features?"

    - trigger: "First time in collection"
      action: "Explain collection purpose"
      message: "This is the {collection} collection. It's used for {purpose}. Need help getting started?"

  confusion_detection:
    - trigger: "User clicks same element 3+ times"
      action: "Offer clarification"
      message: "Having trouble with that button? Let me explain what it does..."

    - trigger: "User on same page for 5+ minutes without action"
      action: "Check in"
      message: "Need any help? I can explain this page or help you find what you're looking for."

    - trigger: "Form validation fails 3+ times"
      action: "Offer guidance"
      message: "Looks like there are some validation issues. Let me explain what each field needs..."

  efficiency_opportunities:
    - trigger: "User manually updates many records"
      action: "Suggest bulk operations"
      message: "I noticed you're updating records one by one. Would you like me to show you how to bulk update?"

    - trigger: "User applies same filter repeatedly"
      action: "Suggest saving view"
      message: "You use this filter often. Want to save it as a view for quick access?"

    - trigger: "User searches for same term multiple times"
      action: "Suggest bookmark or dashboard"
      message: "You search for '{term}' frequently. Would you like to add it to your favorites?"

  learning_moments:
    - trigger: "User discovers feature"
      action: "Explain related features"
      message: "Nice! Now that you know about {feature}, you might also like {related_feature}..."

    - trigger: "User completes complex task"
      action: "Suggest shortcut for next time"
      message: "Great work! Next time, you can do that faster by using {shortcut}."
```

---

## Contextual Awareness

### What AVA Monitors

```yaml
context_awareness:
  user_context:
    - current_page: "Where user is in the app"
    - selected_records: "What records are selected"
    - active_filters: "Current filter state"
    - recent_actions: "Last 10 user actions"
    - user_role: "Permission level"
    - user_preferences: "Saved settings"

  session_context:
    - time_on_page: "Duration on current page"
    - error_count: "Errors encountered this session"
    - feature_usage: "Features used this session"
    - navigation_path: "Pages visited"

  instance_context:
    - enabled_features: "What's available in this instance"
    - custom_collections: "Instance-specific collections"
    - custom_terminology: "Any renamed concepts"
    - integrations: "Connected systems"

  system_context:
    - maintenance_windows: "Scheduled downtime"
    - known_issues: "Current system issues"
    - new_features: "Recently released features"
```

---

## Response Templates

### Standard Response Patterns

```yaml
response_templates:
  how_to:
    structure:
      - "Brief acknowledgment"
      - "Numbered steps"
      - "Pro tip (optional)"
      - "Offer to help further"
    example: |
      Here's how to [task]:
      1. [Step 1]
      2. [Step 2]
      3. [Step 3]

      **Tip:** [Helpful shortcut or related info]

      Would you like me to help you with this?

  explanation:
    structure:
      - "Direct answer"
      - "Brief context/why"
      - "Example (optional)"
      - "Related concepts"
    example: |
      [Direct answer to the question]

      [One sentence of context]

      **Example:** [Concrete example]

      Related topics: [topic1], [topic2]

  troubleshooting:
    structure:
      - "Empathy statement"
      - "Possible causes (bulleted)"
      - "Solutions (numbered)"
      - "Escalation path"
    example: |
      I understand that's frustrating. Let's fix it:

      **Possible causes:**
      - [Cause 1]
      - [Cause 2]

      **Try these:**
      1. [Solution 1]
      2. [Solution 2]

      Still not working? Contact support at [link].

  confirmation:
    structure:
      - "Confirm understanding"
      - "What will happen"
      - "Reversibility note"
      - "Proceed/cancel options"
    example: |
      Just to confirm, you want to [action].

      This will [effect].

      [Can/Cannot] be undone.

      Should I proceed?
```

---

## Learning and Improvement

### How AVA Improves

```yaml
learning_system:
  feedback_collection:
    - "Thumbs up/down on responses"
    - "User corrections"
    - "Resolution success tracking"
    - "Escalation patterns"

  pattern_recognition:
    - "Common question clusters"
    - "Frequently confused concepts"
    - "Feature discovery paths"
    - "Error resolution patterns"

  knowledge_updates:
    - "New features added to knowledge base"
    - "Resolution steps refined based on success"
    - "Terminology updated per instance"
    - "Proactive triggers tuned"

  instance_specific_learning:
    - "Custom collection names and purposes"
    - "Unique workflows"
    - "Team-specific terminology"
    - "Frequently accessed views"
```

---

*Document Version: 1.0*
*Last Updated: Phase 1 Development*
*Next Review: Phase 2 Kickoff*
