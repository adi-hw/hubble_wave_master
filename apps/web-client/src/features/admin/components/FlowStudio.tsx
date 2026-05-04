import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Plus,
  Trash2,
  Play,
  Settings,
  GitBranch,
  CheckCircle,
  Mail,
  Zap,
  Clock,
  FileText,
  Globe,
  Search,
  Table,
  Pencil,
  Hourglass,
  Sparkles,
} from 'lucide-react';
import { ActionLibrary } from './ActionLibrary';

export interface ProcessFlowStep {
  id: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
  next?: string | { true?: string; false?: string };
}

/**
 * Connection contract is the canonical engine shape `{ fromNode, toNode }`
 * (matches ProcessFlowConnection in libs/instance-db). The compact
 * `{ from, to }` shape some authored flows still carry is normalized
 * at the wire boundary in svc-workflow's normalizeCanvas; this
 * component reads/writes the canonical shape directly so there's no
 * drift between editor and runtime.
 */
export interface ProcessFlowConnection {
  fromNode: string;
  toNode: string;
  label?: string;
}

interface FlowStudioProps {
  steps: ProcessFlowStep[];
  onStepsChange: (steps: ProcessFlowStep[]) => void;
  connections: ProcessFlowConnection[];
  onConnectionsChange: (connections: ProcessFlowConnection[]) => void;
  selectedStepId?: string | null;
  onSelectStep: (stepId: string | null) => void;
  className?: string;
}

type StepCategory = 'control' | 'action' | 'notification' | 'approval' | 'decision' | 'integration';

interface StepTypeMeta {
  type: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  category: StepCategory;
}

// Step `type` codes use the canonical BUILT_IN_ACTIONS PascalCase
// (CreateRecord, MakeDecision, …) emitted by ActionLibrary. The
// snake_case codes (update_record, send_notification, …) are also
// accepted so canvases already persisted in production round-trip
// without their nodes collapsing to "Start". The dispatcher and
// normalizeCanvas's action set tolerate both shapes; this registry
// is the canvas-side visual catalog only.
const STEP_TYPES: StepTypeMeta[] = [
  // Synthetic control nodes (no catalog entry — flow lifecycle).
  { type: 'start', name: 'Start', icon: Play, color: 'bg-success', category: 'control' },
  { type: 'end', name: 'End', icon: CheckCircle, color: 'bg-danger', category: 'control' },
  { type: 'condition', name: 'Condition', icon: GitBranch, color: 'bg-warning', category: 'control' },
  { type: 'wait', name: 'Wait', icon: Clock, color: 'bg-muted-foreground', category: 'control' },

  // Canonical PascalCase catalog codes — every BUILT_IN_ACTIONS entry.
  { type: 'CreateRecord', name: 'Create Record', icon: Plus, color: 'bg-info', category: 'action' },
  { type: 'UpdateRecord', name: 'Update Record', icon: FileText, color: 'bg-info', category: 'action' },
  { type: 'DeleteRecord', name: 'Delete Record', icon: Trash2, color: 'bg-info', category: 'action' },
  { type: 'LookUpRecord', name: 'Look Up Record', icon: Search, color: 'bg-info', category: 'action' },
  { type: 'SetFieldValue', name: 'Set Field Value', icon: Pencil, color: 'bg-info', category: 'action' },
  { type: 'SendNotification', name: 'Send Notification', icon: Mail, color: 'bg-purple-500', category: 'notification' },
  { type: 'CreateApproval', name: 'Create Approval', icon: CheckCircle, color: 'bg-warning', category: 'approval' },
  { type: 'WaitForApproval', name: 'Wait For Approval', icon: Hourglass, color: 'bg-warning', category: 'approval' },
  { type: 'MakeDecision', name: 'Make Decision', icon: Table, color: 'bg-emerald-500', category: 'decision' },
  { type: 'CallFlowModule', name: 'Call Flow Module', icon: Zap, color: 'bg-cyan-500', category: 'integration' },
  { type: 'HTTPRequest', name: 'HTTP Request', icon: Globe, color: 'bg-cyan-500', category: 'integration' },
  { type: 'RunAVAPrompt', name: 'Run AVA Prompt', icon: Sparkles, color: 'bg-purple-500', category: 'action' },

  // snake_case codes — accepted so already-saved canvases render
  // with their original visuals instead of collapsing to "Start".
  { type: 'create_record', name: 'Create Record', icon: Plus, color: 'bg-info', category: 'action' },
  { type: 'update_record', name: 'Update Record', icon: FileText, color: 'bg-info', category: 'action' },
  { type: 'send_email', name: 'Send Email', icon: Mail, color: 'bg-purple-500', category: 'notification' },
  { type: 'send_notification', name: 'Notification', icon: Zap, color: 'bg-purple-500', category: 'notification' },
];

