import React from "react";
import { Globe, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useT, LANGS } from "../i18n/LanguageContext";

const FLAG = { de: "🇩🇪", tr: "🇹🇷" };

export default function LanguageSwitcher({ variant = "sidebar" }) {
  const { lang, setLang, t } = useT();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="language-switcher-btn"
          className={
            variant === "login"
              ? "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200 bg-white/80 backdrop-blur"
              : "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors font-medium"
          }
        >
          <Globe size={16} />
          <span>{t(`lang.${lang}`)}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {LANGS.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => setLang(l)}
            data-testid={`language-option-${l}`}
            className="flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span>{FLAG[l]}</span>
              {t(`lang.${l}`)}
            </span>
            {lang === l && <Check size={14} className="text-brand" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
