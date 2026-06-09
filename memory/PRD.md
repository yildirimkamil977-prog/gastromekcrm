## Round 6 — VAT (KDV/MwSt.) + quote/PDF polish (2026-06-09)
- QuoteForm: new **MwSt./KDV (%)** field ABOVE Rabatt (default 19), live calc subtotal→+VAT→withVat→−discount→grand; payload sends `vat_rate`. Dark totals box shows VAT line.
- Per-item **features** redesigned from stacked inputs to **compact wrapping chips** + inline add input (Enter to add, × to remove). 10 chips = ~2 rows (no vertical stretch).
- **Signature feature removed**: Quote View "Signieren/İmzala" button, Settings authorized-person field, and PDF handwritten signature block all deleted. (Email HTML signature kept — unrelated.)
- **PDF**: minimized header (padding 12mm top, logo 42px, heading 24px), added VAT row in totals, fixed green grand-total box padding (12×14, rounded, 8px spacer) so text no longer touches the box.
- QuoteView sidebar shows VAT line. Backend `compute_totals` (already supported vat_rate) verified consistent across POST/PUT.
- Verified 100% (iteration_6): backend 26/26 pytest, frontend 10/10, DE/TR both clean, zero bugs.

## Blueprint redesign (all pages) — 2026-06-08
- New "Command Center / Blueprint Grid" design system: cardless, full-bleed bands, sharp 1px `border-zinc-200`, ledger tables (sticky headers, hover rows, action icons on hover), brand green #70c800 accents, Outfit headings, lucide icons strokeWidth 1.5.
- Shared components: `src/components/Blueprint.jsx` (`PageBand`, `FullBleed`, `Panel`). Old `PageHeader` no longer used.
- Redesigned: Dashboard + Customers (iteration_3) and Quotes, Products, Users, CustomerDetail, QuoteForm, QuoteView, Settings (iteration_4). Customer & User create/edit forms now use a right-side `Sheet` (not modal). Settings uses a vertical tab rail.
- Verified 100% (iteration_4): all CRUD, PDF download, email/WhatsApp dialogs, settings tabs+save, DE/TR switching, no raw keys, no console errors.

## Round 5 — distinct redesigns + features + GM prefix (2026-06-08)
- Quotes: clickable status-summary chip strip + document-style rows with status accent stripe & green mono quote-no chip.
- Customers: contact-style list (big avatars, two-line rows, hover accent, count badge). CustomerDetail: profile hero + clickable contact chips (tel/mailto/wa) + status-striped quotes.
- QuoteForm: numbered step sections (1/2/3) + dark sticky totals box. QuoteView: document workspace (PDF on dark canvas + meta sidebar).
- Optional per-item FEATURES/specs: `QuoteItem.features` (backend) + add/remove editor in QuoteForm ItemRow + green bullets in PDF (empty lines ignored).
- Quote code prefix changed AR- → **GM-** (`generate_quote_no`). Verified GM-202606-0001.
- Settings/company defaults + preview DB set to Gastromek GmbH (Hörderstr. 288, 58454 Witten · +49 163 9830039 · info@gastromek.de · logo).
- Verified 100% (iteration_5), zero bugs.

# Gastromek CRM - Product Requirements Document

> Rebranded from **ArıCRM** to **Gastromek CRM** (2026-06-08). Corporate color updated to **logo green #70c800** (was #0073c4) + white. Logo: Gastromek GmbH logo used in sidebar, mobile header, and login.

## Branding & error localization — updated 2026-06-08
- Brand color is the logo green **#70c800** (hover #5ba800, light #eef8df, dark #4e8a00). Applied via Tailwind `brand.*`, CSS vars `--primary/--ring/--chart-1` (HSL 86 100% 39%), `.nav-link.active`, PDF accent, login gradient, theme-color meta.
- Logo image used across UI brand spots; PDF still uses the company's own `settings.logo_url` (configurable in Settings → Firma).
- **Backend error messages localized on the frontend**: `src/i18n/errors.js` maps Turkish API `detail` strings → German (with regex patterns for dynamic ones) and network errors. `formatApiError()` localizes based on active language. Turkish keeps original strings.

## Internationalization (i18n) — added 2026-06-08
- Default language: **German (de)**. **Turkish (tr)** kept as an option.
- Language switcher in the Sidebar (and Login top-right): `LanguageSwitcher.jsx` (data-testid `language-switcher-btn`, options `language-option-de` / `language-option-tr`).
- Selection persisted in `localStorage['gastromek_lang']`; drives `document.documentElement.lang` and number/date locale (`de-DE` / `tr-TR`).
- Core: `src/i18n/translations.js` (full de+tr dictionary) and `src/i18n/LanguageContext.jsx` (`useT()` hook, fallback: current lang → de → key).
- **PDF is localized** too: `QuotePDFTemplate.jsx` uses `t('pdf.*')` (heading ANGEBOT/TEKLİF, table headers, totals, validity footer). PDF filename prefix Angebot-/Teklif-.
- All pages/components converted to `useT()`. StatusBadge labels via `t('status.<code>')` while status codes (taslak/gonderildi/…) remain stored values.
- Verified: testing agent iteration_2 — 100% frontend pass in both languages, no raw keys, no crashes.


