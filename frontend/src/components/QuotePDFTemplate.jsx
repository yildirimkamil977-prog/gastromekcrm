import React from "react";
import { formatDate, formatMoney, API_URL } from "../lib/api";
import { useT } from "../i18n/LanguageContext";

/**
 * Image with automatic proxy fallback.
 * Loads the URL directly first (fast, works for feed CDN). If the browser
 * throws an error (CORS block, 404, network), swaps src to the backend
 * image-proxy endpoint so html2canvas can still render it.
 */
function SafeImg({ src, style, alt = "" }) {
  const [current, setCurrent] = React.useState(src);
  const [triedProxy, setTriedProxy] = React.useState(false);
  React.useEffect(() => { setCurrent(src); setTriedProxy(false); }, [src]);
  const handleError = () => {
    if (triedProxy || !src || src.startsWith("data:")) return;
    try {
      const u = new URL(src, window.location.origin);
      const sameOrigin = u.origin === window.location.origin;
      if (sameOrigin) return;
    } catch { return; }
    setTriedProxy(true);
    setCurrent(`${API_URL}/image-proxy?url=${encodeURIComponent(src)}`);
  };
  return <img src={current} alt={alt} style={style} crossOrigin="anonymous" onError={handleError} />;
}

/**
 * Printable / PDF quote template.
 * Keeps itself print-friendly; uses inline styles for html2canvas reliability.
 * Text content is localized via the active language (German default / Turkish).
 */
