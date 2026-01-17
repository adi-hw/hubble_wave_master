import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useNavigate } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  Palette,
  Layout,
  Bell,
  Globe,
  Keyboard,
  Accessibility,
  Table2,
  Sparkles,
  RotateCcw,
  Check,
  ChevronRight,
  PanelLeft,
  PanelRight,
  AlignJustify,
  AlignLeft,
  AlignCenter,
  Loader2,
  Shield,
  User,
  LucideIcon,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type SettingsSection = 'layout' | 'locale' | 'notifications' | 'accessibility' | 'keyboard' | 'tables' | 'ava';

interface SectionConfig {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  description: string;
}

// ============================================================================
// Section Configuration
// ============================================================================

const sections: SectionConfig[] = [
  { id: 'layout', label: 'Layout', icon: Layout, description: 'Sidebar, density, and display options' },
  { id: 'locale', label: 'Language & Region', icon: Globe, description: 'Date, time, and number formats' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Email, in-app, and push notifications' },
  { id: 'accessibility', label: 'Accessibility', icon: Accessibility, description: 'Motion, contrast, and screen reader' },
  { id: 'keyboard', label: 'Keyboard Shortcuts', icon: Keyboard, description: 'Customize keyboard shortcuts' },
  { id: 'tables', label: 'Tables & Lists', icon: Table2, description: 'Default page size and display options' },
  { id: 'ava', label: 'AVA Assistant', icon: Sparkles, description: 'AI assistant preferences' },
];

// ============================================================================
// Components
// ============================================================================

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleSwitch({ checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`toggle-track h-6 w-11 ${
        checked ? 'toggle-track-on' : ''
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`toggle-thumb inline-block h-4 w-4 transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

interface OptionCardProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description?: string;
}

function OptionCard({ selected, onClick, icon, label, description }: OptionCardProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center p-4 rounded-xl transition-all text-center border-2 ${
        selected
          ? 'bg-primary/15 border-primary'
          : 'bg-muted border-border hover:border-primary/50'
      }`}
    >
      <div className={`mb-2 ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
        {icon}
      </div>
      <span className="text-sm font-medium text-foreground">
        {label}
      </span>
      {description && (
        <span className="text-xs mt-1 text-muted-foreground">
          {description}
        </span>
      )}
      {selected && (
        <Check size={14} className="mt-2 text-success-text" />
      )}
    </button>
  );
}

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-b-0">
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground">
          {label}
        </div>
        {description && (
          <div className="text-xs mt-0.5 text-muted-foreground">
            {description}
          </div>
        )}
      </div>
      <div className="ml-4">{children}</div>
    </div>
  );
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function Select({ value, onChange, options }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="settings-select px-3 py-1.5 rounded-lg text-sm appearance-none cursor-pointer bg-card border border-border text-foreground pr-8 bg-no-repeat bg-[position:right_8px_center] bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2716%27%20height%3D%2716%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27%23888%27%20stroke-width%3D%272%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%3E%3Cpolyline%20points%3D%276%209%2012%2015%2018%209%27%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')]"
    >
      {options.map((opt) => (
        <option
          key={opt.value}
          value={opt.value}
          className="bg-card text-foreground"
        >
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SettingsPage() {
  const navigate = useNavigate();
  const {
    preferences,
    loading,
    patchPreferences,
    resetPreferences,
    setDensityMode,
    setSidebarPosition,
  } = useUserPreferences();

  const [activeSection, setActiveSection] = useState<SettingsSection>('layout');
  const [saved, setSaved] = useState(false);

  // Handle save with feedback
  const handleSave = async (updates: Record<string, unknown>) => {
    try {
      await patchPreferences(updates);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 size={32} className="mx-auto mb-3 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between shrink-0 border-b border-border">
        <div className="flex items-center gap-3">
          <SettingsIcon size={24} className="text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
            <p className="text-xs mt-0.5 text-muted-foreground">
              Customize your HubbleWave experience
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => resetPreferences()}>
            <RotateCcw size={12} />
            Reset All
          </Button>
          {saved && (
            <span className="text-xs flex items-center gap-1 text-success-text">
              <Check size={12} /> Saved
            </span>
          )}
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <nav className="w-64 p-4 shrink-0 overflow-y-auto border-r border-border">
          {/* Account Section */}
          <div className="mb-4">
            <span className="text-xs font-medium uppercase tracking-wider px-3 text-muted-foreground">
              Account
            </span>
            <div className="mt-2 space-y-1">
              {/* Profile Link */}
              <button
                onClick={() => navigate('/settings/profile')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-muted"
              >
                <User size={18} className="text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    Your Profile
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Personal information
                  </div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground" />
              </button>

              {/* Security Link */}
              <button
                onClick={() => navigate('/settings/security')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-muted"
              >
                <Shield size={18} className="text-success-text" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    Security
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Password & sessions
                  </div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground" />
              </button>

              {/* Theme Customizer Link */}
              <button
                onClick={() => navigate('/settings/themes')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-muted"
              >
                <Palette size={18} className="text-purple-500" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    Theme Customizer
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Advanced theme options
                  </div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Preferences Section */}
          <div className="pt-4 border-t border-border">
            <span className="text-xs font-medium uppercase tracking-wider px-3 text-muted-foreground">
              Preferences
            </span>
            <div className="mt-2 space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      isActive ? 'bg-muted' : 'hover:bg-muted/50'
                    }`}
                  >
                    <Icon
                      size={18}
                      className={isActive ? 'text-primary' : 'text-muted-foreground'}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-medium truncate ${
                          isActive ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {section.label}
                      </div>
                      <div className="text-xs truncate text-muted-foreground">
                        {section.description}
                      </div>
                    </div>
                    {isActive && <ChevronRight size={14} className="text-muted-foreground" />}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Content Panel */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-2xl">
            {/* Layout Section */}
            {activeSection === 'layout' && (
              <div>
                <h2 className="text-lg font-semibold mb-6 text-foreground">
                  Layout
                </h2>

                {/* Density Mode */}
                <div className="mb-8">
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                    Density Mode
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <OptionCard
                      selected={preferences?.densityMode === 'compact'}
                      onClick={() => setDensityMode('compact')}
                      icon={<AlignJustify size={24} />}
                      label="Compact"
                      description="More content"
                    />
                    <OptionCard
                      selected={preferences?.densityMode === 'comfortable'}
                      onClick={() => setDensityMode('comfortable')}
                      icon={<AlignLeft size={24} />}
                      label="Comfortable"
                      description="Balanced"
                    />
                    <OptionCard
                      selected={preferences?.densityMode === 'spacious'}
                      onClick={() => setDensityMode('spacious')}
                      icon={<AlignCenter size={24} />}
                      label="Spacious"
                      description="More breathing room"
                    />
                  </div>
                </div>

                {/* Sidebar Position */}
                <div className="mb-8">
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                    Sidebar Position
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <OptionCard
                      selected={preferences?.sidebarPosition === 'left'}
                      onClick={() => setSidebarPosition('left')}
                      icon={<PanelLeft size={24} />}
                      label="Left"
                    />
                    <OptionCard
                      selected={preferences?.sidebarPosition === 'right'}
                      onClick={() => setSidebarPosition('right')}
                      icon={<PanelRight size={24} />}
                      label="Right"
                    />
                  </div>
                </div>

                {/* Layout Settings */}
                <div>
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                    Display Options
                  </h3>
                  <div className="rounded-xl p-4 bg-card border border-border">
                    <SettingRow label="Show Breadcrumbs" description="Display navigation breadcrumbs">
                      <ToggleSwitch
                        checked={preferences?.showBreadcrumbs ?? true}
                        onChange={(checked) => handleSave({ showBreadcrumbs: checked })}
                      />
                    </SettingRow>
                    <SettingRow label="Show Footer" description="Display page footer">
                      <ToggleSwitch
                        checked={preferences?.showFooter ?? true}
                        onChange={(checked) => handleSave({ showFooter: checked })}
                      />
                    </SettingRow>
                    <SettingRow label="Content Width">
                      <Select
                        value={preferences?.contentWidth ?? 'full'}
                        onChange={(value) => handleSave({ contentWidth: value })}
                        options={[
                          { value: 'full', label: 'Full Width' },
                          { value: 'wide', label: 'Wide' },
                          { value: 'narrow', label: 'Narrow' },
                        ]}
                      />
                    </SettingRow>
                  </div>
                </div>
              </div>
            )}

            {/* Locale Section */}
            {activeSection === 'locale' && (
              <div>
                <h2 className="text-lg font-semibold mb-6 text-foreground">
                  Language & Region
                </h2>

                <div className="rounded-xl p-4 bg-card border border-border">
                  <SettingRow label="Language">
                    <Select
                      value={preferences?.language ?? 'en'}
                      onChange={(value) => handleSave({ language: value })}
                      options={[
                        { value: 'en', label: 'English' },
                        { value: 'es', label: 'Espanol' },
                        { value: 'fr', label: 'Francais' },
                        { value: 'de', label: 'Deutsch' },
                        { value: 'pt', label: 'Portugues' },
                        { value: 'zh', label: 'Chinese' },
                        { value: 'ja', label: 'Japanese' },
                      ]}
                    />
                  </SettingRow>
                  <SettingRow label="Date Format">
                    <Select
                      value={preferences?.dateFormat ?? 'MM/DD/YYYY'}
                      onChange={(value) => handleSave({ dateFormat: value })}
                      options={[
                        { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                        { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                        { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                        { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY' },
                      ]}
                    />
                  </SettingRow>
                  <SettingRow label="Time Format">
                    <Select
                      value={preferences?.timeFormat ?? '12h'}
                      onChange={(value) => handleSave({ timeFormat: value })}
                      options={[
                        { value: '12h', label: '12-hour (AM/PM)' },
                        { value: '24h', label: '24-hour' },
                      ]}
                    />
                  </SettingRow>
                  <SettingRow label="Start of Week">
                    <Select
                      value={preferences?.startOfWeek ?? 'sunday'}
                      onChange={(value) => handleSave({ startOfWeek: value })}
                      options={[
                        { value: 'sunday', label: 'Sunday' },
                        { value: 'monday', label: 'Monday' },
                        { value: 'saturday', label: 'Saturday' },
                      ]}
                    />
                  </SettingRow>
                </div>
              </div>
            )}

            {/* Notifications Section */}
            {activeSection === 'notifications' && (
              <div>
                <h2 className="text-lg font-semibold mb-6 text-foreground">
                  Notifications
                </h2>

                {/* Email Notifications */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                    Email Notifications
                  </h3>
                  <div className="rounded-xl p-4 bg-card border border-border">
                    <SettingRow label="Enable Email Notifications">
                      <ToggleSwitch
                        checked={preferences?.notificationPreferences?.email?.enabled ?? true}
                        onChange={(checked) =>
                          handleSave({
                            notificationPreferences: {
                              ...preferences?.notificationPreferences,
                              email: { ...preferences?.notificationPreferences?.email, enabled: checked },
                            },
                          })
                        }
                      />
                    </SettingRow>
                    <SettingRow label="Email Frequency">
                      <Select
                        value={preferences?.notificationPreferences?.email?.frequency ?? 'daily'}
                        onChange={(value) =>
                          handleSave({
                            notificationPreferences: {
                              ...preferences?.notificationPreferences,
                              email: { ...preferences?.notificationPreferences?.email, frequency: value },
                            },
                          })
                        }
                        options={[
                          { value: 'realtime', label: 'Real-time' },
                          { value: 'hourly', label: 'Hourly digest' },
                          { value: 'daily', label: 'Daily digest' },
                          { value: 'weekly', label: 'Weekly digest' },
                          { value: 'never', label: 'Never' },
                        ]}
                      />
                    </SettingRow>
                  </div>
                </div>

                {/* In-App Notifications */}
                <div>
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                    In-App Notifications
                  </h3>
                  <div className="rounded-xl p-4 bg-card border border-border">
                    <SettingRow label="Enable In-App Notifications">
                      <ToggleSwitch
                        checked={preferences?.notificationPreferences?.inApp?.enabled ?? true}
                        onChange={(checked) =>
                          handleSave({
                            notificationPreferences: {
                              ...preferences?.notificationPreferences,
                              inApp: { ...preferences?.notificationPreferences?.inApp, enabled: checked },
                            },
                          })
                        }
                      />
                    </SettingRow>
                    <SettingRow label="Sound" description="Play sound for notifications">
                      <ToggleSwitch
                        checked={preferences?.notificationPreferences?.inApp?.sound ?? true}
                        onChange={(checked) =>
                          handleSave({
                            notificationPreferences: {
                              ...preferences?.notificationPreferences,
                              inApp: { ...preferences?.notificationPreferences?.inApp, sound: checked },
                            },
                          })
                        }
                      />
                    </SettingRow>
                    <SettingRow label="Show Preview" description="Show notification content preview">
                      <ToggleSwitch
                        checked={preferences?.notificationPreferences?.inApp?.showPreview ?? true}
                        onChange={(checked) =>
                          handleSave({
                            notificationPreferences: {
                              ...preferences?.notificationPreferences,
                              inApp: { ...preferences?.notificationPreferences?.inApp, showPreview: checked },
                            },
                          })
                        }
                      />
                    </SettingRow>
                  </div>
                </div>
              </div>
            )}

            {/* Accessibility Section */}
            {activeSection === 'accessibility' && (
              <div>
                <h2 className="text-lg font-semibold mb-6 text-foreground">
                  Accessibility
                </h2>

                <div className="rounded-xl p-4 bg-card border border-border">
                  <SettingRow label="Reduce Motion" description="Minimize animations">
                    <ToggleSwitch
                      checked={preferences?.accessibility?.reduceMotion ?? false}
                      onChange={(checked) =>
                        handleSave({
                          accessibility: { ...preferences?.accessibility, reduceMotion: checked },
                        })
                      }
                    />
                  </SettingRow>
                  <SettingRow label="High Contrast" description="Increase color contrast">
                    <ToggleSwitch
                      checked={preferences?.accessibility?.highContrast ?? false}
                      onChange={(checked) =>
                        handleSave({
                          accessibility: { ...preferences?.accessibility, highContrast: checked },
                        })
                      }
                    />
                  </SettingRow>
                  <SettingRow label="Large Text" description="Increase text size">
                    <ToggleSwitch
                      checked={preferences?.accessibility?.largeText ?? false}
                      onChange={(checked) =>
                        handleSave({
                          accessibility: { ...preferences?.accessibility, largeText: checked },
                        })
                      }
                    />
                  </SettingRow>
                  <SettingRow label="Keyboard Navigation" description="Enhanced keyboard support">
                    <ToggleSwitch
                      checked={preferences?.accessibility?.keyboardNavigation ?? true}
                      onChange={(checked) =>
                        handleSave({
                          accessibility: { ...preferences?.accessibility, keyboardNavigation: checked },
                        })
                      }
                    />
                  </SettingRow>
                  <SettingRow label="Focus Indicators" description="Show focus outlines">
                    <ToggleSwitch
                      checked={preferences?.accessibility?.focusIndicators ?? true}
                      onChange={(checked) =>
                        handleSave({
                          accessibility: { ...preferences?.accessibility, focusIndicators: checked },
                        })
                      }
                    />
                  </SettingRow>
                </div>
              </div>
            )}

            {/* Keyboard Shortcuts Section */}
            {activeSection === 'keyboard' && (
              <div>
                <h2 className="text-lg font-semibold mb-6 text-foreground">
                  Keyboard Shortcuts
                </h2>

                <div className="rounded-xl p-4 bg-card border border-border">
                  <SettingRow label="Enable Keyboard Shortcuts" description="Use keyboard shortcuts throughout the app">
                    <ToggleSwitch
                      checked={preferences?.keyboardShortcutsEnabled ?? true}
                      onChange={(checked) => handleSave({ keyboardShortcutsEnabled: checked })}
                    />
                  </SettingRow>
                </div>

                <div className="mt-6 text-sm text-muted-foreground">
                  <p>Common shortcuts:</p>
                  <ul className="mt-2 space-y-1">
                    <li><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Ctrl+K</kbd> Open command palette</li>
                    <li><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Ctrl+/</kbd> Toggle sidebar</li>
                    <li><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Esc</kbd> Close modals</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Tables Section */}
            {activeSection === 'tables' && (
              <div>
                <h2 className="text-lg font-semibold mb-6 text-foreground">
                  Tables & Lists
                </h2>

                <div className="rounded-xl p-4 bg-card border border-border">
                  <SettingRow label="Default Page Size">
                    <Select
                      value={String(preferences?.tablePreferences?.defaultPageSize ?? 25)}
                      onChange={(value) =>
                        handleSave({
                          tablePreferences: { ...preferences?.tablePreferences, defaultPageSize: parseInt(value) },
                        })
                      }
                      options={[
                        { value: '10', label: '10 rows' },
                        { value: '25', label: '25 rows' },
                        { value: '50', label: '50 rows' },
                        { value: '100', label: '100 rows' },
                      ]}
                    />
                  </SettingRow>
                  <SettingRow label="Show Row Numbers">
                    <ToggleSwitch
                      checked={preferences?.tablePreferences?.showRowNumbers ?? false}
                      onChange={(checked) =>
                        handleSave({
                          tablePreferences: { ...preferences?.tablePreferences, showRowNumbers: checked },
                        })
                      }
                    />
                  </SettingRow>
                  <SettingRow label="Sticky Header" description="Keep header visible while scrolling">
                    <ToggleSwitch
                      checked={preferences?.tablePreferences?.stickyHeader ?? true}
                      onChange={(checked) =>
                        handleSave({
                          tablePreferences: { ...preferences?.tablePreferences, stickyHeader: checked },
                        })
                      }
                    />
                  </SettingRow>
                  <SettingRow label="Alternate Row Colors" description="Zebra striping for rows">
                    <ToggleSwitch
                      checked={preferences?.tablePreferences?.alternateRowColors ?? false}
                      onChange={(checked) =>
                        handleSave({
                          tablePreferences: { ...preferences?.tablePreferences, alternateRowColors: checked },
                        })
                      }
                    />
                  </SettingRow>
                </div>
              </div>
            )}

            {/* AVA Section */}
            {activeSection === 'ava' && (
              <div>
                <h2 className="text-lg font-semibold mb-6 text-foreground">
                  AVA Assistant
                </h2>

                <div className="rounded-xl p-4 bg-card border border-border">
                  <SettingRow label="Enable AVA" description="AI-powered assistant">
                    <ToggleSwitch
                      checked={preferences?.avaEnabled ?? true}
                      onChange={(checked) => handleSave({ avaEnabled: checked })}
                    />
                  </SettingRow>
                  <SettingRow label="Auto-suggest" description="Show smart suggestions">
                    <ToggleSwitch
                      checked={preferences?.avaAutoSuggest ?? true}
                      onChange={(checked) => handleSave({ avaAutoSuggest: checked })}
                    />
                  </SettingRow>
                  <SettingRow label="Voice Input" description="Enable voice commands">
                    <ToggleSwitch
                      checked={preferences?.avaVoiceEnabled ?? false}
                      onChange={(checked) => handleSave({ avaVoiceEnabled: checked })}
                    />
                  </SettingRow>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
