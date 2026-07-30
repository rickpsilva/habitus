import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginatedResponse } from '../types';

interface PaginationProps {
  pagination: PaginatedResponse<unknown>;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ pagination, currentPage, onPageChange }: PaginationProps) {
  if (!pagination) return null;

  const goToPage = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  const itemsLabel = pagination.totalItems === 1 ? '1 resultado' : `${pagination.totalItems} resultados`;

  if (pagination.totalPages <= 1) {
    return (
      <div className="flex items-center bg-surface rounded-xl border border-line px-4 py-3">
        <p className="text-sm text-ink-subtle">{itemsLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-surface rounded-xl border border-line px-4 py-3">
      <div className="text-sm text-ink-muted">
        Página {pagination.page} de {pagination.totalPages} • {itemsLabel}
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={!pagination.hasPreviousPage}
          aria-label="Página anterior"
          className="h-9 inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-control text-ink hover:bg-control-hover disabled:hover:bg-control"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </button>
        
        {/* Page numbers */}
        <div className="hidden sm:flex items-center gap-1">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
            .filter(page => {
              return page === 1 || 
                     page === pagination.totalPages || 
                     Math.abs(page - currentPage) <= 1;
            })
            .map((page, idx, arr) => {
              const prevPage = arr[idx - 1];
              const showEllipsis = prevPage && page - prevPage > 1;
              
              return (
                <div key={page} className="flex items-center gap-1">
                  {showEllipsis && <span className="px-2 text-ink-subtle" aria-hidden="true">...</span>}
                  <button
                    onClick={() => goToPage(page)}
                    aria-label={`Página ${page}`}
                    aria-current={page === currentPage ? 'page' : undefined}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === currentPage
                        ? 'bg-indigo-600 text-white'
                        : 'bg-control text-ink hover:bg-control-hover'
                    }`}
                  >
                    {page}
                  </button>
                </div>
              );
            })}
        </div>

        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={!pagination.hasNextPage}
          aria-label="Próxima página"
          className="h-9 inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-control text-ink hover:bg-control-hover disabled:hover:bg-control"
        >
          Seguinte
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
