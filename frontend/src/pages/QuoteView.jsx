import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, formatApiError, formatDate, formatMoney } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import { PageBand, FullBleed } from "../components/Blueprint";
import StatusBadge from "../components/StatusBadge";
import QuotePDFTemplate from "../components/QuotePDFTemplate";
import { Button } from "../components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "../components/ui/dropdown-menu";
import {
  Download, Pencil, Trash2, Send, MessageCircle, Mail, GitBranch, Loader2, Printer, FileDown, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_KEYS = ["taslak", "gonderildi", "kabul", "red", "suresi_doldu"];

export default function QuoteView() {
  const { t } = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const pdfRef = useRef(null);
  const [generating, setGenerating] = useState(false);
  const [translated, setTranslated] = useState(null);

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [waOpen, setWaOpen] = useState(false);
  const [waNumber, setWaNumber] = useState("");
  const [waMessage, setWaMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [q, c] = await Promise.all([api.get(`/quotes/${id}`), api.get("/settings")]);
      setQuote(q.data);
      setCustomer(q.data.customer);
      setCompany(c.data);
      const companyName = c.data.company_name || t("brand.name");
      setEmailTo(q.data.customer?.email || "");
      setEmailSubject(t("quoteView.emailDefaultSubject", { company: companyName, no: q.data.quote_no }));
      setEmailMessage(
        t("quoteView.emailDefaultBody", {
          name: q.data.customer?.contact_person || q.data.customer?.company_name || "",
          no: q.data.quote_no,
          company: companyName,
        })
      );
      setWaNumber(q.data.customer?.whatsapp || q.data.customer?.phone || "");
      setWaMessage(t("quoteView.whatsappDefault", { no: q.data.quote_no }));
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const generatePdf = async (rootId = "quote-pdf-root") => {
    setGenerating(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const node = document.getElementById(rootId);
      if (!node) throw new Error(t("quoteView.pdfTemplateNotFound"));

      const waitForImages = async () => {
        const imgs = Array.from(node.querySelectorAll("img"));
        await Promise.all(imgs.map((img) => new Promise((resolve) => {
          if (img.complete && img.naturalWidth > 0) return resolve();
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          setTimeout(done, 8000);
        })));
      };
      await waitForImages();
      await new Promise((r) => setTimeout(r, 250));
      await waitForImages();

      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        allowTaint: false,
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);

      const nodeRect = node.getBoundingClientRect();
      const ratio = canvas.height / nodeRect.height;
      const breakables = node.querySelectorAll("tbody tr, .pdf-section, .pdf-row");
      const safeStops = new Set([0, canvas.height]);
      breakables.forEach((el) => {
        const r = el.getBoundingClientRect();
        safeStops.add(Math.round((r.top - nodeRect.top) * ratio));
        safeStops.add(Math.round((r.bottom - nodeRect.top) * ratio));
      });
      const stops = Array.from(safeStops).sort((a, b) => a - b);

      const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const pxPerMm = canvas.width / pageW;
      const pageHeightCanvasPx = Math.floor(pageH * pxPerMm);

      let cursor = 0;
      while (cursor < canvas.height) {
        const idealEnd = cursor + pageHeightCanvasPx;
        let sliceEnd;
        if (idealEnd >= canvas.height) {
          sliceEnd = canvas.height;
        } else {
          const candidate = stops.filter((s) => s > cursor + 50 && s <= idealEnd).pop();
          sliceEnd = candidate || idealEnd;
        }
        const sliceHeight = sliceEnd - cursor;

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, cursor, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
        const slice = pageCanvas.toDataURL("image/jpeg", 0.92);
        const sliceMm = sliceHeight / pxPerMm;
        if (cursor > 0) pdf.addPage();
        pdf.addImage(slice, "JPEG", 0, 0, pageW, sliceMm);
        cursor = sliceEnd;
      }
      void imgData;
      return pdf;
    } finally {
      setGenerating(false);
    }
  };

  // Collect translatable strings from the quote (+ company tagline) into a flat list + a map to rebuild.
  const collectTexts = (q, comp) => {
    const texts = [], map = [];
    (q.items || []).forEach((it, i) => {
      texts.push(it.title || ""); map.push(["title", i]);
      texts.push(it.description || ""); map.push(["description", i]);
      (it.features || []).forEach((f, fi) => { texts.push(f || ""); map.push(["feature", i, fi]); });
    });
    texts.push(q.notes || ""); map.push(["notes"]);
    if (comp?.tagline) { texts.push(comp.tagline); map.push(["company_tagline"]); }
    return { texts, map };
  };

  const applyTranslations = (q, comp, map, translations) => {
    const copy = JSON.parse(JSON.stringify(q));
    const compCopy = comp ? JSON.parse(JSON.stringify(comp)) : comp;
    translations.forEach((tr, idx) => {
      const m = map[idx];
      if (m[0] === "title") copy.items[m[1]].title = tr;
      else if (m[0] === "description") copy.items[m[1]].description = tr;
      else if (m[0] === "feature") copy.items[m[1]].features[m[2]] = tr;
      else if (m[0] === "notes") copy.notes = tr;
      else if (m[0] === "company_tagline" && compCopy) compCopy.tagline = tr;
    });
    return { quote: copy, company: compCopy };
  };

  const downloadTranslated = async (targetLang, priceless = false) => {
    setGenerating(true);
    try {
      const { texts, map } = collectTexts(quote, company);
      const r = await api.post("/translate", { target_lang: targetLang, texts });
      const translations = r.data.translations || texts;
      const { quote: tq, company: tCompany } = applyTranslations(quote, company, map, translations);
      setTranslated({ quote: tq, company: tCompany, lang: targetLang, priceless });
      // wait for the hidden template to render
      await new Promise((res) => setTimeout(res, 500));
      const pdf = await generatePdf("quote-pdf-root-translated");
      const suffix = priceless ? `-${t("quoteView.pricelessSuffix")}` : "";
      pdf.save(`${t("quoteView.pdfFilePrefix")}-${quote.quote_no}-${targetLang.toUpperCase()}${suffix}.pdf`);
    } catch (e) {
      toast.error(t("quoteView.translateError") + (e.response?.data?.detail || e.message || ""));
    } finally {
      setGenerating(false);
      setTranslated(null);
    }
  };

  const sendEmail = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const pdf = await generatePdf();
      const base64 = pdf.output("datauristring");
      await api.post(`/quotes/${id}/email`, {
        recipient_email: emailTo,
        subject: emailSubject,
        message: `<div style="font-family:sans-serif;line-height:1.6;white-space:pre-wrap">${emailMessage.replace(/</g, "&lt;")}</div>`,
        pdf_base64: base64,
      });
      toast.success(t("quoteView.emailSent"));
      setEmailOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSending(false);
    }
  };

  const openWhatsApp = () => {
    const clean = (waNumber || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
    const url = `https://wa.me/${clean}?text=${encodeURIComponent(waMessage)}`;
    window.open(url, "_blank");
    if (quote.status === "taslak") {
      api.put(`/quotes/${id}`, { status: "gonderildi" }).then(load).catch(() => {});
    }
    setWaOpen(false);
  };

  const updateStatus = async (s) => {
    try {
      await api.put(`/quotes/${id}`, { status: s });
      toast.success(t("quoteView.statusUpdated"));
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const revise = async () => {
    try {
      const r = await api.post(`/quotes/${id}/revise`);
      toast.success(t("quoteView.revisionCreated", { no: r.data.quote_no }));
      navigate(`/teklifler/${r.data.id}/duzenle`);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const remove = async () => {
    if (!window.confirm(t("quoteView.confirmDelete"))) return;
    try {
      await api.delete(`/quotes/${id}`);
      toast.success(t("quoteView.quoteDeleted"));
      navigate("/teklifler");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  if (loading) return <div className="p-8 text-zinc-400">{t("common.loading")}</div>;
  if (!quote) return <div className="p-8 text-zinc-400">{t("quoteView.notFound")}</div>;

  const subtitle = (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {customer ? <span>{customer.company_name}</span> : null}
      {quote.creator?.name && (
        <span className="inline-flex items-center gap-1 text-xs text-zinc-500" data-testid="quote-creator">
          <span className="inline-block w-1 h-1 rounded-full bg-zinc-300" />
          {t("quoteView.preparedByLabel")}<b className="text-zinc-700">{quote.creator.name}</b>
        </span>
      )}
    </span>
  );

  return (
    <FullBleed testid="quote-view">
      <PageBand
        eyebrow={t("nav.quotes")}
        title={t("quoteView.quoteTitle", { no: quote.quote_no })}
        subtitle={subtitle}
        back={{ to: "/teklifler", label: t("quoteView.backToQuotes"), testid: "back-to-quotes" }}
      >
        <StatusBadge status={quote.status} />
        <Select value={quote.status} onValueChange={updateStatus}>
          <SelectTrigger className="w-40 h-11 border-zinc-200" data-testid="quote-status-change"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_KEYS.map((s) => (<SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>))}
          </SelectContent>
        </Select>
      </PageBand>

      {/* Action toolbar */}
      <div className="flex flex-wrap gap-2 px-4 sm:px-6 lg:px-8 py-4 border-b border-zinc-200 bg-white">
        <Link to={`/teklifler/${id}/duzenle`}>
          <Button variant="outline" data-testid="edit-quote-btn"><Pencil size={14} strokeWidth={1.5} className="mr-2" /> {t("common.edit")}</Button>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={generating} className="bg-brand hover:bg-brand-hover text-white" data-testid="download-pdf-btn">
              {generating ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Download size={14} strokeWidth={1.5} className="mr-2" />}
              {t("quoteView.downloadPdf")}
              <ChevronDown size={14} className="ml-2 opacity-80" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onClick={() => downloadTranslated("tr", false)} data-testid="download-pdf-tr">
              <span className="mr-2 text-base leading-none">🇹🇷</span> {t("quoteView.langTurkish")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadTranslated("de", false)} data-testid="download-pdf-de">
              <span className="mr-2 text-base leading-none">🇩🇪</span> {t("quoteView.langGerman")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={generating} variant="outline" className="border-brand/40 text-brand hover:bg-brand-light" data-testid="download-priceless-pdf-btn">
              {generating ? <Loader2 size={14} className="mr-2 animate-spin" /> : <FileDown size={14} strokeWidth={1.5} className="mr-2" />}
              {t("quoteView.downloadPricelessPdf")}
              <ChevronDown size={14} className="ml-2 opacity-80" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onClick={() => downloadTranslated("tr", true)} data-testid="download-priceless-tr">
              <span className="mr-2 text-base leading-none">🇹🇷</span> {t("quoteView.langTurkish")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadTranslated("de", true)} data-testid="download-priceless-de">
              <span className="mr-2 text-base leading-none">🇩🇪</span> {t("quoteView.langGerman")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" onClick={() => window.print()} data-testid="print-btn"><Printer size={14} strokeWidth={1.5} className="mr-2" /> {t("quoteView.print")}</Button>

        <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="email-btn"><Mail size={14} strokeWidth={1.5} className="mr-2" /> {t("quoteView.emailSend")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="font-heading">{t("quoteView.emailDialogTitle")}</DialogTitle><DialogDescription className="sr-only">{t("quoteView.pdfAutoAttach")}</DialogDescription></DialogHeader>
            <form onSubmit={sendEmail} className="space-y-3">
              <div><Label>{t("quoteView.recipientEmail")}</Label><Input type="email" required value={emailTo} onChange={(e) => setEmailTo(e.target.value)} data-testid="email-to-input" /></div>
              <div><Label>{t("quoteView.subject")}</Label><Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} /></div>
              <div><Label>{t("quoteView.message")}</Label><Textarea rows={6} value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} /></div>
              <div className="text-xs text-zinc-500">{t("quoteView.pdfAutoAttach")}</div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEmailOpen(false)}>{t("common.cancel")}</Button>
                <Button type="submit" disabled={sending} className="bg-brand hover:bg-brand-hover text-white" data-testid="send-email-submit">
                  {sending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Send size={14} strokeWidth={1.5} className="mr-2" />}
                  {t("quoteView.send")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={waOpen} onOpenChange={setWaOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" data-testid="whatsapp-btn">
              <MessageCircle size={14} strokeWidth={1.5} className="mr-2" /> {t("quoteView.whatsappSend")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="font-heading">{t("quoteView.whatsappDialogTitle")}</DialogTitle><DialogDescription className="sr-only">{t("quoteView.whatsappHint")}</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("quoteView.numberLabel")}</Label><Input value={waNumber} onChange={(e) => setWaNumber(e.target.value)} placeholder="+49 151 xxxxxxxx" data-testid="wa-number-input" /></div>
              <div><Label>{t("quoteView.message")}</Label><Textarea rows={4} value={waMessage} onChange={(e) => setWaMessage(e.target.value)} /></div>
              <p className="text-xs text-zinc-500">{t("quoteView.whatsappHint")}</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setWaOpen(false)}>{t("common.cancel")}</Button>
                <Button onClick={openWhatsApp} className="bg-green-600 hover:bg-green-700 text-white" data-testid="wa-send-btn">
                  <MessageCircle size={14} strokeWidth={1.5} className="mr-2" /> {t("quoteView.openAndSend")}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <Button variant="outline" onClick={revise} data-testid="revise-btn"><GitBranch size={14} strokeWidth={1.5} className="mr-2" /> {t("quoteView.newRevision")}</Button>
        <Button variant="ghost" onClick={remove} className="text-red-600 hover:text-red-700 hover:bg-red-50" data-testid="delete-quote-btn"><Trash2 size={14} strokeWidth={1.5} className="mr-2" /> {t("common.delete")}</Button>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5 items-start">
        <div className="min-w-0 order-2 xl:order-1">
          {quote.revisions && quote.revisions.length > 1 && (
            <div className="mb-4 bg-white border border-zinc-200 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">{t("quoteView.revisions")}</div>
              <div className="flex flex-wrap gap-2">
                {quote.revisions.map((r) => (
                  <Link key={r.id} to={`/teklifler/${r.id}`} className={`px-3 py-1 rounded-md text-xs font-medium border ${r.id === id ? "bg-brand text-white border-brand" : "bg-white text-zinc-700 border-zinc-200 hover:border-brand/40"}`}>
                    {r.quote_no} <span className="opacity-60 ml-1">R{r.revision_number}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* PDF preview — paper on a light desk */}
          <div ref={pdfRef} className="overflow-auto p-3 sm:p-6 rounded-lg border border-zinc-200" style={{ background: "#f4f4f5" }}>
            <div className="mx-auto shadow-2xl" style={{ width: "210mm", minWidth: "210mm" }}>
              <QuotePDFTemplate quote={quote} customer={customer} company={company} />
            </div>
          </div>

          {/* Hidden priceless template — off-screen, used only for the "priceless" PDF export */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-99999px", top: 0, width: "210mm" }}>
            <QuotePDFTemplate quote={quote} customer={customer} company={company} priceless rootId="quote-pdf-root-priceless" />
          </div>

          {/* Hidden translated template — rendered on demand for language-specific PDF export */}
          {translated && (
            <div aria-hidden="true" style={{ position: "absolute", left: "-99999px", top: 0, width: "210mm" }}>
              <QuotePDFTemplate quote={translated.quote} customer={customer} company={translated.company || company} lang={translated.lang} priceless={translated.priceless} rootId="quote-pdf-root-translated" />
            </div>
          )}
        </div>

        {/* Meta sidebar */}
        <aside className="order-1 xl:order-2 xl:sticky xl:top-4 space-y-4" data-testid="quote-meta">
          {customer && (
            <div className="bg-white border border-zinc-200 p-5">
              <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">{t("pdf.toCustomer")}</div>
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-lg bg-brand-light text-brand font-heading font-bold flex items-center justify-center text-base shrink-0">{(customer.company_name || "?").charAt(0).toUpperCase()}</span>
                <div className="min-w-0">
                  <Link to={`/musteriler/${customer.id}`} className="font-semibold text-zinc-900 hover:text-brand block truncate">{customer.company_name}</Link>
                  {customer.phone && <div className="text-xs text-zinc-500 truncate">{customer.phone}</div>}
                </div>
              </div>
            </div>
          )}
          <div className="bg-white border border-zinc-200 p-5 space-y-2.5">
            <MetaRow label={t("pdf.date")} value={formatDate(quote.issue_date)} />
            <MetaRow label={t("quoteForm.validUntil")} value={formatDate(quote.valid_until)} />
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">{t("table.status")}</span>
              <StatusBadge status={quote.status} />
            </div>
            <div className="pt-2.5 border-t border-zinc-100 space-y-1.5">
              <div className="flex justify-between text-sm text-zinc-600"><span>{t("quoteForm.subtotal")}</span><span className="tabular-nums">{formatMoney(quote.subtotal, quote.currency)}</span></div>
              {Number(quote.vat_rate) > 0 && (
                <div className="flex justify-between text-sm text-zinc-600"><span>{t("quoteForm.vatLine")} (%{quote.vat_rate})</span><span className="tabular-nums">+ {formatMoney(quote.vat_amount, quote.currency)}</span></div>
              )}
              {Number(quote.discount_rate) > 0 && (
                <div className="flex justify-between text-sm text-red-600"><span>{t("quoteForm.discount")} (%{quote.discount_rate})</span><span className="tabular-nums">- {formatMoney(quote.discount_amount, quote.currency)}</span></div>
              )}
            </div>
            <div className="pt-2.5 border-t border-zinc-100 flex items-end justify-between">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400">{t("quoteForm.grandTotal")}</span>
              <span className="font-heading text-2xl font-bold text-brand tabular-nums">{formatMoney(quote.grand_total, quote.currency)}</span>
            </div>
          </div>
        </aside>
      </div>
    </FullBleed>
  );
}

function MetaRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-900 font-medium tabular-nums">{value}</span>
    </div>
  );
}
