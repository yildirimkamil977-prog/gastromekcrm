import React, { useEffect, useState } from "react";
import { api, formatApiError, formatDate } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
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

  const save = async (e) => {
    e.preventDefault();
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

  return (
    <div>
      <PageHeader title={t("users.title")} subtitle={t("users.subtitle")}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand hover:bg-brand-hover" onClick={openNew} data-testid="new-user-btn"><Plus size={14} className="mr-2" /> {t("users.newUser")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">{editing ? t("users.editUser") : t("users.newUser")}</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div><Label>{t("users.fullName")}</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="user-name-input" /></div>
              <div><Label>{t("login.email")}</Label><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="user-email-input" /></div>
              <div>
                <Label>{t("users.role")}</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger data-testid="user-role-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{t("users.roleAdminOption")}</SelectItem>
                    <SelectItem value="sales">{t("users.roleSales")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("users.password")} {editing && <span className="text-xs text-slate-500">{t("users.passwordEditHint")}</span>}</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="user-password-input" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
                <Button type="submit" className="bg-brand hover:bg-brand-hover" data-testid="save-user-btn">{t("common.save")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-medium uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-3">{t("users.fullName")}</th>
              <th className="px-6 py-3">{t("login.email")}</th>
              <th className="px-6 py-3">{t("users.role")}</th>
              <th className="px-6 py-3">{t("table.registered")}</th>
              <th className="px-6 py-3 text-right">{t("table.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="p-8 text-center text-slate-400">{t("common.loading")}</td></tr>}
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                <td className="px-6 py-3 font-medium">{u.name}</td>
                <td className="px-6 py-3 text-slate-600">{u.email}</td>
                <td className="px-6 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${u.role === "admin" ? "bg-brand-light text-brand border-brand/30" : "bg-slate-100 text-slate-700 border-slate-200"}`}>
                    {u.role === "admin" ? t("nav.roleAdmin") : t("nav.roleSales")}
                  </span>
                </td>
                <td className="px-6 py-3 text-slate-500">{formatDate(u.created_at)}</td>
                <td className="px-6 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(u)} data-testid={`edit-user-${u.id}`}><Pencil size={14} /></Button>
                  {u.id !== currentUser?.id && (
                    <Button size="sm" variant="ghost" onClick={() => remove(u.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50" data-testid={`delete-user-${u.id}`}><Trash2 size={14} /></Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
