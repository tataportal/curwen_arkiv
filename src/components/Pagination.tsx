'use client';
export default function Pagination({ page, pageSize, total, disabled = false, onChange }: {
  page: number; pageSize: number; total: number; disabled?: boolean; onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return <nav aria-label="Paginación" className="pagination">
    <button disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>← Anterior</button>
    <span aria-live="polite">{page} / {pages}</span>
    <button disabled={disabled || page >= pages} onClick={() => onChange(page + 1)}>Siguiente →</button>
  </nav>;
}
