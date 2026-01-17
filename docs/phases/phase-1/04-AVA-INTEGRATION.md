# Phase 1: AVA Integration

## AVA Overview

AVA (Autonomous Virtual Assistant) is HubbleWave's AI-powered assistant that provides:
- Natural language interaction with the platform
- Context-aware help and guidance
- Task automation through conversation
- Proactive insights and suggestions
- Learning from user behavior

Unlike ServiceNow's Virtual Agent (which requires extensive configuration), AVA is intelligent by default and learns your organization's terminology automatically.

---

## 1. AVA Architecture for Phase 1

### 1.1 Core Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                          AVA CORE                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   Intent     │  │   Context    │  │   Action     │               │
│  │   Engine     │──│   Manager    │──│   Executor   │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│         │                │                  │                        │
│         ▼                ▼                  ▼                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Knowledge Base                             │   │
│  │  • Platform Metadata (Collections, Properties, Views)        │   │
│  │  • User Context (Role, Permissions, Preferences)             │   │
│  │  • Instance Customizations                                    │   │
│  │  • Conversation History                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   Response   │  │   Learning   │  │   Analytics  │               │
│  │   Generator  │  │    Engine    │  │    Engine    │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Intent Categories for Phase 1

```typescript
// libs/ava/src/intents/phase1-intents.ts

export enum Phase1IntentCategory {
  // Navigation Intents
  NAVIGATE = 'navigate',
  SEARCH = 'search',
  FIND = 'find',

  // Collection Management
  CREATE_COLLECTION = 'create_collection',
  MODIFY_COLLECTION = 'modify_collection',
  EXPLAIN_COLLECTION = 'explain_collection',

  // Record Operations
  CREATE_RECORD = 'create_record',
  UPDATE_RECORD = 'update_record',
  DELETE_RECORD = 'delete_record',
  FIND_RECORDS = 'find_records',
  BULK_OPERATIONS = 'bulk_operations',

  // View Management
  CREATE_VIEW = 'create_view',
  SWITCH_VIEW = 'switch_view',
  FILTER_DATA = 'filter_data',
  SORT_DATA = 'sort_data',

  // User Management
  FIND_USER = 'find_user',
  CHECK_PERMISSIONS = 'check_permissions',
  DELEGATE_ACCESS = 'delegate_access',

  // Help & Guidance
  EXPLAIN_FEATURE = 'explain_feature',
  TROUBLESHOOT = 'troubleshoot',
  SUGGEST_ACTION = 'suggest_action',

  // System
  SETTINGS = 'settings',
  PROFILE = 'profile',
  LOGOUT = 'logout',
}
```

---

## 2. AVA Capabilities for Phase 1

### 2.1 Navigation Assistance

```typescript
// Example interactions AVA handles

// User: "Take me to incidents"
{
  intent: 'navigate',
  entities: {
    destination: 'incidents',
    type: 'collection'
  },
  action: {
    type: 'navigate',
    route: '/collections/incidents'
  },
  response: "Opening Incidents collection for you."
}

// User: "Show me my open tasks"
{
  intent: 'find_records',
  entities: {
    collection: 'tasks',
    filters: [
      { field: 'assignee', value: 'current_user' },
      { field: 'status', value: 'open' }
    ]
  },
  action: {
    type: 'navigate_with_filter',
    route: '/collections/tasks',
    filter: { assignee: '@me', status: 'open' }
  },
  response: "Here are your open tasks. You have 7 tasks assigned to you."
}

// User: "Where do I create a new customer?"
{
  intent: 'find',
  entities: {
    action: 'create',
    target: 'customer'
  },
  action: {
    type: 'guide',
    steps: [
      { instruction: 'Navigate to Customers collection', route: '/collections/customers' },
      { instruction: 'Click New button', highlight: 'button[data-action=new]' }
    ]
  },
  response: "I'll guide you there! Go to the Customers collection and click the '+ New' button at the top right. Would you like me to take you there now?"
}
```

