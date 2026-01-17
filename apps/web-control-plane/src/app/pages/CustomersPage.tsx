import { useState, useEffect, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { controlPlaneApi, Customer } from '../services/api';
import { Search, Plus, Server, Users, MoreVertical } from 'lucide-react';
import { colors } from '../theme/theme';

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: colors.success.base, bg: colors.success.glow, label: 'Active' },
  trial: { color: colors.info.base, bg: colors.info.glow, label: 'Trial' },
  suspended: { color: colors.warning.base, bg: colors.warning.glow, label: 'Suspended' },
  churned: { color: colors.danger.base, bg: colors.danger.glow, label: 'Churned' },
  pending: { color: colors.warning.base, bg: colors.warning.glow, label: 'Pending' },
  terminated: { color: colors.danger.base, bg: colors.danger.glow, label: 'Terminated' },
};

const tierConfig: Record<string, { color: string; bg: string; label: string }> = {
  enterprise: { color: colors.brand.primary, bg: colors.brand.glow, label: 'Enterprise' },
  professional: { color: colors.cyan.base, bg: colors.cyan.glow, label: 'Professional' },
  starter: { color: colors.text.secondary, bg: colors.glass.medium, label: 'Starter' },
};

export function CustomersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const query = searchParams.get('q') || '';
    setSearch(query);
  }, [searchParams]);

  useEffect(() => {
    const handleClick = () => setOpenMenuId(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const response = await controlPlaneApi.getCustomers({ search });
        setCustomers(response.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch customers:', err);
        setError('Failed to load customers. Please ensure the control plane service is running.');
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(timeoutId);
  }, [search]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    const nextParams = new URLSearchParams(searchParams);
    if (value.trim()) {
      nextParams.set('q', value.trim());
    } else {
      nextParams.delete('q');
    }
    setSearchParams(nextParams);
  };

  const handleMenuToggle = (event: MouseEvent, customerId: string) => {
    event.stopPropagation();
    setOpenMenuId((current) => (current === customerId ? null : customerId));
  };

  const handleDeleteCustomer = async (event: MouseEvent, customer: Customer) => {
    event.stopPropagation();
    setOpenMenuId(null);
    const confirmed = window.confirm(`Delete ${customer.name}? This removes the customer from the control plane.`);
    if (!confirmed) return;
    try {
      setDeletingId(customer.id);
      await controlPlaneApi.deleteCustomer(customer.id);
      setCustomers((prev) => prev.filter((item) => item.id !== customer.id));
      setError(null);
    } catch (err) {
      console.error('Failed to delete customer:', err);
      setError('Failed to delete customer.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>
          Customers
        </h1>
        <button
          type="button"
          onClick={() => navigate('new')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-opacity hover:opacity-90"
          style={{
            background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
          }}
        >
          <Plus size={18} />
          Add Customer
        </button>
      </div>

      {/* Search */}
      <div
        className="p-4 rounded-2xl border mb-6"
        style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg border"
          style={{ backgroundColor: colors.glass.medium, borderColor: colors.glass.border }}
        >
          <Search size={18} style={{ color: colors.text.muted }} />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search customers..."
            className="flex-1 bg-transparent border-none outline-none text-sm"  
            style={{ color: colors.text.primary }}
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="p-4 rounded-2xl border mb-6"
          style={{
            backgroundColor: colors.danger.glow,
            borderColor: colors.danger.base,
            color: colors.danger.base,
          }}
        >
          {error}
        </div>
      )}

      {/* Customer List */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <p className="text-center py-8" style={{ color: colors.text.secondary }}>
            Loading customers...
          </p>
        ) : (
          customers.map((customer) => {
            const status = statusConfig[customer.status] || {
              color: colors.text.muted,
              bg: colors.glass.medium,
              label: customer.status,
            };
            const tier = tierConfig[customer.tier] || {
              color: colors.text.muted,
              bg: colors.glass.medium,
              label: customer.tier,
            };

            return (
              <div
                key={customer.id}
                onClick={() => navigate(`/customers/${customer.id}`)}
                className="p-5 rounded-2xl border cursor-pointer transition-colors"
                style={{
                  backgroundColor: colors.void.base,
                  borderColor: colors.glass.border,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.glass.subtle;
                  e.currentTarget.style.borderColor = colors.glass.strong;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.void.base;
                  e.currentTarget.style.borderColor = colors.glass.border;
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                      style={{
                        backgroundColor: colors.glass.medium,
                        color: colors.text.secondary,
                      }}
                    >
                      {customer.name
                        ? customer.name
                            .split(' ')
                            .map((w) => w[0])
                            .join('')
                            .slice(0, 2)
                        : '??'}
                    </div>

                    {/* Info */}
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-base font-semibold" style={{ color: colors.text.primary }}>
                          {customer.name}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-semibold"
                          style={{ backgroundColor: status.bg, color: status.color }}
                        >
                          {status.label}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-semibold"
                          style={{ backgroundColor: tier.bg, color: tier.color }}
                        >
                          {tier.label}
                        </span>
                      </div>
                      <p className="text-sm mb-2" style={{ color: colors.text.tertiary }}>
                        {customer.code} • {customer.primaryContactEmail || 'No primary contact email'}
                      </p>
                      <div className="flex gap-6">
                        <div className="flex items-center gap-1.5">
                          <Server size={14} style={{ color: colors.text.muted }} />
                          <span className="text-xs" style={{ color: colors.text.secondary }}>
                            {customer.instances?.length || 0} instances
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users size={14} style={{ color: colors.text.muted }} />
                          <span className="text-xs" style={{ color: colors.text.secondary }}>
                            {((customer.totalUsers || 0) / 1000).toFixed(1)}K users    
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MRR */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-bold" style={{ color: colors.text.primary }}>
                      ${(customer.mrr / 1000).toFixed(0)}K
                    </div>
                    <div className="text-xs" style={{ color: colors.text.tertiary }}>
                      /month
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(event) => handleMenuToggle(event, customer.id)}
                      className="p-1.5 rounded transition-colors"
                      style={{ color: colors.text.muted }}
                    >
                      <MoreVertical size={18} />
                    </button>
                    {openMenuId === customer.id && (
                      <div
                        className="absolute right-0 mt-2 w-40 rounded-lg border overflow-hidden z-10"
                        style={{
                          backgroundColor: colors.void.base,
                          borderColor: colors.glass.border,
                          boxShadow: '0 16px 32px rgba(0,0,0,0.45)',
                        }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm transition-colors"
                          style={{ color: colors.text.primary }}
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMenuId(null);
                            navigate(`/customers/${customer.id}`);
                          }}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm transition-colors"
                          style={{ color: colors.text.primary }}
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMenuId(null);
                            navigate(`/customers/${customer.id}?edit=1`);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm transition-colors"
                          style={{ color: colors.danger.base }}
                          disabled={deletingId === customer.id}
                          onClick={(event) => handleDeleteCustomer(event, customer)}
                        >
                          {deletingId === customer.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
          })
        )}
      </div>

      {!loading && customers.length === 0 && (
        <div className="text-center py-16" style={{ color: colors.text.tertiary }}>
          <h3 className="text-base font-semibold mb-2" style={{ color: colors.text.secondary }}>
            No customers found
          </h3>
          <p className="text-sm">
            {search ? 'Try adjusting your search criteria' : 'Click "Add Customer" to get started'}
          </p>
        </div>
      )}
    </div>
  );
}

export default CustomersPage;
