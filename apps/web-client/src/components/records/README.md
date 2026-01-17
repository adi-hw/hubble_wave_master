# Record Versioning Components

Production-ready UI components for displaying and managing record version history in the HubbleWave Platform.

## Components

### VersionHistory

A comprehensive panel that displays the complete version history for a record.

**Features:**
- Chronological list of all versions with timeline visualization
- Timestamp and user information for each version
- Version comparison capabilities (select up to 2 versions)
- Rollback functionality with confirmation modal
- Expandable version details
- Changed fields display
- Color-coded change types (created, updated, deleted, restored)
- Current version indicator
- Accessible with ARIA labels and keyboard navigation
- 44px minimum touch targets for mobile

**Props:**
```typescript
interface VersionHistoryProps {
  versions: RecordVersion[];           // Array of version objects
  currentVersion: number;              // Current version number
  onRollback?: (versionId: string) => Promise<void>;  // Rollback handler
  onCompare?: (versionId1: string, versionId2: string) => void;  // Compare handler
  loading?: boolean;                   // Loading state
  error?: string;                      // Error message
  className?: string;                  // Additional CSS classes
  maxHeight?: string;                  // Maximum height (default: '600px')
  showRollback?: boolean;             // Show rollback buttons (default: true)
  showCompare?: boolean;              // Show compare functionality (default: true)
  isReadOnly?: boolean;               // Disable rollback in read-only mode
}

interface RecordVersion {
  id: string;                         // Unique version ID
  version: number;                    // Version number
  timestamp: Date | string;           // When the version was created
  userId: string;                     // User who created the version
  userName: string;                   // User's display name
  userEmail?: string;                 // User's email
  userAvatar?: string;                // User's avatar URL
  changeType: 'created' | 'updated' | 'deleted' | 'restored';
  changeDescription?: string;         // Description of changes
  changedFields?: string[];           // List of changed field names
  data: Record<string, any>;          // The actual record data
  metadata?: Record<string, any>;     // Additional metadata
}
```

**Usage Example:**
```tsx
import { VersionHistory } from '@/components/records';

function RecordDetailPage() {
  const [versions, setVersions] = useState<RecordVersion[]>([]);

  const handleRollback = async (versionId: string) => {
    await api.rollbackToVersion(recordId, versionId);
    // Refresh versions
    const updated = await api.getVersionHistory(recordId);
    setVersions(updated);
  };

  return (
    <VersionHistory
      versions={versions}
      currentVersion={5}
      onRollback={handleRollback}
      showRollback={true}
      showCompare={true}
    />
  );
}
```

### VersionCompare

A side-by-side comparison component that highlights differences between two record versions.

**Features:**
- Visual diff with color-coded changes
  - Green: Added fields
  - Red: Removed fields
  - Yellow: Changed fields
  - Gray: Unchanged fields
- Field-level comparison with labels and values
- Support for complex data types (objects, arrays, primitives)
- Expandable/collapsible sections for nested data
- Statistics summary (counts of added/removed/changed fields)
- Metadata display showing version info and authors

**Props:**
```typescript
interface VersionCompareProps {
  oldVersion: RecordVersion;          // Previous version to compare
  newVersion: RecordVersion;          // Current version to compare
  className?: string;                 // Additional CSS classes
  fieldLabels?: Record<string, string>;  // Custom field labels
  excludeFields?: string[];           // Fields to exclude from comparison
  showMetadata?: boolean;             // Show version metadata (default: true)
}
```

**Usage Example:**
```tsx
import { VersionCompare } from '@/components/records';

function CompareVersionsModal({ version1, version2 }) {
  return (
    <Modal open={true} size="xl">
      <VersionCompare
        oldVersion={version1}
        newVersion={version2}
        fieldLabels={{
          firstName: 'First Name',
          lastName: 'Last Name',
          email: 'Email Address',
        }}
        excludeFields={['_id', 'createdAt', 'updatedAt']}
      />
    </Modal>
  );
}
```

## Complete Integration Example

```tsx
import React, { useState, useEffect } from 'react';
import { VersionHistory, RecordVersion } from '@/components/records';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api';

export function RecordVersioningPanel({ recordId }: { recordId: string }) {
  const [versions, setVersions] = useState<RecordVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    loadVersionHistory();
  }, [recordId]);

  const loadVersionHistory = async () => {
    try {
      setLoading(true);
      const data = await api.getVersionHistory(recordId);
      setVersions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (versionId: string) => {
    try {
      await api.rollbackToVersion(recordId, versionId);
      await loadVersionHistory();
    } catch (err) {
      console.error('Rollback failed:', err);
      throw err;
    }
  };

  return (
    <div className="p-6">
      <VersionHistory
        versions={versions}
        currentVersion={versions[0]?.version || 1}
        onRollback={handleRollback}
        loading={loading}
        error={error}
        maxHeight="calc(100vh - 200px)"
      />
    </div>
  );
}
```

## Design Tokens Used

All components use HubbleWave design tokens for consistent styling:

### Colors
- `--hw-surface-primary` - Main surface background
- `--hw-surface-secondary` - Secondary surface background
- `--hw-surface-hover` - Hover state background
- `--hw-content-primary` - Primary text color
- `--hw-content-secondary` - Secondary text color
- `--hw-content-tertiary` - Tertiary text color
- `--hw-border-default` - Default border color
- `--hw-border-subtle` - Subtle border color
- `--hw-interactive-primary` - Primary interactive color
- `--hw-interactive-primary-subtle` - Subtle primary color
- `--hw-status-success` - Success state color
- `--hw-status-success-subtle` - Subtle success background
- `--hw-status-success-border` - Success border color
- `--hw-status-error` - Error state color
- `--hw-status-error-subtle` - Subtle error background
- `--hw-status-error-border` - Error border color
- `--hw-status-warning` - Warning state color
- `--hw-status-warning-subtle` - Subtle warning background
- `--hw-status-warning-border` - Warning border color
- `--hw-status-info` - Info state color
- `--hw-status-info-subtle` - Subtle info background
- `--hw-status-info-border` - Info border color

## Accessibility

Both components follow WCAG 2.1 Level AA guidelines:

- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **ARIA Labels**: Proper ARIA labels and roles for screen readers
- **Focus Management**: Clear focus indicators with proper focus management
- **Touch Targets**: Minimum 44px touch targets for mobile devices
- **Color Contrast**: All text meets minimum contrast ratios
- **Semantic HTML**: Proper semantic markup for assistive technologies

## Mobile Responsiveness

- Touch-friendly button sizes (44px minimum)
- Responsive grid layouts
- Scrollable containers with custom scrollbars
- Optimized for both desktop and mobile viewports
- Support for touch gestures

## Best Practices

1. **Always provide version data**: The components don't fetch data themselves - pass version data as props
2. **Handle errors gracefully**: Use the `error` prop to display error messages
3. **Show loading states**: Use the `loading` prop during data fetching
4. **Implement rollback carefully**: Always confirm before rolling back and refresh data after
5. **Exclude sensitive fields**: Use `excludeFields` to hide internal/sensitive data from comparison
6. **Provide field labels**: Use `fieldLabels` for user-friendly field names instead of technical keys
7. **Test with complex data**: Ensure nested objects and arrays render correctly
8. **Consider permissions**: Use `isReadOnly` to disable rollback for users without edit permissions

## Performance Considerations

- Components use `useMemo` for expensive computations (diff calculation, sorting)
- Lazy expansion of version details and complex values
- Efficient re-rendering with proper dependency arrays
- Virtualization recommended for very long version histories (>100 versions)

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- PWA support
- No IE11 support
