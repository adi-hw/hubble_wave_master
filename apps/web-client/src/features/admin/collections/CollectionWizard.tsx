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
      <div className="absolute top-1/2 left-12 right-12 h-0.5 -z-10 bg-border" />

      {(['source', 'identity', 'options'] as Step[]).map((s, idx) => {
        const isActive = s === step;
        const isCompleted =
            (step === 'identity' && idx === 0) ||
            (step === 'options' && idx <= 1);

        return (
          <div key={s} className="flex flex-col items-center px-2 bg-card">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 mb-2 transition-colors ${
                isActive || isCompleted
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-transparent text-muted-foreground'
              }`}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : idx + 1}
            </div>
            <span
              className={`text-xs font-medium ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
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
        className="w-full max-w-4xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] bg-card border border-border"
      >
        {/* Header */}
        <div
          className="p-6 flex items-center justify-between border-b border-border"
        >
            <h1 className="text-xl font-semibold text-foreground">
                Create New Collection
            </h1>
            <button
              onClick={() => navigate('/collections.list')}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
                <X className="h-5 w-5" />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
            <StepIndicator />

            {step === 'source' && (
                <div className="space-y-4 max-w-2xl mx-auto">
                    <h2 className="text-lg font-medium text-center mb-6 text-foreground">How would you like to create your collection?</h2>

                    <button
                        onClick={() => { updateData({ sourceType: 'scratch' }); setStep('identity'); }}
                        className="card-interactive w-full flex items-center p-4 rounded-xl text-left group"
                    >
                        <div className="h-12 w-12 rounded-lg flex items-center justify-center mr-4 bg-primary/10">
                            <Layout className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">Start from scratch</h3>
                            <p className="text-sm text-muted-foreground">Define your collection structure manually</p>
                        </div>
                        <ArrowRight className="ml-auto h-5 w-5 text-muted-foreground" />
                    </button>

                    <button
                         className="card-interactive w-full flex items-center p-4 rounded-xl text-left group"
                         onClick={() => alert("File import coming soon!")}
                    >
                        <div className="h-12 w-12 rounded-lg flex items-center justify-center mr-4 bg-success-subtle">
                            <Upload className="h-6 w-6 text-success-text" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">Import from file</h3>
                            <p className="text-sm text-muted-foreground">Upload CSV, Excel, or JSON</p>
                        </div>
                        <ArrowRight className="ml-auto h-5 w-5 text-muted-foreground" />
                    </button>

                     <button
                         className="card-interactive w-full flex items-center p-4 rounded-xl text-left group"
                         onClick={() => { updateData({ sourceType: 'ava' }); setStep('identity'); }}
                    >
                        <div className="h-12 w-12 rounded-lg flex items-center justify-center mr-4 bg-accent/10">
                            <MessageSquare className="h-6 w-6 text-accent-foreground" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">Ask AVA</h3>
                            <p className="text-sm text-muted-foreground">Describe what you want to track</p>
                        </div>
                        <ArrowRight className="ml-auto h-5 w-5 text-muted-foreground" />
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
                            <label className="block text-sm font-medium mb-1.5 text-foreground">Description</label>
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
                    <h3 className="text-lg font-medium text-foreground">Collection Behavior</h3>

                     <label
                       className="flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-colors border border-border hover:bg-muted"
                     >
                        <input
                            type="checkbox"
                            className="mt-1"
                            checked={data.isExtensible}
                            onChange={(e) => updateData({ isExtensible: e.target.checked })}
                        />
                        <div>
                            <div className="font-medium flex items-center gap-2 text-foreground">
                                <Layers className="h-4 w-4 text-muted-foreground" />
                                Extensible
                            </div>
                            <p className="text-sm mt-1 text-muted-foreground">Allow admins to add custom properties to this collection.</p>
                        </div>
                    </label>

                    <label
                       className="flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-colors border border-border hover:bg-muted"
                    >
                        <input
                            type="checkbox"
                            className="mt-1"
                            checked={data.isAudited}
                            onChange={(e) => updateData({ isAudited: e.target.checked })}
                        />
                        <div>
                            <div className="font-medium flex items-center gap-2 text-foreground">
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                Audited
                            </div>
                            <p className="text-sm mt-1 text-muted-foreground">Track all record changes in the compliance audit log. (Recommended)</p>
                        </div>
                    </label>

                    <label
                       className="flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-colors border border-border hover:bg-muted"
                    >
                        <input
                            type="checkbox"
                            className="mt-1"
                            checked={data.isVersioned}
                            onChange={(e) => updateData({ isVersioned: e.target.checked })}
                        />
                        <div>
                            <div className="font-medium flex items-center gap-2 text-foreground">
                                <History className="h-4 w-4 text-muted-foreground" />
                                Versioned
                            </div>
                            <p className="text-sm mt-1 text-muted-foreground">Keep full history of record changes. Used for timeline views and rollback.</p>
                        </div>
                    </label>

                    <div className="pt-6 mt-6 border-t border-border">
                        <h4 className="font-medium mb-4 text-foreground">Summary</h4>
                        <div className="rounded-lg p-4 text-sm space-y-2 bg-muted">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Name:</span>
                                <span className="font-medium text-foreground">{data.name}</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-muted-foreground">Code:</span>
                                <span className="font-mono text-foreground">{data.code}</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-muted-foreground">Storage:</span>
                                <span className="font-mono text-foreground">{data.storageTable || `u_${data.code}`}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Footer */}
        <div
          className="p-6 flex justify-between border-t border-border bg-muted"
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
