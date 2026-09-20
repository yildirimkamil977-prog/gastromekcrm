import React from "react";
import { formatDate, API_URL } from "../lib/api";

function SafeImg({ src, style, alt = "" }) {
  const [current, setCurrent] = React.useState(src);
  const [triedProxy, setTriedProxy] = React.useState(false);
  React.useEffect(() => { setCurrent(src); setTriedProxy(false); }, [src]);
  const handleError = () => {
    if (triedProxy || !src || src.startsWith("data:")) return;
    try {
      const u = new URL(src, window.location.origin);
      if (u.origin === window.location.origin) return;
    } catch { return; }
    setTriedProxy(true);
    setCurrent(`${API_URL}/image-proxy?url=${encodeURIComponent(src)}`);
  };
  return <img src={current} alt={alt} style={style} crossOrigin="anonymous" onError={handleError} />;
}

const L = {
  de: {
    heading: "LIEFERSCHEIN",
    noLabel: "Lieferscheinnr.:", dateLabel: "Lieferdatum:",
    shipTo: "LIEFERANSCHRIFT", orderData: "AUFTRAGSDATEN",
    firm: "Firma / Name:", street: "Straße / Nr.:", city: "PLZ / Ort:", contact: "Ansprechpartner:",
    customerNo: "Kundennr.:", quoteNo: "Angebotsnr.:", orderNo: "Auftragsnr.:",
    pos: "Pos.", artNo: "Art.-Nr.", desc: "Artikelbezeichnung", qty: "Menge", unit: "Einheit", remark: "Bemerkung",
    unitVal: "Stk.",
    notes: "HINWEISE / BESONDERHEITEN",
    received: "Ware vollständig und in einwandfreiem Zustand erhalten.",
    placeDate: "Ort, Datum:", nameBlock: "Name in Druckbuchstaben:",
    confirm: "EMPFANGSBESTÄTIGUNG", signature: "Unterschrift:", stamp: "Stempel:",
    handover: "ÜBERGABE / LIEFERUNG", handoverSig: "Unterschrift (Lieferant):",
    taxNo: "St-Nr.:", hrbNo: "HRB-Nr.:", tel: "Tel:", email: "E-Mail:",
  },
  tr: {
    heading: "İRSALİYE",
    noLabel: "İrsaliye No:", dateLabel: "Sevk Tarihi:",
    shipTo: "TESLİMAT ADRESİ", orderData: "SİPARİŞ BİLGİLERİ",
    firm: "Firma / İsim:", street: "Adres:", city: "Posta Kodu / Şehir:", contact: "Yetkili Kişi:",
    customerNo: "Müşteri No:", quoteNo: "Teklif No:", orderNo: "Sipariş No:",
    pos: "Sıra", artNo: "Ürün Kodu", desc: "Ürün Açıklaması", qty: "Miktar", unit: "Birim", remark: "Açıklama",
    unitVal: "Ad.",
    notes: "NOTLAR / ÖZEL DURUMLAR",
    received: "Ürünler eksiksiz ve sağlam şekilde teslim alınmıştır.",
    placeDate: "Yer, Tarih:", nameBlock: "Ad Soyad (Büyük Harf):",
    confirm: "TESLİM ALAN ONAYI", signature: "İmza:", stamp: "Kaşe:",
    handover: "TESLİM EDEN", handoverSig: "İmza (Teslim Eden):",
    taxNo: "VN:", hrbNo: "HRB No:", tel: "Tel:", email: "E-posta:",
  },
};

const GREEN = "#70c800";

/**
 * Delivery note (İrsaliye / Lieferschein) print template. Bilingual (lang: de|tr).
 * Renders only the given `items` (a subset of the quote items). Client-side PDF.
 */