### 2.2 Collection Creation Assistance

```typescript
// User: "Create a collection to track employee training"
{
  intent: 'create_collection',
  entities: {
    name: 'Employee Training',
    purpose: 'track training',
    inferredProperties: [
      { name: 'employee', type: 'reference', target: 'users' },
      { name: 'training_course', type: 'text' },
      { name: 'completion_date', type: 'date' },
      { name: 'score', type: 'number' },
      { name: 'status', type: 'choice', options: ['Not Started', 'In Progress', 'Completed'] },
      { name: 'certificate', type: 'attachment' }
    ]
  },
  action: {
    type: 'create_collection_wizard',
    prefill: {
      name: 'Employee Training',
      description: 'Track employee training courses and completion status',
      properties: [...inferredProperties]
    }
  },
  response: "I'll help you create an Employee Training collection! Based on your needs, I've suggested properties like Employee, Training Course, Completion Date, Score, and Status. Would you like me to set this up for you?"
}
```

### 2.3 Record Operations

```typescript
// User: "Create a new incident for server outage"
{
  intent: 'create_record',
  entities: {
    collection: 'incidents',
    values: {
      short_description: 'Server outage',
      category: 'Infrastructure' // inferred
    }
  },
  action: {
    type: 'open_create_form',
    collection: 'incidents',
    prefill: {
      short_description: 'Server outage',
      category: 'Infrastructure'
    }
  },
  response: "I'm opening a new incident form. I've filled in 'Server outage' as the description. Which server is affected?"
}

// User: "Change the priority of INC0001234 to high"
{
  intent: 'update_record',
  entities: {
    collection: 'incidents',
    record: 'INC0001234',
    changes: {
      priority: 'high'
    }
  },
  action: {
    type: 'update_record',
    collection: 'incidents',
    recordId: 'INC0001234',
    updates: { priority: 'high' }
  },
  confirmation: "Update priority to High for INC0001234?",
  response: "Done! INC0001234 priority is now set to High."
}

// User: "Close all resolved incidents from last month"
{
  intent: 'bulk_operations',
  entities: {
    collection: 'incidents',
    action: 'update',
    filter: {
      status: 'resolved',
      updated_at: { range: 'last_month' }
    },
    changes: {
      status: 'closed'
    }
  },
  action: {
    type: 'bulk_update',
    preview: true // Always preview bulk operations
  },
  response: "I found 23 resolved incidents from last month. Should I close all of them? I'll show you a preview first."
}
```

### 2.4 View and Filter Assistance

```typescript
// User: "Show me incidents assigned to my team that are high priority"
{
  intent: 'filter_data',
  entities: {
    collection: 'incidents',
    filters: [
      { field: 'assignment_group', value: 'current_user_team' },
      { field: 'priority', operator: 'equals', value: 'high' }
    ]
  },
  action: {
    type: 'apply_filter',
    collection: 'incidents',
    filter: {
      operator: 'and',
      conditions: [
        { field: 'assignment_group', operator: 'in', value: '@my_groups' },
        { field: 'priority', operator: 'eq', value: 'high' }
      ]
    }
  },
  response: "Filtering to show high priority incidents for your team. Found 12 matching incidents."
}

// User: "Save this as my daily view"
{
  intent: 'create_view',
  entities: {
    name: 'My Daily View',
    saveCurrentFilters: true,
    visibility: 'personal'
  },
  action: {
    type: 'save_view',
    name: 'My Daily View',
    visibility: 'personal',
    inheritCurrentFilters: true
  },
  response: "Saved! Your 'My Daily View' is now available in your views list. I've added it to your favorites too."
}
```

---

## 3. AVA Context Awareness

### 3.1 Context Types

