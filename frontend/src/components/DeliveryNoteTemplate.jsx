import React from "react";
import { formatDate, API_URL, fullAddress } from "../lib/api";

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
    quoteNo: "Angebotsnr.:", customerNo: "Kundennr.:",
    pos: "Pos.", artNo: "Art.-Nr.", desc: "Artikelbezeichnung", qty: "Menge", unit: "Einheit", remark: "Bemerkung",
    unitVal: "Stk.",
    notes: "HINWEISE / BESONDERHEITEN",
    received: "Ware vollständig und in einwandfreiem Zustand erhalten.",
    placeDate: "Ort, Datum", name: "Name", nameBlock: "Name", signature: "Unterschrift", stamp: "Stempel",
    confirm: "EMPFANGSBESTÄTIGUNG", handover: "ÜBERGABE / LIEFERUNG",
    taxNo: "St-Nr.:", hrbNo: "HRB-Nr.:", tel: "Tel:", email: "E-Mail:",
  },
  tr: {
    heading: "İRSALİYE",
    noLabel: "İrsaliye No:", dateLabel: "Sevk Tarihi:",
    shipTo: "TESLİMAT ADRESİ", orderData: "SİPARİŞ BİLGİLERİ",
    quoteNo: "Teklif No:", customerNo: "Müşteri No:",
    pos: "Sıra", artNo: "Ürün Kodu", desc: "Ürün Açıklaması", qty: "Miktar", unit: "Birim", remark: "Açıklama",
    unitVal: "Ad.",
    notes: "NOTLAR / ÖZEL DURUMLAR",
    received: "Ürünler eksiksiz ve sağlam şekilde teslim alınmıştır.",
    placeDate: "Yer, Tarih", name: "Ad Soyad", nameBlock: "Ad Soyad", signature: "İmza", stamp: "Kaşe",
    confirm: "TESLİM ALAN ONAYI", handover: "TESLİM EDEN",
    taxNo: "VN:", hrbNo: "HRB No:", tel: "Tel:", email: "E-posta:",
  },
};

const GREEN = "#70c800";

export default function DeliveryNoteTemplate({
  deliveryNo, items = [], customer, company, lang = "de",
  quoteNo, note = "", rootId = "delivery-note-root",
}) {
  const x = L[lang] || L.de;
  const labelSm = { fontSize: 9, color: "#64748b", whiteSpace: "nowrap", fontWeight: 600 };
  const sigTitle = { fontSize: 9, fontWeight: 800, letterSpacing: 1, color: GREEN, marginBottom: 10 };
  // compact field: small label, then a little blank space to write (no line)
  const SigField = ({ label, mt = 14 }) => (
    <div style={{ marginTop: mt }}>
      <div style={{ fontSize: 9, color: "#64748b", fontWeight: 600 }}>{label}</div>
      <div style={{ height: 18 }} />
    </div>
  );

  return (
    <div
      id={rootId}
      style={{
        padding: "12mm 15mm 12mm",
        width: "210mm",
        background: "#ffffff",
        color: "#0f172a",
        boxSizing: "border-box",
        fontFamily: "Manrope, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ maxWidth: "58%" }}>
          {company?.logo_url ? (
            <SafeImg src={company.logo_url} alt="logo" style={{ maxHeight: 68, maxWidth: 260, objectFit: "contain" }} />
          ) : (
            <div style={{ fontSize: 24, fontFamily: "Outfit, sans-serif", fontWeight: 800, color: GREEN }}>{company?.company_name}</div>
          )}
          <div style={{ fontSize: 9, color: "#475569", marginTop: 8, lineHeight: 1.6 }}>
            {company?.logo_url && <div style={{ fontWeight: 700, color: "#334155", fontSize: 10 }}>{company?.company_name}</div>}
            {company?.tagline && <div>{company.tagline}</div>}
            {company?.address && <div>{company.address}</div>}
            {(company?.phone || company?.email) && (
              <div>{company?.phone ? `${x.tel} ${company.phone}` : ""}{company?.email ? `  ·  ${company.email}` : ""}</div>
            )}
            {(company?.tax_number || company?.hrb_number) && (
              <div style={{ marginTop: 2, fontWeight: 600, color: "#334155" }}>
                {company?.tax_number ? `${x.taxNo} ${company.tax_number}` : ""}
                {company?.tax_number && company?.hrb_number ? "  ·  " : ""}
                {company?.hrb_number ? `${x.hrbNo} ${company.hrb_number}` : ""}
              </div>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 28, fontWeight: 800, color: GREEN, letterSpacing: 3 }}>{x.heading}</div>
          <table style={{ marginTop: 12, marginLeft: "auto", fontSize: 10, color: "#334155", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ padding: "3px 8px 3px 0", textAlign: "right", fontWeight: 700 }}>{x.noLabel}</td>
                <td style={{ minWidth: 130, textAlign: "left", paddingLeft: 6, fontWeight: 600 }}>{deliveryNo || ""}</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 8px 3px 0", textAlign: "right", fontWeight: 700 }}>{x.dateLabel}</td>
                <td style={{ minWidth: 130, textAlign: "left", paddingLeft: 6 }}>{formatDate(new Date().toISOString())}</td>
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
            {fullAddress(customer) && <div>{fullAddress(customer)}</div>}
            {customer?.phone && <div>{x.tel} {customer.phone}</div>}
          </div>
        </div>
        <div style={{ flex: 1, background: "#f8fafc", borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: "#64748b", marginBottom: 8 }}>{x.orderData}</div>
          <table style={{ fontSize: 10, color: "#334155", borderCollapse: "collapse", width: "100%" }}>
            <tbody>
              <tr>
                <td style={{ ...labelSm, padding: "5px 10px 5px 0", verticalAlign: "top" }}>{x.quoteNo}</td>
                <td style={{ padding: "5px 0", fontWeight: 600 }}>{quoteNo || "-"}</td>
              </tr>
              <tr>
                <td style={{ ...labelSm, padding: "5px 10px 5px 0", verticalAlign: "top" }}>{x.customerNo}</td>
                <td style={{ padding: "5px 0", fontWeight: 600 }}>{customer?.customer_no || customer?.tax_number || "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Items table — only actual items, no filler rows */}
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
        </tbody>
      </table>

      {/* Notes — from the delivery-note creation dialog */}
      {note && note.trim() && (
        <div className="pdf-section" style={{ marginTop: 18, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: "#64748b", marginBottom: 6 }}>{x.notes}</div>
          <div style={{ fontSize: 10, color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{note}</div>
        </div>
      )}

      {/* Signatures — clean "sign above the line" style */}
      <div className="pdf-section" style={{ marginTop: 28 }}>
        <div style={{ fontSize: 9.5, color: "#334155", marginBottom: 16 }}>{x.received}</div>
        <div style={{ display: "flex", gap: 28 }}>
          <div style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px" }}>
            <div style={sigTitle}>{x.handover}</div>
            <SigField label={x.name} mt={4} />
            <SigField label={x.placeDate} />
            <SigField label={x.signature} />
          </div>
          <div style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px" }}>
            <div style={sigTitle}>{x.confirm}</div>
            <SigField label={x.nameBlock} mt={4} />
            <SigField label={x.placeDate} />
            <div style={{ display: "flex", gap: 20 }}>
              <div style={{ flex: 1 }}><SigField label={x.signature} /></div>
              <div style={{ flex: 1 }}><SigField label={x.stamp} /></div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer company line */}
      <div className="pdf-section" style={{ marginTop: 18, borderTop: `2px solid ${GREEN}`, paddingTop: 8, fontSize: 8, color: "#94a3b8", textAlign: "center", lineHeight: 1.6 }}>
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
