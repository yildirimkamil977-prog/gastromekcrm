import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, formatApiError, formatDate, formatMoney } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import { PageBand, FullBleed } from "../components/Blueprint";
import StatusBadge, { STATUS_MAP } from "../components/StatusBadge";
import Pagination from "../components/Pagination";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Plus, Save, Phone, Mail, MessageCircle, MapPin, ChevronRight, FolderKanban } from "lucide-react";
import { toast } from "sonner";

const QUOTES_PAGE_SIZE = 8;

export default function CustomerDetail() {
  const { t } = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quotesPage, setQuotesPage] = useState(1);

  const pagedQuotes = useMemo(() => {
    const start = (quotesPage - 1) * QUOTES_PAGE_SIZE;
    return quotes.slice(start, start + QUOTES_PAGE_SIZE);
  }, [quotes, quotesPage]);

  const load = async () => {
    setLoading(true);
    try {
      const [c, q] = await Promise.all([
        api.get(`/customers/${id}`),
        api.get(`/customers/${id}/quotes`),
      ]);
      setCustomer(c.data);
      setQuotes(q.data);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
    // Projects (role-gated): silently skip if no access.
    try {
      const p = await api.get("/projects", { params: { customer_id: id } });
      setProjects(p.data.items || []);
    } catch {
      setProjects([]);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const { id: _, created_at, updated_at, ...payload } = customer;
      await api.put(`/customers/${id}`, payload);
      toast.success(t("customerDetail.updated"));
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-zinc-400">{t("common.loading")}</div>;
  if (!customer) return <div className="p-8 text-zinc-400">{t("customerDetail.notFound")}</div>;

  const initials = (customer.company_name || "?").charAt(0).toUpperCase();
  const waNum = (customer.whatsapp || customer.phone || "").replace(/[^\d+]/g, "").replace(/^\+/, "");

  const chips = [
    customer.phone && { icon: Phone, label: customer.phone, href: `tel:${customer.phone}` },
    customer.email && { icon: Mail, label: customer.email, href: `mailto:${customer.email}` },
    waNum && { icon: MessageCircle, label: "WhatsApp", href: `https://wa.me/${waNum}`, ext: true, green: true },
    customer.city && { icon: MapPin, label: customer.city },
  ].filter(Boolean);

  return (
    <FullBleed testid="customer-detail">
      <PageBand
        eyebrow={t("nav.customers")}
        title={customer.company_name}
        subtitle={customer.tax_number ? `${t("customerDetail.taxNoLabel")}${customer.tax_number}` : t("customerDetail.profileSubtitle")}
        back={{ to: "/musteriler", label: t("customerDetail.backToCustomers"), testid: "back-to-customers" }}
      >
        <Link to={`/teklifler/yeni?customer=${customer.id}`}>
          <Button className="bg-brand hover:bg-brand-hover text-white h-11 px-5" data-testid="new-quote-for-customer-btn">
            <Plus size={16} strokeWidth={1.5} className="mr-2" /> {t("customerDetail.quoteForCustomer")}
          </Button>
        </Link>
        <Button onClick={save} disabled={saving} variant="outline" className="h-11" data-testid="save-customer-detail-btn">
          <Save size={16} strokeWidth={1.5} className="mr-2" /> {t("common.save")}
        </Button>
      </PageBand>

      {/* Hero */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 border-b border-zinc-200 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <span className="w-20 h-20 rounded-2xl bg-brand text-white font-heading font-bold flex items-center justify-center text-3xl shrink-0">{initials}</span>
          <div className="min-w-0">
            <div className="font-heading text-2xl font-bold tracking-tight text-zinc-950">{customer.company_name}</div>
            {customer.contact_person && <div className="text-sm text-zinc-500 mt-0.5">{customer.contact_person}</div>}
            <div className="flex flex-wrap gap-2 mt-3">
              {chips.map((ch, i) => {
                const Cmp = ch.href ? "a" : "div";
                return (
                  <Cmp
                    key={i}
                    href={ch.href}
                    {...(ch.ext ? { target: "_blank", rel: "noreferrer" } : {})}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${ch.green ? "border-green-300 text-green-700 hover:bg-green-50" : "border-zinc-200 text-zinc-600 hover:border-brand/40 hover:text-brand"}`}
                  >
                    <ch.icon size={13} strokeWidth={1.5} /> {ch.label}
                  </Cmp>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Editable info */}
        <div className="lg:col-span-2 bg-white border border-zinc-200">
          <div className="flex items-center px-5 h-14 border-b border-zinc-200"><h3 className="font-heading font-semibold flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-brand" />{t("customerDetail.companyInfo")}</h3></div>
          <div className="p-5 space-y-4">
            <Row label={t("customerDetail.companyName")}><Input value={customer.company_name || ""} onChange={(e) => setCustomer({ ...customer, company_name: e.target.value })} /></Row>
            <Row label={t("customers.thTaxNo")}><Input value={customer.tax_number || ""} onChange={(e) => setCustomer({ ...customer, tax_number: e.target.value })} /></Row>
            <Row label={t("customers.taxOffice")}><Input value={customer.tax_office || ""} onChange={(e) => setCustomer({ ...customer, tax_office: e.target.value })} /></Row>
            <Row label={t("customers.contactPerson")}><Input value={customer.contact_person || ""} onChange={(e) => setCustomer({ ...customer, contact_person: e.target.value })} /></Row>
            <div className="grid grid-cols-2 gap-3">
              <Row label={t("customers.phone")}><Input value={customer.phone || ""} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></Row>
              <Row label="WhatsApp"><Input value={customer.whatsapp || ""} onChange={(e) => setCustomer({ ...customer, whatsapp: e.target.value })} /></Row>
            </div>
            <Row label={t("customers.email")}><Input type="email" value={customer.email || ""} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} /></Row>
            <Row label={t("customers.city")}><Input value={customer.city || ""} onChange={(e) => setCustomer({ ...customer, city: e.target.value })} /></Row>
            <Row label={t("customers.address")}><Textarea value={customer.address || ""} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} rows={2} /></Row>
            <Row label={t("customers.notes")}><Textarea value={customer.notes || ""} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} rows={3} /></Row>
          </div>
        </div>

        {/* Quotes list */}
        <div className="lg:col-span-3 bg-white border border-zinc-200">
          <div className="flex items-center px-5 h-14 border-b border-zinc-200">
            <h3 className="font-heading font-semibold flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-brand" />{t("customerDetail.quotes")} <span className="text-zinc-400 text-sm font-normal">({quotes.length})</span></h3>
          </div>
          {quotes.length === 0 ? (
            <div className="p-12 text-center text-zinc-400 text-sm">{t("dashboard.noQuotes")}</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {pagedQuotes.map((q) => {
                const meta = STATUS_MAP[q.status] || STATUS_MAP.taslak;
                return (
                  <Link key={q.id} to={`/teklifler/${q.id}`} className="group relative flex items-center gap-4 pl-5 pr-4 py-3.5 hover:bg-zinc-50 transition-colors">
                    <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: meta.bar }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-brand bg-brand-light px-2 py-0.5 rounded">{q.quote_no}</span>
                        <StatusBadge status={q.status} />
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">{formatDate(q.issue_date)}{q.creator?.name && <> · {q.creator.name}</>}</div>
                    </div>
                    <div className="font-heading font-bold text-zinc-950 tabular-nums">{formatMoney(q.grand_total, q.currency)}</div>
                    <ChevronRight size={16} strokeWidth={1.5} className="text-zinc-300 group-hover:text-brand transition-colors" />
                  </Link>
                );
              })}
            </div>
          )}
          <div className="border-t border-zinc-200">
            <Pagination page={quotesPage} pageSize={QUOTES_PAGE_SIZE} total={quotes.length} onPageChange={setQuotesPage} compact />
          </div>
        </div>
      </div>

      {/* Projects for this customer */}
      {projects.length > 0 && (
        <div className="px-4 sm:px-6 lg:px-8 pb-8" data-testid="customer-projects">
          <div className="bg-white border border-zinc-200">
            <div className="flex items-center px-5 h-14 border-b border-zinc-200">
              <h3 className="font-heading font-semibold flex items-center gap-2">
                <FolderKanban size={15} strokeWidth={1.5} className="text-brand" />
                {t("projects.title")} <span className="text-zinc-400 text-sm font-normal">({projects.length})</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-200 bg-zinc-50/60">
                    <th className="px-5 py-3 font-semibold">{t("projects.name")}</th>
                    <th className="px-5 py-3 font-semibold text-right">{t("projects.projectAmount")}</th>
                    <th className="px-5 py-3 font-semibold text-right">{t("projects.remainingReceivable")}</th>
                    <th className="px-5 py-3 font-semibold text-right">{t("projects.profit")}</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {projects.map((p) => (
                    <tr key={p.id} className="group hover:bg-zinc-50 cursor-pointer transition-colors" onClick={() => navigate(`/projeler/${p.id}`)} data-testid={`customer-project-row-${p.id}`}>
                      <td className="px-5 py-3 font-medium text-zinc-900">{p.name}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-zinc-700">{formatMoney(p.amount, p.currency)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-amber-600">{formatMoney(p.remaining_receivable, p.currency)}</td>
                      <td className={`px-5 py-3 text-right tabular-nums font-semibold ${p.profit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatMoney(p.profit, p.currency)}</td>
                      <td className="px-5 py-3 text-right"><ChevronRight size={16} className="text-zinc-300 group-hover:text-brand transition-colors inline" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </FullBleed>
  );
}

function Row({ label, children }) {
  return (
    <div>
      <Label className="text-xs text-zinc-500">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
