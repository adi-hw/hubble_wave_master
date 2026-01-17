import { useEffect, useMemo, useState } from 'react';
import { GlassCard } from '../../components/ui/glass/GlassCard';
import {
  ConnectorConnection,
  ExternalConnector,
  PropertyMapping,
  SyncConfiguration,
  SyncRun,
  ConflictResolution,
  SyncDirection,
  SyncMode,
  createConnection,
  createMapping,
  createSyncConfig,
  listConnectors,
  listConnections,
  listMappings,
  listSyncConfigs,
  listSyncRuns,
  runSync,
  testConnection,
  updateSyncConfig,
} from '../../services/connectors.service';
import { schemaService } from '../../services/schema';

type ConnectionFormState = {
  connectorId: string;
  name: string;
  description: string;
  config: string;
  credentialRef: string;
};

type MappingFormState = {
  name: string;
  sourceEntity: string;
  targetCollectionCode: string;
  direction: SyncDirection;
  syncMode: SyncMode;
  conflictResolution: ConflictResolution;
  mappings: string;
};

type SyncFormState = {
  name: string;
  description: string;
  mappingId: string;
  schedule: string;
  direction: SyncDirection;
  syncMode: SyncMode;
  conflictResolution: ConflictResolution;
  batchSize: string;
};

type SyncEditState = {
  schedule: string;
  direction: SyncDirection;
  syncMode: SyncMode;
  conflictResolution: ConflictResolution;
  batchSize: string;
  isActive: boolean;
};

const DEFAULT_CONNECTION_FORM: ConnectionFormState = {
  connectorId: '',
  name: '',
  description: '',
  config: '{}',
  credentialRef: '',
};

const DEFAULT_MAPPING_FORM: MappingFormState = {
  name: '',
  sourceEntity: '',
  targetCollectionCode: '',
  direction: 'inbound',
  syncMode: 'incremental',
  conflictResolution: 'source_wins',
  mappings: '[]',
};

const DEFAULT_SYNC_FORM: SyncFormState = {
  name: '',
  description: '',
  mappingId: '',
  schedule: 'PT15M',
  direction: 'inbound',
  syncMode: 'incremental',
  conflictResolution: 'source_wins',
  batchSize: '500',
};

