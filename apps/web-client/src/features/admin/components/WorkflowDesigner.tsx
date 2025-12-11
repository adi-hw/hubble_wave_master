import React, { useState, useCallback, useRef } from 'react';
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
  ArrowRight,
  GripVertical,
} from 'lucide-react';

export interface WorkflowStep {
  id: string;
  type: string;
  name: string;
  config: Record<string, any>;
  position: { x: number; y: number };
  next?: string | { true?: string; false?: string };
}

export interface WorkflowConnection {
  from: string;
  to: string;
  label?: string;
}

interface WorkflowDesignerProps {
  steps: WorkflowStep[];
  onStepsChange: (steps: WorkflowStep[]) => void;
  connections: WorkflowConnection[];
  onConnectionsChange: (connections: WorkflowConnection[]) => void;
  selectedStepId?: string;
  onSelectStep: (stepId: string | null) => void;
  className?: string;
}

const stepTypes = [
  { type: 'start', name: 'Start', icon: Play, color: 'bg-green-500', category: 'control' },
  { type: 'end', name: 'End', icon: CheckCircle, color: 'bg-red-500', category: 'control' },
  { type: 'condition', name: 'Condition', icon: GitBranch, color: 'bg-amber-500', category: 'control' },
  { type: 'wait', name: 'Wait', icon: Clock, color: 'bg-slate-500', category: 'control' },
  { type: 'update_record', name: 'Update Record', icon: FileText, color: 'bg-blue-500', category: 'action' },
  { type: 'create_record', name: 'Create Record', icon: Plus, color: 'bg-blue-500', category: 'action' },
  { type: 'send_email', name: 'Send Email', icon: Mail, color: 'bg-purple-500', category: 'notification' },
  { type: 'send_notification', name: 'Notification', icon: Zap, color: 'bg-purple-500', category: 'notification' },
  { type: 'create_approval', name: 'Create Approval', icon: CheckCircle, color: 'bg-amber-500', category: 'approval' },
];

const getStepConfig = (type: string) => {
  return stepTypes.find((s) => s.type === type) || stepTypes[0];
};

export const WorkflowDesigner: React.FC<WorkflowDesignerProps> = ({
  steps,
  onStepsChange,
  connections,
  onConnectionsChange,
  selectedStepId,
  onSelectStep,
  className = '',
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggedStep, setDraggedStep] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleDragStart = useCallback(
    (stepId: string, e: React.MouseEvent) => {
      const step = steps.find((s) => s.id === stepId);
      if (!step) return;

      setDraggedStep(stepId);
      setDragOffset({
        x: e.clientX - step.position.x,
        y: e.clientY - step.position.y,
      });
    },
    [steps]
  );

  const handleDragMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggedStep || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const newX = e.clientX - rect.left - dragOffset.x + canvasRef.current.scrollLeft;
      const newY = e.clientY - rect.top - dragOffset.y + canvasRef.current.scrollTop;

      onStepsChange(
        steps.map((step) =>
          step.id === draggedStep
            ? { ...step, position: { x: Math.max(0, newX), y: Math.max(0, newY) } }
            : step
        )
      );
    },
    [draggedStep, dragOffset, steps, onStepsChange]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedStep(null);
  }, []);

  const handleAddStep = useCallback(
    (type: string) => {
      const newStep: WorkflowStep = {
        id: `step_${Date.now()}`,
        type,
        name: getStepConfig(type).name,
        config: {},
        position: { x: 200, y: 100 + steps.length * 120 },
      };
      onStepsChange([...steps, newStep]);
      onSelectStep(newStep.id);
    },
    [steps, onStepsChange, onSelectStep]
  );

  const handleDeleteStep = useCallback(
    (stepId: string) => {
      onStepsChange(steps.filter((s) => s.id !== stepId));
      onConnectionsChange(connections.filter((c) => c.from !== stepId && c.to !== stepId));
      if (selectedStepId === stepId) {
        onSelectStep(null);
      }
    },
    [steps, connections, selectedStepId, onStepsChange, onConnectionsChange, onSelectStep]
  );

  const handleConnect = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return;
      const exists = connections.some((c) => c.from === fromId && c.to === toId);
      if (!exists) {
        onConnectionsChange([...connections, { from: fromId, to: toId }]);
      }
      setConnecting(null);
    },
    [connections, onConnectionsChange]
  );

  return (
    <div className={`flex h-full ${className}`}>
      {/* Step Palette */}
      <div className="w-56 flex-shrink-0 border-r border-slate-200 bg-slate-50 p-4 overflow-y-auto">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Add Steps
        </h3>

        {['control', 'action', 'notification', 'approval'].map((category) => (
          <div key={category} className="mb-4">
            <h4 className="text-xs font-medium text-slate-400 uppercase mb-2">
              {category}
            </h4>
            <div className="space-y-1">
              {stepTypes
                .filter((s) => s.category === category)
                .map((stepType) => (
                  <button
                    key={stepType.type}
                    onClick={() => handleAddStep(stepType.type)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 bg-white rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    <div className={`h-6 w-6 rounded-md ${stepType.color} flex items-center justify-center`}>
                      <stepType.icon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span>{stepType.name}</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-auto bg-slate-100"
        style={{
          backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        {/* Connections SVG */}
        <svg className="absolute inset-0 pointer-events-none" style={{ minWidth: '100%', minHeight: '100%' }}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
            </marker>
          </defs>
          {connections.map((conn, idx) => {
            const fromStep = steps.find((s) => s.id === conn.from);
            const toStep = steps.find((s) => s.id === conn.to);
            if (!fromStep || !toStep) return null;

            const fromX = fromStep.position.x + 100;
            const fromY = fromStep.position.y + 40;
            const toX = toStep.position.x + 100;
            const toY = toStep.position.y;

            const midY = (fromY + toY) / 2;

            return (
              <path
                key={idx}
                d={`M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`}
                stroke="#94a3b8"
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arrowhead)"
              />
            );
          })}
        </svg>

        {/* Steps */}
        {steps.map((step) => {
          const config = getStepConfig(step.type);
          return (
            <div
              key={step.id}
              className={`absolute w-48 bg-white rounded-xl border-2 shadow-sm transition-shadow ${
                selectedStepId === step.id
                  ? 'border-primary-500 shadow-md'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              style={{
                left: step.position.x,
                top: step.position.y,
              }}
              onClick={() => onSelectStep(step.id)}
            >
              {/* Header */}
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${config.color} cursor-move`}
                onMouseDown={(e) => handleDragStart(step.id, e)}
              >
                <GripVertical className="h-4 w-4 text-white/70" />
                <config.icon className="h-4 w-4 text-white" />
                <span className="text-sm font-medium text-white flex-1 truncate">
                  {step.name}
                </span>
              </div>

              {/* Body */}
              <div className="px-3 py-2">
                <p className="text-xs text-slate-500 truncate">
                  {step.type}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConnecting(connecting === step.id ? null : step.id);
                  }}
                  className={`p-1 rounded transition-colors ${
                    connecting === step.id
                      ? 'bg-primary-100 text-primary-600'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Connect to another step"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>

                {connecting && connecting !== step.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConnect(connecting, step.id);
                    }}
                    className="px-2 py-1 text-xs bg-primary-100 text-primary-600 rounded hover:bg-primary-200 transition-colors"
                  >
                    Connect Here
                  </button>
                )}

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectStep(step.id);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                    title="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStep(step.id);
                    }}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {steps.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <GitBranch className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                Start Building Your Workflow
              </h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Add steps from the palette on the left to create your workflow.
                Connect steps by clicking the arrow icon.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowDesigner;
