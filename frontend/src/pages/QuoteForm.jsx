import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, formatApiError, formatMoney } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import { PageBand, FullBleed } from "../components/Blueprint";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "../components/ui/popover";
import { Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

function plusDaysISO(days) {
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
}

const STATUS_KEYS = ["taslak", "gonderildi", "kabul", "red", "suresi_doldu"];

const SECTION = "bg-white border border-zinc-200";
const SECTION_HEAD = "flex items-center justify-between px-5 h-14 border-b border-zinc-200";
const SECTION_TITLE = "font-heading font-semibold text-zinc-900 flex items-center gap-2";
const DOT = <span className="w-1.5 h-1.5 rounded-full bg-brand" />;

export default function QuoteForm() {
  const { t } = useT();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerId, setCustomerId] = useState(searchParams.get("customer") || "");
  const [customerQuery, setCustomerQuery] = useState("");
  const [currency, setCurrency] = useState("TRY");
  const [discountRate, setDiscountRate] = useState(0);
  const [validUntil, setValidUntil] = useState(plusDaysISO(30));
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("taslak");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [prodPopOpen, setProdPopOpen] = useState(false);
  const [prodPopOpenBottom, setProdPopOpenBottom] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const s = await api.get("/settings");
        if (!isEdit && s.data) {
          setValidUntil(plusDaysISO(s.data.default_validity_days ?? 30));
          setNotes(s.data.default_quote_notes || "");
        }
        if (isEdit) {
          const q = await api.get(`/quotes/${id}`);
          const d = q.data;
          setCustomerId(d.customer_id);
          setSelectedCustomer(d.customer || null);
          setCurrency(d.currency);
          setDiscountRate(d.discount_rate);
          setValidUntil((d.valid_until || "").slice(0, 10));
          setNotes(d.notes || "");
          setStatus(d.status);
          setItems(d.items || []);
        } else if (searchParams.get("customer")) {
          const pre = await api.get(`/customers/${searchParams.get("customer")}`);
          setSelectedCustomer(pre.data);
        }
      } catch (e) {
        toast.error(formatApiError(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, [id]);

  useEffect(() => {
    if (!customerQuery || customerQuery.length < 2) { setCustomers([]); return; }
    const tmr = setTimeout(async () => {
      try {
        const r = await api.get("/customers", { params: { search: customerQuery, page_size: 20 } });
        setCustomers(r.data.items || []);
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(tmr);
  }, [customerQuery]);

  useEffect(() => {
    if (!productQuery || productQuery.length < 2) { setProductResults([]); return; }
    const tmr = setTimeout(async () => {
      try {
        const r = await api.get("/products", { params: { search: productQuery, limit: 12 } });
        setProductResults(r.data);
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(tmr);
  }, [productQuery]);

  const totals = useMemo(() => {
    let sub = 0;
    items.forEach((it) => {
      const line = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
      sub += line - line * ((Number(it.discount_percent) || 0) / 100);
    });
    const discAmount = sub * ((Number(discountRate) || 0) / 100);
    const grand = sub - discAmount;
    return { subtotal: sub, discAmount, grand };
  }, [items, discountRate]);

  const addProduct = (p) => {
    setItems((xs) => [
      ...xs,
      { product_id: p.id, code: p.code || p.gtin || "", title: p.title, description: "", image: p.image, quantity: 1, unit_price: p.price, discount_percent: 0 },
    ]);
    setProductQuery("");
    setProductResults([]);
    setProdPopOpen(false);
  };

  const addBlankItem = () => {
    setItems((xs) => [...xs, { product_id: null, code: "", title: t("quoteForm.customItemDefault"), image: "", quantity: 1, unit_price: 0, discount_percent: 0 }]);
  };

  const updateItem = (idx, patch) => setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const removeItem = (idx) => setItems((xs) => xs.filter((_, i) => i !== idx));

  const save = async () => {
    if (!customerId) { toast.error(t("quoteForm.selectCustomer")); return; }
    if (items.length === 0) { toast.error(t("quoteForm.addAtLeastOne")); return; }
    setSaving(true);
    try {
      const payload = {
        customer_id: customerId,
        currency,
        vat_rate: 0,
        discount_rate: Number(discountRate) || 0,
        valid_until: validUntil,
        notes,
        status,
        items: items.map((x) => ({
          ...x,
          quantity: Number(x.quantity) || 0,
          unit_price: Number(x.unit_price) || 0,
          discount_percent: Number(x.discount_percent) || 0,
        })),
      };
      let res;
      if (isEdit) res = await api.put(`/quotes/${id}`, payload);
      else res = await api.post("/quotes", payload);
      toast.success(isEdit ? t("quoteForm.quoteUpdated") : t("quoteForm.quoteCreated"));
      navigate(`/teklifler/${res.data.id}`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-zinc-400">{t("common.loading")}</div>;

  const ProductSearchList = ({ onPick }) => (
    <>
      <div className="p-3 border-b border-zinc-100">
        <div className="relative">
          <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input className="pl-9 h-9" placeholder={t("quoteForm.productSearchPlaceholder")} value={productQuery} onChange={(e) => setProductQuery(e.target.value)} autoFocus data-testid="product-search-popover-input" />
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {productResults.map((p) => (
          <button key={p.id} type="button" onClick={() => onPick(p)} className="w-full text-left px-3 py-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-0 flex gap-3 items-center" data-testid={`product-option-${p.id}`}>
            {p.image && <img src={p.image} alt="" className="w-10 h-10 object-contain bg-zinc-50 rounded" />}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono uppercase text-zinc-500">#{p.code || p.gtin}</div>
              <div className="text-sm font-medium line-clamp-1">{p.title}</div>
              <div className="text-xs text-brand">{formatMoney(p.price, p.currency)}</div>
            </div>
          </button>
        ))}
        {productQuery.length >= 2 && productResults.length === 0 && <div className="p-4 text-sm text-zinc-400 text-center">{t("common.noResult")}</div>}
        {productQuery.length < 2 && <div className="p-4 text-sm text-zinc-400 text-center">{t("quoteForm.min2chars")}</div>}
      </div>
    </>
  );

  return (
    <FullBleed testid="quote-form">
      <PageBand
        eyebrow={t("nav.quotes")}
        title={isEdit ? t("quoteForm.editQuote") : t("quoteForm.newQuote")}
        subtitle={t("quoteForm.subtitle")}
        back={{ to: "#", onClick: (e) => { e.preventDefault(); navigate(-1); }, label: t("common.back"), testid: "back-btn" }}
      >
        <Button onClick={save} disabled={saving} className="bg-brand hover:bg-brand-hover text-white h-11 px-5" data-testid="save-quote-btn">
          <Save size={16} strokeWidth={1.5} className="mr-2" /> {saving ? t("common.saving") : t("common.save")}
        </Button>
      </PageBand>

      <div className="px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-5">
          {/* Customer */}
          <section className={SECTION}>
            <div className={SECTION_HEAD}><h3 className={SECTION_TITLE}>{DOT}{t("quoteForm.customer")}</h3></div>
            <div className="p-5">
              <div className="relative mb-2">
                <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input className="pl-9" placeholder={t("quoteForm.customerSearchPlaceholder")} value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} data-testid="quote-customer-search" />
              </div>
              {customerQuery && (
                <div className="border border-zinc-200 rounded-lg max-h-60 overflow-y-auto">
                  {customers.slice(0, 20).map((c) => (
                    <button key={c.id} type="button" onClick={() => { setCustomerId(c.id); setSelectedCustomer(c); setCustomerQuery(""); }} className="w-full text-left px-4 py-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-0" data-testid={`quote-customer-option-${c.id}`}>
                      <div className="font-medium text-sm">{c.company_name}</div>
                      <div className="text-xs text-zinc-500">{c.tax_number || ""} {c.tax_number && c.phone ? "·" : ""} {c.phone || ""}</div>
                    </button>
                  ))}
                  {customers.length === 0 && <div className="p-3 text-sm text-zinc-400">{t("quoteForm.noCustomerResult")}</div>}
                </div>
              )}
              {selectedCustomer && (
                <div className="mt-3 border border-brand/40 bg-brand-light rounded-lg p-3 flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-zinc-900">{selectedCustomer.company_name}</div>
                    <div className="text-xs text-zinc-600">
                      {selectedCustomer.tax_number ? `${t("pdf.taxNoShort")}${selectedCustomer.tax_number}` : ""}
                      {selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}
                      {selectedCustomer.email ? ` · ${selectedCustomer.email}` : ""}
                    </div>
                  </div>
                  <button type="button" onClick={() => { setCustomerId(""); setSelectedCustomer(null); }} className="text-zinc-500 hover:text-zinc-900"><X size={16} /></button>
                </div>
              )}
            </div>
          </section>

          {/* Items */}
          <section className={SECTION}>
            <div className={SECTION_HEAD}>
              <h3 className={SECTION_TITLE}>{DOT}{t("quoteForm.items")}</h3>
              <div className="flex gap-2">
                <Popover open={prodPopOpen} onOpenChange={setProdPopOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="add-product-btn"><Plus size={14} strokeWidth={1.5} className="mr-1" /> {t("quoteForm.addProduct")}</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 p-0"><ProductSearchList onPick={addProduct} /></PopoverContent>
                </Popover>
                <Button variant="outline" size="sm" onClick={addBlankItem} data-testid="add-custom-item-btn"><Plus size={14} strokeWidth={1.5} className="mr-1" /> {t("quoteForm.customItem")}</Button>
              </div>
            </div>
            <div className="p-5">
              {items.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-400 border border-dashed border-zinc-200 rounded-lg">{t("quoteForm.noItems")}</div>
              ) : (
                <>
                  <div className="space-y-3">
                    {items.map((it, i) => (
                      <ItemRow key={i} idx={i} item={it} currency={currency} onChange={(patch) => updateItem(i, patch)} onRemove={() => removeItem(i)} />
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-zinc-100">
                    <Popover open={prodPopOpenBottom} onOpenChange={setProdPopOpenBottom}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" data-testid="add-product-btn-bottom"><Plus size={14} strokeWidth={1.5} className="mr-1" /> {t("quoteForm.addProduct")}</Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-96 p-0" align="end"><ProductSearchList onPick={(p) => { addProduct(p); setProdPopOpenBottom(false); }} /></PopoverContent>
                    </Popover>
                    <Button variant="outline" size="sm" onClick={addBlankItem} data-testid="add-custom-item-btn-bottom"><Plus size={14} strokeWidth={1.5} className="mr-1" /> {t("quoteForm.customItem")}</Button>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Notes */}
          <section className={SECTION}>
            <div className={SECTION_HEAD}><h3 className={SECTION_TITLE}>{DOT}{t("quoteForm.notesTitle")}</h3></div>
            <div className="p-5">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder={t("quoteForm.notesPlaceholder")} data-testid="quote-notes" />
            </div>
          </section>
        </div>

        {/* RIGHT */}
        <div className="space-y-5">
          <section className={SECTION}>
            <div className={SECTION_HEAD}><h3 className={SECTION_TITLE}>{DOT}{t("quoteForm.settings")}</h3></div>
            <div className="p-5 space-y-4">
              <div><Label>{t("quoteForm.currency")}</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="mt-1" data-testid="quote-currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRY">{t("quoteForm.currencyTRY")}</SelectItem>
                    <SelectItem value="USD">{t("quoteForm.currencyUSD")}</SelectItem>
                    <SelectItem value="EUR">{t("quoteForm.currencyEUR")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("quoteForm.validUntil")}</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="mt-1" data-testid="quote-valid-until" /></div>
              <div>
                <Label>{t("quoteForm.discount")} <span className="text-xs text-zinc-500 font-normal">{t("quoteForm.discountHint")}</span></Label>
                <Input type="number" step="0.01" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} className="mt-1" data-testid="quote-discount-rate" />
              </div>
              <div><Label>{t("quoteForm.statusLabel")}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_KEYS.map((s) => (<SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className={`${SECTION} lg:sticky lg:top-4`} data-testid="quote-totals">
            <div className={SECTION_HEAD}><h3 className={SECTION_TITLE}>{DOT}{t("quoteForm.total")}</h3></div>
            <div className="p-5">
              <Row label={t("quoteForm.subtotal")} value={formatMoney(totals.subtotal, currency)} />
              {Number(discountRate) > 0 && (
                <Row label={`${t("quoteForm.discount")} (%${discountRate})`} value={`- ${formatMoney(totals.discAmount, currency)}`} accent="red" />
              )}
              <div className="mt-3 pt-3 border-t border-zinc-200 flex items-end justify-between">
                <div>
                  <div className="text-sm text-zinc-500 leading-tight">{t("quoteForm.grandTotal")}</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 mt-0.5">{t("quoteForm.vatIncluded")}</div>
                </div>
                <div className="font-heading text-2xl font-bold text-brand tabular-nums">{formatMoney(totals.grand, currency)}</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </FullBleed>
  );
}

function Row({ label, value, bold, accent }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className={`text-sm ${bold ? "font-medium text-zinc-900" : "text-zinc-600"}`}>{label}</div>
      <div className={`text-sm tabular-nums ${bold ? "font-semibold" : ""} ${accent === "red" ? "text-red-600" : "text-zinc-900"}`}>{value}</div>
    </div>
  );
}

function ItemRow({ item, onChange, onRemove, currency }) {
  const { t } = useT();
  const [editing, setEditing] = useState({});
  const start = (field) => setEditing((x) => ({ ...x, [field]: true }));
  const stop = (field) => setEditing((x) => ({ ...x, [field]: false }));

  const editField = (field, type = "text") => (
    editing[field] ? (
      <Input autoFocus type={type} value={item[field] ?? ""} onChange={(e) => onChange({ [field]: e.target.value })} onBlur={() => stop(field)} onKeyDown={(e) => e.key === "Enter" && stop(field)} className="h-8" data-testid={`item-${field}-input`} />
    ) : (
      <button type="button" onClick={() => start(field)} className="inline-flex items-center gap-1.5 text-left hover:text-brand group">
        <span>{type === "number" ? Number(item[field] || 0) : (item[field] || <span className="text-zinc-400 italic">{t("quoteForm.editPlaceholder")}</span>)}</span>
        <Pencil size={11} strokeWidth={1.5} className="text-zinc-400 group-hover:text-brand opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    )
  );

  const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
  const lineAfter = lineTotal - lineTotal * ((Number(item.discount_percent) || 0) / 100);

  return (
    <div className="border border-zinc-200 rounded-lg p-4 hover:border-brand/40 transition-colors">
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 md:col-span-2">
          {editing.image ? (
            <Input autoFocus value={item.image || ""} onChange={(e) => onChange({ image: e.target.value })} onBlur={() => stop("image")} placeholder={t("quoteForm.imageUrl")} className="h-8 text-xs" />
          ) : (
            <button type="button" onClick={() => start("image")} className="group relative block w-full aspect-square bg-zinc-50 rounded-lg overflow-hidden border border-zinc-200">
              {item.image ? <img src={item.image} alt="" className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-zinc-300 text-xs">{t("quoteForm.noImage")}</div>}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"><Pencil size={14} strokeWidth={1.5} /></div>
            </button>
          )}
        </div>
        <div className="col-span-12 md:col-span-7 space-y-1">
          <div className="text-[10px] font-mono uppercase text-zinc-500">{t("quoteForm.itemCode")}: {editField("code")}</div>
          <div className="font-medium text-zinc-900">{editField("title")}</div>
          <div className="text-xs text-zinc-500">{t("quoteForm.itemDesc")}: {editField("description")}</div>
        </div>
        <div className="col-span-12 md:col-span-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[10px] uppercase tracking-wider text-zinc-500">{t("quoteForm.itemQty")}</Label><div className="text-sm mt-0.5">{editField("quantity", "number")}</div></div>
            <div><Label className="text-[10px] uppercase tracking-wider text-zinc-500">{t("quoteForm.itemUnitPrice")}</Label><div className="text-sm mt-0.5">{editField("unit_price", "number")}</div></div>
            <div><Label className="text-[10px] uppercase tracking-wider text-zinc-500">{t("quoteForm.itemDiscPct")}</Label><div className="text-sm mt-0.5">{editField("discount_percent", "number")}</div></div>
            <div><Label className="text-[10px] uppercase tracking-wider text-zinc-500">{t("quoteForm.itemLineTotal")}</Label><div className="text-sm mt-0.5 font-medium tabular-nums">{formatMoney(lineAfter, currency)}</div></div>
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8" data-testid="remove-item-btn">
          <Trash2 size={13} strokeWidth={1.5} className="mr-1" /> {t("quoteForm.remove")}
        </Button>
      </div>
    </div>
  );
}