// `STEP_CATEGORIES` was the old palette grouping; the ActionLibrary
// now sources categories from `BUILT_IN_ACTIONS.category` directly.
// Kept as a reference for the `StepCategory` type only.
void (null as null | StepCategory);

const stepTypeByCode = new Map(STEP_TYPES.map((s) => [s.type, s]));
const findStepType = (code: string): StepTypeMeta => stepTypeByCode.get(code) ?? STEP_TYPES[0];

interface FlowNodeData extends Record<string, unknown> {
  step: ProcessFlowStep;
  selected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

const FlowStepNode: React.FC<{ data: FlowNodeData; id: string }> = ({ data, id }) => {
  const meta = findStepType(data.step.type);
  const Icon = meta.icon;
  return (
    <div
      className={`w-48 rounded-lg border-2 bg-card shadow-sm transition-shadow ${
        data.selected ? 'border-primary shadow-md' : 'border-border hover:border-muted-foreground/40'
      }`}
      onClick={() => data.onSelect(id)}
    >
      <Handle type="target" position={Position.Top} />
      <div className={`flex items-center gap-2 rounded-t-md px-3 py-2 ${meta.color}`}>
        <Icon className="h-4 w-4 text-white" />
        <span className="text-sm font-medium text-white flex-1 truncate">{data.step.name}</span>
      </div>
      <div className="px-3 py-2">
        <p className="text-xs text-muted-foreground truncate">{data.step.type}</p>
      </div>
      <div className="flex items-center justify-end gap-1 px-3 py-2 border-t border-border">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            data.onSelect(id);
          }}
          className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          title="Configure step"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete(id);
          }}
          className="p-1 text-muted-foreground hover:text-danger-text hover:bg-danger-subtle rounded transition-colors"
          title="Delete step"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const NODE_TYPES: NodeTypes = { flowStep: FlowStepNode };

