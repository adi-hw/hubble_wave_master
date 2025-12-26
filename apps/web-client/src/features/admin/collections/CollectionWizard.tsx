import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  Upload,
  MessageSquare,
  Layout,
  Check,
  Shield,
  History,
  Layers,
  X,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { AVASuggestionPanel } from './components/AVASuggestionPanel';
import metadataApi from '../../../services/metadataApi';

type Step = 'source' | 'identity' | 'options';

interface WizardState {
  sourceType: 'scratch' | 'file' | 'table' | 'ava';
  sourceFile?: File;
  name: string;
  code: string;
  labelPlural: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  isExtensible: boolean;
  isAudited: boolean;
  isVersioned: boolean;
  storageTable: string;
}

const defaultState: WizardState = {
  sourceType: 'scratch',
  name: '', // Maps to label
  code: '',
  labelPlural: '',
  description: '',
  icon: 'Layers',
  color: '#4f46e5',
  category: '',
  isExtensible: true,
  isAudited: true,
  isVersioned: false,
  storageTable: '',
};

export const CollectionWizard: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('source');
  const [data, setData] = useState<WizardState>(defaultState);
  const [loading, setLoading] = useState(false);
  const [avaLoading, setAvaLoading] = useState(false);
  const [avaSuggestions, setAvaSuggestions] = useState<any[]>([]);

  // Simulation of AVA suggestions based on name input
  useEffect(() => {
    if (step === 'identity' && data.name.length > 2) {
      setAvaLoading(true);
      const timer = setTimeout(() => {
        // Mock AVA response
        const nameLower = data.name.toLowerCase();
        setAvaSuggestions([
          { field: 'code', value: nameLower.replace(/\s+/g, '_'), label: 'Code' },
          { field: 'labelPlural', value: `${data.name}s`, label: 'Plural Name' },
          { field: 'icon', value: 'Box', label: 'Icon' },
          { field: 'color', value: '#14b8a6', label: 'Color' },
          { field: 'category', value: 'General', label: 'Category' },
        ]);
        setAvaLoading(false);
      }, 800);
      return () => clearTimeout(timer);
    } else {
        setAvaSuggestions([]);
    }
  }, [step, data.name]);

  const updateData = (updates: Partial<WizardState>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const payload = {
        code: data.code,
        label: data.name,
        labelPlural: data.labelPlural,
        description: data.description,
        icon: data.icon,
        color: data.color,
        category: data.category,
        isExtensible: data.isExtensible,
        isAudited: data.isAudited,
        isVersioned: data.isVersioned,
        storageTable: data.storageTable || `u_${data.code}`,
      };
      
      const response = await metadataApi.post('/collections', payload);
      navigate(`/studio/collections/${response.data.id}`);
    } catch (error) {
      console.error('Failed to create collection:', error);
      // Handle error (toast or alert)
      alert('Failed to create collection. Please check the inputs.');
    } finally {
      setLoading(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-between px-12 mb-8 relative">
      <div className="absolute top-1/2 left-12 right-12 h-0.5 -z-10" style={{ backgroundColor: 'var(--border-default)' }} />

      {(['source', 'identity', 'options'] as Step[]).map((s, idx) => {
        const isActive = s === step;
        const isCompleted =
            (step === 'identity' && idx === 0) ||
            (step === 'options' && idx <= 1);

        return (
          <div key={s} className="flex flex-col items-center px-2" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center border-2 mb-2 transition-colors"
              style={{
                borderColor: isActive || isCompleted ? 'var(--color-primary-500)' : 'var(--border-default)',
                backgroundColor: isActive || isCompleted ? 'var(--bg-primary-subtle)' : 'transparent',
                color: isActive || isCompleted ? 'var(--color-primary-500)' : 'var(--text-muted)'
              }}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : idx + 1}
            </div>
            <span
              className="text-xs font-medium"
              style={{ color: isActive ? 'var(--color-primary-500)' : 'var(--text-secondary)' }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] p-6">
      <div
        className="w-full max-w-4xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)'
        }}
      >
        {/* Header */}
        <div
          className="p-6 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Create New Collection
            </h1>
            <button
              onClick={() => navigate('/studio/collections')}
              className="transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
                <X className="h-5 w-5" />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
            <StepIndicator />

            {step === 'source' && (
                <div className="space-y-4 max-w-2xl mx-auto">
                    <h2 className="text-lg font-medium text-center mb-6" style={{ color: 'var(--text-primary)' }}>How would you like to create your collection?</h2>

                    <button
                        onClick={() => { updateData({ sourceType: 'scratch' }); setStep('identity'); }}
                        className="card-interactive w-full flex items-center p-4 rounded-xl text-left group"
                    >
                        <div className="h-12 w-12 rounded-lg flex items-center justify-center mr-4" style={{ backgroundColor: 'var(--bg-primary-subtle)' }}>
                            <Layout className="h-6 w-6" style={{ color: 'var(--text-brand)' }} />
                        </div>
                        <div>
                            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Start from scratch</h3>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Define your collection structure manually</p>
                        </div>
                        <ArrowRight className="ml-auto h-5 w-5" style={{ color: 'var(--text-muted)' }} />
                    </button>

                    <button
                         className="card-interactive w-full flex items-center p-4 rounded-xl text-left group"
                         onClick={() => alert("File import coming soon!")}
                    >
                        <div className="h-12 w-12 rounded-lg flex items-center justify-center mr-4" style={{ backgroundColor: 'var(--bg-success-subtle)' }}>
                            <Upload className="h-6 w-6" style={{ color: 'var(--text-success)' }} />
                        </div>
                        <div>
                            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Import from file</h3>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Upload CSV, Excel, or JSON</p>
                        </div>
                        <ArrowRight className="ml-auto h-5 w-5" style={{ color: 'var(--text-muted)' }} />
                    </button>

                     <button
                         className="card-interactive w-full flex items-center p-4 rounded-xl text-left group"
                         onClick={() => { updateData({ sourceType: 'ava' }); setStep('identity'); }}
                    >
                        <div className="h-12 w-12 rounded-lg flex items-center justify-center mr-4" style={{ backgroundColor: 'var(--bg-accent-subtle)' }}>
                            <MessageSquare className="h-6 w-6" style={{ color: 'var(--text-accent)' }} />
                        </div>
                        <div>
                            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Ask AVA</h3>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Describe what you want to track</p>
                        </div>
                        <ArrowRight className="ml-auto h-5 w-5" style={{ color: 'var(--text-muted)' }} />
                    </button>
                </div>
            )}

            {step === 'identity' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <Input
                            label="Collection Name"
                            placeholder="e.g. Vendors"
                            value={data.name}
                            onChange={(e) => {
                                const val = e.target.value;
                                updateData({
                                    name: val,
                                    ...( !data.code || data.code === data.name.toLowerCase().replace(/\s+/g, '_').slice(0, val.length-1) ? {
                                        code: val.toLowerCase().replace(/[^a-z0-9_]/g, '_')
                                    } : {})
                                });
                            }}
                            autoFocus
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Code"
                                value={data.code}
                                onChange={(e) => updateData({ code: e.target.value })}
                                hint="Unique identifier used in API"
                            />
                            <Input
                                label="Plural Name"
                                value={data.labelPlural}
                                onChange={(e) => updateData({ labelPlural: e.target.value })}
                                placeholder="e.g. Vendors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>Description</label>
                            <textarea
                                className="input w-full resize-none"
                                rows={3}
                                value={data.description}
                                onChange={(e) => updateData({ description: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="lg:col-span-1">
                        <AVASuggestionPanel
                            suggestions={avaSuggestions}
                            loading={avaLoading}
                            onAccept={(s) => updateData({ [s.field]: s.value })}
                            onAcceptAll={() => {
                                const updates: any = {};
                                avaSuggestions.forEach(s => updates[s.field] = s.value);
                                updateData(updates);
                            }}
                        />
                    </div>
                </div>
            )}

            {step === 'options' && (
                <div className="max-w-2xl mx-auto space-y-6">
                    <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Collection Behavior</h3>

                     <label
                       className="flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-colors"
                       style={{ border: '1px solid var(--border-default)' }}
                       onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                       onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                     >
                        <input
                            type="checkbox"
                            className="mt-1"
                            checked={data.isExtensible}
                            onChange={(e) => updateData({ isExtensible: e.target.checked })}
                        />
                        <div>
                            <div className="font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <Layers className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                                Extensible
                            </div>
                            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Allow admins to add custom properties to this collection.</p>
                        </div>
                    </label>

                    <label
                       className="flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-colors"
                       style={{ border: '1px solid var(--border-default)' }}
                       onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                       onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <input
                            type="checkbox"
                            className="mt-1"
                            checked={data.isAudited}
                            onChange={(e) => updateData({ isAudited: e.target.checked })}
                        />
                        <div>
                            <div className="font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <Shield className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                                Audited
                            </div>
                            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Track all record changes in the compliance audit log. (Recommended)</p>
                        </div>
                    </label>

                    <label
                       className="flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-colors"
                       style={{ border: '1px solid var(--border-default)' }}
                       onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                       onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <input
                            type="checkbox"
                            className="mt-1"
                            checked={data.isVersioned}
                            onChange={(e) => updateData({ isVersioned: e.target.checked })}
                        />
                        <div>
                            <div className="font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <History className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                                Versioned
                            </div>
                            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Keep full history of record changes. Used for timeline views and rollback.</p>
                        </div>
                    </label>

                    <div className="pt-6 mt-6" style={{ borderTop: '1px solid var(--border-default)' }}>
                        <h4 className="font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Summary</h4>
                        <div className="rounded-lg p-4 text-sm space-y-2" style={{ backgroundColor: 'var(--bg-surface-secondary)' }}>
                            <div className="flex justify-between">
                                <span style={{ color: 'var(--text-secondary)' }}>Name:</span>
                                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{data.name}</span>
                            </div>
                             <div className="flex justify-between">
                                <span style={{ color: 'var(--text-secondary)' }}>Code:</span>
                                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{data.code}</span>
                            </div>
                             <div className="flex justify-between">
                                <span style={{ color: 'var(--text-secondary)' }}>Storage:</span>
                                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{data.storageTable || `u_${data.code}`}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Footer */}
        <div
          className="p-6 flex justify-between"
          style={{
            borderTop: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-surface-secondary)'
          }}
        >
            {step !== 'source' ? (
                <Button variant="ghost" onClick={() => setStep(step === 'options' ? 'identity' : 'source')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
            ) : (
                <div />
            )}

            {step === 'options' ? (
                <Button variant="primary" onClick={handleCreate} loading={loading}>
                    Create Collection
                </Button>
            ) : step !== 'source' ? (
                 <Button variant="primary" onClick={() => setStep('options')} disabled={!data.name || !data.code}>
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
            ) : null}
        </div>
      </div>
    </div>
  );
};

export default CollectionWizard;
