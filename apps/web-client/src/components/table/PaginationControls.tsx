import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  totalItems: number;
  currentCount?: number; // Optional - kept for backwards compatibility
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-100">
      {/* Record count */}
      <div className="text-sm text-slate-600">
        Showing <span className="font-medium text-slate-900">{startItem}</span> to{' '}
        <span className="font-medium text-slate-900">{endItem}</span> of{' '}
        <span className="font-medium text-slate-900">{totalItems}</span> results
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Rows</label>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="h-8 px-2 pr-8 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:border-primary-300 focus:ring-2 focus:ring-primary-100 focus:outline-none cursor-pointer appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
              backgroundPosition: 'right 0.5rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1rem',
            }}
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
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Page numbers */}
          <div className="flex items-center">
            {totalPages <= 5 ? (
              // Show all pages if 5 or fewer
              Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={`
                    h-8 min-w-[2rem] px-2 text-sm font-medium rounded-lg transition-colors
                    ${p === page
                      ? 'bg-primary-50 text-primary-700 border border-primary-200'
                      : 'text-slate-600 hover:bg-slate-50'
                    }
                  `}
                >
                  {p}
                </button>
              ))
            ) : (
              // Show abbreviated page numbers
              <>
                <PageButton page={1} currentPage={page} onPageChange={onPageChange} />
                {page > 3 && <span className="px-1 text-slate-400">...</span>}
                {page > 2 && page < totalPages && (
                  <PageButton page={page - 1} currentPage={page} onPageChange={onPageChange} />
                )}
                {page !== 1 && page !== totalPages && (
                  <PageButton page={page} currentPage={page} onPageChange={onPageChange} />
                )}
                {page < totalPages - 1 && page > 1 && (
                  <PageButton page={page + 1} currentPage={page} onPageChange={onPageChange} />
                )}
                {page < totalPages - 2 && <span className="px-1 text-slate-400">...</span>}
                <PageButton page={totalPages} currentPage={page} onPageChange={onPageChange} />
              </>
            )}
          </div>

          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-colors"
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
}> = ({ page, currentPage, onPageChange }) => (
  <button
    onClick={() => onPageChange(page)}
    className={`
      h-8 min-w-[2rem] px-2 text-sm font-medium rounded-lg transition-colors
      ${page === currentPage
        ? 'bg-primary-50 text-primary-700 border border-primary-200'
        : 'text-slate-600 hover:bg-slate-50'
      }
    `}
  >
    {page}
  </button>
);
