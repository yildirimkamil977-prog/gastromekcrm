import React from "react";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "../i18n/LanguageContext";

export default function Pagination({ page, pageSize, total, onPageChange, compact = false }) {
  const { t } = useT();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  const go = (p) => {
    const np = Math.min(totalPages, Math.max(1, p));
    if (np !== page) onPageChange(np);
  };

  const pageButtons = () => {
    const buttons = [];
    const push = (p) => buttons.push(
      <button
        key={p}
        onClick={() => go(p)}
        className={`h-8 min-w-8 px-2 rounded-md text-sm font-medium transition-colors ${p === page ? "bg-brand text-white" : "text-slate-700 hover:bg-slate-100"}`}
        data-testid={`pagination-page-${p}`}
      >
        {p}
      </button>
    );
    const dots = (k) => buttons.push(
      <span key={k} className="px-1 text-slate-400 text-xs">…</span>
    );
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) push(i);
    } else {
      push(1);
      const left = Math.max(2, page - 1);
      const right = Math.min(totalPages - 1, page + 1);
      if (left > 2) dots("l");
      for (let i = left; i <= right; i++) push(i);
      if (right < totalPages - 1) dots("r");
      push(totalPages);
    }
    return buttons;
  };

  return (
    <div className={`flex items-center justify-between flex-wrap gap-3 px-4 ${compact ? "py-2" : "py-3"} border-t border-slate-200 bg-white`} data-testid="pagination-bar">
      <div className="text-xs text-slate-500">
        <span className="font-medium text-slate-700">{start}-{end}</span> / {total} {t("common.records")}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          data-testid="pagination-prev"
          className="h-8 px-2"
        >
          <ChevronLeft size={14} />
        </Button>
        {pageButtons()}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          data-testid="pagination-next"
          className="h-8 px-2"
        >
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