export default function DeliveryNoteTemplate({
  deliveryNo, items = [], customer, company, lang = "de",
  quoteNo, rootId = "delivery-note-root",
}) {
  const x = L[lang] || L.de;
  const line = { borderBottom: "1px solid #cbd5e1", flex: 1, minHeight: 14 };
  const labelSm = { fontSize: 9, color: "#475569", whiteSpace: "nowrap" };

  return (
    <div
      id={rootId}
      style={{
        padding: "12mm 15mm 14mm",
        width: "210mm",
        minHeight: "297mm",
        background: "#ffffff",
        color: "#0f172a",
        boxSizing: "border-box",
        fontFamily: "Manrope, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ maxWidth: "55%" }}>
          {company?.logo_url ? (
            <SafeImg src={company.logo_url} alt="logo" style={{ maxHeight: 46, maxWidth: 200, objectFit: "contain" }} />
          ) : (
            <div style={{ fontSize: 20, fontFamily: "Outfit, sans-serif", fontWeight: 700, color: GREEN }}>{company?.company_name}</div>
          )}
          {company?.tagline && <div style={{ fontSize: 9, color: "#475569", marginTop: 6 }}>{company.tagline}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 26, fontWeight: 800, color: GREEN, letterSpacing: 2 }}>{x.heading}</div>
          <table style={{ marginTop: 10, marginLeft: "auto", fontSize: 10, color: "#334155", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ padding: "2px 8px 2px 0", textAlign: "right", fontWeight: 700 }}>{x.noLabel}</td>
                <td style={{ borderBottom: "1px solid #94a3b8", minWidth: 120, textAlign: "left", paddingLeft: 6 }}>{deliveryNo || ""}</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 8px 2px 0", textAlign: "right", fontWeight: 700 }}>{x.dateLabel}</td>
                <td style={{ borderBottom: "1px solid #94a3b8", minWidth: 120, textAlign: "left", paddingLeft: 6 }}>{formatDate(new Date().toISOString())}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ height: 3, background: GREEN, borderRadius: 2, marginTop: 10 }} />

      {/* Ship-to + order data */}
      <div style={{ display: "flex", gap: 14, marginTop: 16 }}>
        <div style={{ flex: 1, background: "#f0f9e0", borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: GREEN, marginBottom: 8 }}>{x.shipTo}</div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{customer?.company_name || ""}</div>
          <div style={{ fontSize: 10, color: "#334155", marginTop: 4, lineHeight: 1.7 }}>
            {customer?.contact_person && <div>{customer.contact_person}</div>}
            {customer?.address && <div>{customer.address}</div>}
            {customer?.phone && <div>{x.tel} {customer.phone}</div>}
          </div>
        </div>
        <div style={{ flex: 1, background: "#f8fafc", borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: "#64748b", marginBottom: 8 }}>{x.orderData}</div>
          <table style={{ fontSize: 10, color: "#334155", borderCollapse: "collapse", width: "100%" }}>
            <tbody>
              <tr><td style={{ ...labelSm, padding: "3px 8px 3px 0" }}>{x.quoteNo}</td><td style={{ borderBottom: "1px solid #cbd5e1" }}>{quoteNo || ""}</td></tr>
              <tr><td style={{ ...labelSm, padding: "3px 8px 3px 0" }}>{x.customerNo}</td><td style={{ borderBottom: "1px solid #cbd5e1" }}>{customer?.customer_no || customer?.tax_number || ""}</td></tr>
              <tr><td style={{ ...labelSm, padding: "3px 8px 3px 0" }}>{x.orderNo}</td><td style={{ borderBottom: "1px solid #cbd5e1", minHeight: 14 }}>&nbsp;</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Items table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16, fontSize: 10 }}>
        <thead>
          <tr style={{ background: GREEN, color: "#fff" }}>
            <th style={{ padding: "8px 6px", textAlign: "left", width: 40 }}>{x.pos}</th>
            <th style={{ padding: "8px 6px", textAlign: "left", width: 90 }}>{x.artNo}</th>
            <th style={{ padding: "8px 6px", textAlign: "left" }}>{x.desc}</th>
            <th style={{ padding: "8px 6px", textAlign: "center", width: 60 }}>{x.qty}</th>
            <th style={{ padding: "8px 6px", textAlign: "center", width: 60 }}>{x.unit}</th>
            <th style={{ padding: "8px 6px", textAlign: "left", width: 120 }}>{x.remark}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
              <td style={{ padding: "9px 6px", verticalAlign: "top" }}>{i + 1}</td>
              <td style={{ padding: "9px 6px", verticalAlign: "top", fontFamily: "JetBrains Mono, monospace", fontSize: 9 }}>{it.code || ""}</td>
              <td style={{ padding: "9px 6px", verticalAlign: "top" }}>
                <div style={{ fontWeight: 600 }}>{it.title}</div>
                {it.description && <div style={{ color: "#64748b", fontSize: 9, marginTop: 2 }}>{it.description}</div>}
              </td>
              <td style={{ padding: "9px 6px", textAlign: "center", verticalAlign: "top", fontWeight: 600 }}>{Number(it.quantity) || 0}</td>
              <td style={{ padding: "9px 6px", textAlign: "center", verticalAlign: "top", color: "#64748b" }}>{x.unitVal}</td>
              <td style={{ padding: "9px 6px", verticalAlign: "top" }} />
            </tr>
          ))}
          {/* filler rows for a clean form look (up to 8 total) */}
          {Array.from({ length: Math.max(0, 6 - items.length) }).map((_, i) => (
            <tr key={`f${i}`} style={{ borderBottom: "1px solid #eef2f6", background: (items.length + i) % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
              <td style={{ padding: "9px 6px", color: "#cbd5e1" }}>{items.length + i + 1}</td>
              <td /><td /><td /><td /><td />
            </tr>
          ))}
        </tbody>
      </table>

      {/* Notes */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: "#64748b", marginBottom: 6 }}>{x.notes}</div>
        <div style={{ borderBottom: "1px solid #cbd5e1", height: 16 }} />
        <div style={{ borderBottom: "1px solid #cbd5e1", height: 16, marginTop: 8 }} />
      </div>

      {/* Signatures */}
      <div style={{ marginTop: "auto", paddingTop: 26 }}>
        <div style={{ fontSize: 9.5, color: "#334155", marginBottom: 14 }}>{x.received}</div>
        <div style={{ display: "flex", gap: 28 }}>
          <div style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: GREEN, marginBottom: 16 }}>{x.handover}</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 18 }}>
              <span style={labelSm}>{x.placeDate}</span><div style={line} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <span style={labelSm}>{x.handoverSig}</span><div style={line} />
            </div>
          </div>
          <div style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: GREEN, marginBottom: 16 }}>{x.confirm}</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 18 }}>
              <span style={labelSm}>{x.nameBlock}</span><div style={line} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <span style={labelSm}>{x.signature}</span><div style={line} />
              <span style={{ ...labelSm, marginLeft: 10 }}>{x.stamp}</span><div style={{ ...line, maxWidth: 70 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Footer company line */}
      <div style={{ marginTop: 18, borderTop: `2px solid ${GREEN}`, paddingTop: 8, fontSize: 8, color: "#94a3b8", textAlign: "center", lineHeight: 1.6 }}>
        <div>{company?.company_name} · {company?.address}{company?.phone ? ` · ${x.tel} ${company.phone}` : ""}{company?.email ? ` · ${company.email}` : ""}</div>
        <div>
          {company?.tax_number ? `${x.taxNo} ${company.tax_number}` : ""}
          {company?.hrb_number ? `  ·  ${x.hrbNo} ${company.hrb_number}` : ""}
          {company?.website ? `  ·  ${company.website}` : ""}
        </div>
      </div>
    </div>
  );
}
