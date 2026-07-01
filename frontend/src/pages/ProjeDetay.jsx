import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, formatApiError, formatMoney, formatDate } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import { FullBleed } from "../components/Blueprint";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "../components/ui/dialog";
import {
  ArrowLeft, Plus, Pencil, Trash2, TrendingUp, Wallet, PiggyBank, Coins,
  Receipt, Paperclip, Loader2, X, ChevronRight, FileText,
} from "lucide-react";
import { toast } from "sonner";

const todayISO = () => new Date().toISOString().slice(0, 10);
const isPdf = (u) => /\.pdf($|\?)/i.test(u || "");

export default function ProjeDetay() {
  const { t } = useT();
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [incomeOpen, setIncomeOpen] = useState(false);
  const [incomeForm, setIncomeForm] = useState({ amount: "", currency: "EUR", date: todayISO(), note: "", receipts: [] });
  const [incUploading, setIncUploading] = useState(false);
  const incFileRef = useRef(null);

  const [expOpen, setExpOpen] = useState(false);
  const [expForm, setExpForm] = useState({ name: "", total_debt: "", currency: "EUR", payAmount: "", payDate: todayISO(), payNote: "", payReceipts: [] });
  const [expUploading, setExpUploading] = useState(false);

  const [activeExpId, setActiveExpId] = useState(null);
  const [payForm, setPayForm] = useState({ amount: "", currency: "EUR", date: todayISO(), note: "", receipts: [] });
  const [payUploading, setPayUploading] = useState(false);
  const payFileRef = useRef(null);
  const expFileRef = useRef(null);

  const load = async () => {
    try {
      const r = await api.get(`/projects/${id}`);
      setData(r.data);
    } catch (e) {
      toast.error(formatApiError(e));
      if (e?.response?.status === 403 || e?.response?.status === 404) navigate("/projeler", { replace: true });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const currency = data?.summary?.currency || "EUR";
  const activeExp = useMemo(
    () => (data?.expenses || []).find((e) => e.id === activeExpId) || null,
    [data, activeExpId]
  );

  const uploadFiles = async (files) => {
    const urls = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
      urls.push(r.data.url);
    }
    return urls;
  };

  // ----- Income -----
  const openIncome = () => { setIncomeForm({ amount: "", currency, date: todayISO(), note: "", receipts: [] }); setIncomeOpen(true); };
  const addIncome = async () => {
    const amt = Number(incomeForm.amount);
    if (!amt || amt <= 0) { toast.error(t("projects.amountRequired")); return; }
    try {
      await api.post(`/projects/${id}/incomes`, { amount: amt, currency, date: incomeForm.date, note: incomeForm.note, receipts: incomeForm.receipts });
      toast.success(t("projects.incomeAdded")); setIncomeOpen(false); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };
  const delIncome = async (incId) => {
    if (!window.confirm(t("projects.confirmDeleteIncome"))) return;
    try { await api.delete(`/projects/${id}/incomes/${incId}`); load(); } catch (e) { toast.error(formatApiError(e)); }
  };
  const onIncReceipts = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setIncUploading(true);
    try { const urls = await uploadFiles(files); setIncomeForm((f) => ({ ...f, receipts: [...f.receipts, ...urls] })); }
    catch (er) { toast.error(formatApiError(er)); } finally { setIncUploading(false); if (incFileRef.current) incFileRef.current.value = ""; }
  };

  // ----- Expense -----
  const openExpense = () => { setExpForm({ name: "", total_debt: "", currency, payAmount: "", payDate: todayISO(), payNote: "", payReceipts: [] }); setExpOpen(true); };
  const addExpense = async () => {
    if (!expForm.name.trim()) { toast.error(t("projects.nameRequired")); return; }
    const debt = Number(expForm.total_debt) || 0;
    const payAmt = Number(expForm.payAmount) || 0;
    const body = { name: expForm.name.trim(), total_debt: debt, currency: expForm.currency };
    if (payAmt > 0) body.initial_payment = { amount: payAmt, currency: expForm.currency, date: expForm.payDate, note: expForm.payNote, receipts: expForm.payReceipts };
    try {
      await api.post(`/projects/${id}/expenses`, body);
      toast.success(t("projects.expenseAdded")); setExpOpen(false); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };
  const delExpense = async (expId) => {
    if (!window.confirm(t("projects.confirmDeleteExpense"))) return;
    try { await api.delete(`/projects/${id}/expenses/${expId}`); if (activeExpId === expId) setActiveExpId(null); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  const onExpReceipts = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setExpUploading(true);
    try { const urls = await uploadFiles(files); setExpForm((f) => ({ ...f, payReceipts: [...f.payReceipts, ...urls] })); }
    catch (er) { toast.error(formatApiError(er)); } finally { setExpUploading(false); if (expFileRef.current) expFileRef.current.value = ""; }
  };

  // ----- Payments -----
  const openPayForm = () => setPayForm({ amount: "", currency: activeExp?.currency || currency, date: todayISO(), note: "", receipts: [] });
  const addPayment = async () => {
    const amt = Number(payForm.amount);
    if (!amt || amt <= 0) { toast.error(t("projects.amountRequired")); return; }
    try {
      await api.post(`/projects/${id}/expenses/${activeExpId}/payments`, { amount: amt, currency: payForm.currency, date: payForm.date, note: payForm.note, receipts: payForm.receipts });
      toast.success(t("projects.paymentAdded")); openPayForm(); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };
  const delPayment = async (payId) => {
    if (!window.confirm(t("projects.confirmDeletePayment"))) return;
    try { await api.delete(`/projects/${id}/expenses/${activeExpId}/payments/${payId}`); load(); } catch (e) { toast.error(formatApiError(e)); }
  };
  const onPayReceipts = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setPayUploading(true);
    try { const urls = await uploadFiles(files); setPayForm((f) => ({ ...f, receipts: [...f.receipts, ...urls] })); }
    catch (er) { toast.error(formatApiError(er)); } finally { setPayUploading(false); if (payFileRef.current) payFileRef.current.value = ""; }
  };

  if (loading) return <div className="p-8 text-zinc-400">{t("common.loading")}</div>;
  if (!data) return null;

  const { project, customer, incomes, expenses, summary } = data;

  return (
    <FullBleed testid="project-detail">
      {/* Header */}
      <div className="bg-zinc-950 text-white px-4 sm:px-6 lg:px-8 py-6">
        <button onClick={() => navigate("/projeler")} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-brand transition-colors mb-3" data-testid="back-to-projects">
          <ArrowLeft size={14} /> {t("projects.back")}
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold">{project.name}</h1>
            <div className="text-sm text-zinc-400 mt-1">{customer?.company_name}</div>
            {project.info && <p className="text-sm text-zinc-300 mt-3 max-w-2xl whitespace-pre-line">{project.info}</p>}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-200 border border-zinc-200">
          <Card icon={Coins} color="#0f172a" label={t("projects.projectAmount")} value={formatMoney(summary.amount, currency)} testid="sum-amount" />
          <Card icon={TrendingUp} color="#16a34a" label={t("projects.totalIncome")} value={formatMoney(summary.income_total, currency)} testid="sum-income" />
          <Card icon={Wallet} color="#d97706" label={t("projects.remainingReceivable")} value={formatMoney(summary.remaining_receivable, currency)} testid="sum-receivable" />
          <Card icon={PiggyBank} color={summary.profit >= 0 ? "#16a34a" : "#dc2626"} label={t("projects.profit")} value={formatMoney(summary.profit, currency)} testid="sum-profit" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Incomes */}
          <section className="bg-white border border-zinc-200 flex flex-col" data-testid="incomes-section">
            <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-200">
              <h3 className="font-heading font-semibold flex items-center gap-2 text-green-700"><span className="w-1.5 h-1.5 rounded-full bg-green-600" /> {t("projects.incomeSection")}</h3>
              <Button size="sm" onClick={openIncome} className="bg-brand hover:bg-brand-hover text-white h-8" data-testid="add-income-btn"><Plus size={14} className="mr-1" /> {t("projects.addIncome")}</Button>
            </div>
            <div className="divide-y divide-zinc-100">
              {incomes.length === 0 && <div className="p-6 text-center text-sm text-zinc-400">{t("projects.noIncome")}</div>}
              {incomes.map((inc) => (
                <div key={inc.id} className="group flex items-center gap-3 px-5 py-3 hover:bg-zinc-50" data-testid={`income-row-${inc.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-900">{formatDate(inc.date)}</div>
                    {inc.note && <div className="text-xs text-zinc-500 truncate">{inc.note}</div>}
                    {(inc.receipts || []).length > 0 && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {inc.receipts.map((u, i) => (
                          <a key={i} href={u} target="_blank" rel="noreferrer" data-testid={`income-receipt-thumb-${inc.id}-${i}`}>
                            {isPdf(u) ? (
                              <span className="w-9 h-9 rounded border border-zinc-200 bg-red-50 text-red-600 flex flex-col items-center justify-center hover:ring-2 hover:ring-brand">
                                <FileText size={13} /><span className="text-[7px] font-bold">PDF</span>
                              </span>
                            ) : (
                              <img src={u} alt="receipt" className="w-9 h-9 object-cover rounded border border-zinc-200 hover:ring-2 hover:ring-brand" />
                            )}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="font-semibold tabular-nums text-green-600 text-sm">+ {formatMoney(inc.amount, inc.currency)}</div>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 lg:opacity-0 lg:group-hover:opacity-100" onClick={() => delIncome(inc.id)} data-testid={`delete-income-${inc.id}`}><Trash2 size={13} /></Button>
                </div>
              ))}
            </div>
          </section>

          {/* Expenses */}
          <section className="bg-white border border-zinc-200 flex flex-col" data-testid="expenses-section">
            <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-200">
              <h3 className="font-heading font-semibold flex items-center gap-2 text-red-700"><span className="w-1.5 h-1.5 rounded-full bg-red-600" /> {t("projects.expenseSection")}</h3>
              <Button size="sm" onClick={openExpense} variant="outline" className="h-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" data-testid="add-expense-btn"><Plus size={14} className="mr-1" /> {t("projects.addExpense")}</Button>
            </div>
            <div className="px-5 py-2 border-b border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
              <span>{t("projects.totalExpense")}: <b className="text-zinc-700">{formatMoney(summary.expense_debt_total, currency)}</b></span>
              <span>{t("projects.expenseRemaining")}: <b className="text-red-600" data-testid="expense-remaining-total">{formatMoney(summary.expense_remaining_total, currency)}</b></span>
            </div>
            <div className="divide-y divide-zinc-100">
              {expenses.length === 0 && <div className="p-6 text-center text-sm text-zinc-400">{t("projects.noExpense")}</div>}
              {expenses.map((exp) => (
                <div key={exp.id} className="group px-5 py-3 hover:bg-zinc-50 cursor-pointer" onClick={() => { setActiveExpId(exp.id); openPayForm(); }} data-testid={`expense-row-${exp.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-900 truncate">{exp.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {t("projects.paid")}: <span className="text-green-600">{formatMoney(exp.paid, exp.currency)}</span> · {t("projects.remaining")}: <span className="text-red-600">{formatMoney(exp.remaining, exp.currency)}</span> · {exp.payments_count} {t("projects.paymentsCount")}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold tabular-nums text-zinc-800 text-sm">{formatMoney(exp.total_debt, exp.currency)}</div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 lg:opacity-0 lg:group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); delExpense(exp.id); }} data-testid={`delete-expense-${exp.id}`}><Trash2 size={13} /></Button>
                      <ChevronRight size={16} className="text-zinc-300" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Income dialog */}
      <Dialog open={incomeOpen} onOpenChange={setIncomeOpen}>
        <DialogContent data-testid="income-dialog">
          <DialogHeader><DialogTitle className="font-heading">{t("projects.addIncome")}</DialogTitle><DialogDescription className="sr-only">{t("projects.incomeSection")}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-zinc-500">{t("projects.fieldAmount")}</Label><Input type="number" step="0.01" min="0" value={incomeForm.amount} onChange={(e) => setIncomeForm((f) => ({ ...f, amount: e.target.value }))} className="mt-1" data-testid="income-amount-input" /></div>
              <CurrencyBadge value={currency} label={t("projects.currency")} testid="income-currency-fixed" />
            </div>
            <div><Label className="text-xs text-zinc-500">{t("projects.date")}</Label><Input type="date" value={incomeForm.date} onChange={(e) => setIncomeForm((f) => ({ ...f, date: e.target.value }))} className="mt-1" data-testid="income-date-input" /></div>
            <div><Label className="text-xs text-zinc-500">{t("projects.note")}</Label><Textarea rows={2} value={incomeForm.note} onChange={(e) => setIncomeForm((f) => ({ ...f, note: e.target.value }))} className="mt-1" data-testid="income-note-input" /></div>
            <ReceiptField receipts={incomeForm.receipts} uploading={incUploading} onPick={() => incFileRef.current?.click()} onRemove={(u) => setIncomeForm((f) => ({ ...f, receipts: f.receipts.filter((x) => x !== u) }))} t={t} />
            <input ref={incFileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={onIncReceipts} />
          </div>
          <DialogFooter><Button onClick={addIncome} className="bg-brand hover:bg-brand-hover text-white" data-testid="save-income-btn">{t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense dialog */}
      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent data-testid="expense-dialog">
          <DialogHeader><DialogTitle className="font-heading">{t("projects.addExpense")}</DialogTitle><DialogDescription className="sr-only">{t("projects.expenseSection")}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs text-zinc-500">{t("projects.expenseName")}</Label><Input value={expForm.name} onChange={(e) => setExpForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("projects.expenseNamePlaceholder")} className="mt-1" data-testid="expense-name-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-zinc-500">{t("projects.totalDebt")}</Label><Input type="number" step="0.01" min="0" value={expForm.total_debt} onChange={(e) => setExpForm((f) => ({ ...f, total_debt: e.target.value }))} className="mt-1" data-testid="expense-debt-input" /></div>
              <CurrencyBadge value={currency} label={t("projects.currency")} testid="expense-currency-fixed" />
            </div>
            <div className="rounded-md border border-zinc-200 p-3 space-y-3">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t("projects.initialPayment")}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-zinc-500">{t("projects.fieldAmount")}</Label><Input type="number" step="0.01" min="0" value={expForm.payAmount} onChange={(e) => setExpForm((f) => ({ ...f, payAmount: e.target.value }))} className="mt-1" data-testid="expense-pay-amount-input" /></div>
                <div><Label className="text-xs text-zinc-500">{t("projects.date")}</Label><Input type="date" value={expForm.payDate} onChange={(e) => setExpForm((f) => ({ ...f, payDate: e.target.value }))} className="mt-1" data-testid="expense-pay-date-input" /></div>
              </div>
              <div><Label className="text-xs text-zinc-500">{t("projects.note")}</Label><Input value={expForm.payNote} onChange={(e) => setExpForm((f) => ({ ...f, payNote: e.target.value }))} className="mt-1" data-testid="expense-pay-note-input" /></div>
              <ReceiptField receipts={expForm.payReceipts} uploading={expUploading} onPick={() => expFileRef.current?.click()} onRemove={(u) => setExpForm((f) => ({ ...f, payReceipts: f.payReceipts.filter((x) => x !== u) }))} t={t} />
              <input ref={expFileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={onExpReceipts} />
            </div>
          </div>
          <DialogFooter><Button onClick={addExpense} className="bg-brand hover:bg-brand-hover text-white" data-testid="save-expense-btn">{t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense detail (payments) dialog */}
      <Dialog open={!!activeExpId} onOpenChange={(o) => { if (!o) setActiveExpId(null); }}>
        <DialogContent className="max-w-lg" data-testid="expense-detail-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2"><Receipt size={16} className="text-brand" /> {activeExp?.name}</DialogTitle>
            <DialogDescription className="sr-only">{t("projects.payments")}</DialogDescription>
          </DialogHeader>
          {activeExp && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-px bg-zinc-200 border border-zinc-200 text-center">
                <div className="bg-white py-2"><div className="text-[10px] uppercase text-zinc-500">{t("projects.totalDebt")}</div><div className="font-semibold text-sm text-zinc-800">{formatMoney(activeExp.total_debt, activeExp.currency)}</div></div>
                <div className="bg-white py-2"><div className="text-[10px] uppercase text-zinc-500">{t("projects.paid")}</div><div className="font-semibold text-sm text-green-600">{formatMoney(activeExp.paid, activeExp.currency)}</div></div>
                <div className="bg-white py-2"><div className="text-[10px] uppercase text-zinc-500">{t("projects.remaining")}</div><div className="font-semibold text-sm text-red-600">{formatMoney(activeExp.remaining, activeExp.currency)}</div></div>
              </div>

              <div className="max-h-52 overflow-y-auto divide-y divide-zinc-100 border border-zinc-100 rounded-md">
                {(activeExp.payments || []).length === 0 && <div className="p-4 text-center text-sm text-zinc-400">{t("projects.noPayments")}</div>}
                {(activeExp.payments || []).map((p) => (
                  <div key={p.id} className="group flex items-start gap-3 px-3 py-2.5" data-testid={`payment-row-${p.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-800 tabular-nums">{formatMoney(p.amount, p.currency)}</span>
                        <span className="text-xs text-zinc-400">{formatDate(p.date)}</span>
                      </div>
                      {p.note && <div className="text-xs text-zinc-500 mt-0.5">{p.note}</div>}
                      {(p.receipts || []).length > 0 && (
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {p.receipts.map((u, i) => (
                            <a key={i} href={u} target="_blank" rel="noreferrer" data-testid={`receipt-thumb-${p.id}-${i}`}>
                              {isPdf(u) ? (
                                <span className="w-10 h-10 rounded border border-zinc-200 bg-red-50 text-red-600 flex flex-col items-center justify-center hover:ring-2 hover:ring-brand">
                                  <FileText size={14} /><span className="text-[7px] font-bold">PDF</span>
                                </span>
                              ) : (
                                <img src={u} alt="receipt" className="w-10 h-10 object-cover rounded border border-zinc-200 hover:ring-2 hover:ring-brand" />
                              )}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 lg:opacity-0 lg:group-hover:opacity-100" onClick={() => delPayment(p.id)} data-testid={`delete-payment-${p.id}`}><Trash2 size={12} /></Button>
                  </div>
                ))}
              </div>

              {/* Add payment */}
              <div className="rounded-md border border-zinc-200 p-3 space-y-3">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t("projects.addPayment")}</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1"><Label className="text-xs text-zinc-500">{t("projects.fieldAmount")}</Label><Input type="number" step="0.01" min="0" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} className="mt-1" data-testid="payment-amount-input" /></div>
                  <CurrencyBadge value={activeExp.currency} label={t("projects.currency")} testid="payment-currency-fixed" />
                  <div className="col-span-1"><Label className="text-xs text-zinc-500">{t("projects.date")}</Label><Input type="date" value={payForm.date} onChange={(e) => setPayForm((f) => ({ ...f, date: e.target.value }))} className="mt-1" data-testid="payment-date-input" /></div>
                </div>
                <div><Label className="text-xs text-zinc-500">{t("projects.note")}</Label><Input value={payForm.note} onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))} className="mt-1" data-testid="payment-note-input" /></div>
                <ReceiptField receipts={payForm.receipts} uploading={payUploading} onPick={() => payFileRef.current?.click()} onRemove={(u) => setPayForm((f) => ({ ...f, receipts: f.receipts.filter((x) => x !== u) }))} t={t} />
                <input ref={payFileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={onPayReceipts} />
                <Button onClick={addPayment} className="w-full bg-brand hover:bg-brand-hover text-white h-9" data-testid="save-payment-btn"><Plus size={14} className="mr-1" /> {t("projects.addPayment")}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </FullBleed>
  );
}

function CurrencyBadge({ value, label, testid }) {
  return (
    <div>
      <Label className="text-xs text-zinc-500">{label}</Label>
      <div className="mt-1 h-10 flex items-center px-3 rounded-md border border-zinc-200 bg-zinc-50 text-sm font-medium text-zinc-600 tabular-nums" data-testid={testid}>{value}</div>
    </div>
  );
}

function Card({ icon: Icon, color, label, value, testid }) {
  return (
    <div className="bg-white px-4 py-4" data-testid={testid}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
        <Icon size={14} strokeWidth={1.5} style={{ color }} /> {label}
      </div>
      <div className="font-heading text-xl sm:text-2xl font-bold tabular-nums mt-1.5" style={{ color }}>{value}</div>
    </div>
  );
}

function ReceiptField({ receipts, uploading, onPick, onRemove, t }) {
  return (
    <div>
      <Label className="text-xs text-zinc-500">{t("projects.receipts")}</Label>
      <div className="flex items-center gap-2 flex-wrap mt-1">
        {receipts.map((u, i) => (
          <div key={i} className="relative group">
            {isPdf(u) ? (
              <a href={u} target="_blank" rel="noreferrer" className="w-12 h-12 rounded border border-zinc-200 bg-red-50 text-red-600 flex flex-col items-center justify-center gap-0.5" data-testid={`receipt-pdf-${i}`}>
                <FileText size={16} />
                <span className="text-[8px] font-bold tracking-wide">PDF</span>
              </a>
            ) : (
              <img src={u} alt="receipt" className="w-12 h-12 object-cover rounded border border-zinc-200" />
            )}
            <button type="button" onClick={() => onRemove(u)} className="absolute -top-1.5 -right-1.5 bg-white rounded-full border border-zinc-300 text-red-600 shadow-sm" data-testid={`remove-receipt-${i}`}><X size={12} /></button>
          </div>
        ))}
        <button type="button" onClick={onPick} disabled={uploading} className="w-12 h-12 rounded border border-dashed border-zinc-300 text-zinc-400 hover:border-brand hover:text-brand flex items-center justify-center" data-testid="upload-receipt-btn">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
        </button>
      </div>
    </div>
  );
}
