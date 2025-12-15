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
  // Parse value into lat/lng
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

  // Sync state if value prop changes externally
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

    // Pass as "lat,lon" string since backend storage is text
    // Or if backend becomes strict, we could change this.
    // For now, strict string format "lat,lon" seems safest for text columns.
    // Only call onChange if both are valid numbers or empty?
    // Let's allow partial for typing, but maybe only commit valid?
    // Actually, usually fields commit on every change.
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
        setShowMap(true); // Auto-show map on update
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

  // Check if we have valid coordinates for map
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  const isValidCoord = !isNaN(numLat) && !isNaN(numLng) && lat !== '' && lng !== '' && 
                       numLat >= -90 && numLat <= 90 && numLng >= -180 && numLng <= 180;

  // OSM Embed URL
  // bbox = left,bottom,right,top
  const delta = 0.01; // Zoom level approx
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
               <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    <div className="h-48 w-full relative">
                        <iframe 
                            width="100%" 
                            height="100%" 
                            frameBorder="0" 
                            src={mapUrl}
                            title="Location Map"
                            className="bg-slate-100"
                        />
                        <a 
                           href={`https://www.google.com/maps?q=${lat},${lng}`}
                           target="_blank"
                           rel="noreferrer"
                           className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-2 py-1 text-xs font-medium text-slate-600 rounded shadow-sm hover:text-primary-600 flex items-center gap-1"
                        >
                           <ExternalLink size={10} /> Open in Maps
                        </a>
                    </div>
                    <div className="px-3 py-2 border-t border-slate-200 flex items-center gap-2 text-sm text-slate-600">
                        <MapPin size={14} className="text-primary-500" />
                        <span className="font-mono">{lat}, {lng}</span>
                    </div>
               </div>
           ) : (
               <div className="text-sm text-slate-400 italic">No location set</div>
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
        {/* Map Preview */}
        {isValidCoord && (
           <div className={`rounded-lg overflow-hidden border border-slate-200 relative group transition-all ${showMap ? 'h-40' : 'h-10 bg-slate-50'}`}>
                {showMap ? (
                    <iframe 
                        width="100%" 
                        height="100%" 
                        frameBorder="0" 
                        src={mapUrl}
                        title="Location Map"
                        className="bg-slate-50"
                    />
                ) : (
                    <div className="flex items-center gap-2 px-3 h-full text-slate-500 text-sm">
                        <MapIcon size={16} />
                        <span>Map preview hidden</span>
                        <span className="font-mono text-xs text-slate-400 ml-auto">{lat}, {lng}</span>
                    </div>
                )}
                
                <div className="absolute top-2 right-2 flex items-center gap-1">
                     <button
                        type="button"
                        onClick={() => setShowMap(!showMap)}
                        className="p-1.5 bg-white text-slate-500 hover:text-primary-600 rounded shadow-sm transition-colors border border-slate-100"
                        title={showMap ? "Hide map" : "Show map"}
                     >
                        {showMap ? <EyeOff size={14} /> : <Eye size={14} />}
                     </button>
                     <button
                        type="button"
                        onClick={clearLocation}
                        className="p-1.5 bg-white text-slate-400 hover:text-danger-500 rounded shadow-sm transition-colors border border-slate-100"
                        title="Clear location data"
                     >
                        <Trash2 size={14} />
                     </button>
                </div>
           </div>
        )}

        {/* Inputs */}
        <div className="flex items-start gap-2">
           <div className="flex-1 min-w-0">
              <label className="text-[10px] uppercase font-bold text-slate-400 mb-0.5 block tracking-wider">Latitude</label>
              <input 
                  type="text" 
                  value={lat}
                  onChange={(e) => updateValue(e.target.value, lng)}
                  className={getInputClasses({ error, disabled: !!disabled })}
                  placeholder="-90 to 90"
              />
           </div>
           <div className="flex-1 min-w-0">
               <label className="text-[10px] uppercase font-bold text-slate-400 mb-0.5 block tracking-wider">Longitude</label>
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
                  className="h-10 px-3 bg-slate-100 text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-200 hover:border-slate-300 transition-colors flex items-center justify-center"
                  title="Use my current location"
               >
                  <Navigation size={18} />
               </button>
           </div>
        </div>
      </div>
    </FieldWrapper>
  );
};
