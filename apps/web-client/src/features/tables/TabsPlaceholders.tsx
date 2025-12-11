import React from 'react';
import { Layout, BarChart3, Wrench } from 'lucide-react';
import { Card } from '../../components/ui/Card';

export const LayoutsTab: React.FC = () => (
  <div className="flex flex-col gap-6">
    {/* Header */}
    <div>
      <h2 className="text-lg font-semibold" style={{ color: 'var(--hw-text)' }}>
        Layouts
      </h2>
      <p className="text-sm mt-0.5" style={{ color: 'var(--hw-text-muted)' }}>
        Configure how this table appears in lists, forms, and detail views
      </p>
    </div>

    {/* Coming Soon Card */}
    <Card variant="default" padding="lg" className="text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
      >
        <Layout className="w-8 h-8" style={{ color: 'var(--hw-primary)' }} />
      </div>
      <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--hw-text)' }}>
        Layout Designer Coming Soon
      </h3>
      <p className="text-sm max-w-md mx-auto mb-6" style={{ color: 'var(--hw-text-muted)' }}>
        The visual layout designer will allow you to customize list columns, form layouts,
        and detail page configurations with drag-and-drop simplicity.
      </p>

      {/* Feature Preview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <div
          className="p-4 rounded-xl"
          style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
        >
          <div className="text-sm font-medium mb-1" style={{ color: 'var(--hw-text)' }}>
            List Views
          </div>
          <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
            Configure columns, sorting, and grouping
          </p>
        </div>
        <div
          className="p-4 rounded-xl"
          style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
        >
          <div className="text-sm font-medium mb-1" style={{ color: 'var(--hw-text)' }}>
            Form Layouts
          </div>
          <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
            Design create and edit forms
          </p>
        </div>
        <div
          className="p-4 rounded-xl"
          style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
        >
          <div className="text-sm font-medium mb-1" style={{ color: 'var(--hw-text)' }}>
            Detail Pages
          </div>
          <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
            Customize record detail views
          </p>
        </div>
      </div>
    </Card>
  </div>
);

export const UsageTab: React.FC = () => (
  <div className="flex flex-col gap-6">
    {/* Header */}
    <div>
      <h2 className="text-lg font-semibold" style={{ color: 'var(--hw-text)' }}>
        Usage Analytics
      </h2>
      <p className="text-sm mt-0.5" style={{ color: 'var(--hw-text-muted)' }}>
        Monitor how this table is being used across your organization
      </p>
    </div>

    {/* Coming Soon Card */}
    <Card variant="default" padding="lg" className="text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)' }}
      >
        <BarChart3 className="w-8 h-8" style={{ color: '#8b5cf6' }} />
      </div>
      <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--hw-text)' }}>
        Usage Analytics Coming Soon
      </h3>
      <p className="text-sm max-w-md mx-auto mb-6" style={{ color: 'var(--hw-text-muted)' }}>
        Track record counts, API usage, user activity, and performance metrics
        to understand how this table is being utilized.
      </p>

      {/* Metrics Preview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
        <div
          className="p-4 rounded-xl"
          style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
        >
          <div className="text-2xl font-bold mb-1" style={{ color: 'var(--hw-text-muted)' }}>
            —
          </div>
          <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
            Total Records
          </p>
        </div>
        <div
          className="p-4 rounded-xl"
          style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
        >
          <div className="text-2xl font-bold mb-1" style={{ color: 'var(--hw-text-muted)' }}>
            —
          </div>
          <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
            API Calls (24h)
          </p>
        </div>
        <div
          className="p-4 rounded-xl"
          style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
        >
          <div className="text-2xl font-bold mb-1" style={{ color: 'var(--hw-text-muted)' }}>
            —
          </div>
          <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
            Active Users
          </p>
        </div>
        <div
          className="p-4 rounded-xl"
          style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
        >
          <div className="text-2xl font-bold mb-1" style={{ color: 'var(--hw-text-muted)' }}>
            —
          </div>
          <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
            Avg. Response
          </p>
        </div>
      </div>
    </Card>

    {/* Dependencies Section */}
    <Card variant="default" padding="md">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}
        >
          <Wrench className="h-5 w-5" style={{ color: '#f59e0b' }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--hw-text)' }}>
            Dependencies
          </h3>
          <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
            Tables and features that depend on this table
          </p>
        </div>
      </div>
      <div
        className="p-4 rounded-lg text-center"
        style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
      >
        <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
          Dependency tracking will be available soon
        </p>
      </div>
    </Card>
  </div>
);

export default { LayoutsTab, UsageTab };
