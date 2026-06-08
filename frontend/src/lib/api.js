import axios from "axios";
import { localizeError } from "../i18n/errors";

const BASE = process.env.REACT_APP_BACKEND_URL;

export const api = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: true,
});

export const API_URL = `${BASE}/api`;

// Active locale for number/date formatting, updated by the language context.
let currentLocale = "de-DE";
export function setLocale(locale) {
  currentLocale = locale || "de-DE";
}
function activeLang() {
  return currentLocale && currentLocale.startsWith("tr") ? "tr" : "de";
}

export function formatApiError(err) {
  const lang = activeLang();
  const d = err?.response?.data?.detail;
  if (!d) {
    if (err?.message === "Network Error") return localizeError("__network__", lang);
    return localizeError(err?.message || "Bir hata oluştu", lang);
  }
  if (typeof d === "string") return localizeError(d, lang);
  if (Array.isArray(d)) {
    return d
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .join(" ");
  }
  if (typeof d?.msg === "string") return d.msg;
  return String(d);
}

export function formatMoney(value, currency = "TRY") {
  const symbols = { TRY: "₺", USD: "$", EUR: "€" };
  const n = Number(value || 0);
  return `${symbols[currency] || ""}${n.toLocaleString(currentLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(currentLocale, {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch {
    return iso;
  }
}