export function ConnectorManagerPage() {
  const [connectors, setConnectors] = useState<ExternalConnector[]>([]);
  const [connections, setConnections] = useState<ConnectorConnection[]>([]);
  const [mappings, setMappings] = useState<PropertyMapping[]>([]);
  const [syncConfigs, setSyncConfigs] = useState<SyncConfiguration[]>([]);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedSyncId, setSelectedSyncId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionForm, setConnectionForm] = useState<ConnectionFormState>(
    DEFAULT_CONNECTION_FORM,
  );
  const [mappingForm, setMappingForm] = useState<MappingFormState>(DEFAULT_MAPPING_FORM);
  const [syncForm, setSyncForm] = useState<SyncFormState>(DEFAULT_SYNC_FORM);
  const [syncEdit, setSyncEdit] = useState<SyncEditState | null>(null);

  const connectorById = useMemo(() => {
    return connectors.reduce<Record<string, ExternalConnector>>((acc, connector) => {
      acc[connector.id] = connector;
      return acc;
    }, {});
  }, [connectors]);

  const selectedConnection = useMemo(() => {
    return connections.find((connection) => connection.id === selectedConnectionId) || null;
  }, [connections, selectedConnectionId]);

  const selectedSync = useMemo(() => {
    return syncConfigs.find((config) => config.id === selectedSyncId) || null;
  }, [syncConfigs, selectedSyncId]);

  useEffect(() => {
    const loadBase = async () => {
      setBusy(true);
      setError(null);
      try {
        const [connectorResponse, connectionResponse] = await Promise.all([
          listConnectors({ isActive: true }),
          listConnections(),
        ]);
        setConnectors(connectorResponse.items || []);
        setConnections(connectionResponse.items || []);
        if (connectionResponse.items?.length) {
          setSelectedConnectionId((current) => current ?? connectionResponse.items[0].id);
        }
      } catch (loadError) {
        setError((loadError as Error).message);
      } finally {
        setBusy(false);
      }
    };

    void loadBase();
  }, []);

  useEffect(() => {
    const loadConnectionDetails = async () => {
      if (!selectedConnectionId) {
        setMappings([]);
        setSyncConfigs([]);
        setSelectedSyncId(null);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const [mappingResponse, syncResponse] = await Promise.all([
          listMappings(selectedConnectionId),
          listSyncConfigs({ connectionId: selectedConnectionId }),
        ]);
        setMappings(mappingResponse || []);
        setSyncConfigs(syncResponse.items || []);
        if (syncResponse.items?.length) {
          setSelectedSyncId(syncResponse.items[0].id);
        } else {
          setSelectedSyncId(null);
          setRuns([]);
        }
      } catch (loadError) {
        setError((loadError as Error).message);
      } finally {
        setBusy(false);
      }
    };

    void loadConnectionDetails();
  }, [selectedConnectionId]);

  useEffect(() => {
    if (!selectedSync) {
      setSyncEdit(null);
      return;
    }
    setSyncEdit({
      schedule: selectedSync.schedule || '',
      direction: selectedSync.direction,
      syncMode: selectedSync.syncMode,
      conflictResolution: selectedSync.conflictResolution,
      batchSize: String(selectedSync.batchSize || 0),
      isActive: selectedSync.isActive,
    });
  }, [selectedSync]);

  useEffect(() => {
    const loadRuns = async () => {
      if (!selectedSyncId) {
        setRuns([]);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const response = await listSyncRuns(selectedSyncId);
        setRuns(response.items || []);
      } catch (loadError) {
        setError((loadError as Error).message);
      } finally {
        setBusy(false);
      }
    };

    void loadRuns();
  }, [selectedSyncId]);

  const parseJsonObject = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('Config must be a JSON object.');
      }
      return parsed as Record<string, unknown>;
    } catch (parseError) {
      setError((parseError as Error).message);
      return null;
    }
  };

  const parseJsonArray = (value: string) => {
    try {
      const parsed = JSON.parse(value || '[]');
      if (!Array.isArray(parsed)) {
        throw new Error('Mappings must be a JSON array.');
      }
      return parsed as PropertyMapping['mappings'];
    } catch (parseError) {
      setError((parseError as Error).message);
      return null;
    }
  };

  const handleCreateConnection = async () => {
    setError(null);
    if (!connectionForm.connectorId || !connectionForm.name.trim()) {
      setError('Connector and name are required.');
      return;
    }
    const config = parseJsonObject(connectionForm.config);
    if (!config) return;

    setBusy(true);
    try {
      const created = await createConnection({
        connectorId: connectionForm.connectorId,
        name: connectionForm.name.trim(),
        description: connectionForm.description.trim() || undefined,
        config,
        credentialRef: connectionForm.credentialRef.trim() || undefined,
      });
      setConnections((prev) => [created, ...prev]);
      setSelectedConnectionId(created.id);
      setConnectionForm((prev) => ({
        ...DEFAULT_CONNECTION_FORM,
        connectorId: prev.connectorId,
      }));
    } catch (createError) {
      setError((createError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleTestConnection = async (connectionId: string) => {
    setError(null);
    setBusy(true);
    try {
      const result = await testConnection(connectionId);
      if (!result.success) {
        setError(result.error || 'Connection test failed.');
      }
    } catch (testError) {
      setError((testError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateMapping = async () => {
    setError(null);
    if (!selectedConnectionId) {
      setError('Select a connection first.');
      return;
    }
    if (!mappingForm.name.trim() || !mappingForm.sourceEntity.trim()) {
      setError('Mapping name and source entity are required.');
      return;
    }
    if (!mappingForm.targetCollectionCode.trim()) {
      setError('Target collection code is required.');
      return;
    }
    const mappingsPayload = parseJsonArray(mappingForm.mappings);
    if (!mappingsPayload) return;

    setBusy(true);
    try {
      const collection = await schemaService.getCollectionByCode(
        mappingForm.targetCollectionCode.trim(),
      );
      const created = await createMapping({
        connectionId: selectedConnectionId,
        name: mappingForm.name.trim(),
        sourceEntity: mappingForm.sourceEntity.trim(),
        targetCollectionId: collection.id,
        direction: mappingForm.direction,
        syncMode: mappingForm.syncMode,
        conflictResolution: mappingForm.conflictResolution,
        mappings: mappingsPayload,
      });
      setMappings((prev) => [created, ...prev]);
      setMappingForm(DEFAULT_MAPPING_FORM);
    } catch (createError) {
      setError((createError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSyncConfig = async () => {
    setError(null);
    if (!selectedConnectionId) {
      setError('Select a connection first.');
      return;
    }
    if (!syncForm.name.trim()) {
      setError('Sync name is required.');
      return;
    }
    setBusy(true);
    try {
      const created = await createSyncConfig({
        name: syncForm.name.trim(),
        description: syncForm.description.trim() || undefined,
        connectionId: selectedConnectionId,
        mappingId: syncForm.mappingId || undefined,
        schedule: syncForm.schedule.trim() || undefined,
        direction: syncForm.direction,
        syncMode: syncForm.syncMode,
        conflictResolution: syncForm.conflictResolution,
        batchSize: Number(syncForm.batchSize || 0) || undefined,
      });
      setSyncConfigs((prev) => [created, ...prev]);
      setSelectedSyncId(created.id);
      setSyncForm(DEFAULT_SYNC_FORM);
    } catch (createError) {
      setError((createError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateSyncConfig = async () => {
    if (!selectedSync || !syncEdit) return;
    setError(null);
    setBusy(true);
    try {
      const updated = await updateSyncConfig(selectedSync.id, {
        schedule: syncEdit.schedule.trim() || undefined,
        direction: syncEdit.direction,
        syncMode: syncEdit.syncMode,
        conflictResolution: syncEdit.conflictResolution,
        batchSize: Number(syncEdit.batchSize || 0) || undefined,
        isActive: syncEdit.isActive,
      });
      setSyncConfigs((prev) =>
        prev.map((config) => (config.id === updated.id ? updated : config)),
      );
    } catch (updateError) {
      setError((updateError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRunSync = async (syncId: string) => {
    setError(null);
    setBusy(true);
    try {
      await runSync(syncId);
      const response = await listSyncRuns(syncId);
      setRuns(response.items || []);
    } catch (runError) {
      setError((runError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const formatTimestamp = (value?: string | null) => {
    if (!value) return 'Not available';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const isLoading = busy && connectors.length === 0 && connections.length === 0;

  return (
    <div className="connector-manager">
      <header className="page-header">
        <div>
          <h1 className="page-title">Connector Manager</h1>
          <p className="page-subtitle">
            Configure connections, mappings, and sync schedules for external systems.
          </p>
        </div>
        <div className="page-status">
          {busy ? <span className="status-pill">Working...</span> : <span className="status-pill">Ready</span>}
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {isLoading ? (
        <GlassCard className="panel">Loading connector data...</GlassCard>
      ) : (
        <div className="grid">
          <div className="column">
            <GlassCard className="panel">
              <div className="panel-header">
                <h2>Connections</h2>
                <p>Create connection profiles that reference credential secrets.</p>
              </div>

              <div className="connection-list">
                {connections.length === 0 ? (
                  <div className="empty-state">No connections configured yet.</div>
                ) : (
                  connections.map((connection) => {
                    const connector = connectorById[connection.connectorId];
                    return (
                      <button
                        type="button"
                        key={connection.id}
                        className={`connection-item ${
                          selectedConnectionId === connection.id ? 'connection-item--active' : ''
                        }`}
                        onClick={() => setSelectedConnectionId(connection.id)}
                      >
                        <div>
                          <div className="connection-name">{connection.name}</div>
                          <div className="connection-meta">
                            {connector?.name || 'Connector'} - {connection.status}
                          </div>
                        </div>
                        <div className="connection-actions">
                          <button
                            type="button"
                            className="link-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleTestConnection(connection.id);
                            }}
                          >
                            Test
                          </button>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="divider" />

              <div className="form">
                <h3>New Connection</h3>
                <label>
                  Connector
                  <select
                    value={connectionForm.connectorId}
                    onChange={(event) =>
                      setConnectionForm((prev) => ({
                        ...prev,
                        connectorId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select connector</option>
                    {connectors.map((connector) => (
                      <option key={connector.id} value={connector.id}>
                        {connector.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Name
                  <input
                    value={connectionForm.name}
                    onChange={(event) =>
                      setConnectionForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="Production CRM"
                  />
                </label>
                <label>
                  Description
                  <input
                    value={connectionForm.description}
                    onChange={(event) =>
                      setConnectionForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Optional"
                  />
                </label>
                <label>
                  Credential Reference
                  <input
                    value={connectionForm.credentialRef}
                    onChange={(event) =>
                      setConnectionForm((prev) => ({
                        ...prev,
                        credentialRef: event.target.value,
                      }))
                    }
                    placeholder="aws-secrets://instance/connectors/crm-prod"
                  />
                </label>
                <label>
                  Config (JSON)
                  <textarea
                    value={connectionForm.config}
                    onChange={(event) =>
                      setConnectionForm((prev) => ({
                        ...prev,
                        config: event.target.value,
                      }))
                    }
                    rows={6}
                  />
                </label>
                <button className="primary" type="button" onClick={() => void handleCreateConnection()}>
                  Create Connection
                </button>
              </div>
            </GlassCard>
          </div>

          <div className="column">
            <GlassCard className="panel">
              <div className="panel-header">
                <h2>Mappings</h2>
                <p>Define how external objects map into internal collections.</p>
              </div>

              {selectedConnection ? (
                <>
                  <div className="list">
                    {mappings.length === 0 ? (
                      <div className="empty-state">No mappings defined for this connection.</div>
                    ) : (
                      mappings.map((mapping) => (
                        <div key={mapping.id} className="list-item">
                          <div>
                            <div className="list-title">{mapping.name}</div>
                            <div className="list-meta">
                              {mapping.sourceEntity}
                              {' -> '}
                              {mapping.targetCollectionId || 'Collection'}
                            </div>
                          </div>
                          <div className="list-meta">
                            {mapping.direction} - {mapping.syncMode}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="divider" />

                  <div className="form">
                    <h3>New Mapping</h3>
                    <label>
                      Name
                      <input
                        value={mappingForm.name}
                        onChange={(event) =>
                          setMappingForm((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Source Entity
                      <input
                        value={mappingForm.sourceEntity}
                        onChange={(event) =>
                          setMappingForm((prev) => ({
                            ...prev,
                            sourceEntity: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Target Collection Code
                      <input
                        value={mappingForm.targetCollectionCode}
                        onChange={(event) =>
                          setMappingForm((prev) => ({
                            ...prev,
                            targetCollectionCode: event.target.value,
                          }))
                        }
                        placeholder="accounts"
                      />
                    </label>
                    <div className="row">
                      <label>
                        Direction
                        <select
                          value={mappingForm.direction}
                          onChange={(event) =>
                            setMappingForm((prev) => ({
                              ...prev,
                              direction: event.target.value as SyncDirection,
                            }))
                          }
                        >
                          <option value="inbound">Inbound</option>
                          <option value="outbound">Outbound</option>
                          <option value="bidirectional">Bidirectional</option>
                        </select>
                      </label>
                      <label>
                        Sync Mode
                        <select
                          value={mappingForm.syncMode}
                          onChange={(event) =>
                            setMappingForm((prev) => ({
                              ...prev,
                              syncMode: event.target.value as SyncMode,
                            }))
                          }
                        >
                          <option value="incremental">Incremental</option>
                          <option value="delta">Delta</option>
                          <option value="full">Full</option>
                        </select>
                      </label>
                    </div>
                    <label>
                      Conflict Resolution
                      <select
                        value={mappingForm.conflictResolution}
                        onChange={(event) =>
                          setMappingForm((prev) => ({
                            ...prev,
                            conflictResolution: event.target.value as ConflictResolution,
                          }))
                        }
                      >
                        <option value="source_wins">Source wins</option>
                        <option value="target_wins">Target wins</option>
                        <option value="newest_wins">Newest wins</option>
                        <option value="manual">Manual</option>
                      </select>
                    </label>
                    <label>
                      Property Mappings (JSON)
                      <textarea
                        value={mappingForm.mappings}
                        onChange={(event) =>
                          setMappingForm((prev) => ({
                            ...prev,
                            mappings: event.target.value,
                          }))
                        }
                        rows={6}
                      />
                    </label>
                    <button className="primary" type="button" onClick={() => void handleCreateMapping()}>
                      Create Mapping
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-state">Select a connection to manage mappings.</div>
              )}
            </GlassCard>

            <GlassCard className="panel">
              <div className="panel-header">
                <h2>Sync Configurations</h2>
                <p>Define schedules and retry behavior for each sync mapping.</p>
              </div>

              {selectedConnection ? (
                <>
                  <div className="list">
                    {syncConfigs.length === 0 ? (
                      <div className="empty-state">No sync configurations defined.</div>
                    ) : (
                      syncConfigs.map((config) => (
                        <button
                          type="button"
                          key={config.id}
                          className={`list-item selectable ${
                            selectedSyncId === config.id ? 'list-item--active' : ''
                          }`}
                          onClick={() => setSelectedSyncId(config.id)}
                        >
                          <div>
                            <div className="list-title">{config.name}</div>
                            <div className="list-meta">
                              {config.direction} - {config.syncMode} -{' '}
                              {config.schedule || 'Manual'}
                            </div>
                          </div>
                          <div className="list-actions">
                            <button
                              type="button"
                              className="link-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleRunSync(config.id);
                              }}
                            >
                              Run
                            </button>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="divider" />

                  <div className="form">
                    <h3>New Sync Configuration</h3>
                    <label>
                      Name
                      <input
                        value={syncForm.name}
                        onChange={(event) =>
                          setSyncForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Description
                      <input
                        value={syncForm.description}
                        onChange={(event) =>
                          setSyncForm((prev) => ({
                            ...prev,
                            description: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Mapping
                      <select
                        value={syncForm.mappingId}
                        onChange={(event) =>
                          setSyncForm((prev) => ({
                            ...prev,
                            mappingId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select mapping</option>
                        {mappings.map((mapping) => (
                          <option key={mapping.id} value={mapping.id}>
                            {mapping.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="row">
                      <label>
                        Schedule (ISO-8601)
                        <input
                          value={syncForm.schedule}
                          onChange={(event) =>
                            setSyncForm((prev) => ({
                              ...prev,
                              schedule: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Batch Size
                        <input
                          value={syncForm.batchSize}
                          onChange={(event) =>
                            setSyncForm((prev) => ({
                              ...prev,
                              batchSize: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                    <div className="row">
                      <label>
                        Direction
                        <select
                          value={syncForm.direction}
                          onChange={(event) =>
                            setSyncForm((prev) => ({
                              ...prev,
                              direction: event.target.value as SyncDirection,
                            }))
                          }
                        >
                          <option value="inbound">Inbound</option>
                          <option value="outbound">Outbound</option>
                          <option value="bidirectional">Bidirectional</option>
                        </select>
                      </label>
                      <label>
                        Sync Mode
                        <select
                          value={syncForm.syncMode}
                          onChange={(event) =>
                            setSyncForm((prev) => ({
                              ...prev,
                              syncMode: event.target.value as SyncMode,
                            }))
                          }
                        >
                          <option value="incremental">Incremental</option>
                          <option value="delta">Delta</option>
                          <option value="full">Full</option>
                        </select>
                      </label>
                    </div>
                    <label>
                      Conflict Resolution
                      <select
                        value={syncForm.conflictResolution}
                        onChange={(event) =>
                          setSyncForm((prev) => ({
                            ...prev,
                            conflictResolution: event.target.value as ConflictResolution,
                          }))
                        }
                      >
                        <option value="source_wins">Source wins</option>
                        <option value="target_wins">Target wins</option>
                        <option value="newest_wins">Newest wins</option>
                        <option value="manual">Manual</option>
                      </select>
                    </label>
                    <button className="primary" type="button" onClick={() => void handleCreateSyncConfig()}>
                      Create Sync Configuration
                    </button>
                  </div>

                  {selectedSync && syncEdit && (
                    <>
                      <div className="divider" />
                      <div className="form">
                        <h3>Update Selected Sync</h3>
                        <div className="row">
                          <label>
                            Schedule (ISO-8601)
                            <input
                              value={syncEdit.schedule}
                              onChange={(event) =>
                                setSyncEdit((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        schedule: event.target.value,
                                      }
                                    : prev,
                                )
                              }
                            />
                          </label>
                          <label>
                            Batch Size
                            <input
                              value={syncEdit.batchSize}
                              onChange={(event) =>
                                setSyncEdit((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        batchSize: event.target.value,
                                      }
                                    : prev,
                                )
                              }
                            />
                          </label>
                        </div>
                        <div className="row">
                          <label>
                            Direction
                            <select
                              value={syncEdit.direction}
                              onChange={(event) =>
                                setSyncEdit((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        direction: event.target.value as SyncDirection,
                                      }
                                    : prev,
                                )
                              }
                            >
                              <option value="inbound">Inbound</option>
                              <option value="outbound">Outbound</option>
                              <option value="bidirectional">Bidirectional</option>
                            </select>
                          </label>
                          <label>
                            Sync Mode
                            <select
                              value={syncEdit.syncMode}
                              onChange={(event) =>
                                setSyncEdit((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        syncMode: event.target.value as SyncMode,
                                      }
                                    : prev,
                                )
                              }
                            >
                              <option value="incremental">Incremental</option>
                              <option value="delta">Delta</option>
                              <option value="full">Full</option>
                            </select>
                          </label>
                        </div>
                        <label>
                          Conflict Resolution
                          <select
                            value={syncEdit.conflictResolution}
                            onChange={(event) =>
                              setSyncEdit((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      conflictResolution: event.target.value as ConflictResolution,
                                    }
                                  : prev,
                              )
                            }
                          >
                            <option value="source_wins">Source wins</option>
                            <option value="target_wins">Target wins</option>
                            <option value="newest_wins">Newest wins</option>
                            <option value="manual">Manual</option>
                          </select>
                        </label>
                        <label className="toggle">
                          <input
                            type="checkbox"
                            checked={syncEdit.isActive}
                            onChange={(event) =>
                              setSyncEdit((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      isActive: event.target.checked,
                                    }
                                  : prev,
                              )
                            }
                          />
                          <span>Active</span>
                        </label>
                        <button className="primary" type="button" onClick={() => void handleUpdateSyncConfig()}>
                          Save Changes
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="empty-state">Select a connection to manage sync settings.</div>
              )}
            </GlassCard>

            <GlassCard className="panel">
              <div className="panel-header">
                <h2>Run History</h2>
                <p>Monitor the latest sync runs for the selected configuration.</p>
              </div>
              {selectedSync ? (
                <>
                  <div className="history-summary">
                    <div>
                      <div className="summary-label">Next Run</div>
                      <div className="summary-value">
                        {formatTimestamp(selectedSync.nextRunAt)}
                      </div>
                    </div>
                    <div>
                      <div className="summary-label">Last Run</div>
                      <div className="summary-value">
                        {formatTimestamp(selectedSync.lastRunAt)}
                      </div>
                    </div>
                  </div>
                  <div className="list">
                    {runs.length === 0 ? (
                      <div className="empty-state">No runs recorded yet.</div>
                    ) : (
                      runs.map((run) => (
                        <div key={run.id} className="list-item">
                          <div>
                            <div className="list-title">{run.status}</div>
                            <div className="list-meta">
                              Started {formatTimestamp(run.startedAt)} - Processed{' '}
                              {run.recordsProcessed}
                            </div>
                          </div>
                          <div className="list-meta">Failed: {run.recordsFailed}</div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state">Select a sync configuration to view history.</div>
              )}
            </GlassCard>
          </div>
        </div>
      )}

      <style>{`
        .connector-manager {
          padding: 2rem;
          max-width: 1600px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
          gap: 2rem;
        }

        .page-title {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
        }

        .page-subtitle {
          color: var(--text-secondary);
        }

        .page-status {
          display: flex;
          align-items: center;
        }

        .status-pill {
          padding: 0.4rem 0.9rem;
          background: var(--bg-surface-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 999px;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .error-banner {
          padding: 0.75rem 1rem;
          background: var(--bg-danger-subtle);
          border: 1px solid var(--border-danger);
          color: var(--text-danger);
          border-radius: 8px;
          margin-bottom: 1rem;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 1.5rem;
        }

        .column {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .panel {
          padding: 1.5rem;
        }

        .panel-header h2 {
          font-size: 1.2rem;
          font-weight: 600;
          margin-bottom: 0.3rem;
        }

        .panel-header p {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .connection-list {
          margin-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .connection-item {
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          padding: 0.75rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--bg-surface);
          cursor: pointer;
          transition: border 0.15s ease, background 0.15s ease;
          text-align: left;
        }

        .connection-item--active {
          border-color: var(--border-primary);
          background: var(--bg-primary-subtle);
        }

        .connection-name {
          font-weight: 600;
          color: var(--text-primary);
        }

        .connection-meta {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .connection-actions {
          display: flex;
          gap: 0.5rem;
        }

        .link-button {
          border: none;
          background: none;
          color: var(--text-brand);
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .divider {
          height: 1px;
          background: var(--border-subtle);
          margin: 1.5rem 0;
        }

        .form {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .form h3 {
          font-size: 1rem;
          font-weight: 600;
        }

        label {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        input,
        select,
        textarea {
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          border: 1px solid var(--border-default);
          background: var(--bg-surface);
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        textarea {
          font-family: ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas,
            'Liberation Mono', 'Courier New', monospace;
        }

        .row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .primary {
          background: var(--gradient-brand);
          color: var(--text-on-primary);
          border: none;
          padding: 0.65rem 1rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .list {
          margin-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .list-item {
          padding: 0.75rem;
          border-radius: 8px;
          border: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          background: var(--bg-surface);
        }

        .list-item.selectable {
          cursor: pointer;
        }

        .list-item--active {
          border-color: var(--border-primary);
          background: var(--bg-primary-subtle);
        }

        .list-title {
          font-weight: 600;
        }

        .list-meta {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .list-actions {
          display: flex;
          gap: 0.5rem;
        }

        .history-summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-top: 1rem;
          margin-bottom: 1rem;
        }

        .summary-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .summary-value {
          font-weight: 600;
        }

        .empty-state {
          padding: 1rem;
          border: 1px dashed var(--border-subtle);
          border-radius: 8px;
          color: var(--text-secondary);
          text-align: center;
        }

        .toggle {
          flex-direction: row;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: var(--text-primary);
        }

        @media (max-width: 1200px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default ConnectorManagerPage;
