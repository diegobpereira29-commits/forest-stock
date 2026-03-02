import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 25;

export { PAGE_SIZE };

export default function Pagination({ page, totalPages, onChange, totalItems, pageSize = PAGE_SIZE }) {
  if (totalPages <= 1) return (
    <p className="text-xs text-gray-400">{totalItems} registro(s)</p>
  );

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <p className="text-xs text-gray-400">{from}–{to} de {totalItems} registro(s)</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce((acc, p, idx, arr) => {
            if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
            acc.push(p);
            return acc;
          }, [])
          .map((p, idx) =>
            p === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-1 text-gray-400 text-xs">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p)}
                className={`min-w-[28px] h-7 px-1.5 text-xs rounded-lg border transition-colors ${
                  p === page
                    ? 'bg-green-600 text-white border-green-600 font-semibold'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {p}
              </button>
            )
          )}

        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}