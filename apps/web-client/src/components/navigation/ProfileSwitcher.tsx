/**
 * ProfileSwitcher Component
 * HubbleWave Platform - Phase 1
 *
 * Production-ready profile switcher with:
 * - Theme-aware styling using CSS variables
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly 44px touch targets
 * - ARIA combobox pattern
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check, Lock, Layers } from 'lucide-react';
import { NavProfileSummary } from '../../types/navigation';

interface ProfileSwitcherProps {
  profiles: NavProfileSummary[];
  activeProfile: NavProfileSummary | null;
  onSwitch: (profileId: string) => Promise<void>;
  collapsed?: boolean;
  disabled?: boolean;
}

export const ProfileSwitcher: React.FC<ProfileSwitcherProps> = ({
  profiles,
  activeProfile,
  onSwitch,
  collapsed = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = 'profile-switcher-list';

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleSwitch = useCallback(async (profileId: string) => {
    if (profileId === activeProfile?.id || switching) return;

    try {
      setSwitching(true);
      await onSwitch(profileId);
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to switch profile:', err);
    } finally {
      setSwitching(false);
    }
  }, [activeProfile?.id, switching, onSwitch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, profiles.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (profiles[highlightedIndex]) {
          handleSwitch(profiles[highlightedIndex].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
    }
  }, [isOpen, profiles, highlightedIndex, handleSwitch]);

  // Don't render if only one profile or collapsed
  if (profiles.length <= 1 || collapsed) {
    return null;
  }

  return (
    <div ref={dropdownRef} className="relative px-2 mb-2">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled || switching}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 min-h-[44px] text-foreground ${isOpen ? 'bg-muted' : 'bg-transparent hover:bg-muted'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-label={`Current profile: ${activeProfile?.name ?? 'None selected'}. Click to switch profiles.`}
      >
        <Layers
          className="h-4 w-4 flex-shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="flex-1 text-left truncate">
          {activeProfile?.name ?? 'Select Profile'}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform text-muted-foreground ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          id={listId}
          role="listbox"
          aria-label="Available profiles"
          aria-activedescendant={profiles[highlightedIndex] ? `profile-${profiles[highlightedIndex].id}` : undefined}
          className="absolute left-2 right-2 top-full mt-1 z-50 rounded-lg overflow-hidden bg-card border border-border shadow-lg"
        >
          <div className="py-1 max-h-64 overflow-y-auto">
            {profiles.map((profile, index) => {
              const isActive = profile.id === activeProfile?.id;
              const isHighlighted = index === highlightedIndex;

              return (
                <button
                  key={profile.id}
                  id={`profile-${profile.id}`}
                  onClick={() => handleSwitch(profile.id)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  disabled={switching || isActive}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors min-h-[44px] ${isActive ? 'bg-primary/10 text-primary' : isHighlighted ? 'bg-muted text-muted-foreground' : 'bg-transparent text-muted-foreground'} ${switching ? 'opacity-50' : ''}`}
                  role="option"
                  aria-selected={isActive}
                >
                  <span className="w-4 flex-shrink-0" aria-hidden="true">
                    {isActive && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </span>

                  <div className="flex-1 text-left min-w-0">
                    <div className={`font-medium truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>
                      {profile.name}
                    </div>
                    {profile.description && (
                      <div className="text-xs truncate text-muted-foreground">
                        {profile.description}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {profile.isDefault && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted text-muted-foreground">
                        Default
                      </span>
                    )}
                    {profile.isLocked && (
                      <Lock
                        className="h-3 w-3 text-muted-foreground"
                        aria-label="Locked profile"
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileSwitcher;
