import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError, formatDate, formatMoney } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import { PageBand, FullBleed } from "../components/Blueprint";
import StatusBadge, { STATUS_KEYS } from "../components/StatusBadge";
import Pagination from "../components/Pagination";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Plus, Search, FileText, X } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 20;

export default function Quotes() {
  const { t } = useT();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
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
    load(1);
    /* eslint-disable-next-line */
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => load(1), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line
  }, [search, status, createdBy, dateFrom, dateTo]);

  const hasFilter = search || status || createdBy || dateFrom || dateTo;

  return (
    <FullBleed testid="quotes">
      <PageBand eyebrow={t("nav.sectionMain")} title={t("quotes.title")} subtitle={t("quotes.subtitle")}>
        <Link to="/teklifler/yeni">
          <Button className="bg-brand hover:bg-brand-hover text-white h-11 px-5" data-testid="new-quote-btn">
            <Plus size={16} strokeWidth={1.5} className="mr-2" /> {t("dashboard.newQuote")}
          </Button>
        </Link>
      </PageBand>

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

      {/* Ledger */}
      <div className="bg-white" data-testid="quotes-ledger">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10">
              <tr className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold bg-zinc-50 border-y border-zinc-200">
                <th className="px-4 sm:px-6 py-3">{t("table.quoteNo")}</th>
                <th className="px-4 py-3">{t("table.customer")}</th>
                <th className="px-4 py-3 hidden lg:table-cell">{t("table.preparedBy")}</th>
                <th className="px-4 py-3 hidden sm:table-cell">{t("table.date")}</th>
                <th className="px-4 py-3 hidden xl:table-cell">{t("table.validity")}</th>
                <th className="px-4 py-3 text-right">{t("table.amount")}</th>
                <th className="px-4 sm:px-6 py-3">{t("table.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && <tr><td colSpan={7} className="p-12 text-center text-zinc-400 text-sm">{t("common.loading")}</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="p-16 text-center">
                  <FileText size={36} strokeWidth={1.25} className="mx-auto text-zinc-300 mb-3" />
                  <div className="text-sm text-zinc-400">{t("quotes.notFound")}</div>
                </td></tr>
              )}
              {rows.map((q) => (
                <tr key={q.id} className="hover:bg-zinc-50 transition-colors text-sm">
                  <td className="px-4 sm:px-6 py-3.5 font-mono text-xs">
                    <Link to={`/teklifler/${q.id}`} className="text-brand hover:underline font-semibold" data-testid={`quote-link-${q.id}`}>{q.quote_no}</Link>
                  </td>
                  <td className="px-4 py-3.5">
                    {q.customer ? (
                      <Link to={`/musteriler/${q.customer.id}`} className="text-zinc-900 font-medium hover:text-brand">{q.customer.company_name}</Link>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3.5 text-zinc-500 hidden lg:table-cell" data-testid={`quote-creator-${q.id}`}>{q.creator?.name || "-"}</td>
                  <td className="px-4 py-3.5 text-zinc-500 hidden sm:table-cell">{formatDate(q.issue_date)}</td>
                  <td className="px-4 py-3.5 text-zinc-500 hidden xl:table-cell">{formatDate(q.valid_until)}</td>
                  <td className="px-4 py-3.5 font-semibold text-zinc-900 text-right tabular-nums">{formatMoney(q.grand_total, q.currency)}</td>
                  <td className="px-4 sm:px-6 py-3.5"><StatusBadge status={q.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-zinc-200">
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={(p) => load(p)} />
        </div>
      </div>
    </FullBleed>
  );
}