const FlowStudioInner: React.FC<FlowStudioProps> = ({
  steps,
  onStepsChange,
  connections,
  onConnectionsChange,
  selectedStepId,
  onSelectStep,
  className = '',
}) => {
  const handleAddStep = useCallback(
    (type: string) => {
      const meta = findStepType(type);
      const newStep: ProcessFlowStep = {
        id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type,
        name: meta.name,
        config: {},
        position: { x: 200, y: 100 + steps.length * 120 },
      };
      onStepsChange([...steps, newStep]);
      onSelectStep(newStep.id);
    },
    [steps, onStepsChange, onSelectStep],
  );

  const handleDeleteStep = useCallback(
    (stepId: string) => {
      onStepsChange(steps.filter((s) => s.id !== stepId));
      onConnectionsChange(
        connections.filter((c) => c.fromNode !== stepId && c.toNode !== stepId),
      );
      if (selectedStepId === stepId) onSelectStep(null);
    },
    [steps, connections, selectedStepId, onStepsChange, onConnectionsChange, onSelectStep],
  );

  const nodes = useMemo<Node<FlowNodeData>[]>(
    () =>
      steps.map((step) => ({
        id: step.id,
        type: 'flowStep',
        position: step.position,
        data: {
          step,
          selected: selectedStepId === step.id,
          onSelect: onSelectStep,
          onDelete: handleDeleteStep,
        },
      })),
    [steps, selectedStepId, onSelectStep, handleDeleteStep],
  );

  const edges = useMemo<Edge[]>(
    () =>
      connections.map((conn, idx) => ({
        id: `${conn.fromNode}-${conn.toNode}-${idx}`,
        source: conn.fromNode,
        target: conn.toNode,
        label: conn.label,
        type: 'smoothstep',
      })),
    [connections],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const next = applyNodeChanges(changes, nodes);
      // Persist position drags back to the parent so saving the flow
      // captures the new layout. xyflow internally also tracks
      // selection / dimensions changes — those are ephemeral and not
      // mirrored to parent state.
      const positionChanged = changes.some(
        (c) => c.type === 'position' && c.position && !c.dragging,
      );
      if (positionChanged) {
        const updated: ProcessFlowStep[] = [];
        for (const node of next) {
          const original = steps.find((s) => s.id === node.id);
          if (!original) continue;
          updated.push({
            ...original,
            position: { x: node.position.x, y: node.position.y },
          });
        }
        onStepsChange(updated);
      }
    },
    [nodes, steps, onStepsChange],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const removed = changes.filter((c) => c.type === 'remove').map((c) => c.id);
      if (removed.length === 0) return;
      const next = applyEdgeChanges(changes, edges);
      onConnectionsChange(
        next.map((e) => {
          const edge = e as Edge;
          return {
            fromNode: edge.source,
            toNode: edge.target,
            label: typeof edge.label === 'string' ? edge.label : undefined,
          };
        }),
      );
    },
    [edges, onConnectionsChange],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return;
      }
      const exists = connections.some(
        (c) => c.fromNode === connection.source && c.toNode === connection.target,
      );
      if (exists) return;
      const next = addEdge(
        { ...connection, type: 'smoothstep' },
        edges,
      );
      onConnectionsChange(
        next.map((e) => {
          const edge = e as Edge;
          return {
            fromNode: edge.source,
            toNode: edge.target,
            label: typeof edge.label === 'string' ? edge.label : undefined,
          };
        }),
      );
    },
    [connections, edges, onConnectionsChange],
  );

  const handlePaneClick = useCallback(() => {
    onSelectStep(null);
  }, [onSelectStep]);

  return (
    <div className={`flex h-full min-h-[520px] min-w-0 ${className}`}>
      <div className="w-64 flex-shrink-0 border-r border-border bg-muted overflow-hidden">
        {/*
         * Plan §8.1.3 — palette is `ActionLibrary`, sourced from
         * BUILT_IN_ACTIONS. The hardcoded STEP_TYPES list below is
         * retained only for the synthetic node-type colors used in
         * the canvas itself; the palette no longer reads from it.
         */}
        <ActionLibrary onAdd={(action) => handleAddStep(action.code)} />
      </div>

      <div className="relative h-full min-h-0 min-w-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          onPaneClick={handlePaneClick}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>

        {steps.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Start Building Your Process Flow
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Add steps from the palette on the left, then drag from a step&rsquo;s bottom
                handle to another step&rsquo;s top to connect them.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/**
 * FlowStudio — visual editor for ProcessFlowDefinition canvases.
 * Built on @xyflow/react so pan, zoom, minimap, snap-to-grid, and
 * edge routing are first-class. Replaces the prior hand-rolled SVG
 * canvas (ProcessFlowDesigner + the duplicate WorkflowDesigner that
 * was retired with this slice).
 */
export const FlowStudio: React.FC<FlowStudioProps> = (props) => (
  <ReactFlowProvider>
    <FlowStudioInner {...props} />
  </ReactFlowProvider>
);

export default FlowStudio;
