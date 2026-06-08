import React from "react";
import { useT } from "../i18n/LanguageContext";

// Colors keyed by status code. Labels are resolved via translations (status.<code>).
const MAP = {
  taslak:       { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
  gonderildi:   { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  kabul:        { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" },
  red:          { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
  suresi_doldu: { bg: "#fffbeb", text: "#b45309", border: "#fde68a" },
};

export const STATUS_KEYS = Object.keys(MAP);

export default function StatusBadge({ status }) {
  const { t } = useT();
  const s = MAP[status] || MAP.taslak;
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
      style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border }}
      data-testid={`status-badge-${status}`}
    >
      {t(`status.${status}`)}
    </span>
  );
}

export { MAP as STATUS_MAP };
