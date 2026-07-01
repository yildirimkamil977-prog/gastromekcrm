import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError, formatMoney } from "../lib/api";
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
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../components/ui/command";
import { Plus, Search, Pencil, Trash2, ChevronRight, FolderKanban, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../lib/utils";
import { toast } from "sonner";

function CustomerCombobox({ value, displayName, onSelect }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { const id = setTimeout(() => setDebounced(query.trim()), 250); return () => clearTimeout(id); }, [query]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get("/customers", { params: { search: debounced, page_size: 50 } })
      .then((r) => setResults(r.data.items || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [open, debounced]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="mt-1 w-full justify-between font-normal"
          data-testid="project-customer-select"
        >
          <span className={cn("truncate", !displayName && "text-zinc-400")}>
            {displayName || t("projects.selectCustomer")}
          </span>
          <ChevronsUpDown size={15} className="ml-2 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={t("projects.searchCustomer")} value={query} onValueChange={setQuery} data-testid="project-customer-search" />
          <CommandList>
            {loading && <div className="py-6 text-center text-sm text-zinc-400">{t("common.loading")}</div>}
            {!loading && <CommandEmpty>{t("projects.noCustomerFound")}</CommandEmpty>}
            {!loading && (
              <CommandGroup>
                {results.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => { onSelect(c); setOpen(false); }}
                    data-testid={`customer-option-${c.id}`}
                  >
                    <Check size={15} className={cn("mr-2", value === c.id ? "opacity-100 text-brand" : "opacity-0")} />
                    <span className="truncate">{c.company_name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const CURRENCIES = ["EUR", "TRY", "USD"];

function canAccess(user, settings) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return (settings?.projects_visible_roles || ["admin", "sales", "muhasebe"]).includes(user.role);
}

export default function Projeler() {
  const { t } = useT();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ customer_id: "", customer_name: "", name: "", info: "", amount: "", currency: "EUR" });

  useEffect(() => {
    api.get("/settings")
      .then((r) => { if (!canAccess(user, r.data)) { navigate("/", { replace: true }); return; } setReady(true); })
      .catch(() => navigate("/", { replace: true }));
  }, [user, navigate]);

  useEffect(() => { const id = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(id); }, [search]);

  const load = () => {
    if (!ready) return;
    setLoading(true);
    api.get("/projects", { params: { search: debounced } })
      .then((r) => setItems(r.data.items || []))
      .catch((e) => toast.error(formatApiError(e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ready, debounced]);

  const openNew = () => { setEditing(null); setForm({ customer_id: "", customer_name: "", name: "", info: "", amount: "", currency: "EUR" }); setOpen(true); };
  const openEdit = (p, e) => {
    e.stopPropagation();
    setEditing(p);
    setForm({ customer_id: p.customer_id, customer_name: p.customer?.company_name || "", name: p.name, info: p.info || "", amount: String(p.amount), currency: p.currency || "EUR" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.customer_id) { toast.error(t("projects.customerRequired")); return; }
    if (!form.name.trim()) { toast.error(t("projects.nameRequired")); return; }
    const payload = { customer_id: form.customer_id, name: form.name.trim(), info: form.info, amount: Number(form.amount) || 0, currency: form.currency };
    try {
      if (editing) { await api.put(`/projects/${editing.id}`, payload); toast.success(t("projects.updated")); }
      else { await api.post("/projects", payload); toast.success(t("projects.created")); }
      setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (p, e) => {
    e.stopPropagation();
    if (!window.confirm(t("projects.confirmDelete"))) return;
    try { await api.delete(`/projects/${p.id}`); toast.success(t("projects.deleted")); load(); }
    catch (er) { toast.error(formatApiError(er)); }
  };

  if (!ready) return <div className="p-8 text-zinc-400">{t("common.loading")}</div>;

  return (
    <FullBleed testid="projects">
      <PageBand eyebrow={t("nav.sectionMain")} title={t("projects.title")} subtitle={t("projects.subtitle")}>
        <Button onClick={openNew} className="bg-brand hover:bg-brand-hover text-white h-11 px-4" data-testid="new-project-btn">
          <Plus size={16} strokeWidth={1.5} className="mr-1.5" /> {t("projects.add")}
        </Button>
      </PageBand>

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("projects.name")} className="pl-9" data-testid="project-search" />
        </div>

        <div className="bg-white border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-200 bg-zinc-50/60">
                  <th className="px-4 py-3 font-semibold">{t("projects.name")}</th>
                  <th className="px-4 py-3 font-semibold">{t("projects.customer")}</th>
                  <th className="px-4 py-3 font-semibold text-right">{t("projects.projectAmount")}</th>
                  <th className="px-4 py-3 font-semibold text-right">{t("projects.remainingReceivable")}</th>
                  <th className="px-4 py-3 font-semibold text-right">{t("projects.profit")}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">{t("common.loading")}</td></tr>}
                {!loading && items.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">{t("projects.noProjects")}</td></tr>}
                {!loading && items.map((p) => (
                  <tr key={p.id} className="group hover:bg-zinc-50 cursor-pointer transition-colors" onClick={() => navigate(`/projeler/${p.id}`)} data-testid={`project-row-${p.id}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium text-zinc-900">
                        <FolderKanban size={15} strokeWidth={1.5} className="text-brand shrink-0" />
                        <span className="hover:text-brand" data-testid={`project-name-${p.id}`}>{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{p.customer?.company_name || "-"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-700">{formatMoney(p.amount, p.currency)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-600">{formatMoney(p.remaining_receivable, p.currency)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${p.profit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatMoney(p.profit, p.currency)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={(e) => openEdit(p, e)} data-testid={`edit-project-${p.id}`}><Pencil size={13} strokeWidth={1.5} /></Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={(e) => remove(p, e)} data-testid={`delete-project-${p.id}`}><Trash2 size={13} strokeWidth={1.5} /></Button>
                        <ChevronRight size={16} className="text-zinc-300" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col" data-testid="project-sheet">
          <SheetHeader className="px-6 py-5 border-b border-zinc-200 text-left">
            <SheetTitle className="font-heading text-xl tracking-tight">{editing ? t("projects.edit") : t("projects.newProject")}</SheetTitle>
            <SheetDescription className="sr-only">{t("projects.subtitle")}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <Label className="text-xs text-zinc-500">{t("projects.customer")}</Label>
              <CustomerCombobox
                value={form.customer_id}
                displayName={form.customer_name}
                onSelect={(c) => setForm((f) => ({ ...f, customer_id: c.id, customer_name: c.company_name }))}
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-500">{t("projects.name")}</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("projects.namePlaceholder")} className="mt-1" data-testid="project-name-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-zinc-500">{t("projects.amount")}</Label>
                <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="mt-1" data-testid="project-amount-input" />
              </div>
              <div>
                <Label className="text-xs text-zinc-500">{t("projects.currency")}</Label>
                <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger className="mt-1" data-testid="project-currency-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-zinc-500">{t("projects.info")}</Label>
              <Textarea rows={4} value={form.info} onChange={(e) => setForm((f) => ({ ...f, info: e.target.value }))} placeholder={t("projects.infoPlaceholder")} className="mt-1" data-testid="project-info-input" />
            </div>
          </div>
          <SheetFooter className="px-6 py-4 border-t border-zinc-200 flex-row gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="button" onClick={save} className="flex-1 bg-brand hover:bg-brand-hover text-white" data-testid="save-project-btn">{t("common.save")}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </FullBleed>
  );
}
