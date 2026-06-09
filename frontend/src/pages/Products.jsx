import React, { useEffect, useState } from "react";
import { api, formatApiError, formatDate, formatMoney } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import { PageBand, FullBleed } from "../components/Blueprint";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { RefreshCw, Search, Image as ImageIcon, PackageSearch } from "lucide-react";
import { toast } from "sonner";

export default function Products() {
  const { t } = useT();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [meta, setMeta] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, m] = await Promise.all([
        api.get("/products", { params: { search, limit: 120 } }),
        api.get("/products/count"),
      ]);
      setRows(r.data);
      setMeta(m.data);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    const timer = setTimeout(load, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line
  }, [search]);

  const sync = async () => {
    setSyncing(true);
    try {
      const r = await api.post("/products/sync");
      if (r.data.success) toast.success(t("products.syncSuccess", { count: r.data.count }));
      else toast.error(r.data.error || t("products.syncFailed"));
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSyncing(false);
    }
  };

  const subtitle = (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {meta ? (
        <>
          <b className="text-zinc-700">{meta.count}</b> {t("products.unit")}
          <span className="text-zinc-300">·</span>
          {t("products.lastUpdate")}: {meta.last_sync ? formatDate(meta.last_sync.at) : "-"}
        </>
      ) : t("products.subtitleFeed")}
    </span>
  );

  return (
    <FullBleed testid="products">
      <PageBand eyebrow={t("nav.sectionMain")} title={t("products.title")} subtitle={subtitle}>
        <Button onClick={sync} disabled={syncing} className="bg-brand hover:bg-brand-hover text-white h-11 px-5" data-testid="sync-products-btn">
          <RefreshCw size={16} strokeWidth={1.5} className={`mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? t("products.updating") : t("products.updateFeed")}
        </Button>
      </PageBand>

      {/* Search */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 border-b border-zinc-200 bg-white">
        <div className="relative max-w-md">
          <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input className="pl-9 h-10 border-zinc-200" placeholder={t("products.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} data-testid="product-search-input" />
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="py-16 text-center text-zinc-400 text-sm">{t("common.loading")}</div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center">
            <PackageSearch size={40} strokeWidth={1.25} className="mx-auto text-zinc-300 mb-3" />
            <div className="text-sm text-zinc-400">{t("products.notFound")}</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-px bg-zinc-200 border border-zinc-200">
            {rows.map((p) => (
              <div key={p.id} className="bg-white flex flex-col group hover:bg-zinc-50 transition-colors" data-testid={`product-card-${p.id}`}>
                <div className="aspect-square bg-white flex items-center justify-center p-3 border-b border-zinc-100">
                  {p.image ? (
                    <img src={p.image} alt={p.title} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                  ) : (
                    <ImageIcon size={36} strokeWidth={1.25} className="text-zinc-200" />
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  {p.code && <div className="text-[10px] font-mono uppercase text-zinc-400 mb-1">#{p.code}</div>}
                  <div className="text-sm font-medium text-zinc-900 line-clamp-2 flex-1">{p.title}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="font-heading font-bold text-brand tabular-nums">{formatMoney(p.price, p.currency)}</div>
                    {p.brand && <div className="text-[11px] text-zinc-400 uppercase tracking-wide">{p.brand}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </FullBleed>
  );
}
