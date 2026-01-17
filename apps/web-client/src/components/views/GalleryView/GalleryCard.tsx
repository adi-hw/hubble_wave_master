/**
 * GalleryCard Component
 * HubbleWave Platform - Phase 1
 *
 * Individual card component for the Gallery View.
 * Displays cover image, title, subtitle, and custom properties.
 */

import React, { useState, useRef } from 'react';
import { GalleryCard as GalleryCardType, GalleryCardSize } from '../types';
import { Image as ImageIcon, Maximize2 } from 'lucide-react';

interface GalleryCardProps {
  card: GalleryCardType;
  cardSize: GalleryCardSize;
  aspectRatio: '1:1' | '4:3' | '16:9' | 'auto';
  showPropertyLabels: boolean;
  enableLightbox: boolean;
  onClick?: (card: GalleryCardType) => void;
  onImageClick?: (imageUrl: string) => void;
}

const CARD_SIZE_CLASSES = {
  small: 'text-sm',
  medium: 'text-base',
  large: 'text-lg',
};

const ASPECT_RATIO_CLASSES = {
  '1:1': 'pb-[100%]',
  '4:3': 'pb-[75%]',
  '16:9': 'pb-[56.25%]',
  'auto': 'h-[200px]',
};

export const GalleryCard: React.FC<GalleryCardProps> = ({
  card,
  cardSize,
  aspectRatio,
  showPropertyLabels,
  enableLightbox,
  onClick,
  onImageClick,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleCardClick = () => {
    if (onClick) {
      onClick(card);
    }
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (enableLightbox && card.coverImage && !imageError && onImageClick) {
      onImageClick(card.coverImage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onClick) {
        onClick(card);
      }
    }
  };

  const handleImageKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (enableLightbox && card.coverImage && !imageError && onImageClick) {
        onImageClick(card.coverImage);
      }
    }
  };

  return (
    <div
      ref={cardRef}
      className={`rounded-lg overflow-hidden transition-all duration-200 bg-card border border-border hover:border-primary hover:shadow-lg ${CARD_SIZE_CLASSES[cardSize]} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={onClick ? 0 : -1}
      role={onClick ? 'button' : 'article'}
      aria-label={`${card.title}${card.subtitle ? ` - ${card.subtitle}` : ''}`}
    >
      {/* Cover Image */}
      <div
        className={`relative overflow-hidden bg-muted ${ASPECT_RATIO_CLASSES[aspectRatio]}`}
      >
        {card.coverImage && !imageError ? (
          <>
            <img
              src={card.coverImage}
              alt={card.title}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"
                  role="status"
                  aria-label="Loading image"
                />
              </div>
            )}
            {enableLightbox && imageLoaded && (
              <div
                className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 bg-overlay/50 opacity-0 hover:opacity-100"
                onClick={handleImageClick}
                onKeyDown={handleImageKeyDown}
                tabIndex={0}
                role="button"
                aria-label="View full-size image"
              >
                <div className="w-12 h-12 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center bg-card">
                  <Maximize2
                    size={24}
                    className="text-foreground"
                    aria-hidden="true"
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <ImageIcon
              size={cardSize === 'small' ? 32 : cardSize === 'medium' ? 40 : 48}
              className="text-muted-foreground"
              aria-hidden="true"
            />
            <span className="text-xs text-muted-foreground">
              No image
            </span>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-4">
        {/* Title */}
        <h3
          className={`font-semibold mb-1 line-clamp-2 text-foreground ${
            cardSize === 'small' ? 'text-sm' : cardSize === 'medium' ? 'text-base' : 'text-lg'
          }`}
        >
          {card.title}
        </h3>

        {/* Subtitle */}
        {card.subtitle && (
          <p
            className={`line-clamp-1 mb-3 text-muted-foreground ${
              cardSize === 'small' ? 'text-xs' : 'text-sm'
            }`}
          >
            {card.subtitle}
          </p>
        )}

        {/* Additional Properties */}
        {card.properties.length > 0 && (
          <div className="space-y-2 mt-3">
            {card.properties.map((prop, index) => (
              <div key={index} className="flex flex-col gap-1">
                {showPropertyLabels && (
                  <span
                    className={`font-medium text-muted-foreground ${
                      cardSize === 'small' ? 'text-xs' : 'text-sm'
                    }`}
                  >
                    {prop.label}
                  </span>
                )}
                <div
                  className={`text-foreground ${
                    cardSize === 'small' ? 'text-xs' : 'text-sm'
                  }`}
                >
                  {renderPropertyValue(prop.value, prop.type)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function renderPropertyValue(value: unknown, type: string): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">—</span>;
  }

  switch (type) {
    case 'date':
      return new Date(value as string | number | Date).toLocaleDateString();
    case 'datetime':
      return new Date(value as string | number | Date).toLocaleString();
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    case 'array':
      return Array.isArray(value) ? value.join(', ') : String(value);
    case 'url':
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </a>
      );
    default:
      return String(value);
  }
}

export default GalleryCard;
