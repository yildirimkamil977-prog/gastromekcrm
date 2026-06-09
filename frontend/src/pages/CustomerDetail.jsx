import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, formatApiError, formatDate, formatMoney } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import { PageBand, FullBleed } from "../components/Blueprint";
import StatusBadge from "../components/StatusBadge";
import Pagination from "../components/Pagination";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";

const QUOTES_PAGE_SIZE = 10;

export default function CustomerDetail() {
  const { t } = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [quotes, setQuotes] = useState([]);
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

      <div className="px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-px bg-zinc-200 border border-zinc-200 lg:divide-x-0">
        {/* Company info */}
        <div className="lg:col-span-1 bg-white p-6 space-y-4">
          <h3 className="font-heading font-semibold flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-brand" />{t("customerDetail.companyInfo")}</h3>
          <Row label={t("customerDetail.companyName")}><Input value={customer.company_name || ""} onChange={(e) => setCustomer({ ...customer, company_name: e.target.value })} /></Row>
          <Row label={t("customers.thTaxNo")}><Input value={customer.tax_number || ""} onChange={(e) => setCustomer({ ...customer, tax_number: e.target.value })} /></Row>
          <Row label={t("customers.taxOffice")}><Input value={customer.tax_office || ""} onChange={(e) => setCustomer({ ...customer, tax_office: e.target.value })} /></Row>
          <Row label={t("customers.contactPerson")}><Input value={customer.contact_person || ""} onChange={(e) => setCustomer({ ...customer, contact_person: e.target.value })} /></Row>
          <Row label={t("customers.phone")}><Input value={customer.phone || ""} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></Row>
          <Row label="WhatsApp"><Input value={customer.whatsapp || ""} onChange={(e) => setCustomer({ ...customer, whatsapp: e.target.value })} /></Row>
          <Row label={t("customers.email")}><Input type="email" value={customer.email || ""} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} /></Row>
          <Row label={t("customers.city")}><Input value={customer.city || ""} onChange={(e) => setCustomer({ ...customer, city: e.target.value })} /></Row>
          <Row label={t("customers.address")}><Textarea value={customer.address || ""} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} rows={2} /></Row>
          <Row label={t("customers.notes")}><Textarea value={customer.notes || ""} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} rows={3} /></Row>
        </div>

        {/* Quotes ledger */}
        <div className="lg:col-span-2 bg-white">
          <div className="flex items-center px-6 h-14 border-b border-zinc-200">
            <h3 className="font-heading font-semibold flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-brand" />{t("customerDetail.quotes")} <span className="text-zinc-400 text-sm font-normal">({quotes.length})</span></h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold bg-zinc-50 border-b border-zinc-200">
                  <th className="px-6 py-3">{t("table.quoteNo")}</th>
                  <th className="px-4 py-3 hidden sm:table-cell">{t("table.date")}</th>
                  <th className="px-4 py-3 hidden md:table-cell">{t("table.preparedBy")}</th>
                  <th className="px-4 py-3 text-right">{t("table.amount")}</th>
                  <th className="px-6 py-3">{t("table.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {quotes.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-zinc-400 text-sm">{t("dashboard.noQuotes")}</td></tr>}
                {pagedQuotes.map((q) => (
                  <tr key={q.id} className="hover:bg-zinc-50 transition-colors text-sm">
                    <td className="px-6 py-3 font-mono text-xs"><Link to={`/teklifler/${q.id}`} className="text-brand hover:underline font-semibold">{q.quote_no}</Link></td>
                    <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell">{formatDate(q.issue_date)}</td>
                    <td className="px-4 py-3 text-zinc-500 hidden md:table-cell">{q.creator?.name || "-"}</td>
                    <td className="px-4 py-3 font-semibold text-zinc-900 text-right tabular-nums">{formatMoney(q.grand_total, q.currency)}</td>
                    <td className="px-6 py-3"><StatusBadge status={q.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-zinc-200">
            <Pagination page={quotesPage} pageSize={QUOTES_PAGE_SIZE} total={quotes.length} onPageChange={setQuotesPage} compact />
          </div>
        </div>
      </div>
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