export default function QuotePDFTemplate({ quote, customer, company }) {
  const { t } = useT();
  const {
    quote_no, issue_date, valid_until, currency, items = [],
    subtotal = 0, vat_amount = 0, vat_rate = 0,
    discount_amount = 0, grand_total = 0, discount_rate = 0,
    notes,
  } = quote || {};

  return (
    <div
      className="pdf-root"
      id="quote-pdf-root"
      style={{
        padding: "12mm 16mm 16mm",
        width: "210mm",
        minHeight: "297mm",
        background: "#ffffff",
        color: "#0f172a",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #70c800", paddingBottom: 10 }}>
        <div style={{ maxWidth: "55%" }}>
          {company?.logo_url ? (
            <SafeImg src={company.logo_url} alt="logo" style={{ maxHeight: 42, maxWidth: 170, objectFit: "contain" }} />
          ) : (
            <div style={{ fontSize: 18, fontFamily: "Outfit, sans-serif", fontWeight: 700, color: "#70c800" }}>
              {company?.company_name || t("brand.name")}
            </div>
          )}
          {company?.tagline && (
            <div style={{ fontSize: 9, color: "#475569", marginTop: 4 }}>
              {company.tagline}
            </div>
          )}
          <div style={{ fontSize: 9, color: "#475569", marginTop: 5, lineHeight: 1.4 }}>
            {company?.address}
            {company?.phone && <><br />{t("pdf.tel")}{company.phone}</>}
            {company?.email && <><br />{t("pdf.email")}{company.email}</>}
            {company?.website && <><br />{company.website}</>}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 24, fontWeight: 700, color: "#70c800", letterSpacing: 2 }}>
            {t("pdf.heading")}
          </div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 6 }}>
            <div><b>{t("pdf.quoteNo")}</b> {quote_no}</div>
            <div><b>{t("pdf.date")}</b> {formatDate(issue_date)}</div>
            <div><b>{t("pdf.validity")}</b> {formatDate(valid_until)}</div>
          </div>
        </div>
      </div>

      {/* Parties */}
      <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
        <div style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 6, padding: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#94a3b8" }}>{t("pdf.toCustomer")}</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{customer?.company_name || "-"}</div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 4, lineHeight: 1.5 }}>
            {customer?.contact_person && <>{customer.contact_person}<br /></>}
            {customer?.address}
            {customer?.tax_number && <><br />{t("pdf.taxNoShort")}{customer.tax_number} {customer.tax_office ? `/ ${customer.tax_office}` : ""}</>}
            {customer?.phone && <><br />{t("pdf.tel")}{customer.phone}</>}
            {customer?.email && <><br />{customer.email}</>}
          </div>
        </div>
        <div style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 6, padding: 12, background: "#f8fafc" }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#94a3b8" }}>{t("pdf.companyInfo")}</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{company?.company_name}</div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 4, lineHeight: 1.5 }}>
            {company?.tax_number && <>{t("pdf.taxNoShort")}{company.tax_number} {company.tax_office ? `/ ${company.tax_office}` : ""}<br /></>}
            {company?.phone}{company?.email && <> · {company.email}</>}
          </div>
        </div>
      </div>

      {/* Items */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20, fontSize: 10 }}>
        <thead>
          <tr style={{ background: "#70c800", color: "#fff" }}>
            <th style={{ padding: "8px 6px", textAlign: "left", width: 40 }}>#</th>
            <th style={{ padding: "8px 6px", textAlign: "left", width: 70 }}>{t("pdf.thImage")}</th>
            <th style={{ padding: "8px 6px", textAlign: "left" }}>{t("pdf.thProduct")}</th>
            <th style={{ padding: "8px 6px", textAlign: "right", width: 50 }}>{t("pdf.thQty")}</th>
            <th style={{ padding: "8px 6px", textAlign: "right", width: 90 }}>{t("pdf.thUnitPrice")}</th>
            <th style={{ padding: "8px 6px", textAlign: "right", width: 50 }}>{t("pdf.thDisc")}</th>
            <th style={{ padding: "8px 6px", textAlign: "right", width: 100 }}>{t("pdf.thAmount")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const line = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
            const after = line - line * ((Number(it.discount_percent) || 0) / 100);
            return (
              <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "8px 6px", verticalAlign: "top" }}>{i + 1}</td>
                <td style={{ padding: "6px", verticalAlign: "top" }}>
                  {it.image ? (
                    <SafeImg src={it.image} alt="" style={{ width: 60, height: 60, objectFit: "contain", background: "#fff", border: "1px solid #e2e8f0" }} />
                  ) : null}
                </td>
                <td style={{ padding: "8px 6px", verticalAlign: "top" }}>
                  {it.code && <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#64748b", textTransform: "uppercase" }}>#{it.code}</div>}
                  <div style={{ fontWeight: 600 }}>{it.title}</div>
                  {it.description && <div style={{ color: "#475569", marginTop: 2 }}>{it.description}</div>}
                  {Array.isArray(it.features) && it.features.filter((f) => (f || "").trim()).length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "1px 12px", marginTop: 4 }}>
                      {it.features.filter((f) => (f || "").trim()).map((f, fi) => (
                        <span key={fi} style={{ fontSize: 9, color: "#475569", lineHeight: 1.45, display: "inline-flex", gap: 4, alignItems: "baseline", whiteSpace: "nowrap" }}>
                          <span style={{ color: "#70c800", fontWeight: 700 }}>•</span>
                          <span>{f}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ padding: "8px 6px", textAlign: "right", verticalAlign: "top" }}>{Number(it.quantity) || 0}</td>
                <td style={{ padding: "8px 6px", textAlign: "right", verticalAlign: "top" }}>{formatMoney(it.unit_price, currency)}</td>
                <td style={{ padding: "8px 6px", textAlign: "right", verticalAlign: "top" }}>{Number(it.discount_percent) || 0}%</td>
                <td style={{ padding: "8px 6px", textAlign: "right", verticalAlign: "top", fontWeight: 600 }}>{formatMoney(after, currency)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <table style={{ fontSize: 11, minWidth: 280, borderCollapse: "separate", borderSpacing: 0 }}>
          <tbody>
            <tr>
              <td style={{ padding: "4px 10px", color: "#475569" }}>{t("pdf.subtotal")}</td>
              <td style={{ padding: "4px 10px", textAlign: "right" }}>{formatMoney(subtotal, currency)}</td>
            </tr>
            {Number(vat_rate) > 0 && (
              <tr>
                <td style={{ padding: "4px 10px", color: "#475569" }}>{t("pdf.vat")} (%{vat_rate})</td>
                <td style={{ padding: "4px 10px", textAlign: "right" }}>+ {formatMoney(vat_amount, currency)}</td>
              </tr>
            )}
            {Number(discount_rate) > 0 && (
              <tr>
                <td style={{ padding: "4px 10px", color: "#b91c1c" }}>{t("pdf.discount")} (%{discount_rate})</td>
                <td style={{ padding: "4px 10px", textAlign: "right", color: "#b91c1c" }}>- {formatMoney(discount_amount, currency)}</td>
              </tr>
            )}
            <tr><td colSpan={2} style={{ height: 8 }} /></tr>
            <tr style={{ background: "#70c800", color: "#fff" }}>
              <td style={{ padding: "12px 14px", fontWeight: 700, lineHeight: 1.3, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }}>
                {t("pdf.grandTotal")}
                <div style={{ fontSize: 8, fontWeight: 500, opacity: 0.9, letterSpacing: 1 }}>{t("pdf.vatIncluded")}</div>
              </td>
              <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, fontSize: 14, borderTopRightRadius: 6, borderBottomRightRadius: 6 }}>{formatMoney(grand_total, currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Notes */}
      {notes && (
        <div style={{ marginTop: 24, padding: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#94a3b8", marginBottom: 4 }}>{t("pdf.notes")}</div>
          <div style={{ fontSize: 10, color: "#334155", whiteSpace: "pre-wrap" }}>{notes}</div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 28, borderTop: "1px solid #e2e8f0", paddingTop: 14, display: "flex", justifyContent: "space-between", gap: 20, fontSize: 9, color: "#64748b" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {(() => {
            const banks = (company?.banks && company.banks.length > 0)
              ? company.banks
              : (company?.bank_name || company?.bank_iban)
                ? [{ name: company.bank_name, account_holder: company.bank_account_holder, iban: company.bank_iban, currency: "TRY" }]
                : [];
            if (banks.length === 0) return null;
            return (
              <div>
                <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#94a3b8", marginBottom: 4 }}>
                  {t("pdf.bankInfo")}
                </div>
                <table style={{ borderCollapse: "collapse", fontSize: 9 }}>
                  <tbody>
                    {banks.slice(0, 3).map((b, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: "2px 8px 2px 0", color: "#64748b", whiteSpace: "nowrap" }}>
                          <b>{b.name}</b>
                          {b.currency && b.currency !== "TRY" ? ` (${b.currency})` : ""}
                        </td>
                        <td style={{ padding: "2px 8px", color: "#64748b", fontFamily: "JetBrains Mono, monospace" }}>
                          {b.iban}
                        </td>
                        {b.account_holder && (
                          <td style={{ padding: "2px 0", color: "#94a3b8" }}>
                            · {b.account_holder}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
        <div style={{ textAlign: "right" }}>
          <div>{t("pdf.validityFooter", { date: formatDate(valid_until) })}</div>
        </div>
      </div>

      {/* Social media */}
      <SocialStrip company={company} />
    </div>
  );
}

function SocialStrip({ company }) {
  const links = [
    { key: "social_instagram", label: "Instagram" },
    { key: "social_facebook", label: "Facebook" },
    { key: "social_twitter", label: "X" },
    { key: "social_linkedin", label: "LinkedIn" },
    { key: "social_youtube", label: "YouTube" },
    { key: "social_tiktok", label: "TikTok" },
  ].filter((l) => (company?.[l.key] || "").trim());

  if (links.length === 0 && !company?.website) return null;

  const display = (url) => {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      return `${u.hostname.replace(/^www\./, "")}${u.pathname !== "/" ? u.pathname : ""}`;
    } catch {
      return url;
    }
  };

  return (
    <div
      style={{
        marginTop: 18,
        padding: "10px 14px",
        background: "#70c800",
        color: "#ffffff",
        borderRadius: 6,
        display: "flex",
        flexWrap: "wrap",
        gap: 14,
        rowGap: 6,
        alignItems: "center",
        justifyContent: "center",
        fontSize: 9,
      }}
    >
      {company?.website && (
        <span style={{ fontWeight: 600 }}>{display(company.website)}</span>
      )}
      {links.map((l, i) => (
        <span key={l.key} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {(company?.website || i > 0) && (
            <span style={{ opacity: 0.5, marginRight: 6 }}>·</span>
          )}
          <b>{l.label}:</b>
          <span>{display(company[l.key])}</span>
        </span>
      ))}
    </div>
  );
}
