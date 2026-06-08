import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError, formatDate, formatMoney } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import PageHeader from "../components/PageHeader";
import StatusBadge, { STATUS_KEYS } from "../components/StatusBadge";
import Pagination from "../components/Pagination";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Plus, Search } from "lucide-react";
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
    const t = setTimeout(() => load(1), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [search, status, createdBy, dateFrom, dateTo]);

  return (
    <div>
      <PageHeader title={t("quotes.title")} subtitle={t("quotes.subtitle")}>
        <Link to="/teklifler/yeni">
          <Button className="bg-brand hover:bg-brand-hover" data-testid="new-quote-btn">
            <Plus size={16} className="mr-2" /> {t("dashboard.newQuote")}
          </Button>
        </Link>
      </PageHeader>

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="sm:col-span-2 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder={t("quotes.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="quote-search-input"
          />
        </div>
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger data-testid="quote-status-filter"><SelectValue placeholder={t("quotes.allStatuses")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("quotes.allStatuses")}</SelectItem>
            {STATUS_KEYS.map((s) => (
              <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={createdBy || "all"} onValueChange={(v) => setCreatedBy(v === "all" ? "" : v)}>
          <SelectTrigger data-testid="quote-creator-filter"><SelectValue placeholder={t("quotes.preparedBy")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("quotes.allUsers")}</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id} data-testid={`quote-creator-option-${u.id}`}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-3">{t("table.quoteNo")}</th>
                <th className="px-6 py-3">{t("table.customer")}</th>
                <th className="px-6 py-3">{t("table.preparedBy")}</th>
                <th className="px-6 py-3">{t("table.date")}</th>
                <th className="px-6 py-3">{t("table.validity")}</th>
                <th className="px-6 py-3">{t("table.amount")}</th>
                <th className="px-6 py-3">{t("table.status")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="p-8 text-center text-slate-400">{t("common.loading")}</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400">{t("quotes.notFound")}</td></tr>}
              {rows.map((q) => (
                <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-3 font-mono text-xs">
                    <Link to={`/teklifler/${q.id}`} className="text-brand hover:underline font-medium" data-testid={`quote-link-${q.id}`}>
                      {q.quote_no}
                    </Link>
                  </td>
                  <td className="px-6 py-3">
                    {q.customer ? (
                      <Link to={`/musteriler/${q.customer.id}`} className="text-slate-900 hover:text-brand">
                        {q.customer.company_name}
                      </Link>
                    ) : "-"}
                  </td>
                  <td className="px-6 py-3 text-slate-600" data-testid={`quote-creator-${q.id}`}>
                    {q.creator?.name || <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-6 py-3 text-slate-600">{formatDate(q.issue_date)}</td>
                  <td className="px-6 py-3 text-slate-600">{formatDate(q.valid_until)}</td>
                  <td className="px-6 py-3 font-medium">{formatMoney(q.grand_total, q.currency)}</td>
                  <td className="px-6 py-3"><StatusBadge status={q.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={(p) => load(p)} />
      </div>
    </div>
  );
}
