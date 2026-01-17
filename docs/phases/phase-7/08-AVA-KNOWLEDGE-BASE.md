# Phase 7: Revolutionary Features - AVA Knowledge Base

**Purpose:** Training data and knowledge base for AVA (AI Virtual Assistant) Phase 7 capabilities
**Target Audience:** AI/ML Engineers, Product Managers, Training Teams
**Last Updated:** 2025-12-30

## Table of Contents

1. [Voice Command Library](#voice-command-library)
2. [AR Feature Guidance](#ar-feature-guidance)
3. [App Building Best Practices](#app-building-best-practices)
4. [Report Generation Tips](#report-generation-tips)
5. [Natural Language Query Patterns](#natural-language-query-patterns)
6. [Troubleshooting Responses](#troubleshooting-responses)
7. [Contextual Help System](#contextual-help-system)
8. [Training Examples](#training-examples)

---

## Voice Command Library

### Wake Word Variations

AVA recognizes multiple variations of the wake word:

```yaml
wake_words:
  primary: "Hey AVA"
  variations:
    - "Hey Ava"
    - "Hi AVA"
    - "OK AVA"
    - "AVA"

  false_positives_to_ignore:
    - "Hey Java"
    - "Hey lava"
    - "They are"
    - "Say that"
```

### Navigation Commands

#### Asset Navigation

```yaml
intent: navigate.asset
description: "Navigate to a specific asset detail page"

patterns:
  - "show [me] asset {assetId}"
  - "open asset {assetId}"
  - "display asset {assetId}"
  - "go to asset {assetId}"
  - "take me to asset {assetId}"
  - "I want to see asset {assetId}"
  - "pull up asset {assetId}"
  - "view asset {assetId}"

entity_extraction:
  assetId:
    patterns:
      - "[A-Z]+-[0-9]+"  # PUMP-001
      - "[A-Z]+[0-9]+"   # PUMP001
      - "(?i)pump (?:number )?(\d+)"  # pump 1, pump number 1

response_templates:
  success: "Opening asset {assetId}"
  not_found: "I couldn't find asset {assetId}. Did you mean {suggestions}?"

examples:
  - input: "Hey AVA, show me asset PUMP-001"
    output:
      intent: navigate.asset
      entities: { assetId: "PUMP-001" }
      action: navigate
      target: /assets/PUMP-001

  - input: "Hey AVA, open pump 5"
    output:
      intent: navigate.asset
      entities: { assetId: "PUMP-005" }
      action: navigate
      target: /assets/PUMP-005
```

#### Dashboard Navigation

```yaml
intent: navigate.dashboard
description: "Navigate to various dashboards"

patterns:
  - "show [me] [the] dashboard"
  - "open [the] dashboard"
  - "take me to [the] dashboard"
  - "go to [the] dashboard"
  - "display [the] {dashboardType} dashboard"

dashboardTypes:
  - "main"
  - "asset"
  - "maintenance"
  - "work order"
  - "analytics"
  - "performance"

response_templates:
  success: "Opening {dashboardType} dashboard"

examples:
  - input: "Hey AVA, show me the dashboard"
    output:
      intent: navigate.dashboard
      entities: { dashboardType: "main" }
      action: navigate
      target: /dashboard

  - input: "Hey AVA, open maintenance dashboard"
    output:
      intent: navigate.dashboard
      entities: { dashboardType: "maintenance" }
      action: navigate
      target: /dashboard/maintenance
```

### Work Order Commands

#### Create Work Order

```yaml
intent: workorder.create
description: "Create a new work order"

patterns:
  - "create [a] work order [for] [asset] {assetId}"
  - "new work order [for] [asset] {assetId}"
  - "make [a] work order [for] [asset] {assetId}"
  - "start [a] work order [for] [asset] {assetId}"
  - "open [a] work order [for] [asset] {assetId}"
  - "schedule maintenance [for] [asset] {assetId}"

multi_turn_dialogue:
  step_1:
    prompt: "What asset needs maintenance?"
    expected: assetId

  step_2:
    prompt: "What type of maintenance?"
    options: ["Preventive", "Corrective", "Predictive", "Emergency"]
    expected: workOrderType

  step_3:
    prompt: "What priority level?"
    options: ["Low", "Medium", "High", "Critical"]
    expected: priority
    default: "Medium"

  step_4:
    prompt: "When should this be scheduled?"
    expected: scheduleDate
    default: "as soon as possible"

  step_5:
    prompt: "Who should I assign this to?"
    expected: assignee
    optional: true

response_templates:
  confirm: "I've created work order {woId} for {assetId} with {priority} priority, scheduled for {scheduleDate}"
  error: "I couldn't create the work order: {errorMessage}"

examples:
  - input: "Hey AVA, create work order for PUMP-001"
    dialogue:
      - AVA: "What type of maintenance?"
      - User: "Preventive"
      - AVA: "What priority level?"
      - User: "High"
      - AVA: "When should this be scheduled?"
      - User: "Next Tuesday"
      - AVA: "Who should I assign this to?"
      - User: "John Smith"
      - AVA: "I've created work order WO-12345 for PUMP-001 with high priority, scheduled for Tuesday, January 7th and assigned to John Smith. I'll send him a notification."
```

#### View Work Orders

```yaml
intent: workorder.view
description: "View work orders with optional filters"

patterns:
  - "show [me] [my] work orders"
  - "what work orders [do I have]"
  - "list [all] work orders"
  - "display work orders [for] [asset] {assetId}"
  - "show {status} work orders"
  - "show work orders [assigned to] {assignee}"
  - "what's on my schedule [today|this week|this month]"

filters:
  status: ["Open", "In Progress", "Completed", "Cancelled"]
  priority: ["Low", "Medium", "High", "Critical"]
  timeframe: ["today", "this week", "this month", "overdue"]

response_templates:
  success: "You have {count} {status} work orders. {summary}"
  empty: "You have no {filter} work orders"

examples:
  - input: "Hey AVA, show me my work orders"
    output:
      intent: workorder.view
      filters: { assignee: "current_user" }
      response: "You have 7 work orders. 3 are open, 2 in progress, and 2 completed today."

  - input: "Hey AVA, what's overdue?"
    output:
      intent: workorder.view
      filters: { timeframe: "overdue" }
      response: "You have 2 overdue work orders: WO-123 for PUMP-001 (3 days overdue) and WO-456 for MOTOR-5 (1 day overdue)"
```

### Search Commands

```yaml
intent: search.assets
description: "Search for assets with various filters"

patterns:
  - "search [for] {query}"
  - "find [me] {query}"
  - "look for {query}"
  - "show [me] [all] {assetType} [in] [location] {location}"
  - "list [all] {assetType} [with] {status} status"
  - "which {assetType} [are] {condition}"

assetTypes:
  - "pumps"
  - "motors"
  - "compressors"
  - "HVAC"
  - "equipment"
  - "assets"

conditions:
  - "critical"
  - "warning"
  - "operational"
  - "offline"
  - "due for maintenance"
  - "overdue"
  - "running hot"
  - "vibrating"

entity_extraction:
  location:
    patterns:
      - "Building [A-Z]"
      - "Floor [0-9]+"
      - "Room [0-9]+"
      - "Site [A-Z0-9]+"

response_templates:
  found: "I found {count} {assetType} {filters}. {summary}"
  not_found: "I couldn't find any {assetType} matching {filters}"

examples:
  - input: "Hey AVA, show me all pumps in Building A"
    output:
      intent: search.assets
      entities:
        assetType: "pump"
        location: "Building A"
      results: 12
      response: "I found 12 pumps in Building A. 10 are operational, 2 have warnings."

  - input: "Hey AVA, which motors are critical?"
    output:
      intent: search.assets
      entities:
        assetType: "motor"
        status: "critical"
      results: 3
      response: "3 motors have critical status: MOTOR-5, MOTOR-12, and MOTOR-23"
```

### Status Inquiry Commands

```yaml
intent: asset.status
description: "Get current status of an asset"

patterns:
  - "what [is] [the] status [of] [asset] {assetId}"
  - "how is {assetId} [doing]"
  - "is {assetId} [ok|okay|operational]"
  - "check {assetId}"
  - "tell me about {assetId}"
  - "what's [the] condition of {assetId}"
  - "what's wrong with {assetId}"

response_format:
  status: "{assetId} is {status}"
  metrics: "Temperature: {temperature}°C, Vibration: {vibration} mm/s"
  health: "{healthSummary}"
  recommendations: "{recommendations}"

examples:
  - input: "Hey AVA, what is the status of PUMP-001?"
    response: "PUMP-001 is operational. Temperature is 75°C (normal), vibration is 2.3 mm/s (good). All systems are running within normal parameters. Next maintenance is scheduled for December 15th."

  - input: "Hey AVA, is MOTOR-5 okay?"
    response: "MOTOR-5 has a warning status. Temperature is elevated at 82°C, which is above the normal range of 60-75°C. I recommend scheduling an inspection soon."
```

---

## AR Feature Guidance

### AR Session Guidance

```yaml
ar_feature: asset_scanning
description: "Guide user through AR asset scanning"

instructions:
  start:
    message: "Point your camera at the asset's QR code or barcode"
    visual: "Show AR camera view with scanning reticle"

  scanning:
    message: "Hold steady... scanning"
    visual: "Animated scanning effect"

  detected:
    message: "Asset detected! Loading information..."
    visual: "Green checkmark animation"
    haptic: "Success vibration"

  display:
    message: "Here's the asset information"
    visual: "AR overlay with asset details"

troubleshooting:
  poor_lighting:
    detect: "Low light level detected"
    message: "Lighting is low. Try moving to a brighter area or turning on your flashlight"
    action: "Offer to enable flashlight"

  no_qr_found:
    detect: "No QR code detected after 5 seconds"
    message: "I can't find a QR code. Make sure you're pointing at the asset's QR label and it's clearly visible"
    visual: "Show example of QR code placement"

  blurry_image:
    detect: "Motion blur detected"
    message: "Hold your device still for a clearer image"
    visual: "Stability indicator"

  distance_too_far:
    detect: "QR code too small in frame"
    message: "Move closer to the asset"
    visual: "Distance indicator"

  distance_too_close:
    detect: "QR code too large/distorted"
    message: "Move back a bit"
    visual: "Distance indicator"

examples:
  - scenario: "User starts AR scan"
    ava_guidance:
      - "Point your camera at the asset's QR code"
      - "Great, I see the code. Hold steady..."
      - "Asset PUMP-001 detected! Here's the real-time status"
      - [Shows AR overlay with temperature, vibration, status]
```

### AR Maintenance Guidance

```yaml
ar_feature: maintenance_guidance
description: "Step-by-step AR-guided maintenance"

procedure_structure:
  header:
    - procedure_name
    - total_steps
    - estimated_time
    - safety_warnings

  step_format:
    step_number: integer
    instruction: string
    ar_highlight: "component to highlight"
    tool_required: string (optional)
    safety_note: string (optional)
    completion_criteria: string

conversation_flow:
  start:
    user: "Hey AVA, guide me through oil change for PUMP-001"
    ava: "Starting oil change procedure for PUMP-001. This has 5 steps and takes about 30 minutes. First, let's make sure safety protocols are in place. Have you locked out and tagged the pump?"

  step_progression:
    ava_introduces_step: "Step {n} of {total}: {instruction}"
    ar_visual: "Highlight component in AR view"
    user_action: "User performs action"
    user_confirms: "Done" or taps AR checkmark
    ava_confirms: "Great! Moving to step {n+1}"

  issue_detection:
    user: "Hey AVA, I can't find the drain plug"
    ava: "Let me help you locate it. The drain plug is on the bottom of the pump housing. I'll highlight it for you."
    ar_visual: "Bright highlight on drain plug with arrow"

  completion:
    ava: "Excellent work! You've completed all 5 steps. The oil change is complete. I've logged this maintenance in the system. Would you like me to update the asset record?"

example_procedure:
  name: "Oil Change - Centrifugal Pump"
  steps:
    - number: 1
      instruction: "Ensure pump is shut down and locked out"
      ar_highlight: "Lockout/tagout location"
      safety_note: "Do not proceed without proper lockout"
      completion: "User confirms lockout"

    - number: 2
      instruction: "Locate drain plug on pump housing bottom"
      ar_highlight: "Drain plug with glowing outline"
      tool_required: "19mm wrench"
      completion: "User taps drain plug in AR"

    - number: 3
      instruction: "Place drip pan underneath and remove drain plug"
      ar_highlight: "Drain plug + drip pan placement zone"
      safety_note: "Oil may be hot"
      completion: "User reports oil draining"

    - number: 4
      instruction: "Wait for oil to fully drain (approximately 5 minutes)"
      ar_visual: "Timer overlay"
      completion: "Timer expires or user confirms"

    - number: 5
      instruction: "Replace drain plug and add new oil through fill port"
      ar_highlight: "Fill port location"
      completion: "User confirms fill complete"
```

---

## App Building Best Practices

### AVA-Guided App Creation

```yaml
app_building_conversation:
  description: "AVA guides users through creating custom apps"

  discovery_phase:
    ava_question_1: "What would you like this app to do?"
    user_response: "I need an inspection checklist for daily equipment rounds"

    ava_question_2: "What information should the inspection capture?"
    user_response: "Asset ID, location, visual condition, any issues, and a photo"

    ava_question_3: "Will this be used on mobile devices or desktop?"
    user_response: "Mobile - technicians will use tablets in the field"

    ava_question_4: "What should happen after someone submits an inspection?"
    user_response: "If issues are found, create a work order automatically"

  confirmation_phase:
    ava_summary: |
      "Let me summarize what I'm building:

      📱 Daily Equipment Inspection App
      • Mobile-optimized for tablets
      • Captures: Asset ID, Location, Condition, Issues, Photo
      • Automatically creates work orders when issues reported
      • Saves all inspections to database

      Does this sound right?"

    user_confirmation: "Perfect!"

  generation_phase:
    ava_status_updates:
      - "Creating form layout..."
      - "Setting up data model..."
      - "Configuring automatic work order workflow..."
      - "Applying mobile-responsive design..."
      - "Running validation tests..."

    ava_completion: |
      "Your app is ready! I've called it 'Daily Equipment Inspections'.
      Here's what I created:

      ✓ 5 input fields with validation
      ✓ Camera integration for photos
      ✓ Auto work order creation workflow
      ✓ Offline support for field use
      ✓ Manager dashboard for review

      Would you like to see it in action?"

  customization_phase:
    user_request: "Can you add a signature field?"
    ava_response: "Adding signature field... Done! I've placed it at the bottom of the form. Anything else?"

    user_request: "Make the photo required only if issues are found"
    ava_response: "Updated! Photo is now required only when issues are reported. I've also grayed out the photo field until issues are entered so it's clear to users."

app_building_tips:
  best_practices:
    - title: "Start Simple"
      description: "Create basic version first, then add features"
      example: "Build form with core fields, add advanced features later"

    - title: "Mobile-First"
      description: "Design for smallest screen first"
      example: "Single column layouts work best on mobile"

    - title: "Clear Labels"
      description: "Use descriptive field labels"
      example: "Asset ID (e.g., PUMP-001)" vs just "ID"

    - title: "Validation"
      description: "Add validation rules to ensure data quality"
      example: "Require asset ID format: XXX-###"

    - title: "Workflows"
      description: "Automate common actions"
      example: "Auto-assign work orders based on location"

common_patterns:
  inspection_form:
    fields:
      - "Asset ID (required)"
      - "Location (dropdown)"
      - "Date/Time (auto-filled)"
      - "Inspector (auto-filled)"
      - "Checklist items (checkboxes)"
      - "Notes (text area)"
      - "Photo (image upload)"
      - "Signature (signature pad)"
    workflow:
      - "On submit → Save to database"
      - "If issues → Create work order"
      - "Send notification to supervisor"

  data_collection_form:
    fields:
      - "Asset ID (required)"
      - "Meter readings (numeric)"
      - "Status indicators (radio buttons)"
      - "Timestamp (auto)"
    workflow:
      - "Save to time-series database"
      - "Update asset last reading"
      - "Trigger alerts if threshold exceeded"

  approval_workflow:
    fields:
      - "Request details"
      - "Requestor (auto)"
      - "Cost estimate"
      - "Justification"
    workflow:
      - "Route to approver based on cost"
      - "Send email notification"
      - "On approval → Execute action"
      - "On rejection → Notify requestor"
```

---

## Report Generation Tips

### Natural Language Report Requests

```yaml
report_generation:
  description: "AVA generates reports from natural language requests"

  examples:
    - user_request: "Show me all maintenance activities for last month"
      ava_interpretation:
        type: "Maintenance Summary Report"
        time_period: "Last month (December 2025)"
        scope: "All activities"

      ava_clarifications:
        - "Should I include costs?"
        - "Do you want to group by asset type or location?"
        - "Any specific metrics you're interested in?"

      generated_sections:
        - "Executive Summary"
        - "Activity Count by Type"
        - "Cost Breakdown"
        - "Asset Type Distribution"
        - "Technician Performance"
        - "Trends vs Previous Month"

    - user_request: "Compare downtime between buildings this quarter"
      ava_interpretation:
        type: "Downtime Comparison Report"
        time_period: "Q4 2025"
        dimension: "By building"

      generated_sections:
        - "Downtime by Building (chart)"
        - "Top 3 contributors to downtime"
        - "Cost impact per building"
        - "Recommendations for improvement"

    - user_request: "Which assets need attention in the next 30 days?"
      ava_interpretation:
        type: "Predictive Maintenance Report"
        time_period: "Next 30 days"
        focus: "Assets requiring attention"

      generated_sections:
        - "Assets due for preventive maintenance"
        - "Assets showing warning signs"
        - "Recommended inspection schedule"
        - "Parts to order proactively"

report_best_practices:
  - title: "Be Specific About Time Period"
    good: "Last month", "Q4 2025", "Past 90 days"
    bad: "Recently", "A while ago"

  - title: "Specify What to Compare"
    good: "Compare costs between buildings"
    bad: "Show me costs"

  - title: "Indicate Grouping"
    good: "Grouped by asset type"
    bad: "Show all assets"

  - title: "State Purpose"
    good: "For executive review" → generates summary view
    good: "For detailed analysis" → generates detailed tables

customization_options:
  user: "Can you add a chart showing trend over time?"
  ava: "Adding trend chart... Done! I've added a line chart showing the trend over the past 6 months for context."

  user: "Export this as PDF"
  ava: "Generating PDF... Your report 'Maintenance Summary December 2025' has been exported. Download it here: [link]"

  user: "Can you make this a monthly recurring report?"
  ava: "I can set this up to generate automatically on the 1st of each month. Who should I send it to?"
```

---

## Natural Language Query Patterns

### Query Translation Examples

```yaml
nl_queries:
  description: "Natural language to SQL query translation"

  simple_queries:
    - nl: "Show me all pumps"
      sql: "SELECT * FROM assets WHERE asset_type = 'Pump'"
      interpretation: "Retrieving all pump assets from the database"

    - nl: "How many work orders are open?"
      sql: "SELECT COUNT(*) FROM work_orders WHERE status = 'Open'"
      interpretation: "Counting open work orders"
      result_narration: "You have {count} open work orders"

  filtered_queries:
    - nl: "Show pumps with temperature above 80 degrees"
      sql: |
        SELECT * FROM assets
        WHERE asset_type = 'Pump'
        AND temperature > 80
      interpretation: "Finding pumps with elevated temperature"

    - nl: "Which assets in Building A need maintenance?"
      sql: |
        SELECT a.* FROM assets a
        JOIN maintenance_schedule m ON a.id = m.asset_id
        WHERE a.location = 'Building A'
        AND m.next_due < CURRENT_DATE + INTERVAL '30 days'
      interpretation: "Finding assets in Building A with upcoming maintenance"

  aggregation_queries:
    - nl: "Average downtime by asset type this month"
      sql: |
        SELECT
          asset_type,
          AVG(downtime_hours) as avg_downtime
        FROM downtime_events
        WHERE event_date >= DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY asset_type
        ORDER BY avg_downtime DESC
      interpretation: "Calculating average downtime grouped by asset type for current month"
      result_narration: "Here's the average downtime by asset type: Pumps: {pump_avg} hours, Motors: {motor_avg} hours..."

  time_series_queries:
    - nl: "Show temperature trend for PUMP-001 over last 24 hours"
      sql: |
        SELECT
          timestamp,
          temperature
        FROM sensor_readings
        WHERE asset_id = 'PUMP-001'
        AND timestamp > NOW() - INTERVAL '24 hours'
        ORDER BY timestamp
      interpretation: "Retrieving 24-hour temperature history for PUMP-001"
      visualization: "Line chart"

  complex_queries:
    - nl: "Which technicians completed the most work orders last month and what was their average completion time?"
      sql: |
        SELECT
          t.name as technician,
          COUNT(wo.id) as work_orders_completed,
          AVG(EXTRACT(EPOCH FROM (wo.completed_at - wo.started_at))/3600) as avg_hours
        FROM work_orders wo
        JOIN technicians t ON wo.assigned_to = t.id
        WHERE wo.status = 'Completed'
        AND wo.completed_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
        AND wo.completed_at < DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY t.name
        ORDER BY work_orders_completed DESC
        LIMIT 10
      interpretation: "Analyzing technician productivity for previous month"
      result_narration: "Top performer was {top_tech} with {count} work orders completed in an average of {avg_time} hours"

query_refinement:
  ambiguous_query:
    user: "Show me the status"
    ava: "I can show you status for assets, work orders, or systems. Which would you like?"
    user: "Assets"
    ava: "Would you like all assets or a specific location/type?"

  clarification_needed:
    user: "Show me recent activities"
    ava: "How recent? Last 24 hours, last week, or last month?"
    user: "Last week"
    ava: [Executes query for last 7 days]
```

---

## Troubleshooting Responses

### Common Issues and AVA Responses

```yaml
troubleshooting:

  voice_not_working:
    symptoms:
      - "Hey AVA not responding"
      - "Voice commands not recognized"

    ava_diagnosis:
      - "Let me check your microphone permissions"
      - "I notice your mic might be muted"
      - "Background noise is quite high"

    ava_solutions:
      - "Please enable microphone access in your browser settings"
      - "Try clicking the microphone icon to unmute"
      - "Move to a quieter area or use push-to-talk mode"

    ava_alternative:
      - "While we fix this, you can type your questions in the chat"

  ar_not_loading:
    symptoms:
      - "AR view won't start"
      - "Camera not activating"

    ava_diagnosis:
      - "Checking camera permissions..."
      - "AR requires camera access"
      - "Your device doesn't support AR"

    ava_solutions:
      - "Please allow camera access when prompted"
      - "Try refreshing the page"
      - "AR requires a device with ARCore or ARKit support"

    ava_alternative:
      - "You can view asset information in standard view instead"

  slow_performance:
    symptoms:
      - "App is slow"
      - "Reports taking long to generate"

    ava_diagnosis:
      - "I notice your connection is slow"
      - "You're requesting a large dataset"
      - "Server load is high right now"

    ava_solutions:
      - "Try connecting to WiFi for better performance"
      - "I can generate a smaller sample report first"
      - "I'll notify you when the full report is ready"

    ava_proactive:
      - "I'm caching data for offline use to improve performance"

  offline_mode:
    symptoms:
      - "No internet connection"
      - "Can't sync data"

    ava_response:
      - "You're offline, but I can still help with local data"
      - "Your work orders will sync when you're back online"
      - "I've saved your changes locally"

    ava_capabilities_offline:
      - "View previously loaded assets"
      - "Create work orders (will sync later)"
      - "Access offline reports"
      - "Use AR with cached models"
```

---

## Contextual Help System

### Context-Aware Assistance

```yaml
contextual_help:
  description: "AVA provides help based on current user context"

  page_specific_help:
    asset_detail_page:
      unprompted_tip: "Tip: You can say 'Hey AVA, create work order' to quickly schedule maintenance for this asset"

      common_questions:
        - "What's the maintenance history?"
        - "When is next maintenance?"
        - "Show me similar assets"
        - "What parts does this need?"

    work_order_form:
      unprompted_tip: "Say 'Hey AVA, fill from last work order' to copy details from the previous one"

      common_questions:
        - "Who should I assign this to?"
        - "What's the recommended priority?"
        - "How long does this type of work usually take?"

    dashboard:
      unprompted_tip: "Try saying 'Hey AVA, what needs my attention?' for prioritized action items"

      common_questions:
        - "What's overdue?"
        - "Show me critical assets"
        - "Generate daily report"

  user_behavior_based:
    struggling_user:
      detection: "User clicks back button 3+ times"
      ava_offer: "You seem to be looking for something. Can I help you find it?"

    repeat_action:
      detection: "User performs same action 5+ times"
      ava_suggestion: "I notice you're doing this repeatedly. Would you like me to create a shortcut or automate this?"

    idle_user:
      detection: "No activity for 2 minutes on complex page"
      ava_prompt: "Need any help? I can guide you through this process"

  time_based:
    morning_greeting:
      time: "8:00 AM - 10:00 AM"
      message: "Good morning! Here's what's on your schedule today: {daily_summary}"

    end_of_day:
      time: "4:00 PM - 6:00 PM"
      message: "You've completed {completed_count} work orders today. Would you like a summary report?"

    overdue_reminder:
      condition: "User has overdue work orders"
      message: "Reminder: You have {count} overdue work orders. Would you like me to help reschedule them?"
```

---

## Training Examples

### Training Data Structure

```yaml
training_examples:
  description: "Sample conversations for training AVA's understanding"

  multi_turn_conversations:
    - conversation_id: "c001"
      category: "Work Order Management"
      turns:
        - speaker: "User"
          text: "Hey AVA, I need to schedule maintenance"

        - speaker: "AVA"
          text: "I can help with that. Which asset needs maintenance?"
          context: { expecting: "asset_id" }

        - speaker: "User"
          text: "PUMP-001"

        - speaker: "AVA"
          text: "Got it, PUMP-001. What type of maintenance?"
          context: { asset_id: "PUMP-001", expecting: "maintenance_type" }
          ui_action: "Show maintenance type options"

        - speaker: "User"
          text: "Oil change"

        - speaker: "AVA"
          text: "Oil change for PUMP-001. What priority?"
          context: { asset_id: "PUMP-001", maintenance_type: "oil_change", expecting: "priority" }

        - speaker: "User"
          text: "High"

        - speaker: "AVA"
          text: "When would you like to schedule it?"
          context: { asset_id: "PUMP-001", maintenance_type: "oil_change", priority: "high", expecting: "schedule_date" }

        - speaker: "User"
          text: "Next Tuesday at 9 AM"

        - speaker: "AVA"
          text: "Perfect. I've created work order WO-12345 for oil change on PUMP-001 with high priority, scheduled for Tuesday, January 7th at 9:00 AM. Who should I assign this to?"
          context: { wo_created: "WO-12345", expecting: "assignee" }
          ui_action: "Display new work order"

        - speaker: "User"
          text: "Assign to John Smith"

        - speaker: "AVA"
          text: "Done! Work order WO-12345 is assigned to John Smith. I'll send him a notification now."
          actions:
            - "Assign work order to John Smith"
            - "Send notification"
          ui_action: "Show confirmation"

    - conversation_id: "c002"
      category: "AR Assistance"
      turns:
        - speaker: "User"
          text: "Hey AVA, guide me through the inspection"
          context: { ar_active: true, asset_scanned: "MOTOR-5" }

        - speaker: "AVA"
          text: "Starting inspection guide for MOTOR-5. First, let's check the bearing temperature. Point your camera at the bearing housing."
          ar_action: "Highlight bearing housing"

        - speaker: "User"
          text: "I'm looking at it"

        - speaker: "AVA"
          text: "Great. Does the bearing housing feel excessively hot to touch?"
          ar_action: "Show normal temperature range overlay"

        - speaker: "User"
          text: "Yes, it's very hot"

        - speaker: "AVA"
          text: "That's a concern. This bearing is running above normal temperature. Let me check the sensor data... The bearing temperature is 95°C, which is 20 degrees above normal. I recommend shutting down this motor and scheduling immediate maintenance. Should I create an emergency work order?"
          context: { issue_detected: "bearing_overheating", severity: "high" }

        - speaker: "User"
          text: "Yes, create it"

        - speaker: "AVA"
          text: "Emergency work order WO-E-789 created for MOTOR-5 bearing overheating. I've notified the maintenance supervisor and flagged this as high priority. Please shut down the motor safely now."
          actions:
            - "Create emergency work order"
            - "Notify supervisor"
            - "Update asset status to critical"
          ar_action: "Show shutdown procedure overlay"

  edge_cases:
    - scenario: "Unclear reference"
      user: "Show me the pump"
      ava: "I found 47 pumps in the system. Could you be more specific? You can mention the asset ID, location, or another distinguishing feature."

    - scenario: "Impossible request"
      user: "Delete all work orders"
      ava: "I can't delete all work orders as that would cause data loss. If you need to cancel specific work orders, I can help with that. Which ones would you like to cancel?"

    - scenario: "Ambiguous time reference"
      user: "Show me last month's report"
      ava: "Just to clarify - do you mean December 2025 or the last 30 days from today?"

    - scenario: "Unsupported language"
      user: "Muéstrame la bomba número uno"
      ava: "I currently only support English, but I'm learning! Would you like me to show you PUMP-001?"
```

---

## Performance Metrics

### AVA Quality Metrics

```yaml
quality_metrics:
  intent_accuracy:
    target: 94%
    measurement: "Correct intent identified / Total commands"

  entity_extraction:
    target: 96%
    measurement: "Correctly extracted entities / Total entities"

  conversation_completion:
    target: 91%
    measurement: "Tasks completed / Tasks started"

  user_satisfaction:
    target: 4.7 / 5.0
    measurement: "Post-interaction rating"

  response_time:
    target: "< 1 second"
    measurement: "Time from command to response"

  false_positive_wake_word:
    target: "< 2%"
    measurement: "Incorrect wake activations / Total activations"

continuous_improvement:
  feedback_loop:
    - "Collect user corrections"
    - "Analyze failed commands"
    - "Update training data"
    - "Retrain models monthly"
    - "A/B test improvements"

  monitoring:
    - "Real-time intent confidence scoring"
    - "Failed command logging"
    - "User satisfaction tracking"
    - "Edge case identification"
```

---

## Document Control

- **Version:** 1.0
- **Last Updated:** 2025-12-30
- **Owner:** HubbleWave AI Team
- **Review Cycle:** Weekly during Phase 7
- **Related Documents:**
  - 04-AVA-INTEGRATION.md
  - 01-IMPLEMENTATION-GUIDE.md
