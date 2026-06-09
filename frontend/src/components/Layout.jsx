import React, { useState } from "react";
import Sidebar from "./Sidebar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "./ui/sheet";
import { Menu } from "lucide-react";
import { Toaster } from "sonner";
import { useT } from "../i18n/LanguageContext";

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const { t } = useT();

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar with hamburger */}
        <div className="lg:hidden sticky top-0 z-30 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                aria-label={t("nav.openMenu")}
                data-testid="mobile-menu-btn"
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-700"
              >
                <Menu size={22} />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 max-w-[85vw]">
              <SheetTitle className="sr-only">{t("nav.openMenu")}</SheetTitle>
              <SheetDescription className="sr-only">{t("brand.name")}</SheetDescription>
              <Sidebar onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <img src="https://customer-assets.emergentagent.com/job_7f4dcb13-bb80-4983-8764-b667de5bb352/artifacts/k8zjh8tf_gastromek-logo.png" alt="Gastromek" className="h-7 w-auto object-contain" />
          </div>

          <div className="w-9" />
        </div>

        <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
          {children}
        </div>
      </main>

      <Toaster position="top-right" richColors />
    </div>
  );
}
