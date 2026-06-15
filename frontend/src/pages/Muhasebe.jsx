import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError, formatMoney, formatDate } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { PageBand, FullBleed } from "../components/Blueprint";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "../components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Plus, Search, Pencil, Trash2, TrendingUp, TrendingDown, Wallet,
  ChevronLeft, ChevronRight, User,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

const INCOME_CATS = ["proje", "magaza_satisi", "diger"];
const EXPENSE_CATS = ["kira", "personel_maasi", "muhasebe", "konaklama", "ulasim", "fatura", "yazilim", "yemek", "yakit", "diger"];
const PAGE_SIZE = 8;

const todayISO = () => new Date().toISOString().slice(0, 10);

function canAccess(user, settings) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const allowed = settings?.accounting_visible_roles || ["admin", "sales", "muhasebe"];
  return allowed.includes(user.role);
}

export default function Muhasebe() {
  const { t } = useT();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [person, setPerson] = useState("");
  const [users, setUsers] = useState([]);
  const [incomePage, setIncomePage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);
  const [income, setIncome] = useState({ items: [], total: 0 });
  const [expense, setExpense] = useState({ items: [], total: 0 });
  const [stats, setStats] = useState({ total_income: 0, total_expense: 0, net: 0, monthly: [] });
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ kind: "income", category: "", amount: "", description: "", date: todayISO(), owner_id: "" });

  const catLabel = useCallback(
    (k, c) => t(`accounting.${k === "income" ? "incomeTypes" : "expenseTypes"}.${c}`),
    [t]
  );

  // gate access
  useEffect(() => {
    api.get("/settings")
      .then((r) => {
        if (!canAccess(user, r.data)) { navigate("/", { replace: true }); return; }
        setReady(true);
      })
      .catch(() => navigate("/", { replace: true }));
  }, [user, navigate]);

  // debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  // load user list (for owner select + person filter) once access granted
  useEffect(() => {
    if (!ready) return;
    api.get("/users").then((r) => setUsers(r.data)).catch(() => {});
  }, [ready]);

  // reset pages on filter change
  useEffect(() => { setIncomePage(1); setExpensePage(1); }, [debounced, dateFrom, dateTo, kind, person]);

  const matchingCats = useMemo(() => {
    if (!debounced) return "";
    const low = debounced.toLocaleLowerCase("tr");
    const m = [];
    INCOME_CATS.forEach((c) => { if (t(`accounting.incomeTypes.${c}`).toLocaleLowerCase("tr").includes(low)) m.push(c); });
    EXPENSE_CATS.forEach((c) => { if (t(`accounting.expenseTypes.${c}`).toLocaleLowerCase("tr").includes(low)) m.push(c); });
    return [...new Set(m)].join(",");
  }, [debounced, t]);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    const common = { search: debounced, cats: matchingCats, date_from: dateFrom, date_to: dateTo, owner: person };
    try {
      const reqs = [api.get("/accounting/stats", { params: common })];
      if (kind === "all" || kind === "income")
        reqs.push(api.get("/accounting", { params: { ...common, kind: "income", page: incomePage, page_size: PAGE_SIZE } }));
      if (kind === "all" || kind === "expense")
        reqs.push(api.get("/accounting", { params: { ...common, kind: "expense", page: expensePage, page_size: PAGE_SIZE } }));
      const res = await Promise.all(reqs);
      setStats(res[0].data);
      let idx = 1;
      if (kind === "all" || kind === "income") { setIncome(res[idx].data); idx++; }
      if (kind === "all" || kind === "expense") { setExpense(res[idx].data); }
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, [ready, debounced, matchingCats, dateFrom, dateTo, kind, incomePage, expensePage, person]);

  useEffect(() => { load(); }, [load]);

  const openNew = (k) => {
    setEditing(null);
    setForm({ kind: k, category: "", amount: "", description: "", date: todayISO(), owner_id: user?.id || "" });
    setOpen(true);
  };
  const openEdit = (tx) => {
    setEditing(tx);
    setForm({ kind: tx.kind, category: tx.category, amount: String(tx.amount), description: tx.description || "", date: tx.date, owner_id: tx.owner_id || tx.created_by || "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.category) { toast.error(t("accounting.categoryRequired")); return; }
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { toast.error(t("accounting.amountRequired")); return; }
    const payload = { kind: form.kind, category: form.category, amount: amt, description: form.description, date: form.date, owner_id: form.owner_id || undefined };
    try {
      if (editing) { await api.put(`/accounting/${editing.id}`, payload); toast.success(t("accounting.updated")); }
      else { await api.post("/accounting", payload); toast.success(t("accounting.added")); }
      setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (id) => {
    if (!window.confirm(t("accounting.confirmDelete"))) return;
    try { await api.delete(`/accounting/${id}`); toast.success(t("accounting.deleted")); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const chartData = useMemo(
    () => (stats.monthly || []).map((m) => ({
      name: `${m.month.slice(5)}/${m.month.slice(2, 4)}`,
      [t("accounting.income")]: m.income,
      [t("accounting.expense")]: m.expense,
    })),
    [stats.monthly, t]
  );

  if (!ready) return <div className="p-8 text-zinc-400">{t("common.loading")}</div>;

  const cats = form.kind === "income" ? INCOME_CATS : EXPENSE_CATS;
  const showIncome = kind === "all" || kind === "income";
  const showExpense = kind === "all" || kind === "expense";

  return (
    <FullBleed testid="accounting">
      <PageBand eyebrow={t("nav.sectionMain")} title={t("accounting.title")} subtitle={t("accounting.subtitle")}>
        <div className="flex gap-2">
          <Button onClick={() => openNew("income")} className="bg-brand hover:bg-brand-hover text-white h-11 px-4" data-testid="new-income-btn">
            <Plus size={16} strokeWidth={1.5} className="mr-1.5" /> {t("accounting.newIncome")}
          </Button>
          <Button onClick={() => openNew("expense")} variant="outline" className="h-11 px-4 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" data-testid="new-expense-btn">
            <Plus size={16} strokeWidth={1.5} className="mr-1.5" /> {t("accounting.newExpense")}
          </Button>
        </div>
      </PageBand>

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-zinc-200 border border-zinc-200">
          <SummaryCard icon={TrendingUp} color="#16a34a" label={t("accounting.totalIncome")} value={formatMoney(stats.total_income, "EUR")} testid="sum-income" />
          <SummaryCard icon={TrendingDown} color="#dc2626" label={t("accounting.totalExpense")} value={formatMoney(stats.total_expense, "EUR")} testid="sum-expense" />
          <SummaryCard icon={Wallet} color={stats.net >= 0 ? "#16a34a" : "#dc2626"} label={t("accounting.net")} value={formatMoney(stats.net, "EUR")} testid="sum-net" />
        </div>

        {/* Chart */}
        <div className="bg-white border border-zinc-200">
          <div className="flex items-center px-5 h-14 border-b border-zinc-200">
            <h3 className="font-heading font-semibold text-zinc-900 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand" /> {t("accounting.chartTitle")}
            </h3>
          </div>
          <div className="p-4" style={{ height: 300 }} data-testid="accounting-chart">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-zinc-400">{t("accounting.noRecords")}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#71717a" }} axisLine={{ stroke: "#e4e4e7" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#71717a" }} axisLine={false} tickLine={false} width={70}
                    tickFormatter={(v) => formatMoney(v, "EUR")} />
                  <Tooltip formatter={(v) => formatMoney(v, "EUR")} contentStyle={{ fontSize: 13, borderRadius: 8, border: "1px solid #e4e4e7" }} />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Bar dataKey={t("accounting.income")} fill="#70C800" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  <Bar dataKey={t("accounting.expense")} fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-zinc-200 p-4 flex flex-col lg:flex-row gap-3 lg:items-end">
          <div className="flex-1 min-w-0">
            <Label className="text-xs text-zinc-500">{t("accounting.searchPlaceholder")}</Label>
            <div className="relative mt-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("accounting.searchPlaceholder")} className="pl-9" data-testid="accounting-search" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-zinc-500">{t("accounting.dateFrom")}</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1" data-testid="accounting-date-from" />
          </div>
          <div>
            <Label className="text-xs text-zinc-500">{t("accounting.dateTo")}</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1" data-testid="accounting-date-to" />
          </div>
          <div className="lg:w-44">
            <Label className="text-xs text-zinc-500">{t("accounting.kind")}</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="mt-1" data-testid="accounting-kind-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("accounting.filterAll")}</SelectItem>
                <SelectItem value="income">{t("accounting.filterIncome")}</SelectItem>
                <SelectItem value="expense">{t("accounting.filterExpense")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="lg:w-44">
            <Label className="text-xs text-zinc-500">{t("accounting.person")}</Label>
            <Select value={person || "all"} onValueChange={(v) => setPerson(v === "all" ? "" : v)}>
              <SelectTrigger className="mt-1" data-testid="accounting-person-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("accounting.allPersons")}</SelectItem>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Two columns */}
        <div className={`grid grid-cols-1 ${kind === "all" ? "lg:grid-cols-2" : ""} gap-6`}>
          {showIncome && (
            <TxColumn
              title={t("accounting.incomePlural")} accent="#16a34a" data={income} page={incomePage} setPage={setIncomePage}
              loading={loading} kindKey="income" catLabel={catLabel} onEdit={openEdit} onRemove={remove} t={t} testid="income-column"
            />
          )}
          {showExpense && (
            <TxColumn
              title={t("accounting.expensePlural")} accent="#dc2626" data={expense} page={expensePage} setPage={setExpensePage}
              loading={loading} kindKey="expense" catLabel={catLabel} onEdit={openEdit} onRemove={remove} t={t} testid="expense-column"
            />
          )}
        </div>
      </div>

      {/* Add/Edit sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col" data-testid="tx-sheet">
          <SheetHeader className="px-6 py-5 border-b border-zinc-200 text-left">
            <SheetTitle className="font-heading text-xl tracking-tight">{editing ? t("accounting.edit") : (form.kind === "income" ? t("accounting.newIncome") : t("accounting.newExpense"))}</SheetTitle>
            <SheetDescription className="sr-only">{t("accounting.subtitle")}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <Label className="text-xs text-zinc-500">{t("accounting.kind")}</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button type="button" onClick={() => setForm((f) => ({ ...f, kind: "income", category: "" }))}
                  className={`h-10 rounded-md border text-sm font-semibold transition-colors ${form.kind === "income" ? "bg-green-50 border-green-300 text-green-700" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}
                  data-testid="tx-kind-income">{t("accounting.income")}</button>
                <button type="button" onClick={() => setForm((f) => ({ ...f, kind: "expense", category: "" }))}
                  className={`h-10 rounded-md border text-sm font-semibold transition-colors ${form.kind === "expense" ? "bg-red-50 border-red-300 text-red-700" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}
                  data-testid="tx-kind-expense">{t("accounting.expense")}</button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-zinc-500">{t("accounting.category")}</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1" data-testid="tx-category-select"><SelectValue placeholder={t("accounting.selectCategory")} /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c} value={c}>{catLabel(form.kind, c)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-zinc-500">{t("accounting.amount")}</Label>
                <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="mt-1" data-testid="tx-amount-input" />
              </div>
              <div>
                <Label className="text-xs text-zinc-500">{t("accounting.date")}</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="mt-1" data-testid="tx-date-input" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-zinc-500">{t("accounting.belongsTo")}</Label>
              <Select value={form.owner_id || ""} onValueChange={(v) => setForm((f) => ({ ...f, owner_id: v }))}>
                <SelectTrigger className="mt-1" data-testid="tx-owner-select"><SelectValue placeholder={t("accounting.selectPerson")} /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Description appears once a category is selected */}
            {form.category && (
              <div data-testid="tx-description-block">
                <Label className="text-xs text-zinc-500">{t("accounting.description")}</Label>
                <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={t("accounting.descriptionPlaceholder")} className="mt-1" data-testid="tx-description-input" />
              </div>
            )}
          </div>
          <SheetFooter className="px-6 py-4 border-t border-zinc-200 flex-row gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="button" onClick={save} className="flex-1 bg-brand hover:bg-brand-hover text-white" data-testid="save-tx-btn">{t("common.save")}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </FullBleed>
  );
}

function SummaryCard({ icon: Icon, color, label, value, testid }) {
  return (
    <div className="bg-white px-5 py-5" data-testid={testid}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500 font-semibold">
        <Icon size={16} strokeWidth={1.5} style={{ color }} /> {label}
      </div>
      <div className="font-heading text-3xl font-bold tabular-nums mt-2" style={{ color }}>{value}</div>
    </div>
  );
}

function TxColumn({ title, accent, data, page, setPage, loading, kindKey, catLabel, onEdit, onRemove, t, testid }) {
  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));
  return (
    <div className="bg-white border border-zinc-200 flex flex-col" data-testid={testid}>
      <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-200">
        <h3 className="font-heading font-semibold flex items-center gap-2" style={{ color: accent }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} /> {title}
        </h3>
        <span className="text-xs font-semibold text-zinc-500 tabular-nums">{data.total || 0}</span>
      </div>
      <div className="divide-y divide-zinc-100 flex-1">
        {loading && <div className="p-8 text-center text-sm text-zinc-400">{t("common.loading")}</div>}
        {!loading && (data.items || []).length === 0 && (
          <div className="p-8 text-center text-sm text-zinc-400">{t("accounting.noRecords")}</div>
        )}
        {!loading && (data.items || []).map((tx) => (
          <div key={tx.id} className="group flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 transition-colors" data-testid={`tx-row-${tx.id}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-900 text-sm truncate">{catLabel(kindKey, tx.category)}</span>
                <span className="text-xs text-zinc-400 shrink-0">{formatDate(tx.date)}</span>
              </div>
              {tx.description && <div className="text-xs text-zinc-500 truncate mt-0.5">{tx.description}</div>}
              <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1 flex-wrap" data-testid={`tx-person-${tx.id}`}>
                <User size={11} strokeWidth={1.5} className="shrink-0" />
                <span className="font-medium text-zinc-500">{tx.owner?.name || tx.creator?.name || "-"}</span>
                {tx.creator && tx.creator.id !== tx.owner_id && (
                  <span className="text-zinc-400">· {t("accounting.createdBy")}: {tx.creator.name}</span>
                )}
              </div>
            </div>
            <div className="font-semibold tabular-nums text-sm shrink-0" style={{ color: accent }}>
              {kindKey === "income" ? "+" : "-"} {formatMoney(tx.amount, "EUR")}
            </div>
            <div className="inline-flex items-center gap-0.5 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onEdit(tx)} data-testid={`edit-tx-${tx.id}`}><Pencil size={13} strokeWidth={1.5} /></Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onRemove(tx.id)} data-testid={`delete-tx-${tx.id}`}><Trash2 size={13} strokeWidth={1.5} /></Button>
            </div>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-200 text-sm">
          <Button size="sm" variant="outline" className="h-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid={`${testid}-prev`}>
            <ChevronLeft size={14} />
          </Button>
          <span className="text-zinc-500 tabular-nums">{page} / {totalPages}</span>
          <Button size="sm" variant="outline" className="h-8" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} data-testid={`${testid}-next`}>
            <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
