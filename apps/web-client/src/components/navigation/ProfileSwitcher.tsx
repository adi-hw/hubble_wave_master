/**
 * ProfileSwitcher Component
 *
 * Dropdown to switch between navigation profiles.
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Lock, Layers } from 'lucide-react';
import { NavProfileSummary } from '../../types/navigation-v2';

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
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleSwitch = async (profileId: string) => {
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
  };

  // Don't render if only one profile or collapsed
  if (profiles.length <= 1 || collapsed) {
    return null;
  }

  return (
    <div ref={dropdownRef} className="relative px-2 mb-2">
      {/* Trigger Button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || switching}
        className={`
          w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
          transition-colors duration-150
          ${disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-slate-100 cursor-pointer'
          }
          ${isOpen ? 'bg-slate-100' : ''}
        `}
        style={{ color: 'var(--text-primary)' }}
      >
        <Layers className="h-4 w-4 text-slate-400 flex-shrink-0" />
        <span className="flex-1 text-left truncate">
          {activeProfile?.name ?? 'Select Profile'}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute left-2 right-2 top-full mt-1 z-50 rounded-lg shadow-lg border overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-default)',
          }}
        >
          <div className="py-1 max-h-64 overflow-y-auto">
            {profiles.map((profile) => {
              const isActive = profile.id === activeProfile?.id;

              return (
                <button
                  key={profile.id}
                  onClick={() => handleSwitch(profile.id)}
                  disabled={switching || isActive}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors
                    ${isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'hover:bg-slate-50 text-slate-700'
                    }
                    ${switching ? 'opacity-50' : ''}
                  `}
                >
                  {/* Check mark for active */}
                  <span className="w-4 flex-shrink-0">
                    {isActive && <Check className="h-4 w-4 text-primary-600" />}
                  </span>

                  {/* Profile info */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium truncate">{profile.name}</div>
                    {profile.description && (
                      <div className="text-xs text-slate-500 truncate">
                        {profile.description}
                      </div>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {profile.isDefault && (
                      <span
                        className="px-1.5 py-0.5 text-[10px] font-medium rounded"
                        style={{
                          backgroundColor: 'var(--bg-surface-secondary)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Default
                      </span>
                    )}
                    {profile.isLocked && (
                      <Lock className="h-3 w-3 text-slate-400" />
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
