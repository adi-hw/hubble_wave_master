# Phase 4: UI Specifications

**Audience:** Frontend Engineers, UX Designers
**Dependencies:** Phase 1 UI Framework, Design System
**Technology:** React, TypeScript, CSS Custom Properties

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Visual Workflow Canvas](#visual-workflow-canvas)
3. [Node Palette](#node-palette)
4. [Node Configuration](#node-configuration)
5. [Approval UI](#approval-ui)
6. [SLA Dashboard](#sla-dashboard)
7. [Notification Center](#notification-center)
8. [Template Editor](#template-editor)
9. [Design Tokens](#design-tokens)
10. [Responsive Behavior](#responsive-behavior)
11. [Accessibility](#accessibility)

---

## Design Principles

### Core Principles

1. **Visual Clarity** - Workflows should be immediately understandable
2. **Drag-and-Drop First** - Minimal clicking, maximum dragging
3. **Real-time Feedback** - Instant validation and error messages
4. **Progressive Disclosure** - Hide complexity until needed
5. **Familiar Patterns** - Leverage mental models from Figma, Miro, etc.

### Visual Language

- **Nodes**: Rounded rectangles with icon, label, and ports
- **Connections**: Curved bezier lines with directional arrows
- **States**: Use background fill and border to indicate status
- **Actions**: Inline buttons appear on hover
- **Validation**: Red borders and error messages inline

---

## Visual Workflow Canvas

### Canvas Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Workflow Designer - Incident Assignment                     [×] │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ┌─────────────┐                                                 │
│ │   FILE      │  [Save] [Test] [Activate]           [?] [×]   │
│ └─────────────┘                                                 │
│                                                                   │
├──────────┬───────────────────────────────────────────────────────┤
│          │                                                        │
│  NODES   │                    CANVAS                             │
│          │                                                        │
│  [icon]  │    ┌─────────────┐                                   │
│  Start   │    │   START     │                                   │
│          │    │  Created     │                                   │
│  [icon]  │    └──────┬──────┘                                   │
│  Action  │           │                                            │
│          │           ▼                                            │
│  [icon]  │    ┌─────────────┐                                   │
│  Approval│    │   ACTION    │                                   │
│          │    │ Assign to    │                                   │
│  [icon]  │    │   Group      │                                   │
│ Condition│    └──────┬──────┘                                   │
│          │           │                                            │
│  [icon]  │           ▼                                            │
│  Wait    │    ┌─────────────┐                                   │
│          │    │  APPROVAL   │                                   │
│  [icon]  │    │   Manager    │                                   │
│  End     │    └──┬────────┬─┘                                   │
│          │       │        │                                       │
│  [icon]  │  Approved   Rejected                                 │
│ Subflow  │       │        │                                       │
│          │       ▼        ▼                                       │
│          │   ┌────────┐ ┌────────┐                              │
│          │   │  END   │ │  END   │                              │
│          │   │Success │ │Rejected│                              │
│          │   └────────┘ └────────┘                              │
│          │                                                        │
├──────────┴───────────────────────────────────────────────────────┤
│ PROPERTIES PANEL                                                 │
│                                                                   │
│ Node: Approval - Manager                                         │
│                                                                   │
│ Approver Type:  [Dropdown: Dynamic Field ▼]                     │
│ Field:          [Dropdown: Assigned To ▼]                       │
│ Approval Type:  [Dropdown: Sequential ▼]                        │
│ Timeout (hours): [24                   ]                        │
│                                                                   │
│ Escalation:                                                      │
│ ☑ Enable escalation after 12 hours                              │
│ Action: [Notify Manager     ▼]                                  │
│                                                                   │
│                                        [Cancel] [Apply]          │
└──────────────────────────────────────────────────────────────────┘
```

### Canvas Implementation

```typescript
// components/WorkflowCanvas/WorkflowCanvas.tsx

import React, { useState, useRef, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
} from 'reactflow';
import 'reactflow.css';

interface WorkflowCanvasProps {
  workflowId?: string;
  onSave?: (nodes: Node[], edges: Edge[]) => void;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  workflowId,
  onSave
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');

      if (!type) return;

      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { label: type.charAt(0).toUpperCase() + type.slice(1) },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div className="workflow-canvas">
      <div className="workflow-canvas__toolbar">
        <button className="hw-button hw-button--primary" onClick={() => onSave?.(nodes, edges)}>
          Save
        </button>
        <button className="hw-button hw-button--secondary">
          Test
        </button>
        <button className="hw-button hw-button--success">
          Activate
        </button>
      </div>

      <div className="workflow-canvas__container">
        <div className="workflow-canvas__palette">
          <NodePalette />
        </div>

        <div
          className="workflow-canvas__canvas"
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls />
            <Background />
            <MiniMap />
          </ReactFlow>
        </div>

        <div className="workflow-canvas__properties">
          {selectedNode && (
            <NodeProperties
              node={selectedNode}
              onUpdate={(updatedNode) => {
                setNodes((nds) =>
                  nds.map((n) => (n.id === updatedNode.id ? updatedNode : n))
                );
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
```

### Canvas Styles

```css
/* styles/components/workflow-canvas.css */

.workflow-canvas {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--hw-surface-primary);
}

.workflow-canvas__toolbar {
  display: flex;
  align-items: center;
  gap: var(--hw-spacing-md);
  padding: var(--hw-spacing-md) var(--hw-spacing-lg);
  background: var(--hw-surface-secondary);
  border-bottom: 1px solid var(--hw-border-primary);
}

.workflow-canvas__container {
  display: grid;
  grid-template-columns: 200px 1fr 320px;
  flex: 1;
  overflow: hidden;
}

.workflow-canvas__palette {
  padding: var(--hw-spacing-md);
  background: var(--hw-surface-secondary);
  border-right: 1px solid var(--hw-border-primary);
  overflow-y: auto;
}

.workflow-canvas__canvas {
  position: relative;
  background: var(--hw-canvas-background);
}

.workflow-canvas__properties {
  padding: var(--hw-spacing-lg);
  background: var(--hw-surface-secondary);
  border-left: 1px solid var(--hw-border-primary);
  overflow-y: auto;
}

/* ReactFlow customization */
.react-flow__node {
  border-radius: var(--hw-radius-md);
  border: 2px solid var(--hw-border-primary);
  background: var(--hw-surface-primary);
  box-shadow: var(--hw-shadow-sm);
  padding: var(--hw-spacing-md);
  min-width: 180px;
  cursor: pointer;
  transition: all var(--hw-transition-fast);
}

.react-flow__node:hover {
  border-color: var(--hw-primary-base);
  box-shadow: var(--hw-shadow-md);
}

.react-flow__node.selected {
  border-color: var(--hw-primary-base);
  box-shadow: 0 0 0 3px var(--hw-primary-transparent);
}

.react-flow__edge-path {
  stroke: var(--hw-border-primary);
  stroke-width: 2;
}

.react-flow__edge.selected .react-flow__edge-path {
  stroke: var(--hw-primary-base);
  stroke-width: 3;
}

.react-flow__handle {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--hw-border-primary);
  background: var(--hw-surface-primary);
}

.react-flow__handle:hover {
  border-color: var(--hw-primary-base);
  background: var(--hw-primary-light);
}

.react-flow__controls {
  box-shadow: var(--hw-shadow-md);
  border-radius: var(--hw-radius-md);
  border: 1px solid var(--hw-border-primary);
}

.react-flow__controls-button {
  border-bottom: 1px solid var(--hw-border-primary);
  background: var(--hw-surface-primary);
}

.react-flow__controls-button:hover {
  background: var(--hw-surface-hover);
}

.react-flow__minimap {
  border-radius: var(--hw-radius-md);
  border: 1px solid var(--hw-border-primary);
  box-shadow: var(--hw-shadow-md);
}
```

---

## Node Palette

### Palette Component

```typescript
// components/NodePalette/NodePalette.tsx

interface NodeType {
  type: string;
  label: string;
  icon: string;
  description: string;
}

const nodeTypes: NodeType[] = [
  {
    type: 'start',
    label: 'Start',
    icon: 'play_circle',
    description: 'Workflow trigger'
  },
  {
    type: 'action',
    label: 'Action',
    icon: 'bolt',
    description: 'Update record, create item'
  },
  {
    type: 'approval',
    label: 'Approval',
    icon: 'check_circle',
    description: 'Route for approval'
  },
  {
    type: 'condition',
    label: 'Condition',
    icon: 'alt_route',
    description: 'Branch based on logic'
  },
  {
    type: 'wait',
    label: 'Wait',
    icon: 'schedule',
    description: 'Pause until condition'
  },
  {
    type: 'subflow',
    label: 'Subflow',
    icon: 'account_tree',
    description: 'Embed workflow'
  },
  {
    type: 'end',
    label: 'End',
    icon: 'stop_circle',
    description: 'Workflow completion'
  }
];

export const NodePalette: React.FC = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="node-palette">
      <div className="node-palette__header">
        <span className="node-palette__title">Nodes</span>
      </div>

      <div className="node-palette__list">
        {nodeTypes.map((node) => (
          <div
            key={node.type}
            className="node-palette__item"
            draggable
            onDragStart={(e) => onDragStart(e, node.type)}
          >
            <span className="node-palette__icon material-icons">
              {node.icon}
            </span>
            <div className="node-palette__content">
              <span className="node-palette__label">{node.label}</span>
              <span className="node-palette__description">
                {node.description}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Palette Styles

```css
/* styles/components/node-palette.css */

.node-palette {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.node-palette__header {
  padding: var(--hw-spacing-md) 0;
  border-bottom: 1px solid var(--hw-border-primary);
  margin-bottom: var(--hw-spacing-md);
}

.node-palette__title {
  font-size: var(--hw-font-size-sm);
  font-weight: var(--hw-font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--hw-text-secondary);
}

.node-palette__list {
  display: flex;
  flex-direction: column;
  gap: var(--hw-spacing-sm);
}

.node-palette__item {
  display: flex;
  align-items: center;
  gap: var(--hw-spacing-sm);
  padding: var(--hw-spacing-sm);
  background: var(--hw-surface-primary);
  border: 1px solid var(--hw-border-primary);
  border-radius: var(--hw-radius-sm);
  cursor: grab;
  transition: all var(--hw-transition-fast);
}

.node-palette__item:hover {
  background: var(--hw-surface-hover);
  border-color: var(--hw-primary-base);
  box-shadow: var(--hw-shadow-sm);
}

.node-palette__item:active {
  cursor: grabbing;
}

.node-palette__icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hw-primary-base);
  font-size: 20px;
}

.node-palette__content {
  display: flex;
  flex-direction: column;
  gap: var(--hw-spacing-xs);
  flex: 1;
  min-width: 0;
}

.node-palette__label {
  font-size: var(--hw-font-size-sm);
  font-weight: var(--hw-font-weight-medium);
  color: var(--hw-text-primary);
}

.node-palette__description {
  font-size: var(--hw-font-size-xs);
  color: var(--hw-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

---

## Node Configuration

### Custom Node Components

```typescript
// components/WorkflowNodes/ActionNode.tsx

interface ActionNodeProps {
  data: {
    label: string;
    action?: string;
    fields?: Record<string, any>;
  };
}

export const ActionNode: React.FC<ActionNodeProps> = ({ data }) => {
  return (
    <div className="workflow-node workflow-node--action">
      <div className="workflow-node__header">
        <span className="workflow-node__icon material-icons">bolt</span>
        <span className="workflow-node__label">{data.label}</span>
      </div>

      {data.action && (
        <div className="workflow-node__body">
          <span className="workflow-node__detail">{data.action}</span>
        </div>
      )}

      {/* Input/Output handles */}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

// components/WorkflowNodes/ApprovalNode.tsx

export const ApprovalNode: React.FC<NodeProps> = ({ data }) => {
  return (
    <div className="workflow-node workflow-node--approval">
      <div className="workflow-node__header">
        <span className="workflow-node__icon material-icons">check_circle</span>
        <span className="workflow-node__label">{data.label}</span>
      </div>

      <div className="workflow-node__body">
        <span className="workflow-node__detail">{data.approver || 'Not configured'}</span>
      </div>

      {/* Input and two outputs (approve/reject) */}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} id="approved" />
      <Handle type="source" position={Position.Bottom} id="rejected" />
    </div>
  );
};

// components/WorkflowNodes/ConditionNode.tsx

export const ConditionNode: React.FC<NodeProps> = ({ data }) => {
  return (
    <div className="workflow-node workflow-node--condition">
      <div className="workflow-node__header">
        <span className="workflow-node__icon material-icons">alt_route</span>
        <span className="workflow-node__label">{data.label}</span>
      </div>

      <div className="workflow-node__body">
        <span className="workflow-node__detail">
          {data.condition || 'Not configured'}
        </span>
      </div>

      {/* Input and two outputs (true/false) */}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} id="true" />
      <Handle type="source" position={Position.Bottom} id="false" />
    </div>
  );
};
```

### Node Styles

```css
/* styles/components/workflow-node.css */

.workflow-node {
  display: flex;
  flex-direction: column;
  min-width: 180px;
  background: var(--hw-surface-primary);
  border-radius: var(--hw-radius-md);
  box-shadow: var(--hw-shadow-sm);
  transition: all var(--hw-transition-fast);
}

.workflow-node__header {
  display: flex;
  align-items: center;
  gap: var(--hw-spacing-sm);
  padding: var(--hw-spacing-sm) var(--hw-spacing-md);
  border-bottom: 1px solid var(--hw-border-primary);
  background: var(--hw-surface-secondary);
  border-top-left-radius: var(--hw-radius-md);
  border-top-right-radius: var(--hw-radius-md);
}

.workflow-node__icon {
  font-size: 18px;
  color: var(--hw-text-secondary);
}

.workflow-node__label {
  font-size: var(--hw-font-size-sm);
  font-weight: var(--hw-font-weight-semibold);
  color: var(--hw-text-primary);
}

.workflow-node__body {
  padding: var(--hw-spacing-md);
}

.workflow-node__detail {
  font-size: var(--hw-font-size-xs);
  color: var(--hw-text-secondary);
}

/* Node type variants */
.workflow-node--start .workflow-node__header {
  background: var(--hw-success-light);
}

.workflow-node--start .workflow-node__icon {
  color: var(--hw-success-base);
}

.workflow-node--action .workflow-node__header {
  background: var(--hw-primary-light);
}

.workflow-node--action .workflow-node__icon {
  color: var(--hw-primary-base);
}

.workflow-node--approval .workflow-node__header {
  background: var(--hw-warning-light);
}

.workflow-node--approval .workflow-node__icon {
  color: var(--hw-warning-base);
}

.workflow-node--condition .workflow-node__header {
  background: var(--hw-info-light);
}

.workflow-node--condition .workflow-node__icon {
  color: var(--hw-info-base);
}

.workflow-node--end .workflow-node__header {
  background: var(--hw-error-light);
}

.workflow-node--end .workflow-node__icon {
  color: var(--hw-error-base);
}

/* State styles */
.workflow-node--executing {
  border: 2px solid var(--hw-primary-base);
  box-shadow: 0 0 0 3px var(--hw-primary-transparent);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 3px var(--hw-primary-transparent);
  }
  50% {
    box-shadow: 0 0 0 6px var(--hw-primary-transparent);
  }
}

.workflow-node--completed {
  border: 2px solid var(--hw-success-base);
  opacity: 0.7;
}

.workflow-node--failed {
  border: 2px solid var(--hw-error-base);
}
```

### Properties Panel

```typescript
// components/NodeProperties/NodeProperties.tsx

interface NodePropertiesProps {
  node: Node;
  onUpdate: (node: Node) => void;
}

export const NodeProperties: React.FC<NodePropertiesProps> = ({
  node,
  onUpdate
}) => {
  const [config, setConfig] = useState(node.data.config || {});

  const handleChange = (field: string, value: any) => {
    const updatedConfig = { ...config, [field]: value };
    setConfig(updatedConfig);
    onUpdate({
      ...node,
      data: { ...node.data, config: updatedConfig }
    });
  };

  const renderProperties = () => {
    switch (node.type) {
      case 'action':
        return <ActionProperties config={config} onChange={handleChange} />;
      case 'approval':
        return <ApprovalProperties config={config} onChange={handleChange} />;
      case 'condition':
        return <ConditionProperties config={config} onChange={handleChange} />;
      case 'wait':
        return <WaitProperties config={config} onChange={handleChange} />;
      default:
        return <div>No properties available</div>;
    }
  };

  return (
    <div className="node-properties">
      <div className="node-properties__header">
        <h3 className="node-properties__title">
          {node.type.charAt(0).toUpperCase() + node.type.slice(1)} Node
        </h3>
      </div>

      <div className="node-properties__body">
        {renderProperties()}
      </div>

      <div className="node-properties__footer">
        <button className="hw-button hw-button--secondary">
          Cancel
        </button>
        <button className="hw-button hw-button--primary">
          Apply
        </button>
      </div>
    </div>
  );
};

// Approval properties component
const ApprovalProperties: React.FC<PropertyComponentProps> = ({
  config,
  onChange
}) => {
  return (
    <div className="property-form">
      <div className="property-form__field">
        <label className="property-form__label">Approver Type</label>
        <select
          className="hw-select"
          value={config.approver_type || 'user'}
          onChange={(e) => onChange('approver_type', e.target.value)}
        >
          <option value="user">Specific User</option>
          <option value="group">Assignment Group</option>
          <option value="role">Role</option>
          <option value="dynamic">Dynamic Field</option>
        </select>
      </div>

      {config.approver_type === 'dynamic' && (
        <div className="property-form__field">
          <label className="property-form__label">Field</label>
          <select
            className="hw-select"
            value={config.approver_field || ''}
            onChange={(e) => onChange('approver_field', e.target.value)}
          >
            <option value="">Select field...</option>
            <option value="assigned_to">Assigned To</option>
            <option value="manager">Manager</option>
            <option value="requester">Requester</option>
          </select>
        </div>
      )}

      <div className="property-form__field">
        <label className="property-form__label">Approval Type</label>
        <select
          className="hw-select"
          value={config.approval_type || 'sequential'}
          onChange={(e) => onChange('approval_type', e.target.value)}
        >
          <option value="sequential">Sequential</option>
          <option value="parallel_any">Parallel (Any Approves)</option>
          <option value="parallel_all">Parallel (All Approve)</option>
        </select>
      </div>

      <div className="property-form__field">
        <label className="property-form__label">Timeout (hours)</label>
        <input
          type="number"
          className="hw-input"
          value={config.timeout_hours || 24}
          onChange={(e) => onChange('timeout_hours', parseInt(e.target.value))}
          min="1"
          max="168"
        />
      </div>

      <div className="property-form__field">
        <label className="property-form__checkbox">
          <input
            type="checkbox"
            checked={config.escalation_enabled || false}
            onChange={(e) => onChange('escalation_enabled', e.target.checked)}
          />
          <span>Enable escalation</span>
        </label>
      </div>

      {config.escalation_enabled && (
        <>
          <div className="property-form__field">
            <label className="property-form__label">Escalate after (hours)</label>
            <input
              type="number"
              className="hw-input"
              value={config.escalation_hours || 12}
              onChange={(e) => onChange('escalation_hours', parseInt(e.target.value))}
            />
          </div>

          <div className="property-form__field">
            <label className="property-form__label">Escalation Action</label>
            <select
              className="hw-select"
              value={config.escalation_action || 'notify_manager'}
              onChange={(e) => onChange('escalation_action', e.target.value)}
            >
              <option value="notify_manager">Notify Manager</option>
              <option value="auto_approve">Auto-Approve</option>
              <option value="auto_reject">Auto-Reject</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
};
```

---

## Approval UI

### Approval Card Component

```typescript
// components/ApprovalCard/ApprovalCard.tsx

interface ApprovalCardProps {
  approval: Approval;
  onApprove: (id: string, comments: string) => void;
  onReject: (id: string, comments: string) => void;
  onDelegate: (id: string, userId: string, comments: string) => void;
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({
  approval,
  onApprove,
  onReject,
  onDelegate
}) => {
  const [showActions, setShowActions] = useState(false);
  const [comments, setComments] = useState('');

  return (
    <div className="approval-card">
      <div className="approval-card__header">
        <div className="approval-card__icon">
          <span className="material-icons">check_circle</span>
        </div>
        <div className="approval-card__title">
          <h4>{approval.workflow_name}</h4>
          <span className="approval-card__meta">
            Requested by {approval.requester_name} • {formatRelativeTime(approval.created_at)}
          </span>
        </div>
        <div className="approval-card__priority">
          <span className={`hw-badge hw-badge--${approval.priority}`}>
            {approval.priority}
          </span>
        </div>
      </div>

      <div className="approval-card__body">
        <div className="approval-card__record">
          <span className="approval-card__label">Record:</span>
          <a href={approval.record_url} className="approval-card__link">
            {approval.record_number}
          </a>
        </div>

        <div className="approval-card__description">
          {approval.description}
        </div>

        {approval.due_date && (
          <div className="approval-card__due">
            <span className="material-icons">schedule</span>
            <span>Due {formatRelativeTime(approval.due_date)}</span>
          </div>
        )}
      </div>

      <div className="approval-card__footer">
        {!showActions ? (
          <div className="approval-card__actions">
            <button
              className="hw-button hw-button--success"
              onClick={() => setShowActions(true)}
            >
              <span className="material-icons">check</span>
              Approve
            </button>
            <button
              className="hw-button hw-button--error"
              onClick={() => setShowActions(true)}
            >
              <span className="material-icons">close</span>
              Reject
            </button>
            <button className="hw-button hw-button--secondary">
              <span className="material-icons">person_add</span>
              Delegate
            </button>
          </div>
        ) : (
          <div className="approval-card__form">
            <textarea
              className="hw-textarea"
              placeholder="Add comments (optional)"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
            />
            <div className="approval-card__form-actions">
              <button
                className="hw-button hw-button--secondary"
                onClick={() => setShowActions(false)}
              >
                Cancel
              </button>
              <button
                className="hw-button hw-button--success"
                onClick={() => onApprove(approval.id, comments)}
              >
                Confirm Approval
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

### Approval Card Styles

```css
/* styles/components/approval-card.css */

.approval-card {
  display: flex;
  flex-direction: column;
  background: var(--hw-surface-primary);
  border: 1px solid var(--hw-border-primary);
  border-radius: var(--hw-radius-md);
  box-shadow: var(--hw-shadow-sm);
  transition: all var(--hw-transition-fast);
}

.approval-card:hover {
  box-shadow: var(--hw-shadow-md);
}

.approval-card__header {
  display: flex;
  align-items: flex-start;
  gap: var(--hw-spacing-md);
  padding: var(--hw-spacing-md);
  border-bottom: 1px solid var(--hw-border-primary);
}

.approval-card__icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hw-warning-light);
  border-radius: var(--hw-radius-md);
  color: var(--hw-warning-base);
}

.approval-card__icon .material-icons {
  font-size: 24px;
}

.approval-card__title {
  flex: 1;
  min-width: 0;
}

.approval-card__title h4 {
  margin: 0 0 var(--hw-spacing-xs) 0;
  font-size: var(--hw-font-size-base);
  font-weight: var(--hw-font-weight-semibold);
  color: var(--hw-text-primary);
}

.approval-card__meta {
  font-size: var(--hw-font-size-xs);
  color: var(--hw-text-secondary);
}

.approval-card__priority {
  flex-shrink: 0;
}

.approval-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--hw-spacing-md);
  padding: var(--hw-spacing-md);
}

.approval-card__record {
  display: flex;
  align-items: center;
  gap: var(--hw-spacing-sm);
  font-size: var(--hw-font-size-sm);
}

.approval-card__label {
  color: var(--hw-text-secondary);
}

.approval-card__link {
  color: var(--hw-primary-base);
  text-decoration: none;
  font-weight: var(--hw-font-weight-medium);
}

.approval-card__link:hover {
  text-decoration: underline;
}

.approval-card__description {
  font-size: var(--hw-font-size-sm);
  color: var(--hw-text-primary);
  line-height: var(--hw-line-height-relaxed);
}

.approval-card__due {
  display: flex;
  align-items: center;
  gap: var(--hw-spacing-xs);
  padding: var(--hw-spacing-sm);
  background: var(--hw-warning-light);
  border-radius: var(--hw-radius-sm);
  font-size: var(--hw-font-size-xs);
  color: var(--hw-warning-dark);
}

.approval-card__due .material-icons {
  font-size: 16px;
}

.approval-card__footer {
  padding: var(--hw-spacing-md);
  border-top: 1px solid var(--hw-border-primary);
}

.approval-card__actions {
  display: flex;
  gap: var(--hw-spacing-sm);
}

.approval-card__form {
  display: flex;
  flex-direction: column;
  gap: var(--hw-spacing-md);
}

.approval-card__form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--hw-spacing-sm);
}
```

---

## SLA Dashboard

### SLA Widget Component

```typescript
// components/SLAWidget/SLAWidget.tsx

interface SLAWidgetProps {
  recordId: string;
  table: string;
}

export const SLAWidget: React.FC<SLAWidgetProps> = ({ recordId, table }) => {
  const { data: slas, isLoading } = useSLAInstances(recordId, table);

  if (isLoading) return <LoadingSpinner />;
  if (!slas || slas.length === 0) return null;

  return (
    <div className="sla-widget">
      <div className="sla-widget__header">
        <h3 className="sla-widget__title">SLA Status</h3>
      </div>

      <div className="sla-widget__list">
        {slas.map((sla) => (
          <SLATimer key={sla.id} sla={sla} />
        ))}
      </div>
    </div>
  );
};

// SLA Timer Component
interface SLATimerProps {
  sla: SLAInstance;
}

const SLATimer: React.FC<SLATimerProps> = ({ sla }) => {
  const percentage = (sla.elapsed_seconds / sla.target_seconds) * 100;
  const status = getStatus(sla.state, percentage);

  return (
    <div className={`sla-timer sla-timer--${status}`}>
      <div className="sla-timer__header">
        <span className="sla-timer__name">{sla.sla_name}</span>
        <span className="sla-timer__state">
          {sla.state === 'paused' && (
            <span className="material-icons">pause_circle</span>
          )}
          {formatTime(sla.remaining_seconds)}
        </span>
      </div>

      <div className="sla-timer__progress">
        <div
          className="sla-timer__progress-bar"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      <div className="sla-timer__details">
        <span className="sla-timer__detail">
          Started {formatRelativeTime(sla.start_time)}
        </span>
        <span className="sla-timer__detail">
          Target {formatRelativeTime(sla.target_time)}
        </span>
      </div>
    </div>
  );
};

function getStatus(state: string, percentage: number): string {
  if (state === 'breached') return 'breached';
  if (state === 'completed') return 'completed';
  if (percentage >= 90) return 'critical';
  if (percentage >= 75) return 'warning';
  return 'normal';
}
```

### SLA Styles

```css
/* styles/components/sla-widget.css */

.sla-widget {
  background: var(--hw-surface-primary);
  border: 1px solid var(--hw-border-primary);
  border-radius: var(--hw-radius-md);
}

.sla-widget__header {
  padding: var(--hw-spacing-md);
  border-bottom: 1px solid var(--hw-border-primary);
}

.sla-widget__title {
  margin: 0;
  font-size: var(--hw-font-size-base);
  font-weight: var(--hw-font-weight-semibold);
  color: var(--hw-text-primary);
}

.sla-widget__list {
  display: flex;
  flex-direction: column;
  gap: var(--hw-spacing-md);
  padding: var(--hw-spacing-md);
}

.sla-timer {
  display: flex;
  flex-direction: column;
  gap: var(--hw-spacing-sm);
  padding: var(--hw-spacing-md);
  background: var(--hw-surface-secondary);
  border: 1px solid var(--hw-border-primary);
  border-radius: var(--hw-radius-sm);
  border-left: 4px solid var(--hw-success-base);
}

.sla-timer--warning {
  border-left-color: var(--hw-warning-base);
}

.sla-timer--critical {
  border-left-color: var(--hw-error-base);
  animation: pulse-sla 2s infinite;
}

.sla-timer--breached {
  border-left-color: var(--hw-error-dark);
  background: var(--hw-error-light);
}

.sla-timer--completed {
  border-left-color: var(--hw-success-base);
  opacity: 0.7;
}

@keyframes pulse-sla {
  0%, 100% {
    background: var(--hw-surface-secondary);
  }
  50% {
    background: var(--hw-error-light);
  }
}

.sla-timer__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sla-timer__name {
  font-size: var(--hw-font-size-sm);
  font-weight: var(--hw-font-weight-medium);
  color: var(--hw-text-primary);
}

.sla-timer__state {
  display: flex;
  align-items: center;
  gap: var(--hw-spacing-xs);
  font-size: var(--hw-font-size-sm);
  font-weight: var(--hw-font-weight-semibold);
  font-variant-numeric: tabular-nums;
}

.sla-timer__state .material-icons {
  font-size: 16px;
  color: var(--hw-text-secondary);
}

.sla-timer__progress {
  position: relative;
  width: 100%;
  height: 6px;
  background: var(--hw-surface-tertiary);
  border-radius: var(--hw-radius-full);
  overflow: hidden;
}

.sla-timer__progress-bar {
  height: 100%;
  background: var(--hw-success-base);
  border-radius: var(--hw-radius-full);
  transition: width var(--hw-transition-normal);
}

.sla-timer--warning .sla-timer__progress-bar {
  background: var(--hw-warning-base);
}

.sla-timer--critical .sla-timer__progress-bar,
.sla-timer--breached .sla-timer__progress-bar {
  background: var(--hw-error-base);
}

.sla-timer__details {
  display: flex;
  justify-content: space-between;
  font-size: var(--hw-font-size-xs);
  color: var(--hw-text-secondary);
}
```

---

## Notification Center

### Notification Center Component

```typescript
// components/NotificationCenter/NotificationCenter.tsx

export const NotificationCenter: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');
  const { data: notifications, isLoading } = useNotifications(filter);

  return (
    <div className="notification-center">
      <div className="notification-center__header">
        <h2 className="notification-center__title">Notifications</h2>

        <div className="notification-center__filters">
          <button
            className={`notification-center__filter ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread
            {notifications?.unreadCount > 0 && (
              <span className="hw-badge hw-badge--primary">
                {notifications.unreadCount}
              </span>
            )}
          </button>
          <button
            className={`notification-center__filter ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
        </div>
      </div>

      <div className="notification-center__list">
        {isLoading ? (
          <LoadingSpinner />
        ) : notifications?.items.length === 0 ? (
          <div className="notification-center__empty">
            <span className="material-icons">notifications_none</span>
            <p>No notifications</p>
          </div>
        ) : (
          notifications?.items.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
            />
          ))
        )}
      </div>
    </div>
  );
};

// Notification Item Component
interface NotificationItemProps {
  notification: Notification;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification }) => {
  const { markAsRead } = useNotificationActions();

  const handleClick = () => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    if (notification.deep_link) {
      window.location.href = notification.deep_link;
    }
  };

  return (
    <div
      className={`notification-item ${!notification.read ? 'notification-item--unread' : ''}`}
      onClick={handleClick}
    >
      <div className="notification-item__icon">
        {notification.icon ? (
          <span className="material-icons">{notification.icon}</span>
        ) : (
          <span className="material-icons">notifications</span>
        )}
      </div>

      <div className="notification-item__content">
        <div className="notification-item__title">{notification.title}</div>
        <div className="notification-item__body">{notification.body}</div>
        <div className="notification-item__meta">
          {formatRelativeTime(notification.created_at)}
        </div>
      </div>

      {!notification.read && (
        <div className="notification-item__indicator" />
      )}

      {notification.actions && notification.actions.length > 0 && (
        <div className="notification-item__actions">
          {notification.actions.map((action, index) => (
            <button
              key={index}
              className="hw-button hw-button--sm hw-button--secondary"
              onClick={(e) => {
                e.stopPropagation();
                // Handle action
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

### Notification Center Styles

```css
/* styles/components/notification-center.css */

.notification-center {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--hw-surface-primary);
}

.notification-center__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--hw-spacing-lg);
  border-bottom: 1px solid var(--hw-border-primary);
}

.notification-center__title {
  margin: 0;
  font-size: var(--hw-font-size-xl);
  font-weight: var(--hw-font-weight-semibold);
  color: var(--hw-text-primary);
}

.notification-center__filters {
  display: flex;
  gap: var(--hw-spacing-sm);
}

.notification-center__filter {
  display: flex;
  align-items: center;
  gap: var(--hw-spacing-xs);
  padding: var(--hw-spacing-sm) var(--hw-spacing-md);
  background: transparent;
  border: 1px solid var(--hw-border-primary);
  border-radius: var(--hw-radius-sm);
  font-size: var(--hw-font-size-sm);
  color: var(--hw-text-secondary);
  cursor: pointer;
  transition: all var(--hw-transition-fast);
}

.notification-center__filter:hover {
  background: var(--hw-surface-hover);
}

.notification-center__filter.active {
  background: var(--hw-primary-base);
  border-color: var(--hw-primary-base);
  color: var(--hw-text-on-primary);
}

.notification-center__list {
  flex: 1;
  overflow-y: auto;
}

.notification-center__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--hw-text-secondary);
}

.notification-center__empty .material-icons {
  font-size: 64px;
  margin-bottom: var(--hw-spacing-md);
  opacity: 0.3;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: var(--hw-spacing-md);
  padding: var(--hw-spacing-md);
  border-bottom: 1px solid var(--hw-border-primary);
  cursor: pointer;
  transition: background var(--hw-transition-fast);
}

.notification-item:hover {
  background: var(--hw-surface-hover);
}

.notification-item--unread {
  background: var(--hw-primary-transparent);
}

.notification-item--unread .notification-item__title {
  font-weight: var(--hw-font-weight-semibold);
}

.notification-item__icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hw-surface-secondary);
  border-radius: var(--hw-radius-full);
  color: var(--hw-primary-base);
}

.notification-item__icon .material-icons {
  font-size: 20px;
}

.notification-item__content {
  flex: 1;
  min-width: 0;
}

.notification-item__title {
  margin: 0 0 var(--hw-spacing-xs) 0;
  font-size: var(--hw-font-size-sm);
  color: var(--hw-text-primary);
}

.notification-item__body {
  margin: 0 0 var(--hw-spacing-xs) 0;
  font-size: var(--hw-font-size-sm);
  color: var(--hw-text-secondary);
  line-height: var(--hw-line-height-relaxed);
}

.notification-item__meta {
  font-size: var(--hw-font-size-xs);
  color: var(--hw-text-tertiary);
}

.notification-item__indicator {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  background: var(--hw-primary-base);
  border-radius: var(--hw-radius-full);
}

.notification-item__actions {
  display: flex;
  flex-direction: column;
  gap: var(--hw-spacing-xs);
  flex-shrink: 0;
}
```

---

## Template Editor

### Template Editor Component

```typescript
// components/TemplateEditor/TemplateEditor.tsx

export const TemplateEditor: React.FC = () => {
  const [template, setTemplate] = useState<NotificationTemplate>({
    name: '',
    category: '',
    email: { subject: '', body_html: '', body_text: '' },
    sms: { body: '' },
    push: { title: '', body: '' },
    in_app: { title: '', body: '', priority: 'medium' }
  });

  const [activeChannel, setActiveChannel] = useState<'email' | 'sms' | 'push' | 'in_app'>('email');
  const [variables, setVariables] = useState<TemplateVariable[]>([]);

  return (
    <div className="template-editor">
      <div className="template-editor__header">
        <h2>Create Notification Template</h2>
      </div>

      <div className="template-editor__body">
        {/* Basic Info */}
        <section className="template-editor__section">
          <h3>Basic Information</h3>
          <div className="property-form">
            <div className="property-form__field">
              <label className="property-form__label">Template Name</label>
              <input
                type="text"
                className="hw-input"
                value={template.name}
                onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                placeholder="e.g., Incident Assignment Notification"
              />
            </div>

            <div className="property-form__field">
              <label className="property-form__label">Category</label>
              <select
                className="hw-select"
                value={template.category}
                onChange={(e) => setTemplate({ ...template, category: e.target.value })}
              >
                <option value="">Select category...</option>
                <option value="assignment">Assignment</option>
                <option value="approval">Approval</option>
                <option value="sla_warning">SLA Warning</option>
                <option value="sla_breach">SLA Breach</option>
                <option value="workflow">Workflow</option>
              </select>
            </div>
          </div>
        </section>

        {/* Channel Tabs */}
        <section className="template-editor__section">
          <div className="template-editor__channels">
            <button
              className={`template-editor__channel ${activeChannel === 'email' ? 'active' : ''}`}
              onClick={() => setActiveChannel('email')}
            >
              <span className="material-icons">email</span>
              Email
            </button>
            <button
              className={`template-editor__channel ${activeChannel === 'sms' ? 'active' : ''}`}
              onClick={() => setActiveChannel('sms')}
            >
              <span className="material-icons">sms</span>
              SMS
            </button>
            <button
              className={`template-editor__channel ${activeChannel === 'push' ? 'active' : ''}`}
              onClick={() => setActiveChannel('push')}
            >
              <span className="material-icons">notifications</span>
              Push
            </button>
            <button
              className={`template-editor__channel ${activeChannel === 'in_app' ? 'active' : ''}`}
              onClick={() => setActiveChannel('in_app')}
            >
              <span className="material-icons">announcement</span>
              In-App
            </button>
          </div>

          <div className="template-editor__content">
            {activeChannel === 'email' && (
              <EmailTemplateEditor
                template={template.email}
                variables={variables}
                onChange={(email) => setTemplate({ ...template, email })}
              />
            )}

            {activeChannel === 'sms' && (
              <SMSTemplateEditor
                template={template.sms}
                variables={variables}
                onChange={(sms) => setTemplate({ ...template, sms })}
              />
            )}

            {activeChannel === 'push' && (
              <PushTemplateEditor
                template={template.push}
                variables={variables}
                onChange={(push) => setTemplate({ ...template, push })}
              />
            )}

            {activeChannel === 'in_app' && (
              <InAppTemplateEditor
                template={template.in_app}
                variables={variables}
                onChange={(in_app) => setTemplate({ ...template, in_app })}
              />
            )}
          </div>
        </section>

        {/* Variables Sidebar */}
        <aside className="template-editor__sidebar">
          <h3>Available Variables</h3>
          <div className="template-editor__variables">
            <VariablePalette variables={variables} />
          </div>
        </aside>
      </div>

      <div className="template-editor__footer">
        <button className="hw-button hw-button--secondary">
          Preview
        </button>
        <button className="hw-button hw-button--primary">
          Save Template
        </button>
      </div>
    </div>
  );
};

// Email Template Editor
const EmailTemplateEditor: React.FC<EmailTemplateEditorProps> = ({
  template,
  variables,
  onChange
}) => {
  return (
    <div className="email-template-editor">
      <div className="property-form__field">
        <label className="property-form__label">Subject</label>
        <input
          type="text"
          className="hw-input"
          value={template.subject}
          onChange={(e) => onChange({ ...template, subject: e.target.value })}
          placeholder="e.g., ${record.number} - ${record.short_description}"
        />
      </div>

      <div className="property-form__field">
        <label className="property-form__label">HTML Body</label>
        <RichTextEditor
          value={template.body_html}
          onChange={(value) => onChange({ ...template, body_html: value })}
          variables={variables}
        />
      </div>

      <div className="property-form__field">
        <label className="property-form__label">Plain Text Body</label>
        <textarea
          className="hw-textarea"
          value={template.body_text}
          onChange={(e) => onChange({ ...template, body_text: e.target.value })}
          rows={10}
          placeholder="Plain text version for email clients that don't support HTML"
        />
      </div>
    </div>
  );
};

// Variable Palette
const VariablePalette: React.FC<{ variables: TemplateVariable[] }> = ({ variables }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredVariables = variables.filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const copyToClipboard = (variable: string) => {
    navigator.clipboard.writeText(`\${${variable}}`);
    // Show toast notification
  };

  return (
    <div className="variable-palette">
      <div className="variable-palette__search">
        <input
          type="text"
          className="hw-input hw-input--sm"
          placeholder="Search variables..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="variable-palette__list">
        {filteredVariables.map((variable) => (
          <div
            key={variable.name}
            className="variable-palette__item"
            onClick={() => copyToClipboard(variable.name)}
            title={variable.description}
          >
            <code className="variable-palette__code">${'{' + variable.name + '}'}</code>
            <span className="variable-palette__desc">{variable.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Template Editor Styles

```css
/* styles/components/template-editor.css */

.template-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--hw-surface-primary);
}

.template-editor__header {
  padding: var(--hw-spacing-lg);
  border-bottom: 1px solid var(--hw-border-primary);
}

.template-editor__header h2 {
  margin: 0;
  font-size: var(--hw-font-size-xl);
  font-weight: var(--hw-font-weight-semibold);
  color: var(--hw-text-primary);
}

.template-editor__body {
  display: grid;
  grid-template-columns: 1fr 300px;
  flex: 1;
  overflow: hidden;
}

.template-editor__section {
  padding: var(--hw-spacing-lg);
  overflow-y: auto;
}

.template-editor__section h3 {
  margin: 0 0 var(--hw-spacing-md) 0;
  font-size: var(--hw-font-size-lg);
  font-weight: var(--hw-font-weight-semibold);
  color: var(--hw-text-primary);
}

.template-editor__channels {
  display: flex;
  gap: var(--hw-spacing-sm);
  margin-bottom: var(--hw-spacing-lg);
  border-bottom: 1px solid var(--hw-border-primary);
}

.template-editor__channel {
  display: flex;
  align-items: center;
  gap: var(--hw-spacing-xs);
  padding: var(--hw-spacing-sm) var(--hw-spacing-md);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: var(--hw-font-size-sm);
  color: var(--hw-text-secondary);
  cursor: pointer;
  transition: all var(--hw-transition-fast);
}

.template-editor__channel:hover {
  color: var(--hw-text-primary);
  background: var(--hw-surface-hover);
}

.template-editor__channel.active {
  color: var(--hw-primary-base);
  border-bottom-color: var(--hw-primary-base);
}

.template-editor__channel .material-icons {
  font-size: 18px;
}

.template-editor__content {
  display: flex;
  flex-direction: column;
  gap: var(--hw-spacing-md);
}

.template-editor__sidebar {
  padding: var(--hw-spacing-lg);
  background: var(--hw-surface-secondary);
  border-left: 1px solid var(--hw-border-primary);
  overflow-y: auto;
}

.template-editor__sidebar h3 {
  margin: 0 0 var(--hw-spacing-md) 0;
  font-size: var(--hw-font-size-base);
  font-weight: var(--hw-font-weight-semibold);
  color: var(--hw-text-primary);
}

.template-editor__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--hw-spacing-sm);
  padding: var(--hw-spacing-lg);
  border-top: 1px solid var(--hw-border-primary);
}

.variable-palette__search {
  margin-bottom: var(--hw-spacing-md);
}

.variable-palette__list {
  display: flex;
  flex-direction: column;
  gap: var(--hw-spacing-xs);
}

.variable-palette__item {
  display: flex;
  flex-direction: column;
  gap: var(--hw-spacing-xs);
  padding: var(--hw-spacing-sm);
  background: var(--hw-surface-primary);
  border: 1px solid var(--hw-border-primary);
  border-radius: var(--hw-radius-sm);
  cursor: pointer;
  transition: all var(--hw-transition-fast);
}

.variable-palette__item:hover {
  background: var(--hw-surface-hover);
  border-color: var(--hw-primary-base);
}

.variable-palette__code {
  font-family: var(--hw-font-family-mono);
  font-size: var(--hw-font-size-xs);
  color: var(--hw-primary-base);
  background: var(--hw-primary-light);
  padding: var(--hw-spacing-xs);
  border-radius: var(--hw-radius-xs);
}

.variable-palette__desc {
  font-size: var(--hw-font-size-xs);
  color: var(--hw-text-secondary);
}
```

---

## Design Tokens

### CSS Custom Properties

```css
/* styles/tokens/phase-4.css */

:root {
  /* Workflow Colors */
  --hw-workflow-start: var(--hw-success-base);
  --hw-workflow-action: var(--hw-primary-base);
  --hw-workflow-approval: var(--hw-warning-base);
  --hw-workflow-condition: var(--hw-info-base);
  --hw-workflow-end: var(--hw-error-base);

  /* Workflow States */
  --hw-workflow-running: var(--hw-primary-base);
  --hw-workflow-waiting: var(--hw-warning-base);
  --hw-workflow-completed: var(--hw-success-base);
  --hw-workflow-failed: var(--hw-error-base);

  /* SLA States */
  --hw-sla-normal: var(--hw-success-base);
  --hw-sla-warning: var(--hw-warning-base);
  --hw-sla-critical: var(--hw-error-base);
  --hw-sla-breached: var(--hw-error-dark);
  --hw-sla-completed: var(--hw-success-base);

  /* Canvas */
  --hw-canvas-background: hsl(var(--hw-neutral-hue), 10%, 97%);
  --hw-canvas-grid: hsl(var(--hw-neutral-hue), 10%, 90%);
  --hw-canvas-connection: var(--hw-border-primary);

  /* Node */
  --hw-node-background: var(--hw-surface-primary);
  --hw-node-border: var(--hw-border-primary);
  --hw-node-shadow: var(--hw-shadow-sm);
  --hw-node-hover-shadow: var(--hw-shadow-md);

  /* Notification Priorities */
  --hw-notification-low: var(--hw-text-secondary);
  --hw-notification-medium: var(--hw-info-base);
  --hw-notification-high: var(--hw-warning-base);
  --hw-notification-urgent: var(--hw-error-base);

  /* Approval States */
  --hw-approval-pending: var(--hw-warning-base);
  --hw-approval-approved: var(--hw-success-base);
  --hw-approval-rejected: var(--hw-error-base);
  --hw-approval-delegated: var(--hw-info-base);
}

/* Dark Mode Overrides */
[data-theme="dark"] {
  --hw-canvas-background: hsl(var(--hw-neutral-hue), 10%, 15%);
  --hw-canvas-grid: hsl(var(--hw-neutral-hue), 10%, 20%);
}
```

---

## Responsive Behavior

### Mobile Adaptations

```css
/* Mobile workflow canvas */
@media (max-width: 768px) {
  .workflow-canvas__container {
    grid-template-columns: 1fr;
  }

  .workflow-canvas__palette {
    display: none;
  }

  .workflow-canvas__properties {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 50vh;
    border-radius: var(--hw-radius-lg) var(--hw-radius-lg) 0 0;
    transform: translateY(100%);
    transition: transform var(--hw-transition-normal);
  }

  .workflow-canvas__properties.open {
    transform: translateY(0);
  }
}

/* Mobile approval cards */
@media (max-width: 640px) {
  .approval-card__actions {
    flex-direction: column;
  }

  .approval-card__actions button {
    width: 100%;
  }
}

/* Mobile notification center */
@media (max-width: 640px) {
  .notification-center__header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--hw-spacing-md);
  }

  .notification-item__actions {
    flex-direction: row;
  }
}
```

---

## Accessibility

### ARIA Labels and Roles

```typescript
// Workflow canvas accessibility
<div
  role="application"
  aria-label="Workflow Designer"
  aria-describedby="workflow-instructions"
>
  <div id="workflow-instructions" className="sr-only">
    Drag nodes from the palette onto the canvas and connect them to create workflows.
    Press Tab to navigate between nodes. Press Enter to edit a selected node.
  </div>
  {/* Canvas content */}
</div>

// Approval card accessibility
<div
  role="article"
  aria-label={`Approval request for ${approval.workflow_name}`}
  tabIndex={0}
>
  <button
    aria-label={`Approve ${approval.workflow_name}`}
    onClick={handleApprove}
  >
    Approve
  </button>
  <button
    aria-label={`Reject ${approval.workflow_name}`}
    onClick={handleReject}
  >
    Reject
  </button>
</div>

// SLA timer accessibility
<div
  role="status"
  aria-live="polite"
  aria-label={`SLA ${sla.name}: ${formatTime(sla.remaining_seconds)} remaining`}
>
  {/* SLA content */}
</div>

// Notification accessibility
<div
  role="alert"
  aria-live="assertive"
  aria-atomic="true"
>
  {notification.title}: {notification.body}
</div>
```

### Keyboard Navigation

```typescript
// Workflow canvas keyboard shortcuts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Delete selected node
    if (e.key === 'Delete' && selectedNode) {
      deleteNode(selectedNode.id);
    }

    // Duplicate node
    if (e.key === 'd' && e.metaKey && selectedNode) {
      duplicateNode(selectedNode.id);
    }

    // Save workflow
    if (e.key === 's' && e.metaKey) {
      e.preventDefault();
      saveWorkflow();
    }

    // Undo/Redo
    if (e.key === 'z' && e.metaKey) {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedNode]);
```

---

## Conclusion

These UI specifications provide comprehensive guidance for implementing Phase 4's user interfaces. All components use design tokens for consistency, support dark mode, are fully responsive, and meet accessibility standards.

**Key Principles:**
- No hardcoded colors - all use CSS custom properties
- Consistent spacing using design tokens
- Responsive at all breakpoints
- ARIA labels for screen readers
- Keyboard navigation support
- Visual feedback for all interactions
