/**
 * DigitalTwinViewer - 3D Asset Visualization
 * HubbleWave Platform - Phase 7
 *
 * WebGL-based 3D viewer for digital twin assets.
 * Uses Three.js for rendering.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Maximize2,
  Minimize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Play,
  Pause,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassButton } from '../../components/ui/glass/GlassButton';
import { GlassCard } from '../../components/ui/glass/GlassCard';

interface AssetState {
  temperature?: number;
  vibration?: number;
  pressure?: number;
  humidity?: number;
  status: 'operational' | 'warning' | 'critical' | 'offline';
  lastUpdate: Date;
}

interface DigitalTwinViewerProps {
  assetId: string;
  assetName?: string;
  modelUrl?: string;
  className?: string;
  width?: number;
  height?: number;
  showControls?: boolean;
  showSensorData?: boolean;
  autoRotate?: boolean;
}

export const DigitalTwinViewer: React.FC<DigitalTwinViewerProps> = ({
  assetId,
  assetName = 'Asset',
  className,
  width = 800,
  height = 600,
  showControls = true,
  showSensorData = true,
  autoRotate: initialAutoRotate = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(initialAutoRotate);
  const [showGrid, setShowGrid] = useState(true);
  const [assetState, setAssetState] = useState<AssetState>({
    status: 'operational',
    lastUpdate: new Date(),
    temperature: 45,
    vibration: 2.5,
    pressure: 101.3,
    humidity: 55,
  });

  // Simulated 3D rendering without Three.js dependency
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsLoading(true);
    setError(null);

    // Simulate loading time
    const loadTimer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(loadTimer);
  }, [assetId]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isLoading) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Clear canvas
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, width, height);

      // Draw grid if enabled
      if (showGrid) {
        drawGrid(ctx, width, height);
      }

      // Draw 3D cube representation
      drawAsset(ctx, width, height, rotation, zoom, assetState.status);

      // Auto-rotate
      if (autoRotate) {
        setRotation((prev) => ({
          x: prev.x,
          y: prev.y + 0.5,
        }));
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isLoading, width, height, rotation, zoom, autoRotate, showGrid, assetState.status]);

  // Simulate real-time sensor updates
  useEffect(() => {
    const interval = setInterval(() => {
      setAssetState((prev) => ({
        ...prev,
        temperature: 40 + Math.random() * 20,
        vibration: 1 + Math.random() * 4,
        pressure: 100 + Math.random() * 5,
        humidity: 50 + Math.random() * 20,
        lastUpdate: new Date(),
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Handle mouse drag for rotation
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (e.buttons !== 1 || autoRotate) return;

      setRotation((prev) => ({
        x: prev.x + e.movementY * 0.5,
        y: prev.y + e.movementX * 0.5,
      }));
    },
    [autoRotate]
  );

  // Handle zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.max(0.5, Math.min(3, prev - e.deltaY * 0.001)));
  }, []);

  const resetView = () => {
    setRotation({ x: 0, y: 0 });
    setZoom(1);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const statusColorClasses: Record<AssetState['status'], string> = {
    operational: 'text-success-text',
    warning: 'text-warning-text',
    critical: 'text-danger-text',
    offline: 'text-muted-foreground',
  };

  const statusBgClasses: Record<AssetState['status'], string> = {
    operational: 'bg-success',
    warning: 'bg-warning',
    critical: 'bg-destructive',
    offline: 'bg-muted-foreground',
  };

  const StatusIcon = assetState.status === 'operational' ? CheckCircle : AlertTriangle;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative rounded-xl overflow-hidden',
        'bg-card border border-border',
        isFullscreen ? 'fixed inset-0 z-50 w-full h-full' : '',
        className
      )}
      {...(!isFullscreen && { style: { width, height } })}
    >
      {/* Header */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-overlay/50"
      >
        <div className="flex items-center gap-2">
          <div
            className={cn('w-2 h-2 rounded-full animate-pulse', statusBgClasses[assetState.status])}
          />
          <span className="text-sm font-medium text-primary-foreground">{assetName}</span>
          <span className="text-xs text-muted-foreground">#{assetId}</span>
        </div>
        <div className="flex items-center gap-1">
          <RefreshCw
            className="h-3 w-3 text-muted-foreground animate-spin [animation-duration:3s]"
          />
          <span className="text-xs text-muted-foreground">
            Live: {assetState.lastUpdate.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={isFullscreen ? window.innerWidth : width}
        height={isFullscreen ? window.innerHeight : height}
        className="cursor-grab active:cursor-grabbing"
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-overlay/50">
          <div className="text-center text-primary-foreground">
            <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
            <p className="text-sm">Loading 3D Model...</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-overlay/50">
          <div className="text-center text-primary-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-danger-text" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Controls */}
      {showControls && !isLoading && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-2 rounded-lg bg-overlay/70"
        >
          <GlassButton
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => setAutoRotate(!autoRotate)}
            aria-label={autoRotate ? 'Stop rotation' : 'Auto-rotate'}
          >
            {autoRotate ? (
              <Pause className="h-4 w-4 text-primary-foreground" />
            ) : (
              <Play className="h-4 w-4 text-primary-foreground" />
            )}
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            iconOnly
            onClick={resetView}
            aria-label="Reset view"
          >
            <RotateCcw className="h-4 w-4 text-primary-foreground" />
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4 text-primary-foreground" />
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4 text-primary-foreground" />
          </GlassButton>
          <div className="w-px h-4 bg-border/70" />
          <GlassButton
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => setShowGrid(!showGrid)}
            aria-label="Toggle grid"
            className={showGrid ? 'bg-primary-foreground/20' : ''}
          >
            <Grid3X3 className="h-4 w-4 text-primary-foreground" />
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            iconOnly
            onClick={toggleFullscreen}
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4 text-primary-foreground" />
            ) : (
              <Maximize2 className="h-4 w-4 text-primary-foreground" />
            )}
          </GlassButton>
        </div>
      )}

      {/* Sensor Data Panel */}
      {showSensorData && !isLoading && (
        <GlassCard
          className="absolute top-12 right-4 z-10 w-48 bg-overlay/70"
          padding="sm"
        >
          <div className="flex items-center gap-2 mb-2">
            <StatusIcon
              className={cn('h-4 w-4', statusColorClasses[assetState.status])}
            />
            <span
              className={cn('text-xs font-medium uppercase', statusColorClasses[assetState.status])}
            >
              {assetState.status}
            </span>
          </div>

          <div className="space-y-2 text-xs text-primary-foreground">
            {assetState.temperature !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Temperature</span>
                <span>{assetState.temperature.toFixed(1)}°C</span>
              </div>
            )}
            {assetState.vibration !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vibration</span>
                <span>{assetState.vibration.toFixed(2)} mm/s</span>
              </div>
            )}
            {assetState.pressure !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pressure</span>
                <span>{assetState.pressure.toFixed(1)} kPa</span>
              </div>
            )}
            {assetState.humidity !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Humidity</span>
                <span>{assetState.humidity.toFixed(0)}%</span>
              </div>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
};

