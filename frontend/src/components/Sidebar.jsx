import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users2, FileText, Package, Settings as SettingsIcon,
  UserCog, LogOut, Calculator,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";

const LOGO = "https://customer-assets.emergentagent.com/job_7f4dcb13-bb80-4983-8764-b667de5bb352/artifacts/k8zjh8tf_gastromek-logo.png";

const mainLinks = [
  { to: "/", key: "dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/musteriler", key: "customers", icon: Users2, testid: "nav-customers" },
  { to: "/teklifler", key: "quotes", icon: FileText, testid: "nav-quotes" },
  { to: "/urunler", key: "products", icon: Package, testid: "nav-products" },
];

const adminLinks = [
  { to: "/kullanicilar", key: "users", icon: UserCog, testid: "nav-users" },
  { to: "/ayarlar", key: "settings", icon: SettingsIcon, testid: "nav-settings" },
];

export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
  }, []);

  const canSeeAccounting = isAdmin || (settings?.accounting_visible_roles || []).includes(user?.role);
  const links = canSeeAccounting
    ? [...mainLinks, { to: "/muhasebe", key: "accounting", icon: Calculator, testid: "nav-accounting" }]
    : mainLinks;
  const roleLabel = user?.role === "admin"
    ? t("nav.roleAdmin")
    : user?.role === "muhasebe"
      ? t("nav.roleAccounting")
      : t("nav.roleSales");

  const handleLogout = async () => {
    await logout();
    if (onNavigate) onNavigate();
    navigate("/login", { replace: true });
  };

  const handleLinkClick = () => {
    if (onNavigate) onNavigate();
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full lg:h-screen lg:sticky lg:top-0" data-testid="sidebar">
      <div className="h-16 px-5 flex items-center border-b border-slate-200">
        <div className="flex items-center gap-2">
          <img src={LOGO} alt="Gastromek" className="h-9 w-auto object-contain" />
          <div className="border-l border-slate-200 pl-2">
            <div className="font-heading font-semibold text-slate-900 leading-none text-base">CRM</div>
            <div className="text-[10px] text-slate-500 mt-1 tracking-wider uppercase">{t("brand.tagline")}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-400">{t("nav.sectionMain")}</div>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            onClick={handleLinkClick}
            data-testid={l.testid}
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <l.icon size={18} />
            <span>{t(`nav.${l.key}`)}</span>
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="px-3 pt-5 pb-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-400">{t("nav.sectionAdmin")}</div>
            {adminLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={handleLinkClick}
                data-testid={l.testid}
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              >
                <l.icon size={18} />
                <span>{t(`nav.${l.key}`)}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-slate-200 p-3 space-y-1">
        <LanguageSwitcher />
        <div className="flex items-center gap-3 px-3 py-2" data-testid="current-user">
          <div className="w-9 h-9 rounded-full bg-brand-light text-brand font-heading font-semibold flex items-center justify-center shrink-0">
            {(user?.name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">{user?.name}</div>
            <div className="text-xs text-slate-500">
              {roleLabel}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          data-testid="logout-btn"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors font-medium"
        >
          <LogOut size={16} />
          {t("nav.logout")}
        </button>
      </div>
    </aside>
  );
}

export { LOGO };
