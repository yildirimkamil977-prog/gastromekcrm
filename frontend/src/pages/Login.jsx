import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useT } from "../i18n/LanguageContext";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Loader2, Lock, Mail, FileText, Users, Package, ArrowRight } from "lucide-react";

const LOGO = "https://customer-assets.emergentagent.com/job_7f4dcb13-bb80-4983-8764-b667de5bb352/artifacts/k8zjh8tf_gastromek-logo.png";

export default function Login() {
  const { user, ready, login } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@arigastro.com");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  if (ready && user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) navigate("/", { replace: true });
    else setErr(res.error || t("login.failed"));
  };

  const chips = [
    { icon: FileText, label: t("nav.quotes") },
    { icon: Users, label: t("nav.customers") },
    { icon: Package, label: t("nav.products") },
  ];

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] bg-white">
      {/* Left: dark blueprint brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-zinc-950 text-white p-12 xl:p-16">
        {/* blueprint grid */}
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(112,200,0,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(112,200,0,0.6) 1px, transparent 1px)",
            backgroundSize: "46px 46px",
          }}
        />
        {/* corner glow */}
        <div
          className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(112,200,0,0.35), transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 right-0 w-[22rem] h-[22rem] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(112,200,0,0.18), transparent 70%)" }}
        />

        {/* top: logo */}
        <div className="relative z-10 flex items-center">
          <div className="bg-white rounded-xl px-3.5 py-2.5 shadow-xl">
            <img src={LOGO} alt="Gastromek" className="h-9 w-auto object-contain" />
          </div>
        </div>

        {/* middle: hero */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-brand mb-7 font-semibold">
            <span className="w-9 h-px bg-brand" /> {t("login.heroBadge")}
          </div>
          <h2 className="font-heading text-4xl xl:text-5xl font-bold leading-[1.07] max-w-xl">
            {t("login.heroTitle")}
          </h2>
          <p className="mt-6 text-zinc-400 max-w-md text-base leading-relaxed">
            {t("login.heroSubtitle")}
          </p>

          <div className="mt-10 flex flex-wrap gap-2.5">
            {chips.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-white/15 bg-white/[0.04] text-sm text-zinc-200"
              >
                <Icon size={15} strokeWidth={1.5} className="text-brand" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* bottom: footer */}
        <div className="relative z-10 text-xs text-zinc-600">
          © {new Date().getFullYear()} {t("brand.name")}
        </div>
      </div>

      {/* Right: form */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-10 bg-white relative">
        <div className="absolute top-5 right-5">
          <LanguageSwitcher variant="login" />
        </div>

        <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <img src={LOGO} alt="Gastromek" className="h-9 w-auto object-contain" />
          </div>

          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-brand font-semibold mb-3">
            <span className="w-6 h-px bg-brand" /> {t("brand.name")}
          </div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight text-zinc-900">
            {t("login.welcome")}
          </h1>
          <p className="text-zinc-500 mt-2 text-sm">
            {t("login.subtitle")}
          </p>

          <div className="space-y-5 mt-9">
            <div>
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">{t("login.email")}</Label>
              <div className="relative mt-2">
                <Mail size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 h-12 rounded-none border-zinc-300 focus-visible:ring-brand focus-visible:border-brand"
                  placeholder="ornek@firma.com"
                  required
                  data-testid="login-email-input"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">{t("login.password")}</Label>
              <div className="relative mt-2">
                <Lock size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 h-12 rounded-none border-zinc-300 focus-visible:ring-brand focus-visible:border-brand"
                  placeholder="••••••••"
                  required
                  data-testid="login-password-input"
                />
              </div>
            </div>
            {err && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2.5" data-testid="login-error">
                {err}
              </div>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="group w-full h-12 rounded-none bg-brand hover:bg-brand-hover text-white font-semibold tracking-wide"
              data-testid="login-submit-button"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <span className="inline-flex items-center gap-2">
                  {t("login.submit")}
                  <ArrowRight size={16} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </Button>
          </div>

          <div className="mt-12 pt-6 border-t border-zinc-100 text-xs text-zinc-400">
            © {new Date().getFullYear()} {t("brand.name")} · {t("login.heroBadge")}
          </div>
        </form>
      </div>
    </div>
  );
}
