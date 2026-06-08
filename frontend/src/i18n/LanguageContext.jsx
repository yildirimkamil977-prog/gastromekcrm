import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { translations } from "./translations";
import { setLocale } from "../lib/api";

const LanguageContext = createContext(null);
const STORAGE_KEY = "gastromek_lang";
export const DEFAULT_LANG = "de";
export const LANGS = ["de", "tr"];

function getNested(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(stored) ? stored : DEFAULT_LANG;
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    setLocale(lang === "de" ? "de-DE" : "tr-TR");
    document.title = "Gastromek CRM";
  }, [lang]);

  const setLang = useCallback((l) => {
    if (!LANGS.includes(l)) return;
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  }, []);

  const t = useCallback(
    (key, vars) => {
      let str = getNested(translations[lang], key);
      if (str == null) str = getNested(translations[DEFAULT_LANG], key);
      if (str == null) return key;
      if (vars && typeof str === "string") {
        Object.entries(vars).forEach(([k, v]) => {
          str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
        });
      }
      return str;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useT() {
  return useContext(LanguageContext);
}
