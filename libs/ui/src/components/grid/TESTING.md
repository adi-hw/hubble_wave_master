# HubbleDataGrid Testing Guide

## 1. Quick Start Test

### Step 1: Start the Backend Services

```bash
# Terminal 1 - Start database (if using Docker)
docker-compose up -d postgres

# Terminal 2 - Start svc-data service
npx nx serve svc-data
```

### Step 2: Start the Frontend

```bash
# Terminal 3 - Start web-client
npx nx serve web-client
```

### Step 3: Create a Test Page

Create a simple test page in your web-client app:

```tsx
// apps/web-client/src/app/pages/GridTest.tsx
import { HubbleDataGrid, GridColumn } from '@hubblewave/ui';

const columns: GridColumn[] = [
  { code: 'id', label: 'ID', type: 'text', width: 100 },
  { code: 'name', label: 'Name', type: 'text', width: 200 },
  { code: 'status', label: 'Status', type: 'status', width: 120 },
  { code: 'priority', label: 'Priority', type: 'priority', width: 100 },
  { code: 'created_at', label: 'Created', type: 'datetime', width: 180 },
];

// Mock data for testing without backend
const mockData = Array.from({ length: 1000 }, (_, i) => ({
  id: `row-${i + 1}`,
  name: `Item ${i + 1}`,
  status: ['open', 'in_progress', 'completed', 'cancelled'][i % 4],
  priority: ['low', 'medium', 'high', 'critical'][i % 4],
  created_at: new Date(Date.now() - i * 86400000).toISOString(),
}));

export function GridTestPage() {
  return (
    <div className="h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">HubbleDataGrid Test</h1>

      {/* Test with controlled data (no backend needed) */}
      <HubbleDataGrid
        data={mockData}
        columns={columns}
        height="calc(100vh - 120px)"
        onRowClick={(row) => console.log('Row clicked:', row)}
        onRowDoubleClick={(row) => console.log('Row double-clicked:', row)}
        enableAva={false}
      />
    </div>
  );
}
```

## 2. Unit Testing

### Install Testing Dependencies

```bash
npm install -D @testing-library/react @testing-library/jest-dom vitest jsdom
```

### Create Test File

```tsx
// libs/ui/src/components/grid/__tests__/HubbleDataGrid.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HubbleDataGrid } from '../HubbleDataGrid';
import type { GridColumn } from '../types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const columns: GridColumn[] = [
  { code: 'id', label: 'ID', type: 'text' },
  { code: 'name', label: 'Name', type: 'text' },
];

const mockData = [
  { id: '1', name: 'Item 1' },
  { id: '2', name: 'Item 2' },
  { id: '3', name: 'Item 3' },
];

describe('HubbleDataGrid', () => {
  it('renders with controlled data', () => {
    render(
      <HubbleDataGrid data={mockData} columns={columns} />,
      { wrapper }
    );

    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('calls onRowClick when row is clicked', () => {
    const onRowClick = vi.fn();
    render(
      <HubbleDataGrid
        data={mockData}
        columns={columns}
        onRowClick={onRowClick}
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByText('Item 1'));
    expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('supports row selection', () => {
    const onSelectionChange = vi.fn();
    render(
      <HubbleDataGrid
        data={mockData}
        columns={columns}
        enableRowSelection
        onSelectionChange={onSelectionChange}
      />,
      { wrapper }
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // Click first row checkbox

    expect(onSelectionChange).toHaveBeenCalled();
  });

  it('shows empty state when no data', () => {
    render(
      <HubbleDataGrid
        data={[]}
        columns={columns}
        emptyMessage="No records found"
      />,
      { wrapper }
    );

    expect(screen.getByText('No records found')).toBeInTheDocument();
  });

  it('applies density mode correctly', () => {
    const { container } = render(
      <HubbleDataGrid
        data={mockData}
        columns={columns}
        density="compact"
      />,
      { wrapper }
    );

    expect(container.querySelector('[data-density="compact"]')).toBeInTheDocument();
  });
});
```

## 3. Backend API Testing

### Test Grid Query Endpoint

