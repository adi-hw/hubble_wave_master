import { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle } from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi, GlobalSettings } from '../services/api';

type SettingsForm = Pick<
  GlobalSettings,
  'platformName' | 'maintenanceMode' | 'publicSignup' | 'defaultTrialDays' | 'supportEmail'
>;

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  color?: string;
}

function ToggleSwitch({ checked, onChange, label, description, color }: ToggleSwitchProps) {
  const activeColor = color || colors.success.base;
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors mt-0.5"
        style={{
          backgroundColor: checked ? activeColor : colors.glass.medium,
        }}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
      <div>
        <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
          {label}
        </span>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: colors.text.secondary }}>
            {description}
          </p>
        )}
      </div>
    </label>
  );
}

export function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<SettingsForm | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setFetching(true);
        const data = await controlPlaneApi.getGlobalSettings();
        setSettings({
          platformName: data.platformName,
          maintenanceMode: data.maintenanceMode,
          publicSignup: data.publicSignup,
          defaultTrialDays: data.defaultTrialDays,
          supportEmail: data.supportEmail,
        });
        setError(null);
      } catch (err) {
        console.error('Failed to load settings:', err);
        setError('Failed to load settings.');
      } finally {
        setFetching(false);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setLoading(true);
    setSaved(false);
    try {
      await controlPlaneApi.updateGlobalSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>
          Platform Settings
        </h1>
      </div>

      {error && (
        <div
          className="flex items-center gap-3 p-4 rounded-2xl mb-6"
          style={{
            backgroundColor: colors.danger.glow,
            border: `1px solid ${colors.danger.base}`,
            color: colors.danger.base,
          }}
        >
          {error}
        </div>
      )}

      {saved && (
        <div
          className="flex items-center gap-3 p-4 rounded-2xl mb-6"
          style={{
            backgroundColor: colors.success.glow,
            border: `1px solid ${colors.success.base}`,
          }}
        >
          <CheckCircle size={18} style={{ color: colors.success.base }} />
          <span className="text-sm" style={{ color: colors.success.base }}>
            Settings saved successfully.
          </span>
        </div>
      )}

      <div
        className="p-6 rounded-2xl border"
        style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
      >
        {fetching || !settings ? (
          <div className="flex items-center gap-3" style={{ color: colors.text.secondary }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading settings...
          </div>
        ) : (
        <>
        {/* General Configuration */}
        <h2 className="text-base font-semibold mb-4" style={{ color: colors.text.primary }}>
          General Configuration
        </h2>
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              Platform Name
            </label>
            <input
              type="text"
              value={settings.platformName}
              onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
              style={{
                backgroundColor: colors.glass.medium,
                borderColor: colors.glass.border,
                color: colors.text.primary,
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = colors.brand.primary)}
              onBlur={(e) => (e.currentTarget.style.borderColor = colors.glass.border)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              Support Email
            </label>
            <input
              type="email"
              value={settings.supportEmail}
              onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
              style={{
                backgroundColor: colors.glass.medium,
                borderColor: colors.glass.border,
                color: colors.text.primary,
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = colors.brand.primary)}
              onBlur={(e) => (e.currentTarget.style.borderColor = colors.glass.border)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              Default Trial Duration (Days)
            </label>
            <input
              type="number"
              value={settings.defaultTrialDays}
              onChange={(e) => setSettings({ ...settings, defaultTrialDays: Number(e.target.value) })}
              className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
              style={{
                backgroundColor: colors.glass.medium,
                borderColor: colors.glass.border,
                color: colors.text.primary,
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = colors.brand.primary)}
              onBlur={(e) => (e.currentTarget.style.borderColor = colors.glass.border)}
            />
          </div>
        </div>

        <hr className="my-6" style={{ borderColor: colors.glass.border }} />

        {/* Access & Availability */}
        <h2 className="text-base font-semibold mb-4" style={{ color: colors.text.primary }}>
          Access & Availability
        </h2>
        <div className="space-y-4">
          <ToggleSwitch
            checked={settings.publicSignup}
            onChange={(checked) => setSettings({ ...settings, publicSignup: checked })}
            label="Allow Public Signups"
          />
          <ToggleSwitch
            checked={settings.maintenanceMode}
            onChange={(checked) => setSettings({ ...settings, maintenanceMode: checked })}
            label="Maintenance Mode"
            description="Only admins can access the platform when enabled."
            color={colors.danger.base}
          />
        </div>

        <div className="flex justify-end mt-8">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || fetching}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-opacity disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
            }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

export default SettingsPage;
