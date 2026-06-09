import React, { useEffect, useState } from "react";
import { api, formatApiError, formatDate } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import { PageBand, FullBleed } from "../components/Blueprint";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "../components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Plus, Pencil, Trash2, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";

const EMPTY = { email: "", name: "", role: "sales", password: "" };

export default function Users() {
  const { t } = useT();
  const { user: currentUser } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/users");
      setRows(r.data);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (u) => {
    setEditing(u);
    setForm({ email: u.email, name: u.name, role: u.role, password: "" });
    setOpen(true);
  };

  const save = async () => {
    try {
      if (editing) {
        const payload = { email: form.email, name: form.name, role: form.role };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editing.id}`, payload);
        toast.success(t("users.userUpdated"));
      } else {
        if (!form.password) { toast.error(t("users.passwordRequired")); return; }
        await api.post("/users", form);
        toast.success(t("users.userAdded"));
      }
      setOpen(false); load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const remove = async (id) => {
    if (!window.confirm(t("users.confirmDelete"))) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success(t("users.userDeleted"));
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const initials = (name) => (name || "?").trim().charAt(0).toUpperCase();

  return (
    <FullBleed testid="users">
      <PageBand eyebrow={t("nav.sectionAdmin")} title={t("users.title")} subtitle={t("users.subtitle")}>
        <Button className="bg-brand hover:bg-brand-hover text-white h-11 px-5" onClick={openNew} data-testid="new-user-btn">
          <Plus size={16} strokeWidth={1.5} className="mr-2" /> {t("users.newUser")}
        </Button>
      </PageBand>

      <div className="bg-white" data-testid="users-ledger">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold bg-zinc-50 border-b border-zinc-200">
                <th className="px-4 sm:px-6 py-3">{t("users.fullName")}</th>
                <th className="px-4 py-3 hidden sm:table-cell">{t("login.email")}</th>
                <th className="px-4 py-3">{t("users.role")}</th>
                <th className="px-4 py-3 hidden lg:table-cell">{t("table.registered")}</th>
                <th className="px-4 sm:px-6 py-3 text-right">{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && <tr><td colSpan={5} className="p-12 text-center text-zinc-400 text-sm">{t("common.loading")}</td></tr>}
              {rows.map((u) => (
                <tr key={u.id} className="group hover:bg-zinc-50 transition-colors text-sm">
                  <td className="px-4 sm:px-6 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-md bg-brand-light text-brand font-heading font-bold flex items-center justify-center shrink-0 text-sm">{initials(u.name)}</span>
                      <span>
                        <span className="block font-semibold text-zinc-900">{u.name}</span>
                        <span className="block text-xs text-zinc-400 sm:hidden">{u.email}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold border uppercase tracking-wider ${u.role === "admin" ? "bg-brand-light text-brand border-brand/40" : "bg-zinc-100 text-zinc-600 border-zinc-200"}`}>
                      {u.role === "admin" ? <ShieldCheck size={12} strokeWidth={1.5} /> : <User size={12} strokeWidth={1.5} />}
                      {u.role === "admin" ? t("nav.roleAdmin") : t("nav.roleSales")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden lg:table-cell">{formatDate(u.created_at)}</td>
                  <td className="px-4 sm:px-6 py-3 text-right">
                    <div className="inline-flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(u)} data-testid={`edit-user-${u.id}`}><Pencil size={14} strokeWidth={1.5} /></Button>
                      {u.id !== currentUser?.id && (
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => remove(u.id)} data-testid={`delete-user-${u.id}`}><Trash2 size={14} strokeWidth={1.5} /></Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col" data-testid="user-sheet">
          <SheetHeader className="px-6 py-5 border-b border-zinc-200 text-left">
            <SheetTitle className="font-heading text-xl tracking-tight">{editing ? t("users.editUser") : t("users.newUser")}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div><Label className="text-xs text-zinc-500">{t("users.fullName")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" data-testid="user-name-input" /></div>
            <div><Label className="text-xs text-zinc-500">{t("login.email")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" data-testid="user-email-input" /></div>
            <div>
              <Label className="text-xs text-zinc-500">{t("users.role")}</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="mt-1" data-testid="user-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t("users.roleAdminOption")}</SelectItem>
                  <SelectItem value="sales">{t("users.roleSales")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-zinc-500">{t("users.password")} {editing && <span className="text-zinc-400">{t("users.passwordEditHint")}</span>}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1" data-testid="user-password-input" />
            </div>
          </div>
          <SheetFooter className="px-6 py-4 border-t border-zinc-200 flex-row gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="button" onClick={save} className="flex-1 bg-brand hover:bg-brand-hover text-white" data-testid="save-user-btn">{t("common.save")}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </FullBleed>
  );
}
