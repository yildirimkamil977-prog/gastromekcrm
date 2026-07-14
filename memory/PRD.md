## Round 18 — OpenAI key in Settings + translation VERIFIED working (2026-07-14)
- User added billing to their OpenAI key → translation now works (curl: DE↔TR correct, codes/units preserved).
- Added OpenAI API key field to Settings (Ayarlar → E-posta tab, data-testid=settings-openai-key, password). Backend CompanySettings.openai_api_key added; sanitized (hidden) for non-admin roles. Saved via the existing single PUT /api/settings.
- translate.py now prefers the settings-DB key, falls back to env OPENAI_API_KEY.
- Verified 100% (iteration_14, 6/6): settings field present+saveable; both PDF İndir & Fiyatsız İndir dropdowns (🇹🇷/🇩🇪) translate + download end-to-end (files Angebot-<no>-DE.pdf / -TR-ohne-Preise.pdf), zero console errors. Round-trip curl: settings key saved (len 164) → translate uses it.
- DEPLOY NOTE: on the live server, set OPENAI_API_KEY in deployment/.env OR enter the key via Settings UI (stored in DB) after deploy — the key is NOT in git.


## Round 17 — Quote PDF language download (TR/DE translation) (2026-07-14)
- Quote view: "PDF İndir" and "Fiyatsız Olarak İndir" are now dropdowns with flag options 🇹🇷 Türkçe / 🇩🇪 Almanca. Selecting a language translates ALL dynamic quote content (item title/description/features, notes) to the target language and downloads a PDF whose static labels are also forced to that language.
- Backend: new POST /api/translate {target_lang, texts[]} using the USER'S OWN OpenAI key (OPENAI_API_KEY in backend/.env) via emergentintegrations LlmChat + gpt-4o-mini. Keeps codes/numbers/units unchanged; graceful fallback returns originals on parse mismatch; 400 on invalid lang; empty texts skip the LLM.
- Frontend: QuotePDFTemplate gained `lang` prop (createTranslator from LanguageContext); hidden #quote-pdf-root-translated rendered on demand; generatePdf(rootId) shared. i18n keys quoteView.langTurkish/langGerman/translateError.
- Verified via curl: routing/auth OK, empty→originals (200), invalid lang→400. Compiles clean.
- ⚠️ BLOCKER (NOT a code issue): the user's provided OpenAI key returns RateLimitError "exceeded your current quota". Translation download will only work once the key has billing/credits, OR switch to Emergent Universal key. Feature is otherwise complete & ready.


## Round 16 — Editable expense total debt (2026-07-01)
- In the expense detail dialog (ProjeDetay), the "Toplam Borç / Gesamtschuld" (total debt) card is now editable: pencil (edit-debt-btn) → inline input (edit-debt-input) + save (save-debt-btn) / cancel (cancel-debt-btn). Saving PUTs total_debt and the "Kalan/Offen" remaining recalculates.
- i18n: projects.expenseUpdated (DE 'Ausgabe aktualisiert' / TR 'Gider güncellendi'). Backend PUT /projects/{id}/expenses/{eid} already supported total_debt.
- Verified 100% (iteration_13, 6/6): edit+save updates debt & remaining, cancel preserves value, list row reflects change, zero console errors. Test data cleaned.


