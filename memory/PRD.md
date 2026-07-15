## Round 25 — FIX catalog title not translated (2026-06-XX)
- BUG: on translate, description+category → German but TITLE stayed Turkish (e.g. "Arıgastro Kahve Posa Çekmecesi Siyah" unchanged). Cause: system prompt said "keep brand and model names UNCHANGED" → gpt-4o-mini treated the whole product name as a brand name.
- FIX (routes/catalog.py translate system prompt): explicit rule — the TITLE is a product name, MUST translate descriptive/common words, keep ONLY the brand name + alphanumeric codes; added a worked example. Verified via curl: DE title now "Arıgastro Kaffeesatzschublade Schwarz".
- NOTE: already-translated products must be re-translated to pick up the new title.

## Round 24 — Catalog currency change (single + bulk) TRY/EUR (2026-06-XX)
- User: change catalog product currency individually and in bulk; reflect in XML & CSV. Choice: only currency LABEL changes (price number stays same); options TRY + EUR.
- Backend (routes/catalog.py): new POST /catalog/bulk-currency {ids, currency} → validates TRY/EUR (400 else), update_many sets currency + edited=True. Individual PUT already accepts currency. Verified via curl (EUR set, invalid→400, revert TRY).
- Frontend (Katalog.jsx): bulk bar currency Select (data-testid=catalog-bulk-currency), edit dialog currency Select (data-testid=edit-currency), saveEdit sends currency. i18n DE/TR.
- XML feed <g:price> already outputs {price}{currency} → reflects change automatically.
- NOTE: ikas CSV (36-col) has NO per-product currency column (store-level currency); CSV price stays numeric. Currency is carried by the XML feed.

## Round 23 — FIX ikas CSV import errors (Satış Kanalı + Açıklama HTML) (2026-06-XX)
- BUG1: ikas rejected rows with "Satış Kanalı: geçerli değerler VISIBLE,HIDDEN,PASSIVE". FIX: export_csv row[32]="VISIBLE", row[35]="true".
- BUG2: product descriptions collapsed into one block in ikas (HTML field ignored \n). FIX: _desc_html() wraps each line in <p>...</p> (html-escaped). Verified via curl.


## Round 22 — FIX catalog count (stale products) + answers (2026-07-14)
- BUG: catalog showed 4193 but live feed has 2860. Cause: import copied from stale `products` collection (daily sync never deletes items removed from feed → 1333 stale accumulated).
- FIX: /api/catalog/import now fetches the LIVE feed (fetch_feed+parse_feed_xml), upserts current items, and delete_many stale products that are no longer in feed AND edited!=True. Edited/translated products preserved across re-import.
- Reset all test translations → clean slate: catalog=2860, translated=0, edited=0, in_export=0.
- Verified 100% (iteration_17): count=2860 matches feed, import idempotent, edit-preservation works, /api/products (quote picker) is a separate dataset unaffected.
- Answered user: (2) the 4 test translations were done during testing and are now cleared; (3) quote-form 'Ürün Ekle' uses `products` collection — German catalog products never appear there.


## Round 21 — German Catalog module (separate, non-synced) (2026-07-14)
- New admin-only "Katalog" page (/katalog) + separate `catalog_products` collection (does NOT touch quote-form feed products in `products`; not auto-synced, so edits/translations persist).
- Backend routes/catalog.py: GET /products (pagination + search/brand/category filters), /facets, /count, POST /import (copy from feed: new inserted, non-edited refreshed, edited preserved), PUT+DELETE+bulk-delete, POST /translate (openai gpt-4o-mini, max 20, title/description/category→DE, sets edited/translated=locked), export add/remove flags, GET /export/info, PUBLIC GET /feed/{token}.xml (Google Shopping structure, German fields, only in_export products — appendable via same link), POST /export-csv (ikas 36-col format, UTF-8 BOM).
- feed_sync.py: additively captures mpn/condition/availability.
- Frontend Katalog.jsx: e-commerce table, bulk bar (translate/add-remove XML/CSV/delete), edit dialog (TR+DE), XML feed link with copy. Nav 'catalog' admin link + i18n (DE/TR).
- Verified 100% (iteration_16). DEPLOY NOTE: on prod open Katalog → "Feed'den İçe Aktar" once to populate catalog_products.


## Earlier rounds (1-20): see git history / prior PRD entries
- Round 20: FIX prod 502 by moving translate.py from emergentintegrations to official openai SDK (openai>=1.40.0 in requirements).
- Rounds 9-19: Projects module, Accounting module, Quote PDF translation (TR/DE), priceless PDF, receipt PDF upload, OpenAI key in Settings, editable expense debt.
- Rounds 5-8: Blueprint redesign, VAT/KDV, Gastromek rebrand (#70c800), i18n (DE default + TR).

## Original Problem Statement
Turkish/German B2B CRM for Gastromek (endüstriyel mutfak ekipmanları): customer management + professional price quotation workflow, XML product sync (Myikas Google Shopping feed), quote PDF gen + email, Admin/Sales roles, i18n (DE default/TR), Accounting & Projects modules, Catalog module (AI translate + XML/CSV export).

## Architecture
- Backend: FastAPI + MongoDB (motor). Routes: auth, users, customers, products, quotes, settings, accounting, projects, catalog, translate, uploads. JWT cookie auth. APScheduler daily feed sync.
- Frontend: React 19 + Router + Tailwind + shadcn/ui + lucide-react. i18n DE/TR.
- Integrations: OpenAI SDK (user key in Settings DB), Myikas XML feed, Resend email.
- DB collections: customers, products, quotes, settings, transactions (accounting), projects/project_incomes/project_expenses, catalog_products (isolated), catalog_meta.

## Prioritized Backlog
- P2: Off-site automated backups (Hetzner Storage Box or S3).
- P1: shadcn Calendar date pickers, quote duplication, bulk email campaigns.

## Test Credentials
See /app/memory/test_credentials.md (preview: admin@arigastro.com / admin123).
