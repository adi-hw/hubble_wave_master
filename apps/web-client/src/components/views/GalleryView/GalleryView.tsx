/**
 * GalleryView Component
 * HubbleWave Platform - Phase 1
 *
 * A responsive grid view for displaying records as cards with images.
 * Supports configurable card sizes, aspect ratios, and image lightbox.
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { GalleryCard as CardComponent } from './GalleryCard';
import { Lightbox } from './Lightbox';
import { GalleryViewConfig, GalleryCard, BaseViewProps } from '../types';
import { Loader2, AlertCircle, Grid, Image as ImageIcon, Settings } from 'lucide-react';

interface GalleryViewProps extends BaseViewProps<GalleryViewConfig> {
  onConfigChange?: (updates: Partial<GalleryViewConfig>) => void;
}

const CARD_SIZE_CONFIG = {
  small: {
    minWidth: 200,
    maxWidth: 280,
  },
  medium: {
    minWidth: 280,
    maxWidth: 380,
  },
  large: {
    minWidth: 380,
    maxWidth: 500,
  },
};

export const GalleryView: React.FC<GalleryViewProps> = ({
  config,
  data,
  loading,
  error,
  onRecordClick,
  onRefresh,
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const cardSize = config.cardSize || 'medium';
  const aspectRatio = config.aspectRatio || '16:9';
  const showPropertyLabels = config.showPropertyLabels !== false;
  const enableLightbox = config.enableLightbox !== false;

  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateContainerWidth();

    const resizeObserver = new ResizeObserver(updateContainerWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const columnsPerRow = useMemo(() => {
    if (config.columnsPerRow) {
      return config.columnsPerRow;
    }

    if (containerWidth === 0) return 3;

    const sizeConfig = CARD_SIZE_CONFIG[cardSize];
    const gap = 16;
    const minColumns = 1;
    const maxColumns = 6;

    let columns = Math.floor((containerWidth + gap) / (sizeConfig.minWidth + gap));
    columns = Math.max(minColumns, Math.min(maxColumns, columns));

    const actualCardWidth = (containerWidth - gap * (columns - 1)) / columns;
    if (actualCardWidth > sizeConfig.maxWidth && columns > 1) {
      columns = Math.max(minColumns, columns - 1);
    }

    return columns;
  }, [containerWidth, cardSize, config.columnsPerRow]);

  const cards = useMemo(() => {
    return data.map((record): GalleryCard => {
      const properties = config.cardProperties
        .map((propKey) => {
          const value = record[propKey];
          return {
            label: propKey,
            value: value,
            type: detectPropertyType(value),
          };
        })
        .filter((prop) => prop.value !== undefined && prop.value !== null);

      return {
        id: record.id,
        title: record[config.titleProperty] || 'Untitled',
        subtitle: config.subtitleProperty ? record[config.subtitleProperty] : undefined,
        coverImage: config.coverImageProperty ? record[config.coverImageProperty] : undefined,
        properties,
        record,
      };
    });
  }, [data, config]);

  const allImages = useMemo(() => {
    return cards
      .map((card) => card.coverImage)
      .filter((img): img is string => Boolean(img));
  }, [cards]);

  const handleCardClick = useCallback(
    (card: GalleryCard) => {
      if (onRecordClick) {
        onRecordClick(card.record);
      }
    },
    [onRecordClick]
  );

  const handleImageClick = useCallback(
    (imageUrl: string) => {
      if (!enableLightbox) return;

      const imageIndex = allImages.indexOf(imageUrl);
      if (imageIndex !== -1) {
        setLightboxImages(allImages);
        setLightboxIndex(imageIndex);
        setLightboxOpen(true);
      }
    },
    [enableLightbox, allImages]
  );

  const handleCloseLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const handleNavigateLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl bg-muted border border-border">
        <Loader2
          className="h-10 w-10 animate-spin mb-4 text-primary"
          aria-hidden="true"
        />
        <p className="text-base text-muted-foreground">
          Loading gallery...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl bg-muted border border-destructive">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-destructive/10">
          <AlertCircle
            className="h-8 w-8 text-destructive"
            aria-hidden="true"
          />
        </div>
        <p className="text-base font-medium text-destructive">
          Failed to load gallery
        </p>
        <p className="text-sm mt-1 text-destructive">
          {error}
        </p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="mt-6 px-4 py-2 rounded-lg font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 min-w-[44px] min-h-[44px]"
            aria-label="Retry loading gallery"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl bg-muted border border-border">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-accent">
          <ImageIcon
            className="h-8 w-8 text-muted-foreground/60"
            aria-hidden="true"
          />
        </div>
        <p className="text-base font-medium text-muted-foreground">
          No items to display
        </p>
        <p className="text-sm mt-1 text-muted-foreground/60">
          Add some records to see them in the gallery
        </p>
      </div>
    );
  }

  const gridStyle = {
    gridTemplateColumns: `repeat(${columnsPerRow}, 1fr)`,
  };

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col rounded-xl overflow-hidden bg-background border border-border">
      {/* Gallery Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <Grid
            size={20}
            className="text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="text-lg font-semibold text-foreground">
            {config.name}
          </h2>
          <span className="text-sm px-2 py-0.5 rounded-full bg-accent text-muted-foreground">
            {cards.length} {cards.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted min-w-[44px] min-h-[44px]"
            title="Gallery settings"
            aria-label="Gallery settings"
          >
            <Settings size={18} aria-hidden="true" />
          </button>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-muted text-foreground border border-border hover:bg-accent min-h-[44px]"
              aria-label="Refresh gallery"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Gallery Grid */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 bg-background"
      >
        <div
          className="grid gap-4"
          style={gridStyle}
          role="list"
          aria-label="Gallery items"
        >
          {cards.map((card) => (
            <div key={card.id} role="listitem">
              <CardComponent
                card={card}
                cardSize={cardSize}
                aspectRatio={aspectRatio}
                showPropertyLabels={showPropertyLabels}
                enableLightbox={enableLightbox}
                onClick={onRecordClick ? handleCardClick : undefined}
                onImageClick={handleImageClick}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && lightboxImages.length > 0 && (
        <Lightbox
          images={lightboxImages}
          currentIndex={lightboxIndex}
          onClose={handleCloseLightbox}
          onNavigate={handleNavigateLightbox}
        />
      )}
    </div>
  );
};

function detectPropertyType(value: any): string {
  if (value === null || value === undefined) return 'text';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'string') {
    if (value.match(/^\d{4}-\d{2}-\d{2}T/)) return 'datetime';
    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) return 'date';
    if (value.match(/^https?:\/\//)) return 'url';
  }
  return 'text';
}

export default GalleryView;
