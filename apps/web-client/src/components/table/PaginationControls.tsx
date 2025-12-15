import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  totalItems: number;
  currentCount?: number;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  totalItems,
}) => {
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      {/* Record count */}
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Showing{' '}
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
          {startItem}
        </span>{' '}
        to{' '}
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
          {endItem}
        </span>{' '}
        of{' '}
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
          {totalItems}
        </span>{' '}
        results
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Rows
          </label>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="input h-8 px-2 pr-8 text-sm cursor-pointer"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => {
              if (page !== 1) {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                e.currentTarget.style.borderColor = 'var(--border-strong)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
              e.currentTarget.style.borderColor = 'var(--border-default)';
            }}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Page numbers */}
          <div className="flex items-center">
            {totalPages <= 5 ? (
              Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <PageButton
                  key={p}
                  page={p}
                  currentPage={page}
                  onPageChange={onPageChange}
                />
              ))
            ) : (
              <>
                <PageButton page={1} currentPage={page} onPageChange={onPageChange} />
                {page > 3 && (
                  <span className="px-1" style={{ color: 'var(--text-muted)' }}>
                    ...
                  </span>
                )}
                {page > 2 && page < totalPages && (
                  <PageButton page={page - 1} currentPage={page} onPageChange={onPageChange} />
                )}
                {page !== 1 && page !== totalPages && (
                  <PageButton page={page} currentPage={page} onPageChange={onPageChange} />
                )}
                {page < totalPages - 1 && page > 1 && (
                  <PageButton page={page + 1} currentPage={page} onPageChange={onPageChange} />
                )}
                {page < totalPages - 2 && (
                  <span className="px-1" style={{ color: 'var(--text-muted)' }}>
                    ...
                  </span>
                )}
                <PageButton page={totalPages} currentPage={page} onPageChange={onPageChange} />
              </>
            )}
          </div>

          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => {
              if (page < totalPages) {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                e.currentTarget.style.borderColor = 'var(--border-strong)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
              e.currentTarget.style.borderColor = 'var(--border-default)';
            }}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const PageButton: React.FC<{
  page: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}> = ({ page, currentPage, onPageChange }) => {
  const isActive = page === currentPage;

  return (
    <button
      onClick={() => onPageChange(page)}
      className="h-8 min-w-[2rem] px-2 text-sm font-medium rounded-lg transition-colors"
      style={{
        backgroundColor: isActive ? 'var(--bg-primary-subtle)' : 'transparent',
        color: isActive ? 'var(--text-brand)' : 'var(--text-secondary)',
        border: isActive ? '1px solid var(--border-primary)' : '1px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      {page}
    </button>
  );
};
