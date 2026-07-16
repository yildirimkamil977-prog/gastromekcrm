import React, { useEffect, useMemo, useState, useCallback } from "react";
import { api, formatApiError, formatMoney } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../components/ui/command";
import { cn } from "../lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import Pagination from "../components/Pagination";
import {
  Search, Trash2, Pencil, Languages, FileCode2, FileSpreadsheet, DownloadCloud,
  Loader2, Boxes, Copy, Check, X, ImageOff, ChevronsUpDown, Warehouse,
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 50;
const MAX_TRANSLATE = 20;
const CHUNK = 5;

const L = {
  tr: {
    title: "Katalog", subtitle: "Almanca ürün kataloğu ve XML/CSV dışa aktarım",
    import: "Feed'den İçe Aktar", importing: "İçe aktarılıyor…",
    search: "İsim, kod, marka ara…", allBrands: "Tüm Markalar", allCats: "Tüm Kategoriler",
    searchCat: "Kategori ara…",
    product: "Ürün", price: "Fiyat", brand: "Marka", category: "Kategori", actions: "İşlem",
    currency: "Para Birimi", setCurrency: "Para Birimi",
    currencyDone: "Para birimi güncellendi",
    selected: "seçili", delete: "Sil", translate: "Almancaya Çevir",
    addXml: "XML'e Ekle", removeXml: "XML'den Çıkar", csv: "CSV İndir",
    toInventory: "Envantere Taşı", inInventory: "Depo",
    edit: "Düzenle", save: "Kaydet", cancel: "İptal",
    editTitle: "Ürünü Düzenle", nameTr: "İsim (TR)", nameDe: "İsim (DE)",
    descTr: "Açıklama (TR)", descDe: "Açıklama (DE)", catTr: "Kategori (TR)", catDe: "Kategori (DE)",
    image: "Görsel URL", code: "Kod", none: "Ürün bulunamadı",
    translated: "Çevrildi", xmlLink: "XML Feed Linki", inExport: "XML'de", copy: "Kopyala", copied: "Kopyalandı",
    confirmDelete: "Seçili ürünler katalogdan silinsin mi?", confirmDeleteOne: "Bu ürün silinsin mi?",
    max20: "Tek seferde en fazla 20 ürün çevrilebilir. Lütfen daha az seçin.",
    translating: "Çevriliyor", ofN: "/", loading: "Yükleniyor…",
    emptyHint: "Katalog boş. Ürünleri getirmek için \"Feed'den İçe Aktar\" butonuna basın.",
  },
  de: {
    title: "Katalog", subtitle: "Deutscher Produktkatalog & XML/CSV-Export",
    import: "Aus Feed importieren", importing: "Importiere…",
    search: "Name, Code, Marke suchen…", allBrands: "Alle Marken", allCats: "Alle Kategorien",
    searchCat: "Kategorie suchen…",
    product: "Produkt", price: "Preis", brand: "Marke", category: "Kategorie", actions: "Aktion",
    currency: "Währung", setCurrency: "Währung",
    currencyDone: "Währung aktualisiert",
    selected: "ausgewählt", delete: "Löschen", translate: "Ins Deutsche übersetzen",
    addXml: "Zu XML", removeXml: "Aus XML", csv: "CSV",
    toInventory: "In Bestand", inInventory: "Lager",
    edit: "Bearbeiten", save: "Speichern", cancel: "Abbrechen",
    editTitle: "Produkt bearbeiten", nameTr: "Name (TR)", nameDe: "Name (DE)",
    descTr: "Beschreibung (TR)", descDe: "Beschreibung (DE)", catTr: "Kategorie (TR)", catDe: "Kategorie (DE)",
    image: "Bild-URL", code: "Code", none: "Keine Produkte gefunden",
    translated: "Übersetzt", xmlLink: "XML-Feed-Link", inExport: "im XML", copy: "Kopieren", copied: "Kopiert",
    confirmDelete: "Ausgewählte Produkte aus dem Katalog löschen?", confirmDeleteOne: "Dieses Produkt löschen?",
    max20: "Es können maximal 20 Produkte auf einmal übersetzt werden.",
    translating: "Übersetze", ofN: "/", loading: "Laden…",
    emptyHint: "Katalog ist leer. Klicken Sie auf \"Aus Feed importieren\".",
  },
};

function CategoryCombobox({ value, options, onChange, tx }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t ? options.filter((c) => c.toLowerCase().includes(t)) : options;
    return list.slice(0, 200);
  }, [q, options]);
  const label = value || tx.allCats;
  const shortLabel = value ? (value.split(">").pop() || value).trim() : tx.allCats;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-64 justify-between font-normal" data-testid="catalog-category-filter" title={label}>
          <span className="truncate">{shortLabel}</span>
          <ChevronsUpDown size={14} className="ml-2 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={tx.searchCat} value={q} onValueChange={setQ} data-testid="catalog-category-search" />
          <CommandList className="max-h-80">
            <CommandEmpty>{tx.none}</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__all__" onSelect={() => { onChange(""); setOpen(false); }} data-testid="catalog-cat-opt-all">
                <Check size={14} className={cn("mr-2", !value ? "opacity-100 text-brand" : "opacity-0")} />
                {tx.allCats}
              </CommandItem>
              {filtered.map((c) => (
                <CommandItem key={c} value={c} onSelect={() => { onChange(c); setOpen(false); }} className="whitespace-normal leading-snug">
                  <Check size={14} className={cn("mr-2 mt-0.5 shrink-0", value === c ? "opacity-100 text-brand" : "opacity-0")} />
                  <span className="text-xs">{c}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function Katalog() {
  const { lang } = useT();
  const tx = L[lang] || L.tr;

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [facets, setFacets] = useState({ brands: [], categories: [] });
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(null); // {done,total}
  const [exportInfo, setExportInfo] = useState({ count: 0, url: "" });
  const [copied, setCopied] = useState(false);

  useEffect(() => { const id = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 350); return () => clearTimeout(id); }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/catalog/products", { params: { search: debounced, brand, category, page, page_size: PAGE_SIZE } });
      setItems(r.data.items || []); setTotal(r.data.total || 0);
    } catch (e) { toast.error(formatApiError(e)); } finally { setLoading(false); }
  }, [debounced, brand, category, page]);

  const loadMeta = useCallback(async () => {
    try {
      const [f, ex] = await Promise.all([api.get("/catalog/facets"), api.get("/catalog/export/info")]);
      setFacets(f.data);
      const base = process.env.REACT_APP_BACKEND_URL || "";
      setExportInfo({ count: ex.data.count, url: base + ex.data.path });
    } catch { /* noop */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadMeta(); }, [loadMeta]);

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

  const importFeed = async () => {
    setImporting(true);
    try {
      const r = await api.post("/catalog/import");
      toast.success(`+${r.data.added} / ${r.data.total}`);
      await Promise.all([load(), loadMeta()]);
    } catch (e) { toast.error(formatApiError(e)); } finally { setImporting(false); }
  };

  const bulkDelete = async () => {
    if (!selectedIds.length || !window.confirm(tx.confirmDelete)) return;
    try {
      await api.post("/catalog/bulk-delete", { ids: selectedIds });
      clearSel(); await Promise.all([load(), loadMeta()]);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  const deleteOne = async (id) => {
    if (!window.confirm(tx.confirmDeleteOne)) return;
    try { await api.delete(`/catalog/products/${id}`); await Promise.all([load(), loadMeta()]); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const translateSelected = async () => {
    if (!selectedIds.length) return;
    if (selectedIds.length > MAX_TRANSLATE) { toast.error(tx.max20); return; }
    setProgress({ done: 0, total: selectedIds.length });
    try {
      for (let i = 0; i < selectedIds.length; i += CHUNK) {
        const chunk = selectedIds.slice(i, i + CHUNK);
        await api.post("/catalog/translate", { ids: chunk });
        setProgress({ done: Math.min(i + CHUNK, selectedIds.length), total: selectedIds.length });
      }
      toast.success(tx.translated + " ✓");
      await load();
    } catch (e) { toast.error(formatApiError(e)); } finally { setProgress(null); }
  };

  const addToExport = async () => {
    if (!selectedIds.length) return;
    try { await api.post("/catalog/export/add", { ids: selectedIds }); toast.success(tx.addXml + " ✓"); await Promise.all([load(), loadMeta()]); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  const removeFromExport = async () => {
    if (!selectedIds.length) return;
    try { await api.post("/catalog/export/remove", { ids: selectedIds }); await Promise.all([load(), loadMeta()]); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const bulkCurrency = async (currency) => {
    if (!selectedIds.length || !currency) return;
    try {
      await api.post("/catalog/bulk-currency", { ids: selectedIds, currency });
      toast.success(tx.currencyDone + " ✓");
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const moveToInventory = async () => {
    if (!selectedIds.length) return;
    try {
      const r = await api.post("/inventory/from-catalog", { ids: selectedIds });
      toast.success(`${tx.toInventory}: +${r.data.added}`);
      clearSel();
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const downloadCsv = async () => {
    if (!selectedIds.length) return;
    try {
      const r = await api.post("/catalog/export-csv", { ids: selectedIds }, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement("a"); a.href = url; a.download = "katalog-urunler.csv"; a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/catalog/products/${editing.id}`, {
        title: editing.title, title_de: editing.title_de,
        description: editing.description, description_de: editing.description_de,
        product_type: editing.product_type, product_type_de: editing.product_type_de,
        brand: editing.brand, image: editing.image, code: editing.code,
        price: Number(editing.price) || 0, currency: editing.currency || "TRY",
      });
      setEditing(null); await load();
    } catch (e) { toast.error(formatApiError(e)); } finally { setSaving(false); }
  };

  const copyUrl = () => { navigator.clipboard.writeText(exportInfo.url); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className="space-y-5" data-testid="catalog-page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-zinc-900 flex items-center gap-2"><Boxes size={22} className="text-brand" /> {tx.title}</h1>
          <p className="text-sm text-zinc-500">{tx.subtitle} · {total} ürün</p>
        </div>
        <Button onClick={importFeed} disabled={importing} variant="outline" data-testid="catalog-import-btn">
          {importing ? <Loader2 size={15} className="mr-2 animate-spin" /> : <DownloadCloud size={15} className="mr-2" />}
          {importing ? tx.importing : tx.import}
        </Button>
      </div>

      {/* XML feed link */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/30 bg-brand-light/40 px-4 py-3">
        <FileCode2 size={16} className="text-brand shrink-0" />
        <span className="text-sm font-medium text-zinc-700 shrink-0">{tx.xmlLink} ({exportInfo.count}):</span>
        <input readOnly value={exportInfo.url} className="flex-1 min-w-[200px] bg-white border border-zinc-200 rounded px-2 py-1 text-xs font-mono text-zinc-600" data-testid="catalog-xml-url" />
        <Button size="sm" variant="ghost" onClick={copyUrl} data-testid="catalog-copy-url">
          {copied ? <Check size={14} className="text-brand" /> : <Copy size={14} />}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tx.search} className="pl-9" data-testid="catalog-search" />
        </div>
        <Select value={brand || "all"} onValueChange={(v) => { setBrand(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-52" data-testid="catalog-brand-filter"><SelectValue placeholder={tx.allBrands} /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">{tx.allBrands}</SelectItem>
            {facets.brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <CategoryCombobox value={category} options={facets.categories} onChange={(v) => { setCategory(v); setPage(1); }} tx={tx} />
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-900 text-white px-4 py-2.5 sticky top-2 z-20" data-testid="catalog-bulk-bar">
          <span className="text-sm font-medium mr-1">{selectedIds.length} {tx.selected}</span>
          <Button size="sm" onClick={translateSelected} disabled={!!progress} className="bg-brand hover:bg-brand-hover" data-testid="catalog-translate-btn">
            {progress ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Languages size={14} className="mr-1.5" />}
            {progress ? `${tx.translating} ${progress.done}${tx.ofN}${progress.total}` : tx.translate}
          </Button>
          <Button size="sm" variant="secondary" onClick={addToExport} data-testid="catalog-add-xml-btn"><FileCode2 size={14} className="mr-1.5" />{tx.addXml}</Button>
          <Button size="sm" variant="secondary" onClick={removeFromExport} data-testid="catalog-remove-xml-btn">{tx.removeXml}</Button>
          <Select onValueChange={bulkCurrency}>
            <SelectTrigger className="h-8 w-28 bg-white text-zinc-900 border-0" data-testid="catalog-bulk-currency"><SelectValue placeholder={tx.setCurrency} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TRY">₺ TRY</SelectItem>
              <SelectItem value="EUR">€ EUR</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="secondary" onClick={downloadCsv} data-testid="catalog-csv-btn"><FileSpreadsheet size={14} className="mr-1.5" />{tx.csv}</Button>
          <Button size="sm" variant="secondary" onClick={moveToInventory} data-testid="catalog-to-inventory-btn"><Warehouse size={14} className="mr-1.5" />{tx.toInventory}</Button>
          <Button size="sm" variant="destructive" onClick={bulkDelete} data-testid="catalog-bulk-delete-btn"><Trash2 size={14} className="mr-1.5" />{tx.delete}</Button>
          <Button size="sm" variant="ghost" onClick={clearSel} className="text-white hover:bg-white/10 ml-auto"><X size={14} /></Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-zinc-200 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-3 w-10"><Checkbox checked={allOnPageSelected} onCheckedChange={toggleAllOnPage} data-testid="catalog-select-all" /></th>
                <th className="px-2 py-3 w-14"></th>
                <th className="px-3 py-3 text-left font-semibold">{tx.product}</th>
                <th className="px-3 py-3 text-right font-semibold w-28">{tx.price}</th>
                <th className="px-3 py-3 text-left font-semibold w-36">{tx.brand}</th>
                <th className="px-3 py-3 text-left font-semibold w-48">{tx.category}</th>
                <th className="px-3 py-3 text-right font-semibold w-24">{tx.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-zinc-400">{tx.loading}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-zinc-400">{total === 0 ? tx.emptyHint : tx.none}</td></tr>
              ) : items.map((p) => (
                <tr key={p.id} className={`hover:bg-zinc-50 ${selected.has(p.id) ? "bg-brand-light/30" : ""}`} data-testid={`catalog-row-${p.id}`}>
                  <td className="px-3 py-2"><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} data-testid={`catalog-check-${p.id}`} /></td>
                  <td className="px-2 py-2">
                    {p.image ? <img src={p.image} alt="" className="w-10 h-10 object-cover rounded border border-zinc-200" loading="lazy" />
                      : <div className="w-10 h-10 rounded border border-zinc-200 bg-zinc-50 flex items-center justify-center text-zinc-300"><ImageOff size={14} /></div>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-zinc-900 line-clamp-1">{p.title_de || p.title}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {p.code && <span className="text-[11px] text-zinc-400">{p.code}</span>}
                      {p.translated && <Badge className="bg-brand/15 text-brand hover:bg-brand/15 text-[10px] px-1.5 py-0">DE</Badge>}
                      {p.in_export && <Badge className="bg-amber-500 text-white hover:bg-amber-500 text-[10px] px-1.5 py-0 gap-0.5"><FileCode2 size={9} />XML</Badge>}
                      {p.in_inventory && <Badge className="bg-sky-600 text-white hover:bg-sky-600 text-[10px] px-1.5 py-0 gap-0.5"><Warehouse size={9} />{tx.inInventory}</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-700">{formatMoney(p.price, p.currency)}</td>
                  <td className="px-3 py-2 text-zinc-600">{p.brand}</td>
                  <td className="px-3 py-2 text-zinc-500 text-xs line-clamp-2">{p.product_type_de || p.product_type}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditing({ ...p })} data-testid={`catalog-edit-${p.id}`}><Pencil size={14} /></Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:bg-red-50" onClick={() => deleteOne(p.id)} data-testid={`catalog-delete-${p.id}`}><Trash2 size={14} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="catalog-edit-dialog">
          <DialogHeader><DialogTitle>{tx.editTitle}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              {editing.image && <img src={editing.image} alt="" className="w-24 h-24 object-cover rounded border" />}
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">{tx.nameTr}</Label><Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} data-testid="edit-title-tr" /></div>
                <div><Label className="text-xs">{tx.nameDe}</Label><Input value={editing.title_de || ""} onChange={(e) => setEditing({ ...editing, title_de: e.target.value })} data-testid="edit-title-de" /></div>
              </div>
              <div><Label className="text-xs">{tx.descTr}</Label><Textarea rows={3} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div><Label className="text-xs">{tx.descDe}</Label><Textarea rows={3} value={editing.description_de || ""} onChange={(e) => setEditing({ ...editing, description_de: e.target.value })} data-testid="edit-desc-de" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">{tx.catTr}</Label><Input value={editing.product_type || ""} onChange={(e) => setEditing({ ...editing, product_type: e.target.value })} /></div>
                <div><Label className="text-xs">{tx.catDe}</Label><Input value={editing.product_type_de || ""} onChange={(e) => setEditing({ ...editing, product_type_de: e.target.value })} data-testid="edit-cat-de" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">{tx.brand}</Label><Input value={editing.brand || ""} onChange={(e) => setEditing({ ...editing, brand: e.target.value })} /></div>
                <div><Label className="text-xs">{tx.code}</Label><Input value={editing.code || ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} /></div>
                <div><Label className="text-xs">{tx.price}</Label><Input type="number" step="0.01" value={editing.price ?? ""} onChange={(e) => setEditing({ ...editing, price: e.target.value })} /></div>
              </div>
              <div className="w-40">
                <Label className="text-xs">{tx.currency}</Label>
                <Select value={editing.currency || "TRY"} onValueChange={(v) => setEditing({ ...editing, currency: v })}>
                  <SelectTrigger data-testid="edit-currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRY">₺ TRY</SelectItem>
                    <SelectItem value="EUR">€ EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">{tx.image}</Label><Input value={editing.image || ""} onChange={(e) => setEditing({ ...editing, image: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{tx.cancel}</Button>
            <Button onClick={saveEdit} disabled={saving} className="bg-brand hover:bg-brand-hover text-white" data-testid="catalog-save-edit">
              {saving && <Loader2 size={14} className="mr-2 animate-spin" />}{tx.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