```bash
# Get JWT token first (replace with your auth method)
TOKEN="your-jwt-token"

# Test query endpoint
curl -X POST http://localhost:3002/api/grid/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "collection": "work_orders",
    "startRow": 0,
    "endRow": 100,
    "sorting": [{"column": "created_at", "direction": "desc"}]
  }'

# Test count endpoint
curl -X POST http://localhost:3002/api/grid/count \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "collection": "work_orders"
  }'

# Test with filters
curl -X POST http://localhost:3002/api/grid/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "collection": "work_orders",
    "startRow": 0,
    "endRow": 50,
    "filters": [
      {"column": "status", "operator": "equals", "value": "open"}
    ],
    "globalFilter": "pump"
  }'
```

## 4. Performance Testing

### Test with Large Dataset

```tsx
// Generate 100k mock records for stress testing
const generateLargeDataset = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${i}`,
    name: `Item ${i}`,
    description: `Description for item ${i}`,
    status: ['open', 'closed', 'pending'][i % 3],
    priority: i % 5,
    created_at: new Date(Date.now() - i * 1000).toISOString(),
  }));
};

// In your test component
const largeData = generateLargeDataset(100000);

<HubbleDataGrid
  data={largeData}
  columns={columns}
  height="600px"
/>
```

### Performance Metrics to Check

1. **Initial render time** - Should be < 100ms
2. **Scroll performance** - Should maintain 60fps
3. **Memory usage** - Should not exceed 200MB for 100k rows
4. **Time to first contentful paint** - < 500ms

## 5. Keyboard Navigation Testing

| Key | Expected Behavior |
|-----|-------------------|
| Arrow Down | Move to next row |
| Arrow Up | Move to previous row |
| Page Down | Jump 10 rows down |
| Page Up | Jump 10 rows up |
| Home (Ctrl) | Go to first row |
| End (Ctrl) | Go to last row |
| Enter | Trigger onRowClick |
| Ctrl+Enter | Trigger onRowDoubleClick |
| Space | Toggle row selection |
| Ctrl+A | Select all rows |
| Escape | Clear selection |

## 6. Accessibility Testing

### Use Browser DevTools

1. Open Chrome DevTools → Lighthouse
2. Run Accessibility audit
3. Target score: 90+

### Screen Reader Testing

Test with:
- NVDA (Windows)
- VoiceOver (Mac)
- JAWS (Windows)

Verify:
- Grid role is announced
- Row count is announced
- Column headers are readable
- Selection state is announced

## 7. Integration Test with Real Backend

```tsx
// Full SSRM integration test
import { HubbleDataGrid } from '@hubblewave/ui';

export function SSRMTestPage() {
  return (
    <HubbleDataGrid
      collection="work_orders"  // Must exist in your database
      columns={[
        { code: 'wo_number', label: 'WO #', type: 'text' },
        { code: 'description', label: 'Description', type: 'text' },
        { code: 'status', label: 'Status', type: 'status' },
        { code: 'priority', label: 'Priority', type: 'priority' },
        { code: 'assigned_to', label: 'Assigned To', type: 'user' },
        { code: 'created_at', label: 'Created', type: 'datetime' },
      ]}
      enableSSRM={true}
      pageSize={100}
      blockSize={100}
      height="calc(100vh - 100px)"
      onRowClick={(row) => console.log('Selected:', row)}
    />
  );
}
```

## 8. Export Testing

```tsx
import { useGridExport } from '@hubblewave/ui';

function ExportTest() {
  // Test export functionality
  const handleExport = async () => {
    const { exportData } = useGridExport({
      table: tableInstance,
      columns: columns,
      collection: 'work_orders',
      totalRowCount: 1000,
    });

    // Test CSV export
    await exportData({ format: 'csv', scope: 'all' });

    // Test JSON export
    await exportData({ format: 'json', scope: 'selected' });
  };
}
```

## 9. Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Grid not rendering | Ensure QueryClientProvider wraps component |
| SSRM not fetching | Check collection name matches backend |
| Virtualization broken | Ensure container has fixed height |
| Styling issues | Import grid-tokens.css in your app |
| TypeScript errors | Verify @tanstack/react-table version |

## 10. Run All Tests

```bash
# Run unit tests
npx nx test ui

# Run e2e tests
npx nx e2e web-client-e2e

# Run with coverage
npx nx test ui --coverage
```