## Original Problem Statement
Turkish B2B CRM for **Arıgastro** (endüstriyel mutfak ekipmanları) focused on customer management + professional price quotation workflow. System name: **ArıCRM**. Corporate color: **#0073c4** + white.

## User Personas
- **Admin (Yönetici)**: full access — manages users, company settings, all customers/quotes.
- **Satış Temsilcisi (Sales)**: can manage customers/quotes/products but cannot access Settings or Users.

## Architecture
- **Backend**: FastAPI (Python) + MongoDB (motor). Routes: `auth`, `users`, `customers`, `products`, `quotes`, `settings`. JWT cookie-based auth (httpOnly, SameSite=None, Secure). APScheduler daily feed sync.
- **Frontend**: React 19 + React Router + Tailwind + shadcn/ui + lucide-react. Fonts: Outfit (heading) + Manrope (body). Turkish UI.
- **Integrations**:
  - **Myikas Google Shopping XML feed** — daily + manual sync (4173 products currently).
  - **Resend** (configurable via settings page) for email with PDF attachment.
  - **Custom SMTP** fallback for corporate mail servers.
  - **WhatsApp** via `wa.me` link.
  - **PDF** via `html2canvas` + `jspdf` (client-side).

## Core Static Requirements
- Quote statuses: `taslak`, `gonderildi`, `kabul`, `red`, `suresi_doldu`.
- Currencies: TRY (default), USD, EUR.
- Auto-generated quote number: `AR-YYYYMM-NNNN`, revisions append `-Rx`.
- Discount applied on VAT-included total (per user spec).
- PDF template must be professional, print-ready A4.

## Implemented (2026-04-21) ✅
- Auth: login / logout / me, admin seed on startup, JWT access + refresh cookies.
- Users CRUD (admin-only) with role selection.
- Customers CRUD with filters (name, tax no, phone, email, city, date range).
- Customer detail page with embedded quote list.
- Products page: grid view with images, search, manual "Feed'i Güncelle" button (count + last sync displayed).
- Daily scheduled feed sync (APScheduler + asyncio task).
- Quote form: live customer search (by firma name or vergi no), live product autocomplete (name/code/GTIN/brand), inline pencil-edit on every field including image, per-line discount, live total calculation.
- Quote view: professional PDF template preview (A4), PDF download, print, email dialog (with subject/message + auto PDF attachment), WhatsApp dialog, revisions list, status change, delete.
- Revision system: each revision saved as separate record; all revisions visible under parent quote.
- Settings page: Company info, bank info, Email provider (Resend/SMTP) config, quote defaults tab.
- Dashboard: 5 status count widgets, totals for Customer/Product/Quote, Recent Quotes list (NO revenue metrics per user request).
- Role-based sidebar: sales rep doesn't see Kullanıcılar/Ayarlar.
- Testing: 25/25 backend tests, full frontend smoke passed.

## Prioritized Backlog
### P1 — Nice to have
- Native `<input type="date">` → shadcn Calendar DatePicker (Turkish locale `gg.aa.yyyy`).
- `PATCH /api/customers/{id}` partial update.
- Quote duplication (copy to new quote with new number, no revision linkage).
- Bulk email to multiple customers (quote template campaign).

### P2 — Future
- Rate limiting + brute-force lockout on login.
- CSRF protection (currently SameSite=None + secure cookies).
- Quote approval workflow (when customer accepts via public link).
- Customer tags/segments + quote performance analytics.
- Export customers/quotes to Excel.

## Production Deployment (2026-04-23) 🚀
- Target VPS: Hetzner CX22 (Ubuntu 24.04) — IP `91.98.43.11`, name `aricrm-prod`.
- Domain: `arigastrocrm.com` (Resend verified ✅).
- Deployment package created at `/app/deployment/`:
  - `docker-compose.yml` — mongo + backend + frontend-builder + Caddy
  - `Caddyfile` — reverse proxy + automatic Let's Encrypt HTTPS
  - `deploy.sh` — one-shot Ubuntu bootstrap (Docker, UFW, fail2ban, build, start)
  - `.env.example` — production env template
  - `README.md` — Turkish step-by-step guide (DNS → SSH → .env → deploy → verify)
- Dockerfiles live at `/app/backend/Dockerfile` and `/app/frontend/Dockerfile`.
- Backend runs `uvicorn --workers 1` (APScheduler must not double-schedule).
- Frontend built via multi-stage and served as static files from a shared volume by Caddy.

## Next Tasks
- User completes DNS A records (arigastrocrm.com + www → 91.98.43.11).
- User SSHes into VPS, clones repo (via GitHub "Save to GitHub" or scp), edits .env, runs `bash deploy.sh`.
- Post-deploy smoke test: login, create quote, email test via Resend.
- Optional: upgrade date pickers to shadcn Calendar for better Turkish UX.
- Optional: public quote share link for customer acceptance tracking.

## Test Credentials
See `/app/memory/test_credentials.md`.