```typescript
// libs/ava/src/context/context.types.ts

interface AvaContext {
  // User context
  user: {
    id: string;
    name: string;
    roles: string[];
    permissions: string[];
    preferences: UserPreferences;
    timezone: string;
    language: string;
  };

  // Navigation context
  location: {
    route: string;
    collection?: string;
    record?: string;
    view?: string;
  };

  // Selection context
  selection: {
    records?: string[];
    properties?: string[];
  };

  // Form context
  form?: {
    collection: string;
    mode: 'create' | 'edit';
    values: Record<string, unknown>;
    errors: Record<string, string>;
  };

  // Recent activity
  history: {
    recentCollections: string[];
    recentRecords: { collection: string; id: string }[];
    recentSearches: string[];
    recentActions: Action[];
  };

  // Instance context
  instance: {
    customCollections: string[];
    customTerminology: Record<string, string>;
    businessRules: string[];
  };
}
```

### 3.2 Context-Aware Responses

```typescript
// AVA adapts responses based on context

// Context: User is on Incidents list page
// User: "Create new"
{
  // AVA understands "new" means new incident
  intent: 'create_record',
  entities: {
    collection: 'incidents' // Inferred from context
  },
  response: "Opening a new incident form for you."
}

// Context: User is editing a record with validation errors
// User: "What's wrong?"
{
  intent: 'troubleshoot',
  entities: {
    target: 'form_errors'
  },
  response: "I see two issues with this form:\n1. 'Assigned To' is required but empty\n2. 'Due Date' must be in the future\nWould you like me to help fill these in?"
}

// Context: User just completed a complex filter
// User: "Can others see this?"
{
  intent: 'explain_feature',
  entities: {
    feature: 'filter_visibility'
  },
  response: "Currently, this filter is temporary and only visible to you. If you save it as a View, you can choose to share it with others. Would you like to save it?"
}
```

---

## 4. AVA UI Integration

### 4.1 AVA Panel Component

```tsx
// apps/web-client/src/components/ava/AvaPanel.tsx

interface AvaPanelProps {
  isOpen: boolean;
  onClose: () => void;
  position: 'right' | 'bottom' | 'floating';
}

const AvaPanel: React.FC<AvaPanelProps> = ({ isOpen, onClose, position }) => {
  return (
    <Panel
      isOpen={isOpen}
      position={position}
      width={position === 'right' ? 'var(--hw-space-96)' : undefined}
      height={position === 'bottom' ? 'var(--hw-space-64)' : undefined}
    >
      {/* Header */}
      <PanelHeader>
        <AvaAvatar size="sm" />
        <Title>AVA</Title>
        <Badge>AI Assistant</Badge>
        <CloseButton onClick={onClose} />
      </PanelHeader>

      {/* Chat Messages */}
      <ChatContainer>
        <MessageList>
          {messages.map((msg) => (
            <Message
              key={msg.id}
              sender={msg.sender}
              content={msg.content}
              actions={msg.actions}
              timestamp={msg.timestamp}
            />
          ))}
        </MessageList>
      </ChatContainer>

      {/* Quick Suggestions */}
      <SuggestionBar>
        {suggestions.map((suggestion) => (
          <SuggestionChip
            key={suggestion.id}
            onClick={() => handleSuggestion(suggestion)}
          >
            {suggestion.label}
          </SuggestionChip>
        ))}
      </SuggestionBar>

      {/* Input */}
      <InputContainer>
        <TextInput
          placeholder="Ask AVA anything..."
          value={input}
          onChange={setInput}
          onKeyPress={handleKeyPress}
        />
        <VoiceButton onClick={toggleVoice} active={isListening} />
        <SendButton onClick={handleSend} disabled={!input} />
      </InputContainer>
    </Panel>
  );
};
```

### 4.2 Inline AVA Triggers

