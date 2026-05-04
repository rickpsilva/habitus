import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginatedResponse } from '../types';

interface PaginationProps {
  pagination: PaginatedResponse<unknown>;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ pagination, currentPage, onPageChange }: PaginationProps) {
  if (!pagination || pagination.totalPages <= 1) return null;

  const goToPage = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      onPageChange(page);
    }
  };

  return (
    <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3">
      <div className="text-sm text-gray-600">
        Página {pagination.page} de {pagination.totalPages} • {pagination.totalItems} total
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={!pagination.hasPreviousPage}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:hover:bg-gray-100"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </button>
        
        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
            .filter(page => {
              // Show first page, last page, current page, and pages around current
              return page === 1 || 
                     page === pagination.totalPages || 
                     Math.abs(page - currentPage) <= 1;
            })
            .map((page, idx, arr) => {
              // Add ellipsis
              const prevPage = arr[idx - 1];
              const showEllipsis = prevPage && page - prevPage > 1;
              
              return (
                <div key={page} className="flex items-center gap-1">
                  {showEllipsis && <span className="px-2 text-gray-400">...</span>}
                  <button
                    onClick={() => goToPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === currentPage
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:hover:bg-gray-100"
        >
          Seguinte
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
