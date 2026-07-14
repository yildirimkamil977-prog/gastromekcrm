import React, { useEffect, useState } from "react";
import { api, formatApiError } from "../lib/api";
import { useT } from "../i18n/LanguageContext";
import { PageBand, FullBleed } from "../components/Blueprint";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Save, Loader2, Upload, Building2, Landmark, Share2, Mail, FileSignature, Lock } from "lucide-react";
import { toast } from "sonner";

function ImageUploader({ onUploaded, label, testId }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const inputRef = React.useRef(null);
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onUploaded(data.url);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" data-testid={testId} />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Upload size={14} strokeWidth={1.5} className="mr-2" />}
        {label || t("settings.uploadImage")}
      </Button>
    </>
  );
}

const PANEL = "bg-white border border-zinc-200 p-6";
const TAB_ITEM = "justify-start gap-2 w-full rounded-md px-3 py-2 text-sm text-zinc-600 data-[state=active]:bg-brand-light data-[state=active]:text-brand data-[state=active]:shadow-none data-[state=active]:font-semibold";

export default function Settings() {
  const { t } = useT();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/settings").then((r) => setForm(r.data)).catch((e) => toast.error(formatApiError(e))).finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleAccRole = (role) => {
    const cur = form.accounting_visible_roles || [];
    set("accounting_visible_roles", cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role]);
  };
  const toggleProjRole = (role) => {
    const cur = form.projects_visible_roles || [];
    set("projects_visible_roles", cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role]);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", form);
      toast.success(t("settings.saved"));
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) return <div className="p-8 text-zinc-400">{t("common.loading")}</div>;

  return (
    <FullBleed testid="settings">
      <PageBand eyebrow={t("nav.sectionAdmin")} title={t("settings.title")} subtitle={t("settings.subtitle")}>
        <Button onClick={save} disabled={saving} className="bg-brand hover:bg-brand-hover text-white h-11 px-5" data-testid="save-settings-btn">
          {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} strokeWidth={1.5} className="mr-2" />}
          {t("common.save")}
        </Button>
      </PageBand>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="company" className="lg:grid lg:grid-cols-[210px_1fr] lg:gap-6">
          <TabsList className="h-auto bg-transparent p-0 mb-4 lg:mb-0 flex lg:flex-col w-full justify-start gap-1 overflow-x-auto lg:sticky lg:top-4">
            <TabsTrigger value="company" className={TAB_ITEM} data-testid="tab-company"><Building2 size={15} strokeWidth={1.5} /> {t("settings.tabCompany")}</TabsTrigger>
            <TabsTrigger value="bank" className={TAB_ITEM} data-testid="tab-bank"><Landmark size={15} strokeWidth={1.5} /> {t("settings.tabBank")}</TabsTrigger>
            <TabsTrigger value="social" className={TAB_ITEM} data-testid="tab-social"><Share2 size={15} strokeWidth={1.5} /> {t("settings.tabSocial")}</TabsTrigger>
            <TabsTrigger value="email" className={TAB_ITEM} data-testid="tab-email"><Mail size={15} strokeWidth={1.5} /> {t("settings.tabEmail")}</TabsTrigger>
            <TabsTrigger value="quote" className={TAB_ITEM} data-testid="tab-quote"><FileSignature size={15} strokeWidth={1.5} /> {t("settings.tabQuote")}</TabsTrigger>
            <TabsTrigger value="access" className={TAB_ITEM} data-testid="tab-access"><Lock size={15} strokeWidth={1.5} /> {t("settings.tabAccess")}</TabsTrigger>
          </TabsList>

          <div className="min-w-0">
            <TabsContent value="company" className="mt-0">
              <div className={`${PANEL} grid grid-cols-1 md:grid-cols-2 gap-4`}>
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <Label>{t("settings.logoUrl")}</Label>
                    <ImageUploader onUploaded={(url) => { set("logo_url", url); toast.success(t("settings.imageUploaded")); }} label={t("settings.uploadLogo")} testId="upload-logo" />
                  </div>
                  <Input value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://..." data-testid="settings-logo-url" />
                </div>
                {form.logo_url && <div className="md:col-span-2 bg-zinc-50 border border-zinc-200 p-4"><img src={form.logo_url} alt="logo" className="h-16 object-contain" /></div>}
                <div><Label>{t("settings.businessName")}</Label><Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} /></div>
                <div><Label>{t("settings.slogan")}</Label><Input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} /></div>
                <div><Label>{t("settings.website")}</Label><Input value={form.website} onChange={(e) => set("website", e.target.value)} /></div>
                <div><Label>{t("settings.phone")}</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
                <div><Label>{t("settings.email")}</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
                <div><Label>{t("settings.taxOffice")}</Label><Input value={form.tax_office} onChange={(e) => set("tax_office", e.target.value)} /></div>
                <div><Label>{t("settings.taxNumber")}</Label><Input value={form.tax_number} onChange={(e) => set("tax_number", e.target.value)} /></div>
                <div className="md:col-span-2"><Label>{t("settings.address")}</Label><Textarea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
              </div>
            </TabsContent>

            <TabsContent value="bank" className="mt-0">
              <div className={`${PANEL} space-y-4`}>
                <div className="text-sm text-zinc-500">{t("settings.bankIntro")}</div>
                {[0, 1, 2].map((i) => {
                  const banks = form.banks || [];
                  const b = banks[i] || { name: "", account_holder: "", iban: "", currency: "TRY" };
                  const setBank = (patch) => {
                    const next = [...banks];
                    while (next.length <= i) next.push({ name: "", account_holder: "", iban: "", currency: "TRY" });
                    next[i] = { ...next[i], ...patch };
                    set("banks", next);
                  };
                  const removeBank = () => set("banks", banks.filter((_, idx) => idx !== i));
                  return (
                    <div key={i} className="border border-zinc-200 p-4 space-y-3" data-testid={`bank-slot-${i}`}>
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">{t("settings.bank")} {i + 1}</div>
                        {(b.name || b.account_holder || b.iban) && (
                          <button type="button" onClick={removeBank} className="text-xs text-red-600 hover:text-red-700">{t("common.clear")}</button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div><Label>{t("settings.bankName")}</Label><Input value={b.name} onChange={(e) => setBank({ name: e.target.value })} placeholder="Garanti BBVA" data-testid={`bank-name-${i}`} /></div>
                        <div><Label>{t("settings.accountHolder")}</Label><Input value={b.account_holder} onChange={(e) => setBank({ account_holder: e.target.value })} /></div>
                        <div>
                          <Label>{t("settings.currency")}</Label>
                          <Select value={b.currency || "TRY"} onValueChange={(v) => setBank({ currency: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="TRY">{t("settings.cltl")}</SelectItem>
                              <SelectItem value="USD">$ USD</SelectItem>
                              <SelectItem value="EUR">€ EUR</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-3"><Label>IBAN</Label><Input value={b.iban} onChange={(e) => setBank({ iban: e.target.value })} placeholder="TR00 0000 0000 0000 0000 0000 00" className="font-mono" /></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="social" className="mt-0">
              <div className={`${PANEL} grid grid-cols-1 md:grid-cols-2 gap-4`}>
                <div className="md:col-span-2 text-sm text-zinc-500">{t("settings.socialIntro")}</div>
                <div><Label>Instagram</Label><Input value={form.social_instagram} onChange={(e) => set("social_instagram", e.target.value)} placeholder="https://instagram.com/..." data-testid="settings-social-instagram" /></div>
                <div><Label>Facebook</Label><Input value={form.social_facebook} onChange={(e) => set("social_facebook", e.target.value)} placeholder="https://facebook.com/..." data-testid="settings-social-facebook" /></div>
                <div><Label>Twitter / X</Label><Input value={form.social_twitter} onChange={(e) => set("social_twitter", e.target.value)} placeholder="https://x.com/..." data-testid="settings-social-twitter" /></div>
                <div><Label>LinkedIn</Label><Input value={form.social_linkedin} onChange={(e) => set("social_linkedin", e.target.value)} placeholder="https://linkedin.com/company/..." data-testid="settings-social-linkedin" /></div>
                <div><Label>YouTube</Label><Input value={form.social_youtube} onChange={(e) => set("social_youtube", e.target.value)} placeholder="https://youtube.com/@..." data-testid="settings-social-youtube" /></div>
                <div><Label>TikTok</Label><Input value={form.social_tiktok} onChange={(e) => set("social_tiktok", e.target.value)} placeholder="https://tiktok.com/@..." data-testid="settings-social-tiktok" /></div>
              </div>
            </TabsContent>

            <TabsContent value="email" className="mt-0">
              <div className={`${PANEL} space-y-4`}>
                <div>
                  <Label>{t("settings.provider")}</Label>
                  <Select value={form.email_provider} onValueChange={(v) => set("email_provider", v)}>
                    <SelectTrigger className="w-full md:w-72" data-testid="settings-email-provider"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resend">{t("settings.providerResend")}</SelectItem>
                      <SelectItem value="smtp">{t("settings.providerSmtp")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-zinc-500 mt-2">
                    {t("settings.resendHintPre")}<a className="text-brand underline" href="https://resend.com" target="_blank" rel="noreferrer">resend.com</a>{t("settings.resendHintPost")}
                  </p>
                  <div className="text-xs text-zinc-500 mt-2 p-3 bg-zinc-50 border border-zinc-200">
                    <b>{t("settings.replyInfoTitle")}</b> {t("settings.replyInfoBody")}
                    <br />
                    <b>{t("settings.senderInfoTitle")}</b> {t("settings.senderInfoBody")}
                  </div>
                </div>

                {form.email_provider === "resend" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
                    <div className="md:col-span-2"><Label>{t("settings.resendApiKey")}</Label><Input type="password" value={form.resend_api_key} onChange={(e) => set("resend_api_key", e.target.value)} placeholder="re_..." data-testid="settings-resend-key" /></div>
                    <div className="md:col-span-2"><Label>{t("settings.senderEmailVerified")}</Label><Input value={form.resend_from_email} onChange={(e) => set("resend_from_email", e.target.value)} placeholder="angebot@firma.de" /></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
                    <div><Label>{t("settings.smtpHost")}</Label><Input value={form.smtp_host} onChange={(e) => set("smtp_host", e.target.value)} placeholder="mail.firma.de" /></div>
                    <div><Label>{t("settings.port")}</Label><Input type="number" value={form.smtp_port} onChange={(e) => set("smtp_port", Number(e.target.value) || 587)} /></div>
                    <div><Label>{t("settings.smtpUser")}</Label><Input value={form.smtp_user} onChange={(e) => set("smtp_user", e.target.value)} /></div>
                    <div><Label>{t("settings.smtpPassword")}</Label><Input type="password" value={form.smtp_password} onChange={(e) => set("smtp_password", e.target.value)} /></div>
                    <div className="md:col-span-2"><Label>{t("settings.senderEmail")}</Label><Input value={form.smtp_from_email} onChange={(e) => set("smtp_from_email", e.target.value)} /></div>
                    <div className="flex items-center gap-2"><Switch checked={form.smtp_use_tls} onCheckedChange={(v) => set("smtp_use_tls", v)} /> <span className="text-sm">{t("settings.useStarttls")}</span></div>
                  </div>
                )}

                <div className="pt-4 border-t border-zinc-100">
                  <div className="flex items-center justify-between mb-1">
                    <Label>{t("settings.emailSignature")}</Label>
                    <ImageUploader
                      onUploaded={(url) => {
                        navigator.clipboard?.writeText(url).catch(() => {});
                        const tag = `<img src="${url}" alt="imza" style="max-width:200px"/>`;
                        set("email_signature_html", (form.email_signature_html || "") + "\n" + tag);
                        toast.success(t("settings.imageUploadedToSignature"));
                      }}
                      label={t("settings.addImageToSignature")}
                      testId="upload-signature-image"
                    />
                  </div>
                  <Textarea rows={6} value={form.email_signature_html || ""} onChange={(e) => set("email_signature_html", e.target.value)} placeholder={t("settings.signaturePlaceholder")} data-testid="settings-email-signature" />
                  <p className="text-xs text-zinc-500 mt-2">{t("settings.signatureHelp")}</p>
                </div>

                <div className="pt-4 border-t border-zinc-100">
                  <Label>{t("settings.openaiApiKey")}</Label>
                  <Input type="password" value={form.openai_api_key || ""} onChange={(e) => set("openai_api_key", e.target.value)} placeholder="sk-..." className="font-mono" data-testid="settings-openai-key" />
                  <p className="text-xs text-zinc-500 mt-2">{t("settings.openaiApiKeyHelp")}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="quote" className="mt-0">
              <div className={`${PANEL} grid grid-cols-1 md:grid-cols-2 gap-4`}>
                <div><Label>{t("settings.defaultValidity")}</Label><Input type="number" value={form.default_validity_days} onChange={(e) => set("default_validity_days", Number(e.target.value) || 30)} /></div>
                <div className="md:col-span-2"><Label>{t("settings.defaultQuoteNotes")}</Label><Textarea rows={4} value={form.default_quote_notes} onChange={(e) => set("default_quote_notes", e.target.value)} placeholder={t("settings.defaultQuoteNotesPlaceholder")} /></div>
              </div>
            </TabsContent>

            <TabsContent value="access" className="mt-0">
              <div className={PANEL}>
                <h3 className="font-heading text-lg font-semibold text-zinc-900">{t("settings.accessTitle")}</h3>
                <p className="text-sm text-zinc-500 mt-1 mb-5">{t("settings.accessIntro")}</p>
                <div className="space-y-2.5 max-w-md">
                  <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-1">{t("settings.accountingAccessLabel")}</div>
                  <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 bg-zinc-50/60">
                    <span className="text-sm font-medium text-zinc-700">{t("settings.roleAdminLabel")}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-400">{t("settings.alwaysOn")}</span>
                      <Switch checked disabled />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3">
                    <span className="text-sm font-medium text-zinc-700">{t("settings.roleSalesLabel")}</span>
                    <Switch checked={(form.accounting_visible_roles || []).includes("sales")} onCheckedChange={() => toggleAccRole("sales")} data-testid="access-sales-switch" />
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3">
                    <span className="text-sm font-medium text-zinc-700">{t("settings.roleAccountingLabel")}</span>
                    <Switch checked={(form.accounting_visible_roles || []).includes("muhasebe")} onCheckedChange={() => toggleAccRole("muhasebe")} data-testid="access-muhasebe-switch" />
                  </div>

                  <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-1 pt-4">{t("settings.projectsAccessLabel")}</div>
                  <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 bg-zinc-50/60">
                    <span className="text-sm font-medium text-zinc-700">{t("settings.roleAdminLabel")}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-400">{t("settings.alwaysOn")}</span>
                      <Switch checked disabled />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3">
                    <span className="text-sm font-medium text-zinc-700">{t("settings.roleSalesLabel")}</span>
                    <Switch checked={(form.projects_visible_roles || []).includes("sales")} onCheckedChange={() => toggleProjRole("sales")} data-testid="access-proj-sales-switch" />
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3">
                    <span className="text-sm font-medium text-zinc-700">{t("settings.roleAccountingLabel")}</span>
                    <Switch checked={(form.projects_visible_roles || []).includes("muhasebe")} onCheckedChange={() => toggleProjRole("muhasebe")} data-testid="access-proj-muhasebe-switch" />
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </FullBleed>
  );
}