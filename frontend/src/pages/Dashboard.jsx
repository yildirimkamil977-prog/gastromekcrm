import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatDate, formatMoney } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import { useAuth } from "../context/AuthContext";
import StatusBadge, { STATUS_MAP } from "../components/StatusBadge";
import { FileText, Users2, Package, Plus, ArrowUpRight, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const STATUS_ORDER = ["taslak", "gonderildi", "kabul", "red", "suresi_doldu"];

export default function Dashboard() {
  const { t } = useT();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [finance, setFinance] = useState(null);

  useEffect(() => {
    api
      .get("/quotes/stats")
      .then((r) => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    api.get("/settings").then((r) => {
      const roles = r.data?.accounting_visible_roles || [];
      const canSee = user?.role === "admin" || roles.includes(user?.role);
      if (!canSee) return;
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5);
      const from = d.toISOString().slice(0, 10);
      return api.get("/accounting/stats", { params: { date_from: from } })
        .then((s) => { if (active) setFinance(s.data); });
    }).catch(() => {});
    return () => { active = false; };
  }, [user]);

  const financeChart = (finance?.monthly || []).map((m) => ({
    name: `${m.month.slice(5)}/${m.month.slice(2, 4)}`,
    [t("accounting.income")]: m.income,
    [t("accounting.expense")]: m.expense,
  }));

  const navBlocks = [
    { to: "/musteriler", icon: Users2, label: t("dashboard.customer"), value: stats?.customer_count },
    { to: "/urunler", icon: Package, label: t("dashboard.productFromFeed"), value: stats?.product_count },
    { to: "/teklifler", icon: FileText, label: t("dashboard.totalQuotes"), value: stats?.total },
  ];

  const pipelineTotal = stats?.total || 0;

  return (
    <div className="-m-4 md:-m-6 lg:-m-8" data-testid="dashboard">
      {/* Header band */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 px-4 sm:px-6 lg:px-8 pt-6 pb-5 border-b border-zinc-200 bg-white">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-brand font-semibold">{t("brand.tagline")}</div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-zinc-950 mt-1">{t("dashboard.title")}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{t("dashboard.subtitle")}</p>
        </div>
        <Link to="/teklifler/yeni">
          <Button className="bg-brand hover:bg-brand-hover text-white h-11 px-5" data-testid="dashboard-new-quote-btn">
            <Plus size={16} strokeWidth={1.5} className="mr-2" /> {t("dashboard.newQuote")}
          </Button>
        </Link>
      </div>

      {/* Top: 3 nav stat blocks, separated by borders */}
      <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-zinc-200 bg-white">
        {navBlocks.map((b, i) => (
          <Link
            key={b.to}
            to={b.to}
            data-testid={`dashboard-stat-${i}`}
            className={`group relative px-6 py-6 sm:py-7 hover:bg-zinc-50 transition-colors ${i < 2 ? "sm:border-r border-zinc-200" : ""} border-b sm:border-b-0 border-zinc-200`}
          >
            <span className="absolute left-0 bottom-0 h-0.5 w-0 bg-brand group-hover:w-full transition-all duration-300" />
            <div className="flex items-start justify-between">
              <b.icon size={20} strokeWidth={1.5} className="text-zinc-400 group-hover:text-brand transition-colors" />
              <ArrowUpRight size={16} strokeWidth={1.5} className="text-zinc-300 group-hover:text-brand transition-colors" />
            </div>
            <div className="font-heading text-4xl font-bold tracking-tight text-zinc-950 mt-4">
              {loading ? <span className="text-zinc-300">—</span> : (b.value ?? 0)}
            </div>
            <div className="text-sm text-zinc-500 mt-1">{b.label}</div>
          </Link>
        ))}
      </div>

      {/* Main split: Recent quotes (8) + Pipeline (4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Recent quotes */}
        <div className="lg:col-span-8 lg:border-r border-zinc-200 bg-white" data-testid="dashboard-recent-panel">
          <div className="flex items-center justify-between px-6 h-14 border-b border-zinc-200">
            <h3 className="font-heading font-semibold text-zinc-900 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand" />
              {t("dashboard.recentQuotes")}
            </h3>
            <Link to="/teklifler" className="text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-brand flex items-center gap-1 transition-colors">
              {t("dashboard.viewAll")} <ChevronRight size={14} strokeWidth={1.5} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold bg-zinc-50/60">
                  <th className="px-6 py-3">{t("table.quoteNo")}</th>
                  <th className="px-6 py-3">{t("table.customer")}</th>
                  <th className="px-6 py-3 hidden md:table-cell">{t("table.preparedBy")}</th>
                  <th className="px-6 py-3 hidden sm:table-cell">{t("table.date")}</th>
                  <th className="px-6 py-3 text-right">{t("table.amount")}</th>
                  <th className="px-6 py-3">{t("table.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading && <tr><td colSpan={6} className="text-center p-10 text-zinc-400 text-sm">{t("common.loading")}</td></tr>}
                {!loading && (!stats?.recent || stats.recent.length === 0) && (
                  <tr><td colSpan={6} className="text-center p-10 text-zinc-400 text-sm">{t("dashboard.noQuotes")}</td></tr>
                )}
                {stats?.recent?.map((q) => (
                  <tr key={q.id} className="hover:bg-zinc-50 transition-colors text-sm">
                    <td className="px-6 py-3.5 font-mono text-xs">
                      <Link to={`/teklifler/${q.id}`} className="text-brand font-semibold hover:underline" data-testid={`recent-quote-link-${q.id}`}>
                        {q.quote_no}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5 text-zinc-900 font-medium">{q.customer?.company_name || "-"}</td>
                    <td className="px-6 py-3.5 text-zinc-500 hidden md:table-cell">{q.creator?.name || "-"}</td>
                    <td className="px-6 py-3.5 text-zinc-500 hidden sm:table-cell">{formatDate(q.issue_date)}</td>
                    <td className="px-6 py-3.5 font-semibold text-zinc-900 text-right tabular-nums">{formatMoney(q.grand_total, q.currency)}</td>
                    <td className="px-6 py-3.5"><StatusBadge status={q.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pipeline health */}
        <div className="lg:col-span-4 bg-white" data-testid="dashboard-pipeline-panel">
          <div className="flex items-center px-6 h-14 border-b border-zinc-200">
            <h3 className="font-heading font-semibold text-zinc-900">{t("dashboard.pipeline")}</h3>
          </div>
          <div className="divide-y divide-zinc-100">
            {STATUS_ORDER.map((s) => {
              const meta = STATUS_MAP[s];
              const count = stats?.by_status?.[s] ?? 0;
              const pct = pipelineTotal > 0 ? Math.round((count / pipelineTotal) * 100) : 0;
              return (
                <div key={s} className="px-6 py-4" data-testid={`pipeline-${s}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-700">{t(`status.${s}`)}</span>
                    <span className="font-heading text-lg font-bold tabular-nums" style={{ color: meta.text }}>
                      {loading ? "—" : count}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: meta.bar }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Finance chart (only for roles allowed to see accounting) */}
      {finance && financeChart.length > 0 && (
        <div className="bg-white border-t border-zinc-200" data-testid="dashboard-finance-panel">
          <div className="flex items-center px-6 h-14 border-b border-zinc-200">
            <h3 className="font-heading font-semibold text-zinc-900 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand" /> {t("dashboard.financeTitle")}
            </h3>
          </div>
          <div className="p-4 sm:p-6" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financeChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#71717a" }} axisLine={{ stroke: "#e4e4e7" }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#71717a" }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => formatMoney(v, "EUR")} />
                <Tooltip formatter={(v) => formatMoney(v, "EUR")} contentStyle={{ fontSize: 13, borderRadius: 8, border: "1px solid #e4e4e7" }} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey={t("accounting.income")} fill="#70C800" radius={[4, 4, 0, 0]} maxBarSize={56} />
                <Bar dataKey={t("accounting.expense")} fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
