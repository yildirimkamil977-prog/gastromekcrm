import React, { useEffect, useState } from "react";
import { api, formatApiError, formatDate, formatMoney } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { RefreshCw, Search, Image as ImageIcon } from "lucide-react";
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
    const t = setTimeout(load, 350);
    return () => clearTimeout(t);
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

  return (
    <div>
      <PageHeader
        title={t("products.title")}
        subtitle={meta ? `${meta.count} ${t("products.unit")} · ${t("products.lastUpdate")}: ${meta.last_sync ? formatDate(meta.last_sync.at) : "-"}` : t("products.subtitleFeed")}
      >
        <Button onClick={sync} disabled={syncing} className="bg-brand hover:bg-brand-hover" data-testid="sync-products-btn">
          <RefreshCw size={16} className={`mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? t("products.updating") : t("products.updateFeed")}
        </Button>
      </PageHeader>

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder={t("products.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="product-search-input"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-slate-400">{t("common.loading")}</div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-slate-400 bg-white border border-slate-200 rounded-xl">{t("products.notFound")}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {rows.map((p) => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow" data-testid={`product-card-${p.id}`}>
              <div className="aspect-square bg-slate-50 flex items-center justify-center">
                {p.image ? (
                  <img src={p.image} alt={p.title} className="w-full h-full object-contain" loading="lazy" />
                ) : (
                  <ImageIcon size={40} className="text-slate-300" />
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                {p.code && <div className="text-[10px] font-mono uppercase text-slate-500 mb-1">#{p.code}</div>}
                <div className="text-sm font-medium text-slate-900 line-clamp-2 flex-1">{p.title}</div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="font-heading font-semibold text-brand">
                    {formatMoney(p.price, p.currency)}
                  </div>
                  {p.brand && <div className="text-xs text-slate-500">{p.brand}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
