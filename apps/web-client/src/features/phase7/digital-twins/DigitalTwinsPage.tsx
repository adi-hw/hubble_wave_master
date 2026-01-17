import { useState, useEffect } from 'react';
import {
  Box,
  Plus,
  RefreshCw,
  Trash2,
  Settings,
  Activity,
  Thermometer,
  Gauge,
  Zap,
  Radio,
} from 'lucide-react';
import {
  digitalTwinsApi,
  DigitalTwin,
  SensorReading,
} from '../../../services/phase7Api';

const statusStyles = {
  active: { bg: 'bg-success-subtle', text: 'text-success-text', dot: 'bg-success' },
  inactive: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  error: { bg: 'bg-danger-subtle', text: 'text-danger-text', dot: 'bg-danger' },
};

const sensorIcons: Record<string, React.ElementType> = {
  temperature: Thermometer,
  pressure: Gauge,
  power: Zap,
  vibration: Activity,
  default: Radio,
};

export const DigitalTwinsPage: React.FC = () => {
  const [twins, setTwins] = useState<DigitalTwin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTwin, setSelectedTwin] = useState<DigitalTwin | null>(null);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [readingsLoading, setReadingsLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTwin, setNewTwin] = useState({ name: '', description: '', assetId: '', assetType: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadTwins();
  }, []);

  useEffect(() => {
    if (selectedTwin) {
      loadReadings(selectedTwin.id);
    }
  }, [selectedTwin]);

  const loadTwins = async () => {
    try {
      const response = await digitalTwinsApi.listTwins();
      const twinsList = response?.twins ?? [];
      setTwins(twinsList);
      if (twinsList.length > 0 && !selectedTwin) {
        setSelectedTwin(twinsList[0]);
      }
    } catch (error) {
      console.error('Failed to load twins:', error);
      setTwins([]);
    } finally {
      setLoading(false);
    }
  };

  const loadReadings = async (twinId: string) => {
    setReadingsLoading(true);
    try {
      const response = await digitalTwinsApi.getReadings(twinId, {
        from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      });
      setReadings(response?.readings ?? []);
    } catch (error) {
      console.error('Failed to load readings:', error);
      setReadings([]);
    } finally {
      setReadingsLoading(false);
    }
  };

  const handleCreateTwin = async () => {
    if (!newTwin.name.trim() || !newTwin.assetId.trim() || !newTwin.assetType.trim()) return;

    setCreating(true);
    try {
      await digitalTwinsApi.createTwin({
        name: newTwin.name,
        description: newTwin.description,
        assetId: newTwin.assetId,
        assetType: newTwin.assetType,
        status: 'active',
      });
      setCreateModalOpen(false);
      setNewTwin({ name: '', description: '', assetId: '', assetType: '' });
      loadTwins();
    } catch (error) {
      console.error('Failed to create twin:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTwin = async (id: string) => {
    try {
      await digitalTwinsApi.deleteTwin(id);
      if (selectedTwin?.id === id) {
        setSelectedTwin(null);
      }
      loadTwins();
    } catch (error) {
      console.error('Failed to delete twin:', error);
    }
  };

  const handleRefreshState = async () => {
    if (!selectedTwin) return;
    try {
      const response = await digitalTwinsApi.getCurrentState(selectedTwin.id);
      setSelectedTwin({ ...selectedTwin, currentState: response.state });
    } catch (error) {
      console.error('Failed to refresh state:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 rounded bg-muted" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 rounded-xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Digital Twins
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time digital representations of physical assets
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create Twin
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Twins List */}
        <div className="w-80 shrink-0 overflow-auto space-y-3">
          {twins.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <Box className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground">
                No digital twins
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Create your first digital twin
              </p>
            </div>
          ) : (
            twins.map((twin) => {
              const status = statusStyles[twin.status];
              const isSelected = selectedTwin?.id === twin.id;

              return (
                <div
                  key={twin.id}
                  onClick={() => setSelectedTwin(twin)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all bg-card hover:border-primary/50 ${
                    isSelected ? 'ring-2 ring-offset-2 ring-blue-500 border-primary' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Box className="h-5 w-5 text-primary" />
                      <h3 className="font-medium text-foreground">
                        {twin.name}
                      </h3>
                    </div>
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${status.bg} ${status.text}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                      {twin.status}
                    </span>
                  </div>
                  {twin.description && (
                    <p className="text-sm mb-2 line-clamp-2 text-muted-foreground">
                      {twin.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{twin.assetType}</span>
                    <span>{twin.sensorMappings?.length || 0} sensors</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail Panel */}
        <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden flex flex-col">
          {selectedTwin ? (
            <>
              {/* Header */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {selectedTwin.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Asset ID: {selectedTwin.assetId}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRefreshState}
                    className="p-2 rounded-lg transition-colors bg-muted hover:bg-muted/80"
                    title="Refresh state"
                  >
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    className="p-2 rounded-lg transition-colors bg-muted hover:bg-muted/80"
                    title="Settings"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleDeleteTwin(selectedTwin.id)}
                    className="p-2 rounded-lg transition-colors bg-muted hover:bg-danger-subtle"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-danger-text" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-6 space-y-6">
                {/* Current State */}
                <div>
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                    Current State
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedTwin.currentState && Object.entries(selectedTwin.currentState).map(([key, value]) => (
                      <div
                        key={key}
                        className="p-4 rounded-xl bg-background"
                      >
                        <p className="text-xs uppercase tracking-wider mb-1 text-muted-foreground">
                          {key.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xl font-semibold text-foreground">
                          {typeof value === 'number' ? value.toFixed(2) : String(value)}
                        </p>
                      </div>
                    ))}
                    {(!selectedTwin.currentState || Object.keys(selectedTwin.currentState).length === 0) && (
                      <div className="col-span-4 text-center py-8">
                        <p className="text-muted-foreground">No state data available</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sensor Mappings */}
                <div>
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                    Sensor Mappings
                  </h3>
                  {selectedTwin.sensorMappings && selectedTwin.sensorMappings.length > 0 ? (
                    <div className="space-y-2">
                      {selectedTwin.sensorMappings.map((mapping, index) => {
                        const Icon = sensorIcons[mapping.sensorType] || sensorIcons.default;
                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 rounded-lg bg-background"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Icon className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-sm text-foreground">
                                  {mapping.sensorId}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {mapping.propertyPath} {mapping.unit && `(${mapping.unit})`}
                                </p>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-xs capitalize bg-muted text-muted-foreground">
                              {mapping.sensorType}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Radio className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-muted-foreground">No sensors mapped</p>
                    </div>
                  )}
                </div>

                {/* Recent Readings */}
                <div>
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                    Recent Readings (Last 24h)
                  </h3>
                  {readingsLoading ? (
                    <div className="animate-pulse space-y-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-12 rounded-lg bg-muted" />
                      ))}
                    </div>
                  ) : readings.length > 0 ? (
                    <div className="space-y-2">
                      {readings.slice(0, 10).map((reading) => (
                        <div
                          key={reading.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-background"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                reading.quality === 'good' ? 'bg-success-subtle' :
                                reading.quality === 'uncertain' ? 'bg-warning-subtle' : 'bg-danger-subtle'
                              }`}
                            />
                            <span className="text-sm text-foreground">
                              {reading.sensorId}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-sm text-foreground">
                              {reading.value.toFixed(2)} {reading.unit}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(reading.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Activity className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-muted-foreground">No readings in the last 24 hours</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Box className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Select a digital twin to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-overlay/50 flex items-center justify-center z-50">
          <div className="w-full max-w-md rounded-xl p-6 bg-card">
            <h2 className="text-lg font-semibold mb-4 text-foreground">
              Create Digital Twin
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Name
                </label>
                <input
                  type="text"
                  value={newTwin.name}
                  onChange={(e) => setNewTwin({ ...newTwin, name: e.target.value })}
                  placeholder="e.g., Pump Station A"
                  className="w-full px-3 py-2 rounded-lg border bg-background border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Description
                </label>
                <textarea
                  value={newTwin.description}
                  onChange={(e) => setNewTwin({ ...newTwin, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border bg-background border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Asset ID
                </label>
                <input
                  type="text"
                  value={newTwin.assetId}
                  onChange={(e) => setNewTwin({ ...newTwin, assetId: e.target.value })}
                  placeholder="e.g., PUMP-001"
                  className="w-full px-3 py-2 rounded-lg border bg-background border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Asset Type
                </label>
                <select
                  value={newTwin.assetType}
                  onChange={(e) => setNewTwin({ ...newTwin, assetType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border bg-background border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select type...</option>
                  <option value="pump">Pump</option>
                  <option value="motor">Motor</option>
                  <option value="hvac">HVAC</option>
                  <option value="transformer">Transformer</option>
                  <option value="generator">Generator</option>
                  <option value="compressor">Compressor</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-muted/80"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTwin}
                disabled={!newTwin.name.trim() || !newTwin.assetId.trim() || !newTwin.assetType || creating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating && <RefreshCw className="h-4 w-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DigitalTwinsPage;