```tsx
// AVA can be triggered contextually throughout the UI

// Empty state with AVA suggestion
<EmptyState
  icon="search"
  title="No records found"
  description="Try adjusting your filters"
  avaPrompt="Need help? Ask: 'Show me all records'"
/>

// Form field with AVA help
<FormField
  label="Category"
  required
  avaHelp={{
    trigger: 'focus',
    prompt: 'Not sure which category? I can help you choose.',
  }}
>
  <Select options={categories} />
</FormField>

// Error state with AVA troubleshooting
<ErrorBoundary
  fallback={
    <ErrorState
      message="Something went wrong"
      avaAction={{
        label: "Ask AVA for help",
        prompt: "What went wrong with my last action?"
      }}
    />
  }
>
  {children}
</ErrorBoundary>

// Toolbar with AVA quick action
<Toolbar>
  <FilterButton />
  <SortButton />
  <Divider />
  <AvaQuickAction
    icon="sparkles"
    label="Ask AVA"
    shortcut="/"
    onClick={openAva}
  />
</Toolbar>
```

### 4.3 AVA Proactive Suggestions

```typescript
// AVA offers proactive help based on user behavior

// Trigger: User has been on the same page for 2+ minutes without action
{
  type: 'proactive_offer',
  condition: 'idle_on_page',
  threshold: 120, // seconds
  message: "Need any help? I noticed you've been on this page for a while.",
  suggestions: [
    'Explain this page',
    'What can I do here?',
    'Show me a tutorial'
  ]
}

// Trigger: User performs same action repeatedly
{
  type: 'efficiency_tip',
  condition: 'repeated_action',
  threshold: 3,
  action: 'manual_status_update',
  message: "Tip: You can update multiple records at once! Select them and use bulk edit.",
  action: {
    label: 'Show me how',
    type: 'guide',
    steps: ['bulk_select_tutorial']
  }
}

// Trigger: User encounters an error
{
  type: 'error_assistance',
  condition: 'validation_error',
  message: "I see there's an issue with the form. Would you like help?",
  context: 'current_form_errors'
}
```

---

## 5. AVA Learning & Adaptation

### 5.1 Learning from Instance Customizations

```typescript
// AVA automatically learns new terminology and structures

// When a new collection is created
avaService.learnCollection({
  collection: newCollection,
  // AVA now understands:
  // - Collection name and synonyms
  // - Property names and types
  // - Relationships to other collections
  // - Common queries users might ask
});

// When instance adds custom terminology
avaService.learnTerminology({
  // Client calls incidents "Tickets"
  'Ticket': { mapsTo: 'incident', context: 'IT Support' },
  'Bug': { mapsTo: 'incident', context: 'Development', category: 'Software' },
});

// When users frequently use certain patterns
avaService.learnPattern({
  pattern: 'my [status] [collection]',
  interpretation: {
    filter: { assignee: '@me', status: '$status' },
    collection: '$collection'
  },
  examples: [
    'my open tickets',
    'my resolved incidents',
    'my pending tasks'
  ]
});
```

### 5.2 Instance-Specific Training

```typescript
// libs/ava/src/training/instance-trainer.ts

interface InstanceTrainingData {
  // Collection metadata
  collections: {
    name: string;
    label: string;
    pluralLabel: string;
    synonyms: string[];
    properties: PropertyInfo[];
    commonQueries: string[];
  }[];

  // Business terminology
  terminology: {
    term: string;
    definition: string;
    context: string;
    aliases: string[];
  }[];

  // Workflow patterns
  workflows: {
    name: string;
    description: string;
    triggers: string[];
    actions: string[];
  }[];

  // User roles and what they typically do
  rolePatterns: {
    role: string;
    commonActions: string[];
    frequentCollections: string[];
  }[];
}

@Injectable()
export class InstanceTrainer {
  async trainFromMetadata(instanceId: string): Promise<void> {
    // Load all collections
    const collections = await this.collectionsService.findAll();

    // Extract training data
    const trainingData: InstanceTrainingData = {
      collections: collections.map(c => ({
        name: c.name,
        label: c.label,
        pluralLabel: c.pluralLabel,
        synonyms: c.avaKeywords || [],
        properties: c.properties.map(p => ({
          name: p.name,
          label: p.label,
          type: p.type,
          description: p.avaDescription,
        })),
        commonQueries: this.generateCommonQueries(c),
      })),

      terminology: await this.loadInstanceTerminology(instanceId),
      workflows: await this.loadWorkflowPatterns(instanceId),
      rolePatterns: await this.analyzeRolePatterns(instanceId),
    };

    // Update AVA's knowledge base
    await this.avaKnowledgeService.updateInstanceKnowledge(
      instanceId,
      trainingData
    );
  }
}
```

