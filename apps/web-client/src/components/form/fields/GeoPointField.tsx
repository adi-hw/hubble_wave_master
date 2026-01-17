import React, { useState, useEffect, useMemo } from 'react';
import { FieldComponentProps } from '../types';
import { FieldWrapper, getInputClasses } from './FieldWrapper';
import { MapPin, Navigation, Trash2, ExternalLink, Map as MapIcon, Eye, EyeOff } from 'lucide-react';

export const GeoPointField: React.FC<FieldComponentProps<string | { lat: number; lng: number }>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
  const parsedValue = useMemo(() => {
    if (!value) return { lat: '', lng: '' };
    if (typeof value === 'object' && value !== null) {
      return { lat: String(value.lat), lng: String(value.lng) };
    }
    if (typeof value === 'string') {
      const [lat, lng] = value.split(',').map((s) => s.trim());
      return { lat: lat || '', lng: lng || '' };
    }
    return { lat: '', lng: '' };
  }, [value]);

  const [lat, setLat] = useState(parsedValue.lat);
  const [lng, setLng] = useState(parsedValue.lng);
  const [showMap, setShowMap] = useState(true);

  useEffect(() => {
    setLat(parsedValue.lat);
    setLng(parsedValue.lng);
  }, [parsedValue]);

  const updateValue = (newLat: string, newLng: string) => {
    setLat(newLat);
    setLng(newLng);

    if (!newLat && !newLng) {
      onChange(undefined);
      return;
    }

    onChange(`${newLat},${newLng}`);
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLat = position.coords.latitude.toFixed(6);
        const newLng = position.coords.longitude.toFixed(6);
        updateValue(newLat, newLng);
        setShowMap(true);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to retrieve your location');
      }
    );
  };

  const clearLocation = () => {
    updateValue('', '');
  };

  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  const isValidCoord = !isNaN(numLat) && !isNaN(numLng) && lat !== '' && lng !== '' &&
                       numLat >= -90 && numLat <= 90 && numLng >= -180 && numLng <= 180;

  const delta = 0.01;
  const bbox = isValidCoord
    ? `${numLng - delta},${numLat - delta},${numLng + delta},${numLat + delta}`
    : '';
  const mapUrl = isValidCoord
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${numLat},${numLng}`
    : '';

  if (readOnly) {
    return (
      <FieldWrapper label={field.label} required={false}>
        {isValidCoord ? (
          <div className="rounded-lg overflow-hidden border border-border bg-muted">
            <div className="h-48 w-full relative">
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                src={mapUrl}
                title="Location Map"
                className="bg-muted"
              />
              <a
                href={`https://www.google.com/maps?q=${lat},${lng}`}
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-2 right-2 backdrop-blur px-2 py-1 text-xs font-medium rounded shadow-sm flex items-center gap-1 bg-card/90 text-muted-foreground hover:text-primary"
                aria-label="Open location in Google Maps"
              >
                <ExternalLink size={10} aria-hidden="true" /> Open in Maps
              </a>
            </div>
            <div className="px-3 py-2 flex items-center gap-2 text-sm border-t border-border text-muted-foreground">
              <MapPin size={14} className="text-primary" aria-hidden="true" />
              <span className="font-mono">{lat}, {lng}</span>
            </div>
          </div>
        ) : (
          <div className="text-sm italic text-muted-foreground">No location set</div>
        )}
      </FieldWrapper>
    );
  }

  return (
    <FieldWrapper
      label={field.label}
      required={field.config?.validators?.required}
      error={error}
      helpText={field.config?.helpText}
    >
      <div className="space-y-3">
        {isValidCoord && (
          <div
            className={`rounded-lg overflow-hidden relative group transition-all border border-border ${showMap ? 'h-40' : 'h-10 bg-muted'}`}
          >
            {showMap ? (
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                src={mapUrl}
                title="Location Map"
                className="bg-muted"
              />
            ) : (
              <div className="flex items-center gap-2 px-3 h-full text-sm text-muted-foreground">
                <MapIcon size={16} aria-hidden="true" />
                <span>Map preview hidden</span>
                <span className="font-mono text-xs ml-auto text-muted-foreground/70">{lat}, {lng}</span>
              </div>
            )}

            <div className="absolute top-2 right-2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowMap(!showMap)}
                className="p-1.5 rounded shadow-sm transition-colors min-h-[44px] min-w-[44px] bg-card text-muted-foreground hover:text-primary border border-border"
                aria-label={showMap ? "Hide map" : "Show map"}
              >
                {showMap ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
              </button>
              <button
                type="button"
                onClick={clearLocation}
                className="p-1.5 rounded shadow-sm transition-colors min-h-[44px] min-w-[44px] bg-card text-muted-foreground hover:text-destructive border border-border"
                aria-label="Clear location data"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <label className="text-[10px] uppercase font-bold mb-0.5 block tracking-wider text-muted-foreground">Latitude</label>
            <input
              type="text"
              value={lat}
              onChange={(e) => updateValue(e.target.value, lng)}
              className={getInputClasses({ error, disabled: !!disabled })}
              placeholder="-90 to 90"
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-[10px] uppercase font-bold mb-0.5 block tracking-wider text-muted-foreground">Longitude</label>
            <input
              type="text"
              value={lng}
              onChange={(e) => updateValue(lat, e.target.value)}
              className={getInputClasses({ error, disabled: !!disabled })}
              placeholder="-180 to 180"
            />
          </div>
          <div className="pt-[19px]">
            <button
              type="button"
              onClick={handleCurrentLocation}
              disabled={disabled}
              className="h-10 px-3 rounded-lg transition-colors flex items-center justify-center min-h-[44px] min-w-[44px] bg-muted text-muted-foreground hover:text-primary border border-border"
              aria-label="Use my current location"
            >
              <Navigation size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </FieldWrapper>
  );
};
