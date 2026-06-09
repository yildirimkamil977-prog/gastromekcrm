import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError, formatDate, formatMoney } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import { PageBand, FullBleed } from "../components/Blueprint";
import StatusBadge, { STATUS_KEYS, STATUS_MAP } from "../components/StatusBadge";
import Pagination from "../components/Pagination";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Plus, Search, FileText, X, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 20;

export default function Quotes() {
  const { t } = useT();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = async (targetPage = page) => {
    setLoading(true);
    try {
      const r = await api.get("/quotes", {
        params: { search, status, created_by: createdBy, date_from: dateFrom, date_to: dateTo, page: targetPage, page_size: PAGE_SIZE },
      });
      setRows(r.data.items || []);
      setTotal(r.data.total || 0);
      setPage(targetPage);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get("/users").then((r) => setUsers(r.data)).catch(() => setUsers([]));
    api.get("/quotes/stats").then((r) => setStats(r.data)).catch(() => setStats(null));
    load(1);
    /* eslint-disable-next-line */
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => load(1), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line
  }, [search, status, createdBy, dateFrom, dateTo]);

  const hasFilter = search || status || createdBy || dateFrom || dateTo;
  const toggleStatus = (s) => setStatus((cur) => (cur === s ? "" : s));

  return (
    <FullBleed testid="quotes">
      <PageBand eyebrow={t("nav.sectionMain")} title={t("quotes.title")} subtitle={t("quotes.subtitle")}>
        <Link to="/teklifler/yeni">
          <Button className="bg-brand hover:bg-brand-hover text-white h-11 px-5" data-testid="new-quote-btn">
            <Plus size={16} strokeWidth={1.5} className="mr-2" /> {t("dashboard.newQuote")}
          </Button>
        </Link>
      </PageBand>

      {/* Status summary chips (clickable quick filters) */}
      <div className="flex items-stretch gap-px bg-zinc-200 border-b border-zinc-200 overflow-x-auto">
        <button
          onClick={() => setStatus("")}
          data-testid="quote-chip-all"
          className={`flex-1 min-w-[120px] bg-white px-5 py-3 text-left transition-colors ${status === "" ? "ring-2 ring-inset ring-brand" : "hover:bg-zinc-50"}`}
        >
          <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">{t("quotes.allStatuses")}</div>
          <div className="font-heading text-2xl font-bold text-zinc-950 tabular-nums">{stats?.total ?? "—"}</div>
        </button>
        {STATUS_KEYS.map((s) => {
          const meta = STATUS_MAP[s];
          const active = status === s;
          return (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              data-testid={`quote-chip-${s}`}
              className={`flex-1 min-w-[120px] bg-white px-5 py-3 text-left transition-colors relative ${active ? "ring-2 ring-inset ring-brand" : "hover:bg-zinc-50"}`}
            >
              <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: meta.bar }} />
              <div className="text-[11px] uppercase tracking-wider font-semibold pl-1.5" style={{ color: meta.text }}>{t(`status.${s}`)}</div>
              <div className="font-heading text-2xl font-bold text-zinc-950 tabular-nums pl-1.5">{stats?.by_status?.[s] ?? "—"}</div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 px-4 sm:px-6 lg:px-8 py-4 border-b border-zinc-200 bg-white">
        <div className="relative flex-1 lg:max-w-sm">
          <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input className="pl-9 h-10 border-zinc-200" placeholder={t("quotes.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} data-testid="quote-search-input" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger className="h-10 w-40 border-zinc-200" data-testid="quote-status-filter"><SelectValue placeholder={t("quotes.allStatuses")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("quotes.allStatuses")}</SelectItem>
              {STATUS_KEYS.map((s) => (<SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={createdBy || "all"} onValueChange={(v) => setCreatedBy(v === "all" ? "" : v)}>
            <SelectTrigger className="h-10 w-44 border-zinc-200" data-testid="quote-creator-filter"><SelectValue placeholder={t("quotes.preparedBy")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("quotes.allUsers")}</SelectItem>
              {users.map((u) => (<SelectItem key={u.id} value={u.id} data-testid={`quote-creator-option-${u.id}`}>{u.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 w-40 border-zinc-200" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 w-40 border-zinc-200" />
          {hasFilter && (
            <Button variant="ghost" className="h-10 text-zinc-500 hover:text-zinc-900" onClick={() => { setSearch(""); setStatus(""); setCreatedBy(""); setDateFrom(""); setDateTo(""); }} data-testid="clear-filters-btn">
              <X size={15} strokeWidth={1.5} className="mr-1" /> {t("common.clear")}
            </Button>
          )}
        </div>
      </div>

      {/* Document-style list with status accent */}
      <div className="bg-white" data-testid="quotes-list">
        {loading && <div className="p-12 text-center text-zinc-400 text-sm">{t("common.loading")}</div>}
        {!loading && rows.length === 0 && (
          <div className="p-16 text-center">
            <FileText size={36} strokeWidth={1.25} className="mx-auto text-zinc-300 mb-3" />
            <div className="text-sm text-zinc-400">{t("quotes.notFound")}</div>
          </div>
        )}
        <div className="divide-y divide-zinc-100">
          {rows.map((q) => {
            const meta = STATUS_MAP[q.status] || STATUS_MAP.taslak;
            return (
              <Link
                key={q.id}
                to={`/teklifler/${q.id}`}
                data-testid={`quote-link-${q.id}`}
                className="group relative flex items-center gap-4 pl-6 pr-4 sm:pr-6 py-4 hover:bg-zinc-50 transition-colors"
              >
                <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: meta.bar }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-brand bg-brand-light px-2 py-0.5 rounded">{q.quote_no}</span>
                    <StatusBadge status={q.status} />
                  </div>
                  <div className="mt-1.5 font-semibold text-zinc-900 truncate group-hover:text-brand transition-colors">
                    {q.customer?.company_name || "-"}
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {formatDate(q.issue_date)}
                    {q.creator?.name && <> · {q.creator.name}</>}
                    {q.valid_until && <span className="hidden sm:inline"> · {t("table.validity")}: {formatDate(q.valid_until)}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-heading text-lg font-bold text-zinc-950 tabular-nums">{formatMoney(q.grand_total, q.currency)}</div>
                </div>
                <ChevronRight size={18} strokeWidth={1.5} className="text-zinc-300 group-hover:text-brand transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
        <div className="border-t border-zinc-200">
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={(p) => load(p)} />
        </div>
      </div>
    </FullBleed>
  );
}
