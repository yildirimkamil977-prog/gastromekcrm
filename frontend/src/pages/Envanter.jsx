import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api, formatApiError, formatMoney } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "../components/ui/dialog";
import Pagination from "../components/Pagination";
import {
  Search, Trash2, Pencil, Plus, Loader2, Warehouse, X, ImageOff, Upload, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 50;

const L = {
  tr: {
    title: "Envanter Yönetimi", subtitle: "Depo stok ve fiyat takibi", productsWord: "ürün",
    addProduct: "Ürün Ekle", search: "İsim veya ürün kodu ara…",
    product: "Ürün", code: "Ürün Kodu", buyPrice: "Alış Fiyatı", sellPrice: "Satış Fiyatı", stock: "Stok", currency: "Para Birimi", actions: "İşlem",
    stockAll: "Tüm Stoklar", stockIn: "Stokta", stockLow: "Az Stok", stockOut: "Tükendi",
    selected: "seçili", delete: "Sil",
    edit: "Düzenle", save: "Kaydet", cancel: "İptal",
    editTitle: "Ürünü Düzenle", newTitle: "Yeni Ürün",
    name: "İsim", image: "Görsel URL", upload: "Yükle", uploading: "Yükleniyor…", imageUploaded: "Görsel yüklendi",
    none: "Ürün bulunamadı", empty: "Envanter boş. \"Ürün Ekle\" ile başlayın veya Katalog'dan ürün taşıyın.",
    loading: "Yükleniyor…", confirmDelete: "Seçili ürünler silinsin mi?", confirmDeleteOne: "Bu ürün silinsin mi?",
    nameRequired: "İsim zorunludur", empty_: "—", low: "Az stok", out: "Tükendi",
  },
  de: {
    title: "Bestandsverwaltung", subtitle: "Lagerbestand & Preisverfolgung", productsWord: "Produkte",
    addProduct: "Produkt hinzufügen", search: "Name oder Artikelnr. suchen…",
    product: "Produkt", code: "Artikelnr.", buyPrice: "Einkaufspreis", sellPrice: "Verkaufspreis", stock: "Bestand", currency: "Währung", actions: "Aktion",
    stockAll: "Alle Bestände", stockIn: "Auf Lager", stockLow: "Wenig", stockOut: "Ausverkauft",
    selected: "ausgewählt", delete: "Löschen",
    edit: "Bearbeiten", save: "Speichern", cancel: "Abbrechen",
    editTitle: "Produkt bearbeiten", newTitle: "Neues Produkt",
    name: "Name", image: "Bild-URL", upload: "Hochladen", uploading: "Lädt hoch…", imageUploaded: "Bild hochgeladen",
    none: "Keine Produkte gefunden", empty: "Bestand ist leer. Mit \"Produkt hinzufügen\" beginnen oder aus dem Katalog übertragen.",
    loading: "Laden…", confirmDelete: "Ausgewählte Produkte löschen?", confirmDeleteOne: "Dieses Produkt löschen?",
    nameRequired: "Name ist erforderlich", empty_: "—", low: "Wenig", out: "Ausverkauft",
  },
};

const emptyProduct = { name: "", code: "", image: "", purchase_price: "", sale_price: "", stock: "", currency: "TRY" };
const LOW_STOCK = 5;

export default function Envanter() {
  const { lang } = useT();
  const tx = L[lang] || L.tr;

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [stockStatus, setStockStatus] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // product being edited/created
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = React.useRef(null);

  useEffect(() => { const id = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 350); return () => clearTimeout(id); }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/inventory", { params: { search: debounced, stock_status: stockStatus, page, page_size: PAGE_SIZE } });
      setItems(r.data.items || []); setTotal(r.data.total || 0);
    } catch (e) { toast.error(formatApiError(e)); } finally { setLoading(false); }
  }, [debounced, stockStatus, page]);

  useEffect(() => { load(); }, [load]);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const allOnPageSelected = items.length > 0 && items.every((p) => selected.has(p.id));
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllOnPage = () => setSelected((s) => {
    const n = new Set(s);
    if (allOnPageSelected) items.forEach((p) => n.delete(p.id));
    else items.forEach((p) => n.add(p.id));
    return n;
  });
  const clearSel = () => setSelected(new Set());

  const openNew = () => { setEditing({ ...emptyProduct }); setIsNew(true); };
  const openEdit = (p) => {
    setEditing({
      ...p,
      code: p.code ?? "",
      purchase_price: p.purchase_price ?? "",
      sale_price: p.sale_price ?? "",
      stock: p.stock ?? "",
      currency: p.currency || "TRY",
    });
    setIsNew(false);
  };

  const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

  const saveEdit = async () => {
    if (!editing.name?.trim()) { toast.error(tx.nameRequired); return; }
    setSaving(true);
    const payload = {
      name: editing.name.trim(),
      code: (editing.code || "").trim(),
      image: editing.image || "",
      purchase_price: num(editing.purchase_price),
      sale_price: num(editing.sale_price),
      stock: num(editing.stock),
      currency: editing.currency || "TRY",
    };
    try {
      if (isNew) await api.post("/inventory", payload);
      else await api.put(`/inventory/${editing.id}`, payload);
      setEditing(null); await load();
    } catch (e) { toast.error(formatApiError(e)); } finally { setSaving(false); }
  };

  const uploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
      let url = r.data.url || "";
      if (url.startsWith("/")) url = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "") + url;
      setEditing((prev) => ({ ...prev, image: url }));
      toast.success(tx.imageUploaded);
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const bulkDelete = async () => {
    if (!selectedIds.length || !window.confirm(tx.confirmDelete)) return;
    try { await api.post("/inventory/bulk-delete", { ids: selectedIds }); clearSel(); await load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  const deleteOne = async (id) => {
    if (!window.confirm(tx.confirmDeleteOne)) return;
    try { await api.delete(`/inventory/${id}`); await load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const money = (v, cur) => (v === null || v === undefined || v === "" ? tx.empty_ : formatMoney(Number(v), cur || "TRY"));

  return (
    <div className="space-y-5" data-testid="inventory-page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-zinc-900 flex items-center gap-2"><Warehouse size={22} className="text-brand" /> {tx.title}</h1>
          <p className="text-sm text-zinc-500">{tx.subtitle} · {total} {tx.productsWord}</p>
        </div>
        <Button onClick={openNew} className="bg-brand hover:bg-brand-hover text-white" data-testid="inventory-add-btn">
          <Plus size={15} className="mr-2" />{tx.addProduct}
        </Button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tx.search} className="pl-9" data-testid="inventory-search" />
        </div>
        <Select value={stockStatus} onValueChange={(v) => { setStockStatus(v); setPage(1); }}>
          <SelectTrigger className="w-44" data-testid="inventory-stock-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tx.stockAll}</SelectItem>
            <SelectItem value="in">{tx.stockIn}</SelectItem>
            <SelectItem value="low">{tx.stockLow}</SelectItem>
            <SelectItem value="out">{tx.stockOut}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-900 text-white px-4 py-2.5 sticky top-2 z-20" data-testid="inventory-bulk-bar">
          <span className="text-sm font-medium mr-1">{selectedIds.length} {tx.selected}</span>
          <Button size="sm" variant="destructive" onClick={bulkDelete} data-testid="inventory-bulk-delete-btn"><Trash2 size={14} className="mr-1.5" />{tx.delete}</Button>
          <Button size="sm" variant="ghost" onClick={clearSel} className="text-white hover:bg-white/10 ml-auto"><X size={14} /></Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-zinc-200 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-3 w-10"><Checkbox checked={allOnPageSelected} onCheckedChange={toggleAllOnPage} data-testid="inventory-select-all" /></th>
                <th className="px-2 py-3 w-14"></th>
                <th className="px-3 py-3 text-left font-semibold">{tx.product}</th>
                <th className="px-3 py-3 text-right font-semibold w-32">{tx.buyPrice}</th>
                <th className="px-3 py-3 text-right font-semibold w-32">{tx.sellPrice}</th>
                <th className="px-3 py-3 text-right font-semibold w-24">{tx.stock}</th>
                <th className="px-3 py-3 text-right font-semibold w-24">{tx.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-zinc-400">{tx.loading}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-zinc-400">{total === 0 ? tx.empty : tx.none}</td></tr>
              ) : items.map((p) => (
                <tr key={p.id} className={`hover:bg-zinc-50 ${selected.has(p.id) ? "bg-brand-light/30" : ""}`} data-testid={`inventory-row-${p.id}`}>
                  <td className="px-3 py-2"><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} data-testid={`inventory-check-${p.id}`} /></td>
                  <td className="px-2 py-2">
                    {p.image ? <img src={p.image} alt="" className="w-10 h-10 object-cover rounded border border-zinc-200" loading="lazy" />
                      : <div className="w-10 h-10 rounded border border-zinc-200 bg-zinc-50 flex items-center justify-center text-zinc-300"><ImageOff size={14} /></div>}
                  </td>
                  <td className="px-3 py-2"><div className="font-medium text-zinc-900 line-clamp-2">{p.name}</div>{p.code && <div className="text-[11px] text-zinc-400 mt-0.5 font-mono">{p.code}</div>}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-700">{money(p.purchase_price, p.currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-700">{money(p.sale_price, p.currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {p.stock === null || p.stock === undefined ? <span className="text-zinc-400">{tx.empty_}</span> : (
                      Number(p.stock) <= 0 ? (
                        <span className="inline-flex items-center gap-1 text-red-600 font-medium" title={tx.out}><AlertTriangle size={12} />{Number(p.stock)}</span>
                      ) : Number(p.stock) <= LOW_STOCK ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium" title={tx.low}><AlertTriangle size={11} />{Number(p.stock)}</span>
                      ) : (
                        <span className="text-zinc-700">{Number(p.stock)}</span>
                      )
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(p)} data-testid={`inventory-edit-${p.id}`}><Pencil size={14} /></Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:bg-red-50" onClick={() => deleteOne(p.id)} data-testid={`inventory-delete-${p.id}`}><Trash2 size={14} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      {/* Edit / New dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg" data-testid="inventory-edit-dialog">
          <DialogHeader><DialogTitle>{isNew ? tx.newTitle : tx.editTitle}</DialogTitle></DialogHeader>
          <DialogDescription className="sr-only">{tx.title}</DialogDescription>
          {editing && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                {editing.image
                  ? <img src={editing.image} alt="" className="w-20 h-20 object-cover rounded border" />
                  : <div className="w-20 h-20 rounded border bg-zinc-50 flex items-center justify-center text-zinc-300"><ImageOff size={18} /></div>}
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">{tx.image}</Label>
                  <Input value={editing.image || ""} onChange={(e) => setEditing({ ...editing, image: e.target.value })} data-testid="inventory-image-url" />
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadImage} data-testid="inventory-image-file" />
                  <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={uploading} onClick={() => fileRef.current?.click()} data-testid="inventory-image-upload-btn">
                    {uploading ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : <Upload size={12} className="mr-1.5" />}
                    {uploading ? tx.uploading : tx.upload}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{tx.name}</Label>
                  <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} data-testid="inventory-name" />
                </div>
                <div>
                  <Label className="text-xs">{tx.code}</Label>
                  <Input value={editing.code || ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} data-testid="inventory-code" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">{tx.buyPrice}</Label><Input type="number" step="0.01" value={editing.purchase_price ?? ""} onChange={(e) => setEditing({ ...editing, purchase_price: e.target.value })} data-testid="inventory-buy-price" /></div>
                <div><Label className="text-xs">{tx.sellPrice}</Label><Input type="number" step="0.01" value={editing.sale_price ?? ""} onChange={(e) => setEditing({ ...editing, sale_price: e.target.value })} data-testid="inventory-sell-price" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">{tx.stock}</Label><Input type="number" step="1" value={editing.stock ?? ""} onChange={(e) => setEditing({ ...editing, stock: e.target.value })} data-testid="inventory-stock" /></div>
                <div>
                  <Label className="text-xs">{tx.currency}</Label>
                  <Select value={editing.currency || "TRY"} onValueChange={(v) => setEditing({ ...editing, currency: v })}>
                    <SelectTrigger data-testid="inventory-currency"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRY">₺ TRY</SelectItem>
                      <SelectItem value="EUR">€ EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{tx.cancel}</Button>
            <Button onClick={saveEdit} disabled={saving} className="bg-brand hover:bg-brand-hover text-white" data-testid="inventory-save-btn">
              {saving && <Loader2 size={14} className="mr-2 animate-spin" />}{tx.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
