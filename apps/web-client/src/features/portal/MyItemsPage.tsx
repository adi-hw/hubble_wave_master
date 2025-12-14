import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Search,
  FileText,
  ShoppingCart,
  ThumbsUp,
  Eye,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

type RequestStatus =
  | 'draft'
  | 'submitted'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'fulfilled'
  | 'closed'
  | 'cancelled';

type TabType = 'requests' | 'approvals' | 'watching';

interface MyRequest {
  id: string;
  number: string;
  itemLabel: string;
  status: RequestStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  submittedAt: string;
  dueDate?: string;
  assignedTo?: string;
  lastUpdate: string;
}

interface ApprovalItem {
  id: string;
  requestNumber: string;
  requestedBy: string;
  itemLabel: string;
  requestedAt: string;
  description: string;
}

interface WatchedItem {
  id: string;
  type: 'request' | 'incident' | 'change';
  number: string;
  label: string;
  status: string;
  lastUpdate: string;
}

const statusConfig: Record<
  RequestStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  draft: { label: 'Draft', color: 'gray', icon: FileText },
  submitted: { label: 'Submitted', color: 'blue', icon: Clock },
  pending_approval: { label: 'Pending Approval', color: 'amber', icon: AlertCircle },
  approved: { label: 'Approved', color: 'green', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'red', icon: XCircle },
  in_progress: { label: 'In Progress', color: 'indigo', icon: Loader2 },
  fulfilled: { label: 'Fulfilled', color: 'emerald', icon: CheckCircle },
  closed: { label: 'Closed', color: 'gray', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'gray', icon: XCircle },
};

export function MyItemsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('requests');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');

  // Mock data
  const myRequests: MyRequest[] = [
    {
      id: '1',
      number: 'REQ0012345',
      itemLabel: 'New Laptop Request',
      status: 'in_progress',
      priority: 'medium',
      submittedAt: 'Dec 10, 2024',
      dueDate: 'Dec 17, 2024',
      assignedTo: 'IT Support',
      lastUpdate: '2 hours ago',
    },
    {
      id: '2',
      number: 'REQ0012346',
      itemLabel: 'VPN Access Request',
      status: 'pending_approval',
      priority: 'high',
      submittedAt: 'Dec 12, 2024',
      lastUpdate: '1 day ago',
    },
    {
      id: '3',
      number: 'REQ0012340',
      itemLabel: 'Software Installation - Adobe Creative Suite',
      status: 'fulfilled',
      priority: 'low',
      submittedAt: 'Dec 5, 2024',
      lastUpdate: '3 days ago',
    },
    {
      id: '4',
      number: 'REQ0012335',
      itemLabel: 'Meeting Room Booking',
      status: 'closed',
      priority: 'low',
      submittedAt: 'Dec 1, 2024',
      lastUpdate: '1 week ago',
    },
  ];

  const pendingApprovals: ApprovalItem[] = [
    {
      id: '1',
      requestNumber: 'REQ0012350',
      requestedBy: 'Jane Smith',
      itemLabel: 'Software License - Microsoft Project',
      requestedAt: 'Dec 13, 2024',
      description: 'Need for project management activities',
    },
  ];

  const watchedItems: WatchedItem[] = [
    {
      id: '1',
      type: 'incident',
      number: 'INC0045678',
      label: 'Network connectivity issue in Building A',
      status: 'In Progress',
      lastUpdate: '30 minutes ago',
    },
    {
      id: '2',
      type: 'change',
      number: 'CHG0001234',
      label: 'Server maintenance - Production DB',
      status: 'Scheduled',
      lastUpdate: '2 hours ago',
    },
  ];

  const filteredRequests = myRequests.filter((request) => {
    const matchesSearch =
      !search ||
      request.number.toLowerCase().includes(search.toLowerCase()) ||
      request.itemLabel.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: RequestStatus) => {
    const config = statusConfig[status];
    const colorMap: Record<string, string> = {
      gray: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400',
      blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
      amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
      green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
      red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
      indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
      emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorMap[config.color]}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
            <Link to="/portal" className="hover:text-indigo-600 dark:hover:text-indigo-400">
              Service Portal
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">My Items</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            My Items
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Track your requests, approvals, and watched items
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {myRequests.filter((r) => !['closed', 'cancelled', 'fulfilled'].includes(r.status)).length}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Open Requests</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {pendingApprovals.length}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pending Approvals</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {myRequests.filter((r) => r.status === 'fulfilled' || r.status === 'closed').length}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {watchedItems.length}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Watching</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('requests')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'requests'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              My Requests ({myRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'approvals'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Pending Approvals ({pendingApprovals.length})
            </button>
            <button
              onClick={() => setActiveTab('watching')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'watching'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Watching ({watchedItems.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'requests' && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 max-w-md relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search requests..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as RequestStatus | 'all')}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="in_progress">In Progress</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Requests List */}
            <div className="space-y-3">
              {filteredRequests.map((request) => (
                <Link key={request.id} to={`/portal/requests/${request.id}`}>
                  <Card className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm text-indigo-600 dark:text-indigo-400">
                            {request.number}
                          </span>
                          {getStatusBadge(request.status)}
                        </div>
                        <h3 className="font-medium text-gray-900 dark:text-white mt-1">
                          {request.itemLabel}
                        </h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                          <span>Submitted: {request.submittedAt}</span>
                          {request.dueDate && <span>Due: {request.dueDate}</span>}
                          {request.assignedTo && <span>Assigned to: {request.assignedTo}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Updated {request.lastUpdate}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>

            {filteredRequests.length === 0 && (
              <div className="text-center py-12">
                <ShoppingCart className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No requests found
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  {search || statusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : "You haven't made any requests yet"}
                </p>
                <Link
                  to="/portal/catalog"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Browse Catalog
                </Link>
              </div>
            )}
          </>
        )}

        {activeTab === 'approvals' && (
          <div className="space-y-3">
            {pendingApprovals.map((approval) => (
              <Card key={approval.id} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-indigo-600 dark:text-indigo-400">
                        {approval.requestNumber}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        by {approval.requestedBy}
                      </span>
                    </div>
                    <h3 className="font-medium text-gray-900 dark:text-white mt-1">
                      {approval.itemLabel}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {approval.description}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Requested: {approval.requestedAt}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="inline-flex items-center px-3 py-1.5 border border-red-300 dark:border-red-700 text-sm font-medium rounded-lg text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                      <XCircle className="w-4 h-4 mr-1.5" />
                      Reject
                    </button>
                    <button className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700">
                      <ThumbsUp className="w-4 h-4 mr-1.5" />
                      Approve
                    </button>
                  </div>
                </div>
              </Card>
            ))}

            {pendingApprovals.length === 0 && (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No pending approvals
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  You're all caught up!
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'watching' && (
          <div className="space-y-3">
            {watchedItems.map((item) => (
              <Card key={item.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-indigo-600 dark:text-indigo-400">
                        {item.number}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 rounded">
                        {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                        {item.status}
                      </span>
                    </div>
                    <h3 className="font-medium text-gray-900 dark:text-white mt-1">
                      {item.label}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Updated {item.lastUpdate}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </Card>
            ))}

            {watchedItems.length === 0 && (
              <div className="text-center py-12">
                <Eye className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Not watching anything
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Watch items to track their progress here
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