// Helper functions for canvas rendering

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gridSize = 40;
  ctx.strokeStyle = 'rgba(100, 100, 150, 0.3)';
  ctx.lineWidth = 1;

  // Vertical lines
  for (let x = 0; x <= width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = 0; y <= height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawAsset(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rotation: { x: number; y: number },
  zoom: number,
  status: AssetState['status']
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const size = 80 * zoom;

  // 3D cube vertices (simplified)
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const cosX = Math.cos(rad(rotation.x));
  const sinX = Math.sin(rad(rotation.x));
  const cosY = Math.cos(rad(rotation.y));
  const sinY = Math.sin(rad(rotation.y));

  // Define cube vertices
  const vertices = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ];

  // Project 3D to 2D
  const project = (v: number[]) => {
    const [x, y, z] = v;

    // Rotate around Y axis
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;

    // Rotate around X axis
    const y1 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    // Perspective projection
    const scale = 4 / (4 + z2);
    return {
      x: centerX + x1 * size * scale,
      y: centerY + y1 * size * scale,
    };
  };

  const projected = vertices.map(project);

  // Define faces
  const faces = [
    [0, 1, 2, 3], // front
    [4, 5, 6, 7], // back
    [0, 4, 7, 3], // left
    [1, 5, 6, 2], // right
    [0, 1, 5, 4], // top
    [3, 2, 6, 7], // bottom
  ];

  // Status colors
  const statusColors: Record<AssetState['status'], string> = {
    operational: 'rgba(34, 197, 94, 0.3)',
    warning: 'rgba(234, 179, 8, 0.3)',
    critical: 'rgba(239, 68, 68, 0.3)',
    offline: 'rgba(107, 114, 128, 0.3)',
  };

  const statusEdgeColors: Record<AssetState['status'], string> = {
    operational: '#22c55e',
    warning: '#eab308',
    critical: '#ef4444',
    offline: '#6b7280',
  };

  // Draw faces
  faces.forEach((face) => {
    ctx.beginPath();
    ctx.moveTo(projected[face[0]].x, projected[face[0]].y);
    face.forEach((_, i) => {
      if (i > 0) {
        ctx.lineTo(projected[face[i]].x, projected[face[i]].y);
      }
    });
    ctx.closePath();
    ctx.fillStyle = statusColors[status];
    ctx.fill();
    ctx.strokeStyle = statusEdgeColors[status];
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Draw center indicator
  ctx.beginPath();
  ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
  ctx.fillStyle = statusEdgeColors[status];
  ctx.fill();
}

export default DigitalTwinViewer;
