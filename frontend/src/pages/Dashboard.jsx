import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatDate, formatMoney } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import PageHeader from "../components/PageHeader";
import StatusBadge, { STATUS_MAP } from "../components/StatusBadge";
import { FileText, Users2, Package, Plus, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";

const STATUS_ORDER = ["taslak", "gonderildi", "kabul", "red", "suresi_doldu"];

export default function Dashboard() {
  const { t } = useT();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/quotes/stats")
      .then((r) => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.subtitle")}>
        <Link to="/teklifler/yeni">
          <Button className="bg-brand hover:bg-brand-hover" data-testid="dashboard-new-quote-btn">
            <Plus size={16} className="mr-2" /> {t("dashboard.newQuote")}
          </Button>
        </Link>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {STATUS_ORDER.map((s) => {
          const meta = STATUS_MAP[s];
          const count = stats?.by_status?.[s] ?? 0;
          return (
            <div
              key={s}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
              data-testid={`stat-${s}`}
            >
              <div className="text-xs uppercase tracking-wider text-slate-500 font-medium">
                {t(`status.${s}`)}
              </div>
              <div className="font-heading text-3xl font-semibold mt-2" style={{ color: meta.text }}>
                {loading ? "…" : count}
              </div>
              <div className="mt-3 h-1 rounded-full" style={{ backgroundColor: meta.bg }}>
                <div
                  className="h-1 rounded-full"
                  style={{
                    width: `${
                      stats && stats.total > 0
                        ? Math.min(100, (count / stats.total) * 100)
                        : 0
                    }%`,
                    backgroundColor: meta.text,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link to="/musteriler" className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
          <div className="flex items-center justify-between">
            <Users2 className="text-brand" />
            <ArrowRight size={16} className="text-slate-400 group-hover:text-brand transition-colors" />
          </div>
          <div className="font-heading text-3xl font-semibold mt-4">{stats?.customer_count ?? "…"}</div>
          <div className="text-sm text-slate-500 mt-1">{t("dashboard.customer")}</div>
        </Link>
        <Link to="/urunler" className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
          <div className="flex items-center justify-between">
            <Package className="text-brand" />
            <ArrowRight size={16} className="text-slate-400 group-hover:text-brand transition-colors" />
          </div>
          <div className="font-heading text-3xl font-semibold mt-4">{stats?.product_count ?? "…"}</div>
          <div className="text-sm text-slate-500 mt-1">{t("dashboard.productFromFeed")}</div>
        </Link>
        <Link to="/teklifler" className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
          <div className="flex items-center justify-between">
            <FileText className="text-brand" />
            <ArrowRight size={16} className="text-slate-400 group-hover:text-brand transition-colors" />
          </div>
          <div className="font-heading text-3xl font-semibold mt-4">{stats?.total ?? "…"}</div>
          <div className="text-sm text-slate-500 mt-1">{t("dashboard.totalQuotes")}</div>
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-heading font-semibold text-slate-900">{t("dashboard.recentQuotes")}</h3>
          <Link to="/teklifler" className="text-sm text-brand hover:text-brand-hover font-medium">
            {t("dashboard.viewAll")}
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-3">{t("table.quoteNo")}</th>
                <th className="px-6 py-3">{t("table.customer")}</th>
                <th className="px-6 py-3">{t("table.preparedBy")}</th>
                <th className="px-6 py-3">{t("table.date")}</th>
                <th className="px-6 py-3">{t("table.amount")}</th>
                <th className="px-6 py-3">{t("table.status")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="text-center p-6 text-slate-400">{t("common.loading")}</td></tr>
              )}
              {!loading && (!stats?.recent || stats.recent.length === 0) && (
                <tr><td colSpan={6} className="text-center p-6 text-slate-400">{t("dashboard.noQuotes")}</td></tr>
              )}
              {stats?.recent?.map((q) => (
                <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-3 font-mono text-xs">
                    <Link to={`/teklifler/${q.id}`} className="text-brand font-medium hover:underline" data-testid={`recent-quote-link-${q.id}`}>
                      {q.quote_no}
                    </Link>
                  </td>
                  <td className="px-6 py-3">{q.customer?.company_name || "-"}</td>
                  <td className="px-6 py-3 text-slate-600">{q.creator?.name || <span className="text-slate-400">-</span>}</td>
                  <td className="px-6 py-3 text-slate-600">{formatDate(q.issue_date)}</td>
                  <td className="px-6 py-3 font-medium">{formatMoney(q.grand_total, q.currency)}</td>
                  <td className="px-6 py-3"><StatusBadge status={q.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