## Round 15 — "Fiyatsız Olarak İndir" (priceless PDF) (2026-07-01)
- Quote view (`/teklifler/:id`) got a new "Fiyatsız Olarak İndir" / "Ohne Preise herunterladen" button (data-testid=download-priceless-pdf-btn) next to the normal PDF download.
- `QuotePDFTemplate` gained `priceless` + `rootId` props. When priceless: hides unit-price/disc/amount columns, the totals block (subtotal/VAT/discount/grand total), the notes section, and the validity ('valid until') lines (header + footer). Product name & quantity remain.
- QuoteView renders a hidden off-screen priceless template (#quote-pdf-root-priceless); generatePdf(rootId) is shared. Filename suffix i18n (TR 'fiyatsiz' / DE 'ohne-Preise'). Normal download unchanged.
- Verified 100% (iteration_12, 6/6): visible template keeps 7 columns+totals+notes+validity; hidden priceless has 4 columns, no totals/notes/validity; both downloads work, zero console errors.


## Round 14 — Removed login brute-force lockout (2026-07-01)
- Per user request, removed the 5-attempts/15-min lockout (HTTP 429 "try again in 15 min") from `routes/auth_routes.py`. Also dropped the per-attempt `login_attempts` logging (only served the lockout).
- Login flow (JWT cookie issuance, 401 on wrong creds) unchanged. Verified via curl: 7 wrong attempts all return 401 (no 429), correct login returns 200.
- Security note: brute-force protection is now OFF. Can be re-added later with a higher threshold / IP-based limit if desired.


## Round 13 — PDF support in receipts/dekont (2026-07-01)
- Receipt (dekont) uploads now accept PDF in addition to images, across income/expense/payment forms.
- Backend `uploads.py`: added `.pdf` to ALLOWED_EXT, raised MAX_BYTES to 10 MB; served with correct application/pdf content-type. Verified via curl (upload + serve OK, .txt still rejected).
- Frontend `ProjeDetay.jsx`: file inputs accept="image/*,application/pdf"; PDFs render as a clickable red "PDF" tile (FileText icon + link) instead of a broken <img> in the editor, income rows, and payment rows. `isPdf()` helper detects by extension.


## Round 12 — Projects on Customer Profile (2026-07-01)
- Customer detail (`/musteriler/:id`) now shows a "Projekte" table listing that customer's projects (name, Projektsumme, Offenes/remaining, Gewinn), each row navigates to `/projeler/:id`.
- Backend: GET /projects gained optional `customer_id` filter. Frontend: CustomerDetail.load() fetches /projects?customer_id (role-gated, 403-tolerant); section only renders when projects.length>0.
- Verified 100% (iteration_11, 5/5): section absent when no projects, appears with correct figures after create, row-click navigates, hidden again after delete. Test data cleaned.


## Round 11 — Project currency lock + income receipts (2026-07-01)
- Project detail: income/expense/payment currency is now LOCKED to the project's currency (read-only CurrencyBadge, no Select). Amounts always use project currency.
- Added receipt (dekont) image upload to the INCOME form (reused ReceiptField); income rows render receipt thumbnails. Backend `ProjectIncomeCreate/Update` gained `receipts: List[str]`.
- Receipt upload is OPTIONAL for income & expense/payment (empty allowed).
- Verified 100% (iteration_10, 8/8): currency locked to TRY across all forms, income saved with/without receipt, thumbnails shown, all amounts render in project currency. Test data cleaned.


## Round 10 — Project customer combobox fix (2026-07-01)
- BUG (P0): "Proje Ekle" form customer list was empty. Root cause: frontend called GET /api/customers?page_size=1000, exceeding backend cap (le=200) → 422 → empty list.
- FIX: Replaced plain <Select> in `Projeler.jsx` with a searchable Shadcn Combobox (Popover + Command, shouldFilter=false) doing server-side search: GET /api/customers?search=<debounced>&page_size=50. displayName threaded from form.customer_name for edit pre-fill. New i18n keys projects.searchCustomer / projects.noCustomerFound (DE+TR).
- Verified 100% (iteration_9): open→non-empty list, type-to-search filters server-side, select updates trigger, create + edit pre-fill all pass. Test project created & deleted (data clean).


## Round 9 — Projects (Projekte/Projeler) module (2026-07-01)
- New **Projects** module, fully SEPARATE from Accounting (own collections `projects`, `project_incomes`, `project_expenses` — never touches `transactions`).
- **List page** (`/projeler`): add project (customer, name, info, amount, currency EUR/TRY/USD — default EUR). Table shows amount, remaining receivable, profit.
- **Detail page** (`/projeler/:id`): summary cards (Projektsumme, Erhaltene Zahlungen, Offene Forderung, Gewinn). 
  - **Incomes**: date/amount/currency/note. Remaining receivable = amount − total income.
  - **Expenses**: name + total debt + optional initial payment. Per-expense installment **payments** (amount/currency/date/note/**receipt images**), paid/remaining, payment count. Expense detail dialog to add/delete payments + upload receipts.
  - **Profit = project amount − sum(expense total debts)** (per user choice).
- Delete project **cascades** to its incomes/expenses.
- Access controlled per role via **Settings > Zugriff** (`projects_visible_roles`); admin always sees. New role muhasebe supported.
- Uploads: `POST /api/uploads` now returns `/api/uploads/file/<name>` + a `GET` serve route → works on preview AND production.
- Verified 100% (iteration_8): backend 55/55 pytest (13 new), frontend all flows, accounting separation confirmed, zero bugs.

## Round 8 — Accounting (Buchhaltung/Muhasebe) module (2026-06-15)
- New **Accounting page** (`/muhasebe`): income & expense entries in **EUR**, optional description shown only after a category is picked.
  - Income types: Proje, Mağaza Satışı, Diğer. Expense types: Kira, Personel Maaşı, Muhasebe, Konaklama, Ulaşım, Fatura, Yazılım, Yemek, Yakıt, Diğer.
  - Search (matches category name + description), date-range filter, kind filter (all/income/expense), per-column **pagination**, side-by-side Einnahmen/Ausgaben columns, summary cards + **recharts** monthly bar chart.
- New user role **"Muhasebe Birimi" (muhasebe)** — sees everything; accounting access still governed by settings toggle.
- **Settings > Zugriff/Erişim tab**: `accounting_visible_roles` toggle controls which roles (sales/muhasebe) see the Accounting page; admin always sees it.
- **Dashboard finance chart** (income vs expense, 6 months) — hidden for roles not allowed to see accounting.
- Full DE/TR i18n. Backend: `routes/accounting.py` (CRUD + stats + RBAC), `transactions` collection + indexes, role validation extended.
- Verified 100% (iteration_7): backend 42/42 pytest (16 new), frontend all flows pass, zero bugs. Test data cleaned.

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
