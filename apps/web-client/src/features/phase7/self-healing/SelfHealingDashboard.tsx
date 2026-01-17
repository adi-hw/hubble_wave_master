import { useState, useEffect } from 'react';
import {
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Play,
  Server,
  History,
  Zap,
} from 'lucide-react';
import {
  selfHealingApi,
  SelfHealingDashboard as DashboardData,
  ServiceHealth,
  SelfHealingEvent,
} from '../../../services/phase7Api';

const statusStyles = {
  healthy: { bg: 'bg-success-subtle', text: 'text-success-text', icon: CheckCircle },
  degraded: { bg: 'bg-warning-subtle', text: 'text-warning-text', icon: AlertTriangle },
  unhealthy: { bg: 'bg-destructive/10', text: 'text-destructive', icon: XCircle },
  unknown: { bg: 'bg-muted', text: 'text-muted-foreground', icon: Clock },
};

const eventTypeStyles = {
  health_check: { bg: 'bg-info-subtle', text: 'text-info-text' },
  recovery_triggered: { bg: 'bg-warning-subtle', text: 'text-warning-text' },
  recovery_completed: { bg: 'bg-success-subtle', text: 'text-success-text' },
  recovery_failed: { bg: 'bg-destructive/10', text: 'text-destructive' },
  alert: { bg: 'bg-destructive/10', text: 'text-destructive' },
};

export const SelfHealingDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningChecks, setRunningChecks] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceHealth | null>(null);
  const [serviceEvents, setServiceEvents] = useState<SelfHealingEvent[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (selectedService) {
      loadServiceEvents(selectedService.id);
    }
  }, [selectedService]);

  const loadDashboard = async () => {
    try {
      const data = await selfHealingApi.getDashboard();
      setDashboard(data);
      if (data.services.length > 0 && !selectedService) {
        setSelectedService(data.services[0]);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadServiceEvents = async (serviceId: string) => {
    try {
      const response = await selfHealingApi.getEvents({ serviceId });
      setServiceEvents(response.events);
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  const handleRunAllChecks = async () => {
    setRunningChecks(true);
    try {
      await selfHealingApi.runAllHealthChecks();
      await loadDashboard();
    } catch (error) {
      console.error('Failed to run checks:', error);
    } finally {
      setRunningChecks(false);
    }
  };

  const handleTriggerHealthCheck = async (serviceId: string) => {
    try {
      await selfHealingApi.triggerHealthCheck(serviceId);
      await loadDashboard();
      if (selectedService?.id === serviceId) {
        loadServiceEvents(serviceId);
      }
    } catch (error) {
      console.error('Failed to trigger health check:', error);
    }
  };

  const handleExecuteRecovery = async (actionId: string) => {
    try {
      await selfHealingApi.executeRecoveryAction(actionId);
      await loadDashboard();
    } catch (error) {
      console.error('Failed to execute recovery:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 rounded bg-muted" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-xl bg-muted" />
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
            Self-Healing Infrastructure
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor and automatically recover from system issues
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunAllChecks}
            disabled={runningChecks}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {runningChecks ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run All Checks
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg border transition-colors bg-card border-border hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success-subtle">
              <CheckCircle className="h-5 w-5 text-success-text" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Healthy</p>
              <p className="text-2xl font-semibold text-foreground">
                {dashboard?.healthyCount || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unhealthy</p>
              <p className="text-2xl font-semibold text-foreground">
                {dashboard?.unhealthyCount || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning-subtle">
              <Clock className="h-5 w-5 text-warning-text" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Actions</p>
              <p className="text-2xl font-semibold text-foreground">
                {dashboard?.pendingActions?.length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info-subtle">
              <Activity className="h-5 w-5 text-info-text" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Recent Events</p>
              <p className="text-2xl font-semibold text-foreground">
                {dashboard?.recentEvents?.length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Services List */}
        <div className="w-80 shrink-0 overflow-auto space-y-3">
          <h2 className="text-sm font-medium mb-2 text-muted-foreground">
            Services ({dashboard?.services?.length || 0})
          </h2>
          {dashboard?.services?.map((service) => {
            const status = statusStyles[service.status];
            const StatusIcon = status.icon;
            const isSelected = selectedService?.id === service.id;

            return (
              <div
                key={service.id}
                onClick={() => setSelectedService(service)}
                className={`p-4 rounded-xl border cursor-pointer transition-all bg-card hover:bg-muted ${
                  isSelected ? 'ring-2 ring-offset-2 ring-primary border-primary' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-primary" />
                    <h3 className="font-medium text-foreground">
                      {service.name}
                    </h3>
                  </div>
                  <span
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${status.bg} ${status.text}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {service.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{service.type}</span>
                  {service.lastCheckAt && (
                    <span>Last check: {new Date(service.lastCheckAt).toLocaleTimeString()}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail Panel */}
        <div className="flex-1 rounded-xl border overflow-hidden flex flex-col bg-card border-border">
          {selectedService ? (
            <>
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {selectedService.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedService.type}
                  </p>
                </div>
                <button
                  onClick={() => handleTriggerHealthCheck(selectedService.id)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-primary/10 text-primary hover:bg-primary/20"
                >
                  <Zap className="h-4 w-4" />
                  Check Now
                </button>
              </div>

              <div className="flex-1 overflow-auto p-6 space-y-6">
                {/* Metrics */}
                {selectedService.metrics && Object.keys(selectedService.metrics).length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                      Metrics
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(selectedService.metrics).map(([key, value]) => (
                        <div
                          key={key}
                          className="p-4 rounded-xl bg-muted"
                        >
                          <p className="text-xs uppercase tracking-wider mb-1 text-muted-foreground">
                            {key.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xl font-semibold text-foreground">
                            {typeof value === 'number' ? value.toFixed(2) : String(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Events */}
                <div>
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                    Recent Events
                  </h3>
                  {serviceEvents.length > 0 ? (
                    <div className="space-y-2">
                      {serviceEvents.slice(0, 10).map((event) => {
                        const eventStyle = eventTypeStyles[event.eventType as keyof typeof eventTypeStyles] || eventTypeStyles.alert;
                        return (
                          <div
                            key={event.id}
                            className="flex items-start gap-3 p-3 rounded-lg bg-muted"
                          >
                            <span
                              className={`px-2 py-0.5 rounded text-xs shrink-0 ${eventStyle.bg} ${eventStyle.text}`}
                            >
                              {event.eventType.replace(/_/g, ' ')}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground">
                                {event.message}
                              </p>
                              <p className="text-xs mt-1 text-muted-foreground">
                                {new Date(event.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <History className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-muted-foreground">No recent events</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Server className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Select a service to view details</p>
              </div>
            </div>
          )}
        </div>

        {/* Pending Actions */}
        {dashboard?.pendingActions && dashboard.pendingActions.length > 0 && (
          <div className="w-80 shrink-0 overflow-auto">
            <h2 className="text-sm font-medium mb-3 text-muted-foreground">
              Pending Recovery Actions
            </h2>
            <div className="space-y-3">
              {dashboard.pendingActions.map((action) => (
                <div
                  key={action.id}
                  className="p-4 rounded-xl border bg-card border-border"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-warning-text" />
                    <span className="font-medium text-sm capitalize text-foreground">
                      {action.actionType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <button
                    onClick={() => handleExecuteRecovery(action.id)}
                    className="w-full mt-2 py-1.5 rounded-lg text-sm font-medium bg-warning-subtle text-warning-text hover:bg-warning-subtle"
                  >
                    Execute Recovery
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SelfHealingDashboard;
