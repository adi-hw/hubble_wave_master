/**
 * Lightbox Component
 * HubbleWave Platform - Phase 1
 *
 * Full-screen image viewer with keyboard navigation and controls.
 */

import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface LightboxProps {
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onNavigate?: (index: number) => void;
}

export const Lightbox: React.FC<LightboxProps> = ({
  images,
  currentIndex,
  onClose,
  onNavigate,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const overlayRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const currentImage = images[currentIndex];
  const hasMultipleImages = images.length > 1;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setZoom(1);
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (hasPrevious && onNavigate) {
            onNavigate(currentIndex - 1);
          }
          break;
        case 'ArrowRight':
          if (hasNext && onNavigate) {
            onNavigate(currentIndex + 1);
          }
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          handleZoomOut();
          break;
        case '0':
          e.preventDefault();
          setZoom(1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [currentIndex, hasPrevious, hasNext, onClose, onNavigate]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (hasPrevious && onNavigate) {
      onNavigate(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (hasNext && onNavigate) {
      onNavigate(currentIndex + 1);
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const getZoomClass = () => {
    if (zoom === 0.5) return 'scale-50';
    if (zoom === 0.75) return 'scale-75';
    if (zoom === 1) return 'scale-100';
    if (zoom === 1.25) return 'scale-125';
    if (zoom === 1.5) return 'scale-150';
    if (zoom === 2) return 'scale-[2]';
    if (zoom === 2.25) return 'scale-[2.25]';
    if (zoom === 2.5) return 'scale-[2.5]';
    if (zoom === 2.75) return 'scale-[2.75]';
    if (zoom === 3) return 'scale-[3]';
    return 'scale-100';
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/90"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Image lightbox"
    >
      {/* Close Button */}
      <button
        className="absolute top-4 right-4 z-10 rounded-full p-3 transition-colors bg-card text-foreground min-w-[44px] min-h-[44px] hover:bg-muted"
        onClick={onClose}
        aria-label="Close lightbox"
      >
        <X size={24} aria-hidden="true" />
      </button>

      {/* Zoom Controls */}
      <div className="absolute top-4 left-4 z-10 flex gap-2 rounded-lg p-2 bg-card">
        <button
          className={cn(
            'p-2 rounded transition-colors text-foreground min-w-[44px] min-h-[44px] hover:bg-muted',
            zoom <= 0.5 ? 'bg-muted' : 'bg-transparent'
          )}
          onClick={handleZoomOut}
          disabled={zoom <= 0.5}
          aria-label="Zoom out"
        >
          <ZoomOut size={20} aria-hidden="true" />
        </button>
        <button
          className="px-3 py-2 rounded font-medium text-foreground bg-muted min-w-[44px] min-h-[44px] hover:bg-muted/80"
          onClick={handleResetZoom}
          aria-label={`Current zoom: ${Math.round(zoom * 100)}%. Click to reset to 100%`}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          className={cn(
            'p-2 rounded transition-colors text-foreground min-w-[44px] min-h-[44px] hover:bg-muted',
            zoom >= 3 ? 'bg-muted' : 'bg-transparent'
          )}
          onClick={handleZoomIn}
          disabled={zoom >= 3}
          aria-label="Zoom in"
        >
          <ZoomIn size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Image Counter */}
      {hasMultipleImages && (
        <div
          className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 px-4 py-2 rounded-full bg-card text-foreground"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="font-medium">
            {currentIndex + 1} / {images.length}
          </span>
        </div>
      )}

      {/* Previous Button */}
      {hasMultipleImages && hasPrevious && (
        <button
          className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 rounded-full p-3 transition-colors bg-card text-foreground min-w-[44px] min-h-[44px] hover:bg-muted"
          onClick={handlePrevious}
          aria-label="Previous image"
        >
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
      )}

      {/* Next Button */}
      {hasMultipleImages && hasNext && (
        <button
          className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 rounded-full p-3 transition-colors bg-card text-foreground min-w-[44px] min-h-[44px] hover:bg-muted"
          onClick={handleNext}
          aria-label="Next image"
        >
          <ChevronRight size={24} aria-hidden="true" />
        </button>
      )}

      {/* Image */}
      <div className="flex items-center justify-center max-w-[90vw] max-h-[90vh] overflow-auto">
        {!imageError ? (
          <img
            ref={imageRef}
            src={currentImage}
            alt={`Image ${currentIndex + 1} of ${images.length}`}
            className={cn(
              'max-w-full max-h-full object-contain transition-all duration-300',
              getZoomClass(),
              imageLoaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-8 rounded-lg bg-card">
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-destructive/10">
              <X
                size={32}
                className="text-destructive"
                aria-hidden="true"
              />
            </div>
            <p className="text-base font-medium text-destructive">
              Failed to load image
            </p>
          </div>
        )}

        {!imageLoaded && !imageError && (
          <div
            className="absolute w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"
            role="status"
            aria-label="Loading image"
          />
        )}
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 px-4 py-2 rounded-lg text-xs bg-card text-muted-foreground">
        <span>
          ESC: Close
          {hasMultipleImages && ' | ← →: Navigate'}
          {' | +/−: Zoom | 0: Reset zoom'}
        </span>
      </div>
    </div>
  );
};

export default Lightbox;
