# FinSnap Ledger

Offline-first personal transaction tracker for Android (Capacitor) and web.
Parses Indian bank UPI SMS alerts with AI, auto-categorizes spending, and syncs
to your private Supabase cloud and Notion databases.

## Architecture

```
src/
  App.tsx                 Thin shell: auth gate, tab router, sync indicator
  components/ui/          Design-system primitives (fintech dark theme)
  components/             Shared widgets (AndroidFrame, BottomNav, TransactionRow, …)
  features/
    auth/                 Welcome / sign-up / sign-in (Supabase Auth)
    dashboard/            Balance card, AI fast-entry, SMS simulator, filters, list
    transactions/         Add / edit form with smart category suggestions
    rules/                Keyword → category automation rules
    analytics/            Donut, weekly trend, category rankings (Recharts)
  hooks/                  useTransactionFilters, useCategorySuggestion, useNotionSync
  store/                  Zustand stores (transactions, settings, sync, form draft)
  services/
    db.ts                 Dexie (IndexedDB) schema v2 — local source of truth
    syncEngine.ts         Outbox push + cursor pull, last-write-wins merge
    supabase.ts           Auth + cloud replica (RLS-protected)
  lib/                    format, csv export, date ranges
backend/                  Express API: AI parsing (Gemini/OpenRouter/OpenAI), Notion proxy
api/index.ts              Vercel serverless entry
supabase/migrations/      Postgres schema + row-level security policies
```

### Data flow (local-first)

1. Every write lands in Dexie immediately and is marked `dirty`.
2. The sync engine pushes dirty rows to Supabase (debounced, on reconnect, every 60 s).
3. Pull fetches rows with `updated_at` newer than the last cursor; conflicts resolve
   last-write-wins. Deletes propagate as soft-delete tombstones.
4. The app works fully offline; the cloud catches up when you're back online.

## Setup

1. `npm install`
2. Copy `.env.example` → `.env.local`, fill in keys.
3. Apply `supabase/migrations/0001_transactions.sql` in the Supabase SQL editor
   (creates the `transactions` table with row-level security).
4. `npm run dev` → http://localhost:3000

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Express + Vite dev server |
| `npm run build` | Web bundle + server bundle |
| `npm run typecheck` / `lint` / `test` | Quality gates (also run in CI) |

## CI / CD

| Workflow | Trigger | What it does |
|---|---|---|
| **CI** (`.github/workflows/ci.yml`) | Every push to `main` / `claude/**` and all PRs | Lint → Typecheck → Test → Web build |
| **Android Build** (`.github/workflows/android.yml`) | Push to `main` and version tags `v*.*.*` | Debug APK on every push; signed release AAB on tags |

### Release signing (Play Store AAB)

Tag a release (`git tag v1.0.0 && git push --tags`) to trigger the signed AAB job.
Required repository secrets: `KEYSTORE_BASE64`, `SIGNING_STORE_PASSWORD`,
`SIGNING_KEY_ALIAS`, `SIGNING_KEY_PASSWORD`.

## Production checklist

- [x] Feature-modular frontend, no monoliths
- [x] Local-first storage with cloud sync + RLS per-user isolation
- [x] Supabase Auth (email/password)
- [x] Rate-limited, zod-validated API with global error handler
- [x] CORS restricted via `ALLOWED_ORIGINS`
- [x] Secrets in env / secure storage, never committed
- [x] CI: lint, typecheck, tests, build on every push
