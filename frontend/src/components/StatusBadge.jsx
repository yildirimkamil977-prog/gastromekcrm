import React from "react";
import { useT } from "../i18n/LanguageContext";

// Colors keyed by status code. Labels are resolved via translations (status.<code>).
// "kabul" (accepted) is tinted brand green to align with the Gastromek brand.
const MAP = {
  taslak:       { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1", bar: "#94a3b8" },
  gonderildi:   { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", bar: "#60a5fa" },
  kabul:        { bg: "#eef8df", text: "#4e8a00", border: "#70c800", bar: "#70c800" },
  red:          { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca", bar: "#f87171" },
  suresi_doldu: { bg: "#fffbeb", text: "#b45309", border: "#fde68a", bar: "#fbbf24" },
};

export const STATUS_KEYS = Object.keys(MAP);

export default function StatusBadge({ status }) {
  const { t } = useT();
  const s = MAP[status] || MAP.taslak;
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold border uppercase tracking-wider"
      style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border }}
      data-testid={`status-badge-${status}`}
    >
      {t(`status.${status}`)}
    </span>
  );
}

export { MAP as STATUS_MAP };
