import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * Blueprint-style full-bleed page header band.
 * Use inside a `<div className="-m-4 md:-m-6 lg:-m-8">` wrapper so it spans
 * the full width of the content area, matching the Dashboard/Customers look.
 */
export function PageBand({ eyebrow, title, subtitle, back, children }) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-5 border-b border-zinc-200 bg-white">
      {back && (
        <Link
          to={back.to}
          onClick={back.onClick}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-brand transition-colors mb-3"
          data-testid={back.testid || "page-back"}
        >
          <ArrowLeft size={14} strokeWidth={1.5} /> {back.label}
        </Link>
      )}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-[11px] uppercase tracking-[0.18em] text-brand font-semibold">{eyebrow}</div>
          )}
          <h1 className="font-heading text-3xl font-bold tracking-tight text-zinc-950 mt-1 truncate">{title}</h1>
          {subtitle && <div className="text-sm text-zinc-500 mt-0.5">{subtitle}</div>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2 shrink-0">{children}</div>}
      </div>
    </div>
  );
}

/** Full-bleed wrapper that cancels the Layout padding. */
export function FullBleed({ children, testid }) {
  return (
    <div className="-m-4 md:-m-6 lg:-m-8" data-testid={testid}>
      {children}
    </div>
  );
}

/** Bordered blueprint panel (cardless, sharp 1px borders). */
export function Panel({ title, action, children, className = "", testid }) {
  return (
    <section className={`bg-white border border-zinc-200 ${className}`} data-testid={testid}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-200">
          {title && (
            <h3 className="font-heading font-semibold text-zinc-900 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand" />
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
