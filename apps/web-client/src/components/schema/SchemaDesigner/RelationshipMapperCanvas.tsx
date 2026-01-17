/**
 * RelationshipMapperCanvas Component
 * HubbleWave Platform - Phase 2
 *
 * Visual ERD-style relationship mapper with interactive canvas.
 * Allows graphical viewing and editing of collection relationships.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Move,
  MousePointer2,
  Link2,
  Trash2,
  Eye,
  EyeOff,
  Grid3X3,
  RefreshCw,
} from 'lucide-react';
import {
  SchemaCollection,
  SchemaRelationship,
  RelationshipType,
} from './types';

// Types for canvas positioning
interface Position {
  x: number;
  y: number;
}

interface NodeLayout {
  collectionId: string;
  position: Position;
  width: number;
  height: number;
}

interface CanvasState {
  zoom: number;
  offset: Position;
  tool: 'select' | 'pan' | 'connect';
  showGrid: boolean;
  showPropertyDetails: boolean;
}

interface RelationshipMapperCanvasProps {
  collections: SchemaCollection[];
  relationships: SchemaRelationship[];
  selectedCollectionId?: string;
  onSelectCollection: (id: string | null) => void;
  onAddRelationship: (relationship: Omit<SchemaRelationship, 'id'>) => void;
  onDeleteRelationship: (id: string) => void;
  onSelectRelationship?: (relationship: SchemaRelationship | null) => void;
}

const NODE_WIDTH = 220;
const NODE_MIN_HEIGHT = 100;
const PROPERTY_ROW_HEIGHT = 28;
const GRID_SIZE = 20;

// Relationship colors by type - Tailwind classes for backgrounds and text
const RELATIONSHIP_BG_CLASSES: Record<RelationshipType, string> = {
  one_to_one: 'bg-info',
  one_to_many: 'bg-primary',
  many_to_many: 'bg-warning',
};

const RELATIONSHIP_TEXT_CLASSES: Record<RelationshipType, string> = {
  one_to_one: 'text-info-text',
  one_to_many: 'text-primary',
  many_to_many: 'text-warning-text',
};

// SVG stroke colors (need hex/rgb for SVG)
const RELATIONSHIP_STROKE_COLORS: Record<RelationshipType, string> = {
  one_to_one: '#3b82f6',
  one_to_many: 'hsl(var(--primary))',
  many_to_many: '#eab308',
};

export const RelationshipMapperCanvas: React.FC<RelationshipMapperCanvasProps> = ({
  collections,
  relationships,
  selectedCollectionId,
  onSelectCollection,
  onAddRelationship,
  onDeleteRelationship,
  onSelectRelationship,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Canvas state
  const [canvasState, setCanvasState] = useState<CanvasState>({
    zoom: 1,
    offset: { x: 0, y: 0 },
    tool: 'select',
    showGrid: true,
    showPropertyDetails: true,
  });

  // Node layouts - auto-arranged initially
  const [nodeLayouts, setNodeLayouts] = useState<NodeLayout[]>([]);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });

  // Connection drawing state
  const [connecting, setConnecting] = useState<{
    sourceId: string;
    sourceProperty: string;
    currentPos: Position;
  } | null>(null);

  // Selected relationship
  const [selectedRelationship, setSelectedRelationship] = useState<string | null>(null);

  // Auto-layout collections in a grid
  useEffect(() => {
    if (nodeLayouts.length === 0 && collections.length > 0) {
      const cols = Math.ceil(Math.sqrt(collections.length));
      const spacing = { x: NODE_WIDTH + 100, y: 250 };

      const layouts = collections.map((col, index) => {
        const row = Math.floor(index / cols);
        const colPos = index % cols;
        const height = calculateNodeHeight(col, canvasState.showPropertyDetails);

        return {
          collectionId: col.id,
          position: {
            x: 50 + colPos * spacing.x,
            y: 50 + row * spacing.y,
          },
          width: NODE_WIDTH,
          height,
        };
      });

      setNodeLayouts(layouts);
    }
  }, [collections, nodeLayouts.length, canvasState.showPropertyDetails]);

  // Calculate node height based on properties
  const calculateNodeHeight = useCallback(
    (collection: SchemaCollection, showDetails: boolean) => {
      if (!showDetails) return NODE_MIN_HEIGHT;
      const propertiesHeight = Math.min(collection.properties.length, 8) * PROPERTY_ROW_HEIGHT;
      return NODE_MIN_HEIGHT + propertiesHeight;
    },
    []
  );

  // Get node layout by collection ID
  const getNodeLayout = useCallback(
    (collectionId: string): NodeLayout | undefined => {
      return nodeLayouts.find((n) => n.collectionId === collectionId);
    },
    [nodeLayouts]
  );

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number): Position => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };

      return {
        x: (screenX - rect.left - canvasState.offset.x) / canvasState.zoom,
        y: (screenY - rect.top - canvasState.offset.y) / canvasState.zoom,
      };
    },
    [canvasState.offset, canvasState.zoom]
  );

  // Handle mouse down on canvas
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === canvasRef.current || e.target === svgRef.current) {
        if (canvasState.tool === 'pan') {
          setIsDragging(true);
          setDragTarget('canvas');
          setDragStart({ x: e.clientX, y: e.clientY });
        } else {
          onSelectCollection(null);
          setSelectedRelationship(null);
        }
      }
    },
    [canvasState.tool, onSelectCollection]
  );

  // Handle mouse down on node
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, collectionId: string) => {
      e.stopPropagation();
      onSelectCollection(collectionId);

      if (canvasState.tool === 'select') {
        setIsDragging(true);
        setDragTarget(collectionId);
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    },
    [canvasState.tool, onSelectCollection]
  );

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && dragTarget) {
        const deltaX = (e.clientX - dragStart.x) / canvasState.zoom;
        const deltaY = (e.clientY - dragStart.y) / canvasState.zoom;

        if (dragTarget === 'canvas') {
          setCanvasState((prev) => ({
            ...prev,
            offset: {
              x: prev.offset.x + (e.clientX - dragStart.x),
              y: prev.offset.y + (e.clientY - dragStart.y),
            },
          }));
        } else {
          setNodeLayouts((prev) =>
            prev.map((node) =>
              node.collectionId === dragTarget
                ? {
                    ...node,
                    position: {
                      x: Math.round((node.position.x + deltaX) / GRID_SIZE) * GRID_SIZE,
                      y: Math.round((node.position.y + deltaY) / GRID_SIZE) * GRID_SIZE,
                    },
                  }
                : node
            )
          );
        }
        setDragStart({ x: e.clientX, y: e.clientY });
      }

      if (connecting) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        setConnecting((prev) => (prev ? { ...prev, currentPos: canvasPos } : null));
      }
    },
    [isDragging, dragTarget, dragStart, canvasState.zoom, connecting, screenToCanvas]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragTarget(null);
    setConnecting(null);
  }, []);

  // Handle zoom
  const handleZoom = useCallback((delta: number) => {
    setCanvasState((prev) => ({
      ...prev,
      zoom: Math.max(0.25, Math.min(2, prev.zoom + delta)),
    }));
  }, []);

  // Handle wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleZoom(e.deltaY > 0 ? -0.1 : 0.1);
      }
    },
    [handleZoom]
  );

  // Start connecting from a property
  const handleStartConnect = useCallback(
    (e: React.MouseEvent, collectionId: string, propertyCode: string) => {
      e.stopPropagation();
      if (canvasState.tool === 'connect') {
        const pos = screenToCanvas(e.clientX, e.clientY);
        setConnecting({
          sourceId: collectionId,
          sourceProperty: propertyCode,
          currentPos: pos,
        });
      }
    },
    [canvasState.tool, screenToCanvas]
  );

  // End connecting on a collection
  const handleEndConnect = useCallback(
    (e: React.MouseEvent, targetCollectionId: string) => {
      e.stopPropagation();
      if (connecting && targetCollectionId !== connecting.sourceId) {
        const sourceCollection = collections.find((c) => c.id === connecting.sourceId);
        if (sourceCollection) {
          onAddRelationship({
            name: `${sourceCollection.code}_to_${collections.find((c) => c.id === targetCollectionId)?.code}`,
            sourceCollection: connecting.sourceId,
            sourceProperty: connecting.sourceProperty,
            targetCollection: targetCollectionId,
            type: 'one_to_many',
          });
        }
      }
      setConnecting(null);
    },
    [connecting, collections, onAddRelationship]
  );

  // Fit all nodes in view
  const handleFitToView = useCallback(() => {
    if (nodeLayouts.length === 0) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    nodeLayouts.forEach((node) => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + node.width);
      maxY = Math.max(maxY, node.position.y + node.height);
    });

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const contentWidth = maxX - minX + 100;
    const contentHeight = maxY - minY + 100;
    const zoomX = rect.width / contentWidth;
    const zoomY = rect.height / contentHeight;
    const newZoom = Math.min(zoomX, zoomY, 1);

    setCanvasState((prev) => ({
      ...prev,
      zoom: newZoom,
      offset: {
        x: (rect.width - contentWidth * newZoom) / 2 - minX * newZoom + 50,
        y: (rect.height - contentHeight * newZoom) / 2 - minY * newZoom + 50,
      },
    }));
  }, [nodeLayouts]);

  // Auto-arrange nodes
  const handleAutoArrange = useCallback(() => {
    const cols = Math.ceil(Math.sqrt(collections.length));
    const spacing = { x: NODE_WIDTH + 100, y: 250 };

    const layouts = collections.map((col, index) => {
      const row = Math.floor(index / cols);
      const colPos = index % cols;
      const height = calculateNodeHeight(col, canvasState.showPropertyDetails);

      return {
        collectionId: col.id,
        position: {
          x: 50 + colPos * spacing.x,
          y: 50 + row * spacing.y,
        },
        width: NODE_WIDTH,
        height,
      };
    });

    setNodeLayouts(layouts);
    setTimeout(handleFitToView, 100);
  }, [collections, calculateNodeHeight, canvasState.showPropertyDetails, handleFitToView]);

  // Calculate relationship path
  const calculateRelationshipPath = useCallback(
    (relationship: SchemaRelationship): string | null => {
      const sourceLayout = getNodeLayout(relationship.sourceCollection);
      const targetLayout = getNodeLayout(relationship.targetCollection);

      if (!sourceLayout || !targetLayout) return null;

      const sourceCenter = {
        x: sourceLayout.position.x + sourceLayout.width,
        y: sourceLayout.position.y + sourceLayout.height / 2,
      };

      const targetCenter = {
        x: targetLayout.position.x,
        y: targetLayout.position.y + targetLayout.height / 2,
      };

      // Create a curved path
      const controlOffset = Math.abs(targetCenter.x - sourceCenter.x) * 0.3;

      return `M ${sourceCenter.x} ${sourceCenter.y} C ${sourceCenter.x + controlOffset} ${sourceCenter.y}, ${targetCenter.x - controlOffset} ${targetCenter.y}, ${targetCenter.x} ${targetCenter.y}`;
    },
    [getNodeLayout]
  );

  // Get collection by ID
  const getCollection = useCallback(
    (id: string) => collections.find((c) => c.id === id),
    [collections]
  );

  return (
    <div className="flex flex-col h-full bg-muted">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          {/* Tool Selection */}
          <div className="flex items-center rounded-lg p-1 bg-muted">
            <button
              onClick={() => setCanvasState((p) => ({ ...p, tool: 'select' }))}
              className={`p-2 rounded transition-colors ${
                canvasState.tool === 'select'
                  ? 'bg-card text-primary'
                  : 'bg-transparent text-muted-foreground'
              }`}
              title="Select & Move"
              aria-label="Select tool"
              aria-pressed={canvasState.tool === 'select'}
            >
              <MousePointer2 size={18} />
            </button>
            <button
              onClick={() => setCanvasState((p) => ({ ...p, tool: 'pan' }))}
              className={`p-2 rounded transition-colors ${
                canvasState.tool === 'pan'
                  ? 'bg-card text-primary'
                  : 'bg-transparent text-muted-foreground'
              }`}
              title="Pan Canvas"
              aria-label="Pan tool"
              aria-pressed={canvasState.tool === 'pan'}
            >
              <Move size={18} />
            </button>
            <button
              onClick={() => setCanvasState((p) => ({ ...p, tool: 'connect' }))}
              className={`p-2 rounded transition-colors ${
                canvasState.tool === 'connect'
                  ? 'bg-card text-primary'
                  : 'bg-transparent text-muted-foreground'
              }`}
              title="Create Relationship"
              aria-label="Connect tool"
              aria-pressed={canvasState.tool === 'connect'}
            >
              <Link2 size={18} />
            </button>
          </div>

          <div className="w-px h-6 bg-border" />

          {/* View Controls */}
          <button
            onClick={() => handleZoom(0.1)}
            className="p-2 rounded transition-colors hover:bg-opacity-50 text-muted-foreground"
            title="Zoom In"
            aria-label="Zoom in"
          >
            <ZoomIn size={18} />
          </button>
          <span className="text-sm font-medium min-w-[50px] text-center text-foreground">
            {Math.round(canvasState.zoom * 100)}%
          </span>
          <button
            onClick={() => handleZoom(-0.1)}
            className="p-2 rounded transition-colors hover:bg-opacity-50 text-muted-foreground"
            title="Zoom Out"
            aria-label="Zoom out"
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={handleFitToView}
            className="p-2 rounded transition-colors hover:bg-opacity-50 text-muted-foreground"
            title="Fit to View"
            aria-label="Fit to view"
          >
            <Maximize size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCanvasState((p) => ({ ...p, showGrid: !p.showGrid }))}
            className={`p-2 rounded transition-colors ${
              canvasState.showGrid ? 'text-primary' : 'text-muted-foreground'
            }`}
            title={canvasState.showGrid ? 'Hide Grid' : 'Show Grid'}
            aria-label={canvasState.showGrid ? 'Hide grid' : 'Show grid'}
            aria-pressed={canvasState.showGrid}
          >
            <Grid3X3 size={18} />
          </button>
          <button
            onClick={() =>
              setCanvasState((p) => ({ ...p, showPropertyDetails: !p.showPropertyDetails }))
            }
            className={`p-2 rounded transition-colors ${
              canvasState.showPropertyDetails ? 'text-primary' : 'text-muted-foreground'
            }`}
            title={canvasState.showPropertyDetails ? 'Hide Properties' : 'Show Properties'}
            aria-label={canvasState.showPropertyDetails ? 'Hide properties' : 'Show properties'}
            aria-pressed={canvasState.showPropertyDetails}
          >
            {canvasState.showPropertyDetails ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
          <button
            onClick={handleAutoArrange}
            className="p-2 rounded transition-colors hover:bg-opacity-50 text-muted-foreground"
            title="Auto Arrange"
            aria-label="Auto arrange nodes"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-hidden relative"
        style={{
          cursor:
            canvasState.tool === 'pan'
              ? isDragging
                ? 'grabbing'
                : 'grab'
              : canvasState.tool === 'connect'
              ? 'crosshair'
              : 'default',
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Grid Background */}
        {canvasState.showGrid && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
            <defs>
              <pattern
                id="grid"
                width={GRID_SIZE * canvasState.zoom}
                height={GRID_SIZE * canvasState.zoom}
                patternUnits="userSpaceOnUse"
                patternTransform={`translate(${canvasState.offset.x % (GRID_SIZE * canvasState.zoom)}, ${canvasState.offset.y % (GRID_SIZE * canvasState.zoom)})`}
              >
                <path
                  d={`M ${GRID_SIZE * canvasState.zoom} 0 L 0 0 0 ${GRID_SIZE * canvasState.zoom}`}
                  fill="none"
                  className="stroke-border"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        )}

        {/* SVG Layer for Relationships */}
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            transform: `translate(${canvasState.offset.x}px, ${canvasState.offset.y}px) scale(${canvasState.zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Relationships */}
          {relationships.map((rel) => {
            const path = calculateRelationshipPath(rel);
            if (!path) return null;

            const isSelected = selectedRelationship === rel.id;
            const strokeColor = RELATIONSHIP_STROKE_COLORS[rel.type];

            return (
              <g key={rel.id}>
                {/* Clickable path (wider) */}
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="20"
                  className="cursor-pointer [pointer-events:stroke]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRelationship(rel.id);
                    onSelectRelationship?.(rel);
                  }}
                />
                {/* Visible path */}
                <path
                  d={path}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 3 : 2}
                  strokeDasharray={rel.type === 'many_to_many' ? '8,4' : undefined}
                  className={isSelected ? 'drop-shadow-[0_0_4px_currentColor]' : ''}
                />
                {/* Arrow marker */}
                <marker
                  id={`arrow-${rel.id}`}
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L9,3 z" fill={strokeColor} />
                </marker>
              </g>
            );
          })}

          {/* Connection line while drawing */}
          {connecting && (
            <line
              x1={connecting.currentPos.x - 100}
              y1={connecting.currentPos.y}
              x2={connecting.currentPos.x}
              y2={connecting.currentPos.y}
              className="stroke-primary"
              strokeWidth="2"
              strokeDasharray="8,4"
            />
          )}
        </svg>

        {/* Collection Nodes */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${canvasState.offset.x}px, ${canvasState.offset.y}px) scale(${canvasState.zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {nodeLayouts.map((layout) => {
            const collection = getCollection(layout.collectionId);
            if (!collection) return null;

            const isSelected = selectedCollectionId === collection.id;
            const isConnecting = connecting?.sourceId === collection.id;

            return (
              <div
                key={collection.id}
                className={`absolute rounded-xl transition-shadow bg-card ${
                  isSelected
                    ? 'border-2 border-primary ring-4 ring-primary/10 shadow-xl'
                    : isConnecting
                    ? 'border-2 border-warning-border shadow-lg'
                    : 'border-2 border-border shadow-lg'
                } ${canvasState.tool === 'select' ? 'cursor-move' : 'cursor-default'}`}
                style={{
                  left: layout.position.x,
                  top: layout.position.y,
                  width: layout.width,
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, collection.id)}
                onMouseUp={(e) => handleEndConnect(e, collection.id)}
              >
                {/* Header */}
                <div
                  className={`px-3 py-2 rounded-t-lg flex items-center gap-2 text-primary-foreground ${
                    collection.color ? '' : 'bg-primary'
                  }`}
                  style={collection.color ? { backgroundColor: collection.color } : undefined}
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold truncate">{collection.name}</h4>
                    <p className="text-xs opacity-80 truncate">{collection.code}</p>
                  </div>
                  {collection.isSystem && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-foreground/20">
                      System
                    </span>
                  )}
                </div>

                {/* Properties */}
                {canvasState.showPropertyDetails && (
                  <div className="p-2 max-h-56 overflow-y-auto">
                    {collection.properties.slice(0, 8).map((prop) => (
                      <div
                        key={prop.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs group ${
                          canvasState.tool === 'connect'
                            ? 'bg-muted cursor-pointer'
                            : 'bg-transparent cursor-default'
                        }`}
                        onMouseDown={(e) => handleStartConnect(e, collection.id, prop.code)}
                      >
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            prop.type.includes('reference')
                              ? 'bg-primary'
                              : 'bg-muted-foreground'
                          }`}
                        />
                        <span className="flex-1 truncate text-foreground">
                          {prop.name}
                        </span>
                        <span className="text-[10px] opacity-60 text-muted-foreground">
                          {prop.type.replace('_', ' ')}
                        </span>
                        {prop.required && (
                          <span className="text-[10px] text-destructive">*</span>
                        )}
                      </div>
                    ))}
                    {collection.properties.length > 8 && (
                      <div className="text-xs text-center py-1 text-muted-foreground">
                        +{collection.properties.length - 8} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Relationship Info */}
      {selectedRelationship && (
        <div className="absolute bottom-4 left-4 right-4 max-w-md mx-auto p-4 rounded-xl shadow-lg bg-card border border-border">
          {(() => {
            const rel = relationships.find((r) => r.id === selectedRelationship);
            if (!rel) return null;

            const source = getCollection(rel.sourceCollection);
            const target = getCollection(rel.targetCollection);

            return (
              <div className="flex items-center gap-4">
                <Link2 size={24} className={RELATIONSHIP_TEXT_CLASSES[rel.type]} />
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">{rel.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {source?.name} → {target?.name} ({rel.type.replace('_', ' ')})
                  </p>
                </div>
                <button
                  onClick={() => {
                    onDeleteRelationship(rel.id);
                    setSelectedRelationship(null);
                  }}
                  className="p-2 rounded hover:bg-opacity-50 text-destructive"
                  title="Delete relationship"
                  aria-label="Delete relationship"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 p-3 rounded-lg text-xs bg-card border border-border">
        <div className="font-medium mb-2 text-foreground">Relationship Types</div>
        <div className="space-y-1">
          {(Object.entries(RELATIONSHIP_BG_CLASSES) as [RelationshipType, string][]).map(([type, bgClass]) => (
            <div key={type} className="flex items-center gap-2">
              <div className={`w-4 h-0.5 ${bgClass}`} />
              <span className="text-muted-foreground">{type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RelationshipMapperCanvas;