---

## 6. AVA API Endpoints

```typescript
// apps/svc-ava/src/app/ava/ava.controller.ts

@Controller('ava')
@ApiTags('AVA - AI Assistant')
export class AvaController {
  @Post('chat')
  @ApiOperation({ summary: 'Send a message to AVA' })
  async chat(@Body() dto: AvaChatDto): Promise<AvaChatResponse> {
    // Process user message with full context
  }

  @Post('suggest')
  @ApiOperation({ summary: 'Get contextual suggestions' })
  async suggest(@Body() dto: AvaSuggestDto): Promise<AvaSuggestion[]> {
    // Get proactive suggestions based on context
  }

  @Post('action')
  @ApiOperation({ summary: 'Execute AVA-recommended action' })
  async executeAction(@Body() dto: AvaActionDto): Promise<AvaActionResult> {
    // Execute an action AVA suggested
  }

  @Get('history')
  @ApiOperation({ summary: 'Get conversation history' })
  async getHistory(): Promise<AvaMessage[]> {
    // Return conversation history for current session
  }

  @Post('feedback')
  @ApiOperation({ summary: 'Provide feedback on AVA response' })
  async feedback(@Body() dto: AvaFeedbackDto): Promise<void> {
    // Record user feedback for learning
  }

  @Get('capabilities')
  @ApiOperation({ summary: 'Get AVA capabilities for current context' })
  async getCapabilities(): Promise<AvaCapabilities> {
    // Return what AVA can do in current context
  }
}
```

---

## 7. AVA Response Templates

```typescript
// libs/ava/src/responses/templates.ts

export const AvaResponseTemplates = {
  // Greetings
  greeting: {
    morning: "Good morning! How can I help you today?",
    afternoon: "Good afternoon! What would you like to do?",
    evening: "Good evening! I'm here to help.",
    returning: "Welcome back, {{userName}}! Pick up where you left off?",
  },

  // Confirmations
  confirmation: {
    success: "Done! {{actionDescription}}",
    created: "Created {{itemType}} successfully. Would you like to {{nextAction}}?",
    updated: "Updated {{itemType}}. The changes are saved.",
    deleted: "Deleted {{itemType}}. This action cannot be undone.",
  },

  // Clarifications
  clarification: {
    ambiguous: "I found multiple matches for '{{term}}'. Did you mean:\n{{options}}",
    missing: "I need more information. {{missingField}}?",
    confirm: "Just to confirm: You want to {{action}}. Is that correct?",
  },

  // Errors
  error: {
    notFound: "I couldn't find {{item}}. Try a different search term?",
    noPermission: "You don't have permission to {{action}}. Contact your admin for access.",
    invalid: "That's not quite right. {{explanation}}",
    unknown: "Something went wrong. Let me try a different approach.",
  },

  // Guidance
  guidance: {
    howTo: "Here's how to {{action}}:\n{{steps}}",
    tip: "Pro tip: {{tip}}",
    shortcut: "Quick shortcut: {{shortcut}}",
  },

  // Suggestions
  suggestion: {
    proactive: "Based on your recent activity, would you like to {{suggestion}}?",
    efficiency: "You could save time by {{suggestion}}",
    explore: "Have you tried {{feature}}? It might help with {{useCase}}.",
  },
};
```
