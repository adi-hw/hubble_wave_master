import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
  Users,
  ArrowRight,
  ArrowLeft,
  Plus,
  Calendar,
  Shield,
  Trash2,
  Loader2,
  Check,
  AlertTriangle,
  X,
} from 'lucide-react';
import { authService } from '../services/auth';

interface Delegation {
  id: string;
  name: string;
  status: string;
  delegator?: { id: string; email: string; displayName: string };
  delegate?: { id: string; email: string; displayName: string };
  delegatedPermissions: string[];
  delegatedRoles: string[];
  startsAt: Date;
  endsAt: Date;
  createdAt?: Date;
}

type TabType = 'created' | 'received';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusClasses(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-success-subtle text-success-text';
    case 'pending':
      return 'bg-warning-subtle text-warning-text';
    case 'expired':
      return 'bg-muted text-muted-foreground';
    case 'revoked':
      return 'bg-danger-subtle text-danger-text';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function DelegationsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('created');
  const [createdDelegations, setCreatedDelegations] = useState<Delegation[]>([]);
  const [receivedDelegations, setReceivedDelegations] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [showExpired, setShowExpired] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create delegation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    delegateEmail: '',
    name: '',
    reason: '',
    permissions: [] as string[],
    roles: [] as string[],
    durationDays: 7,
  });
  const [creating, setCreating] = useState(false);

  const loadDelegations = async () => {
    try {
      setLoading(true);
      const [created, received] = await Promise.all([
        authService.getDelegationsCreated(showExpired),
        authService.getDelegationsReceived(),
      ]);
      setCreatedDelegations(created.delegations);
      setReceivedDelegations(received.delegations);
    } catch (err) {
      console.error('Failed to load delegations:', err);
      setMessage({ type: 'error', text: 'Failed to load delegations' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDelegations();
  }, [showExpired]);

  const handleRevoke = async (delegationId: string) => {
    if (!confirm('Are you sure you want to revoke this delegation?')) return;

    try {
      setRevoking(delegationId);
      await authService.revokeDelegation(delegationId);
      await loadDelegations();
      setMessage({ type: 'success', text: 'Delegation revoked successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to revoke delegation' });
    } finally {
      setRevoking(null);
    }
  };

  const handleCreate = async () => {
    if (!createForm.delegateEmail || !createForm.name) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    try {
      setCreating(true);
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + createForm.durationDays);

      await authService.createDelegation({
        delegateId: createForm.delegateEmail, // Backend should lookup by email
        name: createForm.name,
        reason: createForm.reason || undefined,
        delegatedPermissions: createForm.permissions.length > 0 ? createForm.permissions : undefined,
        delegatedRoles: createForm.roles.length > 0 ? createForm.roles : undefined,
        endsAt,
      });

      setShowCreateModal(false);
      setCreateForm({
        delegateEmail: '',
        name: '',
        reason: '',
        permissions: [],
        roles: [],
        durationDays: 7,
      });
      await loadDelegations();
      setMessage({ type: 'success', text: 'Delegation created successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to create delegation' });
    } finally {
      setCreating(false);
    }
  };

  const currentDelegations = activeTab === 'created' ? createdDelegations : receivedDelegations;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Delegations
          </h1>
          <p className="text-sm mt-1 text-muted-foreground">
            Manage temporary authority delegations for your account.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Delegation
        </Button>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-success-subtle text-success-text'
              : 'bg-danger-subtle text-danger-text'
          }`}
        >
          {message.type === 'success' ? <Check className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-auto text-sm opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-border">
        <button
          onClick={() => setActiveTab('created')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'created'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Delegations I've Created
            {createdDelegations.filter((d) => d.status === 'active').length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {createdDelegations.filter((d) => d.status === 'active').length}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('received')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'received'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Delegations I've Received
            {receivedDelegations.filter((d) => d.status === 'active').length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-success-subtle text-success-text">
                {receivedDelegations.filter((d) => d.status === 'active').length}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Show Expired Toggle (only for created tab) */}
      {activeTab === 'created' && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showExpired"
            checked={showExpired}
            onChange={(e) => setShowExpired(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="showExpired" className="text-sm text-muted-foreground">
            Show expired & revoked delegations
          </label>
        </div>
      )}

      {/* Delegations List */}
      <Card className="divide-y divide-border border border-border">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : currentDelegations.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {activeTab === 'created'
                ? "You haven't created any delegations yet"
                : "You haven't received any delegations"}
            </p>
            {activeTab === 'created' && (
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create your first delegation
              </Button>
            )}
          </div>
        ) : (
          currentDelegations.map((delegation) => (
            <div key={delegation.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium text-foreground">
                      {delegation.name}
                    </h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full capitalize ${getStatusClasses(delegation.status)}`}
                    >
                      {delegation.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {activeTab === 'created' && delegation.delegate && (
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        <span>To: {delegation.delegate.displayName || delegation.delegate.email}</span>
                      </div>
                    )}
                    {activeTab === 'received' && delegation.delegator && (
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        <span>From: {delegation.delegator.displayName || delegation.delegator.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      <span>Ends {formatDate(delegation.endsAt)}</span>
                    </div>
                  </div>

                  {/* Permissions/Roles */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {delegation.delegatedRoles?.map((role) => (
                      <span
                        key={role}
                        className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground"
                      >
                        {role}
                      </span>
                    ))}
                    {delegation.delegatedPermissions?.slice(0, 5).map((perm) => (
                      <span
                        key={perm}
                        className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground"
                      >
                        {perm}
                      </span>
                    ))}
                    {(delegation.delegatedPermissions?.length || 0) > 5 && (
                      <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                        +{delegation.delegatedPermissions!.length - 5} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {activeTab === 'created' && delegation.status === 'active' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRevoke(delegation.id)}
                    disabled={revoking === delegation.id}
                    className="text-danger-text hover:text-danger-text"
                  >
                    {revoking === delegation.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </Card>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50">
          <Card className="w-full max-w-lg p-6 relative border border-border">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-semibold mb-6 text-foreground">
              Create Delegation
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">
                  Delegate Email *
                </label>
                <input
                  type="email"
                  value={createForm.delegateEmail}
                  onChange={(e) => setCreateForm({ ...createForm, delegateEmail: e.target.value })}
                  placeholder="colleague@company.com"
                  className="w-full p-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">
                  Delegation Name *
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Vacation Coverage"
                  className="w-full p-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">
                  Reason (optional)
                </label>
                <textarea
                  value={createForm.reason}
                  onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
                  placeholder="I'll be on vacation from..."
                  rows={3}
                  className="w-full p-3 rounded-xl resize-none bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">
                  Duration
                </label>
                <select
                  value={createForm.durationDays}
                  onChange={(e) => setCreateForm({ ...createForm, durationDays: parseInt(e.target.value) })}
                  className="w-full p-3 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value={1}>1 day</option>
                  <option value={3}>3 days</option>
                  <option value={7}>1 week</option>
                  <option value={14}>2 weeks</option>
                  <option value={30}>1 month</option>
                </select>
              </div>

              <div className="p-4 rounded-xl bg-muted">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    Permissions to Delegate
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  By default, all your permissions will be delegated. You can restrict this in the advanced settings.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !createForm.delegateEmail || !createForm.name}
                className="flex-1"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Delegation'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
