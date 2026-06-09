import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError, formatDate } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import { PageBand, FullBleed } from "../components/Blueprint";
import Pagination from "../components/Pagination";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "../components/ui/sheet";
import { Plus, Search, Pencil, Trash2, Building2, Phone, MapPin, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const EMPTY = {
  company_name: "", tax_number: "", tax_office: "", contact_person: "",
  phone: "", whatsapp: "", email: "", address: "", city: "", notes: "",
};
const PAGE_SIZE = 20;

export default function Customers() {
  const { t } = useT();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(1);

  const load = async (targetPage = page) => {
    setLoading(true);
    try {
      const r = await api.get("/customers", {
        params: { search, date_from: dateFrom, date_to: dateTo, page: targetPage, page_size: PAGE_SIZE },
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

  useEffect(() => { load(1); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    const timer = setTimeout(() => load(1), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line
  }, [search, dateFrom, dateTo]);

  const remove = async (id) => {
    if (!window.confirm(t("customers.confirmDelete"))) return;
    try {
      try {
        await api.delete(`/customers/${id}`);
      } catch (e) {
        if (e?.response?.status === 409) {
          if (!window.confirm(formatApiError(e) + t("customers.forceDeleteSuffix"))) return;
          await api.delete(`/customers/${id}`, { params: { force: true } });
        } else { throw e; }
      }
      toast.success(t("customers.deleted"));
      load(page);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ ...EMPTY, ...c }); setOpen(true); };

  const save = async (e) => {
    if (e) e.preventDefault();
    try {
      if (editing) {
        await api.put(`/customers/${editing.id}`, form);
        toast.success(t("customers.updated"));
      } else {
        await api.post("/customers", form);
        toast.success(t("customers.added"));
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const initials = (name) => (name || "?").trim().charAt(0).toUpperCase();
  const hasFilter = search || dateFrom || dateTo;

  return (
    <FullBleed testid="customers">
      <PageBand
        eyebrow={t("nav.sectionMain")}
        title={t("customers.title")}
        subtitle={
          <span className="inline-flex items-center gap-2">
            {t("customers.subtitle")}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-xs font-semibold tabular-nums">{total}</span>
          </span>
        }
      >
        <Button className="bg-brand hover:bg-brand-hover text-white h-11 px-5" onClick={openNew} data-testid="new-customer-btn">
          <Plus size={16} strokeWidth={1.5} className="mr-2" /> {t("customers.newCustomer")}
        </Button>
      </PageBand>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 px-4 sm:px-6 lg:px-8 py-4 border-b border-zinc-200 bg-white">
        <div className="relative flex-1 max-w-xl">
          <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input className="pl-9 h-10 border-zinc-200" placeholder={t("customers.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} data-testid="customer-search-input" />
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 border-zinc-200 w-40" data-testid="customer-date-from" />
          <span className="text-zinc-300">—</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 border-zinc-200 w-40" data-testid="customer-date-to" />
          {hasFilter && (
            <Button variant="ghost" className="h-10 text-zinc-500 hover:text-zinc-900" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }} data-testid="clear-filters-btn">{t("common.clear")}</Button>
          )}
        </div>
      </div>

      {/* Contact list */}
      <div className="bg-white" data-testid="customers-list">
        {loading && <div className="p-12 text-center text-zinc-400 text-sm">{t("common.loading")}</div>}
        {!loading && rows.length === 0 && (
          <div className="p-16 text-center">
            <Building2 size={36} strokeWidth={1.25} className="mx-auto text-zinc-300 mb-3" />
            <div className="text-sm text-zinc-400">{t("customers.notFound")}</div>
          </div>
        )}
        <div className="divide-y divide-zinc-100">
          {rows.map((c) => (
            <div key={c.id} className="group relative flex items-center gap-4 pl-6 pr-4 sm:pr-6 py-4 hover:bg-zinc-50 transition-colors">
              <span className="absolute left-0 top-0 bottom-0 w-1 bg-brand opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="w-11 h-11 rounded-lg bg-brand-light text-brand font-heading font-bold flex items-center justify-center shrink-0 text-lg">{initials(c.company_name)}</span>
              <Link to={`/musteriler/${c.id}`} className="min-w-0 flex-1" data-testid={`customer-link-${c.id}`}>
                <div className="font-semibold text-zinc-900 truncate group-hover:text-brand transition-colors">{c.company_name}</div>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-400 mt-0.5">
                  {c.contact_person && <span>{c.contact_person}</span>}
                  {c.phone && <span className="inline-flex items-center gap-1"><Phone size={11} strokeWidth={1.5} /> {c.phone}</span>}
                  {c.city && <span className="inline-flex items-center gap-1"><MapPin size={11} strokeWidth={1.5} /> {c.city}</span>}
                  {c.tax_number && <span className="font-mono">{c.tax_number}</span>}
                </div>
              </Link>
              <div className="hidden xl:block text-xs text-zinc-400 shrink-0">{formatDate(c.created_at)}</div>
              <div className="flex items-center gap-1 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(c)} data-testid={`edit-customer-${c.id}`}><Pencil size={14} strokeWidth={1.5} /></Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => remove(c.id)} data-testid={`delete-customer-${c.id}`}><Trash2 size={14} strokeWidth={1.5} /></Button>
              </div>
              <ChevronRight size={18} strokeWidth={1.5} className="text-zinc-300 group-hover:text-brand transition-colors shrink-0" />
            </div>
          ))}
        </div>
        <div className="border-t border-zinc-200">
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={(p) => load(p)} />
        </div>
      </div>

      {/* Slide-out form */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col" data-testid="customer-sheet">
          <SheetHeader className="px-6 py-5 border-b border-zinc-200 text-left">
            <SheetTitle className="font-heading text-xl tracking-tight">{editing ? t("customers.editCustomer") : t("customers.newCustomer")}</SheetTitle>
          </SheetHeader>
          <form onSubmit={save} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <Label className="text-xs text-zinc-500">{t("customers.companyName")} *</Label>
              <Input required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="mt-1" data-testid="customer-company-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-zinc-500">{t("customers.taxNumber")}</Label><Input value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} className="mt-1" data-testid="customer-tax-number" /></div>
              <div><Label className="text-xs text-zinc-500">{t("customers.taxOffice")}</Label><Input value={form.tax_office} onChange={(e) => setForm({ ...form, tax_office: e.target.value })} className="mt-1" /></div>
            </div>
            <div><Label className="text-xs text-zinc-500">{t("customers.contactPerson")}</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-zinc-500">{t("customers.phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs text-zinc-500">{t("customers.whatsapp")}</Label><Input placeholder="+905xxxxxxxxx" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-zinc-500">{t("customers.email")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs text-zinc-500">{t("customers.city")}</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1" /></div>
            </div>
            <div><Label className="text-xs text-zinc-500">{t("customers.address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1" /></div>
            <div><Label className="text-xs text-zinc-500">{t("customers.notes")}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" /></div>
          </form>
          <SheetFooter className="px-6 py-4 border-t border-zinc-200 flex-row gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="button" onClick={() => save()} className="flex-1 bg-brand hover:bg-brand-hover text-white" data-testid="save-customer-btn">{editing ? t("common.update") : t("common.save")}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </FullBleed>
  );
}
