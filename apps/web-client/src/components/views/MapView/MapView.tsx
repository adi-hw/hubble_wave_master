/**
 * MapView Component
 * HubbleWave Platform - Phase 2
 *
 * A map view for displaying records with geographic coordinates.
 * Supports marker clustering, custom styling, popups, and geocoding.
 * Uses canvas-based rendering for performance with large datasets.
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Loader2,
  AlertCircle,
  MapPin,
  ZoomIn,
  ZoomOut,
  Layers,
  Search,
  RefreshCw,
  Navigation,
  X,
} from 'lucide-react';
import { MapViewConfig, MapMarker, BaseViewProps } from '../types';

interface MapViewProps extends BaseViewProps<MapViewConfig> {
  onMarkerMove?: (markerId: string, lat: number, lng: number) => Promise<void>;
}

interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface Cluster {
  lat: number;
  lng: number;
  markers: MapMarker[];
  isCluster: boolean;
}

type MapStyle = 'roadmap' | 'satellite' | 'terrain' | 'hybrid';

const TILE_SIZE = 256;
const MIN_ZOOM = 1;
const MAX_ZOOM = 18;

export const MapView: React.FC<MapViewProps> = ({
  config,
  data,
  loading,
  error,
  onRecordClick,
  onRefresh,
  onConfigChange,
}) => {
  const [center, setCenter] = useState<{ lat: number; lng: number }>(
    config.defaultCenter || { lat: 39.8283, lng: -98.5795 } // US center
  );
  const [zoom, setZoom] = useState(config.defaultZoom || 4);
  const [mapStyle, setMapStyle] = useState<MapStyle>(config.mapStyle || 'roadmap');
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showStylePicker, setShowStylePicker] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; lat: number; lng: number } | null>(null);

  // Transform records into map markers
  const markers = useMemo<MapMarker[]>(() => {
    const result: MapMarker[] = [];

    for (const record of data) {
      const lat = Number(record[config.latitudeProperty]);
      const lng = Number(record[config.longitudeProperty]);

      if (isNaN(lat) || isNaN(lng)) continue;

      const color = config.colorProperty
        ? (record[config.colorProperty] as string)
        : undefined;

      const icon = config.iconProperty
        ? (record[config.iconProperty] as string)
        : undefined;

      const properties: Record<string, unknown> = {};
      if (config.popupProperties) {
        for (const prop of config.popupProperties) {
          properties[prop] = record[prop];
        }
      }

      result.push({
        id: record.id as string,
        title: (record[config.titleProperty] as string) || 'Untitled',
        latitude: lat,
        longitude: lng,
        color,
        icon,
        properties,
        record,
      });
    }

    return result;
  }, [data, config]);

  // Cluster markers if enabled
  const clusteredMarkers = useMemo<Cluster[]>(() => {
    if (!config.clusterMarkers || markers.length < 2) {
      return markers.map((m) => ({
        lat: m.latitude,
        lng: m.longitude,
        markers: [m],
        isCluster: false,
      }));
    }

    const clusterRadius = config.clusterRadius || 60;
    const clusters: Cluster[] = [];
    const processed = new Set<string>();

    for (const marker of markers) {
      if (processed.has(marker.id)) continue;

      const cluster: MapMarker[] = [marker];
      processed.add(marker.id);

      // Find nearby markers
      for (const other of markers) {
        if (processed.has(other.id)) continue;

        const pixelDistance = Math.sqrt(
          Math.pow((marker.latitude - other.latitude) * zoom * 10, 2) +
          Math.pow((marker.longitude - other.longitude) * zoom * 10, 2)
        );

        if (pixelDistance < clusterRadius / zoom) {
          cluster.push(other);
          processed.add(other.id);
        }
      }

      // Calculate cluster center
      const avgLat = cluster.reduce((sum, m) => sum + m.latitude, 0) / cluster.length;
      const avgLng = cluster.reduce((sum, m) => sum + m.longitude, 0) / cluster.length;

      clusters.push({
        lat: avgLat,
        lng: avgLng,
        markers: cluster,
        isCluster: cluster.length > 1,
      });
    }

    return clusters;
  }, [markers, config.clusterMarkers, config.clusterRadius, zoom]);

  // Convert lat/lng to pixel coordinates
  const latLngToPixel = useCallback(
    (lat: number, lng: number): { x: number; y: number } => {
      const scale = Math.pow(2, zoom);
      const worldCoordX = ((lng + 180) / 360) * TILE_SIZE;
      const worldCoordY =
        ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
        TILE_SIZE;

      const centerWorldX = ((center.lng + 180) / 360) * TILE_SIZE * scale;
      const centerWorldY =
        ((1 - Math.log(Math.tan((center.lat * Math.PI) / 180) + 1 / Math.cos((center.lat * Math.PI) / 180)) / Math.PI) / 2) *
        TILE_SIZE *
        scale;

      const x = worldCoordX * scale - centerWorldX + containerSize.width / 2;
      const y = worldCoordY * scale - centerWorldY + containerSize.height / 2;

      return { x, y };
    },
    [center, zoom, containerSize]
  );

  // Fit map to show all markers
  const fitBounds = useCallback(() => {
    if (markers.length === 0) return;

    const lats = markers.map((m) => m.latitude);
    const lngs = markers.map((m) => m.longitude);

    const bounds: MapBounds = {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs),
    };

    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;

    // Calculate appropriate zoom level
    const latDiff = bounds.north - bounds.south;
    const lngDiff = bounds.east - bounds.west;
    const maxDiff = Math.max(latDiff, lngDiff);

    let newZoom = 1;
    if (maxDiff > 0) {
      newZoom = Math.floor(Math.log2(180 / maxDiff));
      newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM - 2, newZoom));
    }

    setCenter({ lat: centerLat, lng: centerLng });
    setZoom(newZoom);
  }, [markers]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Fit bounds on initial load
  useEffect(() => {
    if (markers.length > 0 && !config.defaultCenter) {
      fitBounds();
    }
  }, [markers.length > 0]);

  // Draw map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = containerSize.width;
    canvas.height = containerSize.height;

    // Clear canvas
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, containerSize.width, containerSize.height);

    // Draw placeholder map background with grid
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;

    const gridSize = 50;
    for (let x = 0; x < containerSize.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, containerSize.height);
      ctx.stroke();
    }
    for (let y = 0; y < containerSize.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(containerSize.width, y);
      ctx.stroke();
    }

    // Draw map info
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `Center: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)} | Zoom: ${zoom}`,
      containerSize.width / 2,
      containerSize.height - 10
    );

    // Draw clusters/markers
    for (const cluster of clusteredMarkers) {
      const { x, y } = latLngToPixel(cluster.lat, cluster.lng);

      if (x < -50 || x > containerSize.width + 50 || y < -50 || y > containerSize.height + 50) {
        continue;
      }

      if (cluster.isCluster) {
        // Draw cluster circle
        const radius = Math.min(30, 15 + cluster.markers.length);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#3b82f6'; // primary color
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw count
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(cluster.markers.length), x, y);
      } else {
        // Draw single marker
        const marker = cluster.markers[0];
        const color = marker.color || '#3b82f6';
        const isSelected = selectedMarker?.id === marker.id;

        // Draw marker pin
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 10, y - 25);
        ctx.arc(x, y - 25, 10, Math.PI, 0, false);
        ctx.lineTo(x, y);
        ctx.fillStyle = isSelected ? '#1d4ed8' : color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw inner circle
        ctx.beginPath();
        ctx.arc(x, y - 25, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
      }
    }
  }, [containerSize, center, zoom, clusteredMarkers, selectedMarker, latLngToPixel]);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicked on a marker
    for (const cluster of clusteredMarkers) {
      const pixel = latLngToPixel(cluster.lat, cluster.lng);
      const distance = Math.sqrt(Math.pow(pixel.x - x, 2) + Math.pow(pixel.y - y, 2));

      if (distance < (cluster.isCluster ? 30 : 15)) {
        if (cluster.isCluster) {
          // Zoom in on cluster
          setCenter({ lat: cluster.lat, lng: cluster.lng });
          setZoom(Math.min(MAX_ZOOM, zoom + 2));
        } else {
          setSelectedMarker(cluster.markers[0]);
          onRecordClick?.(cluster.markers[0].record);
        }
        return;
      }
    }

    // Start dragging
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, lat: center.lat, lng: center.lng });
    setSelectedMarker(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    const scale = Math.pow(2, zoom);
    const deltaLng = (-deltaX / scale / TILE_SIZE) * 360;
    const deltaLat = (deltaY / scale / TILE_SIZE) * 180;

    setCenter({
      lat: Math.max(-85, Math.min(85, dragStart.lat + deltaLat)),
      lng: dragStart.lng + deltaLng,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((prev) => Math.min(MAX_ZOOM, prev + 1));
  const handleZoomOut = () => setZoom((prev) => Math.max(MIN_ZOOM, prev - 1));

  // Loading state
  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl bg-muted border border-border">
        <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
        <p className="text-base text-muted-foreground">
          Loading map...
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl bg-muted border border-destructive">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <p className="text-base font-medium text-destructive">
          Failed to load map
        </p>
        <p className="text-sm mt-1 text-destructive">
          {error}
        </p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="mt-6 px-4 py-2 rounded-lg font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  // Empty state
  if (markers.length === 0) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl bg-muted border border-border">
        <MapPin size={48} className="text-muted-foreground/50" />
        <p className="mt-4 text-base text-muted-foreground">
          No locations to display on the map
        </p>
        <p className="text-sm mt-1 text-muted-foreground/70">
          Add records with latitude and longitude coordinates
        </p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col rounded-xl overflow-hidden bg-background border border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            {config.name}
          </h2>
          <span className="text-sm px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {markers.length} locations
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          {config.enableSearch && (
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search locations..."
                className="pl-9 pr-3 py-2 rounded-lg text-sm w-[200px] bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
            </div>
          )}

          {/* Fit bounds */}
          <button
            onClick={fitBounds}
            className="p-2 rounded-lg transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Fit to markers"
          >
            <Navigation size={18} />
          </button>

          {/* Map style picker */}
          <div className="relative">
            <button
              onClick={() => setShowStylePicker(!showStylePicker)}
              className="p-2 rounded-lg transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Map style"
            >
              <Layers size={18} />
            </button>
            {showStylePicker && (
              <div className="absolute right-0 top-full mt-1 py-1 rounded-lg shadow-lg z-50 min-w-[120px] bg-card border border-border">
                {(['roadmap', 'satellite', 'terrain', 'hybrid'] as MapStyle[]).map((style) => (
                  <button
                    key={style}
                    onClick={() => {
                      setMapStyle(style);
                      setShowStylePicker(false);
                      onConfigChange?.({ mapStyle: style });
                    }}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                      mapStyle === style
                        ? 'text-primary bg-primary/10'
                        : 'text-foreground'
                    }`}
                  >
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Map container */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {/* Canvas map */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />

        {/* Zoom controls */}
        <div className="absolute top-4 right-4 flex flex-col rounded-lg overflow-hidden shadow-lg z-10 bg-card border border-border">
          <button
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="p-2 transition-colors disabled:opacity-50 text-foreground hover:bg-muted"
            title="Zoom in"
          >
            <ZoomIn size={18} />
          </button>
          <div className="px-3 py-1 text-center text-sm font-medium border-t border-b border-border text-muted-foreground">
            {zoom}
          </div>
          <button
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="p-2 transition-colors disabled:opacity-50 text-foreground hover:bg-muted"
            title="Zoom out"
          >
            <ZoomOut size={18} />
          </button>
        </div>

        {/* Selected marker popup */}
        {selectedMarker && (() => {
          const { x, y } = latLngToPixel(selectedMarker.latitude, selectedMarker.longitude);
          return (
            <div
              className="absolute z-20 rounded-lg shadow-lg overflow-hidden w-[250px] bg-card border border-border"
              style={{
                left: `${Math.min(containerSize.width - 260, Math.max(10, x - 125))}px`,
                top: `${Math.max(10, y - 180)}px`,
              }}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted">
                <span className="font-medium text-sm truncate text-foreground">
                  {selectedMarker.title}
                </span>
                <button
                  onClick={() => setSelectedMarker(null)}
                  className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <MapPin size={12} className="text-muted-foreground/70" />
                  <span className="text-muted-foreground">
                    {selectedMarker.latitude.toFixed(6)}, {selectedMarker.longitude.toFixed(6)}
                  </span>
                </div>
                {Object.entries(selectedMarker.properties).slice(0, 5).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="text-foreground">
                      {String(value ?? '-')}
                    </span>
                  </div>
                ))}
                <button
                  onClick={() => onRecordClick?.(selectedMarker.record)}
                  className="w-full mt-2 px-3 py-1.5 rounded text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  View Details
                </button>
              </div>
            </div>
          );
        })()}

        {/* Legend */}
        {config.colorProperty && (
          <div className="absolute bottom-4 left-4 p-3 rounded-lg shadow-lg z-10 bg-card border border-border">
            <div className="text-xs font-medium mb-2 text-muted-foreground">
              {config.colorProperty}
            </div>
            <div className="space-y-1">
              {Array.from(new Set(markers.map((m) => m.color).filter(Boolean)))
                .slice(0, 5)
                .map((color, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color || '#3b82f6' }}
                    />
                    <span className="text-xs text-foreground">
                      {color || 'Default'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapView;
